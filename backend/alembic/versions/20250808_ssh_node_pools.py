"""
Add SSH node pools and nodes tables

Revision ID: 20250808_ssh_node_pools
Revises: 49f25e3e5c1d
Create Date: 2025-08-08 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20250808_ssh_node_pools"
down_revision: Union[str, Sequence[str], None] = "49f25e3e5c1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ssh_node_pools",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("default_user", sa.String(), nullable=True),
        sa.Column("identity_file_path", sa.Text(), nullable=True),
        sa.Column("password", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "ssh_nodes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("pool_id", sa.String(), nullable=False),
        sa.Column("ip", sa.String(), nullable=False),
        sa.Column("user", sa.String(), nullable=True),
        sa.Column("identity_file_path", sa.Text(), nullable=True),
        sa.Column("password", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["pool_id"], ["ssh_node_pools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pool_id", "ip", name="uq_ssh_nodes_pool_ip"),
    )


def downgrade() -> None:
    op.drop_table("ssh_nodes")
    op.drop_table("ssh_node_pools")
