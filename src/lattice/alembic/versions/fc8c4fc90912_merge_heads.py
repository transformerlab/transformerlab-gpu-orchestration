"""Merge heads

Revision ID: fc8c4fc90912
Revises: 270d23c5a6bf, c1a2b3c4d5e6
Create Date: 2025-08-29 14:39:03.501741

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc8c4fc90912'
down_revision: Union[str, Sequence[str], None] = ('270d23c5a6bf', 'c1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
