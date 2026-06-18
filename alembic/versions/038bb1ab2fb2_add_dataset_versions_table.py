"""add_dataset_versions_table

Revision ID: 038bb1ab2fb2
Revises: 3ffb616baf27
Create Date: 2025-10-26 21:37:47.041063

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '038bb1ab2fb2'
down_revision: Union[str, Sequence[str], None] = '3ffb616baf27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create dataset_versions table
    op.create_table('dataset_versions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('dataset_id', sa.String(), sa.ForeignKey('datasets.id'), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('storage_key', sa.String(), nullable=False),
        sa.Column('operation', sa.String(), nullable=False),  # 'clean', 'transform', etc.
        sa.Column('changes_summary', sa.Text(), nullable=True),
        sa.Column('rows_before', sa.Integer(), nullable=True),
        sa.Column('cols_before', sa.Integer(), nullable=True),
        sa.Column('rows_after', sa.Integer(), nullable=True),
        sa.Column('cols_after', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Add index on dataset_id for faster queries
    op.create_index('ix_dataset_versions_dataset_id', 'dataset_versions', ['dataset_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop index
    op.drop_index('ix_dataset_versions_dataset_id', table_name='dataset_versions')

    # Drop table
    op.drop_table('dataset_versions')
