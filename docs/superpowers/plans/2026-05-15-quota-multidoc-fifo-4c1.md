# Quota Multi-Doc + FIFO (Sub-project 4c-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `monthly_quota` from one-doc-per-user-per-month to multiple docs per user, each valid 2 months, consumed FIFO — with zero Stripe code.

**Architecture:** New doc-id `{uid}_{granted_at:%Y%m%d%H%M%S%f}`. `MonthlyQuotaRepository` gains `find_active_for_user` (single equality query + Python filter/sort, no composite index) and `find_by_doc_id`. `BookingService` book/cancel/admin_force_* read the FIFO set inside the existing Firestore async transactions and record `Booking.consumed_quota_doc_id` for exact refund. 4b Cloud Function + a one-shot backfill migrate existing docs to the new scheme.

**Tech Stack:** FastAPI + Firestore AsyncClient + Python 3.12 (uv) + Next.js 14 + jest. Cloud Function Gen2 (separate `terraform/modules/cloud-function-monthly-quota-grant/source`, no backend import).

**Spec:** [`docs/superpowers/specs/2026-05-15-stripe-integration-design.md`](../specs/2026-05-15-stripe-integration-design.md) — sub-project 4c-1 section.

---

## File Structure

### Backend — new
- `backend/app/domain/services/quota_expiry.py` — pure `add_two_months(dt)` helper (domain, no I/O)
- `backend/tests/domain/test_quota_expiry.py`
- `backend/tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py` (extend if exists)

### Backend — modified
- `backend/app/domain/repositories/monthly_quota_repository.py` — add `find_active_for_user`, `find_by_doc_id`; deprecate `find`
- `backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py` — new doc-id scheme + new methods
- `backend/app/domain/entities/booking.py` — add `consumed_quota_doc_id`
- `backend/app/infrastructure/repositories/firestore_booking_repository.py` — map new field
- `backend/app/services/booking_service.py` — FIFO rewrite of book/cancel/admin_force_book/admin_force_cancel
- `backend/app/api/schemas/user.py` — replace `current_month_quota` with `quota_summary`
- `backend/app/api/endpoints/users.py` — aggregate active quota
- `backend/tests/services/test_booking_service.py`, `backend/tests/services/test_booking_service_admin.py` — extend

### Frontend — modified
- `frontend/src/lib/booking.ts` — `MeResponse.quota_summary`
- `frontend/src/app/mypage/_components/ProfileCard.tsx` — render aggregate
- `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx` (extend if exists)

### Terraform / scripts
- `terraform/modules/cloud-function-monthly-quota-grant/source/main.py` — new doc-id + 2mo expiry + monthly idempotency
- `terraform/modules/cloud-function-monthly-quota-grant/source/test_main.py` — extend
- `scripts/migrate_quota_to_multidoc.py` — one-shot backfill (new file)

---

## Task 1: `add_two_months` domain helper

**Files:**
- Create: `backend/app/domain/services/quota_expiry.py`
- Test: `backend/tests/domain/test_quota_expiry.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/domain/test_quota_expiry.py`:

```python
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from app.domain.services.quota_expiry import add_two_months

JST = ZoneInfo("Asia/Tokyo")


def test_normal_month():
    assert add_two_months(datetime(2026, 5, 15, 12, 0, tzinfo=JST)) == datetime(
        2026, 7, 15, 12, 0, tzinfo=JST
    )


def test_jan_31_to_mar_31():
    assert add_two_months(datetime(2026, 1, 31, tzinfo=JST)) == datetime(
        2026, 3, 31, tzinfo=JST
    )


def test_dec_31_crosses_year_to_feb_28():
    assert add_two_months(datetime(2026, 12, 31, tzinfo=JST)) == datetime(
        2027, 2, 28, tzinfo=JST
    )


def test_nov_30_to_jan_30_next_year():
    assert add_two_months(datetime(2026, 11, 30, tzinfo=JST)) == datetime(
        2027, 1, 30, tzinfo=JST
    )


def test_preserves_tzinfo_utc():
    out = add_two_months(datetime(2026, 5, 15, 3, 0, tzinfo=UTC))
    assert out.tzinfo == UTC
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/domain/test_quota_expiry.py -v`
Expected: FAIL — `ModuleNotFoundError: app.domain.services.quota_expiry`

- [ ] **Step 3: Implement**

Create `backend/app/domain/services/quota_expiry.py`:

```python
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
```

