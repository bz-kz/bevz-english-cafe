# Admin Force-Booking / Force-Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin endpoints + UI so an admin can force-book and force-cancel any user's booking, with selectable quota/trial side-effects, bypassing 24h rule while still respecting capacity.

**Architecture:** Extend `BookingService` with `admin_force_book` / `admin_force_cancel` methods that share the existing Firestore async-transaction structure but skip user-side validations. Add a new admin API surface (`/api/v1/admin/*`) gated by `get_admin_user`. Frontend gets 3 new components on `/admin/lessons/[id]` and a typed API client.

**Tech Stack:** FastAPI + Firestore (AsyncClient) + Python 3.12 (uv) + Next.js 14 + React 18 + Tailwind + jest/RTL.

**Spec:** [`docs/superpowers/specs/2026-05-15-admin-force-booking-design.md`](../specs/2026-05-15-admin-force-booking-design.md)

---

## File Structure

### Backend — new files
- `backend/app/api/endpoints/admin.py` — admin endpoints (force-book, force-cancel, search-users, list-users)
- `backend/app/api/schemas/admin.py` — Pydantic request/response models
- `backend/tests/services/test_booking_service_admin.py` — service tests
- `backend/tests/api/test_admin_endpoints.py` — API tests
- `backend/tests/infrastructure/test_firestore_user_repository.py` — user repo search/list_all tests (if missing)

### Backend — modified
- `backend/app/services/booking_errors.py` — add `UserNotFoundError`
- `backend/app/domain/repositories/user_repository.py` — add `search`, `list_all` abstract methods
- `backend/app/infrastructure/repositories/firestore_user_repository.py` — implement `search`, `list_all`
- `backend/app/services/booking_service.py` — add `admin_force_book`, `admin_force_cancel`
- `backend/app/main.py` — register admin router
- `firestore.indexes.json` — add users.email/name/updated_at indexes

### Frontend — new files
- `frontend/src/lib/admin-booking.ts` — typed API client
- `frontend/src/app/admin/lessons/[id]/_components/AdminUserPicker.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/AddBookingDialog.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/ForceCancelDialog.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/__tests__/AdminUserPicker.test.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/__tests__/AddBookingDialog.test.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/__tests__/ForceCancelDialog.test.tsx`

### Frontend — modified
- `frontend/src/app/admin/lessons/[id]/page.tsx` — integrate new components

---

## Task 1: Add `UserNotFoundError`

**Files:**
- Modify: `backend/app/services/booking_errors.py`

- [ ] **Step 1: Add exception class**

Add to `backend/app/services/booking_errors.py` after `NotBookingOwnerError`:

```python
class UserNotFoundError(BookingError):
    """The target user (force-book recipient) does not exist."""
```

- [ ] **Step 2: Verify import does not break**

Run: `cd backend && uv run python -c "from app.services.booking_errors import UserNotFoundError; print(UserNotFoundError.__doc__)"`
Expected: prints the docstring.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/booking_errors.py
git commit -m "feat(booking-errors): add UserNotFoundError for admin force-book"
```

---

## Task 2: Extend `UserRepository` interface

**Files:**
- Modify: `backend/app/domain/repositories/user_repository.py`

- [ ] **Step 1: Add abstract methods**

Replace `backend/app/domain/repositories/user_repository.py` body to:

```python
"""User repository interface (DDD outer→inner contract)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities.user import User


class UserRepository(ABC):
    @abstractmethod
    async def save(self, user: User) -> User:
        ...

    @abstractmethod
    async def find_by_uid(self, uid: str) -> User | None:
        ...

    @abstractmethod
    async def find_by_email(self, email: str) -> User | None:
        ...

    @abstractmethod
    async def search(self, q: str, *, limit: int = 50) -> list[User]:
        """email/name prefix match (case-sensitive)。最大 limit 件。"""
        ...

    @abstractmethod
    async def list_all(self, *, limit: int = 50) -> list[User]:
        """updated_at desc で limit 件 (admin combo-box デフォルト)。"""
        ...
```

- [ ] **Step 2: Verify mypy strict still passes (the existing impl will now be abstract-violating)**

Run: `cd backend && uv run mypy app/domain`
Expected: PASS (mypy doesn't care about unimplemented abstracts — only the concrete repo will).

- [ ] **Step 3: Commit**

```bash
git add backend/app/domain/repositories/user_repository.py
git commit -m "feat(user-repo): add search + list_all abstract methods"
```

---

## Task 3: Implement `FirestoreUserRepository.search` + `list_all`

**Files:**
- Modify: `backend/app/infrastructure/repositories/firestore_user_repository.py`
- Test: `backend/tests/infrastructure/test_firestore_user_repository.py` (create if missing)

- [ ] **Step 1: Write failing tests**

Create `backend/tests/infrastructure/test_firestore_user_repository.py`:

```python
"""Firestore-emulator tests for UserRepository search + list_all."""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.user import User
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)


def _user(uid: str, email: str, name: str) -> User:
    now = datetime.now(UTC)
    return User(
        uid=uid,
        email=email,
        name=name,
        phone=None,
        plan=None,
        plan_started_at=None,
        trial_used=False,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("users").stream():
        await doc.reference.delete()
    return FirestoreUserRepository(client)


async def test_search_email_prefix(repo):
    await repo.save(_user("u1", "taro@example.com", "山田太郎"))
    await repo.save(_user("u2", "hanako@example.com", "佐藤花子"))
    result = await repo.search("taro")
    assert len(result) == 1
    assert result[0].uid == "u1"


async def test_search_name_prefix(repo):
    await repo.save(_user("u1", "taro@example.com", "山田太郎"))
    await repo.save(_user("u2", "hanako@example.com", "佐藤花子"))
    result = await repo.search("佐藤")
    assert len(result) == 1
    assert result[0].uid == "u2"


async def test_search_empty_query_returns_empty(repo):
    await repo.save(_user("u1", "taro@example.com", "山田太郎"))
    assert await repo.search("") == []


async def test_list_all_returns_users(repo):
    await repo.save(_user("u1", "taro@example.com", "山田太郎"))
    await repo.save(_user("u2", "hanako@example.com", "佐藤花子"))
    result = await repo.list_all(limit=10)
    assert {u.uid for u in result} == {"u1", "u2"}


async def test_list_all_respects_limit(repo):
    for i in range(5):
        await repo.save(_user(f"u{i}", f"u{i}@example.com", f"name{i}"))
    result = await repo.list_all(limit=2)
    assert len(result) == 2
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/test_firestore_user_repository.py -v`
Expected: FAIL with `AttributeError: 'FirestoreUserRepository' object has no attribute 'search'`.

- [ ] **Step 3: Implement methods**

Append to `backend/app/infrastructure/repositories/firestore_user_repository.py` inside the class:

```python
    async def search(self, q: str, *, limit: int = 50) -> list[User]:
        if not q:
            return []
        # prefix range trick: use '' as upper bound sentinel
        end = q + ""
        found: dict[str, User] = {}

        email_q = (
            self._collection.where("email", ">=", q)
            .where("email", "<", end)
            .limit(limit)
        )
        async for doc in email_q.stream():
            found[doc.id] = self._from_dict(doc.to_dict(), doc.id)

        name_q = (
            self._collection.where("name", ">=", q)
            .where("name", "<", end)
            .limit(limit)
        )
        async for doc in name_q.stream():
            if doc.id not in found:
                found[doc.id] = self._from_dict(doc.to_dict(), doc.id)

        return list(found.values())[:limit]

    async def list_all(self, *, limit: int = 50) -> list[User]:
        q = self._collection.order_by(
            "updated_at", direction=fs.Query.DESCENDING
        ).limit(limit)
        out: list[User] = []
        async for doc in q.stream():
            out.append(self._from_dict(doc.to_dict(), doc.id))
        return out
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/test_firestore_user_repository.py -v`
Expected: 5 passed.

- [ ] **Step 5: Ruff check**

Run: `cd backend && uv run ruff check app/infrastructure/repositories/firestore_user_repository.py tests/infrastructure/test_firestore_user_repository.py`
Expected: All checks passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/infrastructure/repositories/firestore_user_repository.py \
        backend/tests/infrastructure/test_firestore_user_repository.py
git commit -m "feat(user-repo): firestore impl of search + list_all"
```

---

## Task 4: `BookingService.admin_force_book`

**Files:**
- Modify: `backend/app/services/booking_service.py`
- Test: `backend/tests/services/test_booking_service_admin.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/services/test_booking_service_admin.py`:

```python
"""Integration tests for BookingService.admin_force_book + admin_force_cancel."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.entities.monthly_quota import MonthlyQuota
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
    SlotFullError,
    SlotNotFoundError,
    UserNotFoundError,
)
from app.services.booking_service import BookingService


