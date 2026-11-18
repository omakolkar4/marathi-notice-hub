"""phase5_integration_and_audit

Revision ID: 7a8b9c0d1e2f
Revises: 5279b1644c45
Create Date: 2026-10-24 14:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, Sequence[str], None] = '5279b1644c45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new notice columns using batch mode for SQLite compatibility
    with op.batch_alter_table('notices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('notice_language', sa.String(length=10), server_default='mr', nullable=False))
        batch_op.add_column(sa.Column('source_organization', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('source_date', sa.String(length=50), nullable=True))

    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('notice_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['notice_id'], ['notices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_audit_logs_action'), ['action'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_logs_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_logs_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_logs_notice_id'), ['notice_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_logs_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_audit_logs_user_id'))
        batch_op.drop_index(batch_op.f('ix_audit_logs_notice_id'))
        batch_op.drop_index(batch_op.f('ix_audit_logs_id'))
        batch_op.drop_index(batch_op.f('ix_audit_logs_created_at'))
        batch_op.drop_index(batch_op.f('ix_audit_logs_action'))

    op.drop_table('audit_logs')

    with op.batch_alter_table('notices', schema=None) as batch_op:
        batch_op.drop_column('source_date')
        batch_op.drop_column('source_organization')
        batch_op.drop_column('notice_language')
