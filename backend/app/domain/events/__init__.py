"""
ドメインイベント

ドメイン内で発生するイベントを定義
"""

from .base import DomainEvent
from .contact_events import ContactCreated, ContactUpdated

__all__ = ["DomainEvent", "ContactCreated", "ContactUpdated"]