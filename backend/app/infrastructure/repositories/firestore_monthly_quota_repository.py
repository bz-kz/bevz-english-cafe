"""Firestore impl of MonthlyQuotaRepository."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.domain.entities.monthly_quota import MonthlyQuota
from app.domain.repositories.monthly_quota_repository import MonthlyQuotaRepository

_COLLECTION = "monthly_quota"


def _doc_id(user_id: str, granted_at: datetime) -> str:
    return f"{user_id}_{granted_at.strftime('%Y%m%d%H%M%S%f')}"


class FirestoreMonthlyQuotaRepository(MonthlyQuotaRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def save(self, quota: MonthlyQuota) -> MonthlyQuota:
        await self._collection.document(_doc_id(quota.user_id, quota.granted_at)).set(
            self._to_dict(quota)
        )
        return quota

    async def find(self, user_id: str, year_month: str) -> MonthlyQuota | None:
        doc = await self._collection.document(f"{user_id}_{year_month}").get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict())

    async def find_active_for_user(
        self, user_id: str, at: datetime
    ) -> list[MonthlyQuota]:
        # Single equality filter — no composite index needed. Per-user doc
        # count is tiny; filter + sort in Python.
        out: list[MonthlyQuota] = []
        query = self._collection.where("user_id", "==", user_id)
        async for doc in query.stream():
            q = self._from_dict(doc.to_dict())
            if q.expires_at > at and q.used < q.granted:
                out.append(q)
        out.sort(key=lambda q: q.granted_at)
        return out

    async def find_by_doc_id(self, doc_id: str) -> MonthlyQuota | None:
        doc = await self._collection.document(doc_id).get()
        if not doc.exists:
            return None
        return self._from_dict(doc.to_dict())

    @staticmethod
    def _to_dict(q: MonthlyQuota) -> dict[str, Any]:
        return {
            "user_id": q.user_id,
            "year_month": q.year_month,
            "plan_at_grant": q.plan_at_grant,
            "granted": q.granted,
            "used": q.used,
            "granted_at": q.granted_at,
            "expires_at": q.expires_at,
        }

    @staticmethod
    def _from_dict(data: dict[str, Any] | None) -> MonthlyQuota:
        assert data is not None
        return MonthlyQuota(
            user_id=data["user_id"],
            year_month=data["year_month"],
            plan_at_grant=data["plan_at_grant"],
            granted=int(data["granted"]),
            used=int(data["used"]),
            granted_at=data["granted_at"],
            expires_at=data["expires_at"],
        )
