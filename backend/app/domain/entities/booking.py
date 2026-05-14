"""Booking domain entity."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.enums.lesson_booking import BookingStatus


@dataclass
class Booking:
    id: UUID
    slot_id: str
    user_id: str
    status: BookingStatus
    created_at: datetime
    cancelled_at: datetime | None

    def __post_init__(self) -> None:
        if not self.slot_id:
            raise ValueError("slot_id is required")
        if not self.user_id:
            raise ValueError("user_id is required")
