"""Firestore implementation of BookingRepository."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.domain.entities.booking import Booking
from app.domain.enums.lesson_booking import BookingStatus
from app.domain.repositories.booking_repository import BookingRepository

_COLLECTION = "bookings"


class FirestoreBookingRepository(BookingRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def save(self, booking: Booking) -> Booking:
        await self._collection.document(str(booking.id)).set(self._to_dict(booking))
        return booking

    async def find_by_id(self, booking_id: UUID) -> Booking | None:
        doc = await self._collection.document(str(booking_id)).get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict(), doc.id)

    async def find_by_user(self, user_id: str) -> list[Booking]:
        query = self._collection.where("user_id", "==", user_id).order_by(
            "created_at", direction=fs.Query.DESCENDING
        )
        return [self._from_dict(doc.to_dict(), doc.id) async for doc in query.stream()]

    async def find_by_slot(self, slot_id: str) -> list[Booking]:
        query = self._collection.where("slot_id", "==", slot_id)
        return [self._from_dict(doc.to_dict(), doc.id) async for doc in query.stream()]

    @staticmethod
    def _to_dict(booking: Booking) -> dict[str, Any]:
        return {
            "id": str(booking.id),
            "slot_id": booking.slot_id,
            "user_id": booking.user_id,
            "status": booking.status.value,
            "created_at": booking.created_at,
            "cancelled_at": booking.cancelled_at,
            "consumed_quota_doc_id": booking.consumed_quota_doc_id,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None, doc_id: str) -> Booking:
        assert data is not None
        return Booking(
            id=UUID(doc_id),
            slot_id=data["slot_id"],
            user_id=data["user_id"],
            status=BookingStatus(data["status"]),
            created_at=data["created_at"],
            cancelled_at=data.get("cancelled_at"),
            consumed_quota_doc_id=data.get("consumed_quota_doc_id"),
        )
