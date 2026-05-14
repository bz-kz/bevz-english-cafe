"""Tests for the monthly-quota-grant Cloud Function (mocked Firestore)."""

from __future__ import annotations

from datetime import datetime

from main import (
    JST,
    QUOTA_BY_PLAN,
    build_quota_payload,
    next_month_first_jst,
)


def test_quota_by_plan_constants() -> None:
    assert QUOTA_BY_PLAN["light"] == 4
    assert QUOTA_BY_PLAN["standard"] == 8
    assert QUOTA_BY_PLAN["intensive"] == 16


def test_build_quota_payload_for_standard() -> None:
    now = datetime(2026, 6, 1, 0, 0, tzinfo=JST)
    payload = build_quota_payload(uid="u1", plan="standard", now_utc=now)
    assert payload["user_id"] == "u1"
    assert payload["year_month"] == "2026-06"
    assert payload["granted"] == 8
    assert payload["used"] == 0
    assert payload["plan_at_grant"] == "standard"


def test_next_month_first_jst_handles_month_rollover() -> None:
    nm = next_month_first_jst(datetime(2026, 12, 15, 10, 0, tzinfo=JST))
    assert nm.year == 2027
    assert nm.month == 1
    assert nm.day == 1
