"""Versioned fiscal DTOs. Decimal values are serialized as strings, never floats."""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator


def now():
    return datetime.now(ZoneInfo("America/Sao_Paulo"))


class Model(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def reject_xml_controls(cls, value):
        if isinstance(value, str) and any(ord(char) < 32 and char not in "\n\r\t" for char in value):
            raise ValueError("Caracteres de controle nÃ£o sÃ£o permitidos em campos XML.")
        return value

    model_config = ConfigDict(
        extra="forbid", str_strip_whitespace=True, str_max_length=5000, validate_assignment=True
    )


class Address(Model):
    cep: str = ""
    street: str = ""
    number: str = ""
    complement: str = ""
    district: str = ""
    city: str = ""
    city_code: str = ""
    uf: str = "SP"
    country_code: str = "1058"
    country: str = "BRASIL"


class Party(Model):
    id: str | None = None
    name: str = ""
    trade_name: str = ""
    document: str = ""
    person_type: Literal["PJ", "PF"] = "PJ"
    ie: str = ""
    ie_indicator: Literal["1", "2", "9"] = "9"
    im: str = ""
    crt: Literal["1", "2", "3", "4"] = "1"
    cnae: str = ""
    phone: str = ""
    email: str = ""
    address: Address = Field(default_factory=Address)
    is_default: bool = False
    is_test: bool = False


class Contribution(Model):
    cst: str = "07"
    base: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=15)
    rate: Decimal = Field(default=Decimal(0), ge=0, le=100, decimal_places=4)
    value: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=15)


class Taxes(Model):
    icms_code: str = "102"
    icms_base: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=15)
    icms_rate: Decimal = Field(default=Decimal(0), ge=0, le=100, decimal_places=4)
    icms_value: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=15)
    reduction: Decimal = Field(default=Decimal(0), ge=0, le=100, decimal_places=4)
    st_base: Decimal = Field(default=Decimal(0), ge=0, decimal_places=2, max_digits=15)
    st_rate: Decimal = Field(default=Decimal(0), ge=0, le=100, decimal_places=4)
    st_value: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=15)
    fcp_rate: Decimal = Field(default=Decimal(0), ge=0, le=100, decimal_places=4)
    fcp_value: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=15)
    ipi: Contribution = Field(default_factory=lambda: Contribution(cst="53"))
    ipi_enquiry: str = "999"
    pis: Contribution = Field(default_factory=Contribution)
    cofins: Contribution = Field(default_factory=Contribution)


class Product(Model):
    id: str | None = None
    code: str = ""
    barcode: str = "SEM GTIN"
    description: str = ""
    ncm: str = ""
    cest: str = ""
    cfop: str = "5102"
    unit: str = "UN"
    taxable_unit: str = "UN"
    unit_price: Decimal = Field(default=Decimal(0), ge=0, le=Decimal("9999999999"), decimal_places=10)
    origin: str = "0"
    benefit_code: str = ""
    additional_info: str = ""
    gross_weight: Decimal = Field(default=Decimal(0), ge=0, decimal_places=3, max_digits=15)
    net_weight: Decimal = Field(default=Decimal(0), ge=0, decimal_places=3, max_digits=15)
    taxes: Taxes = Field(default_factory=Taxes)
    is_test: bool = False


class Item(Product):
    quantity: Decimal = Field(default=Decimal(1), gt=0, le=Decimal("9999999999"), decimal_places=4)
    discount: Decimal = Field(default=Decimal(0), ge=0, decimal_places=2, max_digits=15)
    freight: Decimal = Field(default=Decimal(0), ge=0, decimal_places=2, max_digits=15)
    insurance: Decimal = Field(default=Decimal(0), ge=0, decimal_places=2, max_digits=15)
    other: Decimal = Field(default=Decimal(0), ge=0, decimal_places=2, max_digits=15)


class Payment(Model):
    indicator: Literal["0", "1"] = "0"
    method: str = "01"
    value: Decimal = Field(default=Decimal(0), ge=0, decimal_places=2, max_digits=15)
    description: str = ""


class Transport(Model):
    mode: Literal["0", "1", "2", "3", "4", "9"] = "9"
    document: str = ""
    name: str = ""
    ie: str = ""
    address: str = ""
    city: str = ""
    uf: str = ""
    plate: str = ""
    plate_uf: str = ""
    rntc: str = ""
    volume_quantity: int = Field(default=0, ge=0)
    species: str = ""
    brand: str = ""
    numbering: str = ""
    net_weight: Decimal = Field(default=Decimal(0), ge=0, decimal_places=3, max_digits=15)
    gross_weight: Decimal = Field(default=Decimal(0), ge=0, decimal_places=3, max_digits=15)


class Invoice(Model):
    issuer: Party
    recipient: Party
    items: list[Item] = Field(default_factory=list, max_length=990)
    payments: list[Payment] = Field(default_factory=list, max_length=100)
    transport: Transport = Field(default_factory=Transport)
    nature: str = "VENDA DE MERCADORIA"
    model: Literal["55"] = "55"
    series: int = Field(default=1, ge=0, le=999)
    number: int | None = Field(default=None, ge=1, le=999999999)
    issued_at: datetime = Field(default_factory=now)
    departure_at: datetime | None = None
    operation: Literal["0", "1"] = "1"
    purpose: Literal["1", "2", "3", "4"] = "1"
    final_consumer: Literal["0", "1"] = "1"
    presence: Literal["0", "1", "2", "3", "4", "5", "9"] = "1"
    destination: Literal["1", "2", "3"] = "1"
    emission_type: Literal["1"] = "1"
    intermediary: Literal["0"] = "0"
    environment: Literal["2"] = "2"
    layout: Literal["4.00"] = "4.00"
    additional_info: str = "DOCUMENTO DE HOMOLOGACAO - SEM VALOR FISCAL"
    generation_type: Literal["manual", "automatic"] = "manual"


class AutomationOptions(Model):
    min_products: int = Field(default=1, ge=1, le=100)
    max_products: int = Field(default=3, ge=1, le=100)
    min_value: Decimal = Field(default=Decimal(100), gt=0)
    max_value: Decimal = Field(default=Decimal(1000), gt=0, le=Decimal("9999999999"), decimal_places=10)
    existing_only: bool = False
    allow_fictitious: bool = True


class Settings(Model):
    environment: Literal["2"] = "2"
    uf: str = "SP"
    series: int = Field(default=1, ge=0, le=999)
    nature: str = "VENDA DE MERCADORIA"
    cfop: str = "5102"
    crt: Literal["1", "2", "3", "4"] = "1"
    layout: Literal["4.00"] = "4.00"
    developer_mode: bool = False
    automation: AutomationOptions = Field(default_factory=AutomationOptions)


class Issue(Model):
    path: str
    message: str
    severity: Literal["error", "warning"] = "error"
