#!/usr/bin/env python
"""Admin CLI: set a user's monthly-plan tier in users/{uid}.

Usage:
  uv run python scripts/set_plan.py <uid> --plan light|standard|intensive|none
  uv run python scripts/set_plan.py <uid> --plan standard --grant-now

`--grant-now` immediately creates a monthly_quota row for the current JST month
(rather than waiting for the 1st-of-month Cloud Scheduler).
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
    parser.add_argument("uid")
    parser.add_argument(
        "--plan",
        required=True,
        choices=["light", "standard", "intensive", "none"],
    )
    parser.add_argument("--grant-now", action="store_true")
    parser.add_argument("--project", default="english-cafe-496209")
    args = parser.parse_args()

    db = firestore.Client(project=args.project)
    plan = None if args.plan == "none" else args.plan
    now_utc = datetime.now(UTC)

    user_ref = db.collection("users").document(args.uid)
    user_snap = user_ref.get()
    if not user_snap.exists:
        print(f"User {args.uid} not found", file=sys.stderr)
        return 1
    user_ref.update(
        {
            "plan": plan,
            "plan_started_at": now_utc if plan else None,
            "updated_at": now_utc,
        }
    )
    print(f"Updated {args.uid}: plan={plan}")

    if args.grant_now and plan:
        now_jst = now_utc.astimezone(JST)
        ym = now_jst.strftime("%Y-%m")
        # First day of next month in JST.
        if now_jst.month == 12:
            next_first_jst = datetime(now_jst.year + 1, 1, 1, tzinfo=JST)
        else:
            next_first_jst = datetime(now_jst.year, now_jst.month + 1, 1, tzinfo=JST)
        expires = next_first_jst.astimezone(UTC)
        doc_id = f"{args.uid}_{ym}"
        db.collection("monthly_quota").document(doc_id).set(
            {
                "user_id": args.uid,
                "year_month": ym,
                "plan_at_grant": plan,
                "granted": QUOTA_BY_PLAN[plan],
                "used": 0,
                "granted_at": now_utc,
                "expires_at": expires,
            }
        )
        print(f"Granted {ym} quota: {QUOTA_BY_PLAN[plan]} comas")

    return 0


if __name__ == "__main__":
    sys.exit(main())
