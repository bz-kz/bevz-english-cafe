#!/usr/bin/env python
"""One-time backfill: generate today..today+N JST days of lesson_slots.

Usage:
  uv run python scripts/backfill_slots.py --days 14 --project english-cafe-496209

Requires gcloud Application Default Credentials.
"""

from __future__ import annotations

import argparse
import sys
import uuid as _uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from google.cloud import firestore  # type: ignore[import-untyped]

JST = ZoneInfo("Asia/Tokyo")
UTC = ZoneInfo("UTC")


def _build_slots(target: date) -> list[dict]:
    out: list[dict] = []
    now_utc = datetime.now(UTC)
    for hour in range(9, 16):
        for minute in (0, 30):
            start = datetime(
                target.year, target.month, target.day, hour, minute, tzinfo=JST
            )
            out.append(
                {
                    "start_at": start,
                    "end_at": start + timedelta(minutes=30),
                    "lesson_type": "group",
                    "capacity": 5,
                    "booked_count": 0,
                    "price_yen": None,
                    "teacher_id": None,
                    "notes": None,
                    "status": "open",
                    "created_at": now_utc,
                    "updated_at": now_utc,
                }
            )
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--project", default="english-cafe-496209")
    args = parser.parse_args()

    db = firestore.Client(project=args.project)
    today_jst = datetime.now(JST).date()
    total_created = 0
    for offset in range(args.days):
        target = today_jst + timedelta(days=offset)
        slots = _build_slots(target)
        batch = db.batch()
        n = 0
        for slot in slots:
            existing = (
                db.collection("lesson_slots")
                .where("start_at", "==", slot["start_at"])
                .limit(1)
                .get()
            )
            if list(existing):
                continue
            doc_id = str(_uuid.uuid4())
            batch.set(
                db.collection("lesson_slots").document(doc_id),
                {**slot, "id": doc_id},
            )
            n += 1
        if n > 0:
            batch.commit()
        total_created += n
        print(f"  {target.isoformat()} → {n} created")
    print(f"Done. {total_created} slots created across {args.days} days.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
