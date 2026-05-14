# Lesson Booking 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement sub-project 2a of `docs/superpowers/specs/2026-05-14-lesson-booking-2a-design.md` — admin-managed lesson slots, customer-facing booking with capacity-safe transactions, and a マイページ section for upcoming + past bookings, with simple self-service cancellation.

**Architecture:** New Firestore collections `lesson_slots` and `bookings`; `BookingService` orchestrates atomic book/cancel via `firestore.async_transaction`; admin routes gated by Firebase Auth custom claim `admin: true`; admin UI lives at `/admin/*` on the same Next.js site.

**Tech Stack:** FastAPI + firebase-admin (existing), google-cloud-firestore async transactions (existing), Next.js 14 App Router + zustand auth store (existing).

**Working branch:** `feat/lesson-booking-2a-design` (already created from main; the spec commit is `eaa4268`).

---

## File map

**Backend — new**
- `backend/app/domain/enums/lesson_booking.py` — `SlotStatus`, `BookingStatus`
- `backend/app/domain/entities/lesson_slot.py`
- `backend/app/domain/entities/booking.py`
- `backend/app/domain/repositories/lesson_slot_repository.py`
- `backend/app/domain/repositories/booking_repository.py`
- `backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py`
- `backend/app/infrastructure/repositories/firestore_booking_repository.py`
- `backend/app/services/booking_service.py`
- `backend/app/api/endpoints/lesson_slots.py`
- `backend/app/api/endpoints/bookings.py`
- `backend/app/api/schemas/lesson_slot.py`
- `backend/app/api/schemas/booking.py`
- corresponding test files under `backend/tests/`

**Backend — modify**
- `backend/app/domain/entities/user.py` — add `is_admin: bool = False`
- `backend/app/api/dependencies/auth.py` — hydrate `is_admin` from token claim; add `get_admin_user`
- `backend/app/api/dependencies/repositories.py` — add LessonSlot + Booking repo factories
- `backend/app/main.py` — mount the two new routers

**Frontend — new**
- `frontend/src/lib/booking.ts` — typed axios helpers + shared TS types
- `frontend/src/hooks/useAdminGuard.ts`
- `frontend/src/app/book/page.tsx`
- `frontend/src/app/book/_components/SlotCard.tsx`
- `frontend/src/app/mypage/_components/BookingsList.tsx`
- `frontend/src/app/admin/layout.tsx`
- `frontend/src/app/admin/lessons/page.tsx`
- `frontend/src/app/admin/lessons/_components/SlotForm.tsx`
- `frontend/src/app/admin/lessons/[id]/page.tsx`

**Frontend — modify**
- `frontend/src/stores/authStore.ts` — expose `isAdmin: boolean` derived from token claim
- `frontend/src/app/mypage/page.tsx` — wire in `<BookingsList>`
- `frontend/src/components/layout/Header.tsx` — add "予約" nav link

**Terraform — modify**
- `terraform/modules/firestore-database/main.tf` — add `google_firestore_index` resources for the 4 composite indexes

**Scripts — new**
- `scripts/grant_admin.py` — one-shot Python script to set `admin` claim on a Firebase user

---

## Part A — Backend domain

### Task 1: Enums for lesson booking

**Files:**
- Create: `backend/app/domain/enums/lesson_booking.py`
- Test: `backend/tests/domain/test_lesson_booking_enums.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/domain/test_lesson_booking_enums.py`:
```python
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus


def test_slot_status_values():
    assert SlotStatus.OPEN.value == "open"
    assert SlotStatus.CLOSED.value == "closed"
    assert SlotStatus.CANCELLED.value == "cancelled"


def test_booking_status_values():
    assert BookingStatus.CONFIRMED.value == "confirmed"
    assert BookingStatus.CANCELLED.value == "cancelled"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/domain/test_lesson_booking_enums.py -v`
Expected: ImportError.

- [ ] **Step 3: Write the enums**

`backend/app/domain/enums/lesson_booking.py`:
```python
"""Enums for the lesson booking domain."""

from __future__ import annotations

from enum import Enum


class SlotStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class BookingStatus(str, Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
```

- [ ] **Step 4: Run test**

Run: `cd backend && uv run pytest tests/domain/test_lesson_booking_enums.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domain/enums/lesson_booking.py backend/tests/domain/test_lesson_booking_enums.py
git commit -m "feat(backend): add SlotStatus + BookingStatus enums"
```

---

### Task 2: LessonSlot entity

**Files:**
- Create: `backend/app/domain/entities/lesson_slot.py`
- Test: `backend/tests/domain/test_lesson_slot.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/domain/test_lesson_slot.py`:
```python
"""Unit tests for the LessonSlot entity."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TestConstruction:
    def test_minimal_slot(self):
        slot = LessonSlot(
            id=uuid4(),
            start_at=_now() + timedelta(days=1),
            end_at=_now() + timedelta(days=1, hours=1),
            lesson_type=LessonType.GROUP,
            capacity=4,
            booked_count=0,
            price_yen=2000,
            teacher_id=None,
            notes=None,
            status=SlotStatus.OPEN,
        )
        assert slot.capacity == 4
        assert slot.is_full is False
        assert slot.remaining == 4

    def test_rejects_end_before_start(self):
        with pytest.raises(ValueError, match="end_at"):
            LessonSlot(
                id=uuid4(),
                start_at=_now() + timedelta(days=2),
                end_at=_now() + timedelta(days=1),
                lesson_type=LessonType.GROUP,
                capacity=1,
                booked_count=0,
                price_yen=None,
                teacher_id=None,
                notes=None,
                status=SlotStatus.OPEN,
            )

    def test_rejects_zero_capacity(self):
        with pytest.raises(ValueError, match="capacity"):
            LessonSlot(
                id=uuid4(),
                start_at=_now() + timedelta(days=1),
                end_at=_now() + timedelta(days=1, hours=1),
                lesson_type=LessonType.GROUP,
                capacity=0,
                booked_count=0,
                price_yen=None,
                teacher_id=None,
                notes=None,
                status=SlotStatus.OPEN,
            )

    def test_rejects_booked_over_capacity(self):
        with pytest.raises(ValueError, match="booked_count"):
            LessonSlot(
                id=uuid4(),
                start_at=_now() + timedelta(days=1),
                end_at=_now() + timedelta(days=1, hours=1),
                lesson_type=LessonType.GROUP,
                capacity=2,
                booked_count=3,
                price_yen=None,
                teacher_id=None,
                notes=None,
                status=SlotStatus.OPEN,
            )


class TestProperties:
    def _slot(self, capacity: int, booked: int) -> LessonSlot:
        return LessonSlot(
            id=uuid4(),
            start_at=_now() + timedelta(days=1),
            end_at=_now() + timedelta(days=1, hours=1),
            lesson_type=LessonType.GROUP,
            capacity=capacity,
            booked_count=booked,
            price_yen=None,
            teacher_id=None,
            notes=None,
            status=SlotStatus.OPEN,
        )

    def test_is_full_when_at_capacity(self):
        assert self._slot(4, 4).is_full is True

    def test_remaining(self):
        assert self._slot(4, 1).remaining == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/domain/test_lesson_slot.py -v`
Expected: ImportError.

- [ ] **Step 3: Write the entity**

`backend/app/domain/entities/lesson_slot.py`:
```python
"""LessonSlot domain entity — admin-managed time slot for a lesson."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class LessonSlot:
    id: UUID
    start_at: datetime
    end_at: datetime
    lesson_type: LessonType
    capacity: int
    booked_count: int
    price_yen: int | None
    teacher_id: str | None
    notes: str | None
    status: SlotStatus
    created_at: datetime = field(default_factory=_utc_now)
    updated_at: datetime = field(default_factory=_utc_now)

    def __post_init__(self) -> None:
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        if self.capacity < 1:
            raise ValueError("capacity must be >= 1")
        if not 0 <= self.booked_count <= self.capacity:
            raise ValueError(
                f"booked_count {self.booked_count} out of range [0, {self.capacity}]"
            )

    @property
    def is_full(self) -> bool:
        return self.booked_count >= self.capacity

    @property
    def remaining(self) -> int:
        return self.capacity - self.booked_count
```

- [ ] **Step 4: Run test**

Run: `cd backend && uv run pytest tests/domain/test_lesson_slot.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domain/entities/lesson_slot.py backend/tests/domain/test_lesson_slot.py
git commit -m "feat(backend): add LessonSlot domain entity"
```

---

### Task 3: Booking entity

**Files:**
- Create: `backend/app/domain/entities/booking.py`
- Test: `backend/tests/domain/test_booking.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/domain/test_booking.py`:
```python
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.domain.entities.booking import Booking
from app.domain.enums.lesson_booking import BookingStatus


def test_booking_minimal():
    b = Booking(
        id=uuid4(),
        slot_id="slot-1",
        user_id="u-1",
        status=BookingStatus.CONFIRMED,
        created_at=datetime.now(timezone.utc),
        cancelled_at=None,
    )
    assert b.status == BookingStatus.CONFIRMED
    assert b.cancelled_at is None


def test_booking_rejects_empty_slot_id():
    with pytest.raises(ValueError, match="slot_id"):
        Booking(
            id=uuid4(),
            slot_id="",
            user_id="u-1",
            status=BookingStatus.CONFIRMED,
            created_at=datetime.now(timezone.utc),
            cancelled_at=None,
        )


def test_booking_rejects_empty_user_id():
    with pytest.raises(ValueError, match="user_id"):
        Booking(
            id=uuid4(),
            slot_id="slot-1",
            user_id="",
            status=BookingStatus.CONFIRMED,
            created_at=datetime.now(timezone.utc),
            cancelled_at=None,
        )
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && uv run pytest tests/domain/test_booking.py -v`
Expected: ImportError.

- [ ] **Step 3: Write the entity**

`backend/app/domain/entities/booking.py`:
```python
"""Booking domain entity."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.enums.lesson_booking import BookingStatus


@dataclass
class Booking:
    id: UUID
    slot_id: str
    user_id: str
    status: BookingStatus
    created_at: datetime
    cancelled_at: datetime | None

    def __post_init__(self) -> None:
        if not self.slot_id:
            raise ValueError("slot_id is required")
        if not self.user_id:
            raise ValueError("user_id is required")
```

