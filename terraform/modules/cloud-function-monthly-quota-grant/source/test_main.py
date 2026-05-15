"""Tests for the monthly-quota-grant Cloud Function (mocked Firestore)."""

from __future__ import annotations

from datetime import datetime

from main import (
    JST,
    QUOTA_BY_PLAN,
    add_two_months_local,
    build_quota_payload,
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


def test_add_two_months_local_jan31():
    from datetime import datetime

    assert add_two_months_local(datetime(2026, 1, 31, tzinfo=JST)) == datetime(
        2026, 3, 31, tzinfo=JST
    )


def test_build_payload_expires_two_months_not_next_first():
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 5, 15, 0, 0, tzinfo=ZoneInfo("UTC"))
    p = build_quota_payload(uid="u1", plan="light", now_utc=now)
    assert p["granted"] == 4
    # 2-month expiry → strictly later than the old next-month-1st (2026-06-01)
    assert p["expires_at"] > datetime(2026, 6, 2, tzinfo=ZoneInfo("UTC"))
