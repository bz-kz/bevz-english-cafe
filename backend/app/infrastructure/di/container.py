"""
DIコンテナ

依存関係の管理と注入を行う
"""

from typing import TypeVar

from ...config import get_settings
from ...services.email_service import EmailService, MockEmailService, SMTPEmailService
from ..event_bus.event_bus import EventBus
from ..event_bus.in_memory_event_bus import InMemoryEventBus
from ..event_handlers.contact_handlers import (
    ContactCreatedHandler,
    ContactProcessedHandler,
)

T = TypeVar("T")


class Container:
    """
    依存性注入コンテナ

    アプリケーション全体の依存関係を管理
    """

    def __init__(self):
        """初期化"""
        self._services: dict[type, object] = {}
        self._setup_services()

    def _setup_services(self) -> None:
        """サービスのセットアップ"""
        # イベントバスの設定
        event_bus = InMemoryEventBus()
        self._services[EventBus] = event_bus

        # メールサービスの設定（環境変数で本番/開発を切り替え）
        # - development / test: 必ず MockEmailService（SMTP に到達しない）
        # - production など本番系: SMTP_USER が空ならフォールバックで Mock
        #   （Render 上で SMTP_USER 未設定 → 起動時に SMTP 接続失敗するのを防ぐ）
        settings = get_settings()
        email_service: EmailService
        if settings.environment in ("development", "test") or not settings.smtp_user:
            email_service = MockEmailService()
        else:
            email_service = SMTPEmailService(
                smtp_host=settings.smtp_host,
                smtp_port=settings.smtp_port,
                smtp_user=settings.smtp_user,
                smtp_password=settings.smtp_password,
                from_email=settings.from_email,
                admin_email=settings.admin_email,
            )
        self._services[EmailService] = email_service

        # イベントハンドラーの登録（email_service を必要とするため後に登録）
        self._register_event_handlers(event_bus, email_service)

    def _register_event_handlers(
        self, event_bus: EventBus, email_service: EmailService
    ) -> None:
        """
        イベントハンドラーを登録

        Args:
            event_bus: イベントバス
            email_service: 完了通知ハンドラーに渡すメールサービス
        """
        # Contact関連のハンドラー
        # ContactCreatedHandler は CRM/Slack/analytics 用に予約しており、
        # メール送信は ContactService.create_contact 側が直接行うため引数なし。
        contact_created_handler = ContactCreatedHandler()
        contact_processed_handler = ContactProcessedHandler(email_service=email_service)

        # ハンドラーの登録
        event_bus.subscribe(contact_created_handler.event_type, contact_created_handler)
        event_bus.subscribe(
            contact_processed_handler.event_type, contact_processed_handler
        )

    def get(self, service_type: type[T]) -> T:
        """
        サービスを取得

        Args:
            service_type: 取得するサービスのタイプ

        Returns:
            T: サービスインスタンス

        Raises:
            KeyError: サービスが登録されていない場合
        """
        if service_type not in self._services:
            raise KeyError(f"Service {service_type.__name__} is not registered")

        return self._services[service_type]

    def register(self, service_type: type[T], instance: T) -> None:
        """
        サービスを登録

        Args:
            service_type: サービスのタイプ
            instance: サービスインスタンス
        """
        self._services[service_type] = instance

    def is_registered(self, service_type: type[T]) -> bool:
        """
        サービスが登録されているかチェック

        Args:
            service_type: チェックするサービスのタイプ

        Returns:
            bool: 登録されている場合True
        """
        return service_type in self._services

    def email_service(self) -> EmailService:
        """EmailServiceを取得"""
        return self.get(EmailService)


# グローバルコンテナインスタンス
_container = Container()


def get_container() -> Container:
    """
    DIコンテナを取得

    Returns:
        Container: DIコンテナ
    """
    return _container
