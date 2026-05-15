"""StripeService — checkout/portal sessions + webhook dispatch.

公式 stripe lib は同期。FastAPI async 経路では asyncio.to_thread で
オフロードする。invoice.paid の quota grant + processed_event 書き込みは
単一 Firestore transaction (exactly-once)。
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

import stripe
from fastapi import HTTPException, status
from google.cloud import firestore as fs

from app.config import Settings
from app.domain.entities.monthly_quota import MonthlyQuota
from app.domain.enums.plan import PLAN_QUOTA, Plan
from app.domain.services.quota_expiry import add_two_months
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

    def _resolve_sub_id(self, invoice: Any) -> str | None:
        sub = invoice.get("subscription")
        if sub:
            return str(sub)
        parent = invoice.get("parent") or {}
        details = parent.get("subscription_details") or {}
        sub = details.get("subscription")
        return str(sub) if sub else None

    async def _resolve_uid_plan(self, invoice: Any) -> tuple[str, Plan] | None:
        sub_id = self._resolve_sub_id(invoice)
        if not sub_id:
            logger.error("invoice has no subscription id: %s", invoice.get("id"))
            return None
        subscription = await asyncio.to_thread(stripe.Subscription.retrieve, sub_id)
        uid = (subscription.get("metadata") or {}).get("firebase_uid")
        if not uid:
            logger.error("subscription %s missing firebase_uid", sub_id)
            return None
        price_id = subscription["items"]["data"][0]["price"]["id"]
        plan = self._plan_for_price.get(price_id)
        if plan is None:
            logger.error("unknown price id %s", price_id)
            return None
        return uid, plan

    async def handle_webhook(self, *, raw_payload: bytes, sig_header: str) -> None:
        event = await asyncio.to_thread(
            stripe.Webhook.construct_event,
            raw_payload,
            sig_header,
            self._settings.stripe_webhook_secret,
        )
        etype = event["type"]
        obj = event["data"]["object"]
        if etype == "invoice.paid":
            await self._on_invoice_paid(event["id"], obj)
        elif etype == "checkout.session.completed":
            await self._on_checkout_completed(event["id"], etype, obj)
        elif etype == "customer.subscription.updated":
            await self._on_subscription_updated(event["id"], etype, obj)
        elif etype == "customer.subscription.deleted":
            await self._on_subscription_deleted(event["id"], etype, obj)
        elif etype == "invoice.payment_failed":
            await self._on_payment_failed(event["id"], etype, obj)
        else:
            logger.info("ignoring stripe event %s", etype)

    async def _on_invoice_paid(self, event_id: str, invoice: Any) -> None:
        # --- (txn の外) network I/O で uid/plan を確定 ---
        resolved = await self._resolve_uid_plan(invoice)
        if resolved is None:
            return  # logged inside; 200 to Stripe (no retry storm)
        uid, plan = resolved
        now = datetime.now(UTC)
        granted = PLAN_QUOTA[plan]
        quota = MonthlyQuota(
            user_id=uid,
            year_month=now.strftime("%Y-%m"),
            plan_at_grant=plan.value,
            granted=granted,
            used=0,
            granted_at=now,
            expires_at=add_two_months(now),
        )
        quota_doc_id = f"{uid}_{now.strftime('%Y%m%d%H%M%S%f')}"
        quota_dict = self._quota._to_dict(quota)
        pe_ref = self._fs.collection("processed_stripe_events").document(event_id)
        quota_ref = self._fs.collection("monthly_quota").document(quota_doc_id)

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            pe_snap = await pe_ref.get(transaction=tx)
            if pe_snap.exists:
                return  # exactly-once: already processed (before any write)
            tx.set(quota_ref, quota_dict)
            tx.set(
                pe_ref,
                {"event_type": "invoice.paid", "processed_at": datetime.now(UTC)},
            )

        await txn(self._fs.transaction())

    async def _on_checkout_completed(self, event_id: str, etype: str, obj: Any) -> None:
        uid = obj.get("client_reference_id")
        if not uid:
            logger.error("checkout.session.completed missing client_reference_id")
            return
        user = await self._users.find_by_uid(uid)
        if user is None:
            logger.error("checkout completed for unknown uid %s", uid)
            return
        sub_id = obj.get("subscription")
        plan: Plan | None = None
        if sub_id:
            subscription = await asyncio.to_thread(stripe.Subscription.retrieve, sub_id)
            price_id = subscription["items"]["data"][0]["price"]["id"]
            plan = self._plan_for_price.get(price_id)
        user.update_subscription(
            customer_id=obj.get("customer"),
            subscription_id=sub_id,
            status="active",
        )
        if plan is not None:
            user.set_plan(plan)
        # save BEFORE claim: this event is the sole carrier of
        # stripe_customer_id; a claim-first lost-write would strand the
        # paying user without a customer id. save is an idempotent
        # overwrite so double-processing is harmless.
        await self._users.save(user)
        await self._processed.claim(event_id, etype)

    async def _on_subscription_updated(
        self, event_id: str, etype: str, sub: Any
    ) -> None:
        raise NotImplementedError

    async def _on_subscription_deleted(
        self, event_id: str, etype: str, sub: Any
    ) -> None:
        raise NotImplementedError

    async def _on_payment_failed(self, event_id: str, etype: str, invoice: Any) -> None:
        raise NotImplementedError
