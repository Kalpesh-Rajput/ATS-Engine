"""Add review_status field to candidate records

Revision ID: 003_add_candidate_review_status
Revises: 9deb6265b1c4
Create Date: 2026-04-07 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_add_candidate_review_status'
down_revision = '9deb6265b1c4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'candidates',
        sa.Column('review_status', sa.String(length=20), nullable=False, server_default='in_process'),
    )


def downgrade() -> None:
    op.drop_column('candidates', 'review_status')
