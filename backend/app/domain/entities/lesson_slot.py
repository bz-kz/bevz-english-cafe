"""LessonSlot domain entity — admin-managed time slot for a lesson."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID

from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class LessonSlot:
    id: UUID
    start_at: datetime
    end_at: datetime
    lesson_type: LessonType
    capacity: int
    booked_count: int
    price_yen: int | None
    teacher_id: str | None
    notes: str | None
    status: SlotStatus
    created_at: datetime = field(default_factory=_utc_now)
    updated_at: datetime = field(default_factory=_utc_now)

    def __post_init__(self) -> None:
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        if self.capacity < 1:
            raise ValueError("capacity must be >= 1")
        if not 0 <= self.booked_count <= self.capacity:
            raise ValueError(
                f"booked_count {self.booked_count} out of range [0, {self.capacity}]"
            )

    @property
    def is_full(self) -> bool:
        return self.booked_count >= self.capacity

    @property
    def remaining(self) -> int:
        return self.capacity - self.booked_count
