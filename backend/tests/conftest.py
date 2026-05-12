import asyncio
from collections.abc import AsyncGenerator

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.infrastructure.database.connection import get_async_session
from app.infrastructure.database.models.base import Base
from app.infrastructure.di.container import get_container
from app.main import app as main_app


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def app(async_session: AsyncSession) -> AsyncGenerator[FastAPI, None]:
    """Create FastAPI app instance for testing.

    エンドポイントは ``Depends(get_async_session)`` 経由で本番 DB に接続するため、
    テスト用 SQLite セッションを返す override を差し込む。
    """
    # DIコンテナの互換 API（現在は no-op）
    container = get_container()
    await container.setup_database_services(async_session)

    async def _override_get_async_session():
        yield async_session

    main_app.dependency_overrides[get_async_session] = _override_get_async_session
    try:
        yield main_app
    finally:
        main_app.dependency_overrides.pop(get_async_session, None)


@pytest.fixture
async def client(app: FastAPI):
    """Create an async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    """Create an async database session for testing."""
    # Use in-memory SQLite for testing
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
        echo=False,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async_session_maker = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session

    # Clean up
    await engine.dispose()


@pytest.fixture
def sample_contact_data():
    """Sample contact form data for testing."""
    return {
        "name": "田中太郎",
        "email": "tanaka@example.com",
        "message": "お問い合わせのテストです",
        "phone": "090-1234-5678",
        "lessonType": "trial",
        "preferredContact": "email",
    }
