"""HTTP tests for /api/v1/billing/*."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from app.api.dependencies.auth import get_current_user
from app.domain.entities.user import User
from app.main import app


@pytest.fixture
def user():
    return User(uid="b1", email="b1@example.com", name="B1")


@pytest.fixture
def http(user):
    app.dependency_overrides[get_current_user] = lambda: user
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://t")
    app.dependency_overrides.clear()


async def test_checkout_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as h:
        r = await h.post("/api/v1/billing/checkout", json={"plan": "light"})
    # 422 = required Authorization header missing (auth-gated before handler)
    assert r.status_code in (401, 403, 422)


async def test_checkout_returns_url(http):
    with patch("stripe.checkout.Session.create") as m:
        m.return_value = MagicMock(url="https://checkout/x")
        async with http as h:
            r = await h.post("/api/v1/billing/checkout", json={"plan": "standard"})
    assert r.status_code == 200
    assert r.json()["url"] == "https://checkout/x"


async def test_portal_no_customer_409(http):
    async with http as h:
        r = await h.post("/api/v1/billing/portal", json={})
    assert r.status_code == 409


async def test_webhook_bad_signature_400():
    with patch(
        "stripe.Webhook.construct_event",
        side_effect=__import__("stripe").SignatureVerificationError("x", "s"),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://t"
        ) as h:
            r = await h.post(
                "/api/v1/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "bad"},
            )
    assert r.status_code == 400


async def test_webhook_ok_200():
    ev = {"id": "e1", "type": "ping", "data": {"object": {}}}
    with patch("stripe.Webhook.construct_event", return_value=ev):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://t"
        ) as h:
            r = await h.post(
                "/api/v1/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "ok"},
            )
    assert r.status_code == 200
