"""Contact repository interface."""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from ..entities.contact import Contact


class ContactRepository(ABC):
    """Abstract repository for Contact entities."""

    @abstractmethod
    async def save(self, contact: Contact) -> Contact:
        """Save a contact entity.
        
        Args:
            contact: The contact entity to save
            
        Returns:
            The saved contact entity with updated fields
        """
        pass

    @abstractmethod
    async def find_by_id(self, contact_id: UUID) -> Optional[Contact]:
        """Find a contact by its ID.
        
        Args:
            contact_id: The unique identifier of the contact
            
        Returns:
            The contact entity if found, None otherwise
        """
        pass

    @abstractmethod
    async def find_by_email(self, email: str) -> Optional[Contact]:
        """Find a contact by email address.
        
        Args:
            email: The email address to search for
            
        Returns:
            The contact entity if found, None otherwise
        """
        pass

    @abstractmethod
    async def find_all(self, limit: int = 100, offset: int = 0) -> List[Contact]:
        """Find all contacts with pagination.
        
        Args:
            limit: Maximum number of contacts to return
            offset: Number of contacts to skip
            
        Returns:
            List of contact entities
        """
        pass

    @abstractmethod
    async def delete(self, contact_id: UUID) -> bool:
        """Delete a contact by its ID.
        
        Args:
            contact_id: The unique identifier of the contact to delete
            
        Returns:
            True if the contact was deleted, False if not found
        """
        pass

    @abstractmethod
    async def count(self) -> int:
        """Count total number of contacts.
        
        Returns:
            Total number of contacts in the repository
        """
        pass