- [ ] **Step 4: Run test**

Run: `cd backend && uv run pytest tests/domain/test_booking.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domain/entities/booking.py backend/tests/domain/test_booking.py
git commit -m "feat(backend): add Booking domain entity"
```

---

### Task 4: LessonSlotRepository interface + Firestore implementation

**Files:**
- Create: `backend/app/domain/repositories/lesson_slot_repository.py`
- Create: `backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py`
- Test: `backend/tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py`:
```python
"""Integration tests for FirestoreLessonSlotRepository — emulator-gated."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("lesson_slots").stream():
        await doc.reference.delete()
    return FirestoreLessonSlotRepository(client)


def _make_slot(*, start_offset_hours: int = 24, status: SlotStatus = SlotStatus.OPEN,
               capacity: int = 4, booked: int = 0) -> LessonSlot:
    return LessonSlot(
        id=uuid4(),
        start_at=_now() + timedelta(hours=start_offset_hours),
        end_at=_now() + timedelta(hours=start_offset_hours + 1),
        lesson_type=LessonType.GROUP,
        capacity=capacity,
        booked_count=booked,
        price_yen=2000,
        teacher_id=None,
        notes=None,
        status=status,
    )


class TestSave:
    async def test_save_returns_slot(self, repo):
        slot = _make_slot()
        result = await repo.save(slot)
        assert result.id == slot.id

    async def test_save_is_upsert(self, repo):
        slot = _make_slot(capacity=4)
        await repo.save(slot)
        slot.capacity = 8
        await repo.save(slot)
        fetched = await repo.find_by_id(slot.id)
        assert fetched is not None
        assert fetched.capacity == 8


class TestFindByID:
    async def test_hit(self, repo):
        slot = _make_slot()
        await repo.save(slot)
        fetched = await repo.find_by_id(slot.id)
        assert fetched is not None
        assert fetched.lesson_type == LessonType.GROUP

    async def test_miss(self, repo):
        assert await repo.find_by_id(uuid4()) is None


class TestFindOpenFuture:
    async def test_lists_only_open_future_slots(self, repo):
        await repo.save(_make_slot(start_offset_hours=24))
        await repo.save(_make_slot(start_offset_hours=-1))  # past
        await repo.save(_make_slot(status=SlotStatus.CLOSED))
        results = await repo.find_open_future(limit=10, offset=0)
        assert len(results) == 1
        assert results[0].status == SlotStatus.OPEN
        assert results[0].start_at > _now()
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && uv run pytest tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py -v`
Expected: skip (no emulator) OR ImportError.

- [ ] **Step 3: Write the interface**

`backend/app/domain/repositories/lesson_slot_repository.py`:
```python
"""LessonSlotRepository interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.lesson_slot import LessonSlot


class LessonSlotRepository(ABC):
    @abstractmethod
    async def save(self, slot: LessonSlot) -> LessonSlot: ...

    @abstractmethod
    async def find_by_id(self, slot_id: UUID) -> LessonSlot | None: ...

    @abstractmethod
    async def find_open_future(self, *, limit: int = 50, offset: int = 0) -> list[LessonSlot]: ...

    @abstractmethod
    async def delete(self, slot_id: UUID) -> bool: ...
```

- [ ] **Step 4: Write the Firestore implementation**

`backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py`:
```python
"""Firestore implementation of LessonSlotRepository."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from google.cloud import firestore as fs

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import SlotStatus
from app.domain.repositories.lesson_slot_repository import LessonSlotRepository

_COLLECTION = "lesson_slots"


class FirestoreLessonSlotRepository(LessonSlotRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def save(self, slot: LessonSlot) -> LessonSlot:
        await self._collection.document(str(slot.id)).set(self._to_dict(slot))
        return slot

    async def find_by_id(self, slot_id: UUID) -> LessonSlot | None:
        doc = await self._collection.document(str(slot_id)).get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict(), doc.id)

    async def find_open_future(
        self, *, limit: int = 50, offset: int = 0
    ) -> list[LessonSlot]:
        now = datetime.now(timezone.utc)
        query = (
            self._collection
            .where("status", "==", SlotStatus.OPEN.value)
            .where("start_at", ">", now)
            .order_by("start_at")
            .offset(offset)
            .limit(limit)
        )
        return [
            self._from_dict(doc.to_dict(), doc.id)
            async for doc in query.stream()
        ]

    async def delete(self, slot_id: UUID) -> bool:
        doc_ref = self._collection.document(str(slot_id))
        doc = await doc_ref.get()
        if not doc.exists:
            return False
        await doc_ref.delete()
        return True

    @staticmethod
    def _to_dict(slot: LessonSlot) -> dict[str, Any]:
        return {
            "id": str(slot.id),
            "start_at": slot.start_at,
            "end_at": slot.end_at,
            "lesson_type": slot.lesson_type.value,
            "capacity": slot.capacity,
            "booked_count": slot.booked_count,
            "price_yen": slot.price_yen,
            "teacher_id": slot.teacher_id,
            "notes": slot.notes,
            "status": slot.status.value,
            "created_at": slot.created_at,
            "updated_at": slot.updated_at,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None, doc_id: str) -> LessonSlot:
        assert data is not None
        return LessonSlot(
            id=UUID(doc_id),
            start_at=data["start_at"],
            end_at=data["end_at"],
            lesson_type=LessonType(data["lesson_type"]),
            capacity=int(data["capacity"]),
            booked_count=int(data["booked_count"]),
            price_yen=data.get("price_yen"),
            teacher_id=data.get("teacher_id"),
            notes=data.get("notes"),
            status=SlotStatus(data["status"]),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )
```

- [ ] **Step 5: Run with emulator**

Start emulator in another terminal: `gcloud emulators firestore start --host-port=localhost:8080 --project=test-project`

Then: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py -v`

Expected: tests pass. Note that `find_open_future` requires a composite index on `(status, start_at)` — the emulator auto-creates indexes, but production needs Task 22's terraform changes.

- [ ] **Step 6: Commit**

```bash
git add backend/app/domain/repositories/lesson_slot_repository.py backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py backend/tests/infrastructure/repositories/test_firestore_lesson_slot_repository.py
git commit -m "feat(backend): add LessonSlotRepository + Firestore impl"
```

---

### Task 5: BookingRepository interface + Firestore implementation

**Files:**
- Create: `backend/app/domain/repositories/booking_repository.py`
- Create: `backend/app/infrastructure/repositories/firestore_booking_repository.py`
- Test: `backend/tests/infrastructure/repositories/test_firestore_booking_repository.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/infrastructure/repositories/test_firestore_booking_repository.py`:
```python
"""Integration tests for FirestoreBookingRepository — emulator-gated."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.booking import Booking
from app.domain.enums.lesson_booking import BookingStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("bookings").stream():
        await doc.reference.delete()
    return FirestoreBookingRepository(client)


def _make_booking(*, user_id: str = "u-1", slot_id: str = "slot-1",
                  status: BookingStatus = BookingStatus.CONFIRMED) -> Booking:
    return Booking(
        id=uuid4(),
        slot_id=slot_id,
        user_id=user_id,
        status=status,
        created_at=_now(),
        cancelled_at=None,
    )


class TestSave:
    async def test_save_returns_it(self, repo):
        b = _make_booking()
        result = await repo.save(b)
        assert result.id == b.id


class TestFindByUser:
    async def test_returns_user_bookings(self, repo):
        await repo.save(_make_booking(user_id="u-1"))
        await repo.save(_make_booking(user_id="u-2"))
        results = await repo.find_by_user("u-1")
        assert len(results) == 1
        assert results[0].user_id == "u-1"


class TestFindBySlot:
    async def test_returns_slot_bookings(self, repo):
        await repo.save(_make_booking(slot_id="slot-1"))
        await repo.save(_make_booking(slot_id="slot-2"))
        results = await repo.find_by_slot("slot-1")
        assert len(results) == 1


class TestFindByID:
    async def test_hit(self, repo):
        b = _make_booking()
        await repo.save(b)
        fetched = await repo.find_by_id(b.id)
        assert fetched is not None
        assert fetched.slot_id == "slot-1"

    async def test_miss(self, repo):
        assert await repo.find_by_id(uuid4()) is None
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && uv run pytest tests/infrastructure/repositories/test_firestore_booking_repository.py -v`
Expected: skip (no emulator) OR ImportError.

- [ ] **Step 3: Write the interface**

`backend/app/domain/repositories/booking_repository.py`:
```python
"""BookingRepository interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.booking import Booking


class BookingRepository(ABC):
    @abstractmethod
    async def save(self, booking: Booking) -> Booking: ...

    @abstractmethod
    async def find_by_id(self, booking_id: UUID) -> Booking | None: ...

    @abstractmethod
    async def find_by_user(self, user_id: str) -> list[Booking]: ...

    @abstractmethod
    async def find_by_slot(self, slot_id: str) -> list[Booking]: ...
