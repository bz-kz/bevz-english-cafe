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


class UserNotFoundError(BookingError):
    """The target user (force-book recipient) does not exist."""


class TrialAlreadyUsedError(Exception):
    """User has already consumed their lifetime trial booking."""


class NoActiveQuotaError(Exception):
    """User has no monthly_quota row for the booking month (plan unset or grant pending)."""


class QuotaExhaustedError(Exception):
    """User's monthly quota is fully consumed."""


class CancelDeadlinePassedError(Exception):
    """Booking is within 24 hours of start — cancellation refused."""
