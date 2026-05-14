"""Domain errors for BookingService."""

from __future__ import annotations


class BookingError(Exception):
    """Base class for booking-related errors."""


class SlotNotFoundError(BookingError):
    """The lesson slot does not exist."""


class SlotNotOpenError(BookingError):
    """The slot status is not 'open' (closed or cancelled)."""


class SlotInPastError(BookingError):
    """The slot's start time is in the past."""


class SlotFullError(BookingError):
    """The slot has no remaining capacity."""


class AlreadyBookedError(BookingError):
    """The user already has a confirmed booking on this slot."""


class BookingNotFoundError(BookingError):
    """The booking does not exist."""


class NotBookingOwnerError(BookingError):
    """The acting user is not the booking owner."""
