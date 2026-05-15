"""Integration tests for BookingService.admin_force_book + admin_force_cancel."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.monthly_quota import MonthlyQuota  # noqa: E402
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


async def _seed_active_quota(
    client, *, uid="u1", granted=4, used=0, granted_at=None, expires_at=None
) -> str:
    """Persist an active (multi-doc scheme) quota via the repo; return doc id."""
    ga = granted_at or (_now() - timedelta(days=1))
    q = MonthlyQuota(
        user_id=uid,
        year_month=ga.astimezone().strftime("%Y-%m"),
        plan_at_grant="light",
        granted=granted,
        used=used,
        granted_at=ga,
        expires_at=expires_at or (_now() + timedelta(days=30)),
    )
    await FirestoreMonthlyQuotaRepository(client).save(q)
    return f"{uid}_{ga.strftime('%Y%m%d%H%M%S%f')}"


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


async def test_force_book_consume_quota_exhausted_warns_and_succeeds(
    service, firestore_client
):
    # exhausted-only doc is not active under FIFO → warn + proceed,
    # booking succeeds, no consumed id, exhausted doc untouched.
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    doc_id = await _seed_active_quota(firestore_client, uid="u1", granted=4, used=4)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=True, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED
    assert booking.consumed_quota_doc_id is None
    snap = await firestore_client.collection("monthly_quota").document(doc_id).get()
    assert snap.to_dict()["used"] == 4  # untouched


async def test_force_cancel_happy_path(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    cancelled = await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=False
    )
    assert cancelled.status == BookingStatus.CANCELLED
    snap = await firestore_client.collection("lesson_slots").document(slot_id).get()
    assert snap.to_dict()["booked_count"] == 0


async def test_force_cancel_within_24h_succeeds(service, firestore_client):
    slot_id = await _make_slot(firestore_client, start_offset_h=1)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    cancelled = await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=False
    )
    assert cancelled.status == BookingStatus.CANCELLED


async def test_force_cancel_idempotent(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=False
    )
    again = await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=False
    )
    assert again.status == BookingStatus.CANCELLED
    snap = await firestore_client.collection("lesson_slots").document(slot_id).get()
    assert snap.to_dict()["booked_count"] == 0  # not decremented twice


async def test_force_cancel_refund_quota(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    doc_id = await _seed_active_quota(firestore_client, uid="u1", granted=4, used=1)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=True, consume_trial=False
    )
    assert booking.consumed_quota_doc_id == doc_id
    await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=True, refund_trial=False
    )
    snap = await firestore_client.collection("monthly_quota").document(doc_id).get()
    assert snap.to_dict()["used"] == 1  # back to pre-force-book level


async def test_force_cancel_refund_trial(service, firestore_client):
    slot_id = await _make_slot(firestore_client, lesson_type=LessonType.TRIAL)
    await _make_user(firestore_client, trial_used=False)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=True
    )
    await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=True
    )
    snap = await firestore_client.collection("users").document("u1").get()
    assert snap.to_dict()["trial_used"] is False


async def test_admin_force_cancel_refund_uses_consumed_doc(service, firestore_client):
    # admin_force_book(consume_quota=True) records consumed id;
    # admin_force_cancel(refund_quota=True) increments that doc back
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    doc_id = await _seed_active_quota(firestore_client, uid="u1", granted=4, used=0)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=True, consume_trial=False
    )
    assert booking.consumed_quota_doc_id == doc_id
    after_book = (
        await firestore_client.collection("monthly_quota").document(doc_id).get()
    )
    assert after_book.to_dict()["used"] == 1
    await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=True, refund_trial=False
    )
    after_cancel = (
        await firestore_client.collection("monthly_quota").document(doc_id).get()
    )
    assert after_cancel.to_dict()["used"] == 0
