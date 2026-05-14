"""Cloud Function (Gen2) — daily lesson_slot generator.

Cloud Scheduler invokes this via Pub/Sub at 0:00 JST each day. The function
materializes 14 thirty-minute slots (9:00 - 15:30 JST) for the date 14 days
ahead of "today JST". Existing slots at the same start_at are skipped, so the
function is idempotent under retries.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

JST = ZoneInfo("Asia/Tokyo")
UTC = ZoneInfo("UTC")

SLOT_HOURS_START = 9
SLOT_HOURS_END_EXCLUSIVE = 16  # last slot starts at 15:30, ends at 16:00
LOOKAHEAD_DAYS = 14

PROJECT_ID = os.environ.get("TARGET_PROJECT_ID", "english-cafe-496209")


def _now_jst() -> datetime:
    return datetime.now(JST)


def build_target_slots(target_date: date) -> list[dict[str, Any]]:
    """Return 14 slot dicts (9:00..15:30 JST, 30 min each) for the given date."""
    slots: list[dict[str, Any]] = []
    now_utc = datetime.now(UTC)
    for hour in range(SLOT_HOURS_START, SLOT_HOURS_END_EXCLUSIVE):
        for minute in (0, 30):
            start_jst = datetime(
                target_date.year,
                target_date.month,
                target_date.day,
                hour,
                minute,
                tzinfo=JST,
            )
            end_jst = start_jst + timedelta(minutes=30)
            slots.append(
                {
                    "start_at": start_jst,
                    "end_at": end_jst,
                    "lesson_type": "private",
                    "capacity": 1,
                    "booked_count": 0,
                    "price_yen": None,
                    "teacher_id": None,
                    "notes": None,
                    "status": "open",
                    "created_at": now_utc,
                    "updated_at": now_utc,
                }
            )
    return slots


def _slot_already_exists(db: Any, start_at: datetime) -> bool:
    # google.cloud.firestore imported here to keep build_target_slots importable
    # in unit tests without installing the package.
    existing = (
        db.collection("lesson_slots").where("start_at", "==", start_at).limit(1).get()
    )
    return len(list(existing)) > 0


def write_slots(db: Any, slots: list[dict[str, Any]]) -> int:
    """Insert slots that do not already exist (by exact start_at match).

    Returns number of slots actually created.
    """
    batch = db.batch()
    created = 0
    for slot in slots:
        if _slot_already_exists(db, slot["start_at"]):
            continue
        doc_id = str(uuid.uuid4())
        slot_with_id = {**slot, "id": doc_id}
        batch.set(db.collection("lesson_slots").document(doc_id), slot_with_id)
        created += 1
    if created > 0:
        batch.commit()
    return created


def generate_daily_slots(event: Any, context: Any) -> None:
    """Pub/Sub-triggered entrypoint (Cloud Functions Gen2)."""
    from google.cloud import firestore  # type: ignore[import-untyped]

    target = (_now_jst() + timedelta(days=LOOKAHEAD_DAYS)).date()
    logger.info("generating slots for %s", target.isoformat())
    db = firestore.Client(project=PROJECT_ID)
    slots = build_target_slots(target)
    created = write_slots(db, slots)
    logger.info("created %d / %d slots", created, len(slots))
