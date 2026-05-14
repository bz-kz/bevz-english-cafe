"""Cloud Function (Gen2) — monthly quota grant.

Triggered by Cloud Scheduler at 0:00 JST on the 1st of each month. Walks
users/{uid} where plan != null, and creates monthly_quota/{uid}_{YYYY-MM}
if not already present (idempotent under Scheduler retries).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

JST = ZoneInfo("Asia/Tokyo")
UTC = ZoneInfo("UTC")

QUOTA_BY_PLAN: dict[str, int] = {"light": 4, "standard": 8, "intensive": 16}

PROJECT_ID = os.environ.get("TARGET_PROJECT_ID", "english-cafe-496209")


def next_month_first_jst(now_jst: datetime) -> datetime:
    """Return datetime at 00:00 JST of the first day of next month."""
    year = now_jst.year + (1 if now_jst.month == 12 else 0)
    month = 1 if now_jst.month == 12 else now_jst.month + 1
    return datetime(year, month, 1, tzinfo=JST)


def build_quota_payload(*, uid: str, plan: str, now_utc: datetime) -> dict[str, Any]:
    now_jst = now_utc.astimezone(JST)
    ym = now_jst.strftime("%Y-%m")
    expires_jst = next_month_first_jst(now_jst)
    return {
        "user_id": uid,
        "year_month": ym,
        "plan_at_grant": plan,
        "granted": QUOTA_BY_PLAN[plan],
        "used": 0,
        "granted_at": now_utc,
        "expires_at": expires_jst.astimezone(UTC),
    }


def grant_monthly_quota(event: Any, context: Any) -> None:
    """Pub/Sub-triggered entrypoint (Cloud Functions Gen2)."""
    from google.cloud import firestore  # type: ignore[import-untyped]

    db = firestore.Client(project=PROJECT_ID)
    now_utc = datetime.now(UTC)
    ym = now_utc.astimezone(JST).strftime("%Y-%m")
    created = 0
    skipped = 0

    for user_doc in db.collection("users").where("plan", "!=", None).stream():
        uid = user_doc.id
        plan = (user_doc.to_dict() or {}).get("plan")
        if plan not in QUOTA_BY_PLAN:
            continue
        doc_id = f"{uid}_{ym}"
        ref = db.collection("monthly_quota").document(doc_id)
        if ref.get().exists:
            skipped += 1
            continue
        ref.set(build_quota_payload(uid=uid, plan=plan, now_utc=now_utc))
        created += 1

    logger.info("monthly grant: created=%d skipped=%d for %s", created, skipped, ym)
