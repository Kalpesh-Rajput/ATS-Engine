"""Initial schema with pgvector extension

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Vector storage is handled by FAISS (not PostgreSQL pgvector)
    # op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "recruiters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("total_resumes_uploaded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_shortlisted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_recruiters_email", "recruiters", ["email"])

    op.create_table(
        "scoring_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recruiter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("jd_path", sa.String(500), nullable=True),
        sa.Column("jd_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total_candidates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_candidates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_candidates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["recruiter_id"], ["recruiters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recruiter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scoring_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("job_applied", sa.String(255), nullable=True),
        sa.Column("resume_path", sa.String(500), nullable=True),
        sa.Column("linkedin_path", sa.String(500), nullable=True),
        sa.Column("ats_score", sa.Float(), nullable=True),
        sa.Column("linkedin_match_score", sa.Float(), nullable=True),
        sa.Column("main_summary", sa.Text(), nullable=True),
        sa.Column("linkedin_summary", sa.Text(), nullable=True),
        sa.Column("linkedin_flag", sa.String(10), nullable=True),
        sa.Column("skills_matched", postgresql.JSONB(), nullable=True),
        sa.Column("skills_not_matched", postgresql.JSONB(), nullable=True),
        sa.Column("pros", postgresql.JSONB(), nullable=True),
        sa.Column("cons", postgresql.JSONB(), nullable=True),
        sa.Column("extracted_data", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["recruiter_id"], ["recruiters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scoring_job_id"], ["scoring_jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_candidates_recruiter_id", "candidates", ["recruiter_id"])
    op.create_index("ix_candidates_scoring_job_id", "candidates", ["scoring_job_id"])


def downgrade() -> None:
    op.drop_table("candidates")
    op.drop_table("scoring_jobs")
    op.drop_table("recruiters")
