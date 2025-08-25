"""merge 75d8a7f5933a and e4babaf49c7d

Revision ID: 6aa5accea438
Revises: 75d8a7f5933a, e4babaf49c7d
Create Date: 2025-08-22 09:22:08.658580

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = '6aa5accea438'
down_revision: Union[str, Sequence[str], None] = ('75d8a7f5933a', 'e4babaf49c7d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
