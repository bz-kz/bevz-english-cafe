"""StripeService — checkout/portal sessions + webhook dispatch.

公式 stripe lib は同期。FastAPI async 経路では asyncio.to_thread で
オフロードする。invoice.paid の quota grant + processed_event 書き込みは
単一 Firestore transaction (exactly-once)。
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import stripe
from fastapi import HTTPException, status
from google.cloud import firestore as fs

from app.config import Settings
from app.domain.enums.plan import Plan
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)
from app.infrastructure.repositories.firestore_processed_event_repository import (
    FirestoreProcessedEventRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

STRIPE_API_VERSION = "2024-06-20"


class StripeService:
    def __init__(
        self,
        *,
        user_repo: FirestoreUserRepository,
        quota_repo: FirestoreMonthlyQuotaRepository,
        email_service: EmailService,
        processed_repo: FirestoreProcessedEventRepository,
        fs_client: fs.AsyncClient,
        settings: Settings,
    ) -> None:
        self._users = user_repo
        self._quota = quota_repo
        self._email = email_service
        self._processed = processed_repo
        self._fs = fs_client
        self._settings = settings
        stripe.api_key = settings.stripe_secret_key
        # 冪等な定数代入 (常に同値) なので並行リクエストでも安全
        stripe.api_version = STRIPE_API_VERSION
        self._price_map: dict[Plan, str] = {
            Plan.LIGHT: settings.stripe_price_light,
            Plan.STANDARD: settings.stripe_price_standard,
            Plan.INTENSIVE: settings.stripe_price_intensive,
        }
        self._plan_for_price: dict[str, Plan] = {
            v: k for k, v in self._price_map.items() if v
        }

    async def create_checkout_session(self, *, user: Any, plan: Plan) -> str:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            mode="subscription",
            line_items=[{"price": self._price_map[plan], "quantity": 1}],
            client_reference_id=user.uid,
            subscription_data={"metadata": {"firebase_uid": user.uid}},
            customer=user.stripe_customer_id or None,  # type: ignore[arg-type]
            customer_email=user.email  # type: ignore[arg-type]
            if not user.stripe_customer_id
            else None,
            automatic_tax={"enabled": True},
            success_url=self._settings.checkout_success_url,
            cancel_url=self._settings.checkout_cancel_url,
        )
        return str(session.url)

    async def create_portal_session(self, *, user: Any) -> str:
        if not user.stripe_customer_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "no_subscription"},
            )
        session = await asyncio.to_thread(
            stripe.billing_portal.Session.create,
            customer=user.stripe_customer_id,
            return_url=self._settings.stripe_portal_return_url,
        )
        return str(session.url)
