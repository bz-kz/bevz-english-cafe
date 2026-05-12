"""
Contact関連のドメインイベント

問い合わせに関するドメインイベントを定義
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from uuid import UUID

from .base import DomainEvent


@dataclass(frozen=True)
class ContactCreated(DomainEvent):
    """
    問い合わせ作成イベント
    
    新しい問い合わせが作成された時に発生
    """
    
    contact_id: UUID
    name: str
    email: str
    phone: Optional[str]
    message: str
    lesson_type: str
    preferred_contact: str
    
    def _get_event_data(self) -> Dict[str, Any]:
        """イベント固有のデータを取得"""
        return {
            'contact_id': str(self.contact_id),
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'message': self.message,
            'lesson_type': self.lesson_type,
            'preferred_contact': self.preferred_contact
        }


@dataclass(frozen=True)
class ContactUpdated(DomainEvent):
    """
    問い合わせ更新イベント
    
    問い合わせ情報が更新された時に発生
    """
    
    contact_id: UUID
    updated_fields: Dict[str, Any]
    
    def _get_event_data(self) -> Dict[str, Any]:
        """イベント固有のデータを取得"""
        return {
            'contact_id': str(self.contact_id),
            'updated_fields': self.updated_fields
        }


@dataclass(frozen=True)
class ContactProcessed(DomainEvent):
    """
    問い合わせ処理完了イベント
    
    問い合わせの処理が完了した時に発生
    """
    
    contact_id: UUID
    processed_by: str
    processing_notes: Optional[str]
    
    def _get_event_data(self) -> Dict[str, Any]:
        """イベント固有のデータを取得"""
        return {
            'contact_id': str(self.contact_id),
            'processed_by': self.processed_by,
            'processing_notes': self.processing_notes
        }