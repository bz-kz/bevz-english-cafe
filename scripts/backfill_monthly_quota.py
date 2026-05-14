#!/usr/bin/env python
"""One-shot backfill for monthly_quota.

Usage:
  uv run python scripts/backfill_monthly_quota.py --month 2026-05
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from google.cloud import firestore

JST = ZoneInfo("Asia/Tokyo")

QUOTA_BY_PLAN: dict[str, int] = {"light": 4, "standard": 8, "intensive": 16}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", required=True, help="YYYY-MM e.g. 2026-05")
    parser.add_argument("--project", default="english-cafe-496209")
    args = parser.parse_args()

    db = firestore.Client(project=args.project)
    year, month = map(int, args.month.split("-"))
    granted_at = datetime(year, month, 1, tzinfo=JST).astimezone(UTC)
    if month == 12:
        next_first = datetime(year + 1, 1, 1, tzinfo=JST)
    else:
        next_first = datetime(year, month + 1, 1, tzinfo=JST)
    expires = next_first.astimezone(UTC)

    created = 0
    skipped = 0
    for udoc in db.collection("users").where("plan", "!=", None).stream():
        uid = udoc.id
        plan = (udoc.to_dict() or {}).get("plan")
        if plan not in QUOTA_BY_PLAN:
            continue
        doc_id = f"{uid}_{args.month}"
        ref = db.collection("monthly_quota").document(doc_id)
        if ref.get().exists:
            skipped += 1
            continue
        ref.set(
            {
                "user_id": uid,
                "year_month": args.month,
                "plan_at_grant": plan,
                "granted": QUOTA_BY_PLAN[plan],
                "used": 0,
                "granted_at": granted_at,
                "expires_at": expires,
            }
        )
        created += 1
        print(f"  {uid} ({plan}): granted {QUOTA_BY_PLAN[plan]}")
    print(f"Done. created={created} skipped={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
