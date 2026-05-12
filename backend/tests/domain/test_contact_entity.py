"""Contactエンティティのテスト"""

import pytest
from datetime import datetime
from uuid import UUID

from app.domain.entities.contact import Contact, ContactStatus, LessonType, PreferredContact
from app.domain.events.contact_events import ContactCreated, ContactProcessed, ContactUpdated


class TestContact:
    """Contactエンティティのテスト"""
    
    def test_contact_creation(self):
        """問い合わせ作成のテスト"""
        contact = Contact.create(
            name="テスト太郎",
            email="test@example.com",
            message="テストメッセージです。",
            lesson_type="group",
            preferred_contact="email",
            phone="090-1234-5678"
        )
        
        assert contact.name == "テスト太郎"
        assert str(contact.email) == "test@example.com"
        assert str(contact.phone) == "09012345678"
        assert contact.message == "テストメッセージです。"
        assert contact.lesson_type == LessonType.GROUP
        assert contact.preferred_contact == PreferredContact.EMAIL
        assert contact.status == ContactStatus.PENDING
        assert isinstance(contact.id, UUID)
        assert isinstance(contact.created_at, datetime)
    
    def test_contact_creation_without_phone(self):
        """電話番号なしでの問い合わせ作成テスト"""
        contact = Contact.create(
            name="テスト太郎",
            email="test@example.com",
            message="テストメッセージです。",
            lesson_type="private",
            preferred_contact="email"
        )
        
        assert contact.phone is None
        assert contact.lesson_type == LessonType.PRIVATE
    
    def test_contact_creation_with_invalid_data(self):
        """無効なデータでの問い合わせ作成テスト"""
        # 名前が空
        with pytest.raises(ValueError, match="名前は必須です"):
            Contact.create(
                name="",
                email="test@example.com",
                message="テストメッセージです。",
                lesson_type="group",
                preferred_contact="email"
            )
        
        # メールアドレスが無効
        with pytest.raises(ValueError, match="無効なメールアドレス形式です"):
            Contact.create(
                name="テスト太郎",
                email="invalid-email",
                message="テストメッセージです。",
                lesson_type="group",
                preferred_contact="email"
            )
        
        # メッセージが空
        with pytest.raises(ValueError, match="メッセージは必須です"):
            Contact.create(
                name="テスト太郎",
                email="test@example.com",
                message="",
                lesson_type="group",
                preferred_contact="email"
            )
        
        # 無効なレッスンタイプ
        with pytest.raises(ValueError, match="無効なレッスンタイプです"):
            Contact.create(
                name="テスト太郎",
                email="test@example.com",
                message="テストメッセージです。",
                lesson_type="invalid",
                preferred_contact="email"
            )
    
    def test_contact_status_update(self):
        """ステータス更新のテスト"""
        contact = Contact.create(
            name="テスト太郎",
            email="test@example.com",
            message="テストメッセージです。",
            lesson_type="group",
            preferred_contact="email"
        )
        
        # 初期状態の確認
        assert contact.is_pending()
        assert not contact.is_completed()
        assert contact.can_be_processed()
        
        # ステータス更新
        contact.update_status(ContactStatus.PROCESSING)
        assert contact.status == ContactStatus.PROCESSING
        assert contact.can_be_processed()
        
        contact.update_status(ContactStatus.COMPLETED)
        assert contact.status == ContactStatus.COMPLETED
        assert contact.is_completed()
        assert not contact.can_be_processed()
    
    def test_contact_processing(self):
        """問い合わせ処理のテスト"""
        contact = Contact.create(
            name="テスト太郎",
            email="test@example.com",
            message="テストメッセージです。",
            lesson_type="group",
            preferred_contact="email"
        )
        
        # 処理実行
        contact.process("管理者", "体験レッスンの案内を送信しました。")
        
        assert contact.status == ContactStatus.COMPLETED
        assert contact.processed_by == "管理者"
        assert contact.processing_notes == "体験レッスンの案内を送信しました。"
        assert contact.processed_at is not None
        assert contact.is_completed()
    
    def test_contact_info_update(self):
        """連絡先情報更新のテスト"""
        contact = Contact.create(
            name="テスト太郎",
            email="test@example.com",
            message="テストメッセージです。",
            lesson_type="group",
            preferred_contact="email"
        )
        
        # 情報更新
        contact.update_contact_info(
            name="テスト花子",
            email="hanako@example.com",
            phone="080-9876-5432",
            message="更新されたメッセージです。"
        )
        
        assert contact.name == "テスト花子"
        assert str(contact.email) == "hanako@example.com"
        assert str(contact.phone) == "08098765432"
        assert contact.message == "更新されたメッセージです。"
    
    def test_domain_events(self):
        """ドメインイベントのテスト"""
        contact = Contact.create(
            name="テスト太郎",
            email="test@example.com",
            message="テストメッセージです。",
            lesson_type="group",
            preferred_contact="email"
        )
        
        # 作成イベントの確認
        events = contact.get_domain_events()
        assert len(events) == 1
        assert isinstance(events[0], ContactCreated)
        assert events[0].contact_id == contact.id
        assert events[0].name == "テスト太郎"
        assert events[0].email == "test@example.com"
        
        # ステータス更新イベント
        contact.update_status(ContactStatus.PROCESSING)
        events = contact.get_domain_events()
        assert len(events) == 2
        assert isinstance(events[1], ContactUpdated)
        
        # 処理完了イベント
        contact.process("管理者", "処理完了")
        events = contact.get_domain_events()
        assert len(events) == 3
        assert isinstance(events[2], ContactProcessed)
        
        # イベントクリア
        contact.clear_domain_events()
        events = contact.get_domain_events()
        assert len(events) == 0
    
    def test_contact_string_representation(self):
        """文字列表現のテスト"""
        contact = Contact.create(
            name="テスト太郎",
            email="test@example.com",
            message="テストメッセージです。",
            lesson_type="group",
            preferred_contact="email"
        )
        
        str_repr = str(contact)
        assert "Contact" in str_repr
        assert str(contact.id) in str_repr
        assert "テスト太郎" in str_repr
        assert "pending" in str_repr