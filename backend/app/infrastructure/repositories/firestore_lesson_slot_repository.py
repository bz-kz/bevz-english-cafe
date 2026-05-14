"""Firestore implementation of LessonSlotRepository."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus
from app.domain.repositories.lesson_slot_repository import LessonSlotRepository

_COLLECTION = "lesson_slots"


class FirestoreLessonSlotRepository(LessonSlotRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def save(self, slot: LessonSlot) -> LessonSlot:
        await self._collection.document(str(slot.id)).set(self._to_dict(slot))
        return slot

    async def find_by_id(self, slot_id: UUID) -> LessonSlot | None:
        doc = await self._collection.document(str(slot_id)).get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict(), doc.id)

    async def find_open_future(
        self, *, limit: int = 50, offset: int = 0
    ) -> list[LessonSlot]:
        now = datetime.now(UTC)
        query = (
            self._collection.where("status", "==", SlotStatus.OPEN.value)
            .where("start_at", ">", now)
            .order_by("start_at")
            .offset(offset)
            .limit(limit)
        )
        return [self._from_dict(doc.to_dict(), doc.id) async for doc in query.stream()]

    async def delete(self, slot_id: UUID) -> bool:
        doc_ref = self._collection.document(str(slot_id))
        doc = await doc_ref.get()
        if not doc.exists:
            return False
        await doc_ref.delete()
        return True

    @staticmethod
    def _to_dict(slot: LessonSlot) -> dict[str, Any]:
        return {
            "id": str(slot.id),
            "start_at": slot.start_at,
            "end_at": slot.end_at,
            "lesson_type": slot.lesson_type.value,
            "capacity": slot.capacity,
            "booked_count": slot.booked_count,
            "price_yen": slot.price_yen,
            "teacher_id": slot.teacher_id,
            "notes": slot.notes,
            "status": slot.status.value,
            "created_at": slot.created_at,
            "updated_at": slot.updated_at,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None, doc_id: str) -> LessonSlot:
        assert data is not None
        return LessonSlot(
            id=UUID(doc_id),
            start_at=data["start_at"],
            end_at=data["end_at"],
            lesson_type=LessonType(data["lesson_type"]),
            capacity=int(data["capacity"]),
            booked_count=int(data["booked_count"]),
            price_yen=data.get("price_yen"),
            teacher_id=data.get("teacher_id"),
            notes=data.get("notes"),
            status=SlotStatus(data["status"]),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )
