"""BookingRepository interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.booking import Booking


class BookingRepository(ABC):
    @abstractmethod
    async def save(self, booking: Booking) -> Booking:
        ...

    @abstractmethod
    async def find_by_id(self, booking_id: UUID) -> Booking | None:
        ...

    @abstractmethod
    async def find_by_user(self, user_id: str) -> list[Booking]:
        ...

    @abstractmethod
    async def find_by_slot(self, slot_id: str) -> list[Booking]:
        ...