def _now() -> datetime:
    return datetime.now(UTC)


@pytest.fixture
async def firestore_client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture
async def service(firestore_client):
    for col in ("lesson_slots", "bookings", "users", "monthly_quota"):
        async for doc in firestore_client.collection(col).stream():
            await doc.reference.delete()
    slot_repo = FirestoreLessonSlotRepository(firestore_client)
    booking_repo = FirestoreBookingRepository(firestore_client)
    quota_repo = FirestoreMonthlyQuotaRepository(firestore_client)
    user_repo = FirestoreUserRepository(firestore_client)
    return BookingService(slot_repo, booking_repo, firestore_client, quota_repo, user_repo)


async def _make_slot(
    client, *, start_offset_h=48, capacity=5, lesson_type=LessonType.GROUP, status=SlotStatus.OPEN
) -> str:
    slot_id = str(uuid4())
    start = _now() + timedelta(hours=start_offset_h)
    await client.collection("lesson_slots").document(slot_id).set({
        "id": slot_id,
        "start_at": start,
        "end_at": start + timedelta(minutes=30),
        "lesson_type": lesson_type.value,
        "capacity": capacity,
        "booked_count": 0,
        "price_yen": None,
        "teacher_id": None,
        "notes": None,
        "status": status.value,
        "created_at": _now(),
        "updated_at": _now(),
    })
    return slot_id


async def _make_user(client, *, uid="u1", email="u1@example.com", trial_used=False) -> None:
    await client.collection("users").document(uid).set({
        "uid": uid,
        "email": email,
        "name": "Test",
        "phone": None,
        "plan": None,
        "plan_started_at": None,
        "trial_used": trial_used,
        "created_at": _now(),
        "updated_at": _now(),
    })


