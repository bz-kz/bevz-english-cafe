"""Unit tests for the LessonSlot entity."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus


def _now() -> datetime:
    return datetime.now(UTC)


class TestConstruction:
    def test_minimal_slot(self):
        slot = LessonSlot(
            id=uuid4(),
            start_at=_now() + timedelta(days=1),
            end_at=_now() + timedelta(days=1, hours=1),
            lesson_type=LessonType.GROUP,
            capacity=4,
            booked_count=0,
            price_yen=2000,
            teacher_id=None,
            notes=None,
            status=SlotStatus.OPEN,
        )
        assert slot.capacity == 4
        assert slot.is_full is False
        assert slot.remaining == 4

    def test_rejects_end_before_start(self):
        with pytest.raises(ValueError, match="end_at"):
            LessonSlot(
                id=uuid4(),
                start_at=_now() + timedelta(days=2),
                end_at=_now() + timedelta(days=1),
                lesson_type=LessonType.GROUP,
                capacity=1,
                booked_count=0,
                price_yen=None,
                teacher_id=None,
                notes=None,
                status=SlotStatus.OPEN,
            )

    def test_rejects_zero_capacity(self):
        with pytest.raises(ValueError, match="capacity"):
            LessonSlot(
                id=uuid4(),
                start_at=_now() + timedelta(days=1),
                end_at=_now() + timedelta(days=1, hours=1),
                lesson_type=LessonType.GROUP,
                capacity=0,
                booked_count=0,
                price_yen=None,
                teacher_id=None,
                notes=None,
                status=SlotStatus.OPEN,
            )

    def test_rejects_booked_over_capacity(self):
        with pytest.raises(ValueError, match="booked_count"):
            LessonSlot(
                id=uuid4(),
                start_at=_now() + timedelta(days=1),
                end_at=_now() + timedelta(days=1, hours=1),
                lesson_type=LessonType.GROUP,
                capacity=2,
                booked_count=3,
                price_yen=None,
                teacher_id=None,
                notes=None,
                status=SlotStatus.OPEN,
            )


class TestProperties:
    def _slot(self, capacity: int, booked: int) -> LessonSlot:
        return LessonSlot(
            id=uuid4(),
            start_at=_now() + timedelta(days=1),
            end_at=_now() + timedelta(days=1, hours=1),
            lesson_type=LessonType.GROUP,
            capacity=capacity,
            booked_count=booked,
            price_yen=None,
            teacher_id=None,
            notes=None,
            status=SlotStatus.OPEN,
        )

    def test_is_full_when_at_capacity(self):
        assert self._slot(4, 4).is_full is True

    def test_remaining(self):
        assert self._slot(4, 1).remaining == 3