(If `backend/app/domain/services/` lacks `__init__.py`, create an empty one.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/domain/test_quota_expiry.py -v`
Expected: 5 passed.

- [ ] **Step 5: Ruff + mypy**

Run: `cd backend && uv run ruff check app/domain/services/quota_expiry.py tests/domain/test_quota_expiry.py && uv run mypy app/domain`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/domain/services/quota_expiry.py backend/tests/domain/test_quota_expiry.py
git commit -m "feat(quota): add_two_months expiry helper (domain, pure)"
```

---

## Task 2: MonthlyQuota repo — new doc-id + `find_active_for_user` + `find_by_doc_id`

**Files:**
- Modify: `backend/app/domain/repositories/monthly_quota_repository.py`
- Modify: `backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py`
- Test: `backend/tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py`

- [ ] **Step 1: Write the failing tests**

Append to (create if absent) `backend/tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py`:

```python
import os
from datetime import UTC, datetime, timedelta

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.monthly_quota import MonthlyQuota
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)


def _q(uid, granted_at, granted=4, used=0, expires_at=None):
    return MonthlyQuota(
        user_id=uid,
        year_month=granted_at.astimezone().strftime("%Y-%m"),
        plan_at_grant="light",
        granted=granted,
        used=used,
        granted_at=granted_at,
        expires_at=expires_at or (granted_at + timedelta(days=60)),
    )


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for d in client.collection("monthly_quota").stream():
        await d.reference.delete()
    return FirestoreMonthlyQuotaRepository(client)


async def test_save_uses_granted_at_doc_id(repo):
    ga = datetime(2026, 5, 15, 9, 0, 0, 123456, tzinfo=UTC)
    q = _q("u1", ga)
    await repo.save(q)
    found = await repo.find_by_doc_id(f"u1_{ga.strftime('%Y%m%d%H%M%S%f')}")
    assert found is not None
    assert found.user_id == "u1"


async def test_find_active_excludes_expired(repo):
    now = datetime(2026, 5, 15, tzinfo=UTC)
    await repo.save(_q("u1", now - timedelta(days=90),
                       expires_at=now - timedelta(days=1)))  # expired
    await repo.save(_q("u1", now - timedelta(days=10),
                       expires_at=now + timedelta(days=50)))  # active
    active = await repo.find_active_for_user("u1", now)
    assert len(active) == 1


async def test_find_active_excludes_exhausted(repo):
    now = datetime(2026, 5, 15, tzinfo=UTC)
    await repo.save(_q("u1", now - timedelta(days=5), granted=4, used=4,
                       expires_at=now + timedelta(days=55)))
    assert await repo.find_active_for_user("u1", now) == []


async def test_find_active_sorted_fifo(repo):
    now = datetime(2026, 5, 15, tzinfo=UTC)
    await repo.save(_q("u1", now - timedelta(days=2),
                       expires_at=now + timedelta(days=58)))
    await repo.save(_q("u1", now - timedelta(days=20),
                       expires_at=now + timedelta(days=40)))
    active = await repo.find_active_for_user("u1", now)
    assert active[0].granted_at < active[1].granted_at  # oldest first
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py -v -k "active or doc_id"`
Expected: FAIL — `AttributeError: ... 'find_active_for_user'`

- [ ] **Step 3: Update interface**

Replace `backend/app/domain/repositories/monthly_quota_repository.py`:

```python
"""MonthlyQuotaRepository interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime

from app.domain.entities.monthly_quota import MonthlyQuota


class MonthlyQuotaRepository(ABC):
    @abstractmethod
    async def save(self, quota: MonthlyQuota) -> MonthlyQuota:
        ...

    @abstractmethod
    async def find(self, user_id: str, year_month: str) -> MonthlyQuota | None:
        """DEPRECATED (single-doc legacy). Removed before sub-project 4c-2."""
        ...

    @abstractmethod
    async def find_active_for_user(
        self, user_id: str, at: datetime
    ) -> list[MonthlyQuota]:
        """Non-expired, non-exhausted quota docs, granted_at ASC (FIFO)."""
        ...

    @abstractmethod
    async def find_by_doc_id(self, doc_id: str) -> MonthlyQuota | None:
        ...
```

- [ ] **Step 4: Implement Firestore methods**

Replace `backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py`:

```python
"""Firestore impl of MonthlyQuotaRepository."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.domain.entities.monthly_quota import MonthlyQuota
from app.domain.repositories.monthly_quota_repository import MonthlyQuotaRepository

_COLLECTION = "monthly_quota"


def _doc_id(user_id: str, granted_at: datetime) -> str:
    return f"{user_id}_{granted_at.strftime('%Y%m%d%H%M%S%f')}"


class FirestoreMonthlyQuotaRepository(MonthlyQuotaRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def save(self, quota: MonthlyQuota) -> MonthlyQuota:
        await self._collection.document(
            _doc_id(quota.user_id, quota.granted_at)
        ).set(self._to_dict(quota))
        return quota

    async def find(self, user_id: str, year_month: str) -> MonthlyQuota | None:
        doc = await self._collection.document(f"{user_id}_{year_month}").get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict())

    async def find_active_for_user(
        self, user_id: str, at: datetime
    ) -> list[MonthlyQuota]:
        # Single equality filter — no composite index needed. Per-user doc
        # count is tiny; filter + sort in Python.
        out: list[MonthlyQuota] = []
        query = self._collection.where("user_id", "==", user_id)
        async for doc in query.stream():
            q = self._from_dict(doc.to_dict())
            if q.expires_at > at and q.used < q.granted:
                out.append(q)
        out.sort(key=lambda q: q.granted_at)
        return out

    async def find_by_doc_id(self, doc_id: str) -> MonthlyQuota | None:
        doc = await self._collection.document(doc_id).get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict())

    @staticmethod
    def _to_dict(q: MonthlyQuota) -> dict[str, Any]:
        return {
            "user_id": q.user_id,
            "year_month": q.year_month,
            "plan_at_grant": q.plan_at_grant,
            "granted": q.granted,
            "used": q.used,
            "granted_at": q.granted_at,
            "expires_at": q.expires_at,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None) -> MonthlyQuota:
        assert data is not None
        return MonthlyQuota(
            user_id=data["user_id"],
            year_month=data["year_month"],
            plan_at_grant=data["plan_at_grant"],
            granted=int(data["granted"]),
            used=int(data["used"]),
            granted_at=data["granted_at"],
            expires_at=data["expires_at"],
        )
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py -v`
Expected: all green (new tests + existing).

- [ ] **Step 6: Ruff + mypy**

Run: `cd backend && uv run ruff check app/domain/repositories/monthly_quota_repository.py app/infrastructure/repositories/firestore_monthly_quota_repository.py && uv run mypy app/domain app/services`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add backend/app/domain/repositories/monthly_quota_repository.py \
        backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py \
        backend/tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py
git commit -m "feat(quota): granted_at doc-id + find_active_for_user/find_by_doc_id"
```

> ⚠️ **KNOWN BREAKAGE introduced here, fixed in Task 4/5:** After this task, `save()` writes the new `{uid}_{granted_at:%f}` id but legacy `find(uid, ym)` reads `{uid}_{ym}` → returns `None`. Existing tests in `backend/tests/services/test_booking_service.py` that assert via `quota_repo.find(user.uid, ym)` will FAIL at this point: `test_book_increments_used_in_quota` (line 241), `test_cancel_within_24h_rejected_and_quota_unchanged` (line 297), `test_cancel_more_than_24h_refunds_quota` (line 309), `test_cancel_trial_does_not_touch_quota` (line 322). This is expected — do NOT run the full `test_booking_service.py` green-gate until Task 5 completes. Run only the repo test (Step 5) to gate this task.

---

## Task 3: `Booking.consumed_quota_doc_id`

**Files:**
- Modify: `backend/app/domain/entities/booking.py`
- Modify: `backend/app/infrastructure/repositories/firestore_booking_repository.py`
- Test: `backend/tests/infrastructure/repositories/test_firestore_booking_repository.py` (extend if exists)

- [ ] **Step 1: Write the failing test**

Append to (create if absent) `backend/tests/infrastructure/repositories/test_firestore_booking_repository.py`:

```python
import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.booking import Booking
from app.domain.enums.lesson_booking import BookingStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)


