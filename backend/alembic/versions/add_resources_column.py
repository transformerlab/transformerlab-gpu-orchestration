"""
Add resources column to SSH tables

Revision ID: add_resources_column
Revises: 20250808_ssh_node_pools
Create Date: 2025-01-27 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "add_resources_column"
down_revision: Union[str, Sequence[str], None] = "20250808_ssh_node_pools"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add resources column to ssh_node_pools table
    op.add_column("ssh_node_pools", sa.Column("resources", sa.JSON(), nullable=True))
    
    # Add resources column to ssh_nodes table
    op.add_column("ssh_nodes", sa.Column("resources", sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove resources column from ssh_nodes table
    op.drop_column("ssh_nodes", "resources")
    
    # Remove resources column from ssh_node_pools table
    op.drop_column("ssh_node_pools", "resources") 