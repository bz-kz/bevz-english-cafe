"""ProcessedEventRepository interface — Stripe webhook idempotency."""

from __future__ import annotations

from abc import ABC, abstractmethod


class ProcessedEventRepository(ABC):
    @abstractmethod
    async def claim(self, event_id: str, event_type: str) -> bool:
        """初回 True (この呼び出しが処理権を得た)、既処理なら False。

        Firestore create-if-absent の atomic 性に依存 (非クリティカル
        event の claim-first 用)。クリティカル invoice.paid は
        StripeService が transaction 内で別途 processed doc を扱う。
        """
        ...
