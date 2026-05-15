"""Integration tests for FirestoreUserRepository — emulator-gated."""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.domain.entities.user import User
from app.domain.value_objects.phone import Phone
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
        # Phone VO normalises +81 国際表記 to the 0-prefixed domestic form
        # (see Phone._normalize_phone). The round-trip must preserve the
        # normalised value, not the raw input.
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
        assert u.phone.value == "09012345678"

    async def test_no_phone_is_persisted_as_none(self, repo) -> None:
        await repo.save(User(uid="u1", email="a@b.com", name="Alice"))
        u = await repo.find_by_uid("u1")
        assert u is not None
        assert u.phone is None


class TestSearch:
    async def test_search_email_prefix(self, repo) -> None:
        await repo.save(_user("u1", "taro@example.com", "山田太郎"))
        await repo.save(_user("u2", "hanako@example.com", "佐藤花子"))
        result = await repo.search("taro")
        assert len(result) == 1
        assert result[0].uid == "u1"

    async def test_search_name_prefix(self, repo) -> None:
        await repo.save(_user("u1", "taro@example.com", "山田太郎"))
        await repo.save(_user("u2", "hanako@example.com", "佐藤花子"))
        result = await repo.search("佐藤")
        assert len(result) == 1
        assert result[0].uid == "u2"

    async def test_search_empty_query_returns_empty(self, repo) -> None:
        await repo.save(_user("u1", "taro@example.com", "山田太郎"))
        assert await repo.search("") == []


class TestListAll:
    async def test_list_all_returns_users(self, repo) -> None:
        await repo.save(_user("u1", "taro@example.com", "山田太郎"))
        await repo.save(_user("u2", "hanako@example.com", "佐藤花子"))
        result = await repo.list_all(limit=10)
        assert {u.uid for u in result} == {"u1", "u2"}

    async def test_list_all_respects_limit(self, repo) -> None:
        for i in range(5):
            await repo.save(_user(f"u{i}", f"u{i}@example.com", f"name{i}"))
        result = await repo.list_all(limit=2)
        assert len(result) == 2


async def test_subscription_fields_roundtrip(repo):
    from datetime import UTC, datetime

    from app.domain.entities.user import User

    now = datetime(2026, 6, 1, tzinfo=UTC)
    u = User(uid="sub1", email="s@example.com", name="Sub")
    u.update_subscription(
        customer_id="cus_X",
        subscription_id="sub_X",
        status="active",
        cancel_at_period_end=True,
        current_period_end=now,
    )
    await repo.save(u)
    got = await repo.find_by_uid("sub1")
    assert got is not None
    assert got.stripe_customer_id == "cus_X"
    assert got.stripe_subscription_id == "sub_X"
    assert got.subscription_status == "active"
    assert got.subscription_cancel_at_period_end is True
    assert got.current_period_end == now


async def test_subscription_fields_default_none(repo):
    from app.domain.entities.user import User

    u = User(uid="sub2", email="s2@example.com", name="Sub2")
    await repo.save(u)
    got = await repo.find_by_uid("sub2")
    assert got is not None
    assert got.stripe_customer_id is None
    assert got.subscription_status is None
    assert got.subscription_cancel_at_period_end is False
    assert got.current_period_end is None
