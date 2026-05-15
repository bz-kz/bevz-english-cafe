"""Emulator tests for ProcessedEventRepository.claim (create-if-absent)."""

from __future__ import annotations

import os

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.infrastructure.repositories.firestore_processed_event_repository import (
    FirestoreProcessedEventRepository,
)


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for d in client.collection("processed_stripe_events").stream():
        await d.reference.delete()
    return FirestoreProcessedEventRepository(client)


async def test_claim_first_time_true(repo):
    assert await repo.claim("evt_1", "invoice.paid") is True


async def test_claim_second_time_false(repo):
    await repo.claim("evt_2", "invoice.paid")
    assert await repo.claim("evt_2", "invoice.paid") is False


async def test_claim_distinct_ids_both_true(repo):
    assert await repo.claim("evt_a", "x") is True
    assert await repo.claim("evt_b", "x") is True
