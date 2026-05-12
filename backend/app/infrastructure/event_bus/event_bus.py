"""
イベントバス抽象クラス

ドメインイベントの配信インターフェースを定義
"""

from abc import ABC, abstractmethod
from typing import Any

from ...domain.events.base import DomainEvent
from .handlers import EventHandler


class EventBus(ABC):
    """
    イベントバス抽象クラス

    ドメインイベントの配信と処理を行うインターフェース。
    handler は具象イベント型ごとに型パラメータが異なる
    （e.g. EventHandler[ContactCreated]）ため、レジストリ側の
    シグネチャは EventHandler[Any] で受け、ディスパッチ時の整合性は
    event_type をキーとした登録規約で保証する。
    """

    @abstractmethod
    async def publish(self, event: DomainEvent) -> None:
        """
        イベントを配信

        Args:
            event: 配信するドメインイベント
        """

    @abstractmethod
    def subscribe(
        self, event_type: type[DomainEvent], handler: EventHandler[Any]
    ) -> None:
        """
        イベントハンドラーを登録

        Args:
            event_type: 処理するイベントタイプ
            handler: イベントハンドラー
        """

    @abstractmethod
    def unsubscribe(
        self, event_type: type[DomainEvent], handler: EventHandler[Any]
    ) -> None:
        """
        イベントハンドラーの登録を解除

        Args:
            event_type: 処理するイベントタイプ
            handler: イベントハンドラー
        """
