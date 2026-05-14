"""Tests for /api/v1/lesson-slots public listing endpoint."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("Firestore emulator not configured", allow_module_level=True)

from fastapi import FastAPI  # noqa: E402
from google.cloud import firestore as fs  # noqa: E402

from app.api.dependencies.repositories import (  # noqa: E402
    get_lesson_slot_repository,
)
from app.domain.entities.lesson_slot import LessonSlot  # noqa: E402
from app.domain.enums.contact import LessonType  # noqa: E402
from app.domain.enums.lesson_booking import SlotStatus  # noqa: E402
from app.domain.repositories.lesson_slot_repository import (  # noqa: E402
    LessonSlotRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (  # noqa: E402
    FirestoreLessonSlotRepository,
)


@pytest.fixture
async def slot_factory(
    app: FastAPI,
) -> AsyncIterator[Callable[..., Awaitable[LessonSlot]]]:
    """Persist LessonSlot via the emulator and bind the repo to the test app.

    エンドポイントが Depends(get_lesson_slot_repository) で同一プロジェクト
    の Firestore クライアントを使うように override する。
    """
    client = fs.AsyncClient(project="test-project")
    repo = FirestoreLessonSlotRepository(client)
    async for doc in client.collection("lesson_slots").stream():
        await doc.reference.delete()

    def _override() -> LessonSlotRepository:
        return repo

    app.dependency_overrides[get_lesson_slot_repository] = _override

    async def _make(
        *,
        start_at: datetime,
        end_at: datetime | None = None,
        lesson_type: LessonType = LessonType.PRIVATE,
        capacity: int = 1,
        booked_count: int = 0,
        status: SlotStatus = SlotStatus.OPEN,
    ) -> LessonSlot:
        slot = LessonSlot(
            id=uuid4(),
            start_at=start_at,
            end_at=end_at if end_at is not None else start_at + timedelta(minutes=30),
            lesson_type=lesson_type,
            capacity=capacity,
            booked_count=booked_count,
            price_yen=None,
            teacher_id=None,
            notes=None,
            status=status,
        )
        await repo.save(slot)
        return slot

    try:
        yield _make
    finally:
        app.dependency_overrides.pop(get_lesson_slot_repository, None)


async def test_list_with_from_to_includes_closed(client, slot_factory) -> None:
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
