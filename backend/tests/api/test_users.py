"""Tests for GET /api/v1/users/me — aggregate quota_summary (multi-doc)."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from fastapi import FastAPI  # noqa: E402

from app.api.dependencies.auth import get_current_user  # noqa: E402
from app.api.dependencies.repositories import (  # noqa: E402
    get_monthly_quota_repository,
)
from app.domain.entities.monthly_quota import MonthlyQuota  # noqa: E402
from app.domain.entities.user import User  # noqa: E402
from app.domain.repositories.monthly_quota_repository import (  # noqa: E402
    MonthlyQuotaRepository,
)
from app.infrastructure.repositories.firestore_monthly_quota_repository import (  # noqa: E402
    FirestoreMonthlyQuotaRepository,
)


@pytest.fixture
async def authed_user(app: FastAPI, firestore_client) -> AsyncIterator[User]:
    """Logged-in test user; overrides get_current_user + the quota repo so
    the endpoint reads the same emulator project the test seeds."""
    async for doc in firestore_client.collection("monthly_quota").stream():
        await doc.reference.delete()
    user = User(uid="me-uid-1", email="me@example.com", name="Me User")

    async def _override() -> User:
        return user

    def _override_quota_repo() -> MonthlyQuotaRepository:
        return FirestoreMonthlyQuotaRepository(firestore_client)

    app.dependency_overrides[get_current_user] = _override
    app.dependency_overrides[get_monthly_quota_repository] = _override_quota_repo
    try:
        yield user
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_monthly_quota_repository, None)


def _quota(
    uid: str, *, granted: int, used: int, granted_at: datetime, expires_at: datetime
) -> MonthlyQuota:
    return MonthlyQuota(
        user_id=uid,
        year_month=granted_at.astimezone().strftime("%Y-%m"),
        plan_at_grant="light",
        granted=granted,
        used=used,
        granted_at=granted_at,
        expires_at=expires_at,
    )


async def test_me_quota_summary_aggregates_active(
    client, authed_user, firestore_client
):
    repo = FirestoreMonthlyQuotaRepository(firestore_client)
    now = datetime.now(UTC)
    near_expiry = now + timedelta(days=20)
    far_expiry = now + timedelta(days=55)
    await repo.save(
        _quota(
            authed_user.uid,
            granted=4,
            used=1,
            granted_at=now - timedelta(days=20),
            expires_at=near_expiry,
        )
    )
    await repo.save(
        _quota(
            authed_user.uid,
            granted=4,
            used=0,
            granted_at=now - timedelta(days=2),
            expires_at=far_expiry,
        )
    )
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["quota_summary"] is not None
    assert body["quota_summary"]["total_remaining"] == 7  # (4-1) + (4-0)
    returned = datetime.fromisoformat(body["quota_summary"]["next_expiry"])
    assert abs((returned - near_expiry).total_seconds()) < 1


async def test_me_quota_summary_null_when_no_quota(
    client, authed_user, firestore_client
):
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["quota_summary"] is None
