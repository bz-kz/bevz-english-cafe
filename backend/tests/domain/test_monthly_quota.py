from datetime import UTC, datetime

import pytest

from app.domain.entities.monthly_quota import MonthlyQuota


def test_remaining_is_granted_minus_used():
    q = MonthlyQuota(
        user_id="u1",
        year_month="2026-05",
        plan_at_grant="standard",
        granted=8,
        used=3,
        granted_at=datetime(2026, 5, 1, tzinfo=UTC),
        expires_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    assert q.remaining == 5


def test_quota_rejects_negative_granted():
    with pytest.raises(ValueError):
        MonthlyQuota(
            user_id="u1",
            year_month="2026-05",
            plan_at_grant="light",
            granted=-1,
            used=0,
            granted_at=datetime(2026, 5, 1, tzinfo=UTC),
            expires_at=datetime(2026, 6, 1, tzinfo=UTC),
        )


def test_quota_rejects_used_greater_than_granted():
    with pytest.raises(ValueError):
        MonthlyQuota(
            user_id="u1",
            year_month="2026-05",
            plan_at_grant="light",
            granted=4,
            used=5,
            granted_at=datetime(2026, 5, 1, tzinfo=UTC),
            expires_at=datetime(2026, 6, 1, tzinfo=UTC),
        )


def test_is_exhausted():
    q = MonthlyQuota(
        user_id="u1",
        year_month="2026-05",
        plan_at_grant="light",
        granted=4,
        used=4,
        granted_at=datetime(2026, 5, 1, tzinfo=UTC),
        expires_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    assert q.is_exhausted is True
