"""Add cascade delete to sessions for candidates

Revision ID: 005_add_cascade_delete
Revises: 004_add_evaluation_metrics
Create Date: 2026-04-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005_add_cascade_delete"
down_revision = "004_add_evaluation_metrics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing foreign key constraint and recreate with CASCADE
    # This ensures when a scoring_job is deleted, all candidates are also deleted
    op.drop_constraint(
        "candidates_scoring_job_id_fkey",
        "candidates",
        type_="foreignkey"
    )
    op.create_foreign_key(
        "candidates_scoring_job_id_fkey",
        "candidates",
        "scoring_jobs",
        ["scoring_job_id"],
        ["id"],
        ondelete="CASCADE"
    )


def downgrade() -> None:
    # Revert to SET NULL behavior
    op.drop_constraint(
        "candidates_scoring_job_id_fkey",
        "candidates",
        type_="foreignkey"
    )
    op.create_foreign_key(
        "candidates_scoring_job_id_fkey",
        "candidates",
        "scoring_jobs",
        ["scoring_job_id"],
        ["id"],
        ondelete="SET NULL"
    )