@pytest.fixture
async def brepo():
    client = fs.AsyncClient(project="test-project")
    async for d in client.collection("bookings").stream():
        await d.reference.delete()
    return FirestoreBookingRepository(client)


async def test_consumed_quota_doc_id_roundtrip(brepo):
    b = Booking(
        id=uuid4(),
        slot_id="s1",
        user_id="u1",
        status=BookingStatus.CONFIRMED,
        created_at=datetime.now(UTC),
        cancelled_at=None,
        consumed_quota_doc_id="u1_20260515090000123456",
    )
    await brepo.save(b)
    got = await brepo.find_by_id(b.id)
    assert got is not None
    assert got.consumed_quota_doc_id == "u1_20260515090000123456"


async def test_missing_consumed_quota_doc_id_defaults_none(brepo):
    b = Booking(
        id=uuid4(),
        slot_id="s1",
        user_id="u1",
        status=BookingStatus.CONFIRMED,
        created_at=datetime.now(UTC),
        cancelled_at=None,
    )
    await brepo.save(b)
    got = await brepo.find_by_id(b.id)
    assert got is not None and got.consumed_quota_doc_id is None
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_booking_repository.py -v -k consumed`
Expected: FAIL — `TypeError: ... unexpected keyword argument 'consumed_quota_doc_id'`

- [ ] **Step 3: Add entity field**

Edit `backend/app/domain/entities/booking.py` — add field after `cancelled_at`:

```python
@dataclass
class Booking:
    id: UUID
    slot_id: str
    user_id: str
    status: BookingStatus
    created_at: datetime
    cancelled_at: datetime | None
    consumed_quota_doc_id: str | None = None

    def __post_init__(self) -> None:
        if not self.slot_id:
            raise ValueError("slot_id is required")
        if not self.user_id:
            raise ValueError("user_id is required")
```

- [ ] **Step 4: Map in repository**

Edit `backend/app/infrastructure/repositories/firestore_booking_repository.py` `_to_dict` and `_from_dict`:

```python
    @staticmethod
    def _to_dict(booking: Booking) -> dict[str, Any]:
        return {
            "id": str(booking.id),
            "slot_id": booking.slot_id,
            "user_id": booking.user_id,
            "status": booking.status.value,
            "created_at": booking.created_at,
            "cancelled_at": booking.cancelled_at,
            "consumed_quota_doc_id": booking.consumed_quota_doc_id,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None, doc_id: str) -> Booking:
        assert data is not None
        return Booking(
            id=UUID(doc_id),
            slot_id=data["slot_id"],
            user_id=data["user_id"],
            status=BookingStatus(data["status"]),
            created_at=data["created_at"],
            cancelled_at=data.get("cancelled_at"),
            consumed_quota_doc_id=data.get("consumed_quota_doc_id"),
        )
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_booking_repository.py -v -k consumed`
Expected: 2 passed.

- [ ] **Step 6: Ruff + mypy + commit**

Run: `cd backend && uv run ruff check app/domain/entities/booking.py app/infrastructure/repositories/firestore_booking_repository.py && uv run mypy app/domain`
Expected: clean.

```bash
git add backend/app/domain/entities/booking.py \
        backend/app/infrastructure/repositories/firestore_booking_repository.py \
        backend/tests/infrastructure/repositories/test_firestore_booking_repository.py
