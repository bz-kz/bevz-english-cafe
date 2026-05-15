"""StripeService tests — Stripe SDK fully mocked, no network."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.config import Settings
from app.domain.entities.user import User
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
from app.services.email_service import MockEmailService
from app.services.stripe_service import StripeService


def _settings() -> Settings:
    s = Settings()
    s.stripe_secret_key = "sk_test_dummy"
    s.stripe_webhook_secret = "whsec_dummy"
    s.stripe_price_light = "price_light"
    s.stripe_price_standard = "price_standard"
    s.stripe_price_intensive = "price_intensive"
    return s


@pytest.fixture
async def client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture(autouse=True)
async def _clean(client):
    for col in ("users", "monthly_quota", "processed_stripe_events"):
        async for d in client.collection(col).stream():
            await d.reference.delete()
    yield


@pytest.fixture
async def service(client):
    return StripeService(
        user_repo=FirestoreUserRepository(client),
        quota_repo=FirestoreMonthlyQuotaRepository(client),
        email_service=MockEmailService(),
        processed_repo=FirestoreProcessedEventRepository(client),
        fs_client=client,
        settings=_settings(),
    )


async def test_create_checkout_session_params(service):
    with patch("stripe.checkout.Session.create") as m:
        m.return_value = MagicMock(url="https://checkout.stripe/x")
        user = User(uid="u1", email="u1@example.com", name="U1")
        url = await service.create_checkout_session(user=user, plan=Plan.STANDARD)
    assert url == "https://checkout.stripe/x"
    kwargs = m.call_args.kwargs
    assert kwargs["client_reference_id"] == "u1"
    assert kwargs["subscription_data"]["metadata"]["firebase_uid"] == "u1"
    assert kwargs["line_items"][0]["price"] == "price_standard"
    assert kwargs["automatic_tax"] == {"enabled": True}
    assert kwargs["mode"] == "subscription"


async def test_create_portal_no_customer_raises_409(service):
    from fastapi import HTTPException

    user = User(uid="u2", email="u2@example.com", name="U2")
    with pytest.raises(HTTPException) as ei:
        await service.create_portal_session(user=user)
    assert ei.value.status_code == 409


async def test_create_portal_with_customer(service):
    with patch("stripe.billing_portal.Session.create") as m:
        m.return_value = MagicMock(url="https://portal.stripe/x")
        user = User(uid="u3", email="u3@example.com", name="U3")
        user.stripe_customer_id = "cus_3"
        url = await service.create_portal_session(user=user)
    assert url == "https://portal.stripe/x"
    assert m.call_args.kwargs["customer"] == "cus_3"
