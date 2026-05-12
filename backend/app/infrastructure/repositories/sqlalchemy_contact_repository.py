"""SQLAlchemy implementation of Contact repository."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...domain.entities.contact import Contact
from ...domain.repositories.contact_repository import ContactRepository
from ...domain.value_objects.email import Email
from ...domain.value_objects.phone import Phone
from ..database.models.contact import ContactModel


class SQLAlchemyContactRepository(ContactRepository):
    """SQLAlchemy implementation of ContactRepository."""

    def __init__(self, session: AsyncSession):
        """Initialize repository with database session.
        
        Args:
            session: SQLAlchemy async session
        """
        self._session = session

    async def save(self, contact: Contact) -> Contact:
        """Save a contact entity to database.
        
        Args:
            contact: The contact entity to save
            
        Returns:
            The saved contact entity with updated fields
        """
        # Check if contact already exists
        existing = await self._session.get(ContactModel, contact.id)
        
        if existing:
            # Update existing contact
            existing.name = contact.name
            existing.email = contact.email.value
            existing.phone = contact.phone.value if contact.phone else None
            existing.message = contact.message
            existing.lesson_type = contact.lesson_type.value
            existing.preferred_contact = contact.preferred_contact.value
            existing.status = contact.status.value
            existing.updated_at = contact.updated_at
            contact_model = existing
        else:
            # Create new contact
            contact_model = ContactModel(
                id=contact.id,
                name=contact.name,
                email=contact.email.value,
                phone=contact.phone.value if contact.phone else None,
                message=contact.message,
                lesson_type=contact.lesson_type.value,
                preferred_contact=contact.preferred_contact.value,
                status=contact.status.value,
                created_at=contact.created_at,
                updated_at=contact.updated_at
            )
            self._session.add(contact_model)
        
        await self._session.flush()
        await self._session.refresh(contact_model)
        return self._model_to_entity(contact_model)

    async def find_by_id(self, contact_id: UUID) -> Optional[Contact]:
        """Find a contact by its ID."""
        contact_model = await self._session.get(ContactModel, contact_id)
        return self._model_to_entity(contact_model) if contact_model else None

    async def find_by_email(self, email: str) -> Optional[Contact]:
        """Find a contact by email address."""
        stmt = select(ContactModel).where(ContactModel.email == email)
        result = await self._session.execute(stmt)
        contact_model = result.scalar_one_or_none()
        return self._model_to_entity(contact_model) if contact_model else None

    async def find_all(self, limit: int = 100, offset: int = 0) -> List[Contact]:
        """Find all contacts with pagination."""
        stmt = (
            select(ContactModel)
            .order_by(ContactModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        contact_models = result.scalars().all()
        return [self._model_to_entity(model) for model in contact_models]

    async def delete(self, contact_id: UUID) -> bool:
        """Delete a contact by its ID."""
        contact_model = await self._session.get(ContactModel, contact_id)
        if contact_model:
            await self._session.delete(contact_model)
            return True
        return False

    async def count(self) -> int:
        """Count total number of contacts."""
        stmt = select(func.count(ContactModel.id))
        result = await self._session.execute(stmt)
        return result.scalar() or 0

    def _model_to_entity(self, model: ContactModel) -> Contact:
        """Convert ContactModel to Contact entity."""
        from ...domain.entities.contact import LessonType, PreferredContact, ContactStatus
        
        phone = Phone(model.phone) if model.phone else None
        
        return Contact(
            id=model.id,
            name=model.name,
            email=Email(model.email),
            phone=phone,
            message=model.message,
            lesson_type=LessonType(model.lesson_type),
            preferred_contact=PreferredContact(model.preferred_contact),
            status=ContactStatus(model.status),
            created_at=model.created_at,
            updated_at=model.updated_at
        )