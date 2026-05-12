"""
SQLAlchemy基底クラス

すべてのモデルの基底クラスを定義
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String, TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func
from uuid import UUID as PyUUID


class Base(DeclarativeBase):
    """SQLAlchemy基底クラス"""
    pass


class TimestampMixin:
    """タイムスタンプミックスイン"""
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="作成日時"
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="更新日時"
    )


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified hex values.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PostgresUUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, PyUUID):
                return str(PyUUID(value))
            else:
                return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, PyUUID):
                return PyUUID(value)
            return value


class UUIDMixin:
    """UUID主キーミックスイン"""
    
    id: Mapped[PyUUID] = mapped_column(
        GUID(),
        primary_key=True,
        default=uuid4,
        comment="ID"
    )