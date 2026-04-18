"""create_application_tables

Revision ID: c7c4f1f7c2f1
Revises: 5cb8a6f252e0
Create Date: 2026-04-18 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c7c4f1f7c2f1"
down_revision: Union[str, None] = "5cb8a6f252e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Import all model modules so they register their tables on the shared Base metadata
    from app.models import models  # noqa: F401
    from app.models import test_execution_models  # noqa: F401
    from app.core.database import Base

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app.models import models  # noqa: F401
    from app.models import test_execution_models  # noqa: F401
    from app.core.database import Base

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
