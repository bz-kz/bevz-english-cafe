# Sub-project 4b Implementation Plan — Monthly quota + 24h cancel rule + trial counter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a per-user monthly coma quota (light=4, standard=8, intensive=16), enforce 24h cancellation rule, and add trial-once-only counter. Plans are assigned manually by admin via CLI script (Stripe webhook wiring lives in 4c).

**Architecture:** New `monthly_quota/{uid}_{YYYY-MM}` Firestore collection. `BookingService.book()` consumes the row of the **JST-month of the booking moment** atomically inside the same transaction that creates the booking. `cancel()` refunds it iff start_at − now ≥ 24h. Trial bookings bypass quota but flip `users/{uid}.trial_used`. A new Cloud Function + Scheduler runs monthly to grant fresh quota rows.

**Tech Stack:** FastAPI + Firestore AsyncClient (transactional) / Cloud Functions Gen2 (Python 3.12) + Cloud Scheduler / Next.js 14 / Terragrunt+HCP Terraform.

---

## File Map

| Path | Kind | Purpose |
|---|---|---|
| `backend/app/domain/entities/user.py` | modify | Add `plan`, `plan_started_at`, `trial_used` fields |
| `backend/app/infrastructure/repositories/firestore_user_repository.py` | modify | Persist new fields |
| `backend/app/domain/entities/monthly_quota.py` | create | MonthlyQuota dataclass |
| `backend/app/domain/repositories/monthly_quota_repository.py` | create | Repository interface |
| `backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py` | create | Firestore impl |
| `backend/tests/domain/test_monthly_quota.py` | create | Entity invariants |
| `backend/tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py` | create | Repo CRUD |
| `backend/app/services/booking_errors.py` | modify | Add new error types |
| `backend/app/services/booking_service.py` | modify | trial+quota in book(), 24h+refund in cancel() |
| `backend/tests/services/test_booking_service.py` | modify | New behavior cases |
| `backend/app/api/dependencies/repositories.py` | modify | Add `get_monthly_quota_repository` factory |
| `backend/app/api/schemas/user.py` | modify | UserResponse extended fields |
| `backend/app/api/endpoints/users.py` | modify | /users/me returns plan + quota summary |
| `backend/app/api/endpoints/bookings.py` | modify | New HTTPException mapping for new errors |
| `scripts/set_plan.py` | create | Admin CLI to set users/{uid}.plan |
| `scripts/backfill_monthly_quota.py` | create | One-shot monthly_quota seeding for active plan users |
| `terraform/modules/cloud-function-monthly-quota-grant/main.tf` | create | TF module (mirror cloud-function-slot-generator) |
| `terraform/modules/cloud-function-monthly-quota-grant/variables.tf` | create | inputs |
| `terraform/modules/cloud-function-monthly-quota-grant/outputs.tf` | create | outputs |
| `terraform/modules/cloud-function-monthly-quota-grant/versions.tf` | create | provider pins |
| `terraform/modules/cloud-function-monthly-quota-grant/source/main.py` | create | `grant_monthly_quota` entrypoint |
| `terraform/modules/cloud-function-monthly-quota-grant/source/test_main.py` | create | unit tests with mock Firestore |
| `terraform/modules/cloud-function-monthly-quota-grant/source/requirements.txt` | create | `google-cloud-firestore` |
| `terraform/envs/prod/monthly-quota/terragrunt.hcl` | create | Stack wiring |
| `frontend/src/lib/booking.ts` | modify | User type extended with plan/quota |
| `frontend/src/app/mypage/_components/ProfileCard.tsx` | modify | Show plan + this-month quota |
| `frontend/src/app/book/_components/SlotCell.tsx` | modify | `'within24h'` state (▲ grey) |
| `frontend/src/app/book/_components/BookingGrid.tsx` | modify | Emit `within24h` state for slots starting within 24h |
| `frontend/src/app/book/page.tsx` | modify | Surface trial/quota/24h errors via toast |
| `frontend/src/app/mypage/_components/BookingsList.tsx` | modify | Disable cancel button if start_at < now+24h |

---

## Task 1: User entity — add plan / plan_started_at / trial_used

**Files:**
- Modify: `backend/app/domain/entities/user.py`
- Modify: `backend/app/infrastructure/repositories/firestore_user_repository.py`
- Modify: `backend/tests/domain/test_user.py`
- Modify: `backend/tests/infrastructure/repositories/test_firestore_user_repository.py`

- [ ] **Step 1: Append failing tests to test_user.py**

```python
import pytest
from app.domain.entities.user import User, Plan


def test_user_default_plan_is_none():
    u = User(uid="u1", email="a@b.c", name="x")
    assert u.plan is None
    assert u.plan_started_at is None
    assert u.trial_used is False


def test_user_can_be_assigned_a_plan():
    u = User(uid="u1", email="a@b.c", name="x")
    u.set_plan(Plan.STANDARD)
    assert u.plan == Plan.STANDARD
    assert u.plan_started_at is not None


def test_user_set_plan_to_none_clears_started_at():
    u = User(uid="u1", email="a@b.c", name="x")
    u.set_plan(Plan.LIGHT)
    u.set_plan(None)
    assert u.plan is None
    assert u.plan_started_at is None
```

- [ ] **Step 2: Run tests, expect FAIL**

```
cd backend && uv run pytest tests/domain/test_user.py::test_user_default_plan_is_none -v
```
Expected: ImportError or AttributeError — no `Plan` enum, no `plan` field.

- [ ] **Step 3: Add Plan enum**

Create `backend/app/domain/enums/plan.py`:

```python
"""Plan enum — monthly coma quota tier."""

from __future__ import annotations

from enum import Enum


class Plan(str, Enum):
    LIGHT = "light"
    STANDARD = "standard"
    INTENSIVE = "intensive"


PLAN_QUOTA: dict[Plan, int] = {
    Plan.LIGHT: 4,
    Plan.STANDARD: 8,
    Plan.INTENSIVE: 16,
}
```

- [ ] **Step 4: Update User entity**

Replace `backend/app/domain/entities/user.py`:

```python
"""User domain entity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.domain.enums.plan import Plan
from app.domain.value_objects.phone import Phone


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class User:
    uid: str
    email: str
    name: str
    phone: Phone | None = None
    plan: Plan | None = None
    plan_started_at: datetime | None = None
    trial_used: bool = False
    # is_admin は Firebase Auth の custom claim から hydrate される runtime 値。
    is_admin: bool = False
    created_at: datetime = field(default_factory=_utc_now)
    updated_at: datetime = field(default_factory=_utc_now)

    def __post_init__(self) -> None:
        if not self.uid:
            raise ValueError("uid is required")
        if not self.email:
            raise ValueError("email is required")
        if not self.name.strip():
            raise ValueError("name must be non-empty")

    def update(self, *, name: str | None = None, phone: Phone | None = None) -> None:
        changed = False
        if name is not None and name != self.name:
            if not name.strip():
                raise ValueError("name must be non-empty")
            self.name = name
            changed = True
        if phone is not None and (
            self.phone is None or phone.value != self.phone.value
        ):
            self.phone = phone
            changed = True
        if changed:
            self.updated_at = _utc_now()

    def set_plan(self, plan: Plan | None) -> None:
        self.plan = plan
        self.plan_started_at = _utc_now() if plan is not None else None
        self.updated_at = _utc_now()

    def mark_trial_used(self) -> None:
        if self.trial_used:
            return
        self.trial_used = True
        self.updated_at = _utc_now()
```

