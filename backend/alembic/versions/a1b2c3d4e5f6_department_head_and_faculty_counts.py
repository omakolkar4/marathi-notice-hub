"""department_head_and_faculty_counts

Revision ID: a1b2c3d4e5f6
Revises: 9c0d1e2f3a4b
Create Date: 2026-10-24 21:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9c0d1e2f3a4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    dept_columns = [col['name'] for col in inspector.get_columns('departments')]

    # Add head_id to departments table if not already present
    if 'head_id' not in dept_columns:
        with op.batch_alter_table('departments', schema=None) as batch_op:
            batch_op.add_column(sa.Column('head_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_departments_head_id', 'users', ['head_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    with op.batch_alter_table('departments', schema=None) as batch_op:
        batch_op.drop_constraint('fk_departments_head_id', type_='foreignkey')
        batch_op.drop_column('head_id')
