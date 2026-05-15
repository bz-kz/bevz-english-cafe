"""StripeService tests — Stripe SDK fully mocked, no network."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
import stripe

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


async def test_webhook_bad_signature_raises(service):
    with patch(
        "stripe.Webhook.construct_event",
        side_effect=stripe.SignatureVerificationError("bad", "sig"),
    ):
        with pytest.raises(stripe.SignatureVerificationError):
            await service.handle_webhook(raw_payload=b"{}", sig_header="bad")


def _event(etype: str, obj: dict, eid: str = "evt_x") -> dict:
    return {"id": eid, "type": etype, "data": {"object": obj}}


async def test_checkout_completed_saves_customer_and_plan(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="cu1", email="cu1@example.com", name="Cu1")
    )
    sub_obj = {
        "metadata": {"firebase_uid": "cu1"},
        "items": {"data": [{"price": {"id": "price_standard"}}]},
    }
    ev = _event(
        "checkout.session.completed",
        {
            "client_reference_id": "cu1",
            "customer": "cus_1",
            "subscription": "sub_1",
        },
    )
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    got = await FirestoreUserRepository(client).find_by_uid("cu1")
    assert got.stripe_customer_id == "cus_1"
    assert got.stripe_subscription_id == "sub_1"
    assert got.subscription_status == "active"
    assert got.plan == Plan.STANDARD
    # no quota granted by checkout.session.completed
    docs = [d async for d in client.collection("monthly_quota").stream()]
    assert docs == []


def _invoice_event(eid: str, sub_id: str = "sub_p") -> dict:
    return _event("invoice.paid", {"id": "in_1", "subscription": sub_id}, eid)


async def test_invoice_paid_grants_full_quota(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="ip1", email="ip1@example.com", name="Ip1")
    )
    sub_obj = {
        "metadata": {"firebase_uid": "ip1"},
        "items": {"data": [{"price": {"id": "price_light"}}]},
    }
    ev = _invoice_event("evt_ip1")
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    docs = [d.to_dict() async for d in client.collection("monthly_quota").stream()]
    assert len(docs) == 1
    assert docs[0]["granted"] == 4  # PLAN_QUOTA[LIGHT]
    assert docs[0]["plan_at_grant"] == "light"
    pe = [d async for d in client.collection("processed_stripe_events").stream()]
    assert len(pe) == 1


async def test_invoice_paid_duplicate_event_skips(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="ip2", email="ip2@example.com", name="Ip2")
    )
    sub_obj = {
        "metadata": {"firebase_uid": "ip2"},
        "items": {"data": [{"price": {"id": "price_light"}}]},
    }
    ev = _invoice_event("evt_dup")
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    docs = [d async for d in client.collection("monthly_quota").stream()]
    assert len(docs) == 1  # exactly-once despite re-delivery


async def test_invoice_paid_any_billing_reason_grants(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="ip3", email="ip3@example.com", name="Ip3")
    )
    sub_obj = {
        "metadata": {"firebase_uid": "ip3"},
        "items": {"data": [{"price": {"id": "price_intensive"}}]},
    }
    ev = _event(
        "invoice.paid",
        {
            "id": "in_3",
            "subscription": "sub_3",
            "billing_reason": "subscription_update",
        },
        "evt_ip3",
    )
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    docs = [d.to_dict() async for d in client.collection("monthly_quota").stream()]
    assert len(docs) == 1 and docs[0]["granted"] == 16  # Y: grants regardless
