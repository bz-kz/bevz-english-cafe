"""Tests for /api/v1/users/me/bookings range query."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from fastapi import FastAPI  # noqa: E402
from google.cloud import firestore as fs  # noqa: E402

from app.api.dependencies.auth import get_current_user  # noqa: E402
from app.api.dependencies.repositories import (  # noqa: E402
    get_booking_service,
    get_lesson_slot_repository,
)
from app.domain.entities.booking import Booking  # noqa: E402
from app.domain.entities.lesson_slot import LessonSlot  # noqa: E402
from app.domain.entities.user import User  # noqa: E402
from app.domain.enums.contact import LessonType  # noqa: E402
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus  # noqa: E402
from app.domain.repositories.lesson_slot_repository import (  # noqa: E402
    LessonSlotRepository,
)
from app.infrastructure.repositories.firestore_booking_repository import (  # noqa: E402
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (  # noqa: E402
    FirestoreLessonSlotRepository,
)
from app.services.booking_service import BookingService  # noqa: E402


@pytest.fixture
async def authed_user(app: FastAPI) -> AsyncIterator[User]:
    """A logged-in test user; overrides get_current_user."""
    user = User(uid="test-uid-1", email="test@example.com", name="Test User")

    async def _override() -> User:
        return user

    app.dependency_overrides[get_current_user] = _override
    try:
        yield user
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def slot_factory(
    app: FastAPI,
) -> AsyncIterator[Callable[..., Awaitable[LessonSlot]]]:
    """Persist LessonSlot via the emulator and bind the repo to the test app."""
    client = fs.AsyncClient(project="test-project")
    slot_repo = FirestoreLessonSlotRepository(client)
    booking_repo = FirestoreBookingRepository(client)
    for col in ("lesson_slots", "bookings"):
        async for doc in client.collection(col).stream():
            await doc.reference.delete()

    def _override_slot_repo() -> LessonSlotRepository:
        return slot_repo

    def _override_booking_service() -> BookingService:
        return BookingService(slot_repo, booking_repo, client)

    app.dependency_overrides[get_lesson_slot_repository] = _override_slot_repo
    app.dependency_overrides[get_booking_service] = _override_booking_service

    async def _make(
        *,
        start_at: datetime,
        end_at: datetime | None = None,
        lesson_type: LessonType = LessonType.PRIVATE,
        capacity: int = 1,
        booked_count: int = 0,
        status: SlotStatus = SlotStatus.OPEN,
    ) -> LessonSlot:
        slot = LessonSlot(
            id=uuid4(),
            start_at=start_at,
            end_at=end_at if end_at is not None else start_at + timedelta(minutes=30),
            lesson_type=lesson_type,
            capacity=capacity,
            booked_count=booked_count,
            price_yen=None,
            teacher_id=None,
            notes=None,
            status=status,
        )
        await slot_repo.save(slot)
        return slot

    try:
        yield _make
    finally:
        app.dependency_overrides.pop(get_lesson_slot_repository, None)
        app.dependency_overrides.pop(get_booking_service, None)


@pytest.fixture
async def booking_factory() -> Callable[..., Awaitable[Booking]]:
    """Persist a confirmed Booking directly via the booking repository."""
    client = fs.AsyncClient(project="test-project")
    booking_repo = FirestoreBookingRepository(client)

    async def _make(*, slot: LessonSlot, user: User) -> Booking:
        booking = Booking(
            id=uuid4(),
            slot_id=str(slot.id),
            user_id=user.uid,
            status=BookingStatus.CONFIRMED,
            created_at=datetime.now(UTC),
            cancelled_at=None,
        )
        await booking_repo.save(booking)
        return booking

    return _make


async def test_list_my_bookings_filters_by_slot_start_in_range(
    client,
    authed_user,
    slot_factory,
    booking_factory,
) -> None:
    base = datetime(2026, 7, 1, 9, 0, tzinfo=UTC)
    in_range_slot = await slot_factory(start_at=base + timedelta(hours=1))
    out_slot = await slot_factory(start_at=base + timedelta(days=30))
    in_b = await booking_factory(slot=in_range_slot, user=authed_user)
    out_b = await booking_factory(slot=out_slot, user=authed_user)

    resp = await client.get(
        "/api/v1/users/me/bookings",
        params={
            "from": base.isoformat(),
            "to": (base + timedelta(days=1)).isoformat(),
        },
    )
    assert resp.status_code == 200
    ids = {b["id"] for b in resp.json()}
    assert str(in_b.id) in ids
    assert str(out_b.id) not in ids
