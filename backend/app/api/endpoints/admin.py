"""/api/v1/admin/* — admin-only force-book / force-cancel / user search."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies.auth import get_admin_user
from app.api.dependencies.repositories import (
    get_booking_service,
    get_user_repository,
)
from app.api.schemas.admin import (
    ForceBookRequest,
    ForceCancelRequest,
    UserSummaryResponse,
)
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    SlotFullError,
    SlotNotFoundError,
    UserNotFoundError,
)
from app.services.booking_service import BookingService

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.post(
    "/lesson-slots/{slot_id}/bookings",
    status_code=status.HTTP_201_CREATED,
)
async def force_book(
    slot_id: UUID,
    payload: ForceBookRequest,
    admin: Annotated[User, Depends(get_admin_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
) -> dict[str, Any]:
    try:
        booking = await service.admin_force_book(
            slot_id=str(slot_id),
            user_id=payload.user_id,
            consume_quota=payload.consume_quota,
            consume_trial=payload.consume_trial,
        )
    except SlotNotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": "slot_not_found"}) from e
    except SlotFullError as e:
        raise HTTPException(status_code=400, detail={"code": "slot_full"}) from e
    except AlreadyBookedError as e:
        raise HTTPException(status_code=409, detail={"code": "already_booked"}) from e
    except UserNotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": "user_not_found"}) from e
    return {
        "id": str(booking.id),
        "slot_id": booking.slot_id,
        "user_id": booking.user_id,
        "status": booking.status.value,
        "created_at": booking.created_at.isoformat(),
    }


@router.post("/bookings/{booking_id}/cancel")
async def force_cancel(
    booking_id: UUID,
    payload: ForceCancelRequest,
    admin: Annotated[User, Depends(get_admin_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
) -> dict[str, Any]:
    try:
        booking = await service.admin_force_cancel(
            booking_id=str(booking_id),
            refund_quota=payload.refund_quota,
            refund_trial=payload.refund_trial,
        )
    except BookingNotFoundError as e:
        raise HTTPException(
            status_code=404, detail={"code": "booking_not_found"}
        ) from e
    return {
        "id": str(booking.id),
        "status": booking.status.value,
        "cancelled_at": booking.cancelled_at.isoformat()
        if booking.cancelled_at
        else None,
    }


@router.get("/users", response_model=list[UserSummaryResponse])
async def search_users(
    admin: Annotated[User, Depends(get_admin_user)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    q: Annotated[str, Query(max_length=100)] = "",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[UserSummaryResponse]:
    if q:
        users = await user_repo.search(q, limit=limit)
    else:
        users = await user_repo.list_all(limit=limit)
    return [UserSummaryResponse(uid=u.uid, email=u.email, name=u.name) for u in users]
