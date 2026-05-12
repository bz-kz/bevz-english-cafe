"""
ドメインイベント基底クラス

ドメイン内で発生するイベントの基底クラスを定義
"""

from abc import ABC
from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Any, Dict
from uuid import UUID, uuid4


@dataclass(frozen=True)
class DomainEvent(ABC):
    """
    ドメインイベント基底クラス
    
    ドメイン内で発生するすべてのイベントの基底クラス
    """
    
    event_id: UUID = field(default_factory=uuid4, init=False)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC), init=False)
    event_version: int = field(default=1, init=False)
    
    @property
    def event_type(self) -> str:
        """
        イベントタイプを取得
        
        Returns:
            str: イベントタイプ名
        """
        return self.__class__.__name__
    
    def to_dict(self) -> Dict[str, Any]:
        """
        イベントを辞書形式に変換
        
        Returns:
            Dict[str, Any]: イベントデータ
        """
        return {
            'event_id': str(self.event_id),
            'event_type': self.event_type,
            'occurred_at': self.occurred_at.isoformat(),
            'event_version': self.event_version,
            'data': self._get_event_data()
        }
    
    def _get_event_data(self) -> Dict[str, Any]:
        """
        イベント固有のデータを取得
        
        サブクラスでオーバーライドして実装
        
        Returns:
            Dict[str, Any]: イベント固有のデータ
        """
        # デフォルトでは全フィールドを返す（event_id, occurred_at, event_version以外）
        data = {}
        for key, value in self.__dict__.items():
            if key not in ('event_id', 'occurred_at', 'event_version'):
                if hasattr(value, '__dict__'):
                    # オブジェクトの場合は辞書に変換
                    data[key] = value.__dict__ if hasattr(value, '__dict__') else str(value)
                else:
                    data[key] = value
        return data