"""Per-request repository + service factories."""

from __future__ import annotations

from app.domain.repositories.booking_repository import BookingRepository
from app.domain.repositories.contact_repository import ContactRepository
from app.domain.repositories.lesson_slot_repository import LessonSlotRepository
from app.domain.repositories.user_repository import UserRepository
from app.infrastructure.database.firestore_client import get_firestore_client
from app.infrastructure.repositories.firestore_booking_repository import (
    FirestoreBookingRepository,
)
from app.infrastructure.repositories.firestore_contact_repository import (
    FirestoreContactRepository,
)
from app.infrastructure.repositories.firestore_lesson_slot_repository import (
    FirestoreLessonSlotRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)
from app.services.booking_service import BookingService


def get_user_repository() -> UserRepository:
    return FirestoreUserRepository(get_firestore_client())


def get_contact_repository() -> ContactRepository:
    return FirestoreContactRepository(get_firestore_client())


def get_lesson_slot_repository() -> LessonSlotRepository:
    return FirestoreLessonSlotRepository(get_firestore_client())


def get_booking_repository() -> BookingRepository:
    return FirestoreBookingRepository(get_firestore_client())


def get_booking_service() -> BookingService:
    client = get_firestore_client()
    return BookingService(
        FirestoreLessonSlotRepository(client),
        FirestoreBookingRepository(client),
        client,
    )
