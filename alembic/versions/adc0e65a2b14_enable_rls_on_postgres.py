"""enable_rls_on_postgres

Revision ID: adc0e65a2b14
Revises: adf3e12a8c40
Create Date: 2026-06-19 00:33:32.682400

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'adc0e65a2b14'
down_revision: Union[str, Sequence[str], None] = 'adf3e12a8c40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Enable RLS on core tables
        op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE projects ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE templates ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;")

        # Create policies
        # Users policy: user can view/update self, or if user is Admin
        op.execute("""
            CREATE POLICY user_self_policy ON users
            FOR ALL
            USING (id = current_setting('app.current_user_id', true) OR current_setting('app.user_role', true) = 'Admin');
        """)

        # Projects policy: creator of project or Admin
        op.execute("""
            CREATE POLICY project_owner_policy ON projects
            FOR ALL
            USING (created_by = current_setting('app.current_user_id', true) OR current_setting('app.user_role', true) = 'Admin');
        """)

        # Datasets policy: uploader of dataset or Admin
        op.execute("""
            CREATE POLICY dataset_owner_policy ON datasets
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true) OR current_setting('app.user_role', true) = 'Admin');
        """)

        # Templates policy: public templates, or templates created by the user, or Admin
        op.execute("""
            CREATE POLICY template_policy ON templates
            FOR ALL
            USING (is_public = 1 OR created_by = current_setting('app.current_user_id', true) OR current_setting('app.user_role', true) = 'Admin');
        """)

        # Notifications policy: owner of notification or Admin
        op.execute("""
            CREATE POLICY notification_owner_policy ON notifications
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true) OR current_setting('app.user_role', true) = 'Admin');
        """)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Drop policies
        op.execute("DROP POLICY IF EXISTS user_self_policy ON users;")
        op.execute("DROP POLICY IF EXISTS project_owner_policy ON projects;")
        op.execute("DROP POLICY IF EXISTS dataset_owner_policy ON datasets;")
        op.execute("DROP POLICY IF EXISTS template_policy ON templates;")
        op.execute("DROP POLICY IF EXISTS notification_owner_policy ON notifications;")

        # Disable RLS
        op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE projects DISABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE datasets DISABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE templates DISABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;")
