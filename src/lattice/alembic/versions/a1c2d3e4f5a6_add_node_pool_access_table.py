"""add node pool access table

Revision ID: a1c2d3e4f5a6
Revises: 35a822c2e6c2
Create Date: 2025-08-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = '35a822c2e6c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'node_pool_access',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('pool_key', sa.String(), nullable=False),
        sa.Column('allowed_team_ids', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'provider', 'pool_key', name='uq_node_pool_access_org_provider_key'),
    )


def downgrade() -> None:
    op.drop_table('node_pool_access')

