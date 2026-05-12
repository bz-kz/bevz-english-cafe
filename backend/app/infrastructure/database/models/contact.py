"""
Contactモデル

問い合わせテーブルのORM定義
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDMixin


class ContactModel(Base, UUIDMixin, TimestampMixin):
    """
    問い合わせモデル
    
    問い合わせ情報を格納するテーブル
    """
    
    __tablename__ = "contacts"
    __table_args__ = {"comment": "問い合わせ"}
    
    # 基本情報
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="名前"
    )
    
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="メールアドレス"
    )
    
    phone: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="電話番号"
    )
    
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="メッセージ"
    )
    
    # レッスン関連
    lesson_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="レッスンタイプ"
    )
    
    preferred_contact: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="希望連絡方法"
    )
    
    # ステータス管理
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        comment="ステータス"
    )
    
    # 処理情報
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="処理日時"
    )
    
    processed_by: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="処理者"
    )
    
    processing_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="処理メモ"
    )
    
    def __repr__(self) -> str:
        """デバッグ用文字列表現"""
        return (
            f"<ContactModel(id='{self.id}', name='{self.name}', "
            f"email='{self.email}', status='{self.status}')>"
        )