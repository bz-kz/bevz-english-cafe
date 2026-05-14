"""Pydantic schemas for the booking API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.api.schemas.lesson_slot import LessonSlotPublicResponse


class BookingCreate(BaseModel):
    slot_id: str


class BookingResponse(BaseModel):
    id: str
    slot_id: str
    user_id: str
    status: str
    created_at: datetime
    cancelled_at: datetime | None


class BookingWithSlotResponse(BaseModel):
    """For GET /api/v1/users/me/bookings — slot info joined."""

    id: str
    status: str
    created_at: datetime
    cancelled_at: datetime | None
    slot: LessonSlotPublicResponse


class BookingAdminResponse(BookingResponse):
    """Admin view — reserved for future fields."""

