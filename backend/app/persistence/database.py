import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

from app.config import config
from app.domain.models import now


class Base(DeclarativeBase):
    pass


def uid():
    return str(uuid.uuid4())


class CatalogMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120), index=True)
    document: Mapped[str] = mapped_column(String(20), index=True, default="")
    data: Mapped[dict] = mapped_column(JSON)


class Issuer(CatalogMixin, Base):
    __tablename__ = "issuers"


class Recipient(CatalogMixin, Base):
    __tablename__ = "recipients"


class Product(CatalogMixin, Base):
    __tablename__ = "products"


class InvoiceRecord(Base):
    __tablename__ = "invoices"
    __table_args__ = (UniqueConstraint("issuer_document", "series", "number", name="uq_invoice_number"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    number: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    series: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    issuer_document: Mapped[str] = mapped_column(String(20), index=True)
    issuer_name: Mapped[str] = mapped_column(String(120))
    recipient_name: Mapped[str] = mapped_column(String(120), index=True)
    recipient_document: Mapped[str] = mapped_column(String(20), index=True)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    status: Mapped[str] = mapped_column(String(30), index=True)
    generation_type: Mapped[str] = mapped_column(String(20), index=True)
    header: Mapped[dict] = mapped_column(JSON)
    totals: Mapped[dict] = mapped_column(JSON)
    issues: Mapped[list] = mapped_column(JSON)
    access_key: Mapped[str | None] = mapped_column(String(44), nullable=True)
    xml: Mapped[str | None] = mapped_column(Text, nullable=True)
    items: Mapped[list["InvoiceItem"]] = relationship(
        cascade="all, delete-orphan", order_by="InvoiceItem.position"
    )
    payments: Mapped[list["InvoicePayment"]] = relationship(
        cascade="all, delete-orphan", order_by="InvoicePayment.position"
    )
    transport: Mapped["InvoiceTransport"] = relationship(cascade="all, delete-orphan", uselist=False)
    taxes: Mapped[list["InvoiceTax"]] = relationship(
        cascade="all, delete-orphan", order_by="InvoiceTax.position"
    )


class ChildMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[dict] = mapped_column(JSON)


class InvoiceItem(ChildMixin, Base):
    __tablename__ = "invoice_items"


class InvoicePayment(ChildMixin, Base):
    __tablename__ = "invoice_payments"


class InvoiceTransport(ChildMixin, Base):
    __tablename__ = "invoice_transport"


class InvoiceTax(ChildMixin, Base):
    __tablename__ = "invoice_tax"


class ApplicationSettings(Base):
    __tablename__ = "application_settings"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)


class InvoiceSequence(Base):
    __tablename__ = "invoice_sequences"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[int] = mapped_column(Integer)


engine = create_engine(
    config.database_url,
    connect_args={"check_same_thread": False} if config.database_url.startswith("sqlite") else {},
    pool_pre_ping=True,
)
if config.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def sqlite_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session():
    with SessionLocal() as session:
        yield session