- [ ] **Step 5: Update FirestoreUserRepository**

In `backend/app/infrastructure/repositories/firestore_user_repository.py`:

Replace `_to_dict` and `_from_dict`:

```python
    @staticmethod
    def _to_dict(user: User) -> dict[str, Any]:
        return {
            "uid": user.uid,
            "email": user.email,
            "name": user.name,
            "phone": user.phone.value if user.phone else None,
            "plan": user.plan.value if user.plan else None,
            "plan_started_at": user.plan_started_at,
            "trial_used": user.trial_used,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None, uid: str) -> User:
        assert data is not None
        phone_val = data.get("phone")
        plan_val = data.get("plan")
        return User(
            uid=uid,
            email=data["email"],
            name=data["name"],
            phone=Phone(phone_val) if phone_val else None,
            plan=Plan(plan_val) if plan_val else None,
            plan_started_at=data.get("plan_started_at"),
            trial_used=bool(data.get("trial_used", False)),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )
```

Add to imports at the top:
```python
from app.domain.enums.plan import Plan
```

- [ ] **Step 6: Run tests, expect PASS**

```
cd backend && uv run pytest tests/domain/test_user.py -v
```
Expected: all PASS including new 3 tests.

- [ ] **Step 7: mypy + ruff**

```
cd backend && uv run mypy app/domain app/services
cd backend && uv run ruff check . && uv run ruff format --check . | head
```
(format-check has the pre-existing booking.py drift, OK to ignore.)

- [ ] **Step 8: Stage (do NOT commit — dispatcher commits)**

```
git add backend/app/domain/entities/user.py \
        backend/app/domain/enums/plan.py \
        backend/app/infrastructure/repositories/firestore_user_repository.py \
        backend/tests/domain/test_user.py
```

---

## Task 2: MonthlyQuota entity + repository

**Files:**
- Create: `backend/app/domain/entities/monthly_quota.py`
- Create: `backend/app/domain/repositories/monthly_quota_repository.py`
- Create: `backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py`
- Create: `backend/tests/domain/test_monthly_quota.py`
- Create: `backend/tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py`

- [ ] **Step 1: Write failing entity test**

Create `backend/tests/domain/test_monthly_quota.py`:

```python
from datetime import UTC, datetime

import pytest

from app.domain.entities.monthly_quota import MonthlyQuota


def test_remaining_is_granted_minus_used():
    q = MonthlyQuota(
        user_id="u1",
        year_month="2026-05",
        plan_at_grant="standard",
        granted=8,
        used=3,
        granted_at=datetime(2026, 5, 1, tzinfo=UTC),
        expires_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    assert q.remaining == 5


def test_quota_rejects_negative_granted():
    with pytest.raises(ValueError):
        MonthlyQuota(
            user_id="u1",
            year_month="2026-05",
            plan_at_grant="light",
            granted=-1,
            used=0,
            granted_at=datetime(2026, 5, 1, tzinfo=UTC),
            expires_at=datetime(2026, 6, 1, tzinfo=UTC),
        )


def test_quota_rejects_used_greater_than_granted():
    with pytest.raises(ValueError):
        MonthlyQuota(
            user_id="u1",
            year_month="2026-05",
            plan_at_grant="light",
            granted=4,
            used=5,
            granted_at=datetime(2026, 5, 1, tzinfo=UTC),
            expires_at=datetime(2026, 6, 1, tzinfo=UTC),
        )


def test_is_exhausted():
    q = MonthlyQuota(
        user_id="u1",
        year_month="2026-05",
        plan_at_grant="light",
        granted=4,
        used=4,
        granted_at=datetime(2026, 5, 1, tzinfo=UTC),
        expires_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    assert q.is_exhausted is True
```

- [ ] **Step 2: Run, expect ImportError**

```
cd backend && uv run pytest tests/domain/test_monthly_quota.py -v
```

- [ ] **Step 3: Create the entity**

Create `backend/app/domain/entities/monthly_quota.py`:

```python
"""MonthlyQuota — per-user coma allowance for a single calendar month (JST)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class MonthlyQuota:
    user_id: str
    year_month: str  # e.g. "2026-05"
    plan_at_grant: str  # 'light' | 'standard' | 'intensive', snapshotted at grant
    granted: int
    used: int
    granted_at: datetime
    expires_at: datetime

    def __post_init__(self) -> None:
        if self.granted < 0:
            raise ValueError("granted must be >= 0")
        if self.used < 0 or self.used > self.granted:
            raise ValueError("used must be in [0, granted]")

    @property
    def remaining(self) -> int:
        return self.granted - self.used

    @property
    def is_exhausted(self) -> bool:
        return self.remaining <= 0
```

- [ ] **Step 4: Run entity tests, expect PASS**

```
cd backend && uv run pytest tests/domain/test_monthly_quota.py -v
```

- [ ] **Step 5: Create repository interface**

Create `backend/app/domain/repositories/monthly_quota_repository.py`:

```python
"""MonthlyQuotaRepository interface."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities.monthly_quota import MonthlyQuota


class MonthlyQuotaRepository(ABC):
    @abstractmethod
    async def save(self, quota: MonthlyQuota) -> MonthlyQuota: ...

    @abstractmethod
    async def find(self, user_id: str, year_month: str) -> MonthlyQuota | None: ...
```

- [ ] **Step 6: Write failing Firestore impl test**

Create `backend/tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py`:

```python
import os
from datetime import UTC, datetime

import pytest
from google.cloud import firestore as fs

from app.domain.entities.monthly_quota import MonthlyQuota
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)

pytestmark = pytest.mark.skipif(
    "FIRESTORE_EMULATOR_HOST" not in os.environ,
    reason="Requires Firestore emulator",
)


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    # Clean collection.
    async for doc in client.collection("monthly_quota").stream():
        await doc.reference.delete()
    yield FirestoreMonthlyQuotaRepository(client)


async def test_save_and_find_roundtrip(repo):
    q = MonthlyQuota(
        user_id="u1",
        year_month="2026-05",
        plan_at_grant="standard",
        granted=8,
        used=0,
        granted_at=datetime(2026, 5, 1, tzinfo=UTC),
        expires_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    await repo.save(q)
    fetched = await repo.find("u1", "2026-05")
    assert fetched is not None
    assert fetched.granted == 8
    assert fetched.used == 0
    assert fetched.plan_at_grant == "standard"


async def test_find_returns_none_when_absent(repo):
    fetched = await repo.find("u-missing", "2026-05")
    assert fetched is None
```

