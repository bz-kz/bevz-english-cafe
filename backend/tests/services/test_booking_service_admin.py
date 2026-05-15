"""Integration tests for BookingService.admin_force_book + admin_force_cancel."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
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
from app.services.booking_errors import (
    AlreadyBookedError,
    SlotFullError,
    UserNotFoundError,
)
from app.services.booking_service import BookingService


def _now() -> datetime:
    return datetime.now(UTC)


@pytest.fixture
async def firestore_client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture
async def service(firestore_client):
    for col in ("lesson_slots", "bookings", "users", "monthly_quota"):
        async for doc in firestore_client.collection(col).stream():
            await doc.reference.delete()
    slot_repo = FirestoreLessonSlotRepository(firestore_client)
    booking_repo = FirestoreBookingRepository(firestore_client)
    quota_repo = FirestoreMonthlyQuotaRepository(firestore_client)
    user_repo = FirestoreUserRepository(firestore_client)
    return BookingService(
        slot_repo, booking_repo, firestore_client, quota_repo, user_repo
    )


async def _make_slot(
    client,
    *,
    start_offset_h=48,
    capacity=5,
    lesson_type=LessonType.GROUP,
    status=SlotStatus.OPEN,
) -> str:
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
                "lesson_type": lesson_type.value,
                "capacity": capacity,
                "booked_count": 0,
                "price_yen": None,
                "teacher_id": None,
                "notes": None,
                "status": status.value,
                "created_at": _now(),
                "updated_at": _now(),
            }
        )
    )
    return slot_id


async def _make_user(
    client, *, uid="u1", email="u1@example.com", trial_used=False
) -> None:
    await (
        client.collection("users")
        .document(uid)
        .set(
            {
                "uid": uid,
                "email": email,
                "name": "Test",
                "phone": None,
                "plan": None,
                "plan_started_at": None,
                "trial_used": trial_used,
                "created_at": _now(),
                "updated_at": _now(),
            }
        )
    )


async def test_force_book_happy_path_no_quota(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED
    snap = await firestore_client.collection("lesson_slots").document(slot_id).get()
    assert snap.to_dict()["booked_count"] == 1


async def test_force_book_within_24h_succeeds(service, firestore_client):
    slot_id = await _make_slot(firestore_client, start_offset_h=1)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED


async def test_force_book_past_slot_succeeds(service, firestore_client):
    slot_id = await _make_slot(firestore_client, start_offset_h=-2)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED


async def test_force_book_closed_slot_succeeds(service, firestore_client):
    slot_id = await _make_slot(firestore_client, status=SlotStatus.CLOSED)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED


async def test_force_book_capacity_full_raises(service, firestore_client):
    slot_id = await _make_slot(firestore_client, capacity=1)
    await _make_user(firestore_client, uid="u1")
    await _make_user(firestore_client, uid="u2", email="u2@example.com")
    await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    with pytest.raises(SlotFullError):
        await service.admin_force_book(
            slot_id=slot_id, user_id="u2", consume_quota=False, consume_trial=False
        )


async def test_force_book_unknown_user_raises(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    with pytest.raises(UserNotFoundError):
        await service.admin_force_book(
            slot_id=slot_id, user_id="ghost", consume_quota=False, consume_trial=False
        )


async def test_force_book_duplicate_raises(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    with pytest.raises(AlreadyBookedError):
        await service.admin_force_book(
            slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
        )


async def test_force_book_consume_trial_sets_flag(service, firestore_client):
    slot_id = await _make_slot(firestore_client, lesson_type=LessonType.TRIAL)
    await _make_user(firestore_client)
    await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=True
    )
    snap = await firestore_client.collection("users").document("u1").get()
    assert snap.to_dict()["trial_used"] is True


async def test_force_book_consume_quota_when_doc_missing_skips(
    service, firestore_client
):
    """quota doc が無くても booking 自体は成功する。"""
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=True, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED


async def test_force_book_consume_quota_allows_overuse(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    from zoneinfo import ZoneInfo

    ym = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m")
    await (
        firestore_client.collection("monthly_quota")
        .document(f"u1_{ym}")
        .set(
            {
                "user_id": "u1",
                "year_month": ym,
                "granted": 4,
                "used": 4,
                "granted_at": _now(),
            }
        )
    )
    await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=True, consume_trial=False
    )
    snap = await firestore_client.collection("monthly_quota").document(f"u1_{ym}").get()
    assert snap.to_dict()["used"] == 5  # used > granted 許容
