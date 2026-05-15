"""Cloud Function (Gen2) — monthly quota grant.

Triggered by Cloud Scheduler at 0:00 JST on the 1st of each month. Walks
users/{uid} where plan != null and grants a MonthlyQuota doc valid for
2 months under the new doc-id scheme {uid}_{granted_at:%Y%m%d%H%M%S%f}.
Idempotent: skips a user already granted in the current JST month.
"""

from __future__ import annotations

import calendar
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


def add_two_months_local(dt: datetime) -> datetime:
    """Mirror of backend app.domain.services.quota_expiry.add_two_months
    (Cloud Function cannot import the backend package)."""
    month_index = dt.month - 1 + 2
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def build_quota_payload(*, uid: str, plan: str, now_utc: datetime) -> dict[str, Any]:
    now_jst = now_utc.astimezone(JST)
    ym = now_jst.strftime("%Y-%m")
    expires_jst = add_two_months_local(now_jst)
    return {
        "user_id": uid,
        "year_month": ym,
        "plan_at_grant": plan,
        "granted": QUOTA_BY_PLAN[plan],
        "used": 0,
        "granted_at": now_utc,
        "expires_at": expires_jst.astimezone(UTC),
    }


def _doc_id(uid: str, granted_at_utc: datetime) -> str:
    return f"{uid}_{granted_at_utc.strftime('%Y%m%d%H%M%S%f')}"


def _already_granted_this_month(db: Any, uid: str, ym: str) -> bool:
    # idempotency: any monthly_quota doc for this user whose year_month == ym
    q = (
        db.collection("monthly_quota")
        .where("user_id", "==", uid)
        .where("year_month", "==", ym)
        .limit(1)
    )
    return len(list(q.stream())) > 0


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
        if _already_granted_this_month(db, uid, ym):
            skipped += 1
            continue
        payload = build_quota_payload(uid=uid, plan=plan, now_utc=now_utc)
        db.collection("monthly_quota").document(_doc_id(uid, now_utc)).set(payload)
        created += 1

    logger.info("monthly grant: created=%d skipped=%d for %s", created, skipped, ym)