git commit -m "feat(booking): add consumed_quota_doc_id field (FIFO refund key)"
```

---

## Task 4: `BookingService.book` FIFO rewrite

**Files:**
- Modify: `backend/app/services/booking_service.py`
- Test: `backend/tests/services/test_booking_service.py`

Context: current `book` (non-trial branch) reads `monthly_quota/{uid}_{ym}` single doc and does `used += 1`. Replace with: stream `where user_id == uid` inside the txn read phase, pick oldest non-expired non-exhausted, increment it, set `booking.consumed_quota_doc_id`.

- [ ] **Step 1: Rewrite the 4 legacy-`find()` assertions FIRST**

These existing tests in `backend/tests/services/test_booking_service.py` assert via `quota_repo.find(user.uid, ym)` which now returns `None`. Rewrite each assertion to read the consumed doc instead. Helpers in the file: `_persist_user`, `_quota(user_id=..., granted=..., used=...)`, `_slot(start_offset_hours=...)`, `FirestoreLessonSlotRepository(service._fs)`.

`test_book_increments_used_in_quota` (lines 234-242) — replace lines 240-242:
```python
    assert booking.consumed_quota_doc_id is not None
    q = await quota_repo.find_by_doc_id(booking.consumed_quota_doc_id)
    assert q is not None and q.used == 1
```
(capture `booking = await service.book(...)` on line 239 — it currently discards the return; assign it.)

`test_cancel_within_24h_rejected_and_quota_unchanged` (lines 283-298) — replace lines 296-298:
```python
    q = await quota_repo.find_by_doc_id(booking.consumed_quota_doc_id)
    assert q is not None and q.used == 1  # quota stays consumed
```

`test_cancel_more_than_24h_refunds_quota` (lines 301-310) — replace lines 308-310:
```python
    q = await quota_repo.find_by_doc_id(booking.consumed_quota_doc_id)
    assert q is not None and q.used == 0
```

`test_cancel_trial_does_not_touch_quota` (lines 313-323) — trial never consumes quota, so `booking.consumed_quota_doc_id is None`. Replace lines 321-323:
```python
    assert booking.consumed_quota_doc_id is None  # trial path never touches quota
```

`test_book_rejects_when_no_quota_row` (245-250) and `test_book_rejects_when_quota_exhausted` (253-259) use `pytest.raises` only — **leave unchanged**. With the FIFO impl: no docs → `NoActiveQuotaError` (matches), `_quota(granted=4, used=4)` exists but exhausted → `QuotaExhaustedError` (matches).

- [ ] **Step 2: Add the new FIFO scenario tests**

Append to `backend/tests/services/test_booking_service.py` (use the file's `_persist_user`/`_quota`/`_slot` helpers + `quota_repo` fixture; `_quota` signature is `_quota(user_id, granted=4, used=0, granted_at=?, expires_at=?)` — check its definition near the top of the file and pass `granted_at`/`expires_at` explicitly for the two-doc test):

```python
async def test_book_fifo_consumes_oldest(service, quota_repo, user_repo):
    from datetime import UTC, datetime, timedelta
    user = await _persist_user(user_repo, uid="u-fifo", plan=Plan.LIGHT)
    now = datetime.now(UTC)
    older = _quota(user_id=user.uid, granted=4, used=0)
    older.granted_at = now - timedelta(days=20)
    older.expires_at = now + timedelta(days=40)
    newer = _quota(user_id=user.uid, granted=4, used=0)
    newer.granted_at = now - timedelta(days=2)
    newer.expires_at = now + timedelta(days=58)
    await quota_repo.save(older)
    await quota_repo.save(newer)
    slot = _slot()
    await FirestoreLessonSlotRepository(service._fs).save(slot)
    booking = await service.book(user=user, slot_id=str(slot.id))
    expected = f"{user.uid}_{older.granted_at.strftime('%Y%m%d%H%M%S%f')}"
    assert booking.consumed_quota_doc_id == expected
    refreshed = await quota_repo.find_by_doc_id(expected)
    assert refreshed is not None and refreshed.used == 1


async def test_book_skips_expired_quota_raises_exhausted(
    service, quota_repo, user_repo
):
    from datetime import UTC, datetime, timedelta
    user = await _persist_user(user_repo, uid="u-exp", plan=Plan.LIGHT)
    now = datetime.now(UTC)
    expired = _quota(user_id=user.uid, granted=4, used=0)
    expired.granted_at = now - timedelta(days=90)
    expired.expires_at = now - timedelta(days=1)
    await quota_repo.save(expired)
    slot = _slot()
    await FirestoreLessonSlotRepository(service._fs).save(slot)
    with pytest.raises(QuotaExhaustedError):
        await service.book(user=user, slot_id=str(slot.id))
```

> If `_quota` doesn't expose `granted_at`/`expires_at` as mutable attributes (it returns a `MonthlyQuota` dataclass — it does), set them after construction as shown.

- [ ] **Step 3: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service.py -v -k "fifo or skips_expired"`
Expected: FAIL (still decrements legacy single doc / `consumed_quota_doc_id` is None).

- [ ] **Step 4: Rewrite the non-trial quota block in `book`**

In `backend/app/services/booking_service.py` `book`, replace the non-trial branch (currently the `else:` computing `year_month` + `quota_ref` + `used+1`) with a FIFO scan. Inside the `@fs.async_transactional txn`, after the trial `if`:

