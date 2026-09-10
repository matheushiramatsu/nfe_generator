"""Coherent, explicitly fictional scenarios; catalog rows are always copied."""

import random
from decimal import Decimal

from app.domain.calculations import calculate, money
from app.domain.documents import fake_document
from app.domain.models import Address, AutomationOptions, Invoice, Item, Party, Payment, Product, Settings

rng = random.SystemRandom()


def fake_party(issuer=False):
    token = rng.randrange(1000, 9999)
    return Party(
        name=f"EMPRESA TESTE HOMOLOGACAO {token}" if issuer else f"DESTINATARIO TESTE {token}",
        trade_name="DADOS FICTICIOS - HOMOLOGACAO",
        document=fake_document(),
        ie="110042490114" if issuer else "",
        is_test=True,
        email=f"teste{token}@example.invalid",
        address=Address(
            cep="01001000",
            street="PRACA DE TESTE",
            number="100",
            district="CENTRO",
            city="SAO PAULO",
            city_code="3550308",
            uf="SP",
        ),
    )


def fake_product():
    code = str(rng.randrange(1000, 9999))
    return Product(
        code=f"TESTE-{code}",
        description=f"CADERNO DE TESTE {code} - HOMOLOGACAO",
        ncm="48202000",
        unit_price=Decimal(rng.randrange(1000, 15000)) / 100,
        is_test=True,
    )


def generate_random(options: AutomationOptions, issuers, recipients, products, settings: Settings):
    if options.min_products > options.max_products or options.min_value > options.max_value:
        raise ValueError("Limites mínimos não podem superar os máximos.")
    if money(options.min_value) != options.min_value or money(options.max_value) != options.max_value:
        raise ValueError("Limites de valor devem possuir no máximo duas casas decimais.")
    fictitious = options.allow_fictitious and not options.existing_only
    if not fictitious and (not issuers or not recipients or len(products) < options.min_products):
        raise ValueError("Cadastre emitente, destinatário e produtos suficientes ou permita dados fictícios.")
    issuer = rng.choice(issuers).model_copy(deep=True) if issuers else fake_party(True)
    recipient = rng.choice(recipients).model_copy(deep=True) if recipients else fake_party()
    pool = [p.model_copy(deep=True) for p in products]
    count = rng.randint(
        options.min_products, min(options.max_products, len(pool)) if not fictitious else options.max_products
    )
    while len(pool) < count:
        pool.append(fake_product())
    chosen = rng.sample(pool, count)
    target_cents = rng.randint(int(options.min_value * 100), int(options.max_value * 100))
    if target_cents < count:
        raise ValueError("Valor mínimo precisa permitir ao menos R$ 0,01 por produto.")
    invoice = Invoice(
        issuer=issuer,
        recipient=recipient,
        series=settings.series,
        nature=settings.nature,
        destination="1" if issuer.address.uf == recipient.address.uf else "2",
        generation_type="automatic",
    )
    remaining = target_cents
    for i, p in enumerate(chosen):
        amount = remaining if i == count - 1 else rng.randint(1, remaining - (count - i - 1))
        remaining -= amount
        quantity = Decimal(rng.randint(1, 5))
        item = Item(**p.model_dump(), quantity=quantity)
        # Variation belongs only to the invoice snapshot, never to saved catalog rows.
        item.cfop = ("5" if invoice.destination == "1" else "6") + settings.cfop[1:]
        # Zero-tax profile guarantees bounded totals while preserving fiscal codes.
        # Registered incompatible tax profiles are rejected, not silently rewritten.
        if any([item.taxes.ipi.rate, item.taxes.ipi.value, item.taxes.st_base, item.taxes.st_value]):
            raise ValueError(
                "O gerador com faixa de valor requer produtos sem IPI/ST. Use emissão manual para este cadastro."
            )
        item.unit_price = (Decimal(amount) / 100 / quantity).quantize(Decimal(".0000000001"))
        invoice.items.append(item)
    total = calculate(invoice)["totals"]["total"]
    invoice.payments = [Payment(method=rng.choice(["01", "15", "17"]), value=total)]
    return invoice
