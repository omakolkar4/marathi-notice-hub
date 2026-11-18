"""phase6_examination_management

Revision ID: 8b9c0d1e2f3a
Revises: 7a8b9c0d1e2f
Create Date: 2026-10-24 15:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b9c0d1e2f3a'
down_revision: Union[str, Sequence[str], None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. examinations table
    op.create_table('examinations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('exam_code', sa.String(length=50), nullable=False),
        sa.Column('exam_date', sa.String(length=20), nullable=False),
        sa.Column('reporting_time', sa.String(length=10), nullable=False),
        sa.Column('collection_deadline', sa.String(length=10), nullable=False),
        sa.Column('grace_period_minutes', sa.Integer(), server_default='10', nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='scheduled', nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('examinations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_examinations_exam_code'), ['exam_code'], unique=True)
        batch_op.create_index(batch_op.f('ix_examinations_exam_date'), ['exam_date'], unique=False)
        batch_op.create_index(batch_op.f('ix_examinations_id'), ['id'], unique=False)

    # 2. examination_duties table
    op.create_table('examination_duties',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('examination_id', sa.Integer(), nullable=False),
        sa.Column('faculty_id', sa.Integer(), nullable=False),
        sa.Column('role_title', sa.String(length=100), server_default='Exam Invigilator', nullable=False),
        sa.Column('status', sa.String(length=30), server_default='assigned', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['examination_id'], ['examinations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['faculty_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('examination_id', 'faculty_id', name='uq_exam_faculty_duty')
    )
    with op.batch_alter_table('examination_duties', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_examination_duties_examination_id'), ['examination_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_examination_duties_faculty_id'), ['faculty_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_examination_duties_id'), ['id'], unique=False)

    # 3. qr_checkin_tokens table
    op.create_table('qr_checkin_tokens',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('examination_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=128), nullable=False),
        sa.Column('bucket_label', sa.String(length=100), nullable=False),
        sa.Column('qr_svg_content', sa.Text(), nullable=True),
        sa.Column('valid_from', sa.DateTime(), nullable=False),
        sa.Column('valid_until', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['examination_id'], ['examinations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('qr_checkin_tokens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_qr_checkin_tokens_examination_id'), ['examination_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_qr_checkin_tokens_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_qr_checkin_tokens_token'), ['token'], unique=True)

    # 4. faculty_checkin_records table
    op.create_table('faculty_checkin_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('examination_id', sa.Integer(), nullable=False),
        sa.Column('duty_id', sa.Integer(), nullable=False),
        sa.Column('faculty_id', sa.Integer(), nullable=False),
        sa.Column('qr_token_id', sa.Integer(), nullable=True),
        sa.Column('scanned_at', sa.DateTime(), nullable=False),
        sa.Column('scheduled_reporting_time', sa.DateTime(), nullable=False),
        sa.Column('is_late', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('minutes_late', sa.Integer(), server_default='0', nullable=False),
        sa.Column('status', sa.String(length=30), server_default='on_time', nullable=False),
        sa.Column('correction_reason', sa.Text(), nullable=True),
        sa.Column('corrected_by_id', sa.Integer(), nullable=True),
        sa.Column('corrected_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['corrected_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['duty_id'], ['examination_duties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['examination_id'], ['examinations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['faculty_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['qr_token_id'], ['qr_checkin_tokens.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('duty_id', name='uq_duty_checkin')
    )
    with op.batch_alter_table('faculty_checkin_records', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_faculty_checkin_records_examination_id'), ['examination_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_faculty_checkin_records_faculty_id'), ['faculty_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_faculty_checkin_records_id'), ['id'], unique=False)

    # 5. late_warning_records table
    op.create_table('late_warning_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('faculty_id', sa.Integer(), nullable=False),
        sa.Column('examination_id', sa.Integer(), nullable=False),
        sa.Column('checkin_record_id', sa.Integer(), nullable=False),
        sa.Column('warning_level', sa.Integer(), nullable=False),
        sa.Column('minutes_late', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='active', nullable=False),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['checkin_record_id'], ['faculty_checkin_records.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['examination_id'], ['examinations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['faculty_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('checkin_record_id', name='uq_checkin_warning')
    )
    with op.batch_alter_table('late_warning_records', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_late_warning_records_examination_id'), ['examination_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_late_warning_records_faculty_id'), ['faculty_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_late_warning_records_id'), ['id'], unique=False)

    # 6. examination_incident_reports table
    op.create_table('examination_incident_reports',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('faculty_id', sa.Integer(), nullable=False),
        sa.Column('examination_id', sa.Integer(), nullable=False),
        sa.Column('trigger_checkin_id', sa.Integer(), nullable=False),
        sa.Column('total_late_occurrences', sa.Integer(), nullable=False),
        sa.Column('incident_summary', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='open', nullable=False),
        sa.Column('admin_remarks', sa.Text(), nullable=True),
        sa.Column('reviewed_by_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['examination_id'], ['examinations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['faculty_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['trigger_checkin_id'], ['faculty_checkin_records.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('examination_incident_reports', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_examination_incident_reports_examination_id'), ['examination_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_examination_incident_reports_faculty_id'), ['faculty_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_examination_incident_reports_id'), ['id'], unique=False)


def downgrade() -> None:
    op.drop_table('examination_incident_reports')
    op.drop_table('late_warning_records')
    op.drop_table('faculty_checkin_records')
    op.drop_table('qr_checkin_tokens')
    op.drop_table('examination_duties')
    op.drop_table('examinations')
