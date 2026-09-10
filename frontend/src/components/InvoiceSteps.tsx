import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2, Package, ChevronDown } from "lucide-react";
import {
  Field,
  Fields,
  PartyFields,
  productFields,
  TaxFields,
  type FieldDef,
} from "./forms";
import { api, message } from "../services/api";
import { useToast, SearchInput } from "./ui";
import type { Invoice, Party, Product, Templates } from "../types/domain";
import { useApi } from "../hooks/useApi";
export function PartyStep({ issuer = false }: { issuer?: boolean }) {
  const key = issuer ? "issuer" : "recipient";
  const [search, setSearch] = useState("");
  const { data, reload } = useApi<Party[]>(
    "/" +
      (issuer ? "issuers" : "recipients") +
      "?q=" +
      encodeURIComponent(search),
  );
  const { setValue, watch, getValues } = useFormContext<Invoice>();
  const toast = useToast();
  const party = watch(key);
  async function saveRecipient() {
    try {
      const value = await api<Party>(
        "/recipients",
        "POST",
        getValues("recipient"),
      );
      setValue("recipient", value);
      reload();
      toast("Destinatário salvo no cadastro.");
    } catch (e) {
      toast(message(e), true);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>{issuer ? "Quem está emitindo?" : "Para quem é esta nota?"}</h2>
          <p>Selecione um cadastro ou preencha os dados abaixo.</p>
        </div>
      </div>
      <div className="picker">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Pesquisar nome, CPF ou CNPJ…"
        />
        <select
          aria-label={"Selecionar " + key}
          value={party.id || ""}
          onChange={(e) => {
            const selected = data?.find((p) => p.id === e.target.value);
            if (selected) {
              setValue(key, structuredClone(selected));
              api<{ destination: string }>(
                "/invoices/operation",
                "POST",
                getValues(),
              )
                .then((result) => setValue("destination", result.destination))
                .catch((e) => toast(message(e), true));
            }
          }}
        >
          <option value="">Preenchimento manual</option>
          {data?.map((p) => (
            <option key={p.id} value={p.id!}>
              {p.name} · {p.document}
            </option>
          ))}
        </select>
      </div>
      <div className="notice info">
        As alterações feitas aqui valem apenas para esta NF-e.
      </div>
      <PartyFields prefix={key} issuer={issuer} />
      {!issuer && (
        <button
          type="button"
          className="button top-gap"
          onClick={saveRecipient}
        >
          <Plus size={16} /> Salvar como novo destinatário
        </button>
      )}
    </>
  );
}
export function ProductsStep() {
  const { control, watch, setValue, getValues } = useFormContext<Invoice>();
  const toast = useToast();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
    keyName: "fieldId",
  });
  const [search, setSearch] = useState("");
  const products = useApi<Product[]>(
    "/products?q=" + encodeURIComponent(search),
  );
  const templates = useApi<Templates>("/templates");
  const [expanded, setExpanded] = useState<number | null>(0);
  function add(product: Product) {
    append({
      ...structuredClone(product),
      quantity: "1",
      discount: "0",
      freight: "0",
      insurance: "0",
      other: "0",
    });
    setExpanded(fields.length);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Produtos da nota</h2>
          <p>Adicione itens e ajuste quantidades, valores e tributos.</p>
        </div>
        <button
          type="button"
          className="button small"
          disabled={!templates.data}
          onClick={() => add(templates.data!.product)}
        >
          <Plus size={16} /> Item manual
        </button>
      </div>
      <div className="picker">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Pesquisar produto por descrição ou código…"
        />
        <select
          aria-label="Adicionar produto cadastrado"
          value=""
          onChange={(e) => {
            const p = products.data?.find((p) => p.id === e.target.value);
            if (p) add(p);
          }}
        >
          <option value="">Adicionar produto cadastrado</option>
          {products.data?.map((p) => (
            <option key={p.id} value={p.id!}>
              {p.code} · {p.description}
            </option>
          ))}
        </select>
      </div>
      {!fields.length && (
        <div className="empty">
          <Package size={28} />
          <h3>Adicione seu primeiro produto</h3>
          <p>Selecione um cadastro acima ou crie um item manual.</p>
        </div>
      )}
      {fields.map((item, i) => (
        <section className="item-card" key={item.fieldId}>
          <div className="item-heading">
            <button
              type="button"
              className="item-toggle"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <span className="step-number">{i + 1}</span>
              <strong>
                {watch(`items.${i}.description`) || "Novo produto"}
              </strong>
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={"Remover item " + (i + 1)}
              onClick={() => remove(i)}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="item-body">
            <Fields
              prefix={"items." + i}
              fields={[
                { name: "quantity", label: "Quantidade", type: "number" },
                {
                  name: "unit_price",
                  label: "Valor unitário (R$)",
                  type: "number",
                },
                { name: "discount", label: "Desconto (R$)", type: "number" },
              ]}
            />
            {expanded === i && (
              <>
                <Fields
                  prefix={"items." + i}
                  fields={productFields.filter((f) => f.name !== "unit_price")}
                />
                <Fields
                  prefix={"items." + i}
                  fields={[
                    { name: "freight", label: "Frete (R$)", type: "number" },
                    { name: "insurance", label: "Seguro (R$)", type: "number" },
                    {
                      name: "other",
                      label: "Outras despesas (R$)",
                      type: "number",
                    },
                  ]}
                />
                <details className="details">
                  <summary>Tributação deste item</summary>
                  <TaxFields prefix={"items." + i + ".taxes"} />
                </details>
              </>
            )}
          </div>
        </section>
      ))}
      {fields.length > 0 && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            api<{ destination: string; cfops: string[] }>(
              "/invoices/operation",
              "POST",
              getValues(),
            )
              .then((result) => {
                setValue("destination", result.destination);
                result.cfops.forEach((cfop, i) =>
                  setValue(`items.${i}.cfop`, cfop),
                );
              })
              .catch((e) => toast(message(e), true));
          }}
        >
          Ajustar prefixo do CFOP ao destino da operação
        </button>
      )}
    </>
  );
}
const generalFields: FieldDef[] = [
  { name: "nature", label: "Natureza da operação", required: true },
  { name: "series", label: "Série", type: "number", integer: true },
  {
    name: "number",
    label: "Número",
    type: "number",
    integer: true,
    nullable: true,
    placeholder: "Automático ao gerar",
  },
  {
    name: "issued_at",
    label: "Data/hora de emissão",
    help: "Formato ISO com fuso. Ex.: 2026-09-10T10:00:00-03:00",
  },
  { name: "departure_at", label: "Data/hora de saída", nullable: true },
  {
    name: "operation",
    label: "Tipo de operação",
    type: "select",
    options: [
      ["1", "Saída"],
      ["0", "Entrada"],
    ],
  },
  {
    name: "purpose",
    label: "Finalidade",
    type: "select",
    options: [
      ["1", "Normal"],
      ["2", "Complementar"],
      ["3", "Ajuste"],
      ["4", "Devolução"],
    ],
  },
  {
    name: "destination",
    label: "Destino da operação",
    type: "select",
    options: [
      ["1", "Interna"],
      ["2", "Interestadual"],
      ["3", "Exterior"],
    ],
  },
  {
    name: "final_consumer",
    label: "Consumidor final",
    type: "select",
    options: [
      ["1", "Sim"],
      ["0", "Não"],
    ],
  },
  {
    name: "presence",
    label: "Presença do comprador",
    type: "select",
    options: [
      ["0", "Não se aplica"],
      ["1", "Presencial"],
      ["2", "Internet"],
      ["3", "Teleatendimento"],
      ["4", "Entrega a domicílio"],
      ["5", "Presencial fora do estabelecimento"],
      ["9", "Outros"],
    ],
  },
  {
    name: "additional_info",
    label: "Informações adicionais",
    type: "textarea",
  },
];
export function DetailsStep({ total }: { total: string | number }) {
  const { control, setValue } = useFormContext<Invoice>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "payments",
  });
  return (
    <>
      <h2>Dados da operação</h2>
      <Fields fields={generalFields} />
      <details className="details">
        <summary>Transporte e volumes</summary>
        <Fields
          prefix="transport"
          fields={[
            {
              name: "mode",
              label: "Modalidade do frete",
              type: "select",
              options: [
                ["9", "Sem transporte"],
                ["0", "Por conta do remetente"],
                ["1", "Por conta do destinatário"],
                ["2", "Por conta de terceiros"],
                ["3", "Transporte próprio remetente"],
                ["4", "Transporte próprio destinatário"],
              ],
            },
            ...[
              "document",
              "name",
              "ie",
              "address",
              "city",
              "uf",
              "plate",
              "plate_uf",
              "rntc",
              "species",
              "brand",
              "numbering",
            ].map((name, i) => ({
              name,
              label: [
                "CPF / CNPJ",
                "Razão social",
                "Inscrição estadual",
                "Endereço",
                "Município",
                "UF",
                "Placa",
                "UF da placa",
                "RNTC",
                "Espécie",
                "Marca",
                "Numeração",
              ][i],
            })),
            {
              name: "volume_quantity",
              label: "Quantidade de volumes",
              type: "number",
              integer: true,
            },
            { name: "net_weight", label: "Peso líquido (kg)", type: "number" },
            { name: "gross_weight", label: "Peso bruto (kg)", type: "number" },
          ]}
        />
      </details>
      <div className="section-heading">
        <div>
          <h2>Pagamento</h2>
          <p>A soma dos pagamentos deve corresponder ao total da nota.</p>
        </div>
        <button
          type="button"
          className="button small"
          onClick={() =>
            append({
              indicator: "0",
              method: "01",
              value: "0",
              description: "",
            })
          }
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>
      {fields.map((p, i) => (
        <div className="payment-row" key={p.id}>
          <Field
            prefix={"payments." + i}
            field={{
              name: "method",
              label: "Forma de pagamento",
              type: "select",
              options: [
                ["01", "Dinheiro"],
                ["02", "Cheque"],
                ["15", "Boleto"],
                ["16", "Depósito bancário"],
                ["17", "PIX"],
                ["18", "Transferência"],
                ["19", "Fidelidade"],
                ["99", "Outros"],
              ],
            }}
          />
          <Field
            prefix={"payments." + i}
            field={{
              name: "indicator",
              label: "Condição",
              type: "select",
              options: [
                ["0", "À vista"],
                ["1", "A prazo"],
              ],
            }}
          />
          <Field
            prefix={"payments." + i}
            field={{ name: "value", label: "Valor (R$)", type: "number" }}
          />
          <Field
            prefix={"payments." + i}
            field={{ name: "description", label: "Descrição complementar" }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={"Remover pagamento " + (i + 1)}
            onClick={() => remove(i)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        onClick={() =>
          setValue("payments", [
            { indicator: "0", method: "01", value: total, description: "" },
          ])
        }
      >
        Preencher um pagamento com o total da nota
      </button>
    </>
  );
}
