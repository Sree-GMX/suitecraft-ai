"""drop_global_release_version_uniqueness

Revision ID: 9f6d1b2c4a7e
Revises: c7c4f1f7c2f1
Create Date: 2026-04-18 19:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f6d1b2c4a7e"
down_revision: Union[str, None] = "c7c4f1f7c2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for constraint in inspector.get_unique_constraints("releases"):
        column_names = constraint.get("column_names") or []
        if column_names == ["release_version"] and constraint.get("name"):
            with op.batch_alter_table("releases") as batch_op:
                batch_op.drop_constraint(constraint["name"], type_="unique")

    for index in inspector.get_indexes("releases"):
        column_names = index.get("column_names") or []
        if column_names == ["release_version"] and index.get("unique") and index.get("name"):
            op.drop_index(index["name"], table_name="releases")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_unique_index = any(
        index.get("column_names") == ["release_version"] and index.get("unique")
        for index in inspector.get_indexes("releases")
    )

    if not existing_unique_index:
        op.create_index(
            "uq_releases_release_version",
            "releases",
            ["release_version"],
            unique=True,
        )
