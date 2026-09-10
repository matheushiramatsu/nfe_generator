"""Pure NF-e 4.00 mapping. The exported NFe intentionally has no digital signature."""

import secrets
from copy import deepcopy
from decimal import Decimal
from functools import lru_cache

from lxml import etree as E

from app.config import config
from app.domain.calculations import calculate, money
from app.domain.documents import digits
from app.domain.models import Invoice, Issue
from app.domain.validation import UF_CODES

NS = "http://www.portalfiscal.inf.br/nfe"
XS = "http://www.w3.org/2001/XMLSchema"
HOMOLOGATION_NAME = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"


def node(parent, name, value=None, **attrs):
    child = E.SubElement(parent, f"{{{NS}}}{name}", **attrs)
    if value is not None:
        child.text = format(value, "f") if isinstance(value, Decimal) else str(value)
    return child


def fields(parent, values):
    for key, value in values.items():
        if value is not None and value != "":
            node(parent, key, value)


def access_key(invoice, code):
    base = (
        UF_CODES[invoice.issuer.address.uf]
        + invoice.issued_at.strftime("%y%m")
        + digits(invoice.issuer.document)
        + invoice.model
        + f"{invoice.series:03}"
        + f"{invoice.number:09}"
        + invoice.emission_type
        + code
    )
    remainder = sum(int(char) * (2 + i % 8) for i, char in enumerate(reversed(base))) % 11
    return base + str(0 if remainder < 2 else 11 - remainder)


def party(parent, tag, value, issuer=False):
    el = node(parent, tag)
    doc = digits(value.document)
    fields(
        el, {"CNPJ" if len(doc) == 14 else "CPF": doc, "xNome": value.name if issuer else HOMOLOGATION_NAME}
    )
    if issuer and value.trade_name:
        node(el, "xFant", value.trade_name)
    a = value.address
    address = node(el, "enderEmit" if issuer else "enderDest")
    fields(
        address,
        {
            "xLgr": a.street,
            "nro": a.number,
            "xCpl": a.complement,
            "xBairro": a.district,
            "cMun": a.city_code,
            "xMun": a.city,
            "UF": a.uf,
            "CEP": digits(a.cep),
            "cPais": a.country_code,
            "xPais": a.country,
            "fone": digits(value.phone),
        },
    )
    if not issuer:
        node(el, "indIEDest", value.ie_indicator)
    fields(el, {"IE": value.ie if issuer or value.ie_indicator == "1" else None})
    if issuer:
        fields(el, {"IM": value.im, "CNAE": value.cnae, "CRT": value.crt})
    else:
        fields(el, {"email": value.email})


def tax_nodes(parent, item, computed):
    tax = item.taxes
    icms = node(parent, "ICMS")
    code = tax.icms_code
    if len(code) == 3:
        group = "ICMSSN102" if code in {"102", "103", "300", "400"} else "ICMSSN900"
    else:
        group = "ICMS40" if code in {"40", "41", "50"} else f"ICMS{code}"
    detail = node(icms, group)
    fields(detail, {"orig": item.origin, "CSOSN" if len(code) == 3 else "CST": code})
    if code in {"00", "20", "90", "900"}:
        fields(
            detail,
            {
                "modBC": "3",
                "pRedBC": tax.reduction.quantize(Decimal(".0000")) if code == "20" else None,
                "vBC": computed["icms_base"],
                "pICMS": tax.icms_rate.quantize(Decimal(".0000")),
                "vICMS": computed["icms"],
            },
        )
    ipi = node(parent, "IPI")
    node(ipi, "cEnq", tax.ipi_enquiry)
    taxable = tax.ipi.cst in {"00", "49", "50", "99"}
    group = node(ipi, "IPITrib" if taxable else "IPINT")
    node(group, "CST", tax.ipi.cst)
    if taxable:
        fields(
            group,
            {
                "vBC": computed["ipi_base"],
                "pIPI": tax.ipi.rate.quantize(Decimal(".0000")),
                "vIPI": computed["ipi"],
            },
        )
    for key in ("pis", "cofins"):
        t = getattr(tax, key)
        name = key.upper()
        group = node(node(parent, name), name + ("Aliq" if t.cst in {"01", "02"} else "NT"))
        node(group, "CST", t.cst)
        if t.cst in {"01", "02"}:
            fields(
                group,
                {
                    "vBC": computed[f"{key}_base"],
                    f"p{name}": t.rate.quantize(Decimal(".0000")),
                    f"v{name}": computed[key],
                },
            )


