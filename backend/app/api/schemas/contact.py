"""Contact API schemas.

Mirror of frontend/src/schemas/contact.ts (zod). Keep constraints in sync.
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.enums.contact import LessonType, PreferredContact

# 電話番号パターン: frontend/src/schemas/contact.ts と同じ regex
# 受け付けるのは入力時点の緩い形式（ハイフン有無を許容）。
# 詳細なバリデーション（携帯・固定・IP 電話等の区別）は
# app/domain/value_objects/phone.py の Phone VO が担う。
_PHONE_PATTERN = r"^(\+81|0)[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4}$"


class ContactCreateRequest(BaseModel):
    """問い合わせ作成リクエストスキーマ"""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "name": "山田太郎",
                "email": "yamada@example.com",
                "phone": "090-1234-5678",
                "lesson_type": "trial",
                "preferred_contact": "email",
                "message": "体験レッスンを受けたいです。",
            }
        },
    )

    name: str = Field(..., min_length=1, max_length=100, description="お名前")
    email: EmailStr = Field(..., description="メールアドレス")
    phone: str | None = Field(
        None,
        max_length=20,
        pattern=_PHONE_PATTERN,
        description="電話番号",
    )
    lesson_type: LessonType = Field(..., description="希望レッスンタイプ")
    preferred_contact: PreferredContact = Field(..., description="希望連絡方法")
    message: str = Field(..., min_length=1, max_length=1000, description="メッセージ")


class ContactResponse(BaseModel):
    """問い合わせレスポンススキーマ"""

    id: str = Field(..., description="問い合わせID")
    name: str = Field(..., description="お名前")
    email: str = Field(..., description="メールアドレス")
    phone: str | None = Field(None, description="電話番号")
    lesson_type: str = Field(..., description="希望レッスンタイプ")
    preferred_contact: str = Field(..., description="希望連絡方法")
    message: str = Field(..., description="メッセージ")
    status: str = Field(..., description="ステータス")
    created_at: str = Field(..., description="作成日時")
    user_id: str | None = Field(
        None, description="認証済ユーザーの UID (匿名問い合わせの場合は null)"
    )

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
                "created_at": "2024-01-01T10:00:00Z",
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
                "contact_id": "123e4567-e89b-12d3-a456-426614174000",
            }
        }
    }
