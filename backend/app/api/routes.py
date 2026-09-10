import logging
from datetime import timedelta
from decimal import Decimal
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.domain.calculations import calculate
from app.domain.documents import digits
from app.domain.models import AutomationOptions, Invoice, Party, Product, Settings, now
from app.domain.validation import UF_CODES, validate, validate_party
from app.persistence.database import ApplicationSettings, InvoiceRecord, Issuer, Recipient, get_session
from app.persistence.database import Product as ProductRow
from app.persistence.repositories import invoice_payload, next_number, read_settings, save_invoice, summary
from app.services.automation import fake_party, fake_product, generate_random
from app.services.xml import generate_xml, validate_xml

router = APIRouter(prefix="/api")
DB = Annotated[Session, Depends(get_session)]
logger = logging.getLogger("nfe.invoices")


def get_invoice(session, id):
    row = session.get(InvoiceRecord, id)
    if not row:
        raise HTTPException(404, "NF-e não encontrada.")
    return row


def catalog_routes(name, row_type, dto):
    def listing(db: DB, q: str = ""):
        stmt = select(row_type)
        if q:
            stmt = stmt.where(
                or_(row_type.name.ilike(f"%{q}%"), row_type.document.ilike(f"%{digits(q) or q}%"))
            )
        return [row.data | {"id": row.id} for row in db.scalars(stmt.order_by(row_type.name))]

    def save(value, db, id=None):
        if isinstance(value, Party):
            issues = validate_party(value, name, name == "issuers")
            if issues:
                raise HTTPException(422, [i.model_dump() for i in issues])
        else:
            if not value.code or not value.description or len(value.ncm) != 8 or not value.ncm.isdigit():
                raise HTTPException(
                    422,
                    [
                        {
                            "path": "ncm",
                            "message": "Preencha código, descrição e NCM com 8 números.",
                            "severity": "error",
                        }
                    ],
                )
        row = db.get(row_type, id) if id else row_type()
        if id and not row:
            raise HTTPException(404, "Cadastro não encontrado.")
        if name == "issuers" and value.is_default:
            for other in db.scalars(select(row_type)):
                other.data = other.data | {"is_default": False}
        row.name = value.name if isinstance(value, Party) else value.description
        row.document = digits(value.document) if isinstance(value, Party) else value.code
        row.data = value.model_dump(mode="json", exclude={"id"})
        db.add(row)
        db.commit()
        return row.data | {"id": row.id}

    def create(value: dto, db: DB):
        return save(value, db)

    def update(id: str, value: dto, db: DB):
        return save(value, db, id)

    def delete(id: str, db: DB):
        row = db.get(row_type, id)
        if not row:
            raise HTTPException(404, "Cadastro não encontrado.")
        db.delete(row)
        db.commit()
        return {"deleted": True}

    for path, endpoint, method in [
        ("", listing, "GET"),
        ("", create, "POST"),
        ("/{id}", update, "PUT"),
        ("/{id}", delete, "DELETE"),
    ]:
        router.add_api_route(
            "/" + name + path, endpoint, methods=[method], tags=[name], name=name + "_" + endpoint.__name__
        )


catalog_routes("issuers", Issuer, Party)
catalog_routes("recipients", Recipient, Party)
catalog_routes("products", ProductRow, Product)


@router.get("/health", tags=["system"])
def health(db: DB):
    db.execute(select(1))
    return {
        "status": "ok",
        "environment": "homologation",
        "layout": "4.00",
        "schema": "PL_010f_v1.04",
        "xsd_scope": "infNFe",
    }


@router.get("/templates", tags=["settings"])
def templates(db: DB):
    settings = read_settings(db)
    party = Party(crt=settings.crt)
    party.address.uf = settings.uf
    product = Product(cfop=settings.cfop)
    if settings.crt in {"2", "3"}:
        product.taxes.icms_code = "00"
    return {
        "party": party,
        "product": product,
        "invoice": Invoice(
            issuer=party,
            recipient=party.model_copy(deep=True),
            series=settings.series,
            nature=settings.nature,
        ),
    }


@router.get("/settings", tags=["settings"])
def settings(db: DB):
    return read_settings(db)


