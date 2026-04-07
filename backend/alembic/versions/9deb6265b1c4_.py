"""empty message

Revision ID: 9deb6265b1c4
Revises: 002_jd_preprocess_cache, 002_recruiter_profile_fields
Create Date: 2026-04-07 14:24:31.930327

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9deb6265b1c4'
down_revision: Union[str, None] = ('002_jd_preprocess_cache', '002_recruiter_profile_fields')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    pass


def downgrade() -> None:
    pass