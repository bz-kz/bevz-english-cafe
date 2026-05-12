"""Contact application service."""
import logging
from typing import Optional
from uuid import UUID

from app.domain.entities.contact import Contact, ContactStatus, LessonType, PreferredContact
from app.domain.repositories.contact_repository import ContactRepository
from app.domain.value_objects.email import Email
from app.domain.value_objects.phone import Phone
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


class ContactService:
    """問い合わせアプリケーションサービス"""
    
    def __init__(
        self,
        contact_repository: ContactRepository,
        email_service: EmailService
    ):
        self.contact_repository = contact_repository
        self.email_service = email_service
    
    async def create_contact(
        self,
        name: str,
        email: str,
        phone: Optional[str],
        lesson_type: str,
        preferred_contact: str,
        message: str
    ) -> Contact:
        """新しい問い合わせを作成"""
        try:
            # 値オブジェクトの作成
            email_vo = Email(email)
            phone_vo = Phone(phone) if phone else None
            
            # Enumの変換
            lesson_type_enum = LessonType(lesson_type)
            preferred_contact_enum = PreferredContact(preferred_contact)
            
            # Contactエンティティの作成
            contact = Contact(
                name=name,
                email=email_vo,
                phone=phone_vo,
                lesson_type=lesson_type_enum,
                preferred_contact=preferred_contact_enum,
                message=message
            )
            
            # データベースに保存
            saved_contact = await self.contact_repository.save(contact)
            
            # メール送信（非同期で実行、失敗してもエラーにしない）
            try:
                await self.email_service.send_contact_notification(saved_contact)
                await self.email_service.send_contact_confirmation(saved_contact)
                logger.info(f"Emails sent successfully for contact {saved_contact.id}")
            except Exception as e:
                logger.error(f"Failed to send emails for contact {saved_contact.id}: {e}")
                # メール送信失敗は問い合わせ作成の失敗とはしない
            
            logger.info(f"Contact created successfully: {saved_contact.id}")
            return saved_contact
            
        except Exception as e:
            logger.error(f"Failed to create contact: {e}")
            raise
    
    async def get_contact_by_id(self, contact_id: UUID) -> Optional[Contact]:
        """IDで問い合わせを取得"""
        try:
            return await self.contact_repository.find_by_id(contact_id)
        except Exception as e:
            logger.error(f"Failed to get contact {contact_id}: {e}")
            raise
    
    async def update_contact_status(
        self,
        contact_id: UUID,
        status: ContactStatus,
        processed_by: Optional[str] = None,
        processing_notes: Optional[str] = None
    ) -> Optional[Contact]:
        """問い合わせのステータスを更新"""
        try:
            contact = await self.contact_repository.find_by_id(contact_id)
            if not contact:
                return None
            
            # ステータス更新
            if status == ContactStatus.COMPLETED and processed_by:
                # 完了処理の場合はprocessメソッドを使用
                contact.process(processed_by, processing_notes)
            else:
                # その他のステータス更新
                contact.update_status(status)
                if processed_by:
                    contact.processed_by = processed_by
                if processing_notes:
                    contact.processing_notes = processing_notes
            
            # 保存
            updated_contact = await self.contact_repository.save(contact)
            
            logger.info(f"Contact status updated: {contact_id} -> {status}")
            return updated_contact
            
        except Exception as e:
            logger.error(f"Failed to update contact status {contact_id}: {e}")
            raise