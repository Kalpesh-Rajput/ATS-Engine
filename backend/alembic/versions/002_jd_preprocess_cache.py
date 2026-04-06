"""Add jd_parsed_at for JD preprocessing cache

Revision ID: 002_jd_preprocess_cache
Revises: 002_admin_analytics_audit
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = "002_jd_preprocess_cache"
down_revision = "002_admin_analytics_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE scoring_jobs
            ADD COLUMN IF NOT EXISTS jd_parsed_at TIMESTAMP WITH TIME ZONE
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE scoring_jobs
            DROP COLUMN IF EXISTS jd_parsed_at
            """
        )
    )