async def test_force_book_happy_path_no_quota(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED
    snap = await firestore_client.collection("lesson_slots").document(slot_id).get()
    assert snap.to_dict()["booked_count"] == 1


async def test_force_book_within_24h_succeeds(service, firestore_client):
    slot_id = await _make_slot(firestore_client, start_offset_h=1)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED


async def test_force_book_past_slot_succeeds(service, firestore_client):
    slot_id = await _make_slot(firestore_client, start_offset_h=-2)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED


async def test_force_book_closed_slot_succeeds(service, firestore_client):
    slot_id = await _make_slot(firestore_client, status=SlotStatus.CLOSED)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED


async def test_force_book_capacity_full_raises(service, firestore_client):
    slot_id = await _make_slot(firestore_client, capacity=1)
    await _make_user(firestore_client, uid="u1")
    await _make_user(firestore_client, uid="u2", email="u2@example.com")
    await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    with pytest.raises(SlotFullError):
        await service.admin_force_book(
            slot_id=slot_id, user_id="u2", consume_quota=False, consume_trial=False
        )


async def test_force_book_unknown_user_raises(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    with pytest.raises(UserNotFoundError):
        await service.admin_force_book(
            slot_id=slot_id, user_id="ghost", consume_quota=False, consume_trial=False
        )


async def test_force_book_duplicate_raises(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    with pytest.raises(AlreadyBookedError):
        await service.admin_force_book(
            slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
        )


async def test_force_book_consume_trial_sets_flag(service, firestore_client):
    slot_id = await _make_slot(firestore_client, lesson_type=LessonType.TRIAL)
    await _make_user(firestore_client)
    await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=True
    )
    snap = await firestore_client.collection("users").document("u1").get()
    assert snap.to_dict()["trial_used"] is True


async def test_force_book_consume_quota_when_doc_missing_skips(service, firestore_client):
    """quota doc が無くても booking 自体は成功する。"""
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=True, consume_trial=False
    )
    assert booking.status == BookingStatus.CONFIRMED


async def test_force_book_consume_quota_allows_overuse(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    from zoneinfo import ZoneInfo
    ym = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m")
    await firestore_client.collection("monthly_quota").document(f"u1_{ym}").set({
        "user_id": "u1",
        "year_month": ym,
        "granted": 4,
        "used": 4,
        "granted_at": _now(),
    })
    await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=True, consume_trial=False
    )
    snap = await firestore_client.collection("monthly_quota").document(f"u1_{ym}").get()
    assert snap.to_dict()["used"] == 5  # used > granted 許容
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service_admin.py -v -k force_book`
Expected: FAIL with `AttributeError: 'BookingService' object has no attribute 'admin_force_book'`.

- [ ] **Step 3: Implement `admin_force_book`**

Add to `backend/app/services/booking_service.py` after the `book` method (before `cancel`):

```python
    async def admin_force_book(
        self,
        *,
        slot_id: str,
        user_id: str,
        consume_quota: bool,
        consume_trial: bool,
    ) -> Booking:
        """Admin による強制予約。24h/quota/trial/closed/past を bypass する。capacity と重複は守る。"""
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

            if slot.is_full:
                raise SlotFullError(slot_id)

            existing_query = (
                bookings_col.where("user_id", "==", user_id)
                .where("slot_id", "==", slot_id)
                .where("status", "==", BookingStatus.CONFIRMED.value)
                .limit(1)
            )
            async for _doc in existing_query.stream(transaction=tx):
                raise AlreadyBookedError(slot_id)

            user_ref = users_col.document(user_id)
            user_snap = await user_ref.get(transaction=tx)
            if not user_snap.exists:
                raise UserNotFoundError(user_id)

            quota_ref = None
            quota_used: int | None = None
            if consume_quota and slot.lesson_type != LessonType.TRIAL:
                ym = _jst_year_month(_utc_now())
                quota_ref = self._fs.collection("monthly_quota").document(
                    f"{user_id}_{ym}"
                )
                q_snap = await quota_ref.get(transaction=tx)
                if q_snap.exists:
                    quota_used = int(cast(dict[str, Any], q_snap.to_dict())["used"])

            booking = Booking(
                id=new_booking_id,
                slot_id=slot_id,
                user_id=user_id,
                status=BookingStatus.CONFIRMED,
                created_at=_utc_now(),
                cancelled_at=None,
            )
            tx.update(
                slot_ref,
                {"booked_count": slot.booked_count + 1, "updated_at": _utc_now()},
            )
            tx.set(
                bookings_col.document(str(booking.id)),
                self._booking_repo._to_dict(booking),
            )
            if consume_trial and slot.lesson_type == LessonType.TRIAL:
                tx.update(user_ref, {"trial_used": True, "updated_at": _utc_now()})
            if quota_ref is not None and quota_used is not None:
                tx.update(quota_ref, {"used": quota_used + 1})
            return booking

        return cast(Booking, await txn(self._fs.transaction()))
```

Also add `UserNotFoundError` to the import block at the top of the file:

```python
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    CancelDeadlinePassedError,
    NoActiveQuotaError,
    NotBookingOwnerError,
    QuotaExhaustedError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
    TrialAlreadyUsedError,
    UserNotFoundError,
)
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service_admin.py -v -k force_book`
Expected: 10 passed.

- [ ] **Step 5: Ruff + mypy**

Run: `cd backend && uv run ruff check app/services/booking_service.py tests/services/test_booking_service_admin.py && uv run mypy app/services`
Expected: All checks passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/booking_service.py \
        backend/tests/services/test_booking_service_admin.py
git commit -m "feat(booking): admin_force_book bypasses 24h/quota/trial, keeps capacity"
```

---

## Task 5: `BookingService.admin_force_cancel`

**Files:**
- Modify: `backend/app/services/booking_service.py`
- Test: `backend/tests/services/test_booking_service_admin.py` (extend)

- [ ] **Step 1: Append failing tests**

Append to `backend/tests/services/test_booking_service_admin.py`:

```python
async def test_force_cancel_happy_path(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    cancelled = await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=False
    )
    assert cancelled.status == BookingStatus.CANCELLED
    snap = await firestore_client.collection("lesson_slots").document(slot_id).get()
    assert snap.to_dict()["booked_count"] == 0


async def test_force_cancel_within_24h_succeeds(service, firestore_client):
    slot_id = await _make_slot(firestore_client, start_offset_h=1)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    cancelled = await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=False
    )
    assert cancelled.status == BookingStatus.CANCELLED


async def test_force_cancel_idempotent(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=False
    )
    again = await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=False
    )
    assert again.status == BookingStatus.CANCELLED
    snap = await firestore_client.collection("lesson_slots").document(slot_id).get()
    assert snap.to_dict()["booked_count"] == 0  # not decremented twice


async def test_force_cancel_refund_quota(service, firestore_client):
    slot_id = await _make_slot(firestore_client)
    await _make_user(firestore_client)
    from zoneinfo import ZoneInfo
    ym = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m")
    await firestore_client.collection("monthly_quota").document(f"u1_{ym}").set({
        "user_id": "u1",
        "year_month": ym,
        "granted": 4,
        "used": 1,
        "granted_at": _now(),
    })
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=False
    )
    await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=True, refund_trial=False
    )
    snap = await firestore_client.collection("monthly_quota").document(f"u1_{ym}").get()
    assert snap.to_dict()["used"] == 0


async def test_force_cancel_refund_trial(service, firestore_client):
    slot_id = await _make_slot(firestore_client, lesson_type=LessonType.TRIAL)
    await _make_user(firestore_client, trial_used=False)
    booking = await service.admin_force_book(
        slot_id=slot_id, user_id="u1", consume_quota=False, consume_trial=True
    )
    await service.admin_force_cancel(
        booking_id=str(booking.id), refund_quota=False, refund_trial=True
    )
    snap = await firestore_client.collection("users").document("u1").get()
    assert snap.to_dict()["trial_used"] is False
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service_admin.py -v -k force_cancel`
Expected: FAIL with `AttributeError: 'BookingService' object has no attribute 'admin_force_cancel'`.

- [ ] **Step 3: Implement `admin_force_cancel`**

Add to `backend/app/services/booking_service.py` after `admin_force_book`:

