from decimal import Decimal

import pytest
from lxml import etree
from pydantic import ValidationError

from app.domain.calculations import calculate, calculate_item
from app.domain.documents import fake_document, valid_document
from app.domain.models import AutomationOptions, Contribution, Invoice, Item, Settings, Taxes
from app.domain.validation import validate
from app.services.automation import generate_random
from app.services.xml import NS, generate_xml, validate_xml


@pytest.mark.parametrize(
    "document,expected",
    [
        ("52998224725", True),
        ("04.252.011/0001-10", True),
        ("11111111111", False),
        ("00000000000000", False),
        ("52998224724", False),
        ("", False),
    ],
)
def test_documents(document, expected):
    assert valid_document(document) == expected


@pytest.mark.parametrize("company", [True, False])
def test_generated_documents(company):
    for _ in range(50):
        document = fake_document(company)
        assert valid_document(document)
        assert len(document) == (14 if company else 11)


def test_rounding_and_item_tax_totals():
    item = Item(
        quantity="3",
        unit_price="10.005",
        discount="1",
        freight="2",
        insurance="1",
        other="3",
        taxes=Taxes(
            icms_code="00",
            icms_rate="18",
            ipi=Contribution(cst="50", rate="10"),
            pis=Contribution(cst="01", rate="1.65"),
            cofins=Contribution(cst="01", rate="7.6"),
        ),
    )
    values = calculate_item(item)
    assert values["products"] == Decimal("30.02")
    assert values["icms_base"] == Decimal("35.02")
    assert values["icms"] == Decimal("6.30")
    assert values["ipi"] == Decimal("3.50")
    assert values["pis"] == Decimal(".58")
    assert values["cofins"] == Decimal("2.66")
    assert values["total"] == Decimal("38.52")


def test_manual_override():
    value = calculate_item(
        Item(unit_price="100", taxes=Taxes(icms_code="00", icms_base="50", icms_rate="18", icms_value="7.77"))
    )
    assert value["icms"] == Decimal("7.77")
    assert value["icms_base"] == Decimal("50")


def test_independent_invoice_serialization(invoice):
    clone = Invoice.model_validate_json(invoice.model_dump_json())
    clone.recipient.name = "OUTRO NOME DE TESTE"
    clone.items[0].quantity = Decimal("10")
    assert invoice.recipient.name != clone.recipient.name
    assert invoice.items[0].quantity != clone.items[0].quantity
    assert calculate(invoice)["totals"]["total"] == Decimal("100.00")


def test_xml_official_payload_schema_and_escaping(invoice):
    invoice.items[0].description = "TESTE <ABC> & CADERNO"
    xml, key = generate_xml(invoice)
    assert len(key) == 44 and key.isdigit()
    assert "&lt;ABC&gt; &amp;" in xml
    assert not validate_xml(xml)
    parsed = etree.fromstring(xml.encode())
    assert parsed.find(f".//{{{NS}}}tpAmb").text == "2"
    assert (
        parsed.find(f".//{{{NS}}}dest/{{{NS}}}xNome").text
        == "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
    )
    assert parsed.find(f".//{{{NS}}}vNF").text == "100.00"
    assert parsed.find("{http://www.w3.org/2000/09/xmldsig#}Signature") is None


@pytest.mark.parametrize(
    "crt,code",
    [
        ("1", "102"),
        ("1", "103"),
        ("1", "300"),
        ("1", "400"),
        ("1", "900"),
        ("3", "00"),
        ("3", "20"),
        ("3", "40"),
        ("3", "41"),
        ("3", "50"),
        ("3", "90"),
    ],
)
def test_supported_icms_schema(invoice, crt, code):
    invoice.issuer.crt = crt
    for item in invoice.items:
        item.taxes.icms_code = code
    assert not [i for i in validate(invoice) if i.severity == "error"]
    assert not validate_xml(generate_xml(invoice)[0])


def test_schema_rejects_bad_ncm(invoice):
    invoice.items[0].ncm = "123"
    assert any(i.path == "items.0.ncm" for i in validate(invoice))
    assert validate_xml(generate_xml(invoice)[0])