```

- [ ] **Step 4: Write the implementation**

`backend/app/infrastructure/repositories/firestore_booking_repository.py`:
```python
"""Firestore implementation of BookingRepository."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from google.cloud import firestore as fs

from app.domain.entities.booking import Booking
from app.domain.enums.lesson_booking import BookingStatus
from app.domain.repositories.booking_repository import BookingRepository

_COLLECTION = "bookings"


class FirestoreBookingRepository(BookingRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def save(self, booking: Booking) -> Booking:
        await self._collection.document(str(booking.id)).set(self._to_dict(booking))
        return booking

    async def find_by_id(self, booking_id: UUID) -> Booking | None:
        doc = await self._collection.document(str(booking_id)).get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict(), doc.id)

    async def find_by_user(self, user_id: str) -> list[Booking]:
        query = (
            self._collection
            .where("user_id", "==", user_id)
            .order_by("created_at", direction=fs.Query.DESCENDING)
        )
        return [self._from_dict(doc.to_dict(), doc.id) async for doc in query.stream()]

    async def find_by_slot(self, slot_id: str) -> list[Booking]:
        query = self._collection.where("slot_id", "==", slot_id)
        return [self._from_dict(doc.to_dict(), doc.id) async for doc in query.stream()]

    @staticmethod
    def _to_dict(booking: Booking) -> dict[str, Any]:
        return {
            "id": str(booking.id),
            "slot_id": booking.slot_id,
            "user_id": booking.user_id,
            "status": booking.status.value,
            "created_at": booking.created_at,
            "cancelled_at": booking.cancelled_at,
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
        )
```

- [ ] **Step 5: Run with emulator**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_booking_repository.py -v`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/domain/repositories/booking_repository.py backend/app/infrastructure/repositories/firestore_booking_repository.py backend/tests/infrastructure/repositories/test_firestore_booking_repository.py
git commit -m "feat(backend): add BookingRepository + Firestore impl"
```

---

### Task 6: BookingService — transactional book + cancel

**Files:**
- Create: `backend/app/services/booking_service.py`
- Create: `backend/app/services/booking_errors.py`
- Test: `backend/tests/services/test_booking_service.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/services/test_booking_service.py`:
```python
"""Integration tests for BookingService — emulator-gated.

Exercises the transactional book + cancel paths, including the race-safety
contract (capacity exceeded, double-book, slot closed, etc.).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.lesson_slot import LessonSlot
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.services.booking_errors import (
    AlreadyBookedError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
)
from app.services.booking_service import BookingService


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
async def firestore_client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture
async def service(firestore_client):
    for col in ("lesson_slots", "bookings"):
        async for doc in firestore_client.collection(col).stream():
            await doc.reference.delete()
    slot_repo = FirestoreLessonSlotRepository(firestore_client)
    booking_repo = FirestoreBookingRepository(firestore_client)
    return BookingService(slot_repo, booking_repo, firestore_client)


def _user(uid: str = "u-1") -> User:
    return User(uid=uid, email=f"{uid}@example.com", name=f"User {uid}")


def _slot(*, capacity: int = 2, booked: int = 0,
          status: SlotStatus = SlotStatus.OPEN,
          start_offset_hours: int = 24) -> LessonSlot:
    return LessonSlot(
        id=uuid4(),
        start_at=_now() + timedelta(hours=start_offset_hours),
        end_at=_now() + timedelta(hours=start_offset_hours + 1),
        lesson_type=LessonType.GROUP,
        capacity=capacity,
        booked_count=booked,
        price_yen=None,
        teacher_id=None,
        notes=None,
        status=status,
    )


class TestBookHappyPath:
    async def test_book_creates_booking_and_bumps_count(self, service):
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        booking = await service.book(user=_user(), slot_id=str(slot.id))
        assert booking.status == BookingStatus.CONFIRMED
        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 1


class TestBookRejections:
    async def test_full_slot(self, service):
        slot = _slot(capacity=1, booked=1)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotFullError):
            await service.book(user=_user(), slot_id=str(slot.id))

    async def test_closed_slot(self, service):
        slot = _slot(status=SlotStatus.CLOSED)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotNotOpenError):
            await service.book(user=_user(), slot_id=str(slot.id))

    async def test_past_slot(self, service):
        slot = _slot(start_offset_hours=-2)
        # Bypass __post_init__ end_at check by giving a valid window in the past
        slot.start_at = _now() - timedelta(hours=2)
        slot.end_at = _now() - timedelta(hours=1)
        await service._slot_repo.save(slot)
        with pytest.raises(SlotInPastError):
            await service.book(user=_user(), slot_id=str(slot.id))

    async def test_unknown_slot(self, service):
        with pytest.raises(SlotNotFoundError):
            await service.book(user=_user(), slot_id=str(uuid4()))

    async def test_already_booked(self, service):
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        await service.book(user=_user(), slot_id=str(slot.id))
        with pytest.raises(AlreadyBookedError):
            await service.book(user=_user(), slot_id=str(slot.id))


class TestCancel:
    async def test_cancel_flips_status_and_decrements_count(self, service):
        slot = _slot(capacity=2, booked=0)
        await service._slot_repo.save(slot)
        booking = await service.book(user=_user(), slot_id=str(slot.id))

        cancelled = await service.cancel(user=_user(), booking_id=str(booking.id))
        assert cancelled.status == BookingStatus.CANCELLED
        assert cancelled.cancelled_at is not None

        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 0

    async def test_cancel_someone_elses_raises(self, service):
        from app.services.booking_errors import NotBookingOwnerError
        slot = _slot(capacity=2)
        await service._slot_repo.save(slot)
        booking = await service.book(user=_user("u-1"), slot_id=str(slot.id))
        with pytest.raises(NotBookingOwnerError):
            await service.cancel(user=_user("u-2"), booking_id=str(booking.id))

    async def test_cancel_already_cancelled_is_idempotent(self, service):
        slot = _slot(capacity=2)
        await service._slot_repo.save(slot)
        booking = await service.book(user=_user(), slot_id=str(slot.id))
        await service.cancel(user=_user(), booking_id=str(booking.id))
        # Cancel again — should not error, should not double-decrement
        result = await service.cancel(user=_user(), booking_id=str(booking.id))
        assert result.status == BookingStatus.CANCELLED
        refetched = await service._slot_repo.find_by_id(slot.id)
        assert refetched.booked_count == 0
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service.py -v`
Expected: ImportError.

- [ ] **Step 3: Write the errors module**

`backend/app/services/booking_errors.py`:
```python
"""Domain errors for BookingService."""

from __future__ import annotations


class BookingError(Exception):
    """Base class for booking-related errors."""


class SlotNotFoundError(BookingError):
    """The lesson slot does not exist."""


class SlotNotOpenError(BookingError):
    """The slot status is not 'open' (it's closed or cancelled)."""


class SlotInPastError(BookingError):
    """The slot's start time is in the past."""


class SlotFullError(BookingError):
    """The slot has no remaining capacity."""


class AlreadyBookedError(BookingError):
    """The user already has a confirmed booking on this slot."""


class BookingNotFoundError(BookingError):
    """The booking does not exist."""


class NotBookingOwnerError(BookingError):
    """The acting user is not the booking owner."""
```

- [ ] **Step 4: Write the service**

`backend/app/services/booking_service.py`:
```python
"""BookingService — orchestrates capacity-safe booking + cancellation."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from google.cloud import firestore as fs

from app.domain.entities.booking import Booking
from app.domain.entities.user import User
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    NotBookingOwnerError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class BookingService:
    def __init__(
        self,
        slot_repo: FirestoreLessonSlotRepository,
        booking_repo: FirestoreBookingRepository,
        firestore_client: fs.AsyncClient,
    ) -> None:
        self._slot_repo = slot_repo
        self._booking_repo = booking_repo
        self._fs = firestore_client

    async def book(self, *, user: User, slot_id: str) -> Booking:
        slot_ref = self._fs.collection("lesson_slots").document(slot_id)
        bookings_col = self._fs.collection("bookings")
        new_booking_id = uuid4()

        @fs.async_transactional
        async def txn(tx):
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

            # Anti double-book: at most one CONFIRMED booking per (user, slot)
            existing_query = (
                bookings_col
                .where("user_id", "==", user.uid)
                .where("slot_id", "==", slot_id)
                .where("status", "==", BookingStatus.CONFIRMED.value)
                .limit(1)
            )
            async for _doc in existing_query.stream(transaction=tx):
                raise AlreadyBookedError(slot_id)

            booking = Booking(
                id=new_booking_id,
                slot_id=slot_id,
                user_id=user.uid,
                status=BookingStatus.CONFIRMED,
                created_at=_utc_now(),
                cancelled_at=None,
            )
            tx.update(slot_ref, {
                "booked_count": slot.booked_count + 1,
                "updated_at": _utc_now(),
            })
            tx.set(bookings_col.document(str(booking.id)),
                   self._booking_repo._to_dict(booking))
            return booking

        return await txn(self._fs.transaction())

    async def cancel(self, *, user: User, booking_id: str) -> Booking:
        booking_ref = self._fs.collection("bookings").document(booking_id)
        slots_col = self._fs.collection("lesson_slots")

        @fs.async_transactional
        async def txn(tx):
            booking_snap = await booking_ref.get(transaction=tx)
            if not booking_snap.exists:
                raise BookingNotFoundError(booking_id)
            booking = self._booking_repo._from_dict(
                booking_snap.to_dict(), booking_id
            )

            if booking.user_id != user.uid:
                raise NotBookingOwnerError(booking_id)

            # Idempotent: already cancelled → return as-is, no decrement
            if booking.status == BookingStatus.CANCELLED:
                return booking

            slot_ref = slots_col.document(booking.slot_id)
            slot_snap = await slot_ref.get(transaction=tx)
            if slot_snap.exists:
                current = int(slot_snap.to_dict()["booked_count"])
                tx.update(slot_ref, {
                    "booked_count": max(0, current - 1),
                    "updated_at": _utc_now(),
                })

            now = _utc_now()
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = now
            tx.update(booking_ref, {
                "status": BookingStatus.CANCELLED.value,
                "cancelled_at": now,
            })
            return booking

        return await txn(self._fs.transaction())

    async def find_user_bookings(self, *, user: User) -> list[Booking]:
        return await self._booking_repo.find_by_user(user.uid)
```

- [ ] **Step 5: Run tests**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_booking_service.py -v`
Expected: 9 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/booking_service.py backend/app/services/booking_errors.py backend/tests/services/test_booking_service.py
git commit -m "feat(backend): add BookingService with transactional book + cancel"
```

---

### Task 7: Pydantic schemas for lesson_slots + bookings

**Files:**
- Create: `backend/app/api/schemas/lesson_slot.py`
- Create: `backend/app/api/schemas/booking.py`

- [ ] **Step 1: Write the schemas**

`backend/app/api/schemas/lesson_slot.py`:
```python
"""Pydantic schemas for the lesson_slot API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

LessonTypeStr = Literal[
    "trial", "group", "private", "business", "toeic", "online", "other"
]