- [ ] **Step 7: Run, expect ImportError**

- [ ] **Step 8: Implement Firestore repo**

Create `backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py`:

```python
"""Firestore impl of MonthlyQuotaRepository."""

from __future__ import annotations

from typing import Any

from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.domain.entities.monthly_quota import MonthlyQuota
from app.domain.repositories.monthly_quota_repository import MonthlyQuotaRepository

_COLLECTION = "monthly_quota"


def _doc_id(user_id: str, year_month: str) -> str:
    return f"{user_id}_{year_month}"


class FirestoreMonthlyQuotaRepository(MonthlyQuotaRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def save(self, quota: MonthlyQuota) -> MonthlyQuota:
        await self._collection.document(_doc_id(quota.user_id, quota.year_month)).set(
            self._to_dict(quota)
        )
        return quota

    async def find(self, user_id: str, year_month: str) -> MonthlyQuota | None:
        doc = await self._collection.document(_doc_id(user_id, year_month)).get()
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

- [ ] **Step 9: Run repo tests, expect PASS** (Firestore emulator required, same as 4a)

- [ ] **Step 10: Stage**

```
git add backend/app/domain/entities/monthly_quota.py \
        backend/app/domain/repositories/monthly_quota_repository.py \
        backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py \
        backend/tests/domain/test_monthly_quota.py \
        backend/tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py
```

---

## Task 3: Add new booking errors

**Files:**
- Modify: `backend/app/services/booking_errors.py`

- [ ] **Step 1: Append the new errors**

```python
class TrialAlreadyUsed(Exception):
    """User has already consumed their lifetime trial booking."""


class NoActiveQuota(Exception):
    """User has no monthly_quota row for the booking month (plan unset or grant pending)."""


class QuotaExhausted(Exception):
    """User's monthly quota is fully consumed."""


class CancelDeadlinePassed(Exception):
    """Booking is within 24 hours of start — cancellation refused."""
```

- [ ] **Step 2: Stage**

```
git add backend/app/services/booking_errors.py
```

---

## Task 4: BookingService.book() — trial + quota integration

**Files:**
- Modify: `backend/app/services/booking_service.py`
- Modify: `backend/tests/services/test_booking_service.py`

This task changes the transactional logic of `book()`. Read the existing implementation (lines 52–102) before editing.

- [ ] **Step 1: Append failing tests to test_booking_service.py**

```python
import pytest
from datetime import UTC, datetime, timedelta
from app.domain.entities.lesson_slot import LessonSlot
from app.domain.entities.monthly_quota import MonthlyQuota
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus
from app.domain.enums.plan import Plan
from app.services.booking_errors import (
    NoActiveQuota,
    QuotaExhausted,
    TrialAlreadyUsed,
)


# Reuse the existing booking_service fixture; add a quota fixture.
@pytest.fixture
async def standard_user(user_repo):
    u = User(uid="u-quota", email="q@example.com", name="Quota Tester")
    u.set_plan(Plan.STANDARD)
    await user_repo.save(u)
    return u


@pytest.fixture
async def standard_user_quota(quota_repo, standard_user):
    now = datetime.now(UTC)
    ym = now.strftime("%Y-%m")
    q = MonthlyQuota(
        user_id=standard_user.uid,
        year_month=ym,
        plan_at_grant="standard",
        granted=8,
        used=0,
        granted_at=now.replace(day=1, hour=0, minute=0, second=0, microsecond=0),
        expires_at=now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        + timedelta(days=32),
    )
    await quota_repo.save(q)
    return q


async def test_book_increments_used_in_quota(
    booking_service, slot_factory, standard_user, standard_user_quota
):
    slot = await slot_factory(
        start_at=datetime.now(UTC) + timedelta(days=2),
        lesson_type=LessonType.GROUP,
        capacity=1,
    )
    await booking_service.book(user=standard_user, slot_id=str(slot.id))
    ym = datetime.now(UTC).strftime("%Y-%m")
    fetched = await booking_service._monthly_quota_repo.find(standard_user.uid, ym)
    assert fetched.used == 1


async def test_book_rejects_when_no_quota_row(
    booking_service, slot_factory, standard_user
):
    slot = await slot_factory(
        start_at=datetime.now(UTC) + timedelta(days=2),
        lesson_type=LessonType.GROUP,
    )
    with pytest.raises(NoActiveQuota):
        await booking_service.book(user=standard_user, slot_id=str(slot.id))


async def test_book_rejects_when_quota_exhausted(
    booking_service, slot_factory, standard_user, quota_repo
):
    now = datetime.now(UTC)
    ym = now.strftime("%Y-%m")
    exhausted = MonthlyQuota(
        user_id=standard_user.uid,
        year_month=ym,
        plan_at_grant="standard",
        granted=8,
        used=8,
        granted_at=now,
        expires_at=now + timedelta(days=30),
    )
    await quota_repo.save(exhausted)
    slot = await slot_factory(start_at=now + timedelta(days=2), lesson_type=LessonType.GROUP)
    with pytest.raises(QuotaExhausted):
        await booking_service.book(user=standard_user, slot_id=str(slot.id))


async def test_book_trial_first_time_marks_user_and_skips_quota(
    booking_service, slot_factory, standard_user
):
    """trial bookings do not consume quota."""
    slot = await slot_factory(
        start_at=datetime.now(UTC) + timedelta(days=2),
        lesson_type=LessonType.TRIAL,
    )
    await booking_service.book(user=standard_user, slot_id=str(slot.id))
    refreshed = await booking_service._user_repo.find_by_uid(standard_user.uid)
    assert refreshed.trial_used is True


async def test_book_trial_second_time_rejects(
    booking_service, slot_factory, standard_user, user_repo
):
    standard_user.mark_trial_used()
    await user_repo.save(standard_user)
    slot = await slot_factory(
        start_at=datetime.now(UTC) + timedelta(days=2),
        lesson_type=LessonType.TRIAL,
    )
    with pytest.raises(TrialAlreadyUsed):
        await booking_service.book(user=standard_user, slot_id=str(slot.id))
```

- [ ] **Step 2: Add fixtures**

Add to the existing `tests/services/test_booking_service.py` fixture section (or `conftest.py` if shared):

```python
@pytest.fixture
async def quota_repo():
    from google.cloud import firestore as fs
    from app.infrastructure.repositories.firestore_monthly_quota_repository import (
        FirestoreMonthlyQuotaRepository,
    )
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("monthly_quota").stream():
        await doc.reference.delete()
    yield FirestoreMonthlyQuotaRepository(client)


