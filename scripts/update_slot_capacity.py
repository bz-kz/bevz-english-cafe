#!/usr/bin/env python
"""One-shot migration: bump existing lesson_slots to new capacity / lesson_type.

Usage:
  uv run python scripts/update_slot_capacity.py --capacity 5 --lesson-type group

Only slots whose booked_count <= --capacity are updated (no slot is downgraded
to a capacity below its current booked_count).
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime

from google.cloud import firestore


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--capacity", type=int, required=True)
    parser.add_argument("--lesson-type", required=True)
    parser.add_argument("--project", default="english-cafe-496209")
    args = parser.parse_args()

    db = firestore.Client(project=args.project)
    now_utc = datetime.now(UTC)
    updated = 0
    skipped = 0
    refused = 0

    for doc in db.collection("lesson_slots").stream():
        data = doc.to_dict() or {}
        if (
            data.get("capacity") == args.capacity
            and data.get("lesson_type") == args.lesson_type
        ):
            skipped += 1
            continue
        booked = int(data.get("booked_count", 0))
        if booked > args.capacity:
            refused += 1
            print(
                f"  REFUSED {doc.id}: booked_count={booked} > new capacity={args.capacity}",
                file=sys.stderr,
            )
            continue
        doc.reference.update(
            {
                "capacity": args.capacity,
                "lesson_type": args.lesson_type,
                "updated_at": now_utc,
            }
        )
        updated += 1

    print(f"Done. updated={updated} skipped={skipped} refused={refused}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
