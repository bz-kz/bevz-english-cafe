"""Firestore implementation of Contact repository."""

from typing import Any
from uuid import UUID

from google.cloud import firestore  # type: ignore[import-untyped]

from ...domain.entities.contact import Contact
from ...domain.enums.contact import ContactStatus, LessonType, PreferredContact
from ...domain.repositories.contact_repository import ContactRepository
from ...domain.value_objects.email import Email
from ...domain.value_objects.phone import Phone

_COLLECTION_NAME = "contacts"


class FirestoreContactRepository(ContactRepository):
    """Firestore implementation of ContactRepository."""

    def __init__(self, client: firestore.AsyncClient) -> None:
        """Initialize repository with an async Firestore client.

        Args:
            client: google.cloud.firestore.AsyncClient
        """
        self._client = client
        self._collection = client.collection(_COLLECTION_NAME)

    async def save(self, contact: Contact) -> Contact:
        """Save a contact entity to Firestore.

        Firestore set() is upsert by default — matches
        SQLAlchemyContactRepository.save() upsert semantics.
        """
        assert contact.email is not None, "Contact.email は必須項目"

        await self._collection.document(str(contact.id)).set(
            self._entity_to_dict(contact)
        )
        return contact

    async def find_by_id(self, contact_id: UUID) -> Contact | None:
        """Find a contact by its ID."""
        doc = await self._collection.document(str(contact_id)).get()
        if not doc.exists:
            return None
        return self._dict_to_entity(doc.to_dict(), doc.id)

    async def find_by_email(self, email: str) -> Contact | None:
        """Find a contact by email address."""
        query = self._collection.where("email", "==", email).limit(1)
        async for doc in query.stream():
            return self._dict_to_entity(doc.to_dict(), doc.id)
        return None

    async def find_all(self, limit: int = 100, offset: int = 0) -> list[Contact]:
        """Find all contacts with pagination.

        Firestore charges per skipped doc with .offset() — fine for low-volume
        Contact collection but worth noting.
        """
        query = self._collection.order_by("created_at").offset(offset).limit(limit)
        return [
            self._dict_to_entity(doc.to_dict(), doc.id) async for doc in query.stream()
        ]

    async def delete(self, contact_id: UUID) -> bool:
        """Delete a contact by its ID."""
        doc_ref = self._collection.document(str(contact_id))
        doc = await doc_ref.get()
        if not doc.exists:
            return False
        await doc_ref.delete()
        return True

    async def count(self) -> int:
        """Count total number of contacts via Firestore aggregation."""
        agg = self._collection.count()
        result = await agg.get()
        return int(result[0][0].value)

    @staticmethod
    def _entity_to_dict(contact: Contact) -> dict[str, Any]:
        """Serialize a Contact entity to a Firestore-friendly dict.

        - 値オブジェクト Email / Phone は .value で文字列化
        - Enum は .value
        - UUID は str
        - datetime は Firestore がネイティブで Timestamp に変換するためそのまま
        """
        assert contact.email is not None, "Contact.email は必須項目"

        return {
            "id": str(contact.id),
            "name": contact.name,
            "email": contact.email.value,
            "phone": contact.phone.value if contact.phone else None,
            "message": contact.message,
            "lesson_type": contact.lesson_type.value,
            "preferred_contact": contact.preferred_contact.value,
            "status": contact.status.value,
            "created_at": contact.created_at,
            "updated_at": contact.updated_at,
            "processed_at": contact.processed_at,
            "processed_by": contact.processed_by,
            "processing_notes": contact.processing_notes,
        }

    @staticmethod
    def _dict_to_entity(data: dict[str, Any], doc_id: str) -> Contact:
        """Rebuild a Contact entity from a Firestore document dict.

        Firestore returns datetimes as tz-aware UTC datetimes — pass through
        as-is. processed_at / processed_by / processing_notes も round-trip する。
        """
        phone_value = data.get("phone")
        phone = Phone(phone_value) if phone_value else None

        return Contact(
            id=UUID(doc_id),
            name=data["name"],
            email=Email(data["email"]),
            phone=phone,
            message=data["message"],
            lesson_type=LessonType(data["lesson_type"]),
            preferred_contact=PreferredContact(data["preferred_contact"]),
            status=ContactStatus(data["status"]),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            processed_at=data.get("processed_at"),
            processed_by=data.get("processed_by"),
            processing_notes=data.get("processing_notes"),
        )