@pytest.fixture
async def user_repo():
    from google.cloud import firestore as fs
    from app.infrastructure.repositories.firestore_user_repository import (
        FirestoreUserRepository,
    )
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("users").stream():
        await doc.reference.delete()
    yield FirestoreUserRepository(client)


@pytest.fixture
def booking_service(slot_repo, booking_repo_fixture, quota_repo, user_repo):
    """BookingService with quota + user repos wired."""
    from google.cloud import firestore as fs
    from app.services.booking_service import BookingService
    return BookingService(
        slot_repo=slot_repo,
        booking_repo=booking_repo_fixture,
        firestore_client=fs.AsyncClient(project="test-project"),
        monthly_quota_repo=quota_repo,
        user_repo=user_repo,
    )
```

(Adjust to match the actual fixture names used in this file — read the current fixtures section first.)

- [ ] **Step 3: Run tests, expect FAIL**

```
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service.py -k "trial or quota" -v
```

- [ ] **Step 4: Update BookingService**

Replace `backend/app/services/booking_service.py`:

```python
"""BookingService — capacity-safe + quota-aware book and cancel."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import uuid4
from zoneinfo import ZoneInfo

from google.cloud import firestore as fs

from app.domain.entities.booking import Booking
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    CancelDeadlinePassed,
    NoActiveQuota,
    NotBookingOwnerError,
    QuotaExhausted,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
    TrialAlreadyUsed,
)

JST = ZoneInfo("Asia/Tokyo")
CANCEL_DEADLINE = timedelta(hours=24)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _jst_year_month(dt: datetime) -> str:
    """Return YYYY-MM in JST for the given (UTC-aware) datetime."""
    return dt.astimezone(JST).strftime("%Y-%m")


class BookingService:
    def __init__(
        self,
        slot_repo: FirestoreLessonSlotRepository,
        booking_repo: FirestoreBookingRepository,
        firestore_client: fs.AsyncClient,
        monthly_quota_repo: FirestoreMonthlyQuotaRepository,
        user_repo: FirestoreUserRepository,
    ) -> None:
        self._slot_repo = slot_repo
        self._booking_repo = booking_repo
        self._fs = firestore_client
        self._monthly_quota_repo = monthly_quota_repo
        self._user_repo = user_repo

    async def book(self, *, user: User, slot_id: str) -> Booking:
        slot_ref = self._fs.collection("lesson_slots").document(slot_id)
        bookings_col = self._fs.collection("bookings")
        users_col = self._fs.collection("users")
        new_booking_id = uuid4()

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            slot_snap = await slot_ref.get(transaction=tx)
            if not slot_snap.exists:
                raise SlotNotFoundError(slot_id)
            slot = self._slot_repo._from_dict(slot_snap.to_dict(), slot_id)

            if slot.status != SlotStatus.OPEN:
                raise SlotNotOpenError(slot_id)
            if slot.start_at <= _utc_now():
                raise SlotInPastError(slot_id)
            if slot.is_full:
                raise SlotFullError(slot_id)

            # Anti double-book.
            existing_query = (
                bookings_col.where("user_id", "==", user.uid)
                .where("slot_id", "==", slot_id)
                .where("status", "==", BookingStatus.CONFIRMED.value)
                .limit(1)
            )
            async for _doc in existing_query.stream(transaction=tx):
                raise AlreadyBookedError(slot_id)

            user_ref = users_col.document(user.uid)
            user_snap = await user_ref.get(transaction=tx)
            if not user_snap.exists:
                raise NoActiveQuota(f"User {user.uid} not initialized")
            user_data = cast(dict[str, Any], user_snap.to_dict())

            if slot.lesson_type == LessonType.TRIAL:
                if user_data.get("trial_used", False):
                    raise TrialAlreadyUsed(user.uid)
                tx.update(user_ref, {"trial_used": True, "updated_at": _utc_now()})
            else:
                year_month = _jst_year_month(_utc_now())
                quota_ref = self._fs.collection("monthly_quota").document(
                    f"{user.uid}_{year_month}"
                )
                quota_snap = await quota_ref.get(transaction=tx)
                if not quota_snap.exists:
                    raise NoActiveQuota(year_month)
                quota_data = cast(dict[str, Any], quota_snap.to_dict())
                granted = int(quota_data["granted"])
                used = int(quota_data["used"])
                if used >= granted:
                    raise QuotaExhausted(year_month)
                tx.update(quota_ref, {"used": used + 1})

            booking = Booking(
                id=new_booking_id,
                slot_id=slot_id,
                user_id=user.uid,
                status=BookingStatus.CONFIRMED,
                created_at=_utc_now(),
                cancelled_at=None,
            )
            tx.update(
                slot_ref,
                {
                    "booked_count": slot.booked_count + 1,
                    "updated_at": _utc_now(),
                },
            )
            tx.set(
                bookings_col.document(str(booking.id)),
                self._booking_repo._to_dict(booking),
            )
            return booking

        return cast(Booking, await txn(self._fs.transaction()))

    async def cancel(self, *, user: User, booking_id: str) -> Booking:
        booking_ref = self._fs.collection("bookings").document(booking_id)
        slots_col = self._fs.collection("lesson_slots")
        quota_col = self._fs.collection("monthly_quota")

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            booking_snap = await booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise BookingNotFoundError(booking_id)
            booking = self._booking_repo._from_dict(booking_snap.to_dict(), booking_id)

            if booking.user_id != user.uid:
                raise NotBookingOwnerError(booking_id)

            # Idempotent: already cancelled → return as-is.
            if booking.status == BookingStatus.CANCELLED:
                return booking

            slot_ref = slots_col.document(booking.slot_id)
            slot_snap = await slot_ref.get(transaction=tx)
            slot_data = cast(dict[str, Any], slot_snap.to_dict() or {})
            slot_start = slot_data.get("start_at")
            lesson_type_str = slot_data.get("lesson_type", "")

            # 24h rule
            if slot_start is not None and (slot_start - _utc_now()) < CANCEL_DEADLINE:
                raise CancelDeadlinePassed(booking_id)

            if slot_snap.exists:
                current = int(slot_data["booked_count"])
                tx.update(
                    slot_ref,
                    {
                        "booked_count": max(0, current - 1),
                        "updated_at": _utc_now(),
                    },
                )

            # Refund quota for non-trial bookings, scoped to the JST month of
            # the original booking's created_at.
            if lesson_type_str != LessonType.TRIAL.value:
                ym = _jst_year_month(booking.created_at)
                quota_ref = quota_col.document(f"{user.uid}_{ym}")
                q_snap = await quota_ref.get(transaction=tx)
                if q_snap.exists:
                    q_data = cast(dict[str, Any], q_snap.to_dict())
                    current_used = int(q_data["used"])
                    tx.update(quota_ref, {"used": max(0, current_used - 1)})

            now = _utc_now()
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = now
            tx.update(
                booking_ref,
                {"status": BookingStatus.CANCELLED.value, "cancelled_at": now},
            )
            return booking

        return cast(Booking, await txn(self._fs.transaction()))

    async def find_user_bookings(self, *, user: User) -> list[Booking]:
        return await self._booking_repo.find_by_user(user.uid)
```

- [ ] **Step 5: Update DI in `backend/app/api/dependencies/repositories.py`**

Add a `get_monthly_quota_repository` factory and wire it into `get_booking_service`:

```python
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)


async def get_monthly_quota_repository() -> FirestoreMonthlyQuotaRepository:
    return FirestoreMonthlyQuotaRepository(get_firestore_client())


async def get_user_repository() -> FirestoreUserRepository:  # already exists — leave
    return FirestoreUserRepository(get_firestore_client())


async def get_booking_service(
    slot_repo: Annotated[..., Depends(get_lesson_slot_repository)],
    booking_repo: Annotated[..., Depends(get_booking_repository)],
    quota_repo: Annotated[..., Depends(get_monthly_quota_repository)],
    user_repo: Annotated[..., Depends(get_user_repository)],
) -> BookingService:
    return BookingService(
        slot_repo=slot_repo,
        booking_repo=booking_repo,
        firestore_client=get_firestore_client(),
        monthly_quota_repo=quota_repo,
        user_repo=user_repo,
    )
```

(Open the existing file and match its imports + signatures — the snippet above shows the additions, not a full rewrite.)

- [ ] **Step 6: Run tests, expect PASS**

```
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service.py -v
```

- [ ] **Step 7: mypy + ruff**

- [ ] **Step 8: Stage**

```
git add backend/app/services/booking_service.py \
        backend/app/api/dependencies/repositories.py \
        backend/tests/services/test_booking_service.py
```

---

## Task 5: BookingService.cancel() — 24h test cases

(BookingService.cancel was already modified in Task 4. This task adds tests for the new behavior.)

**Files:**
- Modify: `backend/tests/services/test_booking_service.py`

- [ ] **Step 1: Append failing tests**

```python
import pytest
from app.services.booking_errors import CancelDeadlinePassed


async def test_cancel_within_24h_rejected_and_quota_unchanged(
    booking_service, slot_factory, standard_user, standard_user_quota
):
    # slot starts in 12h → must reject cancel
    soon_slot = await slot_factory(
        start_at=datetime.now(UTC) + timedelta(hours=12),
        lesson_type=LessonType.GROUP,
    )
    booking = await booking_service.book(user=standard_user, slot_id=str(soon_slot.id))
    with pytest.raises(CancelDeadlinePassed):
        await booking_service.cancel(user=standard_user, booking_id=str(booking.id))
    ym = datetime.now(UTC).strftime("%Y-%m")
    after = await booking_service._monthly_quota_repo.find(standard_user.uid, ym)
    assert after.used == 1  # quota stays consumed


async def test_cancel_more_than_24h_refunds_quota(
    booking_service, slot_factory, standard_user, standard_user_quota
):
    far_slot = await slot_factory(
        start_at=datetime.now(UTC) + timedelta(days=3),
        lesson_type=LessonType.GROUP,
    )
    booking = await booking_service.book(user=standard_user, slot_id=str(far_slot.id))
    await booking_service.cancel(user=standard_user, booking_id=str(booking.id))
    ym = datetime.now(UTC).strftime("%Y-%m")
    after = await booking_service._monthly_quota_repo.find(standard_user.uid, ym)
    assert after.used == 0


async def test_cancel_trial_does_not_touch_quota(
    booking_service, slot_factory, standard_user, standard_user_quota
):
    trial_slot = await slot_factory(
        start_at=datetime.now(UTC) + timedelta(days=3),
        lesson_type=LessonType.TRIAL,
    )
    booking = await booking_service.book(user=standard_user, slot_id=str(trial_slot.id))
    await booking_service.cancel(user=standard_user, booking_id=str(booking.id))
    ym = datetime.now(UTC).strftime("%Y-%m")
    after = await booking_service._monthly_quota_repo.find(standard_user.uid, ym)
    assert after.used == 0  # trial never consumed quota in the first place
```

- [ ] **Step 2: Run, expect PASS** (Task 4 implementation already supports these)

- [ ] **Step 3: Stage**

```
git add backend/tests/services/test_booking_service.py
```

---

## Task 6: HTTP exception mapping for new errors

**Files:**
- Modify: `backend/app/api/endpoints/bookings.py`

- [ ] **Step 1: Update `create_booking` exception block**

Add to the existing exception handlers for `create_booking`:

```python
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    CancelDeadlinePassed,
    NoActiveQuota,
    NotBookingOwnerError,
    QuotaExhausted,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
    TrialAlreadyUsed,
)

@router.post(
    "/bookings",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    payload: BookingCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    try:
        booking = await service.book(user=user, slot_id=payload.slot_id)
    except SlotNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found") from exc
    except (SlotNotOpenError, SlotInPastError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except (SlotFullError, AlreadyBookedError) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except TrialAlreadyUsed as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "trial_already_used") from exc
    except NoActiveQuota as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "no_active_quota") from exc
    except QuotaExhausted as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "quota_exhausted") from exc
    return _booking_response(booking)
```

- [ ] **Step 2: Update `cancel_booking` exception block**

```python
@router.patch(
    "/bookings/{booking_id}/cancel",
    response_model=BookingResponse,
)
async def cancel_booking(
    booking_id: str,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    try:
        booking = await service.cancel(user=user, booking_id=booking_id)
    except BookingNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found") from exc
    except NotBookingOwnerError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You can only cancel your own bookings"
        ) from exc
    except CancelDeadlinePassed as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "cancel_deadline_passed"
        ) from exc
    return _booking_response(booking)
```

- [ ] **Step 3: tsc + ruff**

```
cd backend && uv run ruff check app/api/endpoints/bookings.py
```

- [ ] **Step 4: Stage**

```
git add backend/app/api/endpoints/bookings.py
```

---

## Task 7: Extend `GET /users/me` with plan + current_month_quota

**Files:**
- Modify: `backend/app/api/schemas/user.py`
- Modify: `backend/app/api/endpoints/users.py`

- [ ] **Step 1: Update UserResponse schema**

In `backend/app/api/schemas/user.py`, add fields to `UserResponse`:

```python
from typing import Literal


class MonthQuotaSummary(BaseModel):
    granted: int
    used: int
    remaining: int


class UserResponse(BaseModel):
    uid: str
    email: str
    name: str
    phone: str | None
    plan: Literal["light", "standard", "intensive"] | None = None
    trial_used: bool = False
    current_month_quota: MonthQuotaSummary | None = None
    created_at: datetime
    updated_at: datetime
```

(Open the file, preserve the existing top-of-file imports + other schemas.)

- [ ] **Step 2: Update endpoint to populate the new fields**

In `backend/app/api/endpoints/users.py`, change `_user_to_response` and `get_profile`:

```python
from datetime import UTC, datetime
from zoneinfo import ZoneInfo
from app.api.dependencies.repositories import get_monthly_quota_repository
from app.api.schemas.user import MonthQuotaSummary, UserResponse
from app.domain.repositories.monthly_quota_repository import MonthlyQuotaRepository

JST = ZoneInfo("Asia/Tokyo")


def _user_to_response(
    user: User, quota_summary: MonthQuotaSummary | None = None
) -> UserResponse:
    return UserResponse(
        uid=user.uid,
        email=user.email,
        name=user.name,
        phone=user.phone.value if user.phone else None,
        plan=user.plan.value if user.plan else None,
        trial_used=user.trial_used,
        current_month_quota=quota_summary,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(
    user: Annotated[User, Depends(get_current_user)],
    quota_repo: Annotated[MonthlyQuotaRepository, Depends(get_monthly_quota_repository)],
) -> UserResponse:
    ym = datetime.now(UTC).astimezone(JST).strftime("%Y-%m")
    quota = await quota_repo.find(user.uid, ym)
    summary = (
        MonthQuotaSummary(granted=quota.granted, used=quota.used, remaining=quota.remaining)
        if quota
        else None
    )
    return _user_to_response(user, summary)
```

Update `signup_initialize` and `update_profile` to call `_user_to_response(user)` with no quota arg (default None).

- [ ] **Step 3: Stage**

```
git add backend/app/api/schemas/user.py backend/app/api/endpoints/users.py
```

---

## Task 8: scripts/set_plan.py

**Files:**
- Create: `scripts/set_plan.py`

```python
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
import uuid as _uuid
from datetime import UTC, datetime, timedelta
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
        ym = now_utc.astimezone(JST).strftime("%Y-%m")
        next_month_first = (now_utc.astimezone(JST).replace(day=1) + timedelta(days=32)).replace(day=1)
        expires = next_month_first.astimezone(UTC)
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
```

- [ ] **Step: py_compile**

```
python3 -m py_compile scripts/set_plan.py
```

- [ ] **Step: Stage**

```
git add scripts/set_plan.py
```

---

## Task 9: Cloud Function source — grant_monthly_quota

**Files:**
- Create: `terraform/modules/cloud-function-monthly-quota-grant/source/main.py`
- Create: `terraform/modules/cloud-function-monthly-quota-grant/source/test_main.py`
- Create: `terraform/modules/cloud-function-monthly-quota-grant/source/requirements.txt`

- [ ] **Step 1: Write failing tests**

`source/test_main.py`:

```python
"""Tests for the monthly-quota-grant Cloud Function (mocked Firestore)."""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from main import (
    JST,
    QUOTA_BY_PLAN,
    build_quota_payload,
    next_month_first_jst,
)


def test_quota_by_plan_constants() -> None:
    assert QUOTA_BY_PLAN["light"] == 4
    assert QUOTA_BY_PLAN["standard"] == 8
    assert QUOTA_BY_PLAN["intensive"] == 16


def test_build_quota_payload_for_standard() -> None:
    now = datetime(2026, 6, 1, 0, 0, tzinfo=JST)
    payload = build_quota_payload(uid="u1", plan="standard", now_utc=now)
    assert payload["user_id"] == "u1"
    assert payload["year_month"] == "2026-06"
    assert payload["granted"] == 8
    assert payload["used"] == 0
    assert payload["plan_at_grant"] == "standard"


def test_next_month_first_jst_handles_month_rollover() -> None:
    nm = next_month_first_jst(datetime(2026, 12, 15, 10, 0, tzinfo=JST))
    assert nm.year == 2027
    assert nm.month == 1
    assert nm.day == 1
```

- [ ] **Step 2: Create main.py**

```python
"""Cloud Function (Gen2) — monthly quota grant.

