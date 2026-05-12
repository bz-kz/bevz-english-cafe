"""Email service for sending notifications."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Protocol
import logging

from app.config import settings
from app.domain.entities.contact import Contact

logger = logging.getLogger(__name__)


class EmailService(Protocol):
    """メール送信サービスのインターフェース"""
    
    async def send_contact_notification(self, contact: Contact) -> bool:
        """問い合わせ通知メールを送信"""
        ...
    
    async def send_contact_confirmation(self, contact: Contact) -> bool:
        """問い合わせ確認メールを送信"""
        ...


class SMTPEmailService:
    """SMTP経由でメールを送信するサービス"""
    
    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_email: str,
        admin_email: str
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_email = from_email
        self.admin_email = admin_email
    
    async def send_contact_notification(self, contact: Contact) -> bool:
        """管理者への問い合わせ通知メールを送信"""
        try:
            subject = f"【英会話カフェ】新しいお問い合わせ - {contact.name}様"
            body = self._create_notification_body(contact)
            
            return await self._send_email(
                to_email=self.admin_email,
                subject=subject,
                body=body
            )
        except Exception as e:
            logger.error(f"Failed to send notification email: {e}")
            return False
    
    async def send_contact_confirmation(self, contact: Contact) -> bool:
        """顧客への問い合わせ確認メールを送信"""
        try:
            subject = "【英会話カフェ】お問い合わせありがとうございます"
            body = self._create_confirmation_body(contact)
            
            return await self._send_email(
                to_email=str(contact.email),
                subject=subject,
                body=body
            )
        except Exception as e:
            logger.error(f"Failed to send confirmation email: {e}")
            return False   
 
    async def _send_email(self, to_email: str, subject: str, body: str) -> bool:
        """メール送信の共通処理"""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            msg.attach(MIMEText(body, 'plain', 'utf-8'))
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    def _create_notification_body(self, contact: Contact) -> str:
        """管理者通知メールの本文を作成"""
        lesson_type_names = {
            "trial": "体験レッスン",
            "private": "プライベートレッスン", 
            "group": "グループレッスン",
            "business": "ビジネス英語"
        }
        
        preferred_contact_names = {
            "email": "メール",
            "phone": "電話"
        }
        
        phone_text = f"電話番号: {contact.phone}\n" if contact.phone else ""
        
        return f"""新しいお問い合わせが届きました。

お名前: {contact.name}
メールアドレス: {contact.email}
{phone_text}希望レッスン: {lesson_type_names.get(contact.lesson_type.value, contact.lesson_type.value)}
希望連絡方法: {preferred_contact_names.get(contact.preferred_contact.value, contact.preferred_contact.value)}

メッセージ:
{contact.message}

問い合わせID: {contact.id}
受付日時: {contact.created_at.strftime('%Y年%m月%d日 %H:%M')}

管理画面から対応状況を更新してください。
"""  
  
    def _create_confirmation_body(self, contact: Contact) -> str:
        """顧客確認メールの本文を作成"""
        lesson_type_names = {
            "trial": "体験レッスン",
            "private": "プライベートレッスン", 
            "group": "グループレッスン",
            "business": "ビジネス英語"
        }
        
        return f"""{contact.name} 様

この度は英会話カフェにお問い合わせいただき、ありがとうございます。
以下の内容でお問い合わせを受け付けいたしました。

【お問い合わせ内容】
希望レッスン: {lesson_type_names.get(contact.lesson_type.value, contact.lesson_type.value)}
メッセージ: {contact.message}

担当者より2営業日以内にご連絡させていただきます。
しばらくお待ちください。

ご不明な点がございましたら、お気軽にお問い合わせください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
英会話カフェ
〒123-4567 東京都渋谷区○○1-2-3
TEL: 03-1234-5678
Email: info@english-cafe.com
営業時間: 平日 10:00-22:00 / 土日祝 10:00-20:00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


class MockEmailService:
    """テスト用のモックメールサービス"""
    
    def __init__(self):
        self.sent_emails = []
    
    async def send_contact_notification(self, contact: Contact) -> bool:
        """モック通知メール送信"""
        self.sent_emails.append({
            "type": "notification",
            "contact_id": str(contact.id),
            "to": "admin@english-cafe.com"
        })
        logger.info(f"Mock notification email sent for contact {contact.id}")
        return True
    
    async def send_contact_confirmation(self, contact: Contact) -> bool:
        """モック確認メール送信"""
        self.sent_emails.append({
            "type": "confirmation", 
            "contact_id": str(contact.id),
            "to": str(contact.email)
        })
        logger.info(f"Mock confirmation email sent for contact {contact.id}")
        return True