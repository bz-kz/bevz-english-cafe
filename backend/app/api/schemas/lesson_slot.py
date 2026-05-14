"""Pydantic schemas for the lesson_slot API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

LessonTypeStr = Literal[
    "trial", "group", "private", "business", "toeic", "online", "other"
]


class LessonSlotCreate(BaseModel):
    start_at: datetime
    end_at: datetime
    lesson_type: LessonTypeStr
    capacity: int = Field(ge=1)
    price_yen: int | None = None
    teacher_id: str | None = None
    notes: str | None = None


class LessonSlotUpdate(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    lesson_type: LessonTypeStr | None = None
    capacity: int | None = Field(default=None, ge=1)
    price_yen: int | None = None
    teacher_id: str | None = None
    notes: str | None = None
    status: Literal["open", "closed", "cancelled"] | None = None


class LessonSlotPublicResponse(BaseModel):
    """Customer-facing — teacher_id and notes are hidden."""

    id: str
    start_at: datetime
    end_at: datetime
    lesson_type: LessonTypeStr
    capacity: int
    booked_count: int
    remaining: int
    price_yen: int | None
    status: str


class LessonSlotAdminResponse(BaseModel):
    """Admin-facing — all fields."""

    id: str
    start_at: datetime
    end_at: datetime
    lesson_type: LessonTypeStr
    capacity: int
    booked_count: int
    remaining: int
    price_yen: int | None
    teacher_id: str | None
    notes: str | None
    status: str
    created_at: datetime
    updated_at: datetime
