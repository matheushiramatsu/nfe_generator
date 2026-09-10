from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.domain.documents import digits
from app.domain.models import Invoice, Settings
from app.persistence.database import (
    ApplicationSettings,
    InvoiceItem,
    InvoicePayment,
    InvoiceRecord,
    InvoiceSequence,
    InvoiceTax,
    InvoiceTransport,
)


def read_settings(session):
    row = session.get(ApplicationSettings, "default")
    return Settings.model_validate(row.data) if row else Settings()


def next_number(session, invoice):
    key = f"{digits(invoice.issuer.document)}-{invoice.series}"
    insert = sqlite_insert if session.bind.dialect.name == "sqlite" else pg_insert
    maximum = (
        session.scalar(
            select(func.max(InvoiceRecord.number)).where(
                InvoiceRecord.issuer_document == digits(invoice.issuer.document),
                InvoiceRecord.series == invoice.series,
            )
        )
        or 0
    )
    stmt = insert(InvoiceSequence).values(id=key, value=maximum + 1)
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"], set_={"value": InvoiceSequence.value + 1}
    ).returning(InvoiceSequence.value)
    value = session.scalar(stmt)
    if value <= maximum:
        row = session.get(InvoiceSequence, key)
        row.value = maximum + 1
        value = row.value
        session.flush()
    return value


def save_invoice(session, invoice, calculations, issues, xml=None, access_key=None):
    data = invoice.model_dump(mode="json")
    items = data.pop("items")
    payments = data.pop("payments")
    transport = data.pop("transport")
    record = InvoiceRecord(
        number=invoice.number if xml else None,
        series=invoice.series,
        issuer_document=digits(invoice.issuer.document),
        issuer_name=invoice.issuer.name,
        recipient_name=invoice.recipient.name,
        recipient_document=digits(invoice.recipient.document),
        total=calculations["totals"]["total"],
        status="generated" if xml else "validation_error",
        generation_type=invoice.generation_type,
        header=data,
        totals={k: str(v) for k, v in calculations["totals"].items()},
        issues=[i.model_dump() for i in issues],
        xml=xml,
        access_key=access_key,
    )
    for pos, item in enumerate(items):
        record.taxes.append(InvoiceTax(position=pos, data=item.pop("taxes")))
        record.items.append(InvoiceItem(position=pos, data=item))
    record.payments = [InvoicePayment(position=i, data=p) for i, p in enumerate(payments)]
    record.transport = InvoiceTransport(data=transport)
    session.add(record)
    session.flush()
    return record


def invoice_payload(record) -> Invoice:
    data = {
        **record.header,
        "items": [
            {**item.data, "taxes": tax.data} for item, tax in zip(record.items, record.taxes, strict=True)
        ],
        "payments": [p.data for p in record.payments],
        "transport": record.transport.data,
    }
    return Invoice.model_validate(data)


def summary(record):
    return {
        k: getattr(record, k)
        for k in (
            "id",
            "number",
            "series",
            "created_at",
            "issuer_name",
            "issuer_document",
            "recipient_name",
            "recipient_document",
            "total",
            "status",
            "generation_type",
            "access_key",
        )
    } | {"item_count": len(record.items)}
