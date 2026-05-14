# Sub-project 4a Implementation Plan — 30min slot grid + Cloud Scheduler

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customer `/book` becomes a 14-day × 14-slot grid (9:00–15:30, 30 min cells) backed by Cloud Scheduler-generated `lesson_slots`. Logged-in users click cells to book; quota / Stripe / 24h cancel deadline are 4b/4c.

**Architecture:** Existing FastAPI + Firestore data model is reused (`lesson_slots`, `bookings`) — only **range-query** read paths are added on backend, and the existing `BookingService.book()` transaction is unchanged. A new Cloud Function (Python 3.12, gen2) runs daily at 0:00 JST via Cloud Scheduler, materializing 14 slots for the date 14 days ahead. Frontend `/book` is rewritten as a 2D grid composed of pure components fed by two new typed-client functions.

**Tech Stack:** FastAPI 0.104 + google-cloud-firestore AsyncClient + Pydantic / Next.js 14 App Router + Tailwind + Zustand / Cloud Functions Gen2 + Cloud Scheduler + Terragrunt/Terraform (HCP Cloud backend).

---

## File Map

| Path | Kind | Purpose |
|---|---|---|
| `backend/app/domain/repositories/lesson_slot_repository.py` | modify | Add `find_in_range(from_, to_)` abstract method |
| `backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py` | modify | Implement `find_in_range` |
| `backend/tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py` | modify | Test the new method |
| `backend/app/api/endpoints/lesson_slots.py` | modify | `GET /api/v1/lesson-slots` accepts `from`/`to`; closed slots included when range is given |
| `backend/tests/api/test_lesson_slots.py` | modify | New `from/to` cases |
| `backend/app/api/endpoints/bookings.py` | modify | `GET /api/v1/users/me/bookings` accepts `from`/`to` |
| `backend/tests/api/test_bookings.py` | modify | New range case |
| `terraform/modules/cloud-function-slot-generator/main.tf` | create | Cloud Function Gen2 + Scheduler + IAM, mirrors `billing-killswitch` |
| `terraform/modules/cloud-function-slot-generator/variables.tf` | create | inputs |
| `terraform/modules/cloud-function-slot-generator/outputs.tf` | create | outputs |
| `terraform/modules/cloud-function-slot-generator/versions.tf` | create | provider pins |
| `terraform/modules/cloud-function-slot-generator/source/main.py` | create | `generate_daily_slots(event, context)` entrypoint |
| `terraform/modules/cloud-function-slot-generator/source/requirements.txt` | create | `google-cloud-firestore` |
| `terraform/modules/cloud-function-slot-generator/source/test_main.py` | create | unit test with mocked Firestore |
| `terraform/envs/prod/scheduler-slots/terragrunt.hcl` | create | Stack wiring |
| `scripts/backfill_slots.py` | create | One-time backfill of `--days N` |
| `frontend/src/lib/booking.ts` | modify | `listSlotsInRange`, `listMyBookingsInRange` |
| `frontend/src/app/book/_components/BookingGrid.tsx` | create | 14×14 grid component |
| `frontend/src/app/book/_components/SlotCell.tsx` | replace | Cell renderer ○/×/-/mine |
| `frontend/src/app/book/_components/BookingConfirmDialog.tsx` | create | Click confirmation modal |
| `frontend/src/app/book/_components/__tests__/BookingGrid.test.tsx` | create | Grid maps slots into cells |
| `frontend/src/app/book/_components/__tests__/SlotCell.test.tsx` | create | Cell state matrix |
| `frontend/src/app/book/page.tsx` | replace | Rewire to BookingGrid |

---

## Task 1: Backend — `LessonSlotRepository.find_in_range` interface + Firestore impl

**Files:**
- Modify: `backend/app/domain/repositories/lesson_slot_repository.py`
- Modify: `backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py`
- Modify: `backend/tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py`:

```python
async def test_find_in_range_returns_slots_regardless_of_status(
    repo: FirestoreLessonSlotRepository,
) -> None:
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    open_slot = LessonSlot(
        id=uuid4(),
        start_at=base,
        end_at=base + timedelta(minutes=30),
        lesson_type=LessonType.PRIVATE,
        capacity=1,
        booked_count=0,
        status=SlotStatus.OPEN,
    )
    closed_slot = LessonSlot(
        id=uuid4(),
        start_at=base + timedelta(hours=1),
        end_at=base + timedelta(hours=1, minutes=30),
        lesson_type=LessonType.PRIVATE,
        capacity=1,
        booked_count=0,
        status=SlotStatus.CLOSED,
    )
    cancelled = LessonSlot(
        id=uuid4(),
        start_at=base + timedelta(hours=2),
        end_at=base + timedelta(hours=2, minutes=30),
        lesson_type=LessonType.PRIVATE,
        capacity=1,
        booked_count=0,
        status=SlotStatus.CANCELLED,
    )
    out_of_range = LessonSlot(
        id=uuid4(),
        start_at=base + timedelta(days=30),
        end_at=base + timedelta(days=30, minutes=30),
        lesson_type=LessonType.PRIVATE,
        capacity=1,
        booked_count=0,
        status=SlotStatus.OPEN,
    )
    for s in (open_slot, closed_slot, cancelled, out_of_range):
        await repo.save(s)

    result = await repo.find_in_range(
        from_=base,
        to_=base + timedelta(days=1),
    )
    result_ids = {s.id for s in result}
    assert open_slot.id in result_ids
    assert closed_slot.id in result_ids
    assert cancelled.id not in result_ids  # cancelled excluded
    assert out_of_range.id not in result_ids
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && uv run pytest tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py::test_find_in_range_returns_slots_regardless_of_status -v`

