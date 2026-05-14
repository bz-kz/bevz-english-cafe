"""Integration tests for FirestoreLessonSlotRepository — emulator-gated."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)


def _now() -> datetime:
    return datetime.now(UTC)


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("lesson_slots").stream():
        await doc.reference.delete()
    return FirestoreLessonSlotRepository(client)


def _make_slot(
    *,
    start_offset_hours: int = 24,
    status: SlotStatus = SlotStatus.OPEN,
    capacity: int = 4,
    booked: int = 0,
) -> LessonSlot:
    return LessonSlot(
        id=uuid4(),
        start_at=_now() + timedelta(hours=start_offset_hours),
        end_at=_now() + timedelta(hours=start_offset_hours + 1),
        lesson_type=LessonType.GROUP,
        capacity=capacity,
        booked_count=booked,
        price_yen=2000,
        teacher_id=None,
        notes=None,
        status=status,
    )


class TestSave:
    async def test_save_returns_slot(self, repo):
        slot = _make_slot()
        result = await repo.save(slot)
        assert result.id == slot.id

    async def test_save_is_upsert(self, repo):
        slot = _make_slot(capacity=4)
        await repo.save(slot)
        slot.capacity = 8
        await repo.save(slot)
        fetched = await repo.find_by_id(slot.id)
        assert fetched is not None
        assert fetched.capacity == 8


class TestFindByID:
    async def test_hit(self, repo):
        slot = _make_slot()
        await repo.save(slot)
        fetched = await repo.find_by_id(slot.id)
        assert fetched is not None
        assert fetched.lesson_type == LessonType.GROUP

    async def test_miss(self, repo):
        assert await repo.find_by_id(uuid4()) is None


class TestFindOpenFuture:
    async def test_lists_only_open_future_slots(self, repo):
        await repo.save(_make_slot(start_offset_hours=24))
        past = _make_slot(start_offset_hours=24)
        past.start_at = _now() - timedelta(hours=2)
        past.end_at = _now() - timedelta(hours=1)
        await repo.save(past)
        await repo.save(_make_slot(status=SlotStatus.CLOSED))
        results = await repo.find_open_future(limit=10, offset=0)
        assert len(results) == 1
        assert results[0].status == SlotStatus.OPEN
        assert results[0].start_at > _now()