```python
            else:
                quota_docs: list[tuple[Any, dict[str, Any]]] = []
                q = self._fs.collection("monthly_quota").where(
                    "user_id", "==", user.uid
                )
                async for qd in q.stream(transaction=tx):
                    quota_docs.append((qd.reference, cast(dict[str, Any], qd.to_dict())))
                now = _utc_now()
                active = [
                    (ref, d)
                    for ref, d in quota_docs
                    if d["expires_at"] > now and int(d["used"]) < int(d["granted"])
                ]
                if not quota_docs:
                    raise NoActiveQuotaError(user.uid)
                if not active:
                    raise QuotaExhaustedError(user.uid)
                active.sort(key=lambda rd: rd[1]["granted_at"])
                chosen_ref, chosen = active[0]
                consumed_doc_id = chosen_ref.id
                tx.update(chosen_ref, {"used": int(chosen["used"]) + 1})
```

Then where the `Booking(...)` is constructed in `book`, pass `consumed_quota_doc_id`:

```python
            booking = Booking(
                id=new_booking_id,
                slot_id=slot_id,
                user_id=user.uid,
                status=BookingStatus.CONFIRMED,
                created_at=_utc_now(),
                cancelled_at=None,
                consumed_quota_doc_id=(
                    None if slot.lesson_type == LessonType.TRIAL else consumed_doc_id
                ),
            )
```

Initialize `consumed_doc_id: str | None = None` immediately before the `if slot.lesson_type == LessonType.TRIAL:` so the trial branch leaves it `None`.

> **Intentional duplication note (do not "fix"):** the in-transaction FIFO scan here duplicates the `expires_at > now and used < granted` + `granted_at` sort predicate that `find_active_for_user` (Task 2) also implements. This is deliberate: `find_active_for_user` is NOT transaction-aware (no `transaction=` param), and the booking decrement MUST happen inside the Firestore async transaction for race-safety. Keep both; if the predicate changes, change both.

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service.py -v`
Expected: all green — the 4 rewritten assertions (Step 1) + 2 new FIFO tests (Step 2) + all untouched book tests. `cancel`-refund tests still fail until Task 5 (they call `service.cancel` whose refund still uses the legacy ref) — specifically `test_cancel_more_than_24h_refunds_quota` and `test_cancel_trial_does_not_touch_quota` may still fail here; that is expected, Task 5 closes them. Gate THIS task on: `-k "fifo or skips_expired or test_book_increments_used or rejects_when"` all green.

- [ ] **Step 6: Ruff + mypy + commit**

Run: `cd backend && uv run ruff check app/services/booking_service.py tests/services/test_booking_service.py && uv run mypy app/services`
Expected: clean.

```bash
git add backend/app/services/booking_service.py backend/tests/services/test_booking_service.py
git commit -m "feat(booking): book() consumes quota FIFO across active docs"
```

---

## Task 5: `cancel` + `admin_force_cancel` refund via `consumed_quota_doc_id`

**Files:**
- Modify: `backend/app/services/booking_service.py`
- Test: `backend/tests/services/test_booking_service.py`, `backend/tests/services/test_booking_service_admin.py`

- [ ] **Step 1: Write failing tests**

Append to `backend/tests/services/test_booking_service.py`:

```python
async def test_cancel_refunds_consumed_quota_doc(service, firestore_client):
    # book consumes a doc, cancel must increment that exact doc back
    ...  # use file helpers: seed quota, book, cancel, assert qrepo.find_by_doc_id(...).used == 0


async def test_cancel_pre4c_booking_without_consumed_id_skips_refund(
    service, firestore_client
):
    # craft a Booking saved with consumed_quota_doc_id=None, cancel must
    # not raise and must not touch any quota doc
    ...
```

Append to `backend/tests/services/test_booking_service_admin.py`:

```python
async def test_admin_force_cancel_refund_uses_consumed_doc(service, firestore_client):
    # admin_force_book(consume_quota=True) records consumed id;
    # admin_force_cancel(refund_quota=True) increments that doc back
    ...
```

(Implementer: flesh out with the file's existing helper functions, same style as sibling tests.)

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service.py tests/services/test_booking_service_admin.py -v -k "consumed or pre4c or refund_uses"`
Expected: FAIL (cancel still computes `{uid}_{ym}` legacy ref).

- [ ] **Step 3: Rewrite refund in `cancel` and `admin_force_cancel`**

In `cancel`: replace the quota-refund read/write (currently `_jst_year_month(booking.created_at)` → `quota_col.document(f"{uid}_{ym}")`) with: read `booking.consumed_quota_doc_id`; if `None` skip refund entirely; else in read phase `await quota_col.document(booking.consumed_quota_doc_id).get(transaction=tx)`, in write phase `tx.update(ref, {"used": max(0, used - 1)})`. Keep all reads before writes.

```python
            quota_ref = None
            current_used: int | None = None
            if booking.consumed_quota_doc_id:
                quota_ref = quota_col.document(booking.consumed_quota_doc_id)
                q_snap = await quota_ref.get(transaction=tx)
                if q_snap.exists:
                    current_used = int(
                        cast(dict[str, Any], q_snap.to_dict())["used"]
                    )
            # ... write phase:
            if quota_ref is not None and current_used is not None:
                tx.update(quota_ref, {"used": max(0, current_used - 1)})
```

