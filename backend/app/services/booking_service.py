"""BookingService — capacity-safe + quota-aware book and cancel."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import uuid4
from zoneinfo import ZoneInfo

from google.cloud import firestore as fs

from app.domain.entities.booking import Booking
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    CancelDeadlinePassedError,
    NoActiveQuotaError,
    NotBookingOwnerError,
    QuotaExhaustedError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
    TrialAlreadyUsedError,
    UserNotFoundError,
)

JST = ZoneInfo("Asia/Tokyo")
CANCEL_DEADLINE = timedelta(hours=24)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _jst_year_month(dt: datetime) -> str:
    return dt.astimezone(JST).strftime("%Y-%m")


class BookingService:
    """capacity-safe book + cancel に加え、trial / monthly quota / 24h ルールを担う。

    Firestore async transaction が contention 時に retry するため、
    同時刻に最終枠を取り合っても oversell しない契約。
    """

    def __init__(
        self,
        slot_repo: FirestoreLessonSlotRepository,
        booking_repo: FirestoreBookingRepository,
        firestore_client: fs.AsyncClient,
        monthly_quota_repo: FirestoreMonthlyQuotaRepository,
        user_repo: FirestoreUserRepository,
    ) -> None:
        self._slot_repo = slot_repo
        self._booking_repo = booking_repo
        self._fs = firestore_client
        self._monthly_quota_repo = monthly_quota_repo
        self._user_repo = user_repo

    async def book(self, *, user: User, slot_id: str) -> Booking:
        slot_ref = self._fs.collection("lesson_slots").document(slot_id)
        bookings_col = self._fs.collection("bookings")
        users_col = self._fs.collection("users")
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

            user_ref = users_col.document(user.uid)
            user_snap = await user_ref.get(transaction=tx)
            if not user_snap.exists:
                raise NoActiveQuotaError(f"User {user.uid} not initialized")
            user_data = cast(dict[str, Any], user_snap.to_dict())

            if slot.lesson_type == LessonType.TRIAL:
                if user_data.get("trial_used", False):
                    raise TrialAlreadyUsedError(user.uid)
                tx.update(user_ref, {"trial_used": True, "updated_at": _utc_now()})
            else:
                year_month = _jst_year_month(_utc_now())
                quota_ref = self._fs.collection("monthly_quota").document(
                    f"{user.uid}_{year_month}"
                )
                quota_snap = await quota_ref.get(transaction=tx)
                if not quota_snap.exists:
                    raise NoActiveQuotaError(year_month)
                quota_data = cast(dict[str, Any], quota_snap.to_dict())
                granted = int(quota_data["granted"])
                used = int(quota_data["used"])
                if used >= granted:
                    raise QuotaExhaustedError(year_month)
                tx.update(quota_ref, {"used": used + 1})

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

    async def admin_force_book(
        self,
        *,
        slot_id: str,
        user_id: str,
        consume_quota: bool,
        consume_trial: bool,
    ) -> Booking:
        """Admin による強制予約。24h/quota/trial/closed/past を bypass する。

        capacity と重複(AlreadyBooked)だけは整合性のため守る。
        """
        slot_ref = self._fs.collection("lesson_slots").document(slot_id)
        bookings_col = self._fs.collection("bookings")
        users_col = self._fs.collection("users")
        new_booking_id = uuid4()

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            slot_snap = await slot_ref.get(transaction=tx)
            if not slot_snap.exists:
                raise SlotNotFoundError(slot_id)
            slot = self._slot_repo._from_dict(slot_snap.to_dict(), slot_id)

            if slot.is_full:
                raise SlotFullError(slot_id)

            existing_query = (
                bookings_col.where("user_id", "==", user_id)
                .where("slot_id", "==", slot_id)
                .where("status", "==", BookingStatus.CONFIRMED.value)
                .limit(1)
            )
            async for _doc in existing_query.stream(transaction=tx):
                raise AlreadyBookedError(slot_id)

            user_ref = users_col.document(user_id)
            user_snap = await user_ref.get(transaction=tx)
            if not user_snap.exists:
                raise UserNotFoundError(user_id)

            quota_ref = None
            quota_used: int | None = None
            if consume_quota and slot.lesson_type != LessonType.TRIAL:
                ym = _jst_year_month(_utc_now())
                quota_ref = self._fs.collection("monthly_quota").document(
                    f"{user_id}_{ym}"
                )
                q_snap = await quota_ref.get(transaction=tx)
                if q_snap.exists:
                    quota_used = int(cast(dict[str, Any], q_snap.to_dict())["used"])

            booking = Booking(
                id=new_booking_id,
                slot_id=slot_id,
                user_id=user_id,
                status=BookingStatus.CONFIRMED,
                created_at=_utc_now(),
                cancelled_at=None,
            )
            tx.update(
                slot_ref,
                {"booked_count": slot.booked_count + 1, "updated_at": _utc_now()},
            )
            tx.set(
                bookings_col.document(str(booking.id)),
                self._booking_repo._to_dict(booking),
            )
            if consume_trial and slot.lesson_type == LessonType.TRIAL:
                tx.update(user_ref, {"trial_used": True, "updated_at": _utc_now()})
            if quota_ref is not None and quota_used is not None:
                tx.update(quota_ref, {"used": quota_used + 1})
            return booking

        return cast(Booking, await txn(self._fs.transaction()))

    async def admin_force_cancel(
        self,
        *,
        booking_id: str,
        refund_quota: bool,
        refund_trial: bool,
    ) -> Booking:
        """Admin による強制キャンセル。24h ルール bypass。"""
        booking_ref = self._fs.collection("bookings").document(booking_id)
        slots_col = self._fs.collection("lesson_slots")
        quota_col = self._fs.collection("monthly_quota")
        users_col = self._fs.collection("users")

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            booking_snap = await booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise BookingNotFoundError(booking_id)
            booking = self._booking_repo._from_dict(booking_snap.to_dict(), booking_id)

            if booking.status == BookingStatus.CANCELLED:
                return booking

            slot_ref = slots_col.document(booking.slot_id)
            slot_snap = await slot_ref.get(transaction=tx)
            slot_data = slot_snap.to_dict() or {}
            lesson_type_str = slot_data.get("lesson_type", "")
            is_trial = lesson_type_str == LessonType.TRIAL.value

            quota_ref = None
            current_used: int | None = None
            if refund_quota and not is_trial:
                ym = _jst_year_month(booking.created_at)
                quota_ref = quota_col.document(f"{booking.user_id}_{ym}")
                q_snap = await quota_ref.get(transaction=tx)
                if q_snap.exists:
                    current_used = int(cast(dict[str, Any], q_snap.to_dict())["used"])

            user_ref = None
            if refund_trial and is_trial:
                user_ref = users_col.document(booking.user_id)
                # 読みは不要(上書き)だが transaction の read-before-write 規約のため空 read
                await user_ref.get(transaction=tx)

            # ---- write phase ----
            if slot_snap.exists:
                current = int(slot_data["booked_count"])
                tx.update(
                    slot_ref,
                    {"booked_count": max(0, current - 1), "updated_at": _utc_now()},
                )
            if quota_ref is not None and current_used is not None:
                tx.update(quota_ref, {"used": max(0, current_used - 1)})
            if user_ref is not None:
                tx.update(user_ref, {"trial_used": False, "updated_at": _utc_now()})

            now = _utc_now()
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = now
            tx.update(
                booking_ref,
                {"status": BookingStatus.CANCELLED.value, "cancelled_at": now},
            )
            return booking

        return cast(Booking, await txn(self._fs.transaction()))

    async def cancel(self, *, user: User, booking_id: str) -> Booking:
        booking_ref = self._fs.collection("bookings").document(booking_id)
        slots_col = self._fs.collection("lesson_slots")
        quota_col = self._fs.collection("monthly_quota")

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            # Firestore transaction では全 read を write より前に行う必要がある。
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
            slot_data = slot_snap.to_dict() or {}
            slot_start = slot_data.get("start_at")
            lesson_type_str = slot_data.get("lesson_type", "")

            # 24h rule: refuse if booking is too close to start.
            if slot_start is not None and (slot_start - _utc_now()) < CANCEL_DEADLINE:
                raise CancelDeadlinePassedError(booking_id)

            # Refund quota: read first (still in read-phase) for non-trial bookings.
            quota_ref = None
            current_used: int | None = None
            if lesson_type_str != LessonType.TRIAL.value:
                ym = _jst_year_month(booking.created_at)
                quota_ref = quota_col.document(f"{user.uid}_{ym}")
                q_snap = await quota_ref.get(transaction=tx)
                if q_snap.exists:
                    q_data = cast(dict[str, Any], q_snap.to_dict())
                    current_used = int(q_data["used"])

            # ---- write phase ----
            if slot_snap.exists:
                current = int(slot_data["booked_count"])
                tx.update(
                    slot_ref,
                    {
                        "booked_count": max(0, current - 1),
                        "updated_at": _utc_now(),
                    },
                )

            if quota_ref is not None and current_used is not None:
                tx.update(quota_ref, {"used": max(0, current_used - 1)})

            now = _utc_now()
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = now
            tx.update(
                booking_ref,
                {"status": BookingStatus.CANCELLED.value, "cancelled_at": now},
            )
            return booking

        return cast(Booking, await txn(self._fs.transaction()))

    async def find_user_bookings(self, *, user: User) -> list[Booking]:
        return await self._booking_repo.find_by_user(user.uid)
