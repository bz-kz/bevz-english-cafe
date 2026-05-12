"""
インメモリイベントバス

メモリ内でイベントの配信と処理を行う実装
"""

import logging
from collections import defaultdict
from typing import Dict, List, Type

from ...domain.events.base import DomainEvent
from .event_bus import EventBus
from .handlers import EventHandler

logger = logging.getLogger(__name__)


class InMemoryEventBus(EventBus):
    """
    インメモリイベントバス
    
    メモリ内でドメインイベントの配信と処理を行う
    """
    
    def __init__(self):
        """初期化"""
        self._handlers: Dict[Type[DomainEvent], List[EventHandler]] = defaultdict(list)
    
    async def publish(self, event: DomainEvent) -> None:
        """
        イベントを配信
        
        Args:
            event: 配信するドメインイベント
        """
        event_type = type(event)
        handlers = self._handlers.get(event_type, [])
        
        logger.info(f"Publishing event: {event.event_type} (ID: {event.event_id})")
        logger.debug(f"Event data: {event.to_dict()}")
        
        if not handlers:
            logger.warning(f"No handlers registered for event type: {event_type.__name__}")
            return
        
        # 各ハンドラーでイベントを処理
        for handler in handlers:
            try:
                logger.debug(f"Processing event {event.event_id} with handler: {handler.__class__.__name__}")
                await handler.handle(event)
                logger.debug(f"Successfully processed event {event.event_id} with handler: {handler.__class__.__name__}")
            except Exception as e:
                logger.error(
                    f"Error processing event {event.event_id} with handler {handler.__class__.__name__}: {e}",
                    exc_info=True
                )
                # エラーが発生してもほかのハンドラーの処理は継続
                continue
    
    def subscribe(self, event_type: Type[DomainEvent], handler: EventHandler) -> None:
        """
        イベントハンドラーを登録
        
        Args:
            event_type: 処理するイベントタイプ
            handler: イベントハンドラー
        """
        if handler not in self._handlers[event_type]:
            self._handlers[event_type].append(handler)
            logger.info(f"Registered handler {handler.__class__.__name__} for event type: {event_type.__name__}")
        else:
            logger.warning(f"Handler {handler.__class__.__name__} already registered for event type: {event_type.__name__}")
    
    def unsubscribe(self, event_type: Type[DomainEvent], handler: EventHandler) -> None:
        """
        イベントハンドラーの登録を解除
        
        Args:
            event_type: 処理するイベントタイプ
            handler: イベントハンドラー
        """
        if handler in self._handlers[event_type]:
            self._handlers[event_type].remove(handler)
            logger.info(f"Unregistered handler {handler.__class__.__name__} for event type: {event_type.__name__}")
        else:
            logger.warning(f"Handler {handler.__class__.__name__} not found for event type: {event_type.__name__}")
    
    def get_handlers(self, event_type: Type[DomainEvent]) -> List[EventHandler]:
        """
        指定されたイベントタイプのハンドラーを取得
        
        Args:
            event_type: イベントタイプ
            
        Returns:
            List[EventHandler]: ハンドラーのリスト
        """
        return self._handlers.get(event_type, []).copy()
    
    def clear_handlers(self) -> None:
        """すべてのハンドラーをクリア"""
        self._handlers.clear()
        logger.info("Cleared all event handlers")
    
    def get_registered_event_types(self) -> List[Type[DomainEvent]]:
        """
        登録されているイベントタイプを取得
        
        Returns:
            List[Type[DomainEvent]]: 登録されているイベントタイプのリスト
        """
        return list(self._handlers.keys())