Apply the identical pattern in `admin_force_cancel` (gated by its existing `refund_quota` flag AND non-trial); trial refund path (`refund_trial` → `users.trial_used=False`) is unchanged.

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service.py tests/services/test_booking_service_admin.py -v`
Expected: all green.

- [ ] **Step 5: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/services tests/services && uv run mypy app/services
git add backend/app/services/booking_service.py backend/tests/services/test_booking_service.py backend/tests/services/test_booking_service_admin.py
git commit -m "feat(booking): cancel/admin_force_cancel refund the exact consumed quota doc"
```

---

## Task 6: `admin_force_book` FIFO path

**Files:**
- Modify: `backend/app/services/booking_service.py`
- Test: `backend/tests/services/test_booking_service_admin.py`

- [ ] **Step 1: Write failing tests**

Append to `backend/tests/services/test_booking_service_admin.py`:

```python
async def test_admin_force_book_consume_quota_fifo(service, firestore_client):
    # two active docs; admin_force_book(consume_quota=True) decrements oldest
    # and records consumed_quota_doc_id
    ...

async def test_admin_force_book_consume_quota_no_docs_warns_and_succeeds(
    service, firestore_client
):
    # no quota docs: booking still succeeds, consumed_quota_doc_id is None
    ...
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service_admin.py -v -k "force_book_consume"`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `admin_force_book`, replace the `consume_quota` legacy `{uid}_{ym}` block with the same FIFO scan as Task 4, but: when `consume_quota=True` and **no quota docs at all OR none active**, log `logger.warning(...)` and proceed (booking succeeds, `consumed_quota_doc_id=None`) — do NOT raise (4d contract). Add at top of file if absent:

```python
import logging
logger = logging.getLogger(__name__)
```

Set `booking.consumed_quota_doc_id` to the chosen doc id when a decrement happened, else `None`.

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service_admin.py -v`
Expected: all green.

- [ ] **Step 5: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/services tests/services && uv run mypy app/services
git add backend/app/services/booking_service.py backend/tests/services/test_booking_service_admin.py
git commit -m "feat(booking): admin_force_book consume_quota uses FIFO, warns when none"
```

---

## Task 7: `/users/me` → `quota_summary`

**Files:**
- Modify: `backend/app/api/schemas/user.py`
- Modify: `backend/app/api/endpoints/users.py`
- Test: `backend/tests/api/test_users.py` (extend if exists; else add cases to the file that tests `/users/me`)

- [ ] **Step 1: Write failing test**

Add to the `/users/me` test module:

```python
async def test_me_quota_summary_aggregates_active(http, firestore_client):
    # seed 2 active quota docs (granted 4 used1 ; granted 4 used0) for the user
    # expect total_remaining == 3+4 == 7 and next_expiry == min(expires_at)
    ...
async def test_me_quota_summary_null_when_no_quota(http, firestore_client):
    # no docs -> quota_summary.total_remaining == 0, next_expiry is None
    ...
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/ -v -k "quota_summary"`
Expected: FAIL — response has `current_month_quota`, not `quota_summary`.

- [ ] **Step 3: Update schema**

In `backend/app/api/schemas/user.py` replace `MonthQuotaSummary` usage:

```python
class QuotaSummary(BaseModel):
    total_remaining: int
    next_expiry: datetime | None = None


class UserResponse(BaseModel):
    uid: str
    email: EmailStr
    name: str
    phone: str | None
    plan: Literal["light", "standard", "intensive"] | None = None
    trial_used: bool = False
    quota_summary: QuotaSummary | None = None
    created_at: datetime
    updated_at: datetime
```

(Delete `MonthQuotaSummary` class and its imports/usages.)

- [ ] **Step 4: Update endpoint**

In `backend/app/api/endpoints/users.py`: change `_user_to_response` signature param to `quota_summary: QuotaSummary | None`, set `quota_summary=quota_summary`. Rewrite `get_profile`:

```python
@router.get("/me", response_model=UserResponse)
async def get_profile(
    user: Annotated[User, Depends(get_current_user)],
    quota_repo: Annotated[
        MonthlyQuotaRepository, Depends(get_monthly_quota_repository)
    ],
) -> UserResponse:
    now = datetime.now(UTC)
    active = await quota_repo.find_active_for_user(user.uid, now)
    if active:
        summary = QuotaSummary(
            total_remaining=sum(q.granted - q.used for q in active),
            next_expiry=min(q.expires_at for q in active),
        )
    else:
        summary = None
    return _user_to_response(user, summary)
```

Update imports (`QuotaSummary` in, `MonthQuotaSummary` out). `signup_initialize` passes `None`.

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/ -v -k "quota or users or me"`
Expected: green.

- [ ] **Step 6: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/api && uv run mypy app/api/endpoints/users.py app/api/schemas/user.py
git add backend/app/api/schemas/user.py backend/app/api/endpoints/users.py backend/tests/
git commit -m "feat(users): /me returns aggregate quota_summary (multi-doc)"
```

---

## Task 8: Frontend `quota_summary`

**Files:**
- Modify: `frontend/src/lib/booking.ts`
- Modify: `frontend/src/app/mypage/_components/ProfileCard.tsx`
- Test: `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx`

- [ ] **Step 1: Write/extend failing test**

In `ProfileCard.test.tsx` add:

