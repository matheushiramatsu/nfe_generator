"""Initial structured fiscal storage."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None


def upgrade():
    for name in ("issuers", "recipients", "products"):
        op.create_table(
            name,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("document", sa.String(20), nullable=False),
            sa.Column("data", sa.JSON, nullable=False),
        )
        op.create_index(f"ix_{name}_name", name, ["name"])
        op.create_index(f"ix_{name}_document", name, ["document"])
    op.create_table(
        "invoices",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("number", sa.Integer, nullable=True),
        sa.Column("series", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("issuer_document", sa.String(20), nullable=False),
        sa.Column("issuer_name", sa.String(120), nullable=False),
        sa.Column("recipient_name", sa.String(120), nullable=False),
        sa.Column("recipient_document", sa.String(20), nullable=False),
        sa.Column("total", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("generation_type", sa.String(20), nullable=False),
        sa.Column("header", sa.JSON, nullable=False),
        sa.Column("totals", sa.JSON, nullable=False),
        sa.Column("issues", sa.JSON, nullable=False),
        sa.Column("access_key", sa.String(44)),
        sa.Column("xml", sa.Text),
        sa.UniqueConstraint("issuer_document", "series", "number", name="uq_invoice_number"),
    )
    for column in (
        "number",
        "created_at",
        "issuer_document",
        "recipient_name",
        "recipient_document",
        "status",
        "generation_type",
    ):
        op.create_index(f"ix_invoices_{column}", "invoices", [column])
    for name in ("invoice_items", "invoice_payments", "invoice_transport", "invoice_tax"):
        op.create_table(
            name,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "invoice_id", sa.String(36), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("position", sa.Integer, nullable=False),
            sa.Column("data", sa.JSON, nullable=False),
        )
        op.create_index(f"ix_{name}_invoice_id", name, ["invoice_id"])
    op.create_table(
        "application_settings",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("data", sa.JSON, nullable=False),
    )
    op.create_table(
        "invoice_sequences",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("value", sa.Integer, nullable=False),
    )


def downgrade():
    for name in (
        "invoice_sequences",
        "application_settings",
        "invoice_tax",
        "invoice_transport",
        "invoice_payments",
        "invoice_items",
        "invoices",
        "products",
        "recipients",
        "issuers",
    ):
        op.drop_table(name)