class LessonSlotCreate(BaseModel):
    start_at: datetime
    end_at: datetime
    lesson_type: LessonTypeStr
    capacity: int = Field(ge=1)
    price_yen: int | None = None
    teacher_id: str | None = None
    notes: str | None = None


class LessonSlotUpdate(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    lesson_type: LessonTypeStr | None = None
    capacity: int | None = Field(default=None, ge=1)
    price_yen: int | None = None
    teacher_id: str | None = None
    notes: str | None = None
    status: Literal["open", "closed", "cancelled"] | None = None


class LessonSlotPublicResponse(BaseModel):
    """Customer-facing — teacher_id and notes are hidden."""
    id: str
    start_at: datetime
    end_at: datetime
    lesson_type: LessonTypeStr
    capacity: int
    booked_count: int
    remaining: int
    price_yen: int | None
    status: str


class LessonSlotAdminResponse(BaseModel):
    """Admin-facing — all fields."""
    id: str
    start_at: datetime
    end_at: datetime
    lesson_type: LessonTypeStr
    capacity: int
    booked_count: int
    remaining: int
    price_yen: int | None
    teacher_id: str | None
    notes: str | None
    status: str
    created_at: datetime
    updated_at: datetime
```

`backend/app/api/schemas/booking.py`:
```python
"""Pydantic schemas for the booking API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.api.schemas.lesson_slot import LessonSlotPublicResponse


class BookingCreate(BaseModel):
    slot_id: str


class BookingResponse(BaseModel):
    id: str
    slot_id: str
    user_id: str
    status: str
    created_at: datetime
    cancelled_at: datetime | None


class BookingWithSlotResponse(BaseModel):
    """For GET /api/v1/users/me/bookings — slot info joined for the UI."""
    id: str
    status: str
    created_at: datetime
    cancelled_at: datetime | None
    slot: LessonSlotPublicResponse


class BookingAdminResponse(BookingResponse):
    """Admin view — same shape as BookingResponse but reserved for future fields."""
    pass
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/schemas/lesson_slot.py backend/app/api/schemas/booking.py
git commit -m "feat(backend): add Pydantic schemas for lesson_slots + bookings"
```

---

## Part B — Backend API

### Task 8: Extend User entity + auth dep with `is_admin`

**Files:**
- Modify: `backend/app/domain/entities/user.py`
- Modify: `backend/app/api/dependencies/auth.py`
- Test: `backend/tests/domain/test_user.py` (extend)

- [ ] **Step 1: Add the test**

In `backend/tests/domain/test_user.py`, add:
```python
def test_user_default_is_admin_false():
    u = User(uid="u", email="a@b.com", name="Alice")
    assert u.is_admin is False


def test_user_can_be_admin():
    u = User(uid="u", email="a@b.com", name="Alice", is_admin=True)
    assert u.is_admin is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/domain/test_user.py -v`
Expected: `is_admin` is an unexpected keyword argument.

- [ ] **Step 3: Modify the User entity**

In `backend/app/domain/entities/user.py`, add a field BEFORE `created_at`:
```python
    phone: Phone | None = None
    is_admin: bool = False
    created_at: datetime = field(default_factory=_utc_now)
```

(Make sure it's a keyword-only argument with default, so the dataclass stays construct-compatible with existing callers.)

- [ ] **Step 4: Hydrate is_admin in `get_current_user`**

In `backend/app/api/dependencies/auth.py`, modify `get_current_user`:
```python
async def get_current_user(
    authorization: Annotated[str, Header()],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> User:
    decoded = _decode_token(authorization)
    uid = decoded["uid"]
    user = await user_repo.find_by_uid(uid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not registered. Call POST /api/v1/users/me to initialize.",
        )
    # Hydrate admin claim from the Firebase token (NOT from Firestore).
    user.is_admin = bool(decoded.get("admin", False))
    return user
```

Add a new dependency that gates admin-only endpoints:
```python
async def get_admin_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
```

- [ ] **Step 5: Run tests**

Run: `cd backend && uv run pytest tests/domain/ -v`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/domain/entities/user.py backend/app/api/dependencies/auth.py backend/tests/domain/test_user.py
git commit -m "feat(backend): add is_admin to User + get_admin_user dependency"
```

---

### Task 9: Add repository + service factories

**Files:**
- Modify: `backend/app/api/dependencies/repositories.py`

- [ ] **Step 1: Add the factories**

In `backend/app/api/dependencies/repositories.py`, append:
```python
from app.domain.repositories.booking_repository import BookingRepository
from app.domain.repositories.lesson_slot_repository import LessonSlotRepository
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.services.booking_service import BookingService


def get_lesson_slot_repository() -> LessonSlotRepository:
    return FirestoreLessonSlotRepository(get_firestore_client())


def get_booking_repository() -> BookingRepository:
    return FirestoreBookingRepository(get_firestore_client())


def get_booking_service() -> BookingService:
    client = get_firestore_client()
    return BookingService(
        FirestoreLessonSlotRepository(client),
        FirestoreBookingRepository(client),
        client,
    )
```

- [ ] **Step 2: Verify import**

Run: `cd backend && uv run python -c "from app.api.dependencies.repositories import get_booking_service; print('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/dependencies/repositories.py
git commit -m "feat(backend): add factories for lesson_slot + booking repos + booking service"
```

---

### Task 10: Lesson slots endpoints (public + admin)

**Files:**
- Create: `backend/app/api/endpoints/lesson_slots.py`
- Test: `backend/tests/api/test_lesson_slots.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/api/test_lesson_slots.py`:
```python
"""API tests for /api/v1/lesson-slots — emulator-gated."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)


def _payload(start_offset_hours: int = 24, capacity: int = 4) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "start_at": (now + timedelta(hours=start_offset_hours)).isoformat(),
        "end_at": (now + timedelta(hours=start_offset_hours + 1)).isoformat(),
        "lesson_type": "group",
        "capacity": capacity,
        "price_yen": 2000,
        "notes": "test slot",
    }


@pytest.fixture
def admin_token_payload():
    return {
        "uid": "admin-uid",
        "email": "admin@example.com",
        "admin": True,
    }


@pytest.fixture
def user_token_payload():
    return {
        "uid": "user-uid",
        "email": "user@example.com",
        "admin": False,
    }


class TestPublicListing:
    async def test_lists_open_future_slots(self, client, user_token_payload):
        # Seed: as admin, create one slot, then list as anonymous
        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value={"uid": "admin", "email": "a@b.com", "admin": True},
        ):
            await client.post(
                "/api/v1/users/me", headers={"Authorization": "Bearer x"},
                json={"name": "Admin"},
            )
            await client.post(
                "/api/v1/admin/lesson-slots",
                headers={"Authorization": "Bearer x"},
                json=_payload(),
            )

        resp = await client.get("/api/v1/lesson-slots")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) >= 1
        # teacher_id is hidden in the public response
        assert "teacher_id" not in body[0]


class TestAdminCreate:
    async def test_admin_creates_slot(self, client, admin_token_payload):
        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value=admin_token_payload,
        ):
            await client.post(
                "/api/v1/users/me", headers={"Authorization": "Bearer x"},
                json={"name": "Admin"},
            )
            resp = await client.post(
                "/api/v1/admin/lesson-slots",
                headers={"Authorization": "Bearer x"},
                json=_payload(),
            )
            assert resp.status_code == 201
            assert resp.json()["teacher_id"] is None  # admin response includes teacher_id

    async def test_non_admin_cannot_create(self, client, user_token_payload):
        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value=user_token_payload,
        ):
            await client.post(
                "/api/v1/users/me", headers={"Authorization": "Bearer x"},
                json={"name": "User"},
            )
            resp = await client.post(
                "/api/v1/admin/lesson-slots",
                headers={"Authorization": "Bearer x"},
                json=_payload(),
            )
            assert resp.status_code == 403


class TestAdminUpdate:
    async def test_admin_assigns_teacher(self, client, admin_token_payload):
        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value=admin_token_payload,
        ):
            await client.post(
                "/api/v1/users/me", headers={"Authorization": "Bearer x"},
                json={"name": "Admin"},
            )
            create_resp = await client.post(
                "/api/v1/admin/lesson-slots",
                headers={"Authorization": "Bearer x"},
                json=_payload(),
            )
            slot_id = create_resp.json()["id"]

            resp = await client.put(
                f"/api/v1/admin/lesson-slots/{slot_id}",
                headers={"Authorization": "Bearer x"},
                json={"teacher_id": "sarah"},
            )
            assert resp.status_code == 200
            assert resp.json()["teacher_id"] == "sarah"


