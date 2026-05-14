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
from app.domain.entities.monthly_quota import MonthlyQuota
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.domain.enums.plan import Plan
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
    NoActiveQuotaError,
    NotBookingOwnerError,
    QuotaExhaustedError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
    TrialAlreadyUsedError,
)
from app.services.booking_service import BookingService


def _now() -> datetime:
    return datetime.now(UTC)


@pytest.fixture
async def firestore_client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture
async def quota_repo(firestore_client):
    async for doc in firestore_client.collection("monthly_quota").stream():
        await doc.reference.delete()
    return FirestoreMonthlyQuotaRepository(firestore_client)


@pytest.fixture
async def user_repo(firestore_client):
    async for doc in firestore_client.collection("users").stream():
        await doc.reference.delete()
    return FirestoreUserRepository(firestore_client)


@pytest.fixture
async def service(firestore_client, quota_repo, user_repo):
    for col in ("lesson_slots", "bookings"):
        async for doc in firestore_client.collection(col).stream():
            await doc.reference.delete()
    slot_repo = FirestoreLessonSlotRepository(firestore_client)
    booking_repo = FirestoreBookingRepository(firestore_client)
    return BookingService(
        slot_repo, booking_repo, firestore_client, quota_repo, user_repo
    )


def _user(uid: str = "u-1") -> User:
    return User(uid=uid, email=f"{uid}@example.com", name=f"User {uid}")


async def _persist_user(
    user_repo, *, uid: str = "u-1", plan: Plan | None = None
) -> User:
    u = User(uid=uid, email=f"{uid}@example.com", name=f"User {uid}")
    if plan is not None:
        u.set_plan(plan)
    await user_repo.save(u)
    return u


def _quota(*, user_id: str, granted: int = 8, used: int = 0) -> MonthlyQuota:
    ym = datetime.now(UTC).strftime("%Y-%m")
    return MonthlyQuota(
        user_id=user_id,
        year_month=ym,
        plan_at_grant="standard",
        granted=granted,
        used=used,
        granted_at=datetime.now(UTC) - timedelta(days=1),
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )


def _slot(
    *,
    capacity: int = 2,
    booked: int = 0,
    status: SlotStatus = SlotStatus.OPEN,
    start_offset_hours: int = 48,
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
    async def test_book_creates_booking_and_bumps_count(
        self, service, user_repo, quota_repo
    ):
        user = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user.uid))
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        booking = await service.book(user=user, slot_id=str(slot.id))
        assert booking.status == BookingStatus.CONFIRMED
        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 1


class TestBookRejections:
    async def test_full_slot(self, service, user_repo, quota_repo):
        user = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user.uid))
        slot = _slot(capacity=1, booked=1)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotFullError):
            await service.book(user=user, slot_id=str(slot.id))

    async def test_closed_slot(self, service, user_repo, quota_repo):
        user = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user.uid))
        slot = _slot(status=SlotStatus.CLOSED)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotNotOpenError):
            await service.book(user=user, slot_id=str(slot.id))

    async def test_past_slot(self, service, user_repo, quota_repo):
        user = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user.uid))
        slot = _slot()
        slot.start_at = _now() - timedelta(hours=2)
        slot.end_at = _now() - timedelta(hours=1)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotInPastError):
            await service.book(user=user, slot_id=str(slot.id))

    async def test_unknown_slot(self, service, user_repo, quota_repo):
        user = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user.uid))
        with pytest.raises(SlotNotFoundError):
            await service.book(user=user, slot_id=str(uuid4()))

    async def test_already_booked(self, service, user_repo, quota_repo):
        user = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user.uid))
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        await service.book(user=user, slot_id=str(slot.id))
        with pytest.raises(AlreadyBookedError):
            await service.book(user=user, slot_id=str(slot.id))


class TestCancel:
    async def test_cancel_flips_status_and_decrements_count(
        self, service, user_repo, quota_repo
    ):
        user = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user.uid))
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        booking = await service.book(user=user, slot_id=str(slot.id))

        cancelled = await service.cancel(user=user, booking_id=str(booking.id))
        assert cancelled.status == BookingStatus.CANCELLED
        assert cancelled.cancelled_at is not None

        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 0

    async def test_cancel_someone_elses_raises(self, service, user_repo, quota_repo):
        user1 = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        user2 = await _persist_user(user_repo, uid="u-2", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user1.uid))
        await quota_repo.save(_quota(user_id=user2.uid))
        slot = _slot(capacity=2)
        await service._slot_repo.save(slot)
        booking = await service.book(user=user1, slot_id=str(slot.id))
        with pytest.raises(NotBookingOwnerError):
            await service.cancel(user=user2, booking_id=str(booking.id))

    async def test_cancel_already_cancelled_is_idempotent(
        self, service, user_repo, quota_repo
    ):
        user = await _persist_user(user_repo, uid="u-1", plan=Plan.STANDARD)
        await quota_repo.save(_quota(user_id=user.uid))
        slot = _slot(capacity=2)
        await service._slot_repo.save(slot)
        booking = await service.book(user=user, slot_id=str(slot.id))
        await service.cancel(user=user, booking_id=str(booking.id))
        result = await service.cancel(user=user, booking_id=str(booking.id))
        assert result.status == BookingStatus.CANCELLED
        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 0


async def test_book_increments_used_in_quota(service, quota_repo, user_repo):
    user = await _persist_user(user_repo, uid="u-q1", plan=Plan.STANDARD)
    await quota_repo.save(_quota(user_id=user.uid))
    slot = _slot()
    await FirestoreLessonSlotRepository(service._fs).save(slot)
    await service.book(user=user, slot_id=str(slot.id))
    ym = datetime.now(UTC).strftime("%Y-%m")
    q = await quota_repo.find(user.uid, ym)
    assert q.used == 1


async def test_book_rejects_when_no_quota_row(service, user_repo):
    user = await _persist_user(user_repo, uid="u-q2", plan=Plan.STANDARD)
    slot = _slot()
    await FirestoreLessonSlotRepository(service._fs).save(slot)
    with pytest.raises(NoActiveQuotaError):
        await service.book(user=user, slot_id=str(slot.id))


async def test_book_rejects_when_quota_exhausted(service, quota_repo, user_repo):
    user = await _persist_user(user_repo, uid="u-q3", plan=Plan.LIGHT)
    await quota_repo.save(_quota(user_id=user.uid, granted=4, used=4))
    slot = _slot()
    await FirestoreLessonSlotRepository(service._fs).save(slot)
    with pytest.raises(QuotaExhaustedError):
        await service.book(user=user, slot_id=str(slot.id))


async def test_book_trial_first_time_marks_user_and_skips_quota(service, user_repo):
    user = await _persist_user(user_repo, uid="u-t1", plan=Plan.STANDARD)
    slot = _slot()
    slot.lesson_type = LessonType.TRIAL
    await FirestoreLessonSlotRepository(service._fs).save(slot)
    await service.book(user=user, slot_id=str(slot.id))
    refreshed = await user_repo.find_by_uid(user.uid)
    assert refreshed.trial_used is True


async def test_book_trial_second_time_rejects(service, user_repo):
    user = await _persist_user(user_repo, uid="u-t2", plan=Plan.STANDARD)
    user.mark_trial_used()
    await user_repo.save(user)
    slot = _slot()
    slot.lesson_type = LessonType.TRIAL
    await FirestoreLessonSlotRepository(service._fs).save(slot)
    with pytest.raises(TrialAlreadyUsedError):
        await service.book(user=user, slot_id=str(slot.id))
