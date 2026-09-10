import { useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, SlidersHorizontal } from "lucide-react";
import { useApi } from "../hooks/useApi";
import {
  Empty,
  ErrorBox,
  InvoiceTable,
  Loading,
  PageHeader,
  SearchInput,
} from "../components/ui";
import type { InvoiceSummary, Party } from "../types/domain";
export function History() {
  const [query, setQuery] = useState(""),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [offset, setOffset] = useState(0);
  const params = new URLSearchParams({
    ...filters,
    q: query,
    offset: String(offset),
    limit: "20",
  });
  const { data, error, loading, reload } = useApi<{
    items: InvoiceSummary[];
    total: number;
  }>("/invoices?" + params);
  const issuers = useApi<Party[]>("/issuers"),
    recipients = useApi<Party[]>("/recipients");
  const filter = (key: string, value: string) => {
    setFilters((v) => ({ ...v, [key]: value }));
    setOffset(0);
  };
  return (
    <>
      <PageHeader
        eyebrow="DOCUMENTOS"
        title="NF-e geradas"
        description="Encontre, revise e reutilize seus cenários de teste."
      >
        <Link className="button primary" to="/new">
          <FilePlus2 size={16} /> Nova NF-e
        </Link>
      </PageHeader>
      <section className="card">
        <div className="toolbar">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setOffset(0);
            }}
            placeholder="Buscar por número, nome ou CPF/CNPJ…"
          />
          <span className="muted">
            <SlidersHorizontal size={15} /> Filtros
          </span>
        </div>
        <div className="filter-grid">
          <label>
            De
            <input
              type="date"
              value={filters.start || ""}
              onChange={(e) => filter("start", e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={filters.end || ""}
              onChange={(e) => filter("end", e.target.value)}
            />
          </label>
          <label>
            Status
            <select
              value={filters.status || ""}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">Todos</option>
              <option value="generated">XML gerado</option>
              <option value="validation_error">Erro de validação</option>
            </select>
          </label>
          <label>
            Geração
            <select
              value={filters.generation_type || ""}
              onChange={(e) => filter("generation_type", e.target.value)}
            >
              <option value="">Todas</option>
              <option value="manual">Manual</option>
              <option value="automatic">Automática</option>
            </select>
          </label>
          <label>
            Série
            <input
              type="number"
              min="0"
              value={filters.series || ""}
              onChange={(e) => filter("series", e.target.value)}
            />
          </label>
          <label>
            Emitente
            <select
              value={filters.issuer || ""}
              onChange={(e) => filter("issuer", e.target.value)}
            >
              <option value="">Todos</option>
              {issuers.data?.map((p) => (
                <option value={p.document} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destinatário
            <select
              value={filters.recipient || ""}
              onChange={(e) => filter("recipient", e.target.value)}
            >
              <option value="">Todos</option>
              {recipients.data?.map((p) => (
                <option value={p.document} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              setFilters({});
              setQuery("");
              setOffset(0);
            }}
          >
            Limpar filtros
          </button>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} retry={reload} />
        ) : data?.items.length ? (
          <InvoiceTable rows={data.items} />
        ) : (
          <Empty
            title="Nenhuma nota encontrada"
            description="Ajuste os filtros ou crie uma nova NF-e para iniciar seu histórico."
          />
        )}
        <div className="pagination">
          <span>{data?.total ?? 0} resultados</span>
          <div className="actions">
            <button
              className="button small"
              disabled={!offset}
              onClick={() => setOffset((n) => Math.max(0, n - 20))}
            >
              Anterior
            </button>
            <span>Página {offset / 20 + 1}</span>
            <button
              className="button small"
              disabled={!data || offset + 20 >= data.total}
              onClick={() => setOffset((n) => n + 20)}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
