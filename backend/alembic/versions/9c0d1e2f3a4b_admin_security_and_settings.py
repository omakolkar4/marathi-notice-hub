"""admin_security_and_settings

Revision ID: 9c0d1e2f3a4b
Revises: 8b9c0d1e2f3a
Create Date: 2026-10-24 18:00:00.000000

"""
from typing import Sequence, Union
from datetime import datetime
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '9c0d1e2f3a4b'
down_revision: Union[str, Sequence[str], None] = '8b9c0d1e2f3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()
    user_columns = [col['name'] for col in inspector.get_columns('users')]

    # 1. Add columns to users table if not already present
    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'is_principal' not in user_columns:
            batch_op.add_column(sa.Column('is_principal', sa.Boolean(), server_default='0', nullable=False))
        if 'permissions' not in user_columns:
            batch_op.add_column(sa.Column('permissions', sa.JSON(), nullable=True))
        if 'phone' not in user_columns:
            batch_op.add_column(sa.Column('phone', sa.String(length=30), nullable=True))
        if 'preferred_language' not in user_columns:
            batch_op.add_column(sa.Column('preferred_language', sa.String(length=10), server_default='mr', nullable=False))
        if 'theme_preference' not in user_columns:
            batch_op.add_column(sa.Column('theme_preference', sa.String(length=10), server_default='light', nullable=False))
        if 'created_by_id' not in user_columns:
            batch_op.add_column(sa.Column('created_by_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_users_created_by', 'users', ['created_by_id'], ['id'], ondelete='SET NULL')

    # 2. Create school_settings table if it doesn't exist
    if 'school_settings' not in existing_tables:
        op.create_table(
            'school_settings',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('school_name', sa.String(length=255), nullable=False),
            sa.Column('school_code', sa.String(length=50), nullable=True),
            sa.Column('address', sa.Text(), nullable=True),
            sa.Column('contact_email', sa.String(length=100), nullable=True),
            sa.Column('contact_phone', sa.String(length=30), nullable=True),
            sa.Column('principal_name', sa.String(length=100), nullable=True),
            sa.Column('logo_url', sa.String(length=255), nullable=True),
            sa.Column('academic_year', sa.String(length=20), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )

    # 3. Seed initial default school settings if empty
    setting_row = conn.execute(sa.text("SELECT count(*) FROM school_settings")).scalar()
    if not setting_row:
        conn.execute(
            sa.text("""
                INSERT INTO school_settings (id, school_name, school_code, address, contact_email, contact_phone, principal_name, logo_url, academic_year, updated_at)
                VALUES (1, 'महाराष्ट्र विद्यालय व कनिष्ठ महाविद्यालय (Maharashtra Vidyalaya & Junior College)', 'MV-PUNE-01', 'पुणे, महाराष्ट्र (Pune, Maharashtra)', 'contact@maharashtravidyalaya.edu.in', '+91 20 2550 0000', 'मा. प्राचार्य (Designated Principal)', NULL, '2026-2027', :now)
            """),
            {"now": datetime.utcnow()}
        )

    # 4. Update existing admin user to be Principal with full permissions
    all_perms = json.dumps([
        "full_admin",
        "manage_admins",
        "exam_management",
        "notice_management",
        "reports_access",
        "settings_management"
    ])
    conn.execute(
        sa.text("UPDATE users SET is_principal = 1, permissions = :perms, designation = 'Principal / प्रशासक' WHERE username = 'admin'"),
        {"perms": all_perms}
    )


def downgrade() -> None:
    op.drop_table('school_settings')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('fk_users_created_by', type_='foreignkey')
        batch_op.drop_column('created_by_id')
        batch_op.drop_column('theme_preference')
        batch_op.drop_column('preferred_language')
        batch_op.drop_column('phone')
        batch_op.drop_column('permissions')
        batch_op.drop_column('is_principal')
