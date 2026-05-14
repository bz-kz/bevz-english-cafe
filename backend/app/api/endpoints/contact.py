"""Contact API endpoints."""

import logging
from typing import Annotated
from uuid import UUID

import firebase_admin
from fastapi import APIRouter, Depends, Header, HTTPException, status
from firebase_admin import auth as fb_auth

from app.api.schemas.contact import (
    ContactCreateRequest,
    ContactCreateResponse,
    ContactResponse,
)
from app.infrastructure.database.firestore_client import get_firestore_client
from app.infrastructure.di.container import get_container
from app.infrastructure.repositories.firestore_contact_repository import (
    FirestoreContactRepository,
)
from app.services.contact_service import ContactService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contacts", tags=["contacts"])


async def get_contact_service() -> ContactService:
    """Per-request ContactService: container singletons + Firestore repository."""
    container = get_container()
    email_service = container.email_service()
    contact_repository = FirestoreContactRepository(get_firestore_client())
    return ContactService(contact_repository, email_service)


@router.post(
    "/",
    response_model=ContactCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="問い合わせ作成",
    description="新しい問い合わせを作成します。",
)
async def create_contact(
    request: ContactCreateRequest,
    contact_service: Annotated[ContactService, Depends(get_contact_service)],
    authorization: Annotated[str | None, Header()] = None,
) -> ContactCreateResponse:
    """問い合わせを作成 — 認証済の場合 user_id を stamp する。"""
    # オプショナル認証: 失敗しても匿名 submission として続行
    user_id: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[len("Bearer ") :].strip()
        try:
            decoded = fb_auth.verify_id_token(token)
            user_id = decoded.get("uid")
        except (ValueError, firebase_admin.exceptions.FirebaseError) as exc:
            logger.info(
                f"Invalid token on contact submission, treating as anonymous: {exc}"
            )

    try:
        contact = await contact_service.create_contact(
            name=request.name,
            email=str(request.email),
            phone=request.phone,
            lesson_type=request.lesson_type.value,
            preferred_contact=request.preferred_contact.value,
            message=request.message,
            user_id=user_id,
        )

        return ContactCreateResponse(
            message="お問い合わせを受け付けました。", contact_id=str(contact.id)
        )

    except ValueError as e:
        logger.warning(f"Invalid contact data: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"入力データが無効です: {str(e)}",
        ) from e
    except Exception as e:
        logger.error(f"Failed to create contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="問い合わせの作成に失敗しました。しばらく時間をおいて再度お試しください。",
        ) from e


@router.get(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="問い合わせ取得",
    description="指定されたIDの問い合わせを取得します。",
)
async def get_contact(
    contact_id: UUID,
    contact_service: Annotated[ContactService, Depends(get_contact_service)],
) -> ContactResponse:
    """問い合わせを取得"""
    try:
        contact = await contact_service.get_contact_by_id(contact_id)

        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定された問い合わせが見つかりません。",
            )

        return ContactResponse(
            id=str(contact.id),
            name=contact.name,
            email=str(contact.email),
            phone=str(contact.phone) if contact.phone else None,
            lesson_type=contact.lesson_type.value,
            preferred_contact=contact.preferred_contact.value,
            message=contact.message,
            status=contact.status.value,
            created_at=contact.created_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get contact {contact_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="問い合わせの取得に失敗しました。",
        ) from e
