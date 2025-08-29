"""add cloud_accounts table

Revision ID: c1a2b3c4d5e6
Revises: e84717539e4c
Create Date: 2025-08-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e84717539e4c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    ts_default = "CURRENT_TIMESTAMP"
    op.create_table(
        "cloud_accounts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("credentials", sa.JSON(), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=True),
        sa.Column("max_instances", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text(ts_default), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text(ts_default), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "provider",
            "key",
            name="uq_cloud_accounts_org_provider_key",
        ),
    )
    # Supporting index for frequent filters
    op.create_index("ix_cloud_accounts_org_provider", "cloud_accounts", ["organization_id", "provider"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_cloud_accounts_org_provider", table_name="cloud_accounts")
    op.drop_table("cloud_accounts")
