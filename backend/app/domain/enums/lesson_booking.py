"""レッスン予約ドメインの Enum 定義。"""

from __future__ import annotations

from enum import Enum


class SlotStatus(str, Enum):
    """レッスンスロットのステータス。"""

    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class BookingStatus(str, Enum):
    """予約のステータス。"""

    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
