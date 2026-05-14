"""Integration tests for FirestoreContactRepository.

Requires the Firestore emulator to be reachable via FIRESTORE_EMULATOR_HOST.
When the emulator is not configured, the whole module is skipped so CI stays
green without GCP credentials.
"""

import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest

# Skip the entire module if the Firestore SDK is not installed (defensive —
# google-cloud-firestore is a project dependency, but importorskip keeps the
# suite green for environments that strip optional extras).
pytest.importorskip("google.cloud.firestore")

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip(
        "Firestore emulator not configured (FIRESTORE_EMULATOR_HOST unset)",
        allow_module_level=True,
    )

from google.cloud import firestore  # noqa: E402  type: ignore[import-untyped]

from app.domain.entities.contact import Contact  # noqa: E402
from app.domain.enums.contact import (  # noqa: E402
    ContactStatus,
    LessonType,
    PreferredContact,
)
from app.domain.value_objects.email import Email  # noqa: E402
from app.domain.value_objects.phone import Phone  # noqa: E402
from app.infrastructure.repositories.firestore_contact_repository import (  # noqa: E402
    FirestoreContactRepository,
)

_COLLECTION = "contacts"


def _make_contact(
    *,
    name: str = "山田 太郎",
    email: str = "taro@example.com",
    phone: str | None = "+819012345678",
    message: str = "テストメッセージ",
) -> Contact:
    """Build a valid Contact for tests."""
    now = datetime.now(UTC)
    return Contact(
        name=name,
        email=Email(email),
        phone=Phone(phone) if phone else None,
        message=message,
        lesson_type=LessonType.TRIAL,
        preferred_contact=PreferredContact.EMAIL,
        status=ContactStatus.PENDING,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
async def firestore_client() -> firestore.AsyncClient:
    """Provide a function-scoped AsyncClient backed by the emulator."""
    client = firestore.AsyncClient(project="test-project")
    yield client
    # Wipe the collection between tests so cases stay isolated.
    coll = client.collection(_COLLECTION)
    async for doc in coll.stream():
        await doc.reference.delete()


@pytest.fixture
def repository(firestore_client: firestore.AsyncClient) -> FirestoreContactRepository:
    return FirestoreContactRepository(firestore_client)


class TestSave:
    async def test_save_new_document(
        self, repository: FirestoreContactRepository
    ) -> None:
        contact = _make_contact()
        saved = await repository.save(contact)
        assert saved.id == contact.id

        loaded = await repository.find_by_id(contact.id)
        assert loaded is not None
        assert loaded.name == contact.name
        assert loaded.email is not None
        assert loaded.email.value == contact.email.value  # type: ignore[union-attr]

    async def test_save_upsert_overwrites(
        self, repository: FirestoreContactRepository
    ) -> None:
        contact = _make_contact(name="Original Name")
        await repository.save(contact)

        contact.name = "Updated Name"
        contact.updated_at = datetime.now(UTC)
        await repository.save(contact)

        loaded = await repository.find_by_id(contact.id)
        assert loaded is not None
        assert loaded.name == "Updated Name"

    async def test_save_round_trips_processed_fields(
        self, repository: FirestoreContactRepository
    ) -> None:
        """processed_at / processed_by / processing_notes must survive Firestore."""
        contact = _make_contact()
        processed_at = datetime.now(UTC)
        contact.processed_at = processed_at
        contact.processed_by = "admin@example.com"
        contact.processing_notes = "対応済み"

        await repository.save(contact)

        loaded = await repository.find_by_id(contact.id)
        assert loaded is not None
        assert loaded.processed_at == processed_at
        assert loaded.processed_by == "admin@example.com"
        assert loaded.processing_notes == "対応済み"


class TestFindById:
    async def test_hit(self, repository: FirestoreContactRepository) -> None:
        contact = _make_contact()
        await repository.save(contact)
        loaded = await repository.find_by_id(contact.id)
        assert loaded is not None
        assert loaded.id == contact.id

    async def test_miss_returns_none(
        self, repository: FirestoreContactRepository
    ) -> None:
        assert await repository.find_by_id(uuid4()) is None


class TestFindByEmail:
    async def test_hit(self, repository: FirestoreContactRepository) -> None:
        contact = _make_contact(email="hit@example.com")
        await repository.save(contact)
        loaded = await repository.find_by_email("hit@example.com")
        assert loaded is not None
        assert loaded.id == contact.id

    async def test_miss_returns_none(
        self, repository: FirestoreContactRepository
    ) -> None:
        assert await repository.find_by_email("nobody@example.com") is None


class TestFindAll:
    async def test_pagination(self, repository: FirestoreContactRepository) -> None:
        """Insert 5 docs with staggered created_at; verify offset/limit semantics."""
        base = datetime.now(UTC)
        contacts = []
        for i in range(5):
            c = _make_contact(email=f"user{i}@example.com")
            # 並び順を確定させるため created_at を i 秒ずつズラす。
            c.created_at = base.replace(microsecond=i * 1000)
            contacts.append(c)
            await repository.save(c)

        page = await repository.find_all(limit=2, offset=2)
        assert len(page) == 2
        # order_by("created_at") ascending — indices 2, 3 expected.
        emails = {c.email.value for c in page if c.email is not None}
        assert emails == {"user2@example.com", "user3@example.com"}


class TestDelete:
    async def test_delete_existing(
        self, repository: FirestoreContactRepository
    ) -> None:
        contact = _make_contact()
        await repository.save(contact)
        assert await repository.delete(contact.id) is True
        assert await repository.find_by_id(contact.id) is None

    async def test_delete_nonexistent(
        self, repository: FirestoreContactRepository
    ) -> None:
        assert await repository.delete(uuid4()) is False


class TestCount:
    async def test_count(self, repository: FirestoreContactRepository) -> None:
        assert await repository.count() == 0
        await repository.save(_make_contact(email="a@example.com"))
        await repository.save(_make_contact(email="b@example.com"))
        assert await repository.count() == 2
