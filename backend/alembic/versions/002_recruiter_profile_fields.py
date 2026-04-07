"""Add recruiter profile fields

Revision ID: 002_recruiter_profile_fields
Revises: 001_initial
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa

revision = "002_recruiter_profile_fields"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS post VARCHAR(100)"))
    op.execute(sa.text("ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS phone VARCHAR(20)"))
    op.execute(sa.text("ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS department VARCHAR(100)"))
    op.execute(sa.text("ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS location VARCHAR(255)"))
    op.execute(sa.text("ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS join_date DATE"))


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE recruiters DROP COLUMN IF EXISTS join_date"))
    op.execute(sa.text("ALTER TABLE recruiters DROP COLUMN IF EXISTS location"))
    op.execute(sa.text("ALTER TABLE recruiters DROP COLUMN IF EXISTS department"))
    op.execute(sa.text("ALTER TABLE recruiters DROP COLUMN IF EXISTS phone"))
    op.execute(sa.text("ALTER TABLE recruiters DROP COLUMN IF EXISTS post"))
