"""Integration tests for FirestoreUserRepository — emulator-gated."""

from __future__ import annotations

import os

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
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("users").stream():
        await doc.reference.delete()
    return FirestoreUserRepository(client)


class TestSave:
    async def test_save_new_user_returns_it(self, repo) -> None:
        u = User(uid="u1", email="a@b.com", name="Alice")
        result = await repo.save(u)
        assert result.uid == "u1"

    async def test_save_is_upsert(self, repo) -> None:
        u = User(uid="u1", email="a@b.com", name="Alice")
        await repo.save(u)
        u.update(name="Alicia")
        await repo.save(u)
        fetched = await repo.find_by_uid("u1")
        assert fetched is not None
        assert fetched.name == "Alicia"


class TestFindByUid:
    async def test_existing_uid_returns_user(self, repo) -> None:
        await repo.save(User(uid="u1", email="a@b.com", name="Alice"))
        u = await repo.find_by_uid("u1")
        assert u is not None
        assert u.email == "a@b.com"

    async def test_missing_uid_returns_none(self, repo) -> None:
        assert await repo.find_by_uid("nonexistent") is None


class TestFindByEmail:
    async def test_returns_user_by_email(self, repo) -> None:
        await repo.save(User(uid="u1", email="a@b.com", name="Alice"))
        u = await repo.find_by_email("a@b.com")
        assert u is not None
        assert u.uid == "u1"

    async def test_missing_email_returns_none(self, repo) -> None:
        assert await repo.find_by_email("none@example.com") is None


class TestPhoneRoundTrip:
    async def test_phone_is_persisted(self, repo) -> None:
        await repo.save(
            User(
                uid="u1",
                email="a@b.com",
                name="Alice",
                phone=Phone("+819012345678"),
            )
        )
        u = await repo.find_by_uid("u1")
        assert u is not None and u.phone is not None
        assert u.phone.value == "+819012345678"

    async def test_no_phone_is_persisted_as_none(self, repo) -> None:
        await repo.save(User(uid="u1", email="a@b.com", name="Alice"))
        u = await repo.find_by_uid("u1")
        assert u is not None
        assert u.phone is None
