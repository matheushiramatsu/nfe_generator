from decimal import ROUND_HALF_UP, Decimal

from .models import Contribution, Invoice, Item

ZERO = Decimal("0")


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def contribution(tax: Contribution, base: Decimal) -> dict:
    effective_base = tax.base if tax.base is not None else base
    return {
        "base": money(effective_base),
        "value": money(tax.value if tax.value is not None else effective_base * tax.rate / 100),
    }


def calculate_item(item: Item) -> dict:
    products = money(item.quantity * item.unit_price)
    base = products - item.discount + item.freight + item.insurance + item.other
    tax = item.taxes
    icms_base = money(tax.icms_base if tax.icms_base is not None else base * (1 - tax.reduction / 100))
    taxable = tax.icms_code in {"00", "20", "90", "900"}
    result = {
        "products": products,
        "discount": money(item.discount),
        "freight": money(item.freight),
        "insurance": money(item.insurance),
        "other": money(item.other),
        "icms_base": icms_base if taxable else ZERO,
        "icms": money(tax.icms_value if tax.icms_value is not None else icms_base * tax.icms_rate / 100)
        if taxable
        else ZERO,
        "st_base": money(tax.st_base),
        "st": money(tax.st_value if tax.st_value is not None else tax.st_base * tax.st_rate / 100),
        "fcp": money(tax.fcp_value if tax.fcp_value is not None else icms_base * tax.fcp_rate / 100),
    }
    for key in ("ipi", "pis", "cofins"):
        computed = contribution(getattr(tax, key), base)
        result[key] = computed["value"]
        result[f"{key}_base"] = computed["base"]
    result["total"] = money(base + result["st"] + result["ipi"])
    return result


def calculate(invoice: Invoice) -> dict:
    items = [calculate_item(item) for item in invoice.items]
    keys = (
        "products",
        "discount",
        "freight",
        "insurance",
        "other",
        "icms_base",
        "icms",
        "st_base",
        "st",
        "fcp",
        "ipi",
        "pis",
        "cofins",
        "total",
    )
    return {"items": items, "totals": {key: money(sum((item[key] for item in items), ZERO)) for key in keys}}