def test_external_entities_blocked():
    assert (
        validate_xml('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>')[0].severity
        == "error"
    )


def test_cross_field_validation(invoice):
    invoice.payments[0].value = Decimal("1")
    invoice.items[0].cfop = "6102"
    invoice.items[0].taxes.icms_code = "00"
    paths = {i.path for i in validate(invoice) if i.severity == "error"}
    assert {"payments", "items.0.cfop", "items.0.taxes.icms_code"} <= paths


@pytest.mark.parametrize(
    "change", [{"environment": "1"}, {"layout": "3.10"}, {"model": "65"}, {"emission_type": "9"}]
)
def test_homologation_only(invoice, change):
    with pytest.raises(ValidationError):
        Invoice.model_validate(invoice.model_dump() | change)


def test_random_bounds_and_catalog_immutability(invoice):
    products = [
        item.model_dump(exclude={"quantity", "discount", "freight", "insurance", "other"})
        for item in invoice.items
    ]
    from app.domain.models import Product

    catalog = [Product.model_validate(p) for p in products]
    before = [p.model_dump_json() for p in catalog]
    for _ in range(25):
        value = generate_random(
            AutomationOptions(
                min_products=2, max_products=2, min_value="40.21", max_value="40.21", existing_only=True
            ),
            [invoice.issuer],
            [invoice.recipient],
            catalog,
            Settings(),
        )
        assert len(value.items) == 2
        assert calculate(value)["totals"]["total"] == Decimal("40.21")
        value.number = 1
        assert not validate_xml(generate_xml(value)[0])
    assert before == [p.model_dump_json() for p in catalog]


@pytest.mark.parametrize(
    "options",
    [
        AutomationOptions(existing_only=True),
        AutomationOptions(min_products=3, max_products=1),
        AutomationOptions(min_value="1000", max_value="1"),
    ],
)
def test_random_rejects_unfulfillable_constraints(options):
    with pytest.raises(ValueError):
        generate_random(options, [], [], [], Settings())


@pytest.mark.parametrize("code", ["00", "20", "90"])
def test_nonzero_taxes_xml(invoice, code):
    invoice.issuer.crt = "3"
    for item in invoice.items:
        item.taxes = Taxes(
            icms_code=code,
            icms_rate="18.125",
            reduction="10" if code == "20" else "0",
            ipi=Contribution(cst="50", rate="10"),
            pis=Contribution(cst="01", rate="1.65"),
            cofins=Contribution(cst="01", rate="7.6"),
        )
    invoice.payments[0].value = calculate(invoice)["totals"]["total"]
    xml, _ = generate_xml(invoice)
    assert not validate_xml(xml)
    assert "<pICMS>18.1250</pICMS>" in xml
    assert not [i for i in validate(invoice) if i.severity == "error"]


def test_cpf_transport_and_payment_schema(invoice):
    from app.domain.models import Transport

    invoice.recipient.person_type = "PF"
    invoice.recipient.document = fake_document(False)
    invoice.transport = Transport(
        mode="0",
        name="TRANSPORTADORA FICTICIA DE TESTE",
        document=fake_document(),
        address="RUA DE TESTE",
        city="SAO PAULO",
        uf="SP",
        plate="ABC1D23",
        plate_uf="SP",
        volume_quantity=1,
        species="CAIXA",
        net_weight="1.125",
        gross_weight="1.500",
    )
    invoice.payments[0].method = "99"
    invoice.payments[0].description = "PAGAMENTO DE TESTE"
    assert not validate_xml(generate_xml(invoice)[0])


@pytest.mark.parametrize("xml", ["not-xml", "<root/>"])
def test_bad_xml_is_a_validation_error(xml):
    assert validate_xml(xml)[0].severity == "error"


def test_decimal_precision_and_xml_control_characters():
    with pytest.raises(ValidationError):
        Item(discount="0.001")
    with pytest.raises(ValidationError):
        Item(quantity="0.00001")
    with pytest.raises(ValidationError):
        Item(description="BAD\x00XML")
    assert not valid_document("ABC52998224725")
