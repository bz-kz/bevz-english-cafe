import os
from datetime import UTC, datetime

import pytest
from google.cloud import firestore as fs

from app.domain.entities.monthly_quota import MonthlyQuota
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)

pytestmark = pytest.mark.skipif(
    "FIRESTORE_EMULATOR_HOST" not in os.environ,
    reason="Requires Firestore emulator",
)


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("monthly_quota").stream():
        await doc.reference.delete()
    yield FirestoreMonthlyQuotaRepository(client)


async def test_save_and_find_roundtrip(repo):
    q = MonthlyQuota(
        user_id="u1",
        year_month="2026-05",
        plan_at_grant="standard",
        granted=8,
        used=0,
        granted_at=datetime(2026, 5, 1, tzinfo=UTC),
        expires_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    await repo.save(q)
    fetched = await repo.find("u1", "2026-05")
    assert fetched is not None
    assert fetched.granted == 8
    assert fetched.used == 0
    assert fetched.plan_at_grant == "standard"


async def test_find_returns_none_when_absent(repo):
    fetched = await repo.find("u-missing", "2026-05")
    assert fetched is None
