"""Pure quota-expiry arithmetic (no I/O). Duplicated logic also lives in the
cloud-function source — keep the three unit-test suites in sync if changed."""

from __future__ import annotations

import calendar
from datetime import datetime


def add_two_months(dt: datetime) -> datetime:
    """Return dt + 2 calendar months, clamping day to the target month's end.

    1/31 -> 3/31, 12/31 -> 2/28(29), preserves time + tzinfo.
    """
    month_index = dt.month - 1 + 2
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)