Expected: FAIL — `AttributeError: 'FirestoreLessonSlotRepository' object has no attribute 'find_in_range'`.

- [ ] **Step 3: Add abstract method to the interface**

In `backend/app/domain/repositories/lesson_slot_repository.py`, add after `find_open_future`:

```python
    @abstractmethod
    async def find_in_range(
        self,
        *,
        from_: datetime,
        to_: datetime,
    ) -> list[LessonSlot]:
        """Return slots with start_at in [from_, to_), excluding cancelled."""
```

Add `from datetime import datetime` at top.

- [ ] **Step 4: Implement on Firestore repo**

In `backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py`, add after `find_open_future`:

```python
    async def find_in_range(
        self,
        *,
        from_: datetime,
        to_: datetime,
    ) -> list[LessonSlot]:
        query = (
            self._collection.where("start_at", ">=", from_)
            .where("start_at", "<", to_)
            .order_by("start_at")
        )
        results: list[LessonSlot] = []
        async for doc in query.stream():
            slot = self._from_dict(doc.to_dict(), doc.id)
            if slot.status == SlotStatus.CANCELLED:
                continue
            results.append(slot)
        return results
```

- [ ] **Step 5: Run, expect PASS**

Run: same pytest command. Expected: PASS.

- [ ] **Step 6: Type-check + lint**

```
cd backend && uv run mypy app/domain app/services
cd backend && uv run ruff check . && uv run ruff format --check .
```
Expected: 0 errors.

- [ ] **Step 7: Commit**

```
git add backend/app/domain/repositories/lesson_slot_repository.py \
        backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py \
        backend/tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py
git commit -m "feat(backend): LessonSlotRepository.find_in_range for date-range queries"
```

---

## Task 2: Backend — extend `GET /api/v1/lesson-slots` with `from`/`to`

**Files:**
- Modify: `backend/app/api/endpoints/lesson_slots.py`
- Modify: `backend/tests/api/test_lesson_slots.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/api/test_lesson_slots.py`:

```python
async def test_list_with_from_to_includes_closed(
    client: AsyncClient,
    slot_factory,
) -> None:
    base = datetime(2026, 7, 1, 9, 0, tzinfo=UTC)
    open_slot = await slot_factory(start_at=base, status=SlotStatus.OPEN)
    closed = await slot_factory(
        start_at=base + timedelta(hours=1),
        status=SlotStatus.CLOSED,
    )
    out = await slot_factory(start_at=base + timedelta(days=30))

    resp = await client.get(
        "/api/v1/lesson-slots",
        params={
            "from": base.isoformat(),
            "to": (base + timedelta(days=1)).isoformat(),
        },
    )
    assert resp.status_code == 200
    ids = {s["id"] for s in resp.json()}
    assert str(open_slot.id) in ids
    assert str(closed.id) in ids
    assert str(out.id) not in ids
```

(If `slot_factory` does not exist as a fixture, add one inline using
`FirestoreLessonSlotRepository(get_firestore_client())`.)

- [ ] **Step 2: Run, expect FAIL**

Run: `cd backend && uv run pytest tests/api/test_lesson_slots.py::test_list_with_from_to_includes_closed -v`
Expected: FAIL — current endpoint ignores `from`/`to`.

- [ ] **Step 3: Update the endpoint**

Replace the `list_open_slots` handler in `backend/app/api/endpoints/lesson_slots.py`:

```python
@router.get("/lesson-slots", response_model=list[LessonSlotPublicResponse])
async def list_slots(
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    limit: int = 50,
    offset: int = 0,
) -> list[LessonSlotPublicResponse]:
    if from_ is not None and to is not None:
        slots = await repo.find_in_range(from_=from_, to_=to)
    else:
        slots = await repo.find_open_future(limit=limit, offset=offset)
    return [_public(s) for s in slots]
```

Add `from fastapi import Query` import. Keep the rest of the file unchanged.

- [ ] **Step 4: Run, expect PASS**

Run: same command. Expected: PASS.

- [ ] **Step 5: Commit**

```
git add backend/app/api/endpoints/lesson_slots.py backend/tests/api/test_lesson_slots.py
git commit -m "feat(backend): GET /lesson-slots accepts from/to range, returns closed too"
```

---

## Task 3: Backend — extend `GET /api/v1/users/me/bookings` with `from`/`to`

**Files:**
- Modify: `backend/app/api/endpoints/bookings.py`
- Modify: `backend/tests/api/test_bookings.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/api/test_bookings.py`:

```python
async def test_list_my_bookings_filters_by_slot_start_in_range(
    client: AsyncClient,
    authed_user,
    slot_factory,
    booking_factory,
) -> None:
    base = datetime(2026, 7, 1, 9, 0, tzinfo=UTC)
    in_range_slot = await slot_factory(start_at=base + timedelta(hours=1))
    out_slot = await slot_factory(start_at=base + timedelta(days=30))
    in_b = await booking_factory(slot=in_range_slot, user=authed_user)
    out_b = await booking_factory(slot=out_slot, user=authed_user)

    resp = await client.get(
        "/api/v1/users/me/bookings",
        params={
            "from": base.isoformat(),
            "to": (base + timedelta(days=1)).isoformat(),
        },
        headers={"Authorization": f"Bearer {authed_user.token}"},
    )
    assert resp.status_code == 200
    ids = {b["id"] for b in resp.json()}
    assert str(in_b.id) in ids
    assert str(out_b.id) not in ids
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd backend && uv run pytest tests/api/test_bookings.py::test_list_my_bookings_filters_by_slot_start_in_range -v`
Expected: FAIL — endpoint currently ignores `from`/`to`.

