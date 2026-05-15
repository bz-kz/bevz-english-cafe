"""MonthlyQuotaRepository interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime

from app.domain.entities.monthly_quota import MonthlyQuota


class MonthlyQuotaRepository(ABC):
    @abstractmethod
    async def save(self, quota: MonthlyQuota) -> MonthlyQuota:
        ...

    @abstractmethod
    async def find(self, user_id: str, year_month: str) -> MonthlyQuota | None:
        """DEPRECATED (single-doc legacy). Removed before sub-project 4c-2."""
        ...

    @abstractmethod
    async def find_active_for_user(
        self, user_id: str, at: datetime
    ) -> list[MonthlyQuota]:
        """Non-expired, non-exhausted quota docs, granted_at ASC (FIFO)."""
        ...

    @abstractmethod
    async def find_by_doc_id(self, doc_id: str) -> MonthlyQuota | None:
        ...