def generate_xml(invoice: Invoice) -> tuple[str, str]:
    code = f"{secrets.randbelow(100000000):08}"
    key = access_key(invoice, code)
    root = E.Element(f"{{{NS}}}NFe", nsmap={None: NS})
    info = node(root, "infNFe", Id="NFe" + key, versao=invoice.layout)
    ide = node(info, "ide")
    fields(
        ide,
        {
            "cUF": UF_CODES[invoice.issuer.address.uf],
            "cNF": code,
            "natOp": invoice.nature,
            "mod": invoice.model,
            "serie": invoice.series,
            "nNF": invoice.number,
            "dhEmi": invoice.issued_at.isoformat(timespec="seconds"),
            "dhSaiEnt": invoice.departure_at.isoformat(timespec="seconds") if invoice.departure_at else None,
            "tpNF": invoice.operation,
            "idDest": invoice.destination,
            "cMunFG": invoice.issuer.address.city_code,
            "tpImp": "1",
            "tpEmis": invoice.emission_type,
            "cDV": key[-1],
            "tpAmb": "2",
            "finNFe": invoice.purpose,
            "indFinal": invoice.final_consumer,
            "indPres": invoice.presence,
            "indIntermed": invoice.intermediary if invoice.presence not in {"0", "5"} else None,
            "procEmi": "0",
            "verProc": "nfe-lab-1.0",
        },
    )
    party(info, "emit", invoice.issuer, True)
    party(info, "dest", invoice.recipient)
    calculated = calculate(invoice)
    for i, (item, values) in enumerate(zip(invoice.items, calculated["items"], strict=True), 1):
        detail = node(info, "det", nItem=str(i))
        prod = node(detail, "prod")
        fields(
            prod,
            {
                "cProd": item.code,
                "cEAN": item.barcode or "SEM GTIN",
                "xProd": item.description,
                "NCM": item.ncm,
                "CEST": item.cest,
                "cBenef": item.benefit_code,
                "CFOP": item.cfop,
                "uCom": item.unit,
                "qCom": item.quantity.quantize(Decimal(".0001")),
                "vUnCom": item.unit_price.quantize(Decimal(".0000000001")),
                "vProd": values["products"],
                "cEANTrib": item.barcode or "SEM GTIN",
                "uTrib": item.taxable_unit,
                "qTrib": item.quantity.quantize(Decimal(".0001")),
                "vUnTrib": item.unit_price.quantize(Decimal(".0000000001")),
                "vFrete": money(item.freight) if item.freight else None,
                "vSeg": money(item.insurance) if item.insurance else None,
                "vDesc": money(item.discount) if item.discount else None,
                "vOutro": money(item.other) if item.other else None,
                "indTot": "1",
            },
        )
        tax_nodes(node(detail, "imposto"), item, values)
        fields(detail, {"infAdProd": item.additional_info})
    totals = node(node(info, "total"), "ICMSTot")
    t = calculated["totals"]
    fields(
        totals,
        {
            "vBC": t["icms_base"],
            "vICMS": t["icms"],
            "vICMSDeson": "0.00",
            "vFCP": t["fcp"],
            "vBCST": t["st_base"],
            "vST": t["st"],
            "vFCPST": "0.00",
            "vFCPSTRet": "0.00",
            "vProd": t["products"],
            "vFrete": t["freight"],
            "vSeg": t["insurance"],
            "vDesc": t["discount"],
            "vII": "0.00",
            "vIPI": t["ipi"],
            "vIPIDevol": "0.00",
            "vPIS": t["pis"],
            "vCOFINS": t["cofins"],
            "vOutro": t["other"],
            "vNF": t["total"],
        },
    )
    tr = invoice.transport
    transport = node(info, "transp")
    node(transport, "modFrete", tr.mode)
    if tr.name or tr.document:
        carrier = node(transport, "transporta")
        fields(
            carrier,
            {
                "CNPJ" if len(digits(tr.document)) == 14 else "CPF": digits(tr.document),
                "xNome": tr.name,
                "IE": tr.ie,
                "xEnder": tr.address,
                "xMun": tr.city,
                "UF": tr.uf,
            },
        )
    if tr.plate:
        fields(node(transport, "veicTransp"), {"placa": tr.plate, "UF": tr.plate_uf, "RNTC": tr.rntc})
    if tr.volume_quantity:
        fields(
            node(transport, "vol"),
            {
                "qVol": tr.volume_quantity,
                "esp": tr.species,
                "marca": tr.brand,
                "nVol": tr.numbering,
                "pesoL": tr.net_weight.quantize(Decimal(".001")),
                "pesoB": tr.gross_weight.quantize(Decimal(".001")),
            },
        )
    payments = node(info, "pag")
    for payment in invoice.payments:
        fields(
            node(payments, "detPag"),
            {
                "indPag": payment.indicator,
                "tPag": payment.method,
                "xPag": payment.description if payment.method == "99" else None,
                "vPag": money(payment.value),
            },
        )
    if invoice.additional_info:
        node(node(info, "infAdic"), "infCpl", invoice.additional_info)
    return E.tostring(root, encoding="utf-8", xml_declaration=True, pretty_print=True).decode(), key


