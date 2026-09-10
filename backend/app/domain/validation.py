import re
from decimal import Decimal

from .calculations import calculate
from .documents import digits, valid_document
from .models import Invoice, Issue, Party

UF_CODES = dict(
    zip(
        "RO AC AM RR PA AP TO MA PI CE RN PB PE AL SE BA MG ES RJ SP PR SC RS MS MT GO DF".split(),
        "11 12 13 14 15 16 17 21 22 23 24 25 26 27 28 29 31 32 33 35 41 42 43 50 51 52 53".split(),
        strict=True,
    )
)
SUPPORTED_ICMS = {
    "1": {"102", "103", "300", "400", "900"},
    "2": {"00", "20", "40", "41", "50", "90"},
    "3": {"00", "20", "40", "41", "50", "90"},
    "4": {"102", "103", "300", "400", "900"},
}


def validate_party(p: Party, prefix: str, issuer=False) -> list[Issue]:
    issues = []

    def check(ok, path, message):
        if not ok:
            issues.append(Issue(path=f"{prefix}.{path}", message=message))

    doc = digits(p.document)
    check(valid_document(p.document), "document", "Informe um CPF ou CNPJ com dígitos verificadores válidos.")
    check(
        len(doc) == (14 if issuer or p.person_type == "PJ" else 11),
        "document",
        "Documento incompatível com o tipo de pessoa.",
    )
    check(2 <= len(p.name) <= 60, "name", "Nome deve possuir de 2 a 60 caracteres.")
    check(not issuer or bool(p.ie), "ie", "Informe a inscrição estadual do emitente.")
    check(
        p.ie_indicator != "1" or bool(p.ie),
        "ie",
        "Contribuinte de ICMS precisa informar a inscrição estadual.",
    )
    a = p.address
    check(bool(re.fullmatch(r"\d{8}", digits(a.cep))), "address.cep", "CEP deve possuir 8 números.")
    check(a.uf in UF_CODES, "address.uf", "Selecione uma UF brasileira.")
    check(
        bool(re.fullmatch(r"\d{7}", a.city_code)) and a.city_code.startswith(UF_CODES.get(a.uf, "!")),
        "address.city_code",
        "Código IBGE deve possuir 7 números e corresponder à UF.",
    )
    for key, label in [
        ("street", "Logradouro"),
        ("number", "Número"),
        ("district", "Bairro"),
        ("city", "Município"),
    ]:
        check(bool(getattr(a, key)), f"address.{key}", f"{label} é obrigatório.")
    return issues