```tsx
it('renders aggregate quota when quota_summary present', () => {
  render(
    <ProfileCard
      profile={{
        uid: 'u', email: 'e@x.com', name: 'N', phone: null,
        plan: 'light', trial_used: true,
        quota_summary: { total_remaining: 7, next_expiry: '2026-07-15T00:00:00Z' },
        created_at: '', updated_at: '',
      }}
    />
  );
  expect(screen.getByText(/残 7/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect failure (type error / missing field)**

Run: `cd frontend && npx jest ProfileCard`
Expected: FAIL (type `quota_summary` not on MeResponse).

- [ ] **Step 3: Update lib types**

In `frontend/src/lib/booking.ts` replace `MonthQuotaSummary` + `MeResponse`:

```typescript
export interface QuotaSummary {
  total_remaining: number;
  next_expiry: string | null;
}

export interface MeResponse {
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  plan: Plan | null;
  trial_used: boolean;
  quota_summary: QuotaSummary | null;
  created_at: string;
  updated_at: string;
}
```

(Remove `MonthQuotaSummary`. Grep for other usages: `grep -rn MonthQuotaSummary frontend/src` and update/remove.)

- [ ] **Step 4: Update ProfileCard**

Replace the `current_month_quota` block in `ProfileCard.tsx`:

```tsx
        {profile.quota_summary && (
          <div className="flex">
            <dt className="w-32 text-gray-500">コマ残高</dt>
            <dd>
              残 {profile.quota_summary.total_remaining}
              {profile.quota_summary.next_expiry && (
                <span className="ml-2 text-xs text-gray-400">
                  (最短失効{' '}
                  {new Date(
                    profile.quota_summary.next_expiry
                  ).toLocaleDateString('ja-JP')}
                  )
                </span>
              )}
            </dd>
          </div>
        )}
```

- [ ] **Step 5: Run — expect pass + tsc + lint**

Run: `cd frontend && npx jest ProfileCard && npx tsc --noEmit && npm run lint`
Expected: green / clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/booking.ts frontend/src/app/mypage/_components/ProfileCard.tsx frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx
git commit -m "feat(mypage): ProfileCard shows aggregate quota balance"
```

---

## Task 9: Migrate 4b Cloud Function to new doc-id scheme

**Files:**
- Modify: `terraform/modules/cloud-function-monthly-quota-grant/source/main.py`
- Test: `terraform/modules/cloud-function-monthly-quota-grant/source/test_main.py`

- [ ] **Step 1: Update `test_main.py` — remove the deleted symbol, add new tests**

The current `test_main.py` has `from main import (JST, QUOTA_BY_PLAN, build_quota_payload, next_month_first_jst)` (lines 7-12) and `test_next_month_first_jst_handles_month_rollover` (lines 31+). Task 9 deletes `next_month_first_jst` from `main.py`, so the import would raise `ImportError` and the whole file fails to collect.

Edit `terraform/modules/cloud-function-monthly-quota-grant/source/test_main.py`:
1. Remove `next_month_first_jst` from the `from main import (...)` block; add `add_two_months_local`.
2. **Delete** the entire `test_next_month_first_jst_handles_month_rollover` function.
3. Keep `test_quota_by_plan_constants` and `test_build_quota_payload_for_standard` (their target `build_quota_payload` keeps the same signature).
4. Append:

```python
def test_add_two_months_local_jan31():
    from datetime import datetime
    assert add_two_months_local(datetime(2026, 1, 31, tzinfo=JST)) == datetime(
        2026, 3, 31, tzinfo=JST
    )


def test_build_payload_expires_two_months_not_next_first():
    from datetime import datetime
    from zoneinfo import ZoneInfo
    now = datetime(2026, 5, 15, 0, 0, tzinfo=ZoneInfo("UTC"))
    p = build_quota_payload(uid="u1", plan="light", now_utc=now)
    assert p["granted"] == 4
    # 2-month expiry → strictly later than the old next-month-1st (2026-06-01)
    assert p["expires_at"] > datetime(2026, 6, 2, tzinfo=ZoneInfo("UTC"))
```

- [ ] **Step 2: Run — expect failure**

Run: `cd terraform/modules/cloud-function-monthly-quota-grant/source && python -m pytest test_main.py -v`
Expected: FAIL — `ImportError: cannot import name 'add_two_months_local'` (test file now imports it; `main.py` not yet rewritten).

- [ ] **Step 3: Rewrite the function source**

Replace `terraform/modules/cloud-function-monthly-quota-grant/source/main.py`:

```python
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
```

> Note: idempotency query `where user_id == AND where year_month ==` needs a composite index on `monthly_quota`. Add it in Step 4.

- [ ] **Step 4: Add Firestore composite index**

`firestore.indexes.json` already exists at repo root (created in sub-project 4d, has a `users` single-field block + `fieldOverrides: []`). **Merge** this object into the existing `indexes` array (do not overwrite the file, do not duplicate existing entries):

```json
{
  "collectionGroup": "monthly_quota",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "user_id", "order": "ASCENDING" },
    { "fieldPath": "year_month", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 5: Run — expect pass**

Run: `cd terraform/modules/cloud-function-monthly-quota-grant/source && python -m pytest test_main.py -v`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add terraform/modules/cloud-function-monthly-quota-grant/source/main.py \
        terraform/modules/cloud-function-monthly-quota-grant/source/test_main.py \
        firestore.indexes.json
git commit -m "feat(quota-cron): migrate grant to 2-month multi-doc scheme"
```