@router.put("/settings", tags=["settings"])
def update_settings(value: Settings, db: DB):
    if (
        value.uf not in UF_CODES
        or len(value.cfop) != 4
        or not value.cfop.isdigit()
        or value.cfop[0] not in "56"
        or not value.nature
    ):
        raise HTTPException(422, "Informe UF, natureza da operação e CFOP de saída válidos.")
    row = db.get(ApplicationSettings, "default") or ApplicationSettings(id="default")
    if (
        value.automation.min_products > value.automation.max_products
        or value.automation.min_value > value.automation.max_value
    ):
        raise HTTPException(422, "Limites mínimos não podem superar os máximos.")
    row.data = value.model_dump(mode="json")
    db.add(row)
    db.commit()
    return value


@router.get("/addresses/{cep}", tags=["external"])
async def address(cep: str):
    cep = digits(cep)
    if len(cep) != 8:
        raise HTTPException(422, "CEP deve possuir 8 números.")
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            response = await client.get(f"https://viacep.com.br/ws/{cep}/json/")
            response.raise_for_status()
            value = response.json()
        if value.get("erro"):
            raise HTTPException(404, "CEP não encontrado; preencha o endereço manualmente.")
        return {
            "cep": cep,
            "street": value["logradouro"],
            "district": value["bairro"],
            "city": value["localidade"],
            "city_code": value["ibge"],
            "uf": value["uf"],
        }
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(
            502, "Consulta de CEP indisponível. Você pode preencher o endereço manualmente."
        ) from None


@router.post("/test-data", tags=["automation"])
def test_data(db: DB):
    # Explicit, repeatable action; no fictitious catalog is created at startup.
    for row_type, values in [
        (Issuer, [fake_party(True)]),
        (Recipient, [fake_party(), fake_party()]),
        (ProductRow, [fake_product() for _ in range(4)]),
    ]:
        for value in values:
            row = row_type(
                name=value.name if isinstance(value, Party) else value.description,
                document=value.document if isinstance(value, Party) else value.code,
                data=value.model_dump(mode="json", exclude={"id"}),
            )
            db.add(row)
    db.commit()
    return {"message": "1 emitente, 2 destinatários e 4 produtos fictícios cadastrados."}


@router.post("/invoices/calculate", tags=["invoices"])
def calculate_invoice(value: Invoice):
    return calculate(value)


@router.post("/invoices/validate", tags=["invoices"])
def validate_invoice(value: Invoice):
    issues = validate(value)
    if not any(i.severity == "error" for i in issues):
        draft = value.model_copy(deep=True)
        draft.number = draft.number or 1
        xml, _ = generate_xml(draft)
        issues.extend(validate_xml(xml))
    return {
        "valid": not any(i.severity == "error" for i in issues),
        "issues": issues,
        **calculate(value),
        "xsd_scope": "infNFe",
    }


@router.post("/invoices/generate-random", tags=["automation"])
def random_invoice(value: AutomationOptions, db: DB):
    try:
        invoice = generate_random(
            value,
            [Party.model_validate(r.data) for r in db.scalars(select(Issuer))],
            [Party.model_validate(r.data) for r in db.scalars(select(Recipient))],
            [Product.model_validate(r.data) for r in db.scalars(select(ProductRow))],
            read_settings(db),
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from None
    issues = validate(invoice)
    if any(i.severity == "error" for i in issues):
        raise HTTPException(422, [i.model_dump() for i in issues if i.severity == "error"])
    return invoice


@router.post("/invoices", tags=["invoices"])
@router.post("/invoices/generate", tags=["invoices"])
def create_invoice(value: Invoice, db: DB):
    issues = validate(value)
    values = calculate(value)
    xml, key = None, None
    if not any(i.severity == "error" for i in issues):
        value.number = value.number or next_number(db, value)
        xml, key = generate_xml(value)
        issues.extend(validate_xml(xml))
        if any(i.severity == "error" for i in issues):
            xml, key = None, None
    try:
        row = save_invoice(db, value, values, issues, xml, key)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409,
            "Este número/série já foi utilizado pelo emitente. Deixe o número vazio para numeração automática.",
        ) from None
    logger.info(
        "invoice_generated" if xml else "invoice_validation_failed",
        extra={"invoice_id": row.id, "operation": "generate", "status": row.status},
    )
    result = summary(row) | {
        "issues": row.issues,
        "invoice": invoice_payload(row),
        "xml": row.xml,
        "totals": row.totals,
    }
    if not xml:
        from fastapi.encoders import jsonable_encoder
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=422, content=jsonable_encoder({"detail": row.issues, "record_id": row.id})
        )
    return result


