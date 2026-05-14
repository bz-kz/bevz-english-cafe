"""pytest fixtures wired to the Firestore emulator.

Tests that need a running app are gated on FIRESTORE_EMULATOR_HOST being set.
If it isn't, the relevant fixtures call pytest.skip so non-emulator tests
(domain / services unit tests) keep running.
"""
import asyncio
import os
from collections.abc import AsyncGenerator

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.api.endpoints.contact import get_contact_service
from app.infrastructure.di.container import get_container
from app.infrastructure.repositories.firestore_contact_repository import (
    FirestoreContactRepository,
)
from app.main import app as main_app
from app.services.contact_service import ContactService


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def firestore_client():
    """Provide an AsyncClient backed by the local Firestore emulator.

    Skips when FIRESTORE_EMULATOR_HOST is unset so the suite stays green in
    environments without the emulator running (e.g. plain CI without GCP).
    """
    if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
        pytest.skip("Firestore emulator not configured (FIRESTORE_EMULATOR_HOST unset)")

    from google.cloud import firestore  # type: ignore[import-untyped]

    client = firestore.AsyncClient(project="test-project")
    # Clean the collection between tests so cases stay isolated.
    coll = client.collection("contacts")
    async for doc in coll.stream():
        await doc.reference.delete()
    yield client


@pytest.fixture
async def app(firestore_client) -> AsyncGenerator[FastAPI, None]:
    """FastAPI app with the contact_service dependency overridden to use the emulator."""

    async def _override_get_contact_service() -> ContactService:
        repo = FirestoreContactRepository(firestore_client)
        email = get_container().email_service()
        return ContactService(repo, email)

    main_app.dependency_overrides[get_contact_service] = _override_get_contact_service
    try:
        yield main_app
    finally:
        main_app.dependency_overrides.pop(get_contact_service, None)


@pytest.fixture
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """HTTPX async client bound to the test app."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_contact_data() -> dict[str, str]:
    """Sample contact form data for testing."""
    return {
        "name": "田中太郎",
        "email": "tanaka@example.com",
        "message": "お問い合わせのテストです",
        "phone": "090-1234-5678",
        "lessonType": "trial",
        "preferredContact": "email",
    }
