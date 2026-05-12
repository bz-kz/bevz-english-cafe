"""Initial migration - Create contacts table

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """アップグレード処理"""
    # contacts テーブルの作成
    op.create_table(
        'contacts',
        sa.Column('id', postgresql.UUID(), nullable=False, comment='ID'),
        sa.Column('name', sa.String(length=100), nullable=False, comment='名前'),
        sa.Column('email', sa.String(length=255), nullable=False, comment='メールアドレス'),
        sa.Column('phone', sa.String(length=20), nullable=True, comment='電話番号'),
        sa.Column('message', sa.Text(), nullable=False, comment='メッセージ'),
        sa.Column('lesson_type', sa.String(length=20), nullable=False, comment='レッスンタイプ'),
        sa.Column('preferred_contact', sa.String(length=20), nullable=False, comment='希望連絡方法'),
        sa.Column('status', sa.String(length=20), nullable=False, comment='ステータス'),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True, comment='処理日時'),
        sa.Column('processed_by', sa.String(length=100), nullable=True, comment='処理者'),
        sa.Column('processing_notes', sa.Text(), nullable=True, comment='処理メモ'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='更新日時'),
        sa.PrimaryKeyConstraint('id'),
        comment='問い合わせ'
    )
    
    # インデックスの作成
    op.create_index('ix_contacts_email', 'contacts', ['email'])
    op.create_index('ix_contacts_status', 'contacts', ['status'])
    op.create_index('ix_contacts_created_at', 'contacts', ['created_at'])
    op.create_index('ix_contacts_lesson_type', 'contacts', ['lesson_type'])


def downgrade() -> None:
    """ダウングレード処理"""
    # インデックスの削除
    op.drop_index('ix_contacts_lesson_type', table_name='contacts')
    op.drop_index('ix_contacts_created_at', table_name='contacts')
    op.drop_index('ix_contacts_status', table_name='contacts')
    op.drop_index('ix_contacts_email', table_name='contacts')
    
    # テーブルの削除
    op.drop_table('contacts')