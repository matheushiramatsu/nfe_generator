export type Decimal = string | number;
export interface Address {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  city_code: string;
  uf: string;
  country_code: string;
  country: string;
}
export interface Party {
  id: string | null;
  name: string;
  trade_name: string;
  document: string;
  person_type: "PJ" | "PF";
  ie: string;
  ie_indicator: string;
  im: string;
  crt: string;
  cnae: string;
  phone: string;
  email: string;
  address: Address;
  is_default: boolean;
  is_test: boolean;
}
export interface Contribution {
  cst: string;
  base: Decimal | null;
  rate: Decimal;
  value: Decimal | null;
}
export interface Taxes {
  icms_code: string;
  icms_base: Decimal | null;
  icms_rate: Decimal;
  icms_value: Decimal | null;
  reduction: Decimal;
  st_base: Decimal;
  st_rate: Decimal;
  st_value: Decimal | null;
  fcp_rate: Decimal;
  fcp_value: Decimal | null;
  ipi: Contribution;
  ipi_enquiry: string;
  pis: Contribution;
  cofins: Contribution;
}
export interface Product {
  id: string | null;
  code: string;
  barcode: string;
  description: string;
  ncm: string;
  cest: string;
  cfop: string;
  unit: string;
  taxable_unit: string;
  unit_price: Decimal;
  origin: string;
  benefit_code: string;
  additional_info: string;
  gross_weight: Decimal;
  net_weight: Decimal;
  taxes: Taxes;
  is_test: boolean;
}
export interface Item extends Product {
  quantity: Decimal;
  discount: Decimal;
  freight: Decimal;
  insurance: Decimal;
  other: Decimal;
}
export interface Payment {
  indicator: string;
  method: string;
  value: Decimal;
  description: string;
}
export interface Transport {
  mode: string;
  document: string;
  name: string;
  ie: string;
  address: string;
  city: string;
  uf: string;
  plate: string;
  plate_uf: string;
  rntc: string;
  volume_quantity: number;
  species: string;
  brand: string;
  numbering: string;
  net_weight: Decimal;
  gross_weight: Decimal;
}
export interface Invoice {
  issuer: Party;
  recipient: Party;
  items: Item[];
  payments: Payment[];
  transport: Transport;
  nature: string;
  model: "55";
  series: number;
  number: number | null;
  issued_at: string;
  departure_at: string | null;
  operation: string;
  purpose: string;
  final_consumer: string;
  presence: string;
  destination: string;
  emission_type: "1";
  intermediary: "0";
  environment: "2";
  layout: "4.00";
  additional_info: string;
  generation_type: "manual" | "automatic";
}
export interface AutomationOptions {
  min_products: number;
  max_products: number;
  min_value: Decimal;
  max_value: Decimal;
  existing_only: boolean;
  allow_fictitious: boolean;
}
export interface Settings {
  environment: "2";
  uf: string;
  series: number;
  nature: string;
  cfop: string;
  crt: string;
  layout: "4.00";
  developer_mode: boolean;
  automation: AutomationOptions;
}
export interface Issue {
  path: string;
  message: string;
  severity: "error" | "warning";
}
export interface InvoiceSummary {
  id: string;
  number: number | null;
  series: number;
  created_at: string;
  issuer_name: string;
  issuer_document: string;
  recipient_name: string;
  recipient_document: string;
  total: Decimal;
  status: "generated" | "validation_error";
  generation_type: "manual" | "automatic";
  access_key: string | null;
  item_count: number;
}
export interface InvoiceDetail extends InvoiceSummary {
  invoice: Invoice;
  xml: string | null;
  issues: Issue[];
  totals: Record<string, Decimal>;
}
export interface Calculation {
  items: Record<string, Decimal>[];
  totals: Record<string, Decimal>;
}
export interface Validation extends Calculation {
  valid: boolean;
  issues: Issue[];
  xsd_scope: string;
}
export interface DashboardData {
  today: number;
  month: number;
  errors: number;
  recipients: number;
  products: number;
  issuers: number;
  month_total: Decimal;
  recent: InvoiceSummary[];
}
export interface Templates {
  party: Party;
  product: Product;
  invoice: Invoice;
}
