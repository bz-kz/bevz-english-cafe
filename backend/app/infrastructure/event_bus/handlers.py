"""
イベントハンドラー

ドメインイベントを処理するハンドラーの基底クラス
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from ...domain.events.base import DomainEvent

E = TypeVar("E", bound=DomainEvent)


class EventHandler(ABC, Generic[E]):
    """
    イベントハンドラー基底クラス

    ドメインイベントを処理するハンドラーのインターフェース。
    具象ハンドラーは Generic 型引数で具体的なイベント型を指定し、
    handle メソッドのシグネチャを共変的に絞り込む。
    """

    @abstractmethod
    async def handle(self, event: E) -> None:
        """
        イベントを処理

        Args:
            event: 処理するドメインイベント
        """

    @property
    @abstractmethod
    def event_type(self) -> type[E]:
        """
        処理するイベントタイプを取得

        Returns:
            type[E]: 処理するイベントタイプ
        """
