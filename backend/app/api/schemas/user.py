"""Pydantic schemas for the User API surface."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Body of POST /api/v1/users/me — supplied by the signup form.

    `email` and `uid` are NOT in the body; they're taken from the verified
    Firebase Auth ID token in the Authorization header.
    """

    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=20)


class UserUpdate(BaseModel):
    """Body of PUT /api/v1/users/me."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=20)


class MonthQuotaSummary(BaseModel):
    granted: int
    used: int
    remaining: int


class UserResponse(BaseModel):
    uid: str
    email: EmailStr
    name: str
    phone: str | None
    plan: Literal["light", "standard", "intensive"] | None = None
    trial_used: bool = False
    current_month_quota: MonthQuotaSummary | None = None
    created_at: datetime
    updated_at: datetime


class UserSignupResponse(BaseModel):
    """Returned from POST /api/v1/users/me — new User plus a count of
    anonymous contact submissions that were retroactively linked.
    """

    user: UserResponse
    linked_contacts: int
