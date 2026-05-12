"""Contact API schemas."""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.domain.entities.contact import LessonType, PreferredContact


class ContactCreateRequest(BaseModel):
    """問い合わせ作成リクエストスキーマ"""
    
    name: str = Field(..., min_length=1, max_length=100, description="お名前")
    email: EmailStr = Field(..., description="メールアドレス")
    phone: Optional[str] = Field(None, max_length=20, description="電話番号")
    lesson_type: LessonType = Field(..., description="希望レッスンタイプ")
    preferred_contact: PreferredContact = Field(..., description="希望連絡方法")
    message: str = Field(..., min_length=1, max_length=1000, description="メッセージ")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "山田太郎",
                "email": "yamada@example.com",
                "phone": "090-1234-5678",
                "lesson_type": "trial",
                "preferred_contact": "email",
                "message": "体験レッスンを受けたいです。"
            }
        }
    }


class ContactResponse(BaseModel):
    """問い合わせレスポンススキーマ"""
    
    id: str = Field(..., description="問い合わせID")
    name: str = Field(..., description="お名前")
    email: str = Field(..., description="メールアドレス")
    phone: Optional[str] = Field(None, description="電話番号")
    lesson_type: str = Field(..., description="希望レッスンタイプ")
    preferred_contact: str = Field(..., description="希望連絡方法")
    message: str = Field(..., description="メッセージ")
    status: str = Field(..., description="ステータス")
    created_at: str = Field(..., description="作成日時")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "山田太郎",
                "email": "yamada@example.com",
                "phone": "090-1234-5678",
                "lesson_type": "trial",
                "preferred_contact": "email",
                "message": "体験レッスンを受けたいです。",
                "status": "pending",
                "created_at": "2024-01-01T10:00:00Z"
            }
        }
    }


class ContactCreateResponse(BaseModel):
    """問い合わせ作成成功レスポンススキーマ"""
    
    message: str = Field(..., description="成功メッセージ")
    contact_id: str = Field(..., description="作成された問い合わせID")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "message": "お問い合わせを受け付けました。",
                "contact_id": "123e4567-e89b-12d3-a456-426614174000"
            }
        }
    }