"""User repository interface (DDD outer→inner contract)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities.user import User


class UserRepository(ABC):
    @abstractmethod
    async def save(self, user: User) -> User:
        ...

    @abstractmethod
    async def find_by_uid(self, uid: str) -> User | None:
        ...

    @abstractmethod
    async def find_by_email(self, email: str) -> User | None:
        ...

    @abstractmethod
    async def search(self, q: str, *, limit: int = 50) -> list[User]:
        """email/name prefix match (case-sensitive)。最大 limit 件。"""
        ...

    @abstractmethod
    async def list_all(self, *, limit: int = 50) -> list[User]:
        """updated_at desc で limit 件 (admin combo-box デフォルト)。"""
        ...
