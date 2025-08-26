"""merge heads

Revision ID: dd350b38dd08
Revises: 01b0bb95d722, e80ab25ad8a7
Create Date: 2025-08-26 16:59:08.010750

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = 'dd350b38dd08'
down_revision: Union[str, Sequence[str], None] = ('01b0bb95d722', 'e80ab25ad8a7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
