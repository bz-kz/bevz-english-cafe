"""BookingService — orchestrates capacity-safe booking + cancellation."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

from google.cloud import firestore as fs

from app.domain.entities.booking import Booking
from app.domain.entities.user import User
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    NotBookingOwnerError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
)


def _utc_now() -> datetime:
    return datetime.now(UTC)


class BookingService:
    """Encapsulates the transactional book + cancel flows.

    Firestore async transactions retry on contention, so a near-full slot
    being hit concurrently can never oversell.
    """

    def __init__(
        self,
        slot_repo: FirestoreLessonSlotRepository,
        booking_repo: FirestoreBookingRepository,
        firestore_client: fs.AsyncClient,
    ) -> None:
        self._slot_repo = slot_repo
        self._booking_repo = booking_repo
        self._fs = firestore_client

    async def book(self, *, user: User, slot_id: str) -> Booking:
        slot_ref = self._fs.collection("lesson_slots").document(slot_id)
        bookings_col = self._fs.collection("bookings")
        new_booking_id = uuid4()

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            slot_snap = await slot_ref.get(transaction=tx)
            if not slot_snap.exists:
                raise SlotNotFoundError(slot_id)
            slot = self._slot_repo._from_dict(slot_snap.to_dict(), slot_id)

            if slot.status != SlotStatus.OPEN:
                raise SlotNotOpenError(slot_id)
            if slot.start_at <= _utc_now():
                raise SlotInPastError(slot_id)
            if slot.is_full:
                raise SlotFullError(slot_id)

            # Anti double-book within the transaction.
            existing_query = (
                bookings_col.where("user_id", "==", user.uid)
                .where("slot_id", "==", slot_id)
                .where("status", "==", BookingStatus.CONFIRMED.value)
                .limit(1)
            )
            async for _doc in existing_query.stream(transaction=tx):
                raise AlreadyBookedError(slot_id)

            booking = Booking(
                id=new_booking_id,
                slot_id=slot_id,
                user_id=user.uid,
                status=BookingStatus.CONFIRMED,
                created_at=_utc_now(),
                cancelled_at=None,
            )
            tx.update(
                slot_ref,
                {
                    "booked_count": slot.booked_count + 1,
                    "updated_at": _utc_now(),
                },
            )
            tx.set(
                bookings_col.document(str(booking.id)),
                self._booking_repo._to_dict(booking),
            )
            return booking

        return cast(Booking, await txn(self._fs.transaction()))

    async def cancel(self, *, user: User, booking_id: str) -> Booking:
        booking_ref = self._fs.collection("bookings").document(booking_id)
        slots_col = self._fs.collection("lesson_slots")

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            booking_snap = await booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise BookingNotFoundError(booking_id)
            booking = self._booking_repo._from_dict(booking_snap.to_dict(), booking_id)

            if booking.user_id != user.uid:
                raise NotBookingOwnerError(booking_id)

            # Idempotent: already cancelled → return as-is, no decrement.
            if booking.status == BookingStatus.CANCELLED:
                return booking

            slot_ref = slots_col.document(booking.slot_id)
            slot_snap = await slot_ref.get(transaction=tx)
            if slot_snap.exists:
                slot_data = cast(dict[str, Any], slot_snap.to_dict())
                current = int(slot_data["booked_count"])
                tx.update(
                    slot_ref,
                    {
                        "booked_count": max(0, current - 1),
                        "updated_at": _utc_now(),
                    },
                )

            now = _utc_now()
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = now
            tx.update(
                booking_ref,
                {
                    "status": BookingStatus.CANCELLED.value,
                    "cancelled_at": now,
                },
            )
            return booking

        return cast(Booking, await txn(self._fs.transaction()))

    async def find_user_bookings(self, *, user: User) -> list[Booking]:
        return await self._booking_repo.find_by_user(user.uid)