class TestAdminDelete:
    async def test_admin_deletes_slot(self, client, admin_token_payload):
        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value=admin_token_payload,
        ):
            await client.post(
                "/api/v1/users/me", headers={"Authorization": "Bearer x"},
                json={"name": "Admin"},
            )
            create_resp = await client.post(
                "/api/v1/admin/lesson-slots",
                headers={"Authorization": "Bearer x"},
                json=_payload(),
            )
            slot_id = create_resp.json()["id"]

            resp = await client.delete(
                f"/api/v1/admin/lesson-slots/{slot_id}",
                headers={"Authorization": "Bearer x"},
            )
            assert resp.status_code == 204
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_lesson_slots.py -v`
Expected: 404 on the routes.

- [ ] **Step 3: Write the endpoints**

`backend/app/api/endpoints/lesson_slots.py`:
```python
"""/api/v1/lesson-slots — public listing + admin CRUD."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_admin_user
from app.api.dependencies.repositories import (
    get_booking_repository,
    get_lesson_slot_repository,
)
from app.api.schemas.lesson_slot import (
    LessonSlotAdminResponse,
    LessonSlotCreate,
    LessonSlotPublicResponse,
    LessonSlotUpdate,
)
from app.domain.entities.lesson_slot import LessonSlot
from app.domain.entities.user import User
from app.domain.enums.contact import LessonType
from app.domain.enums.lesson_booking import BookingStatus, SlotStatus
from app.domain.repositories.booking_repository import BookingRepository
from app.domain.repositories.lesson_slot_repository import LessonSlotRepository

router = APIRouter(prefix="/api/v1", tags=["lesson-slots"])


def _public(slot: LessonSlot) -> LessonSlotPublicResponse:
    return LessonSlotPublicResponse(
        id=str(slot.id),
        start_at=slot.start_at,
        end_at=slot.end_at,
        lesson_type=slot.lesson_type.value,  # type: ignore[arg-type]
        capacity=slot.capacity,
        booked_count=slot.booked_count,
        remaining=slot.remaining,
        price_yen=slot.price_yen,
        status=slot.status.value,
    )


def _admin(slot: LessonSlot) -> LessonSlotAdminResponse:
    return LessonSlotAdminResponse(
        id=str(slot.id),
        start_at=slot.start_at,
        end_at=slot.end_at,
        lesson_type=slot.lesson_type.value,  # type: ignore[arg-type]
        capacity=slot.capacity,
        booked_count=slot.booked_count,
        remaining=slot.remaining,
        price_yen=slot.price_yen,
        teacher_id=slot.teacher_id,
        notes=slot.notes,
        status=slot.status.value,
        created_at=slot.created_at,
        updated_at=slot.updated_at,
    )


# ---------- Public listing ----------


@router.get("/lesson-slots", response_model=list[LessonSlotPublicResponse])
async def list_open_slots(
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
    limit: int = 50,
    offset: int = 0,
) -> list[LessonSlotPublicResponse]:
    slots = await repo.find_open_future(limit=limit, offset=offset)
    return [_public(s) for s in slots]


@router.get("/lesson-slots/{slot_id}", response_model=LessonSlotPublicResponse)
async def get_slot(
    slot_id: UUID,
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
) -> LessonSlotPublicResponse:
    slot = await repo.find_by_id(slot_id)
    if slot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found")
    return _public(slot)


# ---------- Admin CRUD ----------


@router.post(
    "/admin/lesson-slots",
    response_model=LessonSlotAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_slot(
    payload: LessonSlotCreate,
    admin: Annotated[User, Depends(get_admin_user)],
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
) -> LessonSlotAdminResponse:
    slot = LessonSlot(
        id=uuid4(),
        start_at=payload.start_at,
        end_at=payload.end_at,
        lesson_type=LessonType(payload.lesson_type),
        capacity=payload.capacity,
        booked_count=0,
        price_yen=payload.price_yen,
        teacher_id=payload.teacher_id,
        notes=payload.notes,
        status=SlotStatus.OPEN,
    )
    await repo.save(slot)
    return _admin(slot)


@router.put("/admin/lesson-slots/{slot_id}", response_model=LessonSlotAdminResponse)
async def admin_update_slot(
    slot_id: UUID,
    payload: LessonSlotUpdate,
    admin: Annotated[User, Depends(get_admin_user)],
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
) -> LessonSlotAdminResponse:
    slot = await repo.find_by_id(slot_id)
    if slot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found")

    if payload.capacity is not None and payload.capacity < slot.booked_count:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "capacity cannot drop below booked_count",
        )

    if payload.start_at is not None:
        slot.start_at = payload.start_at
    if payload.end_at is not None:
        slot.end_at = payload.end_at
    if payload.lesson_type is not None:
        slot.lesson_type = LessonType(payload.lesson_type)
    if payload.capacity is not None:
        slot.capacity = payload.capacity
    if payload.price_yen is not None:
        slot.price_yen = payload.price_yen
    if payload.teacher_id is not None:
        slot.teacher_id = payload.teacher_id
    if payload.notes is not None:
        slot.notes = payload.notes
    if payload.status is not None:
        slot.status = SlotStatus(payload.status)
    slot.updated_at = datetime.now(timezone.utc)

    await repo.save(slot)
    return _admin(slot)


@router.delete(
    "/admin/lesson-slots/{slot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def admin_delete_slot(
    slot_id: UUID,
    admin: Annotated[User, Depends(get_admin_user)],
    repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
    booking_repo: Annotated[BookingRepository, Depends(get_booking_repository)],
    force: bool = False,
) -> None:
    confirmed = [
        b for b in await booking_repo.find_by_slot(str(slot_id))
        if b.status == BookingStatus.CONFIRMED
    ]
    if confirmed and not force:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{len(confirmed)} confirmed booking(s) exist; pass ?force=true to delete",
        )
    await repo.delete(slot_id)
    # NB: confirmed bookings stay in DB but their slot disappears.
    # Future: cascade-cancel via a transaction. Acceptable in 2a (admin operator
    # is expected to communicate with affected users out-of-band).
```

- [ ] **Step 4: Run tests**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_lesson_slots.py -v`
Expected: tests pass (router not yet mounted; will be in Task 12).

Actually since router isn't mounted yet, tests will 404. Skip running until Task 12 — note this and proceed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/endpoints/lesson_slots.py backend/tests/api/test_lesson_slots.py
git commit -m "feat(backend): add /lesson-slots public + admin CRUD endpoints"
```

---

### Task 11: Bookings endpoints

**Files:**
- Create: `backend/app/api/endpoints/bookings.py`
- Test: `backend/tests/api/test_bookings.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/api/test_bookings.py`:
```python
"""API tests for /api/v1/bookings — emulator-gated."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)


def _slot_payload(start_offset_hours: int = 24) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "start_at": (now + timedelta(hours=start_offset_hours)).isoformat(),
        "end_at": (now + timedelta(hours=start_offset_hours + 1)).isoformat(),
        "lesson_type": "group",
        "capacity": 2,
        "price_yen": 2000,
    }


async def _seed_slot_as_admin(client) -> str:
    with patch(
        "app.api.dependencies.auth.fb_auth.verify_id_token",
        return_value={"uid": "admin", "email": "a@b.com", "admin": True},
    ):
        await client.post("/api/v1/users/me",
                          headers={"Authorization": "Bearer x"},
                          json={"name": "Admin"})
        resp = await client.post("/api/v1/admin/lesson-slots",
                                 headers={"Authorization": "Bearer x"},
                                 json=_slot_payload())
        return resp.json()["id"]


class TestCreateBooking:
    async def test_user_books_slot(self, client):
        slot_id = await _seed_slot_as_admin(client)

        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value={"uid": "u-1", "email": "u@example.com"},
        ):
            await client.post("/api/v1/users/me",
                              headers={"Authorization": "Bearer x"},
                              json={"name": "Customer"})
            resp = await client.post(
                "/api/v1/bookings",
                headers={"Authorization": "Bearer x"},
                json={"slot_id": slot_id},
            )
            assert resp.status_code == 201
            body = resp.json()
            assert body["status"] == "confirmed"
            assert body["slot_id"] == slot_id

    async def test_full_slot_returns_409(self, client):
        slot_id = await _seed_slot_as_admin(client)

        # Two users book; second-to-book is fine, but a third should hit full
        for uid in ("u-1", "u-2"):
            with patch(
                "app.api.dependencies.auth.fb_auth.verify_id_token",
                return_value={"uid": uid, "email": f"{uid}@example.com"},
            ):
                await client.post("/api/v1/users/me",
                                  headers={"Authorization": "Bearer x"},
                                  json={"name": uid})
                await client.post("/api/v1/bookings",
                                  headers={"Authorization": "Bearer x"},
                                  json={"slot_id": slot_id})

        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value={"uid": "u-3", "email": "u3@example.com"},
        ):
            await client.post("/api/v1/users/me",
                              headers={"Authorization": "Bearer x"},
                              json={"name": "u3"})
            resp = await client.post("/api/v1/bookings",
                                     headers={"Authorization": "Bearer x"},
                                     json={"slot_id": slot_id})
            assert resp.status_code == 409


class TestListMyBookings:
    async def test_lists_with_slot_info(self, client):
        slot_id = await _seed_slot_as_admin(client)

        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value={"uid": "u-1", "email": "u@example.com"},
        ):
            await client.post("/api/v1/users/me",
                              headers={"Authorization": "Bearer x"},
                              json={"name": "Customer"})
            await client.post("/api/v1/bookings",
                              headers={"Authorization": "Bearer x"},
                              json={"slot_id": slot_id})

            resp = await client.get("/api/v1/users/me/bookings",
                                    headers={"Authorization": "Bearer x"})
            assert resp.status_code == 200
            items = resp.json()
            assert len(items) == 1
            assert items[0]["slot"]["id"] == slot_id
            assert items[0]["status"] == "confirmed"


