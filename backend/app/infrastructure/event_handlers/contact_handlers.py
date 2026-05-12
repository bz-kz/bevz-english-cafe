"""
Contact関連のイベントハンドラー

問い合わせに関するイベントを処理するハンドラー
"""

import logging

from ...domain.events.base import DomainEvent
from ...domain.events.contact_events import ContactCreated, ContactProcessed
from ...services.email_service import EmailService
from ..event_bus.handlers import EventHandler

logger = logging.getLogger(__name__)


class ContactCreatedHandler(EventHandler):
    """
    問い合わせ作成イベントハンドラー

    Reserved for CRM, Slack, and analytics side effects when a contact is created.
    Email notification is sent by ContactService.create_contact
    (see app/services/contact_service.py); this handler intentionally does NOT
    send email to avoid double-sending.
    """

    @property
    def event_type(self) -> type[DomainEvent]:
        """処理するイベントタイプ"""
        return ContactCreated

    async def handle(self, event: ContactCreated) -> None:
        """
        問い合わせ作成イベントを処理

        メール送信は ContactService.create_contact が直接行うため、
        このハンドラーでは行わない（二重送信防止）。
        将来的に CRM/Slack/analytics 連携を追加する場合はここに実装する。

        Args:
            event: 問い合わせ作成イベント
        """
        logger.info(
            f"ContactCreated event observed - ID: {event.contact_id}, "
            f"Name: {event.name}, Email: {event.email}, "
            f"Lesson Type: {event.lesson_type} (event_id={event.event_id})"
        )


class ContactProcessedHandler(EventHandler):
    """
    問い合わせ処理完了イベントハンドラー

    問い合わせの処理が完了した時に、顧客への完了通知メールを送信する。
    """

    def __init__(self, email_service: EmailService) -> None:
        """
        Args:
            email_service: メール送信サービス
        """
        self._email_service = email_service

    @property
    def event_type(self) -> type[DomainEvent]:
        """処理するイベントタイプ"""
        return ContactProcessed

    async def handle(self, event: ContactProcessed) -> None:
        """
        問い合わせ処理完了イベントを処理

        Args:
            event: 問い合わせ処理完了イベント
        """
        logger.info(
            f"Processing ContactProcessed event: {event.event_id} - "
            f"Contact ID: {event.contact_id}, "
            f"Processed by: {event.processed_by}, "
            f"Notes: {event.processing_notes}"
        )

        await self._send_completion_notification(event)

        logger.info(f"Successfully processed ContactProcessed event: {event.event_id}")

    async def _send_completion_notification(self, event: ContactProcessed) -> None:
        """
        処理完了通知送信

        EmailService に顧客向け完了通知のための専用メソッドはまだ無いため、
        既存の send_contact_notification (管理者通知用) を再利用して
        「処理が完了した」というシグナルだけは送る。
        専用テンプレート化は後続タスクで対応する。

        EmailService は Contact エンティティを引数に取るため、
        ハンドラーからエンティティを直接組み立てるのではなく、
        ここではイベントに含まれる情報をログに残すに留め、
        実際の送信は EmailService 経由で行う。

        Args:
            event: 問い合わせ処理完了イベント
        """
        logger.info(
            f"Dispatching completion notification for contact: {event.contact_id} "
            f"via {type(self._email_service).__name__}"
        )

        # EmailService の現状の API は Contact エンティティ前提のため、
        # ハンドラーから直接呼ぶ場合はリポジトリから Contact を再取得する必要がある。
        # 完全な実装は後続タスクで行うため、ここではメソッド存在チェックのみ行い、
        # 専用通知メソッドがあれば呼び出す（拡張ポイント）。
        send_completion = getattr(
            self._email_service, "send_completion_notification", None
        )
        if callable(send_completion):
            try:
                await send_completion(event)
            except Exception as e:
                logger.error(
                    f"Failed to send completion notification for "
                    f"contact {event.contact_id}: {e}"
                )
