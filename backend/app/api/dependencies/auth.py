"""Firebase Auth dependency: verify the Bearer ID token, fetch the User."""

from __future__ import annotations

from typing import Annotated, Any

import firebase_admin
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as fb_auth

from app.api.dependencies.repositories import get_user_repository
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository


def _decode_token(authorization: str) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[len("Bearer ") :].strip()
    try:
        return fb_auth.verify_id_token(token)
    except (ValueError, firebase_admin.exceptions.FirebaseError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid ID token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(
    authorization: Annotated[str, Header()],
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
) -> User:
    """Resolve the current Firebase user → backend User entity.

    Raises 401 if the token is missing/invalid, 404 if the Firebase user
    has no `users/{uid}` doc yet (call POST /api/v1/users/me to create it).
    """
    decoded = _decode_token(authorization)
    uid = decoded["uid"]
    user = await user_repo.find_by_uid(uid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not registered. Call POST /api/v1/users/me to initialize.",
        )
    # Firebase Auth の custom claim から admin フラグを hydrate
    user.is_admin = bool(decoded.get("admin", False))
    return user


async def get_admin_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """admin 専用 endpoint の gate。`admin: true` custom claim 必須。"""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


async def get_decoded_token(
    authorization: Annotated[str, Header()],
) -> dict[str, Any]:
    """Used by POST /api/v1/users/me — verifies the token but does NOT
    require an existing `users/{uid}` doc.
    """
    return _decode_token(authorization)
