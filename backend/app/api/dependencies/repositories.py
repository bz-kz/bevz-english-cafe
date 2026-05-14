"""Per-request repository factories."""

from __future__ import annotations

from app.domain.repositories.contact_repository import ContactRepository
from app.domain.repositories.user_repository import UserRepository
from app.infrastructure.database.firestore_client import get_firestore_client
from app.infrastructure.repositories.firestore_contact_repository import (
    FirestoreContactRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)


def get_user_repository() -> UserRepository:
    return FirestoreUserRepository(get_firestore_client())


def get_contact_repository() -> ContactRepository:
    return FirestoreContactRepository(get_firestore_client())
