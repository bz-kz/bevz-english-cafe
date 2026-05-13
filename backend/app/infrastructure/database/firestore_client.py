"""Firestore async client factory.

Honors GOOGLE_CLOUD_PROJECT (required in prod) and FIRESTORE_EMULATOR_HOST
(set in local dev / tests — google-cloud-firestore picks it up automatically
from the env var, no explicit wiring needed).
"""

from google.cloud import firestore  # type: ignore[import-untyped]

from app.config import get_settings

_client: firestore.AsyncClient | None = None


def get_firestore_client() -> firestore.AsyncClient:
    """Return a singleton AsyncClient. Reads project_id from Settings.

    FIRESTORE_EMULATOR_HOST env var is auto-detected by the SDK — when set,
    the client talks to the emulator and project_id is treated as a label only.
    """
    global _client
    if _client is None:
        settings = get_settings()
        _client = firestore.AsyncClient(project=settings.gcp_project_id)
    return _client


def reset_firestore_client() -> None:
    """Test hook — drop the cached client so tests can swap project IDs."""
    global _client
    _client = None
