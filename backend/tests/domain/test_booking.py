from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.domain.entities.booking import Booking
from app.domain.enums.lesson_booking import BookingStatus


def test_booking_minimal():
    b = Booking(
        id=uuid4(),
        slot_id="slot-1",
        user_id="u-1",
        status=BookingStatus.CONFIRMED,
        created_at=datetime.now(UTC),
        cancelled_at=None,
    )
    assert b.status == BookingStatus.CONFIRMED
    assert b.cancelled_at is None


def test_booking_rejects_empty_slot_id():
    with pytest.raises(ValueError, match="slot_id"):
        Booking(
            id=uuid4(),
            slot_id="",
            user_id="u-1",
            status=BookingStatus.CONFIRMED,
            created_at=datetime.now(UTC),
            cancelled_at=None,
        )


def test_booking_rejects_empty_user_id():
    with pytest.raises(ValueError, match="user_id"):
        Booking(
            id=uuid4(),
            slot_id="slot-1",
            user_id="",
            status=BookingStatus.CONFIRMED,
            created_at=datetime.now(UTC),
            cancelled_at=None,
        )