```python
    async def admin_force_cancel(
        self,
        *,
        booking_id: str,
        refund_quota: bool,
        refund_trial: bool,
    ) -> Booking:
        """Admin による強制キャンセル。24h ルール bypass。"""
        booking_ref = self._fs.collection("bookings").document(booking_id)
        slots_col = self._fs.collection("lesson_slots")
        quota_col = self._fs.collection("monthly_quota")
        users_col = self._fs.collection("users")

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            booking_snap = await booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise BookingNotFoundError(booking_id)
            booking = self._booking_repo._from_dict(booking_snap.to_dict(), booking_id)

            if booking.status == BookingStatus.CANCELLED:
                return booking

            slot_ref = slots_col.document(booking.slot_id)
            slot_snap = await slot_ref.get(transaction=tx)
            slot_data = slot_snap.to_dict() or {}
            lesson_type_str = slot_data.get("lesson_type", "")
            is_trial = lesson_type_str == LessonType.TRIAL.value

            quota_ref = None
            current_used: int | None = None
            if refund_quota and not is_trial:
                ym = _jst_year_month(booking.created_at)
                quota_ref = quota_col.document(f"{booking.user_id}_{ym}")
                q_snap = await quota_ref.get(transaction=tx)
                if q_snap.exists:
                    current_used = int(cast(dict[str, Any], q_snap.to_dict())["used"])

            user_ref = None
            if refund_trial and is_trial:
                user_ref = users_col.document(booking.user_id)
                # 読みは不要(上書き)だが transaction の read-before-write 規約のため空 read
                await user_ref.get(transaction=tx)

            # ---- write phase ----
            if slot_snap.exists:
                current = int(slot_data["booked_count"])
                tx.update(
                    slot_ref,
                    {"booked_count": max(0, current - 1), "updated_at": _utc_now()},
                )
            if quota_ref is not None and current_used is not None:
                tx.update(quota_ref, {"used": max(0, current_used - 1)})
            if user_ref is not None:
                tx.update(user_ref, {"trial_used": False, "updated_at": _utc_now()})

            now = _utc_now()
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = now
            tx.update(
                booking_ref,
                {"status": BookingStatus.CANCELLED.value, "cancelled_at": now},
            )
            return booking

        return cast(Booking, await txn(self._fs.transaction()))
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service_admin.py -v`
Expected: 15 passed.

- [ ] **Step 5: Ruff + mypy**

Run: `cd backend && uv run ruff check app/services tests/services && uv run mypy app/services`
Expected: All checks passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/booking_service.py \
        backend/tests/services/test_booking_service_admin.py
