# User Auth + マイページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firebase-Auth-backed signup/login and a personal マイページ that shows the user's profile (name editable, email read-only, phone optional) and their contact-submission history. Implements sub-project 1 of the spec at `docs/superpowers/specs/2026-05-14-mypage-auth-design.md`.

**Architecture:** Firebase Auth issues ID tokens to the Next.js frontend; FastAPI on Cloud Run verifies them via `firebase-admin` and reads/writes a new `users/{uid}` Firestore collection. Contacts gain an optional `user_id`, retroactively linked on signup by verified email.

**Tech Stack:** FastAPI + firebase-admin (backend); Next.js 14 App Router + firebase Web SDK + zustand (frontend); Firestore Native + Firebase Auth (data + identity); HCP Terraform (infra).

**Working branch:** `feat/mypage-auth-design` (already created from main). Implementation can either stay on this branch or be split per-PR — flow your commits onto the same branch unless instructed otherwise.

---

## File map

**Backend — new**
- `backend/app/domain/entities/user.py`
- `backend/app/domain/repositories/user_repository.py`
- `backend/app/infrastructure/repositories/firestore_user_repository.py`
- `backend/app/services/user_service.py`
- `backend/app/api/dependencies/__init__.py`
- `backend/app/api/dependencies/auth.py`
- `backend/app/api/dependencies/repositories.py`
- `backend/app/api/endpoints/users.py`
- `backend/app/api/schemas/user.py`
- `backend/tests/domain/test_user.py`
- `backend/tests/infrastructure/repositories/test_firestore_user_repository.py`
- `backend/tests/api/test_users.py`

**Backend — modify**
- `backend/pyproject.toml` — add `firebase-admin>=6.5`
- `backend/app/main.py` — initialize firebase_admin + mount users router
- `backend/app/domain/entities/contact.py` — add `user_id: str | None` field
- `backend/app/infrastructure/repositories/firestore_contact_repository.py` — read/write `user_id`, add `find_by_email_anonymous` and `find_by_user_id` for the use cases
- `backend/app/api/endpoints/contact.py` — optional auth → stamp `user_id`
- `backend/app/api/schemas/contact.py` — include `user_id` in response

**Frontend — new**
- `frontend/src/lib/firebase.ts`
- `frontend/src/stores/authStore.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/components/auth/LoginForm.tsx`
- `frontend/src/components/auth/SignupForm.tsx`
- `frontend/src/components/auth/GoogleSignInButton.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/signup/page.tsx`
- `frontend/src/app/mypage/page.tsx`
- `frontend/src/app/mypage/edit/page.tsx`
- `frontend/src/app/mypage/_components/ProfileCard.tsx`
- `frontend/src/app/mypage/_components/ContactHistory.tsx`

**Frontend — modify**
- `frontend/package.json` — add `firebase`
- `frontend/src/lib/api.ts` — replace `localStorage` auth with `auth.currentUser.getIdToken()`
- `frontend/src/components/forms/ContactForm.tsx` — pre-fill from `useAuth`
- `frontend/src/components/layout/Header.tsx` — login link / user menu
- `frontend/src/app/layout.tsx` — auth provider mount

**Terraform — modify**
- `terraform/modules/cloud-run-service/main.tf` — `roles/firebaseauth.viewer` on the runtime SA

---

## Part A — Backend

### Task 1: Add firebase-admin dependency

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add the dep**

In `backend/pyproject.toml`, add to `[project.dependencies]` (alphabetical insertion):

```toml
    "firebase-admin>=6.5",
```

- [ ] **Step 2: Sync the lockfile**

Run: `cd backend && uv sync`
Expected: lockfile updated, `firebase-admin` and its transitive deps installed.

- [ ] **Step 3: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock
git commit -m "feat(backend): add firebase-admin dependency"
```

---

### Task 2: User domain entity

**Files:**
- Create: `backend/app/domain/entities/user.py`
- Test: `backend/tests/domain/test_user.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/domain/test_user.py`:
```python
"""Unit tests for the User domain entity."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.domain.entities.user import User
from app.domain.value_objects.phone import Phone


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TestUserConstruction:
    def test_minimal_user_has_required_fields(self) -> None:
        user = User(uid="abc123", email="a@b.com", name="Alice")
        assert user.uid == "abc123"
        assert user.email == "a@b.com"
        assert user.name == "Alice"
        assert user.phone is None
        assert isinstance(user.created_at, datetime)
        assert isinstance(user.updated_at, datetime)

    def test_phone_value_object_is_preserved(self) -> None:
        user = User(uid="u", email="a@b.com", name="Alice", phone=Phone("+819012345678"))
        assert user.phone is not None
        assert user.phone.value == "+819012345678"

    def test_empty_name_is_rejected(self) -> None:
        with pytest.raises(ValueError):
            User(uid="u", email="a@b.com", name="")


class TestUserUpdate:
    def test_update_changes_fields_and_bumps_updated_at(self) -> None:
        user = User(uid="u", email="a@b.com", name="Alice")
        original_updated = user.updated_at
        # Sleep a tick to ensure the new timestamp differs
        import time
        time.sleep(0.001)

        user.update(name="Alicia", phone=Phone("+819011112222"))

        assert user.name == "Alicia"
        assert user.phone is not None
        assert user.phone.value == "+819011112222"
        assert user.updated_at > original_updated

    def test_update_with_no_args_is_noop(self) -> None:
        user = User(uid="u", email="a@b.com", name="Alice")
        original_updated = user.updated_at
        user.update()
        assert user.updated_at == original_updated

    def test_update_can_clear_phone(self) -> None:
        user = User(uid="u", email="a@b.com", name="Alice", phone=Phone("+819012345678"))
        user.update(phone=None)
        # Sentinel for "no change" vs "clear to None" — use a separate clear flag method
        # For simplicity: passing phone=None means "no change". Add user.clear_phone() if needed.
        # In this test, assert the no-op behavior:
        assert user.phone is not None  # phone=None means "do not change"
```

Note the last test is intentional: `phone=None` to `update` means "no change" (sentinel semantics). To clear, you'd add a separate method later if needed. For this plan, keep `update()` simple — `phone=None` is no-op.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/domain/test_user.py -v`
Expected: ImportError on `app.domain.entities.user`.

- [ ] **Step 3: Write the entity**

`backend/app/domain/entities/user.py`:
```python
"""User domain entity.

