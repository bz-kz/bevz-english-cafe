"""
イベントハンドラー

ドメインイベントを処理するハンドラーの基底クラス
"""

from abc import ABC, abstractmethod

from ...domain.events.base import DomainEvent


class EventHandler(ABC):
    """
    イベントハンドラー基底クラス
    
    ドメインイベントを処理するハンドラーのインターフェース
    """
    
    @abstractmethod
    async def handle(self, event: DomainEvent) -> None:
        """
        イベントを処理
        
        Args:
            event: 処理するドメインイベント
        """
        pass
    
    @property
    @abstractmethod
    def event_type(self) -> type:
        """
        処理するイベントタイプを取得
        
        Returns:
            type: 処理するイベントタイプ
        """
        pass