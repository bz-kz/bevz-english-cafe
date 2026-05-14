"""Application service for user lifecycle.

Currently: signup initialization + retroactive contact backfill.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.entities.contact import Contact
from app.domain.entities.user import User
from app.domain.repositories.contact_repository import ContactRepository
from app.domain.repositories.user_repository import UserRepository
from app.domain.value_objects.phone import Phone


@dataclass
class SignupResult:
    user: User
    linked_contacts: int


class UserService:
    """User lifecycle: signup-initialize + history retrieval."""

    def __init__(
        self,
        user_repo: UserRepository,
        contact_repo: ContactRepository,
    ) -> None:
        self._users = user_repo
        self._contacts = contact_repo

    async def signup_initialize(
        self, *, uid: str, email: str, name: str, phone_str: str | None
    ) -> SignupResult:
        """Create the User doc + backfill the user's anonymous contacts.

        Raises ValueError if uid already has a User. Returns the new User
        plus a count of contacts that were retroactively linked.
        """
        existing = await self._users.find_by_uid(uid)
        if existing is not None:
            raise ValueError(f"User with uid {uid} already exists")

        phone = Phone(phone_str) if phone_str else None
        user = User(uid=uid, email=email, name=name, phone=phone)
        await self._users.save(user)

        # 匿名 contact のうち verified email が一致するものを backfill。
        # find_all は in-memory フィルタなので、件数が増えたら
        # ContactRepository.find_by_email でクエリ化したい (TODO).
        linked = 0
        all_contacts = await self._contacts.find_all(limit=10_000, offset=0)
        for contact in all_contacts:
            email_str = contact.email.value if contact.email else None
            if email_str == email and contact.user_id is None:
                contact.user_id = uid
                await self._contacts.save(contact)
                linked += 1

        return SignupResult(user=user, linked_contacts=linked)

    async def find_user_contacts(
        self, *, user: User, limit: int = 50, offset: int = 0
    ) -> list[Contact]:
        """Return the user's contacts, newest first."""
        all_contacts = await self._contacts.find_all(limit=10_000, offset=0)
        owned = [c for c in all_contacts if c.user_id == user.uid]
        owned.sort(key=lambda c: c.created_at, reverse=True)
        return owned[offset : offset + limit]