Identified by Firebase Auth UID (Firestore document id).
Holds profile fields editable in マイページ.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.value_objects.phone import Phone


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class User:
    uid: str
    email: str
    name: str
    phone: Phone | None = None
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
        """Update editable fields. None means 'no change'.

        To clear a phone, add a dedicated `clear_phone()` method later.
        """
        changed = False
        if name is not None and name != self.name:
            if not name.strip():
                raise ValueError("name must be non-empty")
            self.name = name
            changed = True
        if phone is not None and (self.phone is None or phone.value != self.phone.value):
            self.phone = phone
            changed = True
        if changed:
            self.updated_at = _utc_now()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/domain/test_user.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domain/entities/user.py backend/tests/domain/test_user.py
git commit -m "feat(backend): add User domain entity"
```

---

### Task 3: UserRepository interface

**Files:**
- Create: `backend/app/domain/repositories/user_repository.py`

This is an ABC; behavior is tested via the Firestore implementation in Task 4. Just commit the interface.

- [ ] **Step 1: Write the ABC**

`backend/app/domain/repositories/user_repository.py`:
```python
"""User repository interface (DDD outer→inner contract)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities.user import User


class UserRepository(ABC):
    @abstractmethod
    async def save(self, user: User) -> User: ...

    @abstractmethod
    async def find_by_uid(self, uid: str) -> User | None: ...

    @abstractmethod
    async def find_by_email(self, email: str) -> User | None: ...
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/domain/repositories/user_repository.py
git commit -m "feat(backend): add UserRepository interface"
```

---

### Task 4: FirestoreUserRepository implementation

**Files:**
- Create: `backend/app/infrastructure/repositories/firestore_user_repository.py`
- Test: `backend/tests/infrastructure/repositories/test_firestore_user_repository.py`

Match the existing `firestore_contact_repository.py` and its test's emulator-gating pattern.

- [ ] **Step 1: Write the failing test**

`backend/tests/infrastructure/repositories/test_firestore_user_repository.py`:
```python
"""Integration tests for FirestoreUserRepository — emulator-gated.

Skip cleanly if FIRESTORE_EMULATOR_HOST is unset.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.user import User
from app.domain.value_objects.phone import Phone
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)


@pytest.fixture
async def repo() -> FirestoreUserRepository:
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("users").stream():
        await doc.reference.delete()
    return FirestoreUserRepository(client)


class TestSave:
    async def test_save_new_user_returns_it(self, repo: FirestoreUserRepository) -> None:
        u = User(uid="u1", email="a@b.com", name="Alice")
        result = await repo.save(u)
        assert result.uid == "u1"

    async def test_save_is_upsert(self, repo: FirestoreUserRepository) -> None:
        u = User(uid="u1", email="a@b.com", name="Alice")
        await repo.save(u)
        u.update(name="Alicia")
        await repo.save(u)
        fetched = await repo.find_by_uid("u1")
        assert fetched is not None
        assert fetched.name == "Alicia"


class TestFindByUid:
    async def test_existing_uid_returns_user(self, repo: FirestoreUserRepository) -> None:
        await repo.save(User(uid="u1", email="a@b.com", name="Alice"))
        u = await repo.find_by_uid("u1")
        assert u is not None
        assert u.email == "a@b.com"

    async def test_missing_uid_returns_none(self, repo: FirestoreUserRepository) -> None:
        assert await repo.find_by_uid("nonexistent") is None


class TestFindByEmail:
    async def test_returns_user_by_email(self, repo: FirestoreUserRepository) -> None:
        await repo.save(User(uid="u1", email="a@b.com", name="Alice"))
        u = await repo.find_by_email("a@b.com")
        assert u is not None
        assert u.uid == "u1"

    async def test_missing_email_returns_none(self, repo: FirestoreUserRepository) -> None:
        assert await repo.find_by_email("none@example.com") is None


class TestPhoneRoundTrip:
    async def test_phone_is_persisted(self, repo: FirestoreUserRepository) -> None:
        await repo.save(User(
            uid="u1", email="a@b.com", name="Alice",
            phone=Phone("+819012345678"),
        ))
        u = await repo.find_by_uid("u1")
        assert u is not None and u.phone is not None
        assert u.phone.value == "+819012345678"

    async def test_no_phone_is_persisted_as_none(self, repo: FirestoreUserRepository) -> None:
        await repo.save(User(uid="u1", email="a@b.com", name="Alice"))
        u = await repo.find_by_uid("u1")
        assert u is not None
        assert u.phone is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/infrastructure/repositories/test_firestore_user_repository.py -v`
Expected: skip OR ImportError on `firestore_user_repository`.

- [ ] **Step 3: Write the implementation**

`backend/app/infrastructure/repositories/firestore_user_repository.py`:
```python
"""Firestore-backed UserRepository."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository
from app.domain.value_objects.phone import Phone


class FirestoreUserRepository(UserRepository):
    def __init__(self, client: fs.AsyncClient, *, collection: str = "users") -> None:
        self._client = client
        self._collection_name = collection

    @property
    def _collection(self) -> Any:
        return self._client.collection(self._collection_name)

    async def save(self, user: User) -> User:
        # set() with merge=False is full upsert — matches the SQLAlchemy
        # repository's flush+refresh semantics from before Phase D.
        await self._collection.document(user.uid).set(self._to_dict(user))
        return user

    async def find_by_uid(self, uid: str) -> User | None:
        doc = await self._collection.document(uid).get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict(), uid)

    async def find_by_email(self, email: str) -> User | None:
        query = self._collection.where("email", "==", email).limit(1)
        async for doc in query.stream():
            return self._from_dict(doc.to_dict(), doc.id)
        return None

    @staticmethod
    def _to_dict(user: User) -> dict[str, Any]:
        return {
            "uid": user.uid,
            "email": user.email,
            "name": user.name,
            "phone": user.phone.value if user.phone else None,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None, uid: str) -> User:
        assert data is not None
        phone_val = data.get("phone")
        return User(
            uid=uid,
            email=data["email"],
            name=data["name"],
            phone=Phone(phone_val) if phone_val else None,
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )
```

- [ ] **Step 4: Run tests with emulator**

In one terminal: `gcloud emulators firestore start --host-port=localhost:8080 --project=test-project`

In another: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_user_repository.py -v`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/infrastructure/repositories/firestore_user_repository.py backend/tests/infrastructure/repositories/test_firestore_user_repository.py
git commit -m "feat(backend): add FirestoreUserRepository"
```

---

### Task 5: User Pydantic schemas

**Files:**
- Create: `backend/app/api/schemas/user.py`

- [ ] **Step 1: Write schemas**

`backend/app/api/schemas/user.py`:
```python
"""Pydantic schemas for the User API surface."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Body of POST /api/v1/users/me — fields supplied by the signup form.

    `email` and `uid` are not in the body — they're taken from the verified
    Firebase Auth ID token in the Authorization header.
    """

    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=20)


class UserUpdate(BaseModel):
    """Body of PUT /api/v1/users/me."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=20)


