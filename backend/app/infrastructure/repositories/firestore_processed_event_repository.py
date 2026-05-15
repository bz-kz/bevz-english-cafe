"""Firestore impl of ProcessedEventRepository."""

from __future__ import annotations

from datetime import UTC, datetime

from google.api_core.exceptions import AlreadyExists
from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.domain.repositories.processed_event_repository import (
    ProcessedEventRepository,
)

_COLLECTION = "processed_stripe_events"


class FirestoreProcessedEventRepository(ProcessedEventRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def claim(self, event_id: str, event_type: str) -> bool:
        try:
            await self._collection.document(event_id).create(
                {
                    "event_type": event_type,
                    "processed_at": datetime.now(UTC),
                }
            )
            return True
        except AlreadyExists:
            return False
