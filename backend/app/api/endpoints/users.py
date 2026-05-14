"""/api/v1/users/me — current-user profile and history endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user, get_decoded_token
from app.api.dependencies.repositories import (
    get_contact_repository,
    get_monthly_quota_repository,
    get_user_repository,
)
from app.api.schemas.contact import ContactResponse
from app.api.schemas.user import (
    MonthQuotaSummary,
    UserCreate,
    UserResponse,
    UserSignupResponse,
    UserUpdate,
)
from app.domain.entities.contact import Contact
from app.domain.entities.user import User
from app.domain.repositories.contact_repository import ContactRepository
from app.domain.repositories.monthly_quota_repository import MonthlyQuotaRepository
from app.domain.repositories.user_repository import UserRepository
from app.domain.value_objects.phone import Phone
from app.services.user_service import UserService

JST = ZoneInfo("Asia/Tokyo")

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _user_to_response(
    user: User, quota_summary: MonthQuotaSummary | None = None
) -> UserResponse:
    return UserResponse(
        uid=user.uid,
        email=user.email,
        name=user.name,
        phone=user.phone.value if user.phone else None,
        plan=user.plan.value if user.plan else None,
        trial_used=user.trial_used,
        current_month_quota=quota_summary,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _contact_to_response(contact: Contact) -> ContactResponse:
    assert contact.email is not None
    return ContactResponse(
        id=str(contact.id),
        name=contact.name,
        email=contact.email.value,
        phone=contact.phone.value if contact.phone else None,
        lesson_type=contact.lesson_type.value,
        preferred_contact=contact.preferred_contact.value,
        message=contact.message,
        status=contact.status.value,
        created_at=contact.created_at.isoformat(),
        user_id=contact.user_id,
    )


@router.post(
    "/me", response_model=UserSignupResponse, status_code=status.HTTP_201_CREATED
)
async def signup_initialize(
    payload: UserCreate,
    decoded: Annotated[dict[str, Any], Depends(get_decoded_token)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    contact_repo: Annotated[ContactRepository, Depends(get_contact_repository)],
) -> UserSignupResponse:
    """First-time signup wiring. Creates `users/{uid}` and backfills contacts."""
    uid: str = decoded["uid"]
    email = decoded.get("email")
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token missing email claim")

    service = UserService(user_repo, contact_repo)
    try:
        result = await service.signup_initialize(
            uid=uid, email=email, name=payload.name, phone_str=payload.phone
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    return UserSignupResponse(
        user=_user_to_response(result.user),
        linked_contacts=result.linked_contacts,
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(
    user: Annotated[User, Depends(get_current_user)],
    quota_repo: Annotated[
        MonthlyQuotaRepository, Depends(get_monthly_quota_repository)
    ],
) -> UserResponse:
    ym = datetime.now(UTC).astimezone(JST).strftime("%Y-%m")
    quota = await quota_repo.find(user.uid, ym)
    summary = (
        MonthQuotaSummary(
            granted=quota.granted, used=quota.used, remaining=quota.remaining
        )
        if quota
        else None
    )
    return _user_to_response(user, summary)


@router.put("/me", response_model=UserResponse)
async def update_profile(
    payload: UserUpdate,
    user: Annotated[User, Depends(get_current_user)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> UserResponse:
    phone = Phone(payload.phone) if payload.phone else None
    user.update(name=payload.name, phone=phone)
    await user_repo.save(user)
    return _user_to_response(user)


@router.get("/me/contacts", response_model=list[ContactResponse])
async def get_my_contacts(
    user: Annotated[User, Depends(get_current_user)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    contact_repo: Annotated[ContactRepository, Depends(get_contact_repository)],
    limit: int = 50,
    offset: int = 0,
) -> list[ContactResponse]:
    service = UserService(user_repo, contact_repo)
    contacts = await service.find_user_contacts(user=user, limit=limit, offset=offset)
    return [_contact_to_response(c) for c in contacts]