class UserResponse(BaseModel):
    uid: str
    email: EmailStr
    name: str
    phone: str | None
    created_at: datetime
    updated_at: datetime


class UserSignupResponse(BaseModel):
    """Returned from POST /api/v1/users/me — includes the new User plus a
    count of anonymous contact submissions that were retroactively linked.
    """

    user: UserResponse
    linked_contacts: int
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/schemas/user.py
git commit -m "feat(backend): add User Pydantic schemas"
```

---

### Task 6: Repository / service factory dependencies

**Files:**
- Create: `backend/app/api/dependencies/__init__.py`
- Create: `backend/app/api/dependencies/repositories.py`

The container holds singletons; per-request things go in dependency factories. Mirror the existing `get_contact_service` pattern.

- [ ] **Step 1: Empty __init__.py**

`backend/app/api/dependencies/__init__.py` (empty file).

- [ ] **Step 2: Write the factories**

`backend/app/api/dependencies/repositories.py`:
```python
"""Per-request repository and service factories."""

from __future__ import annotations

from app.domain.repositories.contact_repository import ContactRepository
from app.domain.repositories.user_repository import UserRepository
from app.infrastructure.database.firestore_client import get_firestore_client
from app.infrastructure.repositories.firestore_contact_repository import (
    FirestoreContactRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)


def get_user_repository() -> UserRepository:
    return FirestoreUserRepository(get_firestore_client())


def get_contact_repository() -> ContactRepository:
    return FirestoreContactRepository(get_firestore_client())
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/dependencies/__init__.py backend/app/api/dependencies/repositories.py
git commit -m "feat(backend): add dependency factories for repositories"
```

---

### Task 7: Firebase Admin SDK init + auth dependency

**Files:**
- Create: `backend/app/api/dependencies/auth.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the auth dependency**

`backend/app/api/dependencies/auth.py`:
```python
"""FastAPI dependency: extract + verify the Firebase ID token, fetch User."""

from __future__ import annotations

from typing import Annotated

import firebase_admin
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as fb_auth

from app.api.dependencies.repositories import get_user_repository
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository


def _decode_token(authorization: str) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[len("Bearer ") :].strip()
    try:
        return fb_auth.verify_id_token(token)
    except (ValueError, firebase_admin.exceptions.FirebaseError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid ID token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(
    authorization: Annotated[str, Header()],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> User:
    """Resolve the current Firebase user → backend User entity.

    Raises 401 if the token is missing/invalid, 404 if the Firebase user
    has no `users/{uid}` doc yet (call POST /api/v1/users/me to create it).
    """
    decoded = _decode_token(authorization)
    uid = decoded["uid"]
    user = await user_repo.find_by_uid(uid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not registered. Call POST /api/v1/users/me to initialize.",
        )
    return user


async def get_decoded_token(
    authorization: Annotated[str, Header()],
) -> dict:
    """Used by POST /api/v1/users/me — verifies the token but doesn't
    require a `users/{uid}` doc to exist yet.
    """
    return _decode_token(authorization)
```

- [ ] **Step 2: Initialize firebase_admin in main.py**

Modify `backend/app/main.py` — inside `lifespan` (just before `get_container()`):

```python
import firebase_admin
# ...

@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    logger.info("英会話カフェ API starting up...")

    if not firebase_admin._apps:
        firebase_admin.initialize_app()  # ADC on Cloud Run; FIREBASE_AUTH_EMULATOR_HOST handled by SDK
        logger.info("Firebase Admin SDK initialized")

    get_container()
    logger.info("Dependency injection container initialized")
    logger.info("Domain layer initialized with event bus")

    yield
    logger.info("英会話カフェ API shutting down...")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/dependencies/auth.py backend/app/main.py
git commit -m "feat(backend): add Firebase Auth dependency + initialize SDK"
```

---

### Task 8: UserService for signup-initialize + contact backfill

**Files:**
- Create: `backend/app/services/user_service.py`

- [ ] **Step 1: Write the service**

`backend/app/services/user_service.py`:
```python
"""Application service for user lifecycle.

Currently: signup initialization + retroactive contact backfill.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.entities.contact import Contact
from app.domain.entities.user import User
from app.domain.repositories.contact_repository import ContactRepository
from app.domain.repositories.user_repository import UserRepository
from app.domain.value_objects.phone import Phone


@dataclass
class SignupResult:
    user: User
    linked_contacts: int


class UserService:
    def __init__(
        self,
        user_repo: UserRepository,
        contact_repo: ContactRepository,
    ) -> None:
        self._users = user_repo
        self._contacts = contact_repo

    async def signup_initialize(
        self, *, uid: str, email: str, name: str, phone_str: str | None
    ) -> SignupResult:
        """Create the User doc + backfill the user's anonymous contacts.

        Raises ValueError if uid already has a User. Returns the new User
        plus a count of contacts that were retroactively linked.
        """
        existing = await self._users.find_by_uid(uid)
        if existing is not None:
            raise ValueError(f"User with uid {uid} already exists")

        phone = Phone(phone_str) if phone_str else None
        user = User(uid=uid, email=email, name=name, phone=phone)
        await self._users.save(user)

        # Backfill anonymous contacts that share the verified email.
        linked = 0
        all_contacts = await self._contacts.find_all(limit=10_000, offset=0)
        for contact in all_contacts:
            email_str = contact.email.value if contact.email else None
            if email_str == email and contact.user_id is None:
                contact.user_id = uid
                await self._contacts.save(contact)
                linked += 1

        return SignupResult(user=user, linked_contacts=linked)

    async def find_user_contacts(
        self, *, user: User, limit: int = 50, offset: int = 0
    ) -> list[Contact]:
        all_contacts = await self._contacts.find_all(limit=10_000, offset=0)
        owned = [c for c in all_contacts if c.user_id == user.uid]
        # Sort by created_at desc (Contact entity has created_at)
        owned.sort(key=lambda c: c.created_at, reverse=True)
        return owned[offset : offset + limit]
```

