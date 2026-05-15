"""Integration tests for FirestoreBookingRepository — emulator-gated."""

from __future__ import annotations

import os
from datetime import UTC, datetime
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
    return datetime.now(UTC)


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for doc in client.collection("bookings").stream():
        await doc.reference.delete()
    return FirestoreBookingRepository(client)


def _make_booking(
    *,
    user_id: str = "u-1",
    slot_id: str = "slot-1",
    status: BookingStatus = BookingStatus.CONFIRMED,
) -> Booking:
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
