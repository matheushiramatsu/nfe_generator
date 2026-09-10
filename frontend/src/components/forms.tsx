import { useFormContext } from "react-hook-form";
import { CircleHelp, MapPin } from "lucide-react";
import { api, message } from "../services/api";
import { useToast } from "./ui";
import type { Address } from "../types/domain";
export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "checkbox";
  options?: string[] | [string, string][];
  help?: string;
  placeholder?: string;
  integer?: boolean;
  nullable?: boolean;
  readOnly?: boolean;
  required?: boolean;
}
export function Field({
  field,
  prefix = "",
}: {
  field: FieldDef;
  prefix?: string;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const name = prefix ? prefix + "." + field.name : field.name;
  const error = name.split(".").reduce<any>((acc, key) => acc?.[key], errors);
  const props = register(name, {
    setValueAs:
      field.type === "checkbox"
        ? undefined
        : (v: unknown) =>
            field.nullable && (v === "" || v === null)
              ? null
              : field.integer
                ? Number(v)
                : v,
  });
  return (
    <div
      className={
        "field " +
        (field.type === "textarea" ? "wide" : "") +
        (field.type === "checkbox" ? " check-field" : "")
      }
    >
      <label htmlFor={name}>
        {field.label}
        {field.required && <span className="required"> *</span>}
        {field.help && (
          <span className="help" tabIndex={0} aria-label={field.help}>
            <CircleHelp size={13} />
            <span className="tooltip">{field.help}</span>
          </span>
        )}
      </label>
      {field.type === "select" ? (
        <select id={name} {...props}>
          {field.options?.map((v) => {
            const [value, label] = typeof v === "string" ? [v, v] : v;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
        </select>
      ) : field.type === "textarea" ? (
        <textarea id={name} rows={3} {...props} />
      ) : (
        <input
          id={name}
          type={
            field.type === "checkbox"
              ? "checkbox"
              : field.type === "number"
                ? "number"
                : "text"
          }
          step={field.integer ? "1" : "any"}
          placeholder={field.placeholder}
          readOnly={field.readOnly}
          aria-invalid={!!error}
          {...props}
        />
      )}{" "}
      {error?.message && (
        <span className="field-error">{String(error.message)}</span>
      )}
    </div>
  );
}
export function Fields({
  fields,
  prefix = "",
}: {
  fields: FieldDef[];
  prefix?: string;
}) {
  return (
    <div className="form-grid">
      {fields.map((field) => (
        <Field key={field.name} field={field} prefix={prefix} />
      ))}
    </div>
  );
}
const uf =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  );
export const addressFields: FieldDef[] = [
  { name: "cep", label: "CEP", required: true },
  { name: "street", label: "Logradouro", required: true },
  { name: "number", label: "Número", required: true },
  { name: "complement", label: "Complemento" },
  { name: "district", label: "Bairro", required: true },
  { name: "city", label: "Município", required: true },
  {
    name: "city_code",
    label: "Código IBGE",
    help: "Código do município com 7 números.",
    required: true,
  },
  { name: "uf", label: "UF", type: "select", options: uf },
  { name: "country_code", label: "Código do país" },
  { name: "country", label: "País" },
];
export function PartyFields({
  prefix = "",
  issuer = false,
}: {
  prefix?: string;
  issuer?: boolean;
}) {
  const { getValues, setValue } = useFormContext();
  const toast = useToast();
  const address = prefix ? prefix + ".address" : "address";
  async function lookup() {
    try {
      const data = await api<Partial<Address>>(
        "/addresses/" + getValues(address + ".cep"),
      );
      Object.entries(data).forEach(([k, v]) =>
        setValue(address + "." + k, v, { shouldDirty: true }),
      );
      toast("Endereço preenchido. Revise o número e complemento.");
    } catch (e) {
      toast(message(e), true);
    }
  }
  const fields: FieldDef[] = [
    ...(!issuer
      ? [
          {
            name: "person_type",
            label: "Tipo de pessoa",
            type: "select" as const,
            options: [
              ["PJ", "Pessoa jurídica"],
              ["PF", "Pessoa física"],
            ] as [string, string][],
          },
        ]
      : []),
    { name: "document", label: issuer ? "CNPJ" : "CPF / CNPJ", required: true },
    {
      name: "name",
      label: issuer ? "Razão social" : "Nome / razão social",
      required: true,
    },
    { name: "trade_name", label: "Nome fantasia" },
    { name: "ie", label: "Inscrição estadual" },
    ...(!issuer
      ? [
          {
            name: "ie_indicator",
            label: "Indicador de IE",
            type: "select" as const,
            options: [
              ["1", "Contribuinte"],
              ["2", "Isento"],
              ["9", "Não contribuinte"],
            ] as [string, string][],
          },
        ]
      : [
          {
            name: "crt",
            label: "Regime tributário · CRT",
            type: "select" as const,
            options: [
              ["1", "Simples Nacional"],
              ["2", "Simples — excesso sublimite"],
              ["3", "Regime normal"],
              ["4", "MEI"],
            ] as [string, string][],
          },
          { name: "im", label: "Inscrição municipal" },
          { name: "cnae", label: "CNAE" },
        ]),
    { name: "phone", label: "Telefone" },
    { name: "email", label: "E-mail" },
    ...(issuer
      ? [
          {
            name: "is_default",
            label: "Emitente padrão",
            type: "checkbox" as const,
          },
        ]
      : []),
    {
      name: "is_test",
      label: "Dado fictício de homologação",
      type: "checkbox",
    },
  ];
  return (
    <>
      <Fields prefix={prefix} fields={fields} />
      <div className="section-heading">
        <h3>
          <MapPin size={17} /> Endereço
        </h3>
        <button type="button" className="button small" onClick={lookup}>
          Buscar CEP
        </button>
      </div>
      <Fields prefix={address} fields={addressFields} />
    </>
  );
}
export const productFields: FieldDef[] = [
  { name: "code", label: "Código interno", required: true },
  { name: "description", label: "Descrição", required: true },
  {
    name: "ncm",
    label: "NCM",
    help: "Nomenclatura Comum do Mercosul: 8 números. XML: det/prod/NCM.",
    required: true,
  },
  {
    name: "cfop",
    label: "CFOP padrão",
    help: "Código Fiscal de Operações e Prestações: 4 números.",
    required: true,
  },
  { name: "unit_price", label: "Valor unitário (R$)", type: "number" },
  {
    name: "barcode",
    label: "Código de barras / EAN",
    help: "Informe SEM GTIN quando não houver código.",
  },
  { name: "unit", label: "Unidade comercial" },
  { name: "taxable_unit", label: "Unidade tributável" },
  {
    name: "cest",
    label: "CEST",
    help: "Código Especificador da Substituição Tributária, quando aplicável.",
  },
  {
    name: "origin",
    label: "Origem",
    type: "select",
    options: [
      ["0", "0 · Nacional"],
      ["1", "1 · Importação direta"],
      ["2", "2 · Importação mercado interno"],
      ["3", "3 · Nacional >40% importado"],
      ["4", "4 · Processo produtivo básico"],
      ["5", "5 · Nacional ≤40% importado"],
      ["6", "6 · Importação sem similar"],
      ["7", "7 · Mercado interno sem similar"],
      ["8", "8 · Nacional >70% importado"],
    ],
  },
  { name: "benefit_code", label: "Benefício fiscal" },
  { name: "gross_weight", label: "Peso bruto (kg)", type: "number" },
  { name: "net_weight", label: "Peso líquido (kg)", type: "number" },
  {
    name: "additional_info",
    label: "Informações adicionais",
    type: "textarea",
  },
  {
    name: "is_test",
    label: "Produto fictício de homologação",
    type: "checkbox",
  },
];
export function TaxFields({ prefix = "taxes" }: { prefix?: string }) {
  return (
    <>
      <p className="muted">
        Bases e valores em branco são calculados automaticamente. Valores
        informados manualmente são preservados para testes.
      </p>
      <Fields
        prefix={prefix}
        fields={[
          {
            name: "icms_code",
            label: "CST / CSOSN",
            help: "O código deve ser compatível com o CRT do emitente. Ex.: 102 para Simples Nacional.",
          },
          ...[
            "icms_base",
            "icms_rate",
            "icms_value",
            "reduction",
            "st_base",
            "st_rate",
            "st_value",
            "fcp_rate",
            "fcp_value",
          ].map((name, i) => ({
            name,
            label: [
              "Base ICMS",
              "Alíquota ICMS (%)",
              "Valor ICMS",
              "Redução de base (%)",
              "Base ICMS ST",
              "Alíquota ST (%)",
              "Valor ICMS ST",
              "Alíquota FCP (%)",
              "Valor FCP",
            ][i],
            type: "number" as const,
            nullable: [
              "icms_base",
              "icms_value",
              "st_value",
              "fcp_value",
            ].includes(name),
          })),
        ]}
      />
      {["ipi", "pis", "cofins"].map((key) => (
        <div key={key}>
          <h4>{key.toUpperCase()}</h4>
          <Fields
            prefix={prefix + "." + key}
            fields={[
              { name: "cst", label: "CST" },
              {
                name: "base",
                label: "Base de cálculo",
                type: "number",
                nullable: true,
              },
              { name: "rate", label: "Alíquota (%)", type: "number" },
              { name: "value", label: "Valor", type: "number", nullable: true },
            ]}
          />
        </div>
      ))}
      <Fields
        prefix={prefix}
        fields={[{ name: "ipi_enquiry", label: "Enquadramento IPI" }]}
      />
    </>
  );
}
