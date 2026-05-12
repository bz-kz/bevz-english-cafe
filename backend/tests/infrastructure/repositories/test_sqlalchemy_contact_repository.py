"""Tests for SQLAlchemy Contact Repository."""

import pytest
from uuid import uuid4
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.contact import Contact, ContactStatus, LessonType, PreferredContact
from app.domain.value_objects.email import Email
from app.domain.value_objects.phone import Phone
from app.infrastructure.repositories.sqlalchemy_contact_repository import SQLAlchemyContactRepository
from app.infrastructure.database.models.contact import ContactModel


class TestSQLAlchemyContactRepository:
    """Test cases for SQLAlchemy Contact Repository."""

    @pytest.fixture
    async def repository(self, async_session: AsyncSession):
        """Create repository instance for testing."""
        return SQLAlchemyContactRepository(async_session)

    @pytest.fixture
    def sample_contact(self):
        """Create a sample contact for testing."""
        return Contact(
            id=uuid4(),
            name="田中太郎",
            email=Email("tanaka@example.com"),
            phone=Phone("090-1234-5678"),
            message="英会話レッスンについて質問があります。",
            lesson_type=LessonType.TRIAL,
            preferred_contact=PreferredContact.EMAIL
        )

    async def test_save_new_contact(self, repository, sample_contact, async_session):
        """Test saving a new contact."""
        # Act
        saved_contact = await repository.save(sample_contact)
        await async_session.commit()

        # Assert
        assert saved_contact.id == sample_contact.id
        assert saved_contact.name == sample_contact.name
        assert saved_contact.email.value == sample_contact.email.value
        assert saved_contact.phone.value == sample_contact.phone.value
        assert saved_contact.message == sample_contact.message
        assert saved_contact.lesson_type == sample_contact.lesson_type
        assert saved_contact.preferred_contact == sample_contact.preferred_contact
        assert saved_contact.status == ContactStatus.PENDING

        # Verify in database
        db_contact = await async_session.get(ContactModel, sample_contact.id)
        assert db_contact is not None
        assert db_contact.name == sample_contact.name

    async def test_save_existing_contact(self, repository, sample_contact, async_session):
        """Test updating an existing contact."""
        # Arrange - save initial contact
        await repository.save(sample_contact)
        await async_session.commit()

        # Modify contact
        sample_contact.name = "田中花子"
        sample_contact.status = ContactStatus.COMPLETED

        # Act
        updated_contact = await repository.save(sample_contact)
        await async_session.commit()

        # Assert
        assert updated_contact.name == "田中花子"
        assert updated_contact.status == ContactStatus.COMPLETED

        # Verify in database
        db_contact = await async_session.get(ContactModel, sample_contact.id)
        assert db_contact.name == "田中花子"
        assert db_contact.status == ContactStatus.COMPLETED.value

    async def test_find_by_id_existing(self, repository, sample_contact, async_session):
        """Test finding an existing contact by ID."""     
   # Arrange
        await repository.save(sample_contact)
        await async_session.commit()

        # Act
        found_contact = await repository.find_by_id(sample_contact.id)

        # Assert
        assert found_contact is not None
        assert found_contact.id == sample_contact.id
        assert found_contact.name == sample_contact.name
        assert found_contact.email.value == sample_contact.email.value

    async def test_find_by_id_not_existing(self, repository):
        """Test finding a non-existing contact by ID."""
        # Act
        found_contact = await repository.find_by_id(uuid4())

        # Assert
        assert found_contact is None

    async def test_find_by_email_existing(self, repository, sample_contact, async_session):
        """Test finding an existing contact by email."""
        # Arrange
        await repository.save(sample_contact)
        await async_session.commit()

        # Act
        found_contact = await repository.find_by_email(sample_contact.email.value)

        # Assert
        assert found_contact is not None
        assert found_contact.email.value == sample_contact.email.value
        assert found_contact.name == sample_contact.name

    async def test_find_by_email_not_existing(self, repository):
        """Test finding a non-existing contact by email."""
        # Act
        found_contact = await repository.find_by_email("nonexistent@example.com")

        # Assert
        assert found_contact is None

    async def test_find_all_with_pagination(self, repository, async_session):
        """Test finding all contacts with pagination."""
        # Arrange - create multiple contacts
        contacts = []
        for i in range(5):
            contact = Contact(
                id=uuid4(),
                name=f"テストユーザー{i}",
                email=Email(f"test{i}@example.com"),
                message=f"テストメッセージ{i}",
                lesson_type=LessonType.GROUP,
                preferred_contact=PreferredContact.EMAIL
            )
            contacts.append(contact)
            await repository.save(contact)
        await async_session.commit()

        # Act
        found_contacts = await repository.find_all(limit=3, offset=1)

        # Assert
        assert len(found_contacts) == 3
        # Contacts should be ordered by created_at desc
        for contact in found_contacts:
            assert contact.name.startswith("テストユーザー")

    async def test_delete_existing_contact(self, repository, sample_contact, async_session):
        """Test deleting an existing contact."""
        # Arrange
        await repository.save(sample_contact)
        await async_session.commit()

        # Act
        result = await repository.delete(sample_contact.id)
        await async_session.commit()

        # Assert
        assert result is True

        # Verify deletion
        db_contact = await async_session.get(ContactModel, sample_contact.id)
        assert db_contact is None

    async def test_delete_non_existing_contact(self, repository):
        """Test deleting a non-existing contact."""
        # Act
        result = await repository.delete(uuid4())

        # Assert
        assert result is False

    async def test_count_contacts(self, repository, async_session):
        """Test counting contacts."""
        # Arrange - create multiple contacts
        for i in range(3):
            contact = Contact(
                id=uuid4(),
                name=f"カウントテスト{i}",
                email=Email(f"count{i}@example.com"),
                message="カウントテスト",
                lesson_type=LessonType.GROUP,
                preferred_contact=PreferredContact.EMAIL
            )
            await repository.save(contact)
        await async_session.commit()

        # Act
        count = await repository.count()

        # Assert
        assert count >= 3  # At least the 3 we created

    async def test_save_contact_without_phone(self, repository, async_session):
        """Test saving a contact without phone number."""
        # Arrange
        contact = Contact(
            id=uuid4(),
            name="電話なしユーザー",
            email=Email("nophone@example.com"),
            phone=None,
            message="電話番号なしのテスト",
            lesson_type=LessonType.GROUP,
            preferred_contact=PreferredContact.EMAIL
        )

        # Act
        saved_contact = await repository.save(contact)
        await async_session.commit()

        # Assert
        assert saved_contact.phone is None

        # Verify in database
        db_contact = await async_session.get(ContactModel, contact.id)
        assert db_contact.phone is None