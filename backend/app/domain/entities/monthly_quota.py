"""MonthlyQuota — per-user coma allowance for a single calendar month (JST)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class MonthlyQuota:
    user_id: str
    year_month: str  # e.g. "2026-05"
    plan_at_grant: str  # 'light' | 'standard' | 'intensive', snapshotted at grant
    granted: int
    used: int
    granted_at: datetime
    expires_at: datetime

    def __post_init__(self) -> None:
        if self.granted < 0:
            raise ValueError("granted must be >= 0")
        if self.used < 0 or self.used > self.granted:
            raise ValueError("used must be in [0, granted]")

    @property
    def remaining(self) -> int:
        return self.granted - self.used

    @property
    def is_exhausted(self) -> bool:
        return self.remaining <= 0
