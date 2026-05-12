"""Contact API endpoints."""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.api.schemas.contact import (
    ContactCreateRequest,
    ContactCreateResponse,
    ContactResponse
)
from app.services.contact_service import ContactService
from app.infrastructure.database.connection import get_async_session
from app.infrastructure.repositories.sqlalchemy_contact_repository import SQLAlchemyContactRepository
from app.services.email_service import MockEmailService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.options("/")
async def contacts_options():
    """CORS プリフライトリクエスト用のOPTIONSハンドラー"""
    return {"message": "OK"}


async def get_contact_service(
    session: Annotated[AsyncSession, Depends(get_async_session)]
) -> ContactService:
    """ContactServiceの依存性注入"""
    contact_repository = SQLAlchemyContactRepository(session)
    email_service = MockEmailService()
    return ContactService(contact_repository, email_service)


@router.post(
    "/",
    response_model=ContactCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="問い合わせ作成",
    description="新しい問い合わせを作成します。"
)
async def create_contact(
    request: ContactCreateRequest,
    contact_service: Annotated[ContactService, Depends(get_contact_service)]
) -> ContactCreateResponse:
    """問い合わせを作成"""
    try:
        contact = await contact_service.create_contact(
            name=request.name,
            email=str(request.email),
            phone=request.phone,
            lesson_type=request.lesson_type.value,
            preferred_contact=request.preferred_contact.value,
            message=request.message
        )
        
        return ContactCreateResponse(
            message="お問い合わせを受け付けました。",
            contact_id=str(contact.id)
        )
        
    except ValueError as e:
        logger.warning(f"Invalid contact data: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"入力データが無効です: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to create contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="問い合わせの作成に失敗しました。しばらく時間をおいて再度お試しください。"
        )


@router.get(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="問い合わせ取得",
    description="指定されたIDの問い合わせを取得します。"
)
async def get_contact(
    contact_id: UUID,
    contact_service: Annotated[ContactService, Depends(get_contact_service)]
) -> ContactResponse:
    """問い合わせを取得"""
    try:
        contact = await contact_service.get_contact_by_id(contact_id)
        
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定された問い合わせが見つかりません。"
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
            created_at=contact.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get contact {contact_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="問い合わせの取得に失敗しました。"
        )