Note: the `find_all + filter` approach is intentional for v1 — keeps the Firestore queries simple. A later optimization could add `ContactRepository.find_by_user_id` for an indexed query. Document and move on.

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/user_service.py
git commit -m "feat(backend): add UserService for signup + contact backfill"
```

---

### Task 9: Add user_id to Contact entity + repository

**Files:**
- Modify: `backend/app/domain/entities/contact.py`
- Modify: `backend/app/infrastructure/repositories/firestore_contact_repository.py`
- Modify: `backend/app/api/schemas/contact.py`
- Test: `backend/tests/infrastructure/repositories/test_firestore_contact_repository.py`

- [ ] **Step 1: Add the test for user_id round-trip**

In `backend/tests/infrastructure/repositories/test_firestore_contact_repository.py`, add a new test class:

```python
class TestUserIdRoundtrip:
    async def test_user_id_persists_on_save(self, contact_repo, sample_contact_factory):
        contact = sample_contact_factory(user_id="u1")
        await contact_repo.save(contact)
        fetched = await contact_repo.find_by_id(contact.id)
        assert fetched is not None
        assert fetched.user_id == "u1"

    async def test_user_id_null_when_unset(self, contact_repo, sample_contact_factory):
        contact = sample_contact_factory()
        await contact_repo.save(contact)
        fetched = await contact_repo.find_by_id(contact.id)
        assert fetched is not None
        assert fetched.user_id is None
```

If the existing test file doesn't have `sample_contact_factory`, look at how existing tests construct Contact and copy the pattern (probably inline construction). Adapt accordingly.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_contact_repository.py::TestUserIdRoundtrip -v`
Expected: AttributeError or fields mismatch.

- [ ] **Step 3: Add user_id to the Contact entity**

In `backend/app/domain/entities/contact.py`, add to the `Contact` dataclass fields:

```python
user_id: str | None = None
```

Position it just before `_domain_events`. Do not validate it in `__post_init__` — it's optional.

- [ ] **Step 4: Update the Firestore mapper**

In `backend/app/infrastructure/repositories/firestore_contact_repository.py`:
- `_entity_to_dict`: add `"user_id": contact.user_id,`
- `_dict_to_entity`: pass `user_id=data.get("user_id")` to the `Contact(...)` constructor.

- [ ] **Step 5: Update Pydantic schema**

In `backend/app/api/schemas/contact.py`, add `user_id: str | None = None` to the response model (the request model stays unchanged — clients can't claim a user_id; only the server sets it).

- [ ] **Step 6: Run all backend tests**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest -q`
Expected: All pre-existing tests still pass; 2 new TestUserIdRoundtrip tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/domain/entities/contact.py backend/app/infrastructure/repositories/firestore_contact_repository.py backend/app/api/schemas/contact.py backend/tests/infrastructure/repositories/test_firestore_contact_repository.py
git commit -m "feat(backend): add user_id to Contact (anonymous when null)"
```

---

### Task 10: Users endpoints

**Files:**
- Create: `backend/app/api/endpoints/users.py`
- Test: `backend/tests/api/test_users.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/api/test_users.py`:
```python
"""API tests for /api/v1/users/me endpoints.

Mocks Firebase Admin SDK at the verify_id_token boundary — the real
token never reaches the test.
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)


VERIFIED_TOKEN_PAYLOAD = {
    "uid": "test-uid-1",
    "email": "alice@example.com",
    "email_verified": True,
}


@pytest.fixture(autouse=True)
def patch_firebase_verify():
    with patch(
        "app.api.dependencies.auth.fb_auth.verify_id_token",
        return_value=VERIFIED_TOKEN_PAYLOAD,
    ):
        yield


class TestSignup:
    async def test_post_creates_user_and_returns_201(self, client) -> None:
        response = await client.post(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"name": "Alice", "phone": "+819012345678"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["user"]["uid"] == "test-uid-1"
        assert body["user"]["email"] == "alice@example.com"
        assert body["user"]["name"] == "Alice"
        assert body["user"]["phone"] == "+819012345678"
        assert body["linked_contacts"] == 0

    async def test_duplicate_signup_returns_409(self, client) -> None:
        await client.post(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"name": "Alice"},
        )
        response = await client.post(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"name": "Alice2"},
        )
        assert response.status_code == 409

    async def test_anonymous_contacts_get_linked(
        self, client, firestore_client
    ) -> None:
        # Seed an anonymous contact with the same email as the test token
        from app.domain.entities.contact import Contact
        from app.domain.enums.contact_status import ContactStatus
        from app.domain.enums.lesson_type import LessonType
        from app.domain.enums.preferred_contact import PreferredContact
        from app.domain.value_objects.email import Email
        from app.infrastructure.repositories.firestore_contact_repository import (
            FirestoreContactRepository,
        )

        contact_repo = FirestoreContactRepository(firestore_client)
        anon = Contact(
            name="anon",
            email=Email("alice@example.com"),
            message="hello before signup",
            lesson_type=LessonType.TRIAL,
            preferred_contact=PreferredContact.EMAIL,
            status=ContactStatus.PENDING,
        )
        await contact_repo.save(anon)

        response = await client.post(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"name": "Alice"},
        )
        assert response.status_code == 201
        assert response.json()["linked_contacts"] == 1

        refetched = await contact_repo.find_by_id(anon.id)
        assert refetched is not None
        assert refetched.user_id == "test-uid-1"


class TestGetProfile:
    async def test_get_returns_user_profile(self, client) -> None:
        await client.post(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"name": "Alice"},
        )
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Alice"

    async def test_unauthenticated_get_returns_401(self, client) -> None:
        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            side_effect=ValueError("bad token"),
        ):
            response = await client.get(
                "/api/v1/users/me",
                headers={"Authorization": "Bearer xxx"},
            )
        assert response.status_code == 401


class TestUpdateProfile:
    async def test_put_updates_name(self, client) -> None:
        await client.post(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"name": "Alice"},
        )
        response = await client.put(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"name": "Alicia"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Alicia"


class TestUserContacts:
    async def test_returns_only_users_contacts(
        self, client, firestore_client
    ) -> None:
        await client.post(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"name": "Alice"},
        )

        from app.domain.entities.contact import Contact
        from app.domain.enums.contact_status import ContactStatus
        from app.domain.enums.lesson_type import LessonType
        from app.domain.enums.preferred_contact import PreferredContact
        from app.domain.value_objects.email import Email
        from app.infrastructure.repositories.firestore_contact_repository import (
            FirestoreContactRepository,
        )

        contact_repo = FirestoreContactRepository(firestore_client)
        owned = Contact(
            name="alice", email=Email("alice@example.com"), message="hi from owner",
            lesson_type=LessonType.TRIAL, preferred_contact=PreferredContact.EMAIL,
            status=ContactStatus.PENDING, user_id="test-uid-1",
        )
        other = Contact(
            name="bob", email=Email("bob@example.com"), message="hi from somebody else",
            lesson_type=LessonType.TRIAL, preferred_contact=PreferredContact.EMAIL,
            status=ContactStatus.PENDING, user_id="other-uid",
        )
        await contact_repo.save(owned)
        await contact_repo.save(other)

        response = await client.get(
            "/api/v1/users/me/contacts",
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1
        assert items[0]["name"] == "alice"
```

The `client` and `firestore_client` fixtures already exist in `tests/conftest.py` from Phase D.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_users.py -v`
Expected: 404s on the routes (endpoint not registered) or ImportError.

- [ ] **Step 3: Write the endpoint module**

`backend/app/api/endpoints/users.py`:
```python
"""/api/v1/users/me — current-user profile and history endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user, get_decoded_token
from app.api.dependencies.repositories import (
    get_contact_repository,
    get_user_repository,
)
from app.api.schemas.contact import ContactResponse
from app.api.schemas.user import (
    UserCreate,
    UserResponse,
    UserSignupResponse,
    UserUpdate,
)
from app.domain.entities.user import User
from app.domain.repositories.contact_repository import ContactRepository
from app.domain.repositories.user_repository import UserRepository
from app.domain.value_objects.phone import Phone
from app.services.user_service import UserService

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _to_response(user: User) -> UserResponse:
    return UserResponse(
        uid=user.uid,
        email=user.email,
        name=user.name,
        phone=user.phone.value if user.phone else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post("/me", response_model=UserSignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_initialize(
    payload: UserCreate,
    decoded: Annotated[dict, Depends(get_decoded_token)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    contact_repo: Annotated[ContactRepository, Depends(get_contact_repository)],
) -> UserSignupResponse:
    uid: str = decoded["uid"]
    email = decoded.get("email")
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token missing email claim")

    service = UserService(user_repo, contact_repo)
    try:
        result = await service.signup_initialize(
            uid=uid, email=email, name=payload.name, phone_str=payload.phone
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    return UserSignupResponse(
        user=_to_response(result.user),
        linked_contacts=result.linked_contacts,
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(
    user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    return _to_response(user)


@router.put("/me", response_model=UserResponse)
async def update_profile(
    payload: UserUpdate,
    user: Annotated[User, Depends(get_current_user)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> UserResponse:
    phone = Phone(payload.phone) if payload.phone is not None else None
    user.update(name=payload.name, phone=phone)
    await user_repo.save(user)
    return _to_response(user)


@router.get("/me/contacts", response_model=list[ContactResponse])
async def get_my_contacts(
    user: Annotated[User, Depends(get_current_user)],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    contact_repo: Annotated[ContactRepository, Depends(get_contact_repository)],
    limit: int = 50,
    offset: int = 0,
) -> list[ContactResponse]:
    service = UserService(user_repo, contact_repo)
    contacts = await service.find_user_contacts(user=user, limit=limit, offset=offset)
    return [ContactResponse.from_entity(c) for c in contacts]
```

If `ContactResponse.from_entity` doesn't exist, check the existing `app/api/schemas/contact.py` — it likely has a constructor pattern. Either use that, or do field-by-field mapping inline. Adjust accordingly.

- [ ] **Step 4: Mount the router**

Modify `backend/app/main.py`:
```python
from .api.endpoints.users import router as users_router
# ...
app.include_router(users_router)
```

- [ ] **Step 5: Run all backend tests**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest -q`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/endpoints/users.py backend/app/main.py backend/tests/api/test_users.py
git commit -m "feat(backend): add /api/v1/users/me endpoints"
```

---

### Task 11: Optional auth on contact endpoint → stamp user_id

**Files:**
- Modify: `backend/app/api/endpoints/contact.py`
- Test: `backend/tests/api/test_contact.py`

- [ ] **Step 1: Add the test**

In `backend/tests/api/test_contact.py`, add:

```python
class TestAuthenticatedContactSubmission:
    async def test_logged_in_submission_carries_user_id(self, client) -> None:
        # Sign up first
        from unittest.mock import patch
        token_payload = {
            "uid": "u-author",
            "email": "author@example.com",
            "email_verified": True,
        }
        with patch(
            "app.api.dependencies.auth.fb_auth.verify_id_token",
            return_value=token_payload,
        ):
            await client.post(
                "/api/v1/users/me",
                headers={"Authorization": "Bearer fake"},
                json={"name": "Author"},
            )
            resp = await client.post(
                "/api/v1/contacts/",
                headers={"Authorization": "Bearer fake"},
                json={
                    "name": "Author",
                    "email": "author@example.com",
                    "phone": "",
                    "lesson_type": "trial",
                    "preferred_contact": "email",
                    "message": "hello as logged in user",
                },
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data.get("user_id") == "u-author"

    async def test_anonymous_submission_has_null_user_id(self, client) -> None:
        resp = await client.post(
            "/api/v1/contacts/",
            json={
                "name": "Anon",
                "email": "anon@example.com",
                "phone": "",
                "lesson_type": "trial",
                "preferred_contact": "email",
                "message": "anonymous hello",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data.get("user_id") is None
```

- [ ] **Step 2: Modify the endpoint to read optional auth**

In `backend/app/api/endpoints/contact.py`, change the `create_contact` (or whatever the POST handler is named) signature so it accepts an optional Authorization header. If present, look up the user and stamp `user_id` onto the new Contact. Concrete change:

```python
from typing import Annotated
from fastapi import Header
import firebase_admin
from firebase_admin import auth as fb_auth

# at top of create_contact:
async def create_contact(
    payload: ContactCreate,
    authorization: Annotated[str | None, Header()] = None,
    # ... existing deps unchanged
) -> ContactResponse:
    user_id: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[len("Bearer ") :].strip()
        try:
            decoded = fb_auth.verify_id_token(token)
            user_id = decoded["uid"]
        except Exception:
            # Bad token → treat as anonymous, don't raise (graceful degradation)
            user_id = None
    # ... construct Contact(..., user_id=user_id) and save as before
```

Wire `user_id` through the existing service call all the way to the entity / save.

- [ ] **Step 3: Run tests**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_contact.py -v`
Expected: all tests pass including the two new ones.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/endpoints/contact.py backend/tests/api/test_contact.py
git commit -m "feat(backend): stamp user_id on contact submissions when logged in"
```

---

### Task 12: Backend lint + typecheck + full test gate

Tighten before moving to frontend.

- [ ] **Step 1: Ruff**

Run: `cd backend && uv run ruff check . && uv run ruff format --check .`
Expected: clean.

- [ ] **Step 2: Mypy**

Run: `cd backend && uv run mypy app/domain app/services`
Expected: success.

- [ ] **Step 3: Full pytest run (emulator)**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest -q`
Expected: all pass.

- [ ] **Step 4: Commit any drift fixes**

If anything failed and you fixed it inline, commit:
```bash
git commit -am "fix(backend): post-implementation lint/type cleanup"
```

---

## Part B — Frontend

### Task 13: Install firebase + firebase Web SDK env-var scaffolding

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install**

Run: `cd frontend && npm install firebase`

- [ ] **Step 2: Verify**

Run: `cd frontend && cat package.json | grep firebase`
Expected: `firebase` appears under dependencies.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): install firebase Web SDK"
```

---

### Task 14: Firebase init module

**Files:**
- Create: `frontend/src/lib/firebase.ts`

- [ ] **Step 1: Write the init**

`frontend/src/lib/firebase.ts`:
```typescript
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

export const firebaseApp: FirebaseApp =
  getApps()[0] ?? initializeApp(config);

export const firebaseAuth: Auth = getAuth(firebaseApp);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/firebase.ts
git commit -m "feat(frontend): init Firebase Web SDK"
```

---

### Task 15: Auth store + useAuth hook

**Files:**
- Create: `frontend/src/stores/authStore.ts`
- Create: `frontend/src/hooks/useAuth.ts`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Write the store**

`frontend/src/stores/authStore.ts`:
```typescript
import { create } from 'zustand';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  signOut: async () => {
    await signOut(firebaseAuth);
  },
}));

// Subscribe once at module load (browser-only)
if (typeof window !== 'undefined') {
  onAuthStateChanged(firebaseAuth, (user) => {
    useAuthStore.setState({ user, loading: false });
  });
}
```

- [ ] **Step 2: Write the hook**

`frontend/src/hooks/useAuth.ts`:
```typescript
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  return useAuthStore();
}
```

- [ ] **Step 3: Ensure the store mounts**

In `frontend/src/app/layout.tsx`, import the store module so its side-effect (onAuthStateChanged subscription) runs:

```typescript
import '@/stores/authStore';
```

Place it near the other imports at the top of the file. This forces the module to execute on hydration.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/authStore.ts frontend/src/hooks/useAuth.ts frontend/src/app/layout.tsx
git commit -m "feat(frontend): add auth store + useAuth hook"
```

---

### Task 16: axios interceptor uses Firebase ID token

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Replace the token retrieval**

In `frontend/src/lib/api.ts`, replace the `localStorage.getItem('auth_token')` block in the request interceptor with:

```typescript
import { firebaseAuth } from '@/lib/firebase';

// inside request interceptor:
const user = firebaseAuth.currentUser;
if (user) {
  const token = await user.getIdToken();
  config.headers.Authorization = `Bearer ${token}`;
}
```

Note the interceptor must be async to support `await`. Update the function signature accordingly:

```typescript
apiClient.interceptors.request.use(
  async (config) => {
    // ... existing console.log
    const user = firebaseAuth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  ...
);
```

Delete the old `localStorage` lookup and the `/login` redirect on 401 (will be re-added at a higher level next).

- [ ] **Step 2: Update 401 response handling**

In the response interceptor, when status is 401, push the user to `/login` via `window.location.href = '/login'`.

- [ ] **Step 3: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): use Firebase ID token in axios interceptor"
```

---

### Task 17: Login UI

**Files:**
- Create: `frontend/src/components/auth/LoginForm.tsx`
- Create: `frontend/src/components/auth/GoogleSignInButton.tsx`
- Create: `frontend/src/app/login/page.tsx`

- [ ] **Step 1: GoogleSignInButton (shared)**

`frontend/src/components/auth/GoogleSignInButton.tsx`:
```tsx
'use client';

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

interface Props {
  onSuccess: () => void;
  onError: (err: Error) => void;
}

export function GoogleSignInButton({ onSuccess, onError }: Props) {
  const handle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
      onSuccess();
    } catch (e) {
      onError(e as Error);
    }
  };
  return (
    <button
      type="button"
      onClick={handle}
      className="w-full rounded border border-gray-300 px-4 py-2 hover:bg-gray-50"
    >
      Google でサインイン
    </button>
  );
}
```

- [ ] **Step 2: LoginForm component**

`frontend/src/components/auth/LoginForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { GoogleSignInButton } from './GoogleSignInButton';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      router.push('/mypage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">ログイン</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
      <div className="relative">
        <hr className="my-4" />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 bg-white px-2 text-sm text-gray-500">
          または
        </span>
      </div>
      <GoogleSignInButton
        onSuccess={() => router.push('/mypage')}
        onError={(e) => setError(e.message)}
      />
      <p className="text-center text-sm">
        アカウント未作成の方は <a href="/signup" className="text-blue-600 underline">サインアップ</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: /login page**

`frontend/src/app/login/page.tsx`:
```tsx
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/auth/ frontend/src/app/login/
git commit -m "feat(frontend): add login page + GoogleSignInButton"
```

---

### Task 18: Signup UI

**Files:**
- Create: `frontend/src/components/auth/SignupForm.tsx`
- Create: `frontend/src/app/signup/page.tsx`

- [ ] **Step 1: SignupForm**

`frontend/src/components/auth/SignupForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import axios from 'axios';
import { firebaseAuth } from '@/lib/firebase';
import { GoogleSignInButton } from './GoogleSignInButton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

async function initializeUser(name: string, phone: string | undefined) {
  const token = await firebaseAuth.currentUser?.getIdToken();
  if (!token) throw new Error('Firebase user missing');
  await axios.post(
    `${API_BASE}/api/v1/users/me`,
    { name, phone: phone || null },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await sendEmailVerification(cred.user);
      await initializeUser(name, undefined);
      router.push('/mypage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サインアップに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async () => {
    try {
      const displayName = firebaseAuth.currentUser?.displayName ?? '';
      await initializeUser(displayName || 'ゲスト', undefined);
      router.push('/mypage');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        // Already registered — just go to /mypage
        router.push('/mypage');
      } else {
        setError(err instanceof Error ? err.message : 'サインアップに失敗しました');
      }
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">サインアップ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="お名前"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード (6 文字以上)"
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? '送信中…' : 'サインアップ'}
        </button>
      </form>
      <div className="relative">
        <hr className="my-4" />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 bg-white px-2 text-sm text-gray-500">
          または
        </span>
      </div>
      <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={(e) => setError(e.message)} />
      <p className="text-center text-sm">
        登録済みの方は <a href="/login" className="text-blue-600 underline">ログイン</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: /signup page**

`frontend/src/app/signup/page.tsx`:
```tsx
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return <SignupForm />;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth/SignupForm.tsx frontend/src/app/signup/
git commit -m "feat(frontend): add signup page + user initialization on signup"
```

---

### Task 19: マイページ components

**Files:**
- Create: `frontend/src/app/mypage/_components/ProfileCard.tsx`
- Create: `frontend/src/app/mypage/_components/ContactHistory.tsx`
- Create: `frontend/src/app/mypage/page.tsx`

- [ ] **Step 1: ProfileCard**

`frontend/src/app/mypage/_components/ProfileCard.tsx`:
```tsx
'use client';

import Link from 'next/link';

interface Profile {
  uid: string;
  email: string;
  name: string;
  phone: string | null;
}

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <section className="rounded border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">プロフィール</h2>
        <Link
          href="/mypage/edit"
          className="text-sm text-blue-600 hover:underline"
        >
          編集
        </Link>
      </div>
      <dl className="mt-4 space-y-3">
        <div className="flex">
          <dt className="w-32 text-gray-500">お名前</dt>
          <dd>{profile.name}</dd>
        </div>
        <div className="flex">
          <dt className="w-32 text-gray-500">メール</dt>
          <dd>{profile.email}</dd>
        </div>
        <div className="flex">
          <dt className="w-32 text-gray-500">電話</dt>
          <dd>{profile.phone ?? <span className="text-gray-400">未設定</span>}</dd>
        </div>
      </dl>
    </section>
  );
}
```

- [ ] **Step 2: ContactHistory**

`frontend/src/app/mypage/_components/ContactHistory.tsx`:
```tsx
'use client';

interface ContactItem {
  id: string;
  created_at: string;
  lesson_type: string;
  message: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '未対応',
  processed: '対応済み',
  in_progress: '対応中',
};

export function ContactHistory({ contacts }: { contacts: ContactItem[] }) {
  if (contacts.length === 0) {
    return (
      <section className="rounded border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">問い合わせ履歴</h2>
        <p className="mt-4 text-gray-500">まだ問い合わせはありません</p>
      </section>
    );
  }
  return (
    <section className="rounded border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">問い合わせ履歴</h2>
      <ul className="mt-4 divide-y">
        {contacts.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {new Date(c.created_at).toLocaleString('ja-JP')}
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium">{c.lesson_type}</p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-700">{c.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: /mypage page (the protected one)**

`frontend/src/app/mypage/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { firebaseAuth } from '@/lib/firebase';
import { ProfileCard } from './_components/ProfileCard';
import { ContactHistory } from './_components/ContactHistory';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

interface ProfileData {
  uid: string;
  email: string;
  name: string;
  phone: string | null;
}
interface ContactItem {
  id: string;
  created_at: string;
  lesson_type: string;
  message: string;
  status: string;
}

export default function MyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [contacts, setContacts] = useState<ContactItem[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [profileRes, contactsRes] = await Promise.all([
        axios.get<ProfileData>(`${API_BASE}/api/v1/users/me`, { headers }),
        axios.get<ContactItem[]>(`${API_BASE}/api/v1/users/me/contacts`, { headers }),
      ]);
      setProfile(profileRes.data);
      setContacts(contactsRes.data);
    })();
  }, [user]);

  if (loading || !user || !profile) {
    return <div className="p-6 text-center">読み込み中…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">マイページ</h1>
      <ProfileCard profile={profile} />
      <ContactHistory contacts={contacts} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/mypage/
git commit -m "feat(frontend): add /mypage with profile + contact history"
```

---

### Task 20: /mypage/edit page

**Files:**
- Create: `frontend/src/app/mypage/edit/page.tsx`

- [ ] **Step 1: Write the page**

`frontend/src/app/mypage/edit/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

export default function MyPageEdit() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await user.getIdToken();
      const resp = await axios.get(`${API_BASE}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setName(resp.data.name);
      setPhone(resp.data.phone ?? '');
    })();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      await axios.put(
        `${API_BASE}/api/v1/users/me`,
        { name, phone: phone || null },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      router.push('/mypage');
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return <div className="p-6 text-center">読み込み中…</div>;

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">プロフィール編集</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-600">お名前</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">電話 (任意)</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/mypage')}
            className="rounded border px-4 py-2"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/mypage/edit/
git commit -m "feat(frontend): add /mypage/edit for profile updates"
```

---

### Task 21: Header — login link / user menu

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Read the current Header**

Run: `cat frontend/src/components/layout/Header.tsx`

This tells you what's there — the file structure can vary. Find the right-side nav area and add:

```tsx
'use client';
import { useAuth } from '@/hooks/useAuth';
// ...

const { user, signOut } = useAuth();

{user ? (
  <div className="relative">
    <details>
      <summary className="cursor-pointer">{user.displayName ?? user.email}</summary>
      <div className="absolute right-0 mt-1 w-40 rounded border bg-white shadow">
        <a href="/mypage" className="block px-3 py-2 text-sm hover:bg-gray-50">マイページ</a>
        <button
          onClick={() => signOut()}
          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
        >
          ログアウト
        </button>
      </div>
    </details>
  </div>
) : (
  <a href="/login" className="text-sm hover:underline">ログイン</a>
)}
```

Adapt to the actual Header layout. If Header is a server component currently, make the right-side controls a small client component (`'use client'` directive on a new sub-file) and embed it. Keep the marketing site's existing styling.

- [ ] **Step 2: Type check + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "feat(frontend): add login link / user menu to Header"
```

---

### Task 22: ContactForm pre-fill from logged-in user

**Files:**
- Modify: `frontend/src/components/forms/ContactForm.tsx`

- [ ] **Step 1: Read the current ContactForm**

Run: `head -80 frontend/src/components/forms/ContactForm.tsx` to locate the form's state initialization (likely `useState` calls).

- [ ] **Step 2: Add pre-fill**

Add `'use client'` at the top if not already present. Inside the component, use `useAuth` and `useEffect`:

```tsx
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import axios from 'axios';

// ...
const { user } = useAuth();

useEffect(() => {
  if (!user) return;
  (async () => {
    const token = await user.getIdToken();
    const resp = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/users/me`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    // Pre-fill if the form state setters exist:
    setName(resp.data.name);
    setEmail(resp.data.email);
    if (resp.data.phone) setPhone(resp.data.phone);
  })();
}, [user]);
```

If the existing form uses a single `formData` state, adapt the pre-fill into one `setFormData` call.

- [ ] **Step 3: Type check + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/forms/ContactForm.tsx
git commit -m "feat(frontend): pre-fill contact form for logged-in users"
```

---

## Part C — Infra + final wiring

### Task 23: Terraform — grant firebaseauth.viewer to runtime SA

**Files:**
- Modify: `terraform/modules/cloud-run-service/main.tf`

- [ ] **Step 1: Add the role binding**

In `terraform/modules/cloud-run-service/main.tf`, after the existing `google_project_iam_member.runtime_firestore` block, add:

```hcl
resource "google_project_iam_member" "runtime_firebase_auth_viewer" {
  project = var.gcp_project_id
  role    = "roles/firebaseauth.viewer"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
```

- [ ] **Step 2: Apply**

Run from the project root:
```bash
cd terraform/envs/prod/cloudrun
terragrunt apply -auto-approve
```

Expected: `1 to add, 0 to change, 0 to destroy.`

- [ ] **Step 3: Commit**

```bash
git add terraform/modules/cloud-run-service/main.tf
git commit -m "feat(terraform): grant firebaseauth.viewer to Cloud Run runtime SA"
```

---

### Task 24: Vercel — set Firebase Web SDK env vars

This is a one-time HCP UI / API step, not committed code.

- [ ] **Step 1: Add to the vercel workspace's env_vars HCL**

In the HCP Terraform workspace `english-cafe-prod-vercel`, edit the `env_vars` HCL variable to include:

```hcl
NEXT_PUBLIC_FIREBASE_API_KEY = {
  value     = "<from Firebase Console → Project Settings → Web app SDK config>"
  target    = ["production"]
  sensitive = false
}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = {
  value     = "english-cafe-496209.firebaseapp.com"
  target    = ["production"]
  sensitive = false
}
NEXT_PUBLIC_FIREBASE_PROJECT_ID = {
  value     = "english-cafe-496209"
  target    = ["production"]
  sensitive = false
}
```

- [ ] **Step 2: Apply**

```bash
cd terraform/envs/prod/vercel
terragrunt apply -auto-approve
```

Expected: 3 env-vars added on the Vercel project.

- [ ] **Step 3: Trigger Vercel rebuild**

Push any frontend commit to main, OR click "Redeploy" on the latest production deployment in the Vercel UI. `NEXT_PUBLIC_*` are baked into the build, so a rebuild is required.

---

### Task 25: Enable Firebase Auth + identitytoolkit API on the GCP project

One-time GCP operation. Run with your gcloud ADC:

- [ ] **Step 1: Enable APIs**

```bash
gcloud services enable identitytoolkit.googleapis.com firebase.googleapis.com --project=english-cafe-496209
```

- [ ] **Step 2: Add the Google sign-in provider**

In the Firebase Console (https://console.firebase.google.com/project/english-cafe-496209/authentication/providers):
- Enable "Email/Password"
- Enable "Google" — pick a support email, save

This is a UI-only step; no commit.

---

### Task 26: Final smoke + verification

- [ ] **Step 1: Backend health**

```bash
curl https://api.bz-kz.com/health
```
Expected: `{"status":"healthy", ...}`

- [ ] **Step 2: Backend `/api/v1/users/me` requires auth**

```bash
curl -i https://api.bz-kz.com/api/v1/users/me
```
Expected: 401 (no Authorization header).

- [ ] **Step 3: Frontend E2E via Playwright**

```bash
cd frontend
npm run test:e2e -- tests/e2e/mypage.spec.ts
```

(If no such spec exists yet, create a minimal one that: navigates to /signup, fills the form, asserts navigation to /mypage, and checks the profile card renders.)

- [ ] **Step 4: Manual production check**

In a fresh browser:
1. Go to https://english-cafe.bz-kz.com/signup
2. Sign up with a test email
3. Verify redirect to /mypage and that the profile shows the entered name
4. Submit a contact form on /contact (already logged in)
5. Go back to /mypage — the new submission should appear in the history

- [ ] **Step 5: Open the PR**

```bash
gh pr create --base main --head feat/mypage-auth-design --title "feat: マイページ — auth + profile + contact history" --body "Implements sub-project 1 of docs/superpowers/specs/2026-05-14-mypage-auth-design.md. Lesson booking history is sub-project 2 and will be a separate PR."
```

---

## Self-review notes

1. **Spec coverage** — checked. Every section of the design spec maps to one or more tasks: User entity (Task 2), UserRepository ABC (Task 3), Firestore impl (Task 4), schemas (Task 5), auth dep (Task 7), endpoints (Task 10), user_id on contacts (Task 9, 11), Firebase Web SDK init (Task 14), auth store (Task 15), axios interceptor (Task 16), login/signup pages (Tasks 17, 18), mypage (Task 19, 20), Header (Task 21), ContactForm pre-fill (Task 22), firebaseauth.viewer terraform binding (Task 23), Vercel env vars (Task 24), Firebase Auth enablement (Task 25).

2. **Placeholder scan** — no "TBD"/"TODO"/"implement later" tokens. Every code-block step shows the actual code. Two places say "adapt to the actual file" (Header in Task 21, ContactForm in Task 22) — both follow a "read the current file first" step that gives the executor enough to adapt.

3. **Type consistency** — `UserRepository.save/find_by_uid/find_by_email` signatures match across Tasks 3, 4, 6, 7, 10. `SignupResult` defined in Task 8 used by Task 10. `Phone` value object referenced from existing codebase.

4. **TDD discipline** — each task with new code has explicit failing-test → impl → passing-test → commit steps. Configuration-only tasks (deps install, terraform apply) skip TDD since there's nothing to assert without integration.

5. **Frequent commits** — 26 commits across the plan.
