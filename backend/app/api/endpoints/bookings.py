"""/api/v1/bookings — customer booking + cancel + history."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.repositories import (
    get_booking_service,
    get_lesson_slot_repository,
)
from app.api.schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingWithSlotResponse,
)
from app.api.schemas.lesson_slot import LessonSlotPublicResponse
from app.domain.entities.booking import Booking
from app.domain.entities.lesson_slot import LessonSlot
from app.domain.entities.user import User
from app.domain.repositories.lesson_slot_repository import LessonSlotRepository
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    NotBookingOwnerError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
)
from app.services.booking_service import BookingService

router = APIRouter(prefix="/api/v1", tags=["bookings"])


def _booking_response(b: Booking) -> BookingResponse:
    return BookingResponse(
        id=str(b.id),
        slot_id=b.slot_id,
        user_id=b.user_id,
        status=b.status.value,
        created_at=b.created_at,
        cancelled_at=b.cancelled_at,
    )


def _slot_public(slot: LessonSlot) -> LessonSlotPublicResponse:
    return LessonSlotPublicResponse(
        id=str(slot.id),
        start_at=slot.start_at,
        end_at=slot.end_at,
        lesson_type=slot.lesson_type.value,  # type: ignore[arg-type]
        capacity=slot.capacity,
        booked_count=slot.booked_count,
        remaining=slot.remaining,
        price_yen=slot.price_yen,
        status=slot.status.value,
    )


@router.post(
    "/bookings",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    payload: BookingCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    try:
        booking = await service.book(user=user, slot_id=payload.slot_id)
    except SlotNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found") from exc
    except (SlotNotOpenError, SlotInPastError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except (SlotFullError, AlreadyBookedError) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return _booking_response(booking)


@router.get(
    "/users/me/bookings",
    response_model=list[BookingWithSlotResponse],
)
async def list_my_bookings(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
    slot_repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
) -> list[BookingWithSlotResponse]:
    bookings = await service.find_user_bookings(user=user)
    results: list[BookingWithSlotResponse] = []
    for b in bookings:
        slot = await slot_repo.find_by_id(UUID(b.slot_id))
        if slot is None:
            continue
        results.append(
            BookingWithSlotResponse(
                id=str(b.id),
                status=b.status.value,
                created_at=b.created_at,
                cancelled_at=b.cancelled_at,
                slot=_slot_public(slot),
            )
        )
    return results


@router.patch(
    "/bookings/{booking_id}/cancel",
    response_model=BookingResponse,
)
async def cancel_booking(
    booking_id: str,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    try:
        booking = await service.cancel(user=user, booking_id=booking_id)
    except BookingNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found") from exc
    except NotBookingOwnerError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You can only cancel your own bookings",
        ) from exc
    return _booking_response(booking)