@lru_cache(maxsize=1)
def payload_schema():
    """Expose official TNFe/infNFe as root without changing the official schema files.

    TNFe requires ds:Signature. The unsigned MVP validates exactly its infNFe
    declaration; full document signature/authorization validation is out of scope.
    """
    path = config.schema_directory / "leiauteNFe_v4.00.xsd"
    parser = E.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
    official = E.parse(str(path), parser)
    declaration = official.find(
        f'.//{{{XS}}}complexType[@name="TNFe"]/{{{XS}}}sequence/{{{XS}}}element[@name="infNFe"]'
    )
    wrapper = E.Element(
        f"{{{XS}}}schema", nsmap={"xs": XS, None: NS}, targetNamespace=NS, elementFormDefault="qualified"
    )
    E.SubElement(wrapper, f"{{{XS}}}include", schemaLocation=path.as_uri())
    payload = deepcopy(declaration)
    for constraint in payload.iter(f"{{{XS}}}unique"):
        constraint.set("name", "payload_" + constraint.get("name"))
    wrapper.append(payload)
    return E.XMLSchema(wrapper)


def validate_xml(xml: str) -> list[Issue]:
    parser = E.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
    if "<!DOCTYPE" in xml or "<!ENTITY" in xml:
        return [Issue(path="xml", message="DTD e entidades externas não são permitidas.")]
    try:
        root = E.fromstring(xml.encode(), parser)
    except E.XMLSyntaxError:
        return [Issue(path="xml", message="XML malformado.")]
    info = root.find(f"{{{NS}}}infNFe")
    if info is None:
        return [Issue(path="xml", message="Elemento infNFe não encontrado no namespace oficial.")]
    schema = payload_schema()
    try:
        schema.assertValid(info)
    except E.DocumentInvalid as exc:
        return [Issue(path="xml" + (e.path or ""), message=f"XSD: {e.message}") for e in exc.error_log]
    return []