Triggered by Cloud Scheduler at 0:00 JST on the 1st of each month. Walks
users/{uid} where plan != null, and creates monthly_quota/{uid}_{YYYY-MM}
if not already present (idempotent under Scheduler retries).
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
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
```

- [ ] **Step 3: Create requirements.txt**

```
google-cloud-firestore>=2.16
```

- [ ] **Step 4: Run tests, expect PASS**

```
cd terraform/modules/cloud-function-monthly-quota-grant/source && \
  python3 -m pytest test_main.py -v
```

- [ ] **Step 5: Stage**

```
git add terraform/modules/cloud-function-monthly-quota-grant/source/
```

---

## Task 10: Terraform module — cloud-function-monthly-quota-grant

**Files:**
- Create: `terraform/modules/cloud-function-monthly-quota-grant/main.tf`
- Create: `terraform/modules/cloud-function-monthly-quota-grant/variables.tf`
- Create: `terraform/modules/cloud-function-monthly-quota-grant/outputs.tf`
- Create: `terraform/modules/cloud-function-monthly-quota-grant/versions.tf`

Mirror `terraform/modules/cloud-function-slot-generator/` with these substitutions:

| slot-generator | monthly-quota-grant |
|---|---|
| name `slot-generator` | name `monthly-quota-grant` |
| entry_point `generate_daily_slots` | entry_point `grant_monthly_quota` |
| pubsub_topic `slot-generator-daily` | pubsub_topic `monthly-quota-grant-monthly` |
| scheduler_job `slot-generator-daily` | scheduler_job `monthly-quota-grant-monthly` |
| schedule `0 0 * * *` | schedule `0 0 1 * *` |
| SA `slot-generator` | SA `monthly-quota-grant` |
| bucket `${prj}-slot-generator-source` | bucket `${prj}-monthly-quota-grant-source` |

Copy `terraform/modules/cloud-function-slot-generator/main.tf` verbatim and apply those replacements. Keep the `gcp_project_number`-via-input pattern (not the `data.google_project.current` API call — see fix from PR #10 spec for rationale).

- [ ] **Step 1: Copy + rename in all 4 files**

(The implementer should literally `cp` the slot-generator files, then `sed` / hand-edit per the table above.)

- [ ] **Step 2: terraform fmt + validate**

```
cd terraform/modules/cloud-function-monthly-quota-grant && \
  terraform init -backend=false && \
  terraform fmt -check && \
  terraform validate