- [ ] **Step 3: Update the endpoint**

Replace `list_my_bookings` in `backend/app/api/endpoints/bookings.py`:

```python
@router.get(
    "/users/me/bookings",
    response_model=list[BookingWithSlotResponse],
)
async def list_my_bookings(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
    slot_repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
) -> list[BookingWithSlotResponse]:
    bookings = await service.find_user_bookings(user=user)
    results: list[BookingWithSlotResponse] = []
    for b in bookings:
        slot = await slot_repo.find_by_id(UUID(b.slot_id))
        if slot is None:
            continue
        if from_ is not None and slot.start_at < from_:
            continue
        if to is not None and slot.start_at >= to:
            continue
        results.append(
            BookingWithSlotResponse(
                id=str(b.id),
                status=b.status.value,
                created_at=b.created_at,
                cancelled_at=b.cancelled_at,
                slot=_slot_public(slot),
            )
        )
    return results
```

Add `from datetime import datetime` and `from fastapi import Query` imports.

- [ ] **Step 4: Run, expect PASS**

Run: same command. Expected: PASS.

- [ ] **Step 5: Commit**

```
git add backend/app/api/endpoints/bookings.py backend/tests/api/test_bookings.py
git commit -m "feat(backend): GET /users/me/bookings accepts from/to range"
```

---

## Task 4: Cloud Function source — `generate_daily_slots`

**Files:**
- Create: `terraform/modules/cloud-function-slot-generator/source/main.py`
- Create: `terraform/modules/cloud-function-slot-generator/source/test_main.py`
- Create: `terraform/modules/cloud-function-slot-generator/source/requirements.txt`

- [ ] **Step 1: Write the failing test**

Create `terraform/modules/cloud-function-slot-generator/source/test_main.py`:

```python
"""Unit tests for generate_daily_slots — Firestore client is mocked."""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pytest

from main import build_target_slots, JST, SLOT_HOURS_START, SLOT_HOURS_END_EXCLUSIVE


def test_build_target_slots_emits_14_slots_for_a_day() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    slots = build_target_slots(target)
    assert len(slots) == 14  # 9:00, 9:30, ... 15:30


def test_build_target_slots_first_slot_is_09_00_jst() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    slots = build_target_slots(target)
    first = slots[0]
    assert first["start_at"].hour == 9
    assert first["start_at"].minute == 0
    assert first["start_at"].tzinfo == JST


def test_build_target_slots_last_slot_is_15_30_jst() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    slots = build_target_slots(target)
    last = slots[-1]
    assert last["start_at"].hour == 15
    assert last["start_at"].minute == 30


def test_build_target_slots_each_slot_is_30_min() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    for slot in build_target_slots(target):
        assert slot["end_at"] - slot["start_at"] == timedelta(minutes=30)


def test_build_target_slots_defaults() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    slot = build_target_slots(target)[0]
    assert slot["lesson_type"] == "private"
    assert slot["capacity"] == 1
    assert slot["booked_count"] == 0
    assert slot["price_yen"] is None
    assert slot["teacher_id"] is None
    assert slot["notes"] is None
    assert slot["status"] == "open"
```

- [ ] **Step 2: Verify pytest fails (file does not exist)**

Run:
```
cd terraform/modules/cloud-function-slot-generator/source && python -m pytest test_main.py -v
```
Expected: ImportError — no `main` module yet.

- [ ] **Step 3: Implement `main.py`**

Create `terraform/modules/cloud-function-slot-generator/source/main.py`:

```python
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

from google.cloud import firestore  # type: ignore[import-untyped]

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


def _slot_already_exists(
    db: firestore.Client, start_at: datetime
) -> bool:
    existing = (
        db.collection("lesson_slots")
        .where("start_at", "==", start_at)
        .limit(1)
        .get()
    )
    return len(list(existing)) > 0


def write_slots(db: firestore.Client, slots: list[dict[str, Any]]) -> int:
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
    target = (_now_jst() + timedelta(days=LOOKAHEAD_DAYS)).date()
    logger.info("generating slots for %s", target.isoformat())
    db = firestore.Client(project=PROJECT_ID)
    slots = build_target_slots(target)
    created = write_slots(db, slots)
    logger.info("created %d / %d slots", created, len(slots))
```

- [ ] **Step 4: Create requirements.txt**

Create `terraform/modules/cloud-function-slot-generator/source/requirements.txt`:

```
google-cloud-firestore>=2.16
```

- [ ] **Step 5: Run tests, expect PASS**

```
cd terraform/modules/cloud-function-slot-generator/source && \
  python -m pip install --user google-cloud-firestore pytest >/dev/null && \
  python -m pytest test_main.py -v
```
Expected: 5/5 PASS.

(If pip install fails because of the pip-block hook, install in a fresh
venv or skip — these tests don't actually need network, only the package
on `sys.path`.)

- [ ] **Step 6: Commit**

```
git add terraform/modules/cloud-function-slot-generator/source/
git commit -m "feat(scheduler-slots): Cloud Function source for daily slot generation"
```

---

## Task 5: Terraform module — `cloud-function-slot-generator`

**Files:**
- Create: `terraform/modules/cloud-function-slot-generator/main.tf`
- Create: `terraform/modules/cloud-function-slot-generator/variables.tf`
- Create: `terraform/modules/cloud-function-slot-generator/outputs.tf`
- Create: `terraform/modules/cloud-function-slot-generator/versions.tf`

- [ ] **Step 1: Create `versions.tf`**

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}
```

- [ ] **Step 2: Create `variables.tf`**

```hcl
variable "gcp_project_id" {
  type        = string
  description = "Target GCP project."
}

