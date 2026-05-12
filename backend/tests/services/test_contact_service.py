"""Tests for Contact Service."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4, UUID

from app.services.contact_service import ContactService
from app.domain.entities.contact import Contact, ContactStatus, LessonType, PreferredContact
from app.domain.repositories.contact_repository import ContactRepository
from app.services.email_service import EmailService
from app.domain.value_objects.email import Email
from app.domain.value_objects.phone import Phone


class TestContactService:
    """ContactServiceのテストケース"""
    
    @pytest.fixture
    def mock_repository(self):
        """モックContactRepository"""
        return AsyncMock(spec=ContactRepository)
    
    @pytest.fixture
    def mock_email_service(self):
        """モックEmailService"""
        return AsyncMock(spec=EmailService)
    
    @pytest.fixture
    def contact_service(self, mock_repository, mock_email_service):
        """ContactServiceインスタンス"""
        return ContactService(mock_repository, mock_email_service)
    
    async def test_create_contact_success(
        self, 
        contact_service, 
        mock_repository, 
        mock_email_service
    ):
        """問い合わせ作成成功テスト"""
        # モックの設定
        contact_id = uuid4()
        saved_contact = Contact(
            id=contact_id,
            name="山田太郎",
            email=Email("yamada@example.com"),
            phone=Phone("090-1234-5678"),
            lesson_type=LessonType.TRIAL,
            preferred_contact=PreferredContact.EMAIL,
            message="体験レッスンを受けたいです。"
        )
        
        mock_repository.save.return_value = saved_contact
        mock_email_service.send_contact_notification.return_value = True
        mock_email_service.send_contact_confirmation.return_value = True
        
        # テスト実行
        result = await contact_service.create_contact(
            name="山田太郎",
            email="yamada@example.com",
            phone="090-1234-5678",
            lesson_type="trial",
            preferred_contact="email",
            message="体験レッスンを受けたいです。"
        )
        
        # 検証
        assert result == saved_contact
        mock_repository.save.assert_called_once()
        mock_email_service.send_contact_notification.assert_called_once_with(saved_contact)
        mock_email_service.send_contact_confirmation.assert_called_once_with(saved_contact)
    
    async def test_create_contact_without_phone(
        self, 
        contact_service, 
        mock_repository, 
        mock_email_service
    ):
        """電話番号なしの問い合わせ作成テスト"""
        contact_id = uuid4()
        saved_contact = Contact(
            id=contact_id,
            name="佐藤花子",
            email=Email("sato@example.com"),
            phone=None,
            lesson_type=LessonType.GROUP,
            preferred_contact=PreferredContact.EMAIL,
            message="グループレッスンに興味があります。"
        )
        
        mock_repository.save.return_value = saved_contact
        mock_email_service.send_contact_notification.return_value = True
        mock_email_service.send_contact_confirmation.return_value = True
        
        result = await contact_service.create_contact(
            name="佐藤花子",
            email="sato@example.com",
            phone=None,
            lesson_type="group",
            preferred_contact="email",
            message="グループレッスンに興味があります。"
        )
        
        assert result == saved_contact
        assert result.phone is None    

    async def test_create_contact_email_failure(
        self, 
        contact_service, 
        mock_repository, 
        mock_email_service
    ):
        """メール送信失敗でも問い合わせ作成は成功するテスト"""
        contact_id = uuid4()
        saved_contact = Contact(
            id=contact_id,
            name="田中次郎",
            email=Email("tanaka@example.com"),
            phone=None,
            lesson_type=LessonType.PRIVATE,
            preferred_contact=PreferredContact.EMAIL,
            message="ビジネス英語を学びたいです。"
        )
        
        mock_repository.save.return_value = saved_contact
        # メール送信を失敗させる
        mock_email_service.send_contact_notification.side_effect = Exception("Email failed")
        mock_email_service.send_contact_confirmation.side_effect = Exception("Email failed")
        
        # メール送信が失敗しても問い合わせ作成は成功する
        result = await contact_service.create_contact(
            name="田中次郎",
            email="tanaka@example.com",
            phone=None,
            lesson_type="private",
            preferred_contact="email",
            message="プライベートレッスンを学びたいです。"
        )
        
        assert result == saved_contact
        mock_repository.save.assert_called_once()
    
    async def test_create_contact_invalid_email(
        self, 
        contact_service, 
        mock_repository, 
        mock_email_service
    ):
        """無効なメールアドレスでの問い合わせ作成テスト"""
        with pytest.raises(ValueError):
            await contact_service.create_contact(
                name="エラー太郎",
                email="invalid-email",
                phone=None,
                lesson_type="trial",
                preferred_contact="email",
                message="テストメッセージ"
            )
    
    async def test_create_contact_invalid_lesson_type(
        self, 
        contact_service, 
        mock_repository, 
        mock_email_service
    ):
        """無効なレッスンタイプでの問い合わせ作成テスト"""
        with pytest.raises(ValueError):
            await contact_service.create_contact(
                name="エラー花子",
                email="error@example.com",
                phone=None,
                lesson_type="invalid_type",
                preferred_contact="email",
                message="テストメッセージ"
            )
    
    async def test_get_contact_by_id_success(
        self, 
        contact_service, 
        mock_repository
    ):
        """ID指定での問い合わせ取得成功テスト"""
        contact_id = uuid4()
        expected_contact = Contact(
            id=contact_id,
            name="取得テスト",
            email=Email("get@example.com"),
            phone=None,
            lesson_type=LessonType.PRIVATE,
            preferred_contact=PreferredContact.EMAIL,
            message="取得テスト用メッセージ"
        )
        
        mock_repository.find_by_id.return_value = expected_contact
        
        result = await contact_service.get_contact_by_id(contact_id)
        
        assert result == expected_contact
        mock_repository.find_by_id.assert_called_once_with(contact_id)
    
    async def test_get_contact_by_id_not_found(
        self, 
        contact_service, 
        mock_repository
    ):
        """存在しないIDでの問い合わせ取得テスト"""
        contact_id = uuid4()
        mock_repository.find_by_id.return_value = None
        
        result = await contact_service.get_contact_by_id(contact_id)
        
        assert result is None
        mock_repository.find_by_id.assert_called_once_with(contact_id)
    
    async def test_update_contact_status_success(
        self, 
        contact_service, 
        mock_repository
    ):
        """問い合わせステータス更新成功テスト"""
        contact_id = uuid4()
        original_contact = Contact(
            id=contact_id,
            name="ステータステスト",
            email=Email("status@example.com"),
            phone=None,
            lesson_type=LessonType.TRIAL,
            preferred_contact=PreferredContact.EMAIL,
            message="ステータス更新テスト"
        )
        
        updated_contact = Contact(
            id=contact_id,
            name="ステータステスト",
            email=Email("status@example.com"),
            phone=None,
            lesson_type=LessonType.TRIAL,
            preferred_contact=PreferredContact.EMAIL,
            message="ステータス更新テスト",
            status=ContactStatus.PROCESSING
        )
        
        mock_repository.find_by_id.return_value = original_contact
        mock_repository.save.return_value = updated_contact
        
        result = await contact_service.update_contact_status(
            contact_id=contact_id,
            status=ContactStatus.PROCESSING,
            processed_by="admin@example.com",
            processing_notes="対応開始しました"
        )
        
        assert result == updated_contact
        mock_repository.find_by_id.assert_called_once_with(contact_id)
        mock_repository.save.assert_called_once()
    
    async def test_update_contact_status_not_found(
        self, 
        contact_service, 
        mock_repository
    ):
        """存在しない問い合わせのステータス更新テスト"""
        contact_id = uuid4()
        mock_repository.find_by_id.return_value = None
        
        result = await contact_service.update_contact_status(
            contact_id=contact_id,
            status=ContactStatus.COMPLETED
        )
        
        assert result is None
        mock_repository.find_by_id.assert_called_once_with(contact_id)
        mock_repository.save.assert_not_called()