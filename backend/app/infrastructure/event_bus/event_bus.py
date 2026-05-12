"""
イベントバス抽象クラス

ドメインイベントの配信インターフェースを定義
"""

from abc import ABC, abstractmethod
from typing import Type

from ...domain.events.base import DomainEvent
from .handlers import EventHandler


class EventBus(ABC):
    """
    イベントバス抽象クラス
    
    ドメインイベントの配信と処理を行うインターフェース
    """
    
    @abstractmethod
    async def publish(self, event: DomainEvent) -> None:
        """
        イベントを配信
        
        Args:
            event: 配信するドメインイベント
        """
        pass
    
    @abstractmethod
    def subscribe(self, event_type: Type[DomainEvent], handler: EventHandler) -> None:
        """
        イベントハンドラーを登録
        
        Args:
            event_type: 処理するイベントタイプ
            handler: イベントハンドラー
        """
        pass
    
    @abstractmethod
    def unsubscribe(self, event_type: Type[DomainEvent], handler: EventHandler) -> None:
        """
        イベントハンドラーの登録を解除
        
        Args:
            event_type: 処理するイベントタイプ
            handler: イベントハンドラー
        """
        pass