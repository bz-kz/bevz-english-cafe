"""LessonSlotRepository interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from app.domain.entities.lesson_slot import LessonSlot


class LessonSlotRepository(ABC):
    @abstractmethod
    async def save(self, slot: LessonSlot) -> LessonSlot:
        ...

    @abstractmethod
    async def find_by_id(self, slot_id: UUID) -> LessonSlot | None:
        ...

    @abstractmethod
    async def find_open_future(
        self, *, limit: int = 50, offset: int = 0
    ) -> list[LessonSlot]:
        ...

    @abstractmethod
    async def find_in_range(
        self,
        *,
        from_: datetime,
        to_: datetime,
    ) -> list[LessonSlot]:
        """Return slots with start_at in [from_, to_), excluding cancelled."""

    @abstractmethod
    async def delete(self, slot_id: UUID) -> bool:
        ...