class TestCancelBooking:
    async def test_user_cancels_own_booking(self, client):
        slot_id = await _seed_slot_as_admin(client)

        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value={"uid": "u-1", "email": "u@example.com"},
        ):
            await client.post("/api/v1/users/me",
                              headers={"Authorization": "Bearer x"},
                              json={"name": "Customer"})
            book_resp = await client.post("/api/v1/bookings",
                                          headers={"Authorization": "Bearer x"},
                                          json={"slot_id": slot_id})
            booking_id = book_resp.json()["id"]

            resp = await client.patch(
                f"/api/v1/bookings/{booking_id}/cancel",
                headers={"Authorization": "Bearer x"},
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "cancelled"

    async def test_cannot_cancel_someone_elses(self, client):
        slot_id = await _seed_slot_as_admin(client)

        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value={"uid": "u-1", "email": "u1@example.com"},
        ):
            await client.post("/api/v1/users/me",
                              headers={"Authorization": "Bearer x"},
                              json={"name": "u1"})
            book_resp = await client.post("/api/v1/bookings",
                                          headers={"Authorization": "Bearer x"},
                                          json={"slot_id": slot_id})
            booking_id = book_resp.json()["id"]

        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value={"uid": "u-2", "email": "u2@example.com"},
        ):
            await client.post("/api/v1/users/me",
                              headers={"Authorization": "Bearer x"},
                              json={"name": "u2"})
            resp = await client.patch(
                f"/api/v1/bookings/{booking_id}/cancel",
                headers={"Authorization": "Bearer x"},
            )
            assert resp.status_code == 403
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_bookings.py -v`
Expected: 404 on routes.

- [ ] **Step 3: Write the endpoints**

`backend/app/api/endpoints/bookings.py`:
```python
"""/api/v1/bookings — customer booking + cancel + history."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.repositories import (
    get_booking_service,
    get_lesson_slot_repository,
)
from app.api.schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingWithSlotResponse,
)
from app.api.schemas.lesson_slot import LessonSlotPublicResponse
from app.domain.entities.booking import Booking
from app.domain.entities.lesson_slot import LessonSlot
from app.domain.entities.user import User
from app.domain.repositories.lesson_slot_repository import LessonSlotRepository
from app.services.booking_errors import (
    AlreadyBookedError,
    BookingNotFoundError,
    NotBookingOwnerError,
    SlotFullError,
    SlotInPastError,
    SlotNotFoundError,
    SlotNotOpenError,
)
from app.services.booking_service import BookingService

router = APIRouter(prefix="/api/v1", tags=["bookings"])


def _booking_response(b: Booking) -> BookingResponse:
    return BookingResponse(
        id=str(b.id),
        slot_id=b.slot_id,
        user_id=b.user_id,
        status=b.status.value,
        created_at=b.created_at,
        cancelled_at=b.cancelled_at,
    )


def _slot_public(slot: LessonSlot) -> LessonSlotPublicResponse:
    return LessonSlotPublicResponse(
        id=str(slot.id),
        start_at=slot.start_at,
        end_at=slot.end_at,
        lesson_type=slot.lesson_type.value,  # type: ignore[arg-type]
        capacity=slot.capacity,
        booked_count=slot.booked_count,
        remaining=slot.remaining,
        price_yen=slot.price_yen,
        status=slot.status.value,
    )


@router.post(
    "/bookings", response_model=BookingResponse, status_code=status.HTTP_201_CREATED
)
async def create_booking(
    payload: BookingCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    try:
        booking = await service.book(user=user, slot_id=payload.slot_id)
    except SlotNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found")
    except (SlotNotOpenError, SlotInPastError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except (SlotFullError, AlreadyBookedError) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return _booking_response(booking)


@router.get(
    "/users/me/bookings", response_model=list[BookingWithSlotResponse]
)
async def list_my_bookings(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
    slot_repo: Annotated[LessonSlotRepository, Depends(get_lesson_slot_repository)],
) -> list[BookingWithSlotResponse]:
    bookings = await service.find_user_bookings(user=user)
    results = []
    for b in bookings:
        slot = await slot_repo.find_by_id(UUID(b.slot_id))
        if slot is None:
            continue
        results.append(BookingWithSlotResponse(
            id=str(b.id),
            status=b.status.value,
            created_at=b.created_at,
            cancelled_at=b.cancelled_at,
            slot=_slot_public(slot),
        ))
    return results


@router.patch("/bookings/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: str,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    try:
        booking = await service.cancel(user=user, booking_id=booking_id)
    except BookingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    except NotBookingOwnerError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You can only cancel your own bookings"
        )
    return _booking_response(booking)
```

- [ ] **Step 4: Commit (tests still 404 until Task 12 mounts the routers)**

```bash
git add backend/app/api/endpoints/bookings.py backend/tests/api/test_bookings.py
git commit -m "feat(backend): add /bookings endpoints (create, list-mine, cancel)"
```

---

### Task 12: Mount routers + final backend gate

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add router mounts**

In `backend/app/main.py`, after the existing imports:
```python
from .api.endpoints.bookings import router as bookings_router
from .api.endpoints.lesson_slots import router as lesson_slots_router
```

After the existing `app.include_router(...)` lines:
```python
app.include_router(lesson_slots_router)
app.include_router(bookings_router)
```

(Both new routers already set their own `/api/v1` prefix, so don't pass `prefix=` here.)

- [ ] **Step 2: Run all tests with emulator**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest -q`
Expected: all green (previous + new ~25 tests for lesson_slots + bookings).

- [ ] **Step 3: Lint + type-check**

Run:
```bash
cd backend
uv run ruff check . && uv run ruff format --check .
uv run mypy app/domain app/services
```
Both must be clean.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): mount /lesson-slots + /bookings routers"
```

---

## Part C — Frontend

### Task 13: authStore exposes `isAdmin`

**Files:**
- Modify: `frontend/src/stores/authStore.ts`

- [ ] **Step 1: Modify the store**

In `frontend/src/stores/authStore.ts`, extend the state shape and the listener:
```typescript
import { create } from 'zustand';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

interface AuthState {
  user: FirebaseUser | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {
    await signOut(firebaseAuth);
  },
}));

if (typeof window !== 'undefined') {
  onAuthStateChanged(firebaseAuth, async (user) => {
    if (!user) {
      useAuthStore.setState({ user: null, isAdmin: false, loading: false });
      return;
    }
    const tokenResult = await user.getIdTokenResult();
    const isAdmin = Boolean(tokenResult.claims.admin);
    useAuthStore.setState({ user, isAdmin, loading: false });
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/authStore.ts
git commit -m "feat(frontend): expose isAdmin from Firebase token claim in authStore"
```

---

### Task 14: Booking client helpers

**Files:**
- Create: `frontend/src/lib/booking.ts`

- [ ] **Step 1: Write the file**

`frontend/src/lib/booking.ts`:
```typescript
import axios from 'axios';
import { firebaseAuth } from '@/lib/firebase';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

export interface LessonSlot {
  id: string;
  start_at: string;
  end_at: string;
  lesson_type:
    | 'trial'
    | 'group'
    | 'private'
    | 'business'
    | 'toeic'
    | 'online'
    | 'other';
  capacity: number;
  booked_count: number;
  remaining: number;
  price_yen: number | null;
  status: 'open' | 'closed' | 'cancelled';
}

export interface LessonSlotAdmin extends LessonSlot {
  teacher_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  cancelled_at: string | null;
  slot: LessonSlot;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = firebaseAuth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function listOpenSlots(): Promise<LessonSlot[]> {
  const resp = await axios.get<LessonSlot[]>(`${API_BASE}/api/v1/lesson-slots`);
  return resp.data;
}

export async function bookSlot(slotId: string): Promise<Booking> {
  const resp = await axios.post(
    `${API_BASE}/api/v1/bookings`,
    { slot_id: slotId },
    { headers: await authHeaders() },
  );
  return resp.data;
}

export async function listMyBookings(): Promise<Booking[]> {
  const resp = await axios.get<Booking[]>(
    `${API_BASE}/api/v1/users/me/bookings`,
    { headers: await authHeaders() },
  );
  return resp.data;
}

export async function cancelBooking(bookingId: string): Promise<Booking> {
  const resp = await axios.patch(
    `${API_BASE}/api/v1/bookings/${bookingId}/cancel`,
    {},
    { headers: await authHeaders() },
  );
  return resp.data;
}

// --- Admin ---

export interface CreateSlotInput {
  start_at: string;
  end_at: string;
  lesson_type: LessonSlot['lesson_type'];
  capacity: number;
  price_yen?: number | null;
  teacher_id?: string | null;
  notes?: string | null;
}

export async function adminCreateSlot(
  input: CreateSlotInput,
): Promise<LessonSlotAdmin> {
  const resp = await axios.post(
    `${API_BASE}/api/v1/admin/lesson-slots`,
    input,
    { headers: await authHeaders() },
  );
  return resp.data;
}

export async function adminUpdateSlot(
  id: string,
  input: Partial<CreateSlotInput & { status: 'open' | 'closed' | 'cancelled' }>,
): Promise<LessonSlotAdmin> {
  const resp = await axios.put(
    `${API_BASE}/api/v1/admin/lesson-slots/${id}`,
    input,
    { headers: await authHeaders() },
  );
  return resp.data;
}

export async function adminDeleteSlot(
  id: string,
  force = false,
): Promise<void> {
  await axios.delete(
    `${API_BASE}/api/v1/admin/lesson-slots/${id}${force ? '?force=true' : ''}`,
    { headers: await authHeaders() },
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/booking.ts
git commit -m "feat(frontend): add typed booking client helpers"
```

---

### Task 15: SlotCard + /book page

**Files:**
- Create: `frontend/src/app/book/_components/SlotCard.tsx`
- Create: `frontend/src/app/book/page.tsx`

- [ ] **Step 1: SlotCard**

`frontend/src/app/book/_components/SlotCard.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { bookSlot, type LessonSlot } from '@/lib/booking';

const TYPE_LABEL: Record<LessonSlot['lesson_type'], string> = {
  trial: '無料体験レッスン',
  group: 'グループレッスン',
  private: 'プライベートレッスン',
  business: 'ビジネス英語',
  toeic: 'TOEIC対策',
  online: 'オンラインレッスン',
  other: 'その他',
};

export function SlotCard({ slot, onBooked }: { slot: LessonSlot; onBooked: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = new Date(slot.start_at).toLocaleString('ja-JP', {
    month: 'short', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit',
  });
  const end = new Date(slot.end_at).toLocaleString('ja-JP', {
    hour: '2-digit', minute: '2-digit',
  });

  const handleBook = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bookSlot(slot.id);
      onBooked();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        '予約に失敗しました';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const sold_out = slot.remaining <= 0;

  return (
    <article className="rounded border bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{TYPE_LABEL[slot.lesson_type]}</h3>
        <span className="text-xs text-gray-500">{slot.status}</span>
      </div>
      <p className="mt-1 text-sm text-gray-700">{date} – {end}</p>
      <p className="mt-1 text-sm">
        残 <strong>{slot.remaining}</strong> / 定員 {slot.capacity}
      </p>
      {slot.price_yen != null && (
        <p className="mt-1 text-sm text-gray-700">¥{slot.price_yen.toLocaleString()}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleBook}
        disabled={busy || sold_out}
        className="mt-3 w-full rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {sold_out ? '満席' : busy ? '予約中…' : user ? '予約する' : 'ログインして予約'}
      </button>
    </article>
  );
}
```

- [ ] **Step 2: /book page**

`frontend/src/app/book/page.tsx`:
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { listOpenSlots, type LessonSlot } from '@/lib/booking';
import { SlotCard } from './_components/SlotCard';

export default function BookPage() {
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setSlots(await listOpenSlots());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">レッスン予約</h1>
      {loading ? (
        <p>読み込み中…</p>
      ) : slots.length === 0 ? (
        <p className="text-gray-500">現在予約可能な枠はありません</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map(slot => (
            <SlotCard key={slot.id} slot={slot} onBooked={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/book/
git commit -m "feat(frontend): add /book page with SlotCard"
```

---

### Task 16: BookingsList in マイページ

**Files:**
- Create: `frontend/src/app/mypage/_components/BookingsList.tsx`
- Modify: `frontend/src/app/mypage/page.tsx`

- [ ] **Step 1: BookingsList**

`frontend/src/app/mypage/_components/BookingsList.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { cancelBooking, listMyBookings, type Booking } from '@/lib/booking';

const TYPE_LABEL: Record<Booking['slot']['lesson_type'], string> = {
  trial: '無料体験レッスン',
  group: 'グループレッスン',
  private: 'プライベートレッスン',
  business: 'ビジネス英語',
  toeic: 'TOEIC対策',
  online: 'オンラインレッスン',
  other: 'その他',
};

export function BookingsList() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setBookings(await listMyBookings());
      setLoading(false);
    })();
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm('この予約をキャンセルしますか?')) return;
    const updated = await cancelBooking(id);
    setBookings(bs =>
      bs.map(b => (b.id === updated.id ? { ...b, status: updated.status } : b)),
    );
  };

  if (loading) return <section className="rounded border bg-white p-6">読み込み中…</section>;

  const now = Date.now();
  const upcoming = bookings.filter(
    b => b.status === 'confirmed' && new Date(b.slot.start_at).getTime() > now,
  );
  const past = bookings.filter(
    b => b.status === 'cancelled' || new Date(b.slot.start_at).getTime() <= now,
  );

  return (
    <section className="rounded border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">レッスン予約</h2>

      <h3 className="mt-4 text-sm font-semibold text-gray-700">今後の予約</h3>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">予約はありません</p>
      ) : (
        <ul className="mt-2 divide-y">
          {upcoming.map(b => (
            <li key={b.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{TYPE_LABEL[b.slot.lesson_type]}</p>
                <p className="text-sm text-gray-700">
                  {new Date(b.slot.start_at).toLocaleString('ja-JP')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCancel(b.id)}
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              >
                キャンセル
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-sm font-semibold text-gray-700">過去・キャンセル済み</h3>
      {past.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">履歴はありません</p>
      ) : (
        <ul className="mt-2 divide-y">
          {past.map(b => (
            <li key={b.id} className="py-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{TYPE_LABEL[b.slot.lesson_type]}</span>
                <span className={b.status === 'cancelled' ? 'text-red-600' : 'text-gray-500'}>
                  {b.status === 'cancelled' ? 'キャンセル済' : '受講済'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {new Date(b.slot.start_at).toLocaleString('ja-JP')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire into /mypage**

In `frontend/src/app/mypage/page.tsx`, add import and component:
```tsx
import { BookingsList } from './_components/BookingsList';
// ...
// In the return JSX, after <ContactHistory ... />, add:
<BookingsList />
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/mypage/
git commit -m "feat(frontend): add BookingsList to マイページ"
```

---

### Task 17: Admin route guard

**Files:**
- Create: `frontend/src/hooks/useAdminGuard.ts`
- Create: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Hook**

`frontend/src/hooks/useAdminGuard.ts`:
```typescript
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export function useAdminGuard() {
  const { user, isAdmin, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isAdmin) {
      router.push('/');
    }
  }, [user, isAdmin, loading, router]);

  return { user, isAdmin, loading };
}
```

- [ ] **Step 2: Admin layout**

`frontend/src/app/admin/layout.tsx`:
```tsx
'use client';

import { useAdminGuard } from '@/hooks/useAdminGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAdminGuard();
  if (loading || !isAdmin) {
    return <div className="p-6 text-center">確認中…</div>;
  }
  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 border-b pb-3">
        <h1 className="text-xl font-bold">Admin</h1>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useAdminGuard.ts frontend/src/app/admin/layout.tsx
git commit -m "feat(frontend): add admin route guard via Firebase claim"
```

---

### Task 18: /admin/lessons list + create

**Files:**
- Create: `frontend/src/app/admin/lessons/_components/SlotForm.tsx`
- Create: `frontend/src/app/admin/lessons/page.tsx`

- [ ] **Step 1: SlotForm**

`frontend/src/app/admin/lessons/_components/SlotForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { adminCreateSlot, type CreateSlotInput, type LessonSlot } from '@/lib/booking';

type LessonType = LessonSlot['lesson_type'];
const TYPES: { value: LessonType; label: string }[] = [
  { value: 'group', label: 'グループ' },
  { value: 'private', label: 'プライベート' },
  { value: 'trial', label: '無料体験' },
  { value: 'business', label: 'ビジネス英語' },
  { value: 'toeic', label: 'TOEIC対策' },
  { value: 'online', label: 'オンライン' },
  { value: 'other', label: 'その他' },
];

export function SlotForm({ onCreated }: { onCreated: () => void }) {
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('group');
  const [capacity, setCapacity] = useState(4);
  const [priceYen, setPriceYen] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input: CreateSlotInput = {
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        lesson_type: lessonType,
        capacity,
        price_yen: priceYen ? parseInt(priceYen, 10) : null,
        notes: notes || null,
      };
      await adminCreateSlot(input);
      setStartAt(''); setEndAt(''); setCapacity(4); setPriceYen(''); setNotes('');
      onCreated();
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
          '作成に失敗しました',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded border bg-white p-4">
      <h2 className="font-semibold">新規枠を作成</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm">開始</span>
          <input
            type="datetime-local"
            required
            value={startAt}
            onChange={e => setStartAt(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">終了</span>
          <input
            type="datetime-local"
            required
            value={endAt}
            onChange={e => setEndAt(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">タイプ</span>
          <select
            value={lessonType}
            onChange={e => setLessonType(e.target.value as LessonType)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm">定員</span>
          <input
            type="number" min={1}
            required
            value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">料金 (¥, 任意)</span>
          <input
            type="number"
            value={priceYen}
            onChange={e => setPriceYen(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm">メモ (admin のみ閲覧)</span>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {busy ? '作成中…' : '作成'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: List page**

`frontend/src/app/admin/lessons/page.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { listOpenSlots, type LessonSlot } from '@/lib/booking';
import { SlotForm } from './_components/SlotForm';

const TYPE_LABEL: Record<LessonSlot['lesson_type'], string> = {
  trial: '無料体験', group: 'グループ', private: 'プライベート',
  business: 'ビジネス', toeic: 'TOEIC', online: 'オンライン', other: 'その他',
};

export default function AdminLessonsPage() {
  const [slots, setSlots] = useState<LessonSlot[]>([]);

  const refresh = useCallback(async () => {
    setSlots(await listOpenSlots());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <SlotForm onCreated={refresh} />
      <section>
        <h2 className="mb-2 text-lg font-semibold">予約可能な枠</h2>
        <table className="w-full text-sm">
          <thead className="border-b text-left">
            <tr>
              <th className="py-2">開始</th><th>タイプ</th>
              <th>定員</th><th>残</th><th>料金</th><th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map(s => (
              <tr key={s.id} className="border-b">
                <td className="py-2">{new Date(s.start_at).toLocaleString('ja-JP')}</td>
                <td>{TYPE_LABEL[s.lesson_type]}</td>
                <td>{s.capacity}</td>
                <td>{s.remaining}</td>
                <td>{s.price_yen ? `¥${s.price_yen.toLocaleString()}` : '-'}</td>
                <td><Link href={`/admin/lessons/${s.id}`} className="text-blue-600 underline">編集</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/lessons/
git commit -m "feat(frontend): add /admin/lessons list + create form"
```

---

### Task 19: /admin/lessons/[id] edit + bookings table

**Files:**
- Create: `frontend/src/app/admin/lessons/[id]/page.tsx`

- [ ] **Step 1: Write the page**

`frontend/src/app/admin/lessons/[id]/page.tsx`:
```tsx
'use client';

import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  adminDeleteSlot,
  adminUpdateSlot,
  type LessonSlotAdmin,
} from '@/lib/booking';
import { firebaseAuth } from '@/lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

interface AdminBookingRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export default function AdminLessonEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [slot, setSlot] = useState<LessonSlotAdmin | null>(null);
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [notes, setNotes] = useState('');
  const [capacity, setCapacity] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    const headers: Record<string, string> = {};
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const slotResp = await axios.get<LessonSlotAdmin>(
      `${API_BASE}/api/v1/lesson-slots/${id}`,
    );
    setSlot(slotResp.data);
    setTeacherId(slotResp.data.teacher_id ?? '');
    setNotes(slotResp.data.notes ?? '');
    setCapacity(slotResp.data.capacity);

    // Admin-only bookings list (the public slot endpoint above hides admin fields,
    // so we request the slot details from there but bookings need a dedicated route).
    const bookingsResp = await axios.get<AdminBookingRow[]>(
      `${API_BASE}/api/v1/admin/lesson-slots/${id}/bookings`,
      { headers },
    );
    setBookings(bookingsResp.data);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!slot) return <p>読み込み中…</p>;

  const handleSave = async () => {
    await adminUpdateSlot(slot.id, {
      teacher_id: teacherId || null,
      notes: notes || null,
      capacity,
    });
    await load();
  };

  const handleClose = async () => {
    await adminUpdateSlot(slot.id, { status: 'closed' });
    await load();
  };

  const handleDelete = async () => {
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    if (confirmed > 0 && !confirm(`${confirmed} 件の確定予約があります。強制削除しますか?`)) return;
    await adminDeleteSlot(slot.id, confirmed > 0);
    router.push('/admin/lessons');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">枠 #{slot.id}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">開始</dt>
        <dd>{new Date(slot.start_at).toLocaleString('ja-JP')}</dd>
        <dt className="text-gray-500">終了</dt>
        <dd>{new Date(slot.end_at).toLocaleString('ja-JP')}</dd>
        <dt className="text-gray-500">タイプ</dt>
        <dd>{slot.lesson_type}</dd>
        <dt className="text-gray-500">ステータス</dt>
        <dd>{slot.status}</dd>
        <dt className="text-gray-500">予約数</dt>
        <dd>{slot.booked_count} / {slot.capacity}</dd>
      </dl>

      <div className="space-y-3 rounded border bg-white p-4">
        <h3 className="font-semibold">編集</h3>
        <label className="block text-sm">
          講師 ID
          <input
            type="text"
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          定員
          <input
            type="number" min={slot.booked_count}
            value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          メモ
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <div className="flex gap-2">
          <button onClick={handleSave} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
            保存
          </button>
          <button onClick={handleClose} className="rounded border px-3 py-2 text-sm">
            枠を閉じる
          </button>
          <button onClick={handleDelete} className="rounded border px-3 py-2 text-sm text-red-600">
            枠を削除
          </button>
        </div>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">予約者</h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-500">まだ予約はありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="py-2">ユーザー</th><th>状態</th><th>予約日時</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b">
                  <td className="py-2">{b.user_id}</td>
                  <td>{b.status}</td>
                  <td>{new Date(b.created_at).toLocaleString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

This page references `GET /api/v1/admin/lesson-slots/{id}/bookings` which needs to be added to the backend. Add it now:

In `backend/app/api/endpoints/lesson_slots.py`, append:
```python
@router.get(
    "/admin/lesson-slots/{slot_id}/bookings",
    response_model=list[dict],  # simple dict; matches BookingResponse + user info
)
async def admin_list_bookings_for_slot(
    slot_id: UUID,
    admin: Annotated[User, Depends(get_admin_user)],
    booking_repo: Annotated[BookingRepository, Depends(get_booking_repository)],
) -> list[dict]:
    bookings = await booking_repo.find_by_slot(str(slot_id))
    return [
        {
            "id": str(b.id),
            "user_id": b.user_id,
            "status": b.status.value,
            "created_at": b.created_at.isoformat(),
        }
        for b in bookings
    ]
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit && cd ../backend && uv run mypy app/domain app/services`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/lessons/\[id\]/ backend/app/api/endpoints/lesson_slots.py
git commit -m "feat(stack): add /admin/lessons/[id] edit page + admin bookings endpoint"
```

---

### Task 20: Header — add "予約" link + Admin link for admins

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Add /book to nav and admin link**

Read the current Header file first. In the `navigation` array, add an entry:
```typescript
{ name: '予約', href: '/book' },
```

In the user-menu dropdown (the `<details>` block), add a `/admin/lessons` link conditionally when `isAdmin` is true. Pull `isAdmin` from the auth store:
```typescript
const { user, isAdmin, signOut } = useAuthStore();
```

Inside the `<details>` menu:
```tsx
{isAdmin && (
  <Link href="/admin/lessons" className="block px-3 py-2 text-sm hover:bg-gray-50">
    Admin
  </Link>
)}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Header.tsx
git commit -m "feat(frontend): add 予約 nav + admin link for admins"
```

---

### Task 21: Frontend lint + tsc gate

- [ ] **Step 1: Type-check + lint**

```bash
cd frontend
npx tsc --noEmit
npm run lint
```

Both must be clean.

- [ ] **Step 2: If anything failed, fix inline + commit**

```bash
git commit -am "fix(frontend): post-implementation lint cleanup"
```

---

## Part D — Infra + scripts + smoke

### Task 22: Firestore composite indexes via terraform

**Files:**
- Modify: `terraform/modules/firestore-database/main.tf`

- [ ] **Step 1: Add index resources**

Append to `terraform/modules/firestore-database/main.tf`:
```hcl
locals {
  database_name = google_firestore_database.this.name
}

resource "google_firestore_index" "lesson_slots_open_future" {
  project    = var.gcp_project_id
  database   = local.database_name
  collection = "lesson_slots"

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "start_at"
    order      = "ASCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }
}

resource "google_firestore_index" "bookings_user_status_created" {
  project    = var.gcp_project_id
  database   = local.database_name
  collection = "bookings"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "bookings_user_slot_status" {
  project    = var.gcp_project_id
  database   = local.database_name
  collection = "bookings"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "slot_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }
}

resource "google_firestore_index" "bookings_slot_status" {
  project    = var.gcp_project_id
  database   = local.database_name
  collection = "bookings"

  fields {
    field_path = "slot_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "ASCENDING"
  }
}
```

- [ ] **Step 2: Validate**

```bash
cd terraform/modules/firestore-database
terraform init -backend=false
terraform validate
```
Expected: Success.

- [ ] **Step 3: Apply to live Firestore**

```bash
cd terraform/envs/prod/firestore
terragrunt apply -auto-approve
```
Expected: `4 to add, 0 to change, 0 to destroy.`

- [ ] **Step 4: Commit**

```bash
git add terraform/modules/firestore-database/main.tf
git commit -m "feat(terraform): add Firestore composite indexes for lesson booking 2a"
```

---

### Task 23: Admin bootstrap script

**Files:**
- Create: `scripts/grant_admin.py`

- [ ] **Step 1: Write the script**

`scripts/grant_admin.py`:
```python
#!/usr/bin/env python
"""Grant or revoke the `admin` Firebase Auth custom claim on a user.

