from app.domain.enums.lesson_booking import BookingStatus, SlotStatus


def test_slot_status_values():
    assert SlotStatus.OPEN.value == "open"
    assert SlotStatus.CLOSED.value == "closed"
    assert SlotStatus.CANCELLED.value == "cancelled"


def test_booking_status_values():
    assert BookingStatus.CONFIRMED.value == "confirmed"
    assert BookingStatus.CANCELLED.value == "cancelled"