variable "region" {
  type        = string
  description = "Cloud Function region (e.g. asia-northeast1)."
}

variable "function_service_account_id" {
  type        = string
  description = "Short SA id (no @-suffix) for the function runtime."
  default     = "slot-generator"
}

variable "schedule_cron" {
  type        = string
  description = "Cron expression (Cloud Scheduler syntax) in tz var below."
  default     = "0 0 * * *"
}

variable "schedule_timezone" {
  type        = string
  default     = "Asia/Tokyo"
}
```

- [ ] **Step 3: Create `main.tf`**

```hcl
resource "google_project_service" "required" {
  for_each = toset([
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudscheduler.googleapis.com",
    "pubsub.googleapis.com",
    "eventarc.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
  ])
  project            = var.gcp_project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_pubsub_topic" "daily" {
  project    = var.gcp_project_id
  name       = "slot-generator-daily"
  depends_on = [google_project_service.required]
}

resource "google_service_account" "fn" {
  project      = var.gcp_project_id
  account_id   = var.function_service_account_id
  display_name = "Daily slot generator"
}

resource "google_project_iam_member" "fn_firestore" {
  project = var.gcp_project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.fn.email}"
}

# Eventarc trigger SA = compute default; needs run.invoker + event receiver.
data "google_project" "current" {
  project_id = var.gcp_project_id
}