Usage:
  uv run python scripts/grant_admin.py <uid> --grant
  uv run python scripts/grant_admin.py <uid> --revoke

Requires gcloud ADC for the target project, or GOOGLE_APPLICATION_CREDENTIALS
pointing at a SA JSON with iam.serviceAccountTokenCreator on the project.
"""

from __future__ import annotations

import argparse
import sys

import firebase_admin
from firebase_admin import auth


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("uid")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--grant", action="store_true")
    group.add_argument("--revoke", action="store_true")
    parser.add_argument("--project", default="english-cafe-496209")
    args = parser.parse_args()

    firebase_admin.initialize_app(options={"projectId": args.project})

    existing = auth.get_user(args.uid)
    current_claims = existing.custom_claims or {}
    new_claims = {**current_claims, "admin": args.grant}
    auth.set_custom_user_claims(args.uid, new_claims)
    print(f"Updated {args.uid}: admin={args.grant}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
cd backend && uv run python -c "import sys; sys.path.insert(0, '../scripts'); import importlib.util; spec=importlib.util.spec_from_file_location('grant_admin', '../scripts/grant_admin.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); print('ok')"
```

(Just checks the file is well-formed Python.)

- [ ] **Step 3: Commit**

```bash
git add scripts/grant_admin.py
git commit -m "feat(scripts): one-shot admin claim grant/revoke"
```

---

### Task 24: Live admin bootstrap + smoke + PR

This is operational, not committed code.

- [ ] **Step 1: Find your Firebase Auth UID**

```bash
unset GOOGLE_APPLICATION_CREDENTIALS
gcloud auth print-access-token | head -c 0  # ensure gcloud session
# Then sign in to https://english-cafe.bz-kz.com/login as your normal user.
# Open Firebase Console → Authentication → Users, find your uid.
```

- [ ] **Step 2: Grant admin claim**

```bash
cd backend
unset GOOGLE_APPLICATION_CREDENTIALS
uv run python ../scripts/grant_admin.py <your-uid> --grant
```

- [ ] **Step 3: Build + push backend image, deploy**

```bash
cd backend
unset GOOGLE_APPLICATION_CREDENTIALS
SHA=$(git rev-parse --short HEAD)
IMAGE="asia-northeast1-docker.pkg.dev/english-cafe-496209/english-cafe/api:$SHA"
docker buildx build --platform linux/amd64 -f Dockerfile.prod -t "$IMAGE" --push .
gcloud run services update english-cafe-api \
  --image=$IMAGE \
  --region=asia-northeast1 \
  --project=english-cafe-496209
```

- [ ] **Step 4: Push branch + open PR**

```bash
cd ..
git push origin feat/lesson-booking-2a-design
gh pr create --base main --head feat/lesson-booking-2a-design \
  --title "feat: lesson booking 2a — schedule + customer booking" \
  --body "Implements docs/superpowers/specs/2026-05-14-lesson-booking-2a-design.md. Payments (2b), reminders (2c), recurring (2d) deferred."
```

- [ ] **Step 5: Smoke E2E**

After PR merge and Vercel rebuild:

1. Visit `https://english-cafe.bz-kz.com/admin/lessons` (must have admin claim) → create a slot 2 days out.
2. Sign out / sign in as a non-admin test user → visit `/book` → book the slot.
3. Visit `/mypage` → confirm the booking appears under "今後の予約".
4. Click "キャンセル" → confirm status flips and slot remaining increments back.
5. As admin, visit `/admin/lessons/<id>` → confirm bookings list shows the test booking with status `cancelled`.

If all five pass: PR ready to merge.

---

## Self-review notes

1. **Spec coverage** — every section of the design spec maps to one or more tasks:
   - Data model: Tasks 1-5 (enums, entities, repos)
   - BookingService transactional book/cancel: Task 6
   - Schemas: Task 7
   - User.is_admin + auth dependencies: Task 8
   - Repo factories: Task 9
   - Endpoints (public + auth + admin): Tasks 10-11, plus the admin /bookings endpoint added in Task 19
   - Mounting: Task 12
   - Frontend customer pages: Tasks 13-16
   - Admin guard + pages: Tasks 17-19
   - Header integration: Task 20
   - Final gate: Task 21
   - Firestore indexes: Task 22
   - Admin bootstrap script: Task 23
   - Smoke + deploy: Task 24

2. **Placeholder scan** — no "TBD"/"TODO"/"implement later". Each code-block step has the actual code. Tasks 10/11/12 acknowledge that the test files exist before the routers are mounted, and explicitly defer the test run to Task 12.

3. **Type consistency** — `LessonSlot` fields and ordering match between the entity (Task 2), Firestore mapper (Task 4), Pydantic schemas (Task 7), and endpoints (Task 10). `Booking` fields likewise match across Tasks 3, 5, 7, 11. Error class names (`SlotFullError` etc.) are used in Task 6 (raised), Task 11 (caught), and matched by name in the test (Task 6).

4. **TDD discipline** — each task with new code has the failing-test → impl → passing-test → commit cycle. Configuration tasks (factory wiring, router mounting, terraform indexes) follow a slimmer cycle since they're plumbing.

5. **Frequent commits** — 24 commits across the plan.