def validate(invoice: Invoice) -> list[Issue]:
    issues = validate_party(invoice.issuer, "issuer", True) + validate_party(invoice.recipient, "recipient")

    def error(path, message):
        issues.append(Issue(path=path, message=message))

    if not invoice.items:
        error("items", "Adicione pelo menos um produto.")
    if not invoice.nature:
        error("nature", "Informe a natureza da operação.")
    if invoice.issued_at.tzinfo is None:
        error("issued_at", "Data de emissão precisa incluir o fuso horário.")
    if invoice.departure_at and (
        invoice.departure_at.tzinfo is None or invoice.departure_at < invoice.issued_at
    ):
        error("departure_at", "Saída deve incluir fuso e ser posterior ou igual à emissão.")
    expected = "1" if invoice.issuer.address.uf == invoice.recipient.address.uf else "2"
    if invoice.destination != expected:
        error("destination", "Destino da operação não corresponde às UFs do emitente e destinatário.")
    if invoice.purpose != "1" or invoice.operation != "1":
        error(
            "purpose",
            "Este MVP gera vendas normais de saída. Devoluções, entradas e ajustes exigem módulos de referências fiscais.",
        )
    if invoice.recipient.ie_indicator == "9" and invoice.final_consumer != "1":
        error(
            "final_consumer", "Destinatário não contribuinte requer consumidor final neste perfil de teste."
        )
    for index, item in enumerate(invoice.items):
        path = f"items.{index}"
        for key, pattern, label in [
            ("ncm", r"\d{8}", "NCM deve possuir 8 números."),
            ("cfop", r"[56]\d{3}", "CFOP de saída deve possuir 4 números e iniciar com 5 ou 6."),
            ("origin", r"[0-8]", "Origem deve ser um código entre 0 e 8."),
        ]:
            if not re.fullmatch(pattern, getattr(item, key)):
                error(f"{path}.{key}", label)
        if item.cfop and item.cfop[0] != ("5" if expected == "1" else "6"):
            error(f"{path}.cfop", "CFOP incompatível com o destino da operação.")
        for key in ("description", "code", "unit", "taxable_unit"):
            if not getattr(item, key):
                error(f"{path}.{key}", "Campo obrigatório do produto.")
        if item.unit != item.taxable_unit:
            error(
                f"{path}.taxable_unit",
                "Unidades diferentes exigem conversão tributável, ainda não disponível neste perfil.",
            )
        if item.discount > item.quantity * item.unit_price:
            error(f"{path}.discount", "Desconto não pode superar o valor dos produtos.")
        tax = item.taxes
        if tax.icms_code not in SUPPORTED_ICMS[invoice.issuer.crt]:
            error(
                f"{path}.taxes.icms_code",
                "CST/CSOSN não suportado para este CRT. Use 102/103/300/400/900 no Simples ou 00/20/40/41/50/90 no regime normal.",
            )
        if tax.st_base or tax.st_rate or tax.st_value:
            error(
                f"{path}.taxes.st_base",
                "ICMS ST ainda não possui mapeador neste perfil; zere os campos para continuar.",
            )
        if tax.fcp_rate or tax.fcp_value:
            error(
                f"{path}.taxes.fcp_rate",
                "FCP ainda não possui mapeador neste perfil; zere os campos para continuar.",
            )
        exempt = tax.icms_code in {"102", "103", "300", "400", "40", "41", "50"}
        if exempt and any([tax.icms_base, tax.icms_rate, tax.icms_value, tax.reduction]):
            error(f"{path}.taxes.icms_code", "Este CST/CSOSN não permite os valores de ICMS informados.")
        for key in ("ipi", "pis", "cofins"):
            t = getattr(tax, key)
            taxable = {"00", "49", "50", "99"} if key == "ipi" else {"01", "02"}
            untaxed = (
                {"01", "02", "03", "04", "05", "51", "52", "53", "54", "55"}
                if key == "ipi"
                else {"04", "05", "06", "07", "08", "09"}
            )
            if t.cst not in taxable | untaxed:
                error(f"{path}.taxes.{key}.cst", f"CST de {key.upper()} ainda não suportado pelo mapeador.")
            if t.cst in untaxed and (t.rate or t.value or t.base):
                error(
                    f"{path}.taxes.{key}.rate", f"CST de {key.upper()} não tributado exige valores zerados."
                )
    total = calculate(invoice)["totals"]["total"]
    if total <= 0:
        error("items", "O valor total da NF-e deve ser maior que zero.")
    if not invoice.payments:
        error("payments", "Adicione uma forma de pagamento.")
    for i, payment in enumerate(invoice.payments):
        if payment.method not in {"01", "02", "15", "16", "17", "18", "19", "90", "99"}:
            error(
                f"payments.{i}.method",
                "Forma de pagamento exige dados complementares não disponíveis neste MVP.",
            )
        if payment.method == "99" and not payment.description:
            error(f"payments.{i}.description", "Descreva a forma de pagamento Outros.")
    if abs(sum((p.value for p in invoice.payments), Decimal(0)) - total) > Decimal("0.01"):
        error("payments", "A soma dos pagamentos deve corresponder ao total da NF-e.")
    if invoice.transport.document and not valid_document(invoice.transport.document):
        error("transport.document", "CPF/CNPJ da transportadora inválido.")
    if invoice.transport.plate and (
        invoice.transport.plate_uf not in UF_CODES
        or not re.fullmatch(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", invoice.transport.plate)
    ):
        error("transport.plate", "Informe placa sem pontuação e UF válida.")
    if invoice.transport.mode == "9" and (
        invoice.transport.name or invoice.transport.plate or invoice.transport.volume_quantity
    ):
        error("transport.mode", "Dados de transporte exigem modalidade de frete diferente de Sem transporte.")
    issues.append(
        Issue(
            path="environment",
            severity="warning",
            message="XML de homologação não assinado, sem autorização SEFAZ e sem valor fiscal. Validação XSD do conteúdo infNFe.",
        )
    )
    if invoice.issuer.is_test or invoice.recipient.is_test or any(p.is_test for p in invoice.items):
        issues.append(
            Issue(
                path="issuer",
                severity="warning",
                message="Esta nota contém dados fictícios de teste; documentos são válidos apenas matematicamente.",
            )
        )
    return issues
