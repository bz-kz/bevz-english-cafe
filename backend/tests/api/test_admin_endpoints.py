"""HTTP-level tests for /api/v1/admin/* endpoints."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.api.dependencies.auth import get_admin_user, get_current_user
from app.api.dependencies.repositories import (
    get_booking_service,
    get_user_repository,
)
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)
from app.main import app
from app.services.booking_service import BookingService


def _now() -> datetime:
    return datetime.now(UTC)


@pytest.fixture
async def client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture(autouse=True)
async def clean(client):
    for col in ("lesson_slots", "bookings", "users", "monthly_quota"):
        async for doc in client.collection(col).stream():
            await doc.reference.delete()
    yield


@pytest.fixture
def admin_user():
    now = _now()
    u = User(
        uid="admin-uid",
        email="admin@example.com",
        name="Admin",
        phone=None,
        plan=None,
        plan_started_at=None,
        trial_used=False,
        created_at=now,
        updated_at=now,
    )
    u.is_admin = True
    return u


@pytest.fixture
def http(admin_user, client):
    """Inject admin auth + bind booking_service / user_repo to the test
    firestore client so endpoint reads see fixture-seeded docs."""
    slot_repo = FirestoreLessonSlotRepository(client)
    booking_repo = FirestoreBookingRepository(client)
    quota_repo = FirestoreMonthlyQuotaRepository(client)
    user_repo = FirestoreUserRepository(client)
    service = BookingService(slot_repo, booking_repo, client, quota_repo, user_repo)

    app.dependency_overrides[get_admin_user] = lambda: admin_user
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_booking_service] = lambda: service
    app.dependency_overrides[get_user_repository] = lambda: user_repo
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    app.dependency_overrides.clear()


async def _make_slot(client, *, start_offset_h=48) -> str:
    slot_id = str(uuid4())
    start = _now() + timedelta(hours=start_offset_h)
    await (
        client.collection("lesson_slots")
        .document(slot_id)
        .set(
            {
                "id": slot_id,
                "start_at": start,
                "end_at": start + timedelta(minutes=30),
                "lesson_type": LessonType.GROUP.value,
                "capacity": 5,
                "booked_count": 0,
                "price_yen": None,
                "teacher_id": None,
                "notes": None,
                "status": SlotStatus.OPEN.value,
                "created_at": _now(),
                "updated_at": _now(),
            }
        )
    )
    return slot_id


async def _make_user(
    client, *, uid="u1", email="u1@example.com", name="Test User"
) -> None:
    await (
        client.collection("users")
        .document(uid)
        .set(
            {
                "uid": uid,
                "email": email,
                "name": name,
                "phone": None,
                "plan": None,
                "plan_started_at": None,
                "trial_used": False,
                "created_at": _now(),
                "updated_at": _now(),
            }
        )
    )


async def test_force_book_returns_201(http, client):
    slot_id = await _make_slot(client)
    await _make_user(client)
    async with http as h:
        r = await h.post(
            f"/api/v1/admin/lesson-slots/{slot_id}/bookings",
            json={"user_id": "u1", "consume_quota": False, "consume_trial": False},
        )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "confirmed"


async def test_force_cancel_returns_200(http, client):
    slot_id = await _make_slot(client)
    await _make_user(client)
    async with http as h:
        b = await h.post(
            f"/api/v1/admin/lesson-slots/{slot_id}/bookings",
            json={"user_id": "u1", "consume_quota": False, "consume_trial": False},
        )
        booking_id = b.json()["id"]
        r = await h.post(
            f"/api/v1/admin/bookings/{booking_id}/cancel",
            json={"refund_quota": False, "refund_trial": False},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


async def test_admin_users_search_prefix(http, client):
    await _make_user(client, uid="u1", email="taro@example.com", name="Yamada")
    await _make_user(client, uid="u2", email="hanako@example.com", name="Sato")
    async with http as h:
        r = await h.get("/api/v1/admin/users?q=taro")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["uid"] == "u1"


async def test_admin_users_empty_query_lists_all(http, client):
    await _make_user(client, uid="u1", email="taro@example.com")
    await _make_user(client, uid="u2", email="hanako@example.com")
    async with http as h:
        r = await h.get("/api/v1/admin/users")
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_admin_non_admin_forbidden(client):
    """non-admin user gets 403."""
    from fastapi import HTTPException
    from fastapi import status as st

    async def deny():
        raise HTTPException(status_code=st.HTTP_403_FORBIDDEN, detail="x")

    app.dependency_overrides[get_admin_user] = deny
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://t"
        ) as h:
            r = await h.get("/api/v1/admin/users")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()
