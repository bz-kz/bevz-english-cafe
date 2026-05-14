"""/api/v1/lesson-slots — public listing + admin CRUD + admin bookings list."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies.auth import get_admin_user
from app.api.dependencies.repositories import (
    get_booking_repository,
    get_lesson_slot_repository,
)
from app.api.schemas.lesson_slot import (
    LessonSlotAdminResponse,
    LessonSlotCreate,
    LessonSlotPublicResponse,
    LessonSlotUpdate,
)
from app.domain.entities.lesson_slot import LessonSlot
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.domain.repositories.booking_repository import BookingRepository
from app.domain.repositories.lesson_slot_repository import LessonSlotRepository

router = APIRouter(prefix="/api/v1", tags=["lesson-slots"])


def _public(slot: LessonSlot) -> LessonSlotPublicResponse:
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


def _admin(slot: LessonSlot) -> LessonSlotAdminResponse:
    return LessonSlotAdminResponse(
        id=str(slot.id),
        start_at=slot.start_at,
        end_at=slot.end_at,
        lesson_type=slot.lesson_type.value,  # type: ignore[arg-type]
        capacity=slot.capacity,
        booked_count=slot.booked_count,
        remaining=slot.remaining,
        price_yen=slot.price_yen,
        teacher_id=slot.teacher_id,
        notes=slot.notes,
        status=slot.status.value,
        created_at=slot.created_at,
        updated_at=slot.updated_at,
    )


# ---------- Public ----------


@router.get("/lesson-slots", response_model=list[LessonSlotPublicResponse])
async def list_slots(
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: Annotated[datetime | None, Query()] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[LessonSlotPublicResponse]:
    if from_ is not None and to is not None:
        slots = await repo.find_in_range(from_=from_, to_=to)
    else:
        slots = await repo.find_open_future(limit=limit, offset=offset)
    return [_public(s) for s in slots]


@router.get("/lesson-slots/{slot_id}", response_model=LessonSlotPublicResponse)
async def get_slot(
    slot_id: UUID,
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
) -> LessonSlotPublicResponse:
    fetched = await repo.find_by_id(slot_id)
    if fetched is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found")
    return _public(fetched)


# ---------- Admin CRUD ----------


@router.post(
    "/admin/lesson-slots",
    response_model=LessonSlotAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_slot(
    payload: LessonSlotCreate,
    admin: Annotated[User, Depends(get_admin_user)],
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
) -> LessonSlotAdminResponse:
    slot = LessonSlot(
        id=uuid4(),
        start_at=payload.start_at,
        end_at=payload.end_at,
        lesson_type=LessonType(payload.lesson_type),
        capacity=payload.capacity,
        booked_count=0,
        price_yen=payload.price_yen,
        teacher_id=payload.teacher_id,
        notes=payload.notes,
        status=SlotStatus.OPEN,
    )
    await repo.save(slot)
    return _admin(slot)


@router.put(
    "/admin/lesson-slots/{slot_id}",
    response_model=LessonSlotAdminResponse,
)
async def admin_update_slot(
    slot_id: UUID,
    payload: LessonSlotUpdate,
    admin: Annotated[User, Depends(get_admin_user)],
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
) -> LessonSlotAdminResponse:
    slot = await repo.find_by_id(slot_id)
    if slot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found")

    if payload.capacity is not None and payload.capacity < slot.booked_count:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "capacity cannot drop below booked_count",
        )

    if payload.start_at is not None:
        slot.start_at = payload.start_at
    if payload.end_at is not None:
        slot.end_at = payload.end_at
    if payload.lesson_type is not None:
        slot.lesson_type = LessonType(payload.lesson_type)
    if payload.capacity is not None:
        slot.capacity = payload.capacity
    if payload.price_yen is not None:
        slot.price_yen = payload.price_yen
    if payload.teacher_id is not None:
        slot.teacher_id = payload.teacher_id
    if payload.notes is not None:
        slot.notes = payload.notes
    if payload.status is not None:
        slot.status = SlotStatus(payload.status)
    slot.updated_at = datetime.now(UTC)

    await repo.save(slot)
    return _admin(slot)


@router.delete(
    "/admin/lesson-slots/{slot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def admin_delete_slot(
    slot_id: UUID,
    admin: Annotated[User, Depends(get_admin_user)],
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
    booking_repo: Annotated[BookingRepository, Depends(get_booking_repository)],
    force: bool = False,
) -> None:
    confirmed = [
        b
        for b in await booking_repo.find_by_slot(str(slot_id))
        if b.status == BookingStatus.CONFIRMED
    ]
    if confirmed and not force:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{len(confirmed)} confirmed booking(s) exist; pass ?force=true to delete",
        )
    await repo.delete(slot_id)


@router.get("/admin/lesson-slots/{slot_id}/bookings")
async def admin_list_bookings_for_slot(
    slot_id: UUID,
    admin: Annotated[User, Depends(get_admin_user)],
    booking_repo: Annotated[BookingRepository, Depends(get_booking_repository)],
) -> list[dict[str, Any]]:
    bookings = await booking_repo.find_by_slot(str(slot_id))
    return [
        {
            "id": str(b.id),
            "user_id": b.user_id,
            "status": b.status.value,
            "created_at": b.created_at.isoformat(),
        }
        for b in bookings
    ]
