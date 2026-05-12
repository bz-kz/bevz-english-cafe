"""イベントバスのテスト"""

import pytest
from unittest.mock import AsyncMock

from app.domain.events.contact_events import ContactCreated
from app.infrastructure.event_bus.in_memory_event_bus import InMemoryEventBus
from app.infrastructure.event_bus.handlers import EventHandler


class MockEventHandler(EventHandler):
    """テスト用のモックイベントハンドラー"""
    
    def __init__(self):
        self.handle = AsyncMock()
        self._event_type = ContactCreated
    
    @property
    def event_type(self):
        return self._event_type


class TestInMemoryEventBus:
    """InMemoryEventBusのテスト"""
    
    @pytest.fixture
    def event_bus(self):
        """イベントバスのフィクスチャ"""
        return InMemoryEventBus()
    
    @pytest.fixture
    def mock_handler(self):
        """モックハンドラーのフィクスチャ"""
        return MockEventHandler()
    
    @pytest.fixture
    def sample_event(self):
        """サンプルイベントのフィクスチャ"""
        return ContactCreated(
            contact_id="12345678-1234-1234-1234-123456789012",
            name="テスト太郎",
            email="test@example.com",
            phone="090-1234-5678",
            message="テストメッセージ",
            lesson_type="group",
            preferred_contact="email"
        )
    
    def test_handler_subscription(self, event_bus, mock_handler):
        """ハンドラー登録のテスト"""
        event_bus.subscribe(ContactCreated, mock_handler)
        
        handlers = event_bus.get_handlers(ContactCreated)
        assert len(handlers) == 1
        assert handlers[0] == mock_handler
    
    def test_handler_unsubscription(self, event_bus, mock_handler):
        """ハンドラー登録解除のテスト"""
        # 登録
        event_bus.subscribe(ContactCreated, mock_handler)
        assert len(event_bus.get_handlers(ContactCreated)) == 1
        
        # 登録解除
        event_bus.unsubscribe(ContactCreated, mock_handler)
        assert len(event_bus.get_handlers(ContactCreated)) == 0
    
    def test_duplicate_handler_subscription(self, event_bus, mock_handler):
        """重複ハンドラー登録のテスト"""
        event_bus.subscribe(ContactCreated, mock_handler)
        event_bus.subscribe(ContactCreated, mock_handler)  # 重複登録
        
        handlers = event_bus.get_handlers(ContactCreated)
        assert len(handlers) == 1  # 重複は無視される
    
    @pytest.mark.asyncio
    async def test_event_publishing(self, event_bus, mock_handler, sample_event):
        """イベント配信のテスト"""
        # ハンドラー登録
        event_bus.subscribe(ContactCreated, mock_handler)
        
        # イベント配信
        await event_bus.publish(sample_event)
        
        # ハンドラーが呼ばれたことを確認
        mock_handler.handle.assert_called_once_with(sample_event)
    
    @pytest.mark.asyncio
    async def test_event_publishing_without_handlers(self, event_bus, sample_event):
        """ハンドラーなしでのイベント配信テスト"""
        # ハンドラーを登録せずにイベント配信
        await event_bus.publish(sample_event)
        # エラーが発生しないことを確認（警告ログは出力される）
    
    @pytest.mark.asyncio
    async def test_multiple_handlers(self, event_bus, sample_event):
        """複数ハンドラーのテスト"""
        handler1 = MockEventHandler()
        handler2 = MockEventHandler()
        
        # 複数ハンドラー登録
        event_bus.subscribe(ContactCreated, handler1)
        event_bus.subscribe(ContactCreated, handler2)
        
        # イベント配信
        await event_bus.publish(sample_event)
        
        # 両方のハンドラーが呼ばれたことを確認
        handler1.handle.assert_called_once_with(sample_event)
        handler2.handle.assert_called_once_with(sample_event)
    
    @pytest.mark.asyncio
    async def test_handler_exception_handling(self, event_bus, sample_event):
        """ハンドラー例外処理のテスト"""
        failing_handler = MockEventHandler()
        working_handler = MockEventHandler()
        
        # 失敗するハンドラーを設定
        failing_handler.handle.side_effect = Exception("Handler error")
        
        # ハンドラー登録
        event_bus.subscribe(ContactCreated, failing_handler)
        event_bus.subscribe(ContactCreated, working_handler)
        
        # イベント配信（例外が発生しても継続される）
        await event_bus.publish(sample_event)
        
        # 両方のハンドラーが呼ばれたことを確認
        failing_handler.handle.assert_called_once_with(sample_event)
        working_handler.handle.assert_called_once_with(sample_event)
    
    def test_clear_handlers(self, event_bus, mock_handler):
        """ハンドラークリアのテスト"""
        event_bus.subscribe(ContactCreated, mock_handler)
        assert len(event_bus.get_handlers(ContactCreated)) == 1
        
        event_bus.clear_handlers()
        assert len(event_bus.get_handlers(ContactCreated)) == 0
    
    def test_get_registered_event_types(self, event_bus, mock_handler):
        """登録済みイベントタイプ取得のテスト"""
        assert len(event_bus.get_registered_event_types()) == 0
        
        event_bus.subscribe(ContactCreated, mock_handler)
        event_types = event_bus.get_registered_event_types()
        assert len(event_types) == 1
        assert ContactCreated in event_types