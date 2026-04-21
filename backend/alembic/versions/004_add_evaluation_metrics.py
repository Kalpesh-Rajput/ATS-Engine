"""Add KPI and Fit Analysis metrics to candidate records

Revision ID: 004_add_evaluation_metrics
Revises: d323aee86632
Create Date: 2026-04-14 12:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '004_add_evaluation_metrics'
down_revision = 'd323aee86632'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # KPI Evaluation fields
    op.add_column('candidates', sa.Column('evaluation_breakdown', JSONB, nullable=True))
    op.add_column('candidates', sa.Column('kpi_validation', JSONB, nullable=True))
    
    # Fit Analysis fields
    op.add_column('candidates', sa.Column('compatibility_assessment', JSONB, nullable=True))
    op.add_column('candidates', sa.Column('fit_reasoning', JSONB, nullable=True))
    op.add_column('candidates', sa.Column('key_signals', JSONB, nullable=True))
    op.add_column('candidates', sa.Column('strengths', JSONB, nullable=True))
    op.add_column('candidates', sa.Column('gaps', JSONB, nullable=True))
    op.add_column('candidates', sa.Column('fit_validation', JSONB, nullable=True))
    op.add_column('candidates', sa.Column('fit_analysis_debug', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('candidates', 'fit_analysis_debug')
    op.drop_column('candidates', 'fit_validation')
    op.drop_column('candidates', 'gaps')
    op.drop_column('candidates', 'strengths')
    op.drop_column('candidates', 'key_signals')
    op.drop_column('candidates', 'fit_reasoning')
    op.drop_column('candidates', 'compatibility_assessment')
    op.drop_column('candidates', 'kpi_validation')
    op.drop_column('candidates', 'evaluation_breakdown')
