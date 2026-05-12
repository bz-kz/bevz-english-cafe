"""Tests for Email Service."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.email_service import SMTPEmailService, MockEmailService
from app.domain.entities.contact import Contact, LessonType, PreferredContact
from app.domain.value_objects.email import Email
from app.domain.value_objects.phone import Phone


class TestMockEmailService:
    """MockEmailServiceのテストケース"""
    
    @pytest.fixture
    def email_service(self):
        """MockEmailServiceインスタンス"""
        return MockEmailService()
    
    @pytest.fixture
    def sample_contact(self):
        """テスト用のContactエンティティ"""
        return Contact(
            id=uuid4(),
            name="山田太郎",
            email=Email("yamada@example.com"),
            phone=Phone("090-1234-5678"),
            lesson_type=LessonType.TRIAL,
            preferred_contact=PreferredContact.EMAIL,
            message="体験レッスンを受けたいです。",
            created_at=datetime.now(ZoneInfo("UTC"))
        )
    
    async def test_send_contact_notification(self, email_service, sample_contact):
        """通知メール送信テスト"""
        result = await email_service.send_contact_notification(sample_contact)
        
        assert result is True
        assert len(email_service.sent_emails) == 1
        
        sent_email = email_service.sent_emails[0]
        assert sent_email["type"] == "notification"
        assert sent_email["contact_id"] == str(sample_contact.id)
        assert sent_email["to"] == "admin@english-cafe.com"
    
    async def test_send_contact_confirmation(self, email_service, sample_contact):
        """確認メール送信テスト"""
        result = await email_service.send_contact_confirmation(sample_contact)
        
        assert result is True
        assert len(email_service.sent_emails) == 1
        
        sent_email = email_service.sent_emails[0]
        assert sent_email["type"] == "confirmation"
        assert sent_email["contact_id"] == str(sample_contact.id)
        assert sent_email["to"] == str(sample_contact.email)


class TestSMTPEmailService:
    """SMTPEmailServiceのテストケース"""
    
    @pytest.fixture
    def email_service(self):
        """SMTPEmailServiceインスタンス"""
        return SMTPEmailService(
            smtp_host="smtp.example.com",
            smtp_port=587,
            smtp_user="user@example.com",
            smtp_password="password",
            from_email="noreply@english-cafe.com",
            admin_email="admin@english-cafe.com"
        )
    
    @pytest.fixture
    def sample_contact(self):
        """テスト用のContactエンティティ"""
        return Contact(
            id=uuid4(),
            name="佐藤花子",
            email=Email("sato@example.com"),
            phone=None,
            lesson_type=LessonType.GROUP,
            preferred_contact=PreferredContact.EMAIL,
            message="グループレッスンに興味があります。",
            created_at=datetime.now(ZoneInfo("UTC"))
        )
    
    @patch('smtplib.SMTP')
    async def test_send_contact_notification_success(
        self, 
        mock_smtp, 
        email_service, 
        sample_contact
    ):
        """通知メール送信成功テスト"""
        # SMTPモックの設定
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server
        
        result = await email_service.send_contact_notification(sample_contact)
        
        assert result is True
        mock_smtp.assert_called_once_with("smtp.example.com", 587)
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("user@example.com", "password")
        mock_server.send_message.assert_called_once()
    
    @patch('smtplib.SMTP')
    async def test_send_contact_confirmation_success(
        self, 
        mock_smtp, 
        email_service, 
        sample_contact
    ):
        """確認メール送信成功テスト"""
        # SMTPモックの設定
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server
        
        result = await email_service.send_contact_confirmation(sample_contact)
        
        assert result is True
        mock_smtp.assert_called_once_with("smtp.example.com", 587)
        mock_server.send_message.assert_called_once()
    
    @patch('smtplib.SMTP')
    async def test_send_notification_smtp_error(
        self, 
        mock_smtp, 
        email_service, 
        sample_contact
    ):
        """SMTP接続エラーテスト"""
        # SMTP接続エラーをシミュレート
        mock_smtp.side_effect = Exception("SMTP connection failed")
        
        result = await email_service.send_contact_notification(sample_contact)
        
        assert result is False
    
    @patch('smtplib.SMTP')
    async def test_send_confirmation_smtp_error(
        self, 
        mock_smtp, 
        email_service, 
        sample_contact
    ):
        """確認メール送信エラーテスト"""
        # SMTP接続エラーをシミュレート
        mock_smtp.side_effect = Exception("SMTP connection failed")
        
        result = await email_service.send_contact_confirmation(sample_contact)
        
        assert result is False
    
    def test_create_notification_body(self, email_service, sample_contact):
        """通知メール本文作成テスト"""
        body = email_service._create_notification_body(sample_contact)
        
        assert "佐藤花子" in body
        assert "sato@example.com" in body
        assert "グループレッスン" in body
        assert "メール" in body
        assert "グループレッスンに興味があります。" in body
        assert str(sample_contact.id) in body
    
    def test_create_notification_body_with_phone(self, email_service):
        """電話番号ありの通知メール本文作成テスト"""
        contact_with_phone = Contact(
            id=uuid4(),
            name="田中次郎",
            email=Email("tanaka@example.com"),
            phone=Phone("080-9876-5432"),
            lesson_type=LessonType.PRIVATE,
            preferred_contact=PreferredContact.PHONE,
            message="プライベートレッスンをお願いします。",
            created_at=datetime.now(ZoneInfo("UTC"))
        )
        
        body = email_service._create_notification_body(contact_with_phone)
        
        assert "田中次郎" in body
        assert "08098765432" in body
        assert "プライベートレッスン" in body
        assert "電話" in body
    
    def test_create_confirmation_body(self, email_service, sample_contact):
        """確認メール本文作成テスト"""
        body = email_service._create_confirmation_body(sample_contact)
        
        assert "佐藤花子" in body
        assert "グループレッスン" in body
        assert "グループレッスンに興味があります。" in body
        assert "英会話カフェ" in body
        assert "2営業日以内" in body