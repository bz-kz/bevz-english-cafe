"""Firestore-backed UserRepository."""

from __future__ import annotations

from typing import Any

from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.domain.entities.user import User
from app.domain.enums.plan import Plan
from app.domain.repositories.user_repository import UserRepository
from app.domain.value_objects.phone import Phone


class FirestoreUserRepository(UserRepository):
    def __init__(self, client: fs.AsyncClient, *, collection: str = "users") -> None:
        self._client = client
        self._collection_name = collection

    @property
    def _collection(self) -> Any:
        return self._client.collection(self._collection_name)

    async def save(self, user: User) -> User:
        await self._collection.document(user.uid).set(self._to_dict(user))
        return user

    async def find_by_uid(self, uid: str) -> User | None:
        doc = await self._collection.document(uid).get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict(), uid)

    async def find_by_email(self, email: str) -> User | None:
        query = self._collection.where("email", "==", email).limit(1)
        async for doc in query.stream():
            return self._from_dict(doc.to_dict(), doc.id)
        return None

    async def search(self, q: str, *, limit: int = 50) -> list[User]:
        if not q:
            return []
        # prefix range trick: '' を上限 sentinel として使う
        end = q + ""
        found: dict[str, User] = {}

        email_q = (
            self._collection.where("email", ">=", q)
            .where("email", "<=", end)
            .limit(limit)
        )
        async for doc in email_q.stream():
            found[doc.id] = self._from_dict(doc.to_dict(), doc.id)

        name_q = (
            self._collection.where("name", ">=", q)
            .where("name", "<=", end)
            .limit(limit)
        )
        async for doc in name_q.stream():
            if doc.id not in found:
                found[doc.id] = self._from_dict(doc.to_dict(), doc.id)

        return list(found.values())[:limit]

    async def list_all(self, *, limit: int = 50) -> list[User]:
        q = self._collection.order_by(
            "updated_at", direction=fs.Query.DESCENDING
        ).limit(limit)
        out: list[User] = []
        async for doc in q.stream():
            out.append(self._from_dict(doc.to_dict(), doc.id))
        return out

    @staticmethod
    def _to_dict(user: User) -> dict[str, Any]:
        return {
            "uid": user.uid,
            "email": user.email,
            "name": user.name,
            "phone": user.phone.value if user.phone else None,
            "plan": user.plan.value if user.plan else None,
            "plan_started_at": user.plan_started_at,
            "trial_used": user.trial_used,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "stripe_customer_id": user.stripe_customer_id,
            "stripe_subscription_id": user.stripe_subscription_id,
            "subscription_status": user.subscription_status,
            "subscription_cancel_at_period_end": user.subscription_cancel_at_period_end,
            "current_period_end": user.current_period_end,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None, uid: str) -> User:
        assert data is not None
        phone_val = data.get("phone")
        plan_val = data.get("plan")
        return User(
            uid=uid,
            email=data["email"],
            name=data["name"],
            phone=Phone(phone_val) if phone_val else None,
            plan=Plan(plan_val) if plan_val else None,
            plan_started_at=data.get("plan_started_at"),
            trial_used=bool(data.get("trial_used", False)),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            stripe_customer_id=data.get("stripe_customer_id"),
            stripe_subscription_id=data.get("stripe_subscription_id"),
            subscription_status=data.get("subscription_status"),
            subscription_cancel_at_period_end=bool(
                data.get("subscription_cancel_at_period_end", False)
            ),
            current_period_end=data.get("current_period_end"),
        )