@router.get("/invoices", tags=["invoices"])
def list_invoices(
    db: DB,
    q: str = "",
    status: str = "",
    generation_type: str = "",
    issuer: str = "",
    recipient: str = "",
    series: int | None = None,
    start: str = "",
    end: str = "",
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    stmt = select(InvoiceRecord).options(selectinload(InvoiceRecord.items))
    if q:
        conditions = [
            InvoiceRecord.recipient_name.ilike(f"%{q}%"),
            InvoiceRecord.recipient_document.ilike(f"%{digits(q) or q}%"),
            InvoiceRecord.issuer_name.ilike(f"%{q}%"),
        ]
        if q.isdigit():
            conditions.append(InvoiceRecord.number == int(q))
        stmt = stmt.where(or_(*conditions))
    for field, value in [
        ("status", status),
        ("generation_type", generation_type),
        ("issuer_document", issuer),
        ("recipient_document", recipient),
        ("series", series),
    ]:
        if value != "" and value is not None:
            stmt = stmt.where(getattr(InvoiceRecord, field) == value)
    from datetime import datetime

    try:
        if start:
            stmt = stmt.where(InvoiceRecord.created_at >= datetime.fromisoformat(start))
        if end:
            stmt = stmt.where(InvoiceRecord.created_at < datetime.fromisoformat(end) + timedelta(days=1))
    except ValueError:
        raise HTTPException(422, "Informe datas no formato AAAA-MM-DD.") from None
    count = db.scalar(select(func.count()).select_from(stmt.subquery()))
    return {
        "items": [
            summary(row)
            for row in db.scalars(stmt.order_by(InvoiceRecord.created_at.desc()).offset(offset).limit(limit))
        ],
        "total": count,
    }


@router.get("/invoices/{id}", tags=["invoices"])
def detail(id: str, db: DB):
    row = get_invoice(db, id)
    return summary(row) | {
        "invoice": invoice_payload(row),
        "xml": row.xml,
        "issues": row.issues,
        "totals": row.totals,
    }


@router.post("/invoices/{id}/duplicate", tags=["invoices"])
def duplicate(id: str, db: DB):
    value = invoice_payload(get_invoice(db, id)).model_copy(deep=True)
    value.number = None
    value.issued_at = now()
    value.departure_at = None
    value.generation_type = "manual"
    return value


@router.delete("/invoices/{id}", tags=["invoices"])
def delete_invoice(id: str, db: DB):
    db.delete(get_invoice(db, id))
    db.commit()
    return {"deleted": True}


@router.get("/invoices/{id}/xml", tags=["exports"])
def export_xml(id: str, db: DB):
    row = get_invoice(db, id)
    if not row.xml:
        raise HTTPException(409, "Esta nota tem erros de validação e não possui XML.")
    return Response(
        row.xml,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="NFe-HOM-{row.access_key}.xml"'},
    )


@router.get("/invoices/{id}/json", tags=["exports"])
def export_json(id: str, db: DB):
    row = get_invoice(db, id)
    return Response(
        invoice_payload(row).model_dump_json(indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="NFe-HOM-{row.number or row.id}.json"'},
    )


@router.get("/dashboard", tags=["dashboard"])
def dashboard(db: DB):
    today = now().replace(hour=0, minute=0, second=0, microsecond=0)

    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    recent = db.scalars(
        select(InvoiceRecord)
        .options(selectinload(InvoiceRecord.items))
        .order_by(InvoiceRecord.created_at.desc())
        .limit(6)
    )
    generated = InvoiceRecord.status == "generated"
    return {
        "today": count(InvoiceRecord, generated, InvoiceRecord.created_at >= today),
        "month": count(InvoiceRecord, generated, InvoiceRecord.created_at >= today.replace(day=1)),
        "errors": count(InvoiceRecord, InvoiceRecord.status == "validation_error"),
        "recipients": count(Recipient),
        "products": count(ProductRow),
        "issuers": count(Issuer),
        "recent": [summary(r) for r in recent],
        "month_total": db.scalar(
            select(func.coalesce(func.sum(InvoiceRecord.total), Decimal(0))).where(
                generated, InvoiceRecord.created_at >= today.replace(day=1)
            )
        ),
    }
