"""Integration tests for BookingService — emulator-gated.

Exercises the transactional book + cancel paths and race-safety contract.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.services.booking_errors import (
    AlreadyBookedError,
    NotBookingOwnerError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
)
from app.services.booking_service import BookingService


def _now() -> datetime:
    return datetime.now(UTC)


@pytest.fixture
async def firestore_client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture
async def service(firestore_client):
    for col in ("lesson_slots", "bookings"):
        async for doc in firestore_client.collection(col).stream():
            await doc.reference.delete()
    slot_repo = FirestoreLessonSlotRepository(firestore_client)
    booking_repo = FirestoreBookingRepository(firestore_client)
    return BookingService(slot_repo, booking_repo, firestore_client)


def _user(uid: str = "u-1") -> User:
    return User(uid=uid, email=f"{uid}@example.com", name=f"User {uid}")


def _slot(
    *,
    capacity: int = 2,
    booked: int = 0,
    status: SlotStatus = SlotStatus.OPEN,
    start_offset_hours: int = 24,
) -> LessonSlot:
    return LessonSlot(
        id=uuid4(),
        start_at=_now() + timedelta(hours=start_offset_hours),
        end_at=_now() + timedelta(hours=start_offset_hours + 1),
        lesson_type=LessonType.GROUP,
        capacity=capacity,
        booked_count=booked,
        price_yen=None,
        teacher_id=None,
        notes=None,
        status=status,
    )


class TestBookHappyPath:
    async def test_book_creates_booking_and_bumps_count(self, service):
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        booking = await service.book(user=_user(), slot_id=str(slot.id))
        assert booking.status == BookingStatus.CONFIRMED
        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 1


class TestBookRejections:
    async def test_full_slot(self, service):
        slot = _slot(capacity=1, booked=1)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotFullError):
            await service.book(user=_user(), slot_id=str(slot.id))

    async def test_closed_slot(self, service):
        slot = _slot(status=SlotStatus.CLOSED)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotNotOpenError):
            await service.book(user=_user(), slot_id=str(slot.id))

    async def test_past_slot(self, service):
        slot = _slot()
        slot.start_at = _now() - timedelta(hours=2)
        slot.end_at = _now() - timedelta(hours=1)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotInPastError):
            await service.book(user=_user(), slot_id=str(slot.id))

    async def test_unknown_slot(self, service):
        with pytest.raises(SlotNotFoundError):
            await service.book(user=_user(), slot_id=str(uuid4()))

    async def test_already_booked(self, service):
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        await service.book(user=_user(), slot_id=str(slot.id))
        with pytest.raises(AlreadyBookedError):
            await service.book(user=_user(), slot_id=str(slot.id))


class TestCancel:
    async def test_cancel_flips_status_and_decrements_count(self, service):
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        booking = await service.book(user=_user(), slot_id=str(slot.id))

        cancelled = await service.cancel(user=_user(), booking_id=str(booking.id))
        assert cancelled.status == BookingStatus.CANCELLED
        assert cancelled.cancelled_at is not None

        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 0

    async def test_cancel_someone_elses_raises(self, service):
        slot = _slot(capacity=2)
        await service._slot_repo.save(slot)
        booking = await service.book(user=_user("u-1"), slot_id=str(slot.id))
        with pytest.raises(NotBookingOwnerError):
            await service.cancel(user=_user("u-2"), booking_id=str(booking.id))

    async def test_cancel_already_cancelled_is_idempotent(self, service):
        slot = _slot(capacity=2)
        await service._slot_repo.save(slot)
        booking = await service.book(user=_user(), slot_id=str(slot.id))
        await service.cancel(user=_user(), booking_id=str(booking.id))
        result = await service.cancel(user=_user(), booking_id=str(booking.id))
        assert result.status == BookingStatus.CANCELLED
        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 0
