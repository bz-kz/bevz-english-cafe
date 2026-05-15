import os
from datetime import UTC, datetime, timedelta

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.monthly_quota import MonthlyQuota  # noqa: E402
from app.infrastructure.repositories.firestore_monthly_quota_repository import (  # noqa: E402
    FirestoreMonthlyQuotaRepository,
)


def _q(uid, granted_at, granted=4, used=0, expires_at=None):
    return MonthlyQuota(
        user_id=uid,
        year_month=granted_at.astimezone().strftime("%Y-%m"),
        plan_at_grant="light",
        granted=granted,
        used=used,
        granted_at=granted_at,
        expires_at=expires_at or (granted_at + timedelta(days=60)),
    )


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for d in client.collection("monthly_quota").stream():
        await d.reference.delete()
    return FirestoreMonthlyQuotaRepository(client)


async def test_save_uses_granted_at_doc_id(repo):
    ga = datetime(2026, 5, 15, 9, 0, 0, 123456, tzinfo=UTC)
    q = _q("u1", ga)
    await repo.save(q)
    found = await repo.find_by_doc_id(f"u1_{ga.strftime('%Y%m%d%H%M%S%f')}")
    assert found is not None
    assert found.user_id == "u1"


async def test_find_active_excludes_expired(repo):
    now = datetime(2026, 5, 15, tzinfo=UTC)
    await repo.save(
        _q("u1", now - timedelta(days=90), expires_at=now - timedelta(days=1))
    )  # expired
    await repo.save(
        _q("u1", now - timedelta(days=10), expires_at=now + timedelta(days=50))
    )  # active
    active = await repo.find_active_for_user("u1", now)
    assert len(active) == 1


async def test_find_active_excludes_exhausted(repo):
    now = datetime(2026, 5, 15, tzinfo=UTC)
    await repo.save(
        _q(
            "u1",
            now - timedelta(days=5),
            granted=4,
            used=4,
            expires_at=now + timedelta(days=55),
        )
    )
    assert await repo.find_active_for_user("u1", now) == []


async def test_find_active_sorted_fifo(repo):
    now = datetime(2026, 5, 15, tzinfo=UTC)
    await repo.save(
        _q("u1", now - timedelta(days=2), expires_at=now + timedelta(days=58))
    )
    await repo.save(
        _q("u1", now - timedelta(days=20), expires_at=now + timedelta(days=40))
    )
    active = await repo.find_active_for_user("u1", now)
    assert active[0].granted_at < active[1].granted_at  # oldest first
