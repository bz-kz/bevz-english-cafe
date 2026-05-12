"""
Contact エンティティ

問い合わせを表現するドメインエンティティ
"""

from dataclasses import dataclass, field
from datetime import datetime, UTC
from enum import Enum
from typing import List, Optional
from uuid import UUID, uuid4

from ..events.base import DomainEvent
from ..events.contact_events import ContactCreated, ContactProcessed, ContactUpdated
from ..value_objects.email import Email
from ..value_objects.phone import Phone


class LessonType(Enum):
    """レッスンタイプ"""
    GROUP = "group"
    PRIVATE = "private"
    ONLINE = "online"
    TRIAL = "trial"
    BUSINESS = "business"
    TOEIC = "toeic"
    OTHER = "other"


class PreferredContact(Enum):
    """希望連絡方法"""
    EMAIL = "email"
    PHONE = "phone"
    LINE = "line"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"


class ContactStatus(Enum):
    """問い合わせステータス"""
    PENDING = "pending"      # 未処理
    PROCESSING = "processing"  # 処理中
    COMPLETED = "completed"   # 完了
    CANCELLED = "cancelled"   # キャンセル


@dataclass
class Contact:
    """
    問い合わせエンティティ
    
    問い合わせに関するビジネスロジックを含む
    """
    
    # 識別子
    id: UUID = field(default_factory=uuid4)
    
    # 基本情報
    name: str = field(default="")
    email: Email = field(default=None)
    phone: Optional[Phone] = field(default=None)
    message: str = field(default="")
    
    # レッスン関連
    lesson_type: LessonType = field(default=LessonType.GROUP)
    preferred_contact: PreferredContact = field(default=PreferredContact.EMAIL)
    
    # ステータス管理
    status: ContactStatus = field(default=ContactStatus.PENDING)
    
    # タイムスタンプ
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    processed_at: Optional[datetime] = field(default=None)
    
    # 処理情報
    processed_by: Optional[str] = field(default=None)
    processing_notes: Optional[str] = field(default=None)
    
    # ドメインイベント
    _domain_events: List[DomainEvent] = field(default_factory=list, init=False)
    
    def __post_init__(self):
        """初期化後の処理"""
        if not self.name:
            raise ValueError("名前は必須です")
        
        if self.email is None:
            raise ValueError("メールアドレスは必須です")
        
        if not self.message:
            raise ValueError("メッセージは必須です")
    
    @classmethod
    def create(
        cls,
        name: str,
        email: str,
        message: str,
        lesson_type: str,
        preferred_contact: str,
        phone: Optional[str] = None,
    ) -> "Contact":
        """
        新しい問い合わせを作成
        
        Args:
            name: 名前
            email: メールアドレス
            message: メッセージ
            lesson_type: レッスンタイプ
            preferred_contact: 希望連絡方法
            phone: 電話番号（オプション）
            
        Returns:
            Contact: 作成された問い合わせ
            
        Raises:
            ValueError: 無効な値が指定された場合
        """
        # 値オブジェクトの作成
        email_vo = Email.create(email)
        phone_vo = Phone.create_optional(phone)
        
        # Enumの変換
        try:
            lesson_type_enum = LessonType(lesson_type)
        except ValueError:
            raise ValueError(f"無効なレッスンタイプです: {lesson_type}")
        
        try:
            preferred_contact_enum = PreferredContact(preferred_contact)
        except ValueError:
            raise ValueError(f"無効な希望連絡方法です: {preferred_contact}")
        
        # エンティティの作成
        contact = cls(
            name=name,
            email=email_vo,
            phone=phone_vo,
            message=message,
            lesson_type=lesson_type_enum,
            preferred_contact=preferred_contact_enum,
        )
        
        # ドメインイベントの追加
        contact._add_domain_event(
            ContactCreated(
                contact_id=contact.id,
                name=contact.name,
                email=str(contact.email),
                phone=str(contact.phone) if contact.phone else None,
                message=contact.message,
                lesson_type=contact.lesson_type.value,
                preferred_contact=contact.preferred_contact.value,
            )
        )
        
        return contact
    
    def update_status(self, status: ContactStatus) -> None:
        """
        ステータスを更新
        
        Args:
            status: 新しいステータス
        """
        old_status = self.status
        self.status = status
        self.updated_at = datetime.now(UTC)
        
        # ドメインイベントの追加
        self._add_domain_event(
            ContactUpdated(
                contact_id=self.id,
                updated_fields={'status': {'old': old_status.value, 'new': status.value}}
            )
        )
    
    def process(self, processed_by: str, notes: Optional[str] = None) -> None:
        """
        問い合わせを処理済みにする
        
        Args:
            processed_by: 処理者
            notes: 処理メモ
        """
        self.status = ContactStatus.COMPLETED
        self.processed_by = processed_by
        self.processing_notes = notes
        self.processed_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)
        
        # ドメインイベントの追加
        self._add_domain_event(
            ContactProcessed(
                contact_id=self.id,
                processed_by=processed_by,
                processing_notes=notes,
            )
        )
    
    def update_contact_info(
        self,
        name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        message: Optional[str] = None,
    ) -> None:
        """
        連絡先情報を更新
        
        Args:
            name: 新しい名前
            email: 新しいメールアドレス
            phone: 新しい電話番号
            message: 新しいメッセージ
        """
        updated_fields = {}
        
        if name is not None and name != self.name:
            updated_fields['name'] = {'old': self.name, 'new': name}
            self.name = name
        
        if email is not None and email != str(self.email):
            updated_fields['email'] = {'old': str(self.email), 'new': email}
            self.email = Email.create(email)
        
        if phone is not None:
            old_phone = str(self.phone) if self.phone else None
            if phone != old_phone:
                updated_fields['phone'] = {'old': old_phone, 'new': phone}
                self.phone = Phone.create_optional(phone)
        
        if message is not None and message != self.message:
            updated_fields['message'] = {'old': self.message, 'new': message}
            self.message = message
        
        if updated_fields:
            self.updated_at = datetime.now(UTC)
            
            # ドメインイベントの追加
            self._add_domain_event(
                ContactUpdated(
                    contact_id=self.id,
                    updated_fields=updated_fields
                )
            )
    
    def _add_domain_event(self, event: DomainEvent) -> None:
        """
        ドメインイベントを追加
        
        Args:
            event: 追加するドメインイベント
        """
        self._domain_events.append(event)
    
    def get_domain_events(self) -> List[DomainEvent]:
        """
        ドメインイベントを取得
        
        Returns:
            List[DomainEvent]: ドメインイベントのリスト
        """
        return self._domain_events.copy()
    
    def clear_domain_events(self) -> None:
        """ドメインイベントをクリア"""
        self._domain_events.clear()
    
    def is_pending(self) -> bool:
        """未処理かどうかを判定"""
        return self.status == ContactStatus.PENDING
    
    def is_completed(self) -> bool:
        """処理完了かどうかを判定"""
        return self.status == ContactStatus.COMPLETED
    
    def can_be_processed(self) -> bool:
        """処理可能かどうかを判定"""
        return self.status in (ContactStatus.PENDING, ContactStatus.PROCESSING)
    
    def __str__(self) -> str:
        """文字列表現"""
        return f"Contact(id={self.id}, name='{self.name}', status={self.status.value})"
    
    def __repr__(self) -> str:
        """デバッグ用文字列表現"""
        return (
            f"Contact(id={self.id}, name='{self.name}', "
            f"email='{self.email}', status={self.status.value})"
        )