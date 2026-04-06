"""Compatibility bridge for previously referenced admin/audit revision.

Revision ID: 002_admin_analytics_audit
Revises: 001_initial
Create Date: 2026-04-06
"""
from alembic import op

revision = "002_admin_analytics_audit"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Historical environments may already contain audit/analytics tables from
    # an older migration iteration. Keep this revision as a no-op bridge so
    # Alembic can resolve the revision graph safely.
    pass


def downgrade() -> None:
    pass
