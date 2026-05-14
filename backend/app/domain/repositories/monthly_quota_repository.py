"""MonthlyQuotaRepository interface."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities.monthly_quota import MonthlyQuota


class MonthlyQuotaRepository(ABC):
    @abstractmethod
    async def save(self, quota: MonthlyQuota) -> MonthlyQuota:
        ...

    @abstractmethod
    async def find(self, user_id: str, year_month: str) -> MonthlyQuota | None:
        ...