```

- [ ] **Step 3: Stage**

```
git add terraform/modules/cloud-function-monthly-quota-grant/{main,variables,outputs,versions}.tf
```

---

## Task 11: Terragrunt stack — terraform/envs/prod/monthly-quota

**Files:**
- Create: `terraform/envs/prod/monthly-quota/terragrunt.hcl`

```hcl
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/terraform/modules/cloud-function-monthly-quota-grant"
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

inputs = {
  gcp_project_id     = local.env.locals.gcp_project_id
  gcp_project_number = "934069947997"
  region             = local.env.locals.region
}
```

- [ ] **Step: hclfmt + Stage**

```
cd terraform/envs/prod/monthly-quota && terragrunt hcl format --check
git add terraform/envs/prod/monthly-quota/terragrunt.hcl
```

---

## Task 12: scripts/backfill_monthly_quota.py

**Files:**
- Create: `scripts/backfill_monthly_quota.py`

```python
#!/usr/bin/env python
"""One-shot backfill for monthly_quota.

Usage:
  uv run python scripts/backfill_monthly_quota.py --month 2026-05
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime, timedelta
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
        ref.set({
            "user_id": uid,
            "year_month": args.month,
            "plan_at_grant": plan,
            "granted": QUOTA_BY_PLAN[plan],
            "used": 0,
            "granted_at": granted_at,
            "expires_at": expires,
        })
        created += 1
        print(f"  {uid} ({plan}): granted {QUOTA_BY_PLAN[plan]}")
    print(f"Done. created={created} skipped={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step: py_compile + Stage**

```
python3 -m py_compile scripts/backfill_monthly_quota.py
git add scripts/backfill_monthly_quota.py
```

---

## Task 13: Frontend — `User` + `MonthQuotaSummary` types

**Files:**
- Modify: `frontend/src/lib/booking.ts` (or a new file `frontend/src/lib/user.ts` — implementer's choice, but keep it small)

- [ ] **Step 1: Add types**

If the User type is currently defined in `booking.ts`, extend it. Otherwise add to a shared location. The shape should be:

```ts
export type Plan = 'light' | 'standard' | 'intensive';

export interface MonthQuotaSummary {
  granted: number;
  used: number;
  remaining: number;
}

export interface MeResponse {
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  plan: Plan | null;
  trial_used: boolean;
  current_month_quota: MonthQuotaSummary | null;
  created_at: string;
  updated_at: string;
}

export async function getMe(): Promise<MeResponse> {
  const resp = await axios.get<MeResponse>(`${API_BASE}/api/v1/users/me`, {
    headers: await authHeaders(),
  });
  return resp.data;
}
```

- [ ] **Step 2: tsc + Stage**

```
cd frontend && npx tsc --noEmit
git add frontend/src/lib/booking.ts  # or wherever you put it
```

---

## Task 14: ProfileCard — plan + quota display

**Files:**
- Modify: `frontend/src/app/mypage/_components/ProfileCard.tsx`

Read the existing ProfileCard. Add a section below the existing profile info:

```tsx
const PLAN_LABEL: Record<Plan, string> = {
  light: 'ライトプラン',
  standard: 'スタンダードプラン',
  intensive: '集中プラン',
};

// In the JSX, after existing fields:
{me.plan && (
  <p className="mt-2 text-sm">
    プラン: <strong>{PLAN_LABEL[me.plan]}</strong>
  </p>
)}
{me.current_month_quota && (
  <p className="text-sm">
    今月のコマ: {me.current_month_quota.used} / {me.current_month_quota.granted} 使用
    (残 {me.current_month_quota.remaining})
  </p>
)}
{!me.trial_used && (
  <p className="mt-1 text-xs text-green-700">無料体験予約あり</p>
)}
```

(Implementer wires `me` from a useEffect that calls `getMe()`. Skip if ProfileCard already receives the user as props — in that case extend the prop type instead.)

- [ ] **Step: tsc + lint + Stage**

```
cd frontend && npx tsc --noEmit
git add frontend/src/app/mypage/_components/ProfileCard.tsx
```

---

## Task 15: SlotCell — `'within24h'` state

**Files:**
- Modify: `frontend/src/app/book/_components/SlotCell.tsx`
- Modify: `frontend/src/app/book/_components/__tests__/SlotCell.test.tsx`

- [ ] **Step 1: Append failing test**

```tsx
it('renders ▲ for within24h state and is clickable', () => {
  const onClick = jest.fn();
  const s = slot();
  render(
    <SlotCell state={{ kind: 'within24h', slot: s }} onClick={onClick} />
  );
  expect(screen.getByText('▲')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledWith(s);
});
```

- [ ] **Step 2: Extend the CellState union and render branch**

```tsx
export type CellState =
  | { kind: 'open'; slot: LessonSlot }
  | { kind: 'within24h'; slot: LessonSlot }  // open but starts < 24h from now
  | { kind: 'closed'; slot: LessonSlot }
  | { kind: 'full'; slot: LessonSlot }
  | { kind: 'mine'; booking: Booking }
  | { kind: 'empty' };

// Add to the body, before the closed/full branch:
if (state.kind === 'within24h') {
  return (
    <button
      type="button"
      onClick={() => onClick(state.slot)}
      title="24時間以内はキャンセル不可"
      className="flex h-8 w-full items-center justify-center bg-yellow-100 text-sm hover:bg-yellow-200"
    >
      ▲
    </button>
  );
}
```

- [ ] **Step 3: Run, expect PASS**

```
cd frontend && npm test -- src/app/book/_components/__tests__/SlotCell.test.tsx
```

- [ ] **Step 4: Stage**

```
git add frontend/src/app/book/_components/SlotCell.tsx \
        frontend/src/app/book/_components/__tests__/SlotCell.test.tsx
```

---

## Task 16: BookingGrid — emit within24h state

**Files:**
- Modify: `frontend/src/app/book/_components/BookingGrid.tsx`

Find the `stateFor` function. Insert a check between the slot match and the `open` return:

```tsx
const stateFor = (date: Date, hour: number, minute: number): CellState => {
  const mine = bookings.find(/* unchanged */);
  if (mine) return { kind: 'mine', booking: mine };

  const slot = slots.find(s => slotMatchesCell(s, date, hour, minute));
  if (!slot) return { kind: 'empty' };
  if (slot.status === 'closed') return { kind: 'closed', slot };
  if (slot.remaining <= 0) return { kind: 'full', slot };

  // New: within24h check
  const start = new Date(slot.start_at);
  const ms24h = 24 * 60 * 60 * 1000;
  if (start.getTime() - Date.now() < ms24h) {
    return { kind: 'within24h', slot };
  }

  return { kind: 'open', slot };
};
```

- [ ] **Step: tsc + Stage**

```
cd frontend && npx tsc --noEmit
git add frontend/src/app/book/_components/BookingGrid.tsx
```

---

## Task 17: /book page — error dialog for plan/quota/trial/24h

**Files:**
- Modify: `frontend/src/app/book/page.tsx`

- [ ] **Step: Replace `handleConfirm` and add error normalization**

In `frontend/src/app/book/page.tsx`, update the catch block of `handleConfirm` to map specific backend error codes to messages:

```tsx
const ERROR_MESSAGES: Record<string, string> = {
  trial_already_used: '無料体験は既に使用済みです。',
  no_active_quota: '今月のコマが付与されていません。プラン契約状況をご確認ください。',
  quota_exhausted: '今月のコマを使い切りました。来月までお待ちください。',
  cancel_deadline_passed: '24時間以内の予約はキャンセルできません。',
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
      .response?.data?.detail ?? '';
    const friendly = ERROR_MESSAGES[detail] ?? '予約に失敗しました';
    notify.error(friendly);
    setPending(null);
  }
};
```

(Optional bonus: if `detail === 'cancel_deadline_passed'` is irrelevant for /book — that error happens on cancel, not book — leaving it in the map is harmless.)

- [ ] **Step: tsc + lint + Stage**

```
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
git add frontend/src/app/book/page.tsx
```

---

## Task 18: BookingsList — disable cancel within 24h

**Files:**
- Modify: `frontend/src/app/mypage/_components/BookingsList.tsx`

- [ ] **Step: Disable button when `slot.start_at - now < 24h`**

Inside the cancel button rendering for each booking:

```tsx
const start = new Date(booking.slot.start_at);
const ms24h = 24 * 60 * 60 * 1000;
const within24h = start.getTime() - Date.now() < ms24h;

// On the cancel button:
<button
  onClick={() => handleCancel(booking.id)}
  disabled={busyId === booking.id || within24h}
  title={within24h ? '24時間以内はキャンセル不可' : undefined}
  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
>
  {busyId === booking.id ? 'キャンセル中…' : 'キャンセル'}
</button>
```

(Implementer should read the existing BookingsList structure first; the snippet above shows the disable logic to wire in.)

- [ ] **Step: tsc + Stage**

```
cd frontend && npx tsc --noEmit
git add frontend/src/app/mypage/_components/BookingsList.tsx
```

---

## Task 19: Full regression + apply + backfill + PR

- [ ] **Step 1: Backend full pytest**

```
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest
```
Expected: all new tests PASS; the pre-existing phone-normalization failure may remain (unrelated, present on main).

- [ ] **Step 2: Backend mypy + ruff**

```
cd backend && uv run mypy app/domain app/services
cd backend && uv run ruff check .
```

- [ ] **Step 3: Frontend jest + tsc + lint**

```
cd frontend && npm test -- --watchAll=false
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```

- [ ] **Step 4: Build + push backend image**

```
cd /Users/kz/work/english-caf/kz-bz-english2
TAG=$(git rev-parse --short HEAD)
docker buildx build --platform linux/amd64 \
  -f backend/Dockerfile.prod \
  -t "asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe/api:$TAG" \
  --push backend
```

- [ ] **Step 5: Push branch + open PR**

```
git push -u origin feat/lesson-booking-4b
gh pr create --title "feat: lesson booking 4b — monthly quota + 24h cancel + trial counter" \
  --body "$(cat <<'EOF'
## Summary
ユーザーごとに月次でコマを付与・消費する仕組み + 24h キャンセル規則 + trial 生涯1回ロジック。Stripe webhook (4c) の前段になる土台。

## Backend
- `users/{uid}` に `plan`, `plan_started_at`, `trial_used` 追加
- 新 `MonthlyQuota` entity + repository (`monthly_quota/{uid}_{YYYY-MM}`)
- `BookingService.book()`: trial check (1回限り) + quota atomic decrement
- `BookingService.cancel()`: 24h ルール + (24h以上前なら) quota 返却
- 新エラー: `TrialAlreadyUsed`, `NoActiveQuota`, `QuotaExhausted`, `CancelDeadlinePassed`
- `GET /api/v1/users/me` extended with plan + trial_used + current_month_quota

## Infra
- 新 terraform module `cloud-function-monthly-quota-grant`
- 新 terragrunt stack `monthly-quota`
- Cloud Function (Python 3.12) + Cloud Scheduler @ 0:00 JST 毎月1日 で全プランユーザーに quota 自動付与
- Idempotent (既存 monthly_quota row はスキップ)

## Scripts
- `scripts/set_plan.py` — admin がユーザーに plan を割当
- `scripts/backfill_monthly_quota.py` — 既存ユーザーに当月分 quota を後付け

## Frontend
- `/mypage` で プラン名 + 今月コマ残り表示
- `/book` SlotCell に `▲` (24h 以内、warning) state 追加
- `/book` で API エラーを日本語メッセージにマップ (trial_already_used / quota_exhausted / no_active_quota / cancel_deadline_passed)
- `/mypage` BookingsList で 24h 以内予約のキャンセルボタン disable

## Migration (post-merge)
1. 新 image deploy: `gcloud run services update english-cafe-api --image=...:$(git rev-parse --short HEAD)`
2. HCP workspace `english-cafe-prod-monthly-quota` を UI で作成 (WIF binding + IAM 込み手動セットアップ)
3. `cd terraform/envs/prod/monthly-quota && terragrunt apply`
4. テスト用に kz さんに `intensive` plan 付与: `uv run python scripts/set_plan.py <kz-uid> --plan intensive --grant-now`
5. 全既存ユーザーに当月分 backfill (オプション): `uv run python scripts/backfill_monthly_quota.py --month 2026-05`

## Test plan
- [x] backend pytest passes (booking_service + monthly_quota_repo + user entity)
- [x] frontend jest passes (SlotCell new state)
- [x] terraform fmt + validate (new module)
- [ ] manual: /mypage shows plan + quota / /book ▲ states / book → quota -= 1 / cancel 24h+ → quota +=1 / cancel <24h → 409

Spec: docs/superpowers/specs/2026-05-14-lesson-booking-4b-design.md
Plan: docs/superpowers/plans/2026-05-14-lesson-booking-4b.md
EOF
)"
```

---

## Critical Files (for the implementer)

### Backend (entrypoints to study before touching)
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/services/booking_service.py` — existing book/cancel transactions (model the quota integration on these)
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/domain/entities/user.py`
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/api/dependencies/repositories.py`
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/domain/enums/contact.py` — for `LessonType.TRIAL` constant

### Infra (reference pattern)
- `/Users/kz/work/english-caf/kz-bz-english2/terraform/modules/cloud-function-slot-generator/` — full template (already in prod & tested)
- `/Users/kz/work/english-caf/kz-bz-english2/terraform/envs/prod/scheduler-slots/terragrunt.hcl` — stack pattern

### Frontend
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/lib/booking.ts`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/mypage/_components/ProfileCard.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/book/_components/SlotCell.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/book/_components/BookingGrid.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/book/page.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/mypage/_components/BookingsList.tsx`
