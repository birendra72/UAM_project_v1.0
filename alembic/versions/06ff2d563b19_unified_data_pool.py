"""unified_data_pool

Revision ID: 06ff2d563b19
Revises: 700f2c757832
Create Date: 2025-10-22 23:56:17.275009

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '06ff2d563b19'
down_revision: Union[str, Sequence[str], None] = '700f2c757832'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create project_dataset linking table first
    op.create_table('project_datasets',
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('dataset_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ),
        sa.PrimaryKeyConstraint('project_id', 'dataset_id')
    )

    # For PostgreSQL, we need to handle the migration differently
    # Check if project_id column exists and migrate data
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('datasets')]

    if 'project_id' in columns:
        # Migrate existing data: link all datasets to their current projects
        op.execute("""
            INSERT INTO project_datasets (project_id, dataset_id)
            SELECT project_id, id FROM datasets WHERE project_id IS NOT NULL
        """)

        # Drop the project_id column from datasets table
        op.drop_constraint('datasets_project_id_fkey', 'datasets', type_='foreignkey')
        op.drop_column('datasets', 'project_id')


def downgrade() -> None:
    """Downgrade schema."""
    # Add back project_id to datasets table
    op.add_column('datasets', sa.Column('project_id', sa.String(), nullable=True))
    op.create_foreign_key('datasets_project_id_fkey', 'datasets', 'projects', ['project_id'], ['id'])

    # Drop project_dataset linking table
    op.drop_table('project_datasets')
