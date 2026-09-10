import { brl } from "../services/api";
import type { Calculation, Invoice } from "../types/domain";
export const totalLabels: Record<string, string> = {
  products: "Produtos",
  freight: "Frete",
  insurance: "Seguro",
  discount: "Desconto",
  icms_base: "Base ICMS",
  icms: "ICMS",
  st_base: "Base ICMS ST",
  st: "ICMS ST",
  fcp: "FCP",
  ipi: "IPI",
  pis: "PIS",
  cofins: "COFINS",
  other: "Outras despesas",
  total: "Total da NF-e",
};
export function Totals({
  calculation,
  compact = false,
}: {
  calculation: Calculation | null;
  compact?: boolean;
}) {
  return (
    <div className={"totals " + (compact ? "compact" : "")}>
      {Object.entries(totalLabels)
        .filter(
          ([key]) =>
            !compact ||
            ["products", "discount", "freight", "ipi", "total"].includes(key),
        )
        .map(([key, label]) => (
          <div key={key} className={key === "total" ? "grand-total" : ""}>
            <span>{label}</span>
            <strong>{calculation ? brl(calculation.totals[key]) : "—"}</strong>
          </div>
        ))}
    </div>
  );
}
export function Review({
  invoice,
  calculation,
}: {
  invoice: Invoice;
  calculation: Calculation | null;
}) {
  return (
    <>
      <div className="review-grid">
        {[
          ["Emitente", invoice.issuer],
          ["Destinatário", invoice.recipient],
        ].map(([label, value]) => {
          const p = value as Invoice["issuer"];
          return (
            <section className="review-block" key={String(label)}>
              <span className="eyebrow">{String(label)}</span>
              <h3>{p.name || "Não informado"}</h3>
              <p className="mono">{p.document}</p>
              <p>
                {p.address.street}, {p.address.number} · {p.address.district}
                <br />
                {p.address.city} / {p.address.uf} · CEP {p.address.cep}
              </p>
              {p.is_test && (
                <span className="badge warning">Dado fictício de teste</span>
              )}
            </section>
          );
        })}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>NCM / CFOP</th>
              <th>Quantidade</th>
              <th>Unitário</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td>
                  <strong>{item.description}</strong>
                  <small>
                    {item.code} · ICMS {item.taxes.icms_code} · IPI{" "}
                    {item.taxes.ipi.cst} · PIS {item.taxes.pis.cst} · COFINS{" "}
                    {item.taxes.cofins.cst}
                  </small>
                </td>
                <td className="mono">
                  {item.ncm} / {item.cfop}
                </td>
                <td>
                  {String(item.quantity)} {item.unit}
                </td>
                <td>{brl(item.unit_price)}</td>
                <td className="money">
                  {calculation ? brl(calculation.items[i]?.total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="review-grid">
        <section className="review-block">
          <span className="eyebrow">Operação</span>
          <h3>{invoice.nature}</h3>
          <p>
            Modelo {invoice.model} · Série {invoice.series}
            <br />
            Número {invoice.number || "automático"} ·{" "}
            {invoice.destination === "1" ? "Interna" : "Interestadual"}
          </p>
        </section>
        <section className="review-block">
          <span className="eyebrow">Transporte</span>
          <h3>
            {invoice.transport.mode === "9"
              ? "Sem transporte"
              : invoice.transport.name ||
                "Frete modalidade " + invoice.transport.mode}
          </h3>
          <p>
            {invoice.transport.document}
            <br />
            {invoice.transport.plate}{" "}
            {invoice.transport.volume_quantity
              ? invoice.transport.volume_quantity + " volumes"
              : ""}
          </p>
        </section>
        <section className="review-block">
          <span className="eyebrow">Pagamento</span>
          {invoice.payments.map((p, i) => (
            <p key={i}>
              Forma {p.method} {p.description} <strong>{brl(p.value)}</strong>
            </p>
          ))}
        </section>
        <section className="review-block">
          <span className="eyebrow">Informações adicionais</span>
          <p>{invoice.additional_info || "Nenhuma informação adicional."}</p>
        </section>
      </div>
      <Totals calculation={calculation} />
    </>
  );
}
