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
