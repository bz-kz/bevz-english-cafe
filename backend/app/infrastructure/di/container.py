"""
DIコンテナ

依存関係の管理と注入を行う
"""

from typing import Dict, Type, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from ...domain.repositories.contact_repository import ContactRepository
from ...services.contact_service import ContactService
from ...services.email_service import EmailService, MockEmailService
from ..database.connection import get_async_session
from ..event_bus.event_bus import EventBus
from ..event_bus.in_memory_event_bus import InMemoryEventBus
from ..event_handlers.contact_handlers import ContactCreatedHandler, ContactProcessedHandler
from ..repositories.sqlalchemy_contact_repository import SQLAlchemyContactRepository

T = TypeVar('T')


class Container:
    """
    依存性注入コンテナ
    
    アプリケーション全体の依存関係を管理
    """
    
    def __init__(self):
        """初期化"""
        self._services: Dict[Type, object] = {}
        self._setup_services()
    
    def _setup_services(self) -> None:
        """サービスのセットアップ"""
        # イベントバスの設定
        event_bus = InMemoryEventBus()
        self._services[EventBus] = event_bus
        
        # イベントハンドラーの登録
        self._register_event_handlers(event_bus)
    
    async def setup_database_services(self, session: AsyncSession) -> None:
        """
        データベース関連サービスのセットアップ
        
        Args:
            session: データベースセッション
        """
        # リポジトリの設定
        contact_repository = SQLAlchemyContactRepository(session)
        self._services[ContactRepository] = contact_repository
        
        # メールサービスの設定（開発環境ではモックを使用）
        email_service = MockEmailService()
        self._services[EmailService] = email_service
        
        # アプリケーションサービスの設定
        contact_service = ContactService(contact_repository, email_service)
        self._services[ContactService] = contact_service
    
    def _register_event_handlers(self, event_bus: EventBus) -> None:
        """
        イベントハンドラーを登録
        
        Args:
            event_bus: イベントバス
        """
        # Contact関連のハンドラー
        contact_created_handler = ContactCreatedHandler()
        contact_processed_handler = ContactProcessedHandler()
        
        # ハンドラーの登録
        event_bus.subscribe(contact_created_handler.event_type, contact_created_handler)
        event_bus.subscribe(contact_processed_handler.event_type, contact_processed_handler)
    
    def get(self, service_type: Type[T]) -> T:
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
    
    def register(self, service_type: Type[T], instance: T) -> None:
        """
        サービスを登録
        
        Args:
            service_type: サービスのタイプ
            instance: サービスインスタンス
        """
        self._services[service_type] = instance
    
    def is_registered(self, service_type: Type[T]) -> bool:
        """
        サービスが登録されているかチェック
        
        Args:
            service_type: チェックするサービスのタイプ
            
        Returns:
            bool: 登録されている場合True
        """
        return service_type in self._services
    
    def contact_service(self) -> ContactService:
        """ContactServiceを取得"""
        return self.get(ContactService)
    
    def email_service(self) -> EmailService:
        """EmailServiceを取得"""
        return self.get(EmailService)
    
    def contact_repository(self) -> ContactRepository:
        """ContactRepositoryを取得"""
        return self.get(ContactRepository)


# グローバルコンテナインスタンス
_container = Container()


def get_container() -> Container:
    """
    DIコンテナを取得
    
    Returns:
        Container: DIコンテナ
    """
    return _container