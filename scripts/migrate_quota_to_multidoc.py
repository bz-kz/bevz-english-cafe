#!/usr/bin/env python
"""One-shot: convert legacy monthly_quota/{uid}_{YYYY-MM} docs to the new
{uid}_{granted_at:%Y%m%d%H%M%S%f} multi-doc + 2-month-expiry scheme.

PRECONDITION (hard): freeze quota writes (maintenance window / booking
paused) before running. Concurrent booking on a legacy doc during
migration loses consumption on re-run.

  uv run python scripts/migrate_quota_to_multidoc.py --project english-cafe-496209 [--dry-run]
"""
# ruff: noqa: T201  # stdout is this ops script's interface (old -> new mapping)

from __future__ import annotations

import argparse
import calendar
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

from google.cloud import firestore

JST = ZoneInfo("Asia/Tokyo")
UTC = ZoneInfo("UTC")
LEGACY_RE = re.compile(r"^(?P<uid>.+)_(?P<ym>\d{4}-\d{2})$")


def add_two_months(dt: datetime) -> datetime:
    mi = dt.month - 1 + 2
    year = dt.year + mi // 12
    month = mi % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default="english-cafe-496209")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = firestore.Client(project=args.project)
    migrated = 0
    skipped = 0

    for doc in db.collection("monthly_quota").stream():
        m = LEGACY_RE.match(doc.id)
        if not m:
            skipped += 1  # already new-scheme
            continue
        data = doc.to_dict() or {}
        ym = m.group("ym")
        granted_at_jst = datetime.strptime(ym, "%Y-%m").replace(tzinfo=JST)
        granted_at_utc = granted_at_jst.astimezone(UTC)
        expires_utc = add_two_months(granted_at_jst).astimezone(UTC)
        new_id = f"{data['user_id']}_{granted_at_utc.strftime('%Y%m%d%H%M%S%f')}"
        payload = {
            "user_id": data["user_id"],
            "year_month": ym,
            "plan_at_grant": data.get("plan_at_grant", "light"),
            "granted": int(data["granted"]),
            "used": int(data.get("used", 0)),
            "granted_at": granted_at_utc,
            "expires_at": expires_utc,
        }
        print(f"  {doc.id} -> {new_id} (used={payload['used']})")
        if not args.dry_run:
            db.collection("monthly_quota").document(new_id).set(payload)  # overwrite
            doc.reference.delete()
        migrated += 1

    mode = "DRY-RUN " if args.dry_run else ""
    print(f"{mode}Done. migrated={migrated} skipped(non-legacy)={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
