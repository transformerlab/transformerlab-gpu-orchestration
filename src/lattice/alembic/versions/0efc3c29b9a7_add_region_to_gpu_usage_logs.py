"""add_region_to_gpu_usage_logs

Revision ID: 0efc3c29b9a7
Revises: 6540e0d327b3
Create Date: 2025-08-26 13:06:27.249724

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0efc3c29b9a7"
down_revision: Union[str, Sequence[str], None] = "6540e0d327b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("gpu_usage_logs", sa.Column("region", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("gpu_usage_logs", "region")
