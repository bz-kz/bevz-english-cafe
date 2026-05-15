from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from app.domain.services.quota_expiry import add_two_months

JST = ZoneInfo("Asia/Tokyo")


def test_normal_month():
    assert add_two_months(datetime(2026, 5, 15, 12, 0, tzinfo=JST)) == datetime(
        2026, 7, 15, 12, 0, tzinfo=JST
    )


def test_jan_31_to_mar_31():
    assert add_two_months(datetime(2026, 1, 31, tzinfo=JST)) == datetime(
        2026, 3, 31, tzinfo=JST
    )


def test_dec_31_crosses_year_to_feb_28():
    assert add_two_months(datetime(2026, 12, 31, tzinfo=JST)) == datetime(
        2027, 2, 28, tzinfo=JST
    )


def test_nov_30_to_jan_30_next_year():
    assert add_two_months(datetime(2026, 11, 30, tzinfo=JST)) == datetime(
        2027, 1, 30, tzinfo=JST
    )


def test_preserves_tzinfo_utc():
    out = add_two_months(datetime(2026, 5, 15, 3, 0, tzinfo=UTC))
    assert out.tzinfo == UTC
