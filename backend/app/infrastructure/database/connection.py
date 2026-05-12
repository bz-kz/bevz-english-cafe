"""
データベース接続設定

SQLAlchemyを使用したPostgreSQL接続の管理
"""

import os
from typing import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from ...config import get_settings


def get_database_url(async_mode: bool = True) -> str:
    """
    データベースURLを取得
    
    Args:
        async_mode: 非同期モードかどうか
        
    Returns:
        str: データベースURL
    """
    settings = get_settings()
    
    if async_mode:
        # 非同期用（asyncpg）
        return settings.database_url.replace("postgresql://", "postgresql+asyncpg://")
    else:
        # 同期用（psycopg2）
        return settings.database_url.replace("postgresql://", "postgresql+psycopg2://")


# 非同期エンジンの作成
async_engine = create_async_engine(
    get_database_url(async_mode=True),
    echo=os.getenv("DATABASE_ECHO", "false").lower() == "true",
    pool_size=int(os.getenv("DATABASE_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DATABASE_MAX_OVERFLOW", "20")),
    pool_pre_ping=True,
    pool_recycle=3600,  # 1時間でコネクションをリサイクル
)

# 同期エンジンの作成（マイグレーション用）
sync_engine = create_engine(
    get_database_url(async_mode=False),
    echo=os.getenv("DATABASE_ECHO", "false").lower() == "true",
    pool_size=int(os.getenv("DATABASE_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DATABASE_MAX_OVERFLOW", "20")),
    pool_pre_ping=True,
    pool_recycle=3600,
)

# セッションファクトリーの作成
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

SessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    データベースセッションを取得
    
    FastAPIの依存性注入で使用
    
    Yields:
        AsyncSession: データベースセッション
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_sync_session():
    """
    同期データベースセッションを取得
    
    マイグレーションやテストで使用
    
    Returns:
        Session: 同期データベースセッション
    """
    return SessionLocal()


# エイリアス（後方互換性のため）
get_async_session = get_session