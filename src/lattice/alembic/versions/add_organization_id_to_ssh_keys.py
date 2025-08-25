"""add_organization_id_to_ssh_keys

Revision ID: add_org_id_to_ssh_keys
Revises: 11fc8dbff96c
Create Date: 2025-08-25 11:55:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_org_id_to_ssh_keys"
down_revision: Union[str, Sequence[str], None] = "11fc8dbff96c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Use batch operations for SQLite compatibility
    with op.batch_alter_table("ssh_keys") as batch_op:
        # Add organization_id column to ssh_keys table
        batch_op.add_column(sa.Column("organization_id", sa.String(), nullable=True))
        
        # Drop the old unique constraint
        batch_op.drop_constraint("uq_ssh_keys_user_name", type_="unique")
        
        # Add the new unique constraint that includes organization_id
        batch_op.create_unique_constraint(
            "uq_ssh_keys_org_user_name", ["organization_id", "user_id", "name"]
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Use batch operations for SQLite compatibility
    with op.batch_alter_table("ssh_keys") as batch_op:
        # Drop the new unique constraint
        batch_op.drop_constraint("uq_ssh_keys_org_user_name", type_="unique")
        
        # Add back the old unique constraint
        batch_op.create_unique_constraint(
            "uq_ssh_keys_user_name", ["user_id", "name"]
        )
        
        # Drop the organization_id column
        batch_op.drop_column("organization_id")