git commit -m "feat(booking): admin_force_cancel bypasses 24h, supports quota+trial refund"
```

---

## Task 6: Admin API schemas

**Files:**
- Create: `backend/app/api/schemas/admin.py`

- [ ] **Step 1: Create schemas**

Create `backend/app/api/schemas/admin.py`:

```python
"""Pydantic models for admin endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ForceBookRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    consume_quota: bool = False
    consume_trial: bool = False


class ForceCancelRequest(BaseModel):
    refund_quota: bool = False
    refund_trial: bool = False


class UserSummaryResponse(BaseModel):
    uid: str
    email: str
    name: str
```

- [ ] **Step 2: Verify import**

Run: `cd backend && uv run python -c "from app.api.schemas.admin import ForceBookRequest; print(ForceBookRequest.model_fields)"`
Expected: prints field map containing `user_id`, `consume_quota`, `consume_trial`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/schemas/admin.py
git commit -m "feat(admin-schemas): ForceBookRequest / ForceCancelRequest / UserSummaryResponse"
```

---

## Task 7: Admin endpoints — force-book + force-cancel + users

**Files:**
- Create: `backend/app/api/endpoints/admin.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/api/test_admin_endpoints.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/api/test_admin_endpoints.py`:

```python
"""HTTP-level tests for /api/v1/admin/* endpoints."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.api.dependencies.auth import get_admin_user, get_current_user
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus
from app.main import app


def _now() -> datetime:
    return datetime.now(UTC)


@pytest.fixture
async def client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture(autouse=True)
async def clean(client):
    for col in ("lesson_slots", "bookings", "users", "monthly_quota"):
        async for doc in client.collection(col).stream():
            await doc.reference.delete()
    yield


@pytest.fixture
def admin_user():
    now = _now()
    u = User(
        uid="admin-uid",
        email="admin@example.com",
        name="Admin",
        phone=None,
        plan=None,
        plan_started_at=None,
        trial_used=False,
        created_at=now,
        updated_at=now,
    )
    u.is_admin = True
    return u


@pytest.fixture
def http(admin_user):
    app.dependency_overrides[get_admin_user] = lambda: admin_user
    app.dependency_overrides[get_current_user] = lambda: admin_user
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    app.dependency_overrides.clear()


async def _make_slot(client, *, start_offset_h=48) -> str:
    slot_id = str(uuid4())
    start = _now() + timedelta(hours=start_offset_h)
    await client.collection("lesson_slots").document(slot_id).set({
        "id": slot_id,
        "start_at": start,
        "end_at": start + timedelta(minutes=30),
        "lesson_type": LessonType.GROUP.value,
        "capacity": 5,
        "booked_count": 0,
        "price_yen": None,
        "teacher_id": None,
        "notes": None,
        "status": SlotStatus.OPEN.value,
        "created_at": _now(),
        "updated_at": _now(),
    })
    return slot_id


async def _make_user(client, *, uid="u1", email="u1@example.com", name="Test User") -> None:
    await client.collection("users").document(uid).set({
        "uid": uid,
        "email": email,
        "name": name,
        "phone": None,
        "plan": None,
        "plan_started_at": None,
        "trial_used": False,
        "created_at": _now(),
        "updated_at": _now(),
    })


async def test_force_book_returns_201(http, client):
    slot_id = await _make_slot(client)
    await _make_user(client)
    async with http as h:
        r = await h.post(
            f"/api/v1/admin/lesson-slots/{slot_id}/bookings",
            json={"user_id": "u1", "consume_quota": False, "consume_trial": False},
        )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "confirmed"


async def test_force_cancel_returns_200(http, client):
    slot_id = await _make_slot(client)
    await _make_user(client)
    async with http as h:
        b = await h.post(
            f"/api/v1/admin/lesson-slots/{slot_id}/bookings",
            json={"user_id": "u1", "consume_quota": False, "consume_trial": False},
        )
        booking_id = b.json()["id"]
        r = await h.post(
            f"/api/v1/admin/bookings/{booking_id}/cancel",
            json={"refund_quota": False, "refund_trial": False},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


async def test_admin_users_search_prefix(http, client):
    await _make_user(client, uid="u1", email="taro@example.com", name="Yamada")
    await _make_user(client, uid="u2", email="hanako@example.com", name="Sato")
    async with http as h:
        r = await h.get("/api/v1/admin/users?q=taro")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["uid"] == "u1"


async def test_admin_users_empty_query_lists_all(http, client):
    await _make_user(client, uid="u1", email="taro@example.com")
    await _make_user(client, uid="u2", email="hanako@example.com")
    async with http as h:
        r = await h.get("/api/v1/admin/users")
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_admin_non_admin_forbidden(client):
    """non-admin user gets 403."""
    from app.api.dependencies.auth import get_admin_user as _real
    from fastapi import HTTPException, status as st

    async def deny():
        raise HTTPException(status_code=st.HTTP_403_FORBIDDEN, detail="x")
    app.dependency_overrides[get_admin_user] = deny
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as h:
            r = await h.get("/api/v1/admin/users")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_admin_endpoints.py -v`
Expected: FAIL with 404 (endpoints not yet registered).

- [ ] **Step 3: Create admin endpoints**

Create `backend/app/api/endpoints/admin.py`:

```python
"""/api/v1/admin/* — admin-only force-book / force-cancel / user search."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies.auth import get_admin_user
from app.api.dependencies.repositories import (
    get_booking_repository,
    get_lesson_slot_repository,
    get_monthly_quota_repository,
    get_user_repository,
)
from app.api.schemas.admin import (
    ForceBookRequest,
    ForceCancelRequest,
    UserSummaryResponse,
)
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository
from app.infrastructure.database.firestore_client import get_firestore_client
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
    SlotFullError,
    SlotNotFoundError,
    UserNotFoundError,
)
from app.services.booking_service import BookingService

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _service() -> BookingService:
    client = get_firestore_client()
    return BookingService(
        FirestoreLessonSlotRepository(client),
        FirestoreBookingRepository(client),
        client,
        FirestoreMonthlyQuotaRepository(client),
        FirestoreUserRepository(client),
    )


@router.post(
    "/lesson-slots/{slot_id}/bookings",
    status_code=status.HTTP_201_CREATED,
)
async def force_book(
    slot_id: UUID,
    payload: ForceBookRequest,
    admin: Annotated[User, Depends(get_admin_user)],
) -> dict[str, Any]:
    service = _service()
    try:
        booking = await service.admin_force_book(
            slot_id=str(slot_id),
            user_id=payload.user_id,
            consume_quota=payload.consume_quota,
            consume_trial=payload.consume_trial,
        )
    except SlotNotFoundError as e:
        raise HTTPException(status_code=404, detail={"code": "slot_not_found"}) from e
    except SlotFullError as e:
        raise HTTPException(status_code=400, detail={"code": "slot_full"}) from e
    except AlreadyBookedError as e:
        raise HTTPException(status_code=409, detail={"code": "already_booked"}) from e
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=404, detail={"code": "user_not_found"}
        ) from e
    return {
        "id": str(booking.id),
        "slot_id": booking.slot_id,
        "user_id": booking.user_id,
        "status": booking.status.value,
        "created_at": booking.created_at.isoformat(),
    }


@router.post("/bookings/{booking_id}/cancel")
async def force_cancel(
    booking_id: UUID,
    payload: ForceCancelRequest,
    admin: Annotated[User, Depends(get_admin_user)],
) -> dict[str, Any]:
    service = _service()
    try:
        booking = await service.admin_force_cancel(
            booking_id=str(booking_id),
            refund_quota=payload.refund_quota,
            refund_trial=payload.refund_trial,
        )
    except BookingNotFoundError as e:
        raise HTTPException(
            status_code=404, detail={"code": "booking_not_found"}
        ) from e
    return {
        "id": str(booking.id),
        "status": booking.status.value,
        "cancelled_at": booking.cancelled_at.isoformat() if booking.cancelled_at else None,
    }


@router.get("/users", response_model=list[UserSummaryResponse])
async def search_users(
    admin: Annotated[User, Depends(get_admin_user)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    q: Annotated[str, Query(max_length=100)] = "",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[UserSummaryResponse]:
    if q:
        users = await user_repo.search(q, limit=limit)
    else:
        users = await user_repo.list_all(limit=limit)
    return [
        UserSummaryResponse(uid=u.uid, email=u.email, name=u.name) for u in users
    ]
```

- [ ] **Step 4: Add `get_monthly_quota_repository` if it doesn't already exist**

Check `backend/app/api/dependencies/repositories.py`. If `get_monthly_quota_repository` is missing, add it. If the imports above reference deps not present, fix them. Run:

```bash
cd backend && uv run python -c "from app.api.endpoints.admin import router; print(router.routes)"
```
Expected: prints 3 routes.

- [ ] **Step 5: Wire router in `main.py`**

Edit `backend/app/main.py` — add import + `app.include_router`:

```python
from app.api.endpoints import admin as admin_endpoints
# ...
app.include_router(admin_endpoints.router)
```

(Place near the other `include_router` lines.)

- [ ] **Step 6: Run tests — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_admin_endpoints.py -v`
Expected: 5 passed.

- [ ] **Step 7: Ruff + mypy**

Run: `cd backend && uv run ruff check app/api/endpoints/admin.py app/api/schemas/admin.py tests/api/test_admin_endpoints.py && uv run mypy app/api`
Expected: All checks passed.

- [ ] **Step 8: Commit**

```bash
git add backend/app/api/endpoints/admin.py backend/app/main.py \
        backend/tests/api/test_admin_endpoints.py
git commit -m "feat(admin-api): force-book / force-cancel / search-users endpoints"
```

---

## Task 8: Firestore indexes

**Files:**
- Modify: `firestore.indexes.json` (repo root, if exists; otherwise create)

- [ ] **Step 1: Add indexes**

If `firestore.indexes.json` does not exist, create it. Otherwise merge into `indexes` array:

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "email", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "updated_at", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

(Firestore creates single-field indexes automatically — these may be no-ops at deploy time; still declare them for documentation.)

- [ ] **Step 2: Commit**

```bash
git add firestore.indexes.json
git commit -m "chore(firestore): declare users single-field indexes for admin search"
```

---

## Task 9: Frontend admin-booking lib

**Files:**
- Create: `frontend/src/lib/admin-booking.ts`

- [ ] **Step 1: Write failing test stub**

Create `frontend/src/lib/__tests__/admin-booking.test.ts`:

```typescript
import { searchAdminUsers, adminForceBook, adminForceCancel } from '../admin-booking';

describe('admin-booking lib exports', () => {
  it('exports the 3 functions', () => {
    expect(typeof searchAdminUsers).toBe('function');
    expect(typeof adminForceBook).toBe('function');
    expect(typeof adminForceCancel).toBe('function');
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest lib/__tests__/admin-booking.test.ts`
Expected: FAIL — Cannot find module '../admin-booking'.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/admin-booking.ts`:

```typescript
import axios from 'axios';
import { firebaseAuth } from '@/lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

export interface AdminUserSummary {
  uid: string;
  email: string;
  name: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await firebaseAuth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function searchAdminUsers(
  q: string,
  limit = 50
): Promise<AdminUserSummary[]> {
  const headers = await authHeaders();
  const resp = await axios.get<AdminUserSummary[]>(
    `${API_BASE}/api/v1/admin/users`,
    { headers, params: { q, limit } }
  );
  return resp.data;
}

export interface ForceBookBody {
  user_id: string;
  consume_quota: boolean;
  consume_trial: boolean;
}

export interface ForceBookResponse {
  id: string;
  slot_id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export async function adminForceBook(
  slotId: string,
  body: ForceBookBody
): Promise<ForceBookResponse> {
  const headers = await authHeaders();
  const resp = await axios.post<ForceBookResponse>(
    `${API_BASE}/api/v1/admin/lesson-slots/${slotId}/bookings`,
    body,
    { headers }
  );
  return resp.data;
}

export interface ForceCancelBody {
  refund_quota: boolean;
  refund_trial: boolean;
}

export interface ForceCancelResponse {
  id: string;
  status: string;
  cancelled_at: string | null;
}

export async function adminForceCancel(
  bookingId: string,
  body: ForceCancelBody
): Promise<ForceCancelResponse> {
  const headers = await authHeaders();
  const resp = await axios.post<ForceCancelResponse>(
    `${API_BASE}/api/v1/admin/bookings/${bookingId}/cancel`,
    body,
    { headers }
  );
  return resp.data;
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx jest lib/__tests__/admin-booking.test.ts`
Expected: PASS.

- [ ] **Step 5: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/admin-booking.ts \
        frontend/src/lib/__tests__/admin-booking.test.ts
git commit -m "feat(admin-booking-lib): typed API client for force-book/cancel/search"
```

---

## Task 10: AdminUserPicker component (combo-box)

**Files:**
- Create: `frontend/src/app/admin/lessons/[id]/_components/AdminUserPicker.tsx`
- Test: `frontend/src/app/admin/lessons/[id]/_components/__tests__/AdminUserPicker.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/app/admin/lessons/[id]/_components/__tests__/AdminUserPicker.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AdminUserPicker } from '../AdminUserPicker';
import * as lib from '@/lib/admin-booking';

jest.mock('@/lib/admin-booking');

const mocked = lib as jest.Mocked<typeof lib>;

describe('AdminUserPicker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mocked.searchAdminUsers.mockResolvedValue([
      { uid: 'u1', email: 'taro@example.com', name: '山田太郎' },
      { uid: 'u2', email: 'hanako@example.com', name: '佐藤花子' },
    ]);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('calls searchAdminUsers after 300ms debounce', async () => {
    const onSelect = jest.fn();
    render(<AdminUserPicker onSelect={onSelect} />);
    const input = screen.getByPlaceholderText(/メール.*名前.*検索/);
    fireEvent.change(input, { target: { value: 'taro' } });
    expect(mocked.searchAdminUsers).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(mocked.searchAdminUsers).toHaveBeenCalledWith('taro');
    });
  });

  it('shows candidates after fetch', async () => {
    const onSelect = jest.fn();
    render(<AdminUserPicker onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/メール.*名前.*検索/), {
      target: { value: 'a' },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await screen.findByText(/taro@example.com/);
    expect(screen.getByText(/hanako@example.com/)).toBeInTheDocument();
  });

  it('invokes onSelect when a candidate is clicked', async () => {
    const onSelect = jest.fn();
    render(<AdminUserPicker onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/メール.*名前.*検索/), {
      target: { value: 'a' },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const candidate = await screen.findByText(/taro@example.com/);
    fireEvent.click(candidate);
    expect(onSelect).toHaveBeenCalledWith({
      uid: 'u1',
      email: 'taro@example.com',
      name: '山田太郎',
    });
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest AdminUserPicker`
Expected: FAIL — Cannot find module '../AdminUserPicker'.

- [ ] **Step 3: Implement component**

Create `frontend/src/app/admin/lessons/[id]/_components/AdminUserPicker.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  searchAdminUsers,
  type AdminUserSummary,
} from '@/lib/admin-booking';

interface Props {
  onSelect: (u: AdminUserSummary) => void;
}

export function AdminUserPicker({ onSelect }: Props) {
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await searchAdminUsers(q);
        setCandidates(list);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="メール / 名前で検索"
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <ul className="max-h-48 overflow-y-auto rounded border">
        {loading && <li className="p-2 text-xs text-gray-400">読み込み中…</li>}
        {!loading && candidates.length === 0 && (
          <li className="p-2 text-xs text-gray-400">候補がありません</li>
        )}
        {candidates.map(c => (
          <li key={c.uid}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="block w-full px-2 py-1 text-left text-sm hover:bg-gray-100"
            >
              {c.email} ({c.name})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx jest AdminUserPicker`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/lessons/[id]/_components/AdminUserPicker.tsx \
        frontend/src/app/admin/lessons/[id]/_components/__tests__/AdminUserPicker.test.tsx
git commit -m "feat(admin-ui): AdminUserPicker combo-box with debounce search"
```

---

## Task 11: AddBookingDialog component

**Files:**
- Create: `frontend/src/app/admin/lessons/[id]/_components/AddBookingDialog.tsx`
- Test: `frontend/src/app/admin/lessons/[id]/_components/__tests__/AddBookingDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/app/admin/lessons/[id]/_components/__tests__/AddBookingDialog.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { AddBookingDialog } from '../AddBookingDialog';
import * as lib from '@/lib/admin-booking';

jest.mock('@/lib/admin-booking');
const mocked = lib as jest.Mocked<typeof lib>;

describe('AddBookingDialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mocked.searchAdminUsers.mockResolvedValue([
      { uid: 'u1', email: 'taro@example.com', name: '山田太郎' },
    ]);
    mocked.adminForceBook.mockResolvedValue({
      id: 'b1',
      slot_id: 's1',
      user_id: 'u1',
      status: 'confirmed',
      created_at: '',
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('shows quota checkbox for non-trial lesson_type', () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    render(
      <AddBookingDialog
        slotId="s1"
        lessonType="group"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
    expect(screen.getByLabelText(/quota.*消費/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/trial.*消費/)).not.toBeInTheDocument();
  });

  it('shows trial checkbox for trial lesson_type', () => {
    render(
      <AddBookingDialog
        slotId="s1"
        lessonType="trial"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(screen.getByLabelText(/trial.*消費/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/quota.*消費/)).not.toBeInTheDocument();
  });

  it('calls adminForceBook with chosen flags on submit', async () => {
    const onSuccess = jest.fn();
    render(
      <AddBookingDialog
        slotId="s1"
        lessonType="group"
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />
    );
    // pick a user
    fireEvent.change(screen.getByPlaceholderText(/メール.*名前.*検索/), {
      target: { value: 'taro' },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.click(await screen.findByText(/taro@example.com/));
    // toggle quota
    fireEvent.click(screen.getByLabelText(/quota.*消費/));
    // submit
    fireEvent.click(screen.getByRole('button', { name: /予約を追加/ }));
    await waitFor(() => {
      expect(mocked.adminForceBook).toHaveBeenCalledWith('s1', {
        user_id: 'u1',
        consume_quota: true,
        consume_trial: false,
      });
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest AddBookingDialog`
Expected: FAIL — Cannot find module '../AddBookingDialog'.

- [ ] **Step 3: Implement component**

Create `frontend/src/app/admin/lessons/[id]/_components/AddBookingDialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { adminForceBook, type AdminUserSummary } from '@/lib/admin-booking';
import { useNotificationStore } from '@/stores/notificationStore';
import { AdminUserPicker } from './AdminUserPicker';

interface Props {
  slotId: string;
  lessonType: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddBookingDialog({ slotId, lessonType, onClose, onSuccess }: Props) {
  const [picked, setPicked] = useState<AdminUserSummary | null>(null);
  const [consumeQuota, setConsumeQuota] = useState(false);
  const [consumeTrial, setConsumeTrial] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = useNotificationStore();
  const isTrial = lessonType === 'trial';

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await adminForceBook(slotId, {
        user_id: picked.uid,
        consume_quota: consumeQuota,
        consume_trial: consumeTrial,
      });
      notify.success('予約を追加しました');
      onSuccess();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : '予約追加に失敗しました';
      notify.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-[440px] space-y-4 rounded bg-white p-4 shadow-lg">
        <h3 className="font-semibold">予約を追加</h3>

        <div>
          <label className="text-sm font-medium">ユーザー</label>
          {picked ? (
            <div className="flex items-center justify-between rounded border bg-gray-50 px-2 py-1 text-sm">
              <span>
                {picked.email} ({picked.name})
              </span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-xs text-blue-600"
              >
                変更
              </button>
            </div>
          ) : (
            <AdminUserPicker onSelect={setPicked} />
          )}
        </div>

        <div className="space-y-1">
          {isTrial ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={consumeTrial}
                onChange={e => setConsumeTrial(e.target.checked)}
              />
              trial を消費する
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={consumeQuota}
                onChange={e => setConsumeQuota(e.target.checked)}
              />
              quota を消費する
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !picked}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {busy ? '追加中…' : '予約を追加'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx jest AddBookingDialog`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/lessons/[id]/_components/AddBookingDialog.tsx \
        frontend/src/app/admin/lessons/[id]/_components/__tests__/AddBookingDialog.test.tsx
git commit -m "feat(admin-ui): AddBookingDialog with user picker + quota/trial toggles"
```

---

## Task 12: ForceCancelDialog component

**Files:**
- Create: `frontend/src/app/admin/lessons/[id]/_components/ForceCancelDialog.tsx`
- Test: `frontend/src/app/admin/lessons/[id]/_components/__tests__/ForceCancelDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/app/admin/lessons/[id]/_components/__tests__/ForceCancelDialog.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForceCancelDialog } from '../ForceCancelDialog';
import * as lib from '@/lib/admin-booking';

jest.mock('@/lib/admin-booking');
const mocked = lib as jest.Mocked<typeof lib>;

describe('ForceCancelDialog', () => {
  beforeEach(() => {
    mocked.adminForceCancel.mockResolvedValue({
      id: 'b1',
      status: 'cancelled',
      cancelled_at: '2026-05-15T01:00:00Z',
    });
  });
  afterEach(() => jest.clearAllMocks());

  it('shows quota checkbox for non-trial', () => {
    render(
      <ForceCancelDialog
        bookingId="b1"
        userLabel="taro@example.com"
        lessonType="group"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(screen.getByLabelText(/quota.*返却/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/trial.*返却/)).not.toBeInTheDocument();
  });

  it('shows trial checkbox for trial', () => {
    render(
      <ForceCancelDialog
        bookingId="b1"
        userLabel="taro@example.com"
        lessonType="trial"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(screen.getByLabelText(/trial.*返却/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/quota.*返却/)).not.toBeInTheDocument();
  });

  it('calls adminForceCancel with selected flags', async () => {
    const onSuccess = jest.fn();
    render(
      <ForceCancelDialog
        bookingId="b1"
        userLabel="taro@example.com"
        lessonType="group"
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />
    );
    fireEvent.click(screen.getByLabelText(/quota.*返却/));
    fireEvent.click(screen.getByRole('button', { name: /キャンセルする/ }));
    await waitFor(() => {
      expect(mocked.adminForceCancel).toHaveBeenCalledWith('b1', {
        refund_quota: true,
        refund_trial: false,
      });
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest ForceCancelDialog`
Expected: FAIL — Cannot find module '../ForceCancelDialog'.

- [ ] **Step 3: Implement component**

Create `frontend/src/app/admin/lessons/[id]/_components/ForceCancelDialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { adminForceCancel } from '@/lib/admin-booking';
import { useNotificationStore } from '@/stores/notificationStore';

interface Props {
  bookingId: string;
  userLabel: string;
  lessonType: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ForceCancelDialog({
  bookingId,
  userLabel,
  lessonType,
  onClose,
  onSuccess,
}: Props) {
  const [refundQuota, setRefundQuota] = useState(false);
  const [refundTrial, setRefundTrial] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = useNotificationStore();
  const isTrial = lessonType === 'trial';

  const submit = async () => {
    setBusy(true);
    try {
      await adminForceCancel(bookingId, {
        refund_quota: refundQuota,
        refund_trial: refundTrial,
      });
      notify.success('予約を取消しました');
      onSuccess();
    } catch {
      notify.error('キャンセルに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-[400px] space-y-4 rounded bg-white p-4 shadow-lg">
        <h3 className="font-semibold">予約を強制キャンセル</h3>
        <p className="text-sm text-gray-700">
          {userLabel} の予約をキャンセルしますか?
        </p>
        {isTrial ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refundTrial}
              onChange={e => setRefundTrial(e.target.checked)}
            />
            trial を返却する
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refundQuota}
              onChange={e => setRefundQuota(e.target.checked)}
            />
            quota を返却する
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            いいえ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {busy ? '処理中…' : 'はい、キャンセルする'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx jest ForceCancelDialog`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/lessons/[id]/_components/ForceCancelDialog.tsx \
        frontend/src/app/admin/lessons/[id]/_components/__tests__/ForceCancelDialog.test.tsx
git commit -m "feat(admin-ui): ForceCancelDialog with refund quota/trial toggles"
```

---

## Task 13: Integrate dialogs into admin/lessons/[id] page

**Files:**
- Modify: `frontend/src/app/admin/lessons/[id]/page.tsx`

- [ ] **Step 1: Update page imports**

Insert near top of `frontend/src/app/admin/lessons/[id]/page.tsx`:

```typescript
import { AddBookingDialog } from './_components/AddBookingDialog';
import { ForceCancelDialog } from './_components/ForceCancelDialog';
```

- [ ] **Step 2: Add dialog state**

In `AdminLessonEditPage` body, after `setBusy` useState:

```typescript
  const [addOpen, setAddOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AdminBookingRow | null>(null);
```

- [ ] **Step 3: Add "予約を追加" button + dialog mounts**

Replace the `<section>` block (予約者) with:

```typescript
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">予約者</h3>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
          >
            + 予約を追加
          </button>
        </div>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-500">まだ予約はありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="py-2">名前</th>
                <th>メール</th>
                <th>状態</th>
                <th>予約日時</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b">
                  <td className="py-2">
                    {b.user_name ?? (
                      <span className="text-gray-400">{b.user_id}</span>
                    )}
                  </td>
                  <td>
                    {b.user_email ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td>
                    {b.status === 'confirmed' ? (
                      <span className="text-green-700">確定</span>
                    ) : (
                      <span className="text-red-600">キャンセル済</span>
                    )}
                  </td>
                  <td>{new Date(b.created_at).toLocaleString('ja-JP')}</td>
                  <td>
                    {b.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(b)}
                        className="text-xs text-red-600 underline"
                      >
                        強制キャンセル
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {addOpen && (
        <AddBookingDialog
          slotId={slot.id}
          lessonType={slot.lesson_type}
          onClose={() => setAddOpen(false)}
          onSuccess={async () => {
            setAddOpen(false);
            await load();
          }}
        />
      )}
      {cancelTarget && (
        <ForceCancelDialog
          bookingId={cancelTarget.id}
          userLabel={cancelTarget.user_email ?? cancelTarget.user_id}
          lessonType={slot.lesson_type}
          onClose={() => setCancelTarget(null)}
          onSuccess={async () => {
            setCancelTarget(null);
            await load();
          }}
        />
      )}
```

- [ ] **Step 4: Verify type check + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Run all related tests**

Run: `cd frontend && npx jest admin/lessons`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/admin/lessons/[id]/page.tsx
git commit -m "feat(admin-ui): integrate AddBookingDialog + ForceCancelDialog in slot page"
```

---

## Task 14: Final verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest -q`
Expected: all admin tests pass, no regression in existing tests.

- [ ] **Step 2: Run full frontend test suite**

Run: `cd frontend && npx jest`
Expected: pre-existing 3 Firebase-env failures may remain; admin tests pass.

- [ ] **Step 3: Type check + lint both sides**

Run: `cd backend && uv run ruff check . && uv run mypy app/services app/api`
Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Push branch + open PR**

```bash
git push -u origin feat/admin-force-booking
gh pr create --title "feat(admin): force-book / force-cancel with quota+trial toggles" --body "$(cat <<'EOF'
## Summary
Admin が任意のユーザー枠予約/キャンセルを、24h ルール・quota・trial 消費を bypass して操作できる機能を追加。capacity のみ守る。

## What's included
- Backend: BookingService.admin_force_book / admin_force_cancel + admin endpoints
- Frontend: AdminUserPicker / AddBookingDialog / ForceCancelDialog
- UserRepository.search + list_all (prefix match)
- Firestore index 宣言追加

## Test plan
- [x] backend pytest (services + api) all green
- [x] frontend jest (3 dialog tests + 1 picker test + lib test) green
- [x] mypy + ruff + tsc clean
- [ ] preview デプロイで /admin/lessons/[id] を開き UI 動作確認

See `docs/superpowers/specs/2026-05-15-admin-force-booking-design.md` for design.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Spec Coverage Self-Check

| Spec section | Tasks |
|---|---|
| Force-book API | 6, 7 |
| Force-cancel API | 6, 7 |
| `admin/users` search | 2, 3, 7 |
| `BookingService.admin_force_book` | 4 |
| `BookingService.admin_force_cancel` | 5 |
| `UserNotFoundError` | 1, 4 |
| `UserRepository.search` / `list_all` | 2, 3 |
| Firestore indexes | 8 |
| Frontend API client | 9 |
| `AdminUserPicker` | 10 |
| `AddBookingDialog` | 11 |
| `ForceCancelDialog` | 12 |
| Page integration | 13 |
| Final verify | 14 |
| capacity-守る + 24h/quota/trial-bypass | covered by tests in 4, 5 |
| consume_trial / refund_trial trial-only paths | covered by tests in 4, 5 |
| Idempotent cancel | covered by test in 5 |
| Trial/quota checkbox排他 | covered by tests in 11, 12 |