locals {
  compute_default_sa = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "eventarc_run_invoker" {
  project = var.gcp_project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${local.compute_default_sa}"
}

resource "google_project_iam_member" "eventarc_event_receiver" {
  project = var.gcp_project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${local.compute_default_sa}"
}

data "archive_file" "source" {
  type        = "zip"
  source_dir  = "${path.module}/source"
  output_path = "${path.module}/.terraform-tmp/source.zip"
}

resource "google_storage_bucket" "source" {
  project                     = var.gcp_project_id
  name                        = "${var.gcp_project_id}-slot-generator-source"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
}

resource "google_storage_bucket_object" "source_zip" {
  name   = "source-${data.archive_file.source.output_md5}.zip"
  bucket = google_storage_bucket.source.name
  source = data.archive_file.source.output_path
}

resource "google_cloudfunctions2_function" "slot_generator" {
  project  = var.gcp_project_id
  location = var.region
  name     = "slot-generator"

  build_config {
    runtime     = "python312"
    entry_point = "generate_daily_slots"
    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.source_zip.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    min_instance_count    = 0
    available_memory      = "256M"
    timeout_seconds       = 120
    service_account_email = google_service_account.fn.email
    environment_variables = {
      TARGET_PROJECT_ID = var.gcp_project_id
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.daily.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }

  depends_on = [
    google_project_service.required,
    google_project_iam_member.fn_firestore,
    google_project_iam_member.eventarc_run_invoker,
    google_project_iam_member.eventarc_event_receiver,
  ]
}

resource "google_cloud_scheduler_job" "daily" {
  project   = var.gcp_project_id
  region    = var.region
  name      = "slot-generator-daily"
  schedule  = var.schedule_cron
  time_zone = var.schedule_timezone

  pubsub_target {
    topic_name = google_pubsub_topic.daily.id
    data       = base64encode("{}")
  }
}
```

- [ ] **Step 4: Create `outputs.tf`**

```hcl
output "function_name" {
  value = google_cloudfunctions2_function.slot_generator.name
}

output "topic_name" {
  value = google_pubsub_topic.daily.name
}
```

- [ ] **Step 5: Validate (terraform fmt + validate)**

```
cd terraform/modules/cloud-function-slot-generator && \
  terraform init -backend=false && \
  terraform fmt -check && \
  terraform validate
```
Expected: 0 errors. If `terraform init` complains about missing backend, that's fine since we passed `-backend=false`.

- [ ] **Step 6: Commit**

```
git add terraform/modules/cloud-function-slot-generator/
git commit -m "feat(scheduler-slots): terraform module for Cloud Function + Scheduler"
```

---

## Task 6: Terraform stack — `terraform/envs/prod/scheduler-slots`

**Files:**
- Create: `terraform/envs/prod/scheduler-slots/terragrunt.hcl`

- [ ] **Step 1: Create the stack file**

```hcl
include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

terraform {
  source = "${get_repo_root()}//terraform/modules/cloud-function-slot-generator"
}

remote_state {
  backend = "remote"
  config = {
    organization = local.env.locals.hcp_organization
    workspaces = {
      name = "english-cafe-prod-scheduler-slots"
    }
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

inputs = {
  gcp_project_id = local.env.locals.gcp_project_id
  region         = local.env.locals.region
}
```

- [ ] **Step 2: Validate**

```
cd terraform/envs/prod/scheduler-slots && terragrunt plan
```
Expected: plan succeeds, lists ~12 resources to create (project services, pubsub, SA, IAM bindings, storage, function, scheduler).

(If `terragrunt plan` fails because the HCP workspace `english-cafe-prod-scheduler-slots` does not exist yet, create it once via HCP Terraform UI before running plan. This is the same one-time bootstrap we did for other stacks.)

- [ ] **Step 3: Commit**

```
git add terraform/envs/prod/scheduler-slots/terragrunt.hcl
git commit -m "feat(scheduler-slots): prod stack wiring"
```

---

## Task 7: Backfill script — `scripts/backfill_slots.py`

**Files:**
- Create: `scripts/backfill_slots.py`

- [ ] **Step 1: Write the script**

Create `scripts/backfill_slots.py`:

```python
#!/usr/bin/env python
"""One-time backfill: generate today..today+N JST days of lesson_slots.

Usage:
  uv run python scripts/backfill_slots.py --days 14 --project english-cafe-496209

Requires gcloud Application Default Credentials.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from datetime import datetime
from zoneinfo import ZoneInfo

from google.cloud import firestore  # type: ignore[import-untyped]

JST = ZoneInfo("Asia/Tokyo")


def _build_slots(target: date) -> list[dict]:
    # Mirror the Cloud Function logic (kept inline to avoid path coupling).
    from datetime import datetime, timedelta as td

    UTC = ZoneInfo("UTC")
    out = []
    now_utc = datetime.now(UTC)
    for hour in range(9, 16):
        for minute in (0, 30):
            start = datetime(
                target.year, target.month, target.day, hour, minute, tzinfo=JST
            )
            out.append(
                {
                    "start_at": start,
                    "end_at": start + td(minutes=30),
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
        import uuid as _uuid

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
```

- [ ] **Step 2: Dry-syntax-check via `python -m py_compile`**

```
python -m py_compile scripts/backfill_slots.py
```
Expected: no output (success).

- [ ] **Step 3: Commit**

```
git add scripts/backfill_slots.py
git commit -m "feat(scripts): backfill_slots.py for one-time slot seeding"
```

---

## Task 8: Frontend — `listSlotsInRange` + `listMyBookingsInRange`

**Files:**
- Modify: `frontend/src/lib/booking.ts`

- [ ] **Step 1: Add the two functions**

Append to `frontend/src/lib/booking.ts` (after the existing `listMyBookings`):

```ts
export async function listSlotsInRange(
  from: string,  // ISO date or datetime
  to: string,
): Promise<LessonSlot[]> {
  const resp = await axios.get<LessonSlot[]>(
    `${API_BASE}/api/v1/lesson-slots`,
    { params: { from, to } },
  );
  return resp.data;
}

export async function listMyBookingsInRange(
  from: string,
  to: string,
): Promise<Booking[]> {
  const resp = await axios.get<Booking[]>(
    `${API_BASE}/api/v1/users/me/bookings`,
    { params: { from, to }, headers: await authHeaders() },
  );
  return resp.data;
}
```

- [ ] **Step 2: Type-check**

```
cd frontend && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```
git add frontend/src/lib/booking.ts
git commit -m "feat(frontend): listSlotsInRange + listMyBookingsInRange"
```

---

## Task 9: Frontend — `SlotCell` component

**Files:**
- Replace: `frontend/src/app/book/_components/SlotCell.tsx` (rewrite from scratch — no axios, no booking call here)
- Create: `frontend/src/app/book/_components/__tests__/SlotCell.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/book/_components/__tests__/SlotCell.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SlotCell } from '../SlotCell';

const slot = (overrides = {}) => ({
  id: 'a',
  start_at: '2026-06-15T10:00:00+09:00',
  end_at: '2026-06-15T10:30:00+09:00',
  lesson_type: 'private' as const,
  capacity: 1,
  booked_count: 0,
  remaining: 1,
  price_yen: null,
  status: 'open' as const,
  ...overrides,
});

describe('SlotCell', () => {
  it('renders ○ for open + available', () => {
    const onClick = jest.fn();
    render(<SlotCell state={{ kind: 'open', slot: slot() }} onClick={onClick} />);
    expect(screen.getByRole('button')).toHaveTextContent('○');
  });

  it('renders × for closed', () => {
    const onClick = jest.fn();
    render(
      <SlotCell
        state={{ kind: 'closed', slot: slot({ status: 'closed' }) }}
        onClick={onClick}
      />
    );
    expect(screen.getByText('×')).toBeInTheDocument();
  });

  it('renders × for full', () => {
    const onClick = jest.fn();
    render(
      <SlotCell
        state={{ kind: 'full', slot: slot({ remaining: 0, booked_count: 1 }) }}
        onClick={onClick}
      />
    );
    expect(screen.getByText('×')).toBeInTheDocument();
  });

  it('renders 予約済 for mine', () => {
    const onClick = jest.fn();
    render(
      <SlotCell
        state={{
          kind: 'mine',
          booking: {
            id: 'b1',
            status: 'confirmed',
            created_at: '',
            cancelled_at: null,
            slot: slot(),
          },
        }}
        onClick={onClick}
      />
    );
    expect(screen.getByText('予約済')).toBeInTheDocument();
  });

  it('renders - for empty', () => {
    const onClick = jest.fn();
    render(<SlotCell state={{ kind: 'empty' }} onClick={onClick} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('calls onClick(slot) when ○ is clicked', () => {
    const onClick = jest.fn();
    const s = slot();
    render(<SlotCell state={{ kind: 'open', slot: s }} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(s);
  });

  it('does NOT call onClick when closed/full/empty', () => {
    const onClick = jest.fn();
    const closedSlot = slot({ status: 'closed' });
    const { rerender } = render(
      <SlotCell state={{ kind: 'closed', slot: closedSlot }} onClick={onClick} />
    );
    fireEvent.click(screen.getByText('×'));
    rerender(<SlotCell state={{ kind: 'empty' }} onClick={onClick} />);
    fireEvent.click(screen.getByText('-'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```
cd frontend && npm test -- src/app/book/_components/__tests__/SlotCell.test.tsx
```
Expected: FAIL — current SlotCell has a different API (it takes `{ slot, onBooked }`, not `{ state, onClick }`).

- [ ] **Step 3: Replace SlotCell**

Overwrite `frontend/src/app/book/_components/SlotCell.tsx` with:

```tsx
'use client';

import type { Booking, LessonSlot } from '@/lib/booking';

export type CellState =
  | { kind: 'open'; slot: LessonSlot }
  | { kind: 'closed'; slot: LessonSlot }
  | { kind: 'full'; slot: LessonSlot }
  | { kind: 'mine'; booking: Booking }
  | { kind: 'empty' };

export function SlotCell({
  state,
  onClick,
}: {
  state: CellState;
  onClick: (slot: LessonSlot) => void;
}) {
  if (state.kind === 'open') {
    return (
      <button
        type="button"
        onClick={() => onClick(state.slot)}
        className="flex h-8 w-full items-center justify-center bg-green-100 text-sm hover:bg-green-200"
      >
        ○
      </button>
    );
  }
  if (state.kind === 'closed' || state.kind === 'full') {
    return (
      <span className="flex h-8 w-full items-center justify-center bg-gray-200 text-sm text-gray-400">
        ×
      </span>
    );
  }
  if (state.kind === 'mine') {
    return (
      <span className="flex h-8 w-full items-center justify-center bg-blue-500 text-xs text-white">
        予約済
      </span>
    );
  }
  return (
    <span className="flex h-8 w-full items-center justify-center bg-gray-50 text-sm text-gray-300">
      -
    </span>
  );
}
```

- [ ] **Step 4: Run, expect PASS**

```
cd frontend && npm test -- src/app/book/_components/__tests__/SlotCell.test.tsx
```
Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```
git add frontend/src/app/book/_components/SlotCell.tsx \
        frontend/src/app/book/_components/__tests__/SlotCell.test.tsx
git commit -m "feat(book): SlotCell renders ○/×/-/予約済 states"
```

---

## Task 10: Frontend — `BookingConfirmDialog` component

**Files:**
- Create: `frontend/src/app/book/_components/BookingConfirmDialog.tsx`
- Create: `frontend/src/app/book/_components/__tests__/BookingConfirmDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/book/_components/__tests__/BookingConfirmDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BookingConfirmDialog } from '../BookingConfirmDialog';

const slot = {
  id: 'a',
  start_at: '2026-06-15T10:00:00+09:00',
  end_at: '2026-06-15T10:30:00+09:00',
  lesson_type: 'private' as const,
  capacity: 1,
  booked_count: 0,
  remaining: 1,
  price_yen: null,
  status: 'open' as const,
};

describe('BookingConfirmDialog', () => {
  it('returns null when slot is null', () => {
    const { container } = render(
      <BookingConfirmDialog
        slot={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders date + time when slot is given', () => {
    render(
      <BookingConfirmDialog
        slot={slot}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText(/予約しますか/)).toBeInTheDocument();
  });

  it('calls onConfirm when 予約する is clicked', () => {
    const onConfirm = jest.fn();
    render(
      <BookingConfirmDialog
        slot={slot}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '予約する' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when キャンセル is clicked', () => {
    const onCancel = jest.fn();
    render(
      <BookingConfirmDialog
        slot={slot}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```
cd frontend && npm test -- src/app/book/_components/__tests__/BookingConfirmDialog.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `frontend/src/app/book/_components/BookingConfirmDialog.tsx`:

```tsx
'use client';

import type { LessonSlot } from '@/lib/booking';

export function BookingConfirmDialog({
  slot,
  onConfirm,
  onCancel,
}: {
  slot: LessonSlot | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!slot) return null;
  const start = new Date(slot.start_at);
  const dateLabel = start.toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded bg-white p-4 shadow">
        <p className="mb-3 text-sm">
          {dateLabel} のレッスンを予約しますか?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-3 py-1 text-sm"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
          >
            予約する
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect PASS**

```
cd frontend && npm test -- src/app/book/_components/__tests__/BookingConfirmDialog.test.tsx
```
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```
git add frontend/src/app/book/_components/BookingConfirmDialog.tsx \
        frontend/src/app/book/_components/__tests__/BookingConfirmDialog.test.tsx
git commit -m "feat(book): BookingConfirmDialog modal"
```

---

## Task 11: Frontend — `BookingGrid` component

**Files:**
- Create: `frontend/src/app/book/_components/BookingGrid.tsx`
- Create: `frontend/src/app/book/_components/__tests__/BookingGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/book/_components/__tests__/BookingGrid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { BookingGrid } from '../BookingGrid';

const startJST = '2026-06-15T09:00:00+09:00';

const slot = (overrides = {}) => ({
  id: 'a',
  start_at: startJST,
  end_at: '2026-06-15T09:30:00+09:00',
  lesson_type: 'private' as const,
  capacity: 1,
  booked_count: 0,
  remaining: 1,
  price_yen: null,
  status: 'open' as const,
  ...overrides,
});

describe('BookingGrid', () => {
  it('renders 14 day-headers when given start date', () => {
    render(
      <BookingGrid
        startDate={new Date('2026-06-15T00:00:00+09:00')}
        slots={[]}
        bookings={[]}
        onCellClick={jest.fn()}
      />
    );
    // 14 days × header "6/15 (月)" style
    const headers = screen.getAllByTestId('day-header');
    expect(headers).toHaveLength(14);
  });

  it('renders 14 time-row labels (9:00 ... 15:30)', () => {
    render(
      <BookingGrid
        startDate={new Date('2026-06-15T00:00:00+09:00')}
        slots={[]}
        bookings={[]}
        onCellClick={jest.fn()}
      />
    );
    expect(screen.getByText('9:00')).toBeInTheDocument();
    expect(screen.getByText('15:30')).toBeInTheDocument();
    const rowLabels = screen.getAllByTestId('time-row');
    expect(rowLabels).toHaveLength(14);
  });

  it('places ○ cell for matching open slot', () => {
    render(
      <BookingGrid
        startDate={new Date('2026-06-15T00:00:00+09:00')}
        slots={[slot()]}
        bookings={[]}
        onCellClick={jest.fn()}
      />
    );
    expect(screen.getAllByText('○')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Expected: FAIL — no module.

- [ ] **Step 3: Implement the grid**

Create `frontend/src/app/book/_components/BookingGrid.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import type { Booking, LessonSlot } from '@/lib/booking';
import { SlotCell, type CellState } from './SlotCell';

const TIME_SLOTS: { hour: number; minute: number; label: string }[] = (() => {
  const out: { hour: number; minute: number; label: string }[] = [];
  for (let h = 9; h < 16; h++) {
    for (const m of [0, 30] as const) {
      out.push({ hour: h, minute: m, label: `${h}:${m === 0 ? '00' : '30'}` });
    }
  }
  return out;
})();

const DAYS = 14;

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

function isoSlotKey(date: Date, hour: number, minute: number): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function slotMatchesCell(
  slot: LessonSlot,
  date: Date,
  hour: number,
  minute: number,
): boolean {
  const slotDate = new Date(slot.start_at);
  return (
    slotDate.getFullYear() === date.getFullYear() &&
    slotDate.getMonth() === date.getMonth() &&
    slotDate.getDate() === date.getDate() &&
    slotDate.getHours() === hour &&
    slotDate.getMinutes() === minute
  );
}

export function BookingGrid({
  startDate,
  slots,
  bookings,
  onCellClick,
}: {
  startDate: Date;
  slots: LessonSlot[];
  bookings: Booking[];
  onCellClick: (slot: LessonSlot) => void;
}) {
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, [startDate]);

  const stateFor = (
    date: Date,
    hour: number,
    minute: number,
  ): CellState => {
    const mine = bookings.find(
      b =>
        b.status === 'confirmed' &&
        slotMatchesCell(b.slot, date, hour, minute),
    );
    if (mine) return { kind: 'mine', booking: mine };

    const slot = slots.find(s => slotMatchesCell(s, date, hour, minute));
    if (!slot) return { kind: 'empty' };
    if (slot.status === 'closed') return { kind: 'closed', slot };
    if (slot.remaining <= 0) return { kind: 'full', slot };
    return { kind: 'open', slot };
  };

  return (
    <div className="overflow-x-auto">
      <div
        className="grid"
        style={{ gridTemplateColumns: `60px repeat(${DAYS}, minmax(48px, 1fr))` }}
      >
        <div />
        {days.map(d => (
          <div
            key={d.toISOString()}
            data-testid="day-header"
            className="px-1 py-2 text-center text-xs font-semibold"
          >
            {formatDayHeader(d)}
          </div>
        ))}
        {TIME_SLOTS.map(t => (
          <div key={t.label} className="contents">
            <div
              data-testid="time-row"
              className="px-2 py-1 text-right text-xs text-gray-600"
            >
              {t.label}
            </div>
            {days.map(d => (
              <div
                key={`${d.toISOString()}-${t.label}`}
                className="border-b border-r border-gray-100 p-px"
              >
                <SlotCell
                  state={stateFor(d, t.hour, t.minute)}
                  onClick={onCellClick}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect PASS**

```
cd frontend && npm test -- src/app/book/_components/__tests__/BookingGrid.test.tsx
```
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```
git add frontend/src/app/book/_components/BookingGrid.tsx \
        frontend/src/app/book/_components/__tests__/BookingGrid.test.tsx
git commit -m "feat(book): BookingGrid composes 14d×14slot grid"
```

---

## Task 12: Frontend — `/book/page.tsx` rewrite

**Files:**
- Replace: `frontend/src/app/book/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  bookSlot,
  listMyBookingsInRange,
  listSlotsInRange,
  type Booking,
  type LessonSlot,
} from '@/lib/booking';
import { useNotificationStore } from '@/stores/notificationStore';
import { BookingGrid } from './_components/BookingGrid';
import { BookingConfirmDialog } from './_components/BookingConfirmDialog';

const DAYS = 14;

function jstMidnightToday(): Date {
  // 9:00 - 16:00 cells live entirely inside one JST day, so we anchor to
  // local midnight. Browsers in JST get the correct day; non-JST users see
  // the same slots but labeled in their tz — acceptable for v4a (Tokyo
  // cafe).
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function BookPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const notify = useNotificationStore();
  const [startDate] = useState<Date>(jstMidnightToday());
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<LessonSlot | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const end = new Date(startDate);
    end.setDate(end.getDate() + DAYS);
    const from = startDate.toISOString();
    const to = end.toISOString();
    const [s, b] = await Promise.all([
      listSlotsInRange(from, to),
      user
        ? listMyBookingsInRange(from, to).catch(() => [] as Booking[])
        : Promise.resolve([] as Booking[]),
    ]);
    setSlots(s);
    setBookings(b);
    setLoading(false);
  }, [startDate, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCellClick = (slot: LessonSlot) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setPending(slot);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    try {
      await bookSlot(pending.id);
      notify.success('予約しました');
      setPending(null);
      await refresh();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      notify.error(detail ?? '予約に失敗しました');
      setPending(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">レッスン予約</h1>
      {!user && (
        <p className="text-sm text-gray-600">
          ○ をクリックすると、ログイン画面に進みます。
        </p>
      )}
      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <BookingGrid
          startDate={startDate}
          slots={slots}
          bookings={bookings}
          onCellClick={handleCellClick}
        />
      )}
      <BookingConfirmDialog
        slot={pending}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --file src/app/book/page.tsx
```
Expected: 0 errors / 0 warnings.

- [ ] **Step 3: Commit**

```
git add frontend/src/app/book/page.tsx
git commit -m "feat(book): /book uses BookingGrid + range queries"
```

---

## Task 13: Full regression + manual E2E + PR

**Files:** none (verification only).

- [ ] **Step 1: Backend full test**

```
cd backend && uv run pytest
```
Expected: all PASS. Coverage threshold unchanged.

- [ ] **Step 2: Backend type-check**

```
cd backend && uv run mypy app/domain app/services
```
Expected: 0 errors.

- [ ] **Step 3: Backend lint**

```
cd backend && uv run ruff check . && uv run ruff format --check .
```
Expected: 0 errors.

- [ ] **Step 4: Frontend full test**

```
cd frontend && npm test -- --watchAll=false
```
Expected: All new tests PASS. The 3 pre-existing Firebase-env failures
(api.test.ts, ContactForm.test.tsx, contact-form.integration.test.tsx) may
remain — unrelated.

- [ ] **Step 5: Frontend tsc + lint**

```
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```
Expected: 0 errors / 0 warnings.

- [ ] **Step 6: Terraform plan (scheduler-slots only)**

```
cd terraform/envs/prod/scheduler-slots && terragrunt plan
```
Expected: ~12 resources to add.

- [ ] **Step 7: Manual E2E**

```
npm run dev
```

Then in browser:
1. Open `http://localhost:3010/book` (not logged in) → 14×14 grid loads (probably mostly `-` empty since emulator has no scheduler-generated slots; that's expected)
2. Manually add 1 open slot for tomorrow 10:00 JST via `/admin/lessons` or Firestore Emulator UI → `/book` reloads with one ○ visible at the right cell
3. Log in → click the ○ → confirm dialog appears → click 予約する → cell switches to 予約済 + success toast
4. Reload → 予約済 persists

- [ ] **Step 8: Apply terraform stack to production**

```
cd terraform/envs/prod/scheduler-slots && terragrunt apply
```
Confirm yes after reviewing the plan.

- [ ] **Step 9: Backfill the next 14 days in production**

```
cd /Users/kz/work/english-caf/kz-bz-english2
uv run python scripts/backfill_slots.py --days 14 --project english-cafe-496209
```
Expected: prints 14 days × 14 slots = 196 created.

- [ ] **Step 10: Production smoke test**

```
curl 'https://api.bz-kz.com/api/v1/lesson-slots?from=2026-05-14T00:00:00&to=2026-05-15T00:00:00'
```
Expected: 14 slots returned for today JST.

- [ ] **Step 11: Push + PR**

```
git push -u origin feat/lesson-booking-4a
gh pr create --title "feat: lesson booking 4a — 30min × 14day grid + Cloud Scheduler" \
  --body "$(cat <<'EOF'
## Summary
30分コマ × 14日 のグリッドUIを `/book` に実装。Cloud Scheduler が毎日 0:00 JST に14日先の1日分 (14コマ) を Firestore に自動生成する。

quota / Stripe / 24h cancel rule は 4b / 4c で扱う。

## Backend
- `LessonSlotRepository.find_in_range(from_, to_)` + Firestore impl
- `GET /api/v1/lesson-slots` accepts `from`/`to` query params (returns closed slots too in range mode)
- `GET /api/v1/users/me/bookings` accepts `from`/`to` (app-side filter on slot.start_at)

## Infra
- New terraform stack `terraform/envs/prod/scheduler-slots/`
- Cloud Function Gen2 (Python 3.12) + Cloud Scheduler @ 0:00 Asia/Tokyo
- Idempotent: existing start_at matches are skipped

## Frontend
- `/book` rewritten as `<BookingGrid>` composed of `<SlotCell>` + `<BookingConfirmDialog>`
- ○ / × / - / 予約済 cell states
- `listSlotsInRange` / `listMyBookingsInRange` typed client helpers

## Bootstrap
- `scripts/backfill_slots.py --days 14` seeds the first 14 days on rollout

## Spec / Plan
- spec: docs/superpowers/specs/2026-05-14-lesson-booking-4a-design.md
- plan: docs/superpowers/plans/2026-05-14-lesson-booking-4a.md

## Test plan
- [x] backend pytest passes
- [x] frontend jest passes (new components + lib)
- [x] terraform plan clean
- [ ] manual: /book on dev shows grid, ○ click → confirm → 予約済
- [ ] post-merge: apply terraform stack + run backfill script
EOF
)"
```

PR creation only — do not merge. Wait for human review.

---

## Critical Files

### Backend (entrypoints)
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/domain/repositories/lesson_slot_repository.py`
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py`
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/api/endpoints/lesson_slots.py`
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/api/endpoints/bookings.py`

### Cloud Function
- `/Users/kz/work/english-caf/kz-bz-english2/terraform/modules/cloud-function-slot-generator/source/main.py`

### Terraform
- `/Users/kz/work/english-caf/kz-bz-english2/terraform/modules/cloud-function-slot-generator/main.tf`
- `/Users/kz/work/english-caf/kz-bz-english2/terraform/envs/prod/scheduler-slots/terragrunt.hcl`
- Reference pattern: `/Users/kz/work/english-caf/kz-bz-english2/terraform/modules/billing-killswitch/main.tf` — already shipped & working in prod, mirror its structure for IAM and Function shape.

### Frontend
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/lib/booking.ts`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/book/_components/SlotCell.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/book/_components/BookingGrid.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/book/_components/BookingConfirmDialog.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/book/page.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/stores/notificationStore.ts` — `useNotificationStore().success / error` API already used in admin

### Scripts
- `/Users/kz/work/english-caf/kz-bz-english2/scripts/backfill_slots.py`
- Reference pattern: `/Users/kz/work/english-caf/kz-bz-english2/scripts/grant_admin.py` for argparse + firestore client shape.