---

## Task 10: Backfill migration script

**Files:**
- Create: `scripts/migrate_quota_to_multidoc.py`

- [ ] **Step 1: Implement script**

Create `scripts/migrate_quota_to_multidoc.py`:

```python
#!/usr/bin/env python
"""One-shot: convert legacy monthly_quota/{uid}_{YYYY-MM} docs to the new
{uid}_{granted_at:%Y%m%d%H%M%S%f} multi-doc + 2-month-expiry scheme.

PRECONDITION (hard): freeze quota writes (maintenance window / booking
paused) before running. Concurrent booking on a legacy doc during
migration loses consumption on re-run.

  uv run python scripts/migrate_quota_to_multidoc.py --project english-cafe-496209 [--dry-run]
"""

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
```

- [ ] **Step 2: Lint**

Run: `cd backend && uv run ruff check ../scripts/migrate_quota_to_multidoc.py`
(Adjust path if scripts/ is repo-root; run `uv run ruff check scripts/migrate_quota_to_multidoc.py` from repo root.)
Expected: clean.

- [ ] **Step 3: Manual dry-run verification (documented, not automated)**

With emulator + a seeded legacy doc, run `uv run python scripts/migrate_quota_to_multidoc.py --project test-project --dry-run` and confirm the printed `old -> new` mapping. (No pytest; this is an ops script.)

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate_quota_to_multidoc.py
git commit -m "chore(scripts): one-shot legacy->multidoc quota migration (write-freeze required)"
```

---

## Task 11: Full verification + PR

- [ ] **Step 1: Full backend suite**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest -q`
Expected: all new + all rewritten (Task 4/5) green. Only known pre-existing failure that may remain: `tests/infrastructure/repositories/test_firestore_user_repository.py::TestPhoneRoundTrip::test_phone_is_persisted` (phone E.164 normalisation, reproducible on origin/main, unrelated). If ANY `test_booking_service.py` quota/cancel test fails, a Task 4/5 assertion rewrite was missed — fix before proceeding, do not push.

- [ ] **Step 2: Cloud Function tests**

Run: `cd terraform/modules/cloud-function-monthly-quota-grant/source && python -m pytest test_main.py -v`
Expected: green.

- [ ] **Step 3: Frontend**

Run: `cd frontend && npx jest && npx tsc --noEmit && npm run lint`
Expected: pre-existing 3 Firebase-env jest failures may remain; ProfileCard + others green; tsc/lint clean.

- [ ] **Step 4: Lint/type both sides**

Run: `cd backend && uv run ruff check . && uv run mypy app/domain app/services`
Expected: clean.

- [ ] **Step 5: Push + PR**

```bash
git push -u origin <branch>
gh pr create --title "feat(quota): multi-doc + FIFO + 2-month expiry (4c-1)" --body "$(cat <<'EOF'
## Summary
sub-project 4c-1: monthly_quota を「1ユーザー複数doc・各2ヶ月有効・FIFO消費」に変更。Stripe コードなし。4c-2/4c-3 の土台。

## What's included
- add_two_months 純関数 (domain) + repo `find_active_for_user`/`find_by_doc_id`
- new doc-id `{uid}_{granted_at:%Y%m%d%H%M%S%f}` (legacy `find` deprecated)
- Booking.consumed_quota_doc_id で正確な refund
- book/cancel/admin_force_* の FIFO 改修 (既存 transaction 内)
- /users/me → quota_summary 集計、ProfileCard 追従
- 4b Cloud Function を新スキームに移行 + composite index
- scripts/migrate_quota_to_multidoc.py (write-freeze 前提)

## Test plan
- [x] backend pytest (emulator) green (既知の phone test 失敗のみ)
- [x] cloud function test_main green
- [x] frontend jest/tsc/lint
- [ ] **本番投入前**: maintenance window で migrate script を --dry-run → 本実行
- [ ] 4b cron 翌月 1 日 0:00 JST 動作確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Do NOT merge — PR creation only per project rule.)

---

## Spec Coverage Self-Check

| Spec (4c-1) requirement | Task |
|---|---|
| `add_two_months` 標準ライブラリ実装 | 1 |
| doc-id `{uid}_{granted_at:%f}` | 2 |
| `find_active_for_user` 単一等価query+Python filter (C3) | 2 |
| `find_by_doc_id` | 2 |
| `find` deprecate | 2 |
| `Booking.consumed_quota_doc_id` | 3 |
| book FIFO (read-before-write) | 4 |
| cancel/admin_force_cancel refund via consumed id, pre-4c skip | 5 |
| admin_force_book FIFO + warn-when-none | 6 |
| `/users/me` quota_summary 集計 (I3) | 7 |
| frontend MeResponse/ProfileCard 追従 | 8 |
| 4b cron 新スキーム移行 + 月次冪等 (D2) — `next_month_first_jst` 削除に伴い test_main.py の import + 該当 test も削除/置換 | 9 |
| backfill script, overwrite, write-freeze 前提 (D4, IMPORTANT-2) | 10 |
| contention 増は許容 (IMPORTANT-1) | noted in 4 (txn FIFO scan) |
| year_month = grant 月メタ (I1) | preserved in 2/9 `_to_dict` |
| 独立 shippable, Stripe ゼロ | whole plan |
