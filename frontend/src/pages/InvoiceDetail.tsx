import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Copy,
  Download,
  Files,
  Plus,
  Trash2,
  Check,
  FileCode2,
  Braces,
  Eye,
} from "lucide-react";
import Prism from "prismjs";
import { useApi } from "../hooks/useApi";
import { api, date, message } from "../services/api";
import type {
  Invoice,
  InvoiceDetail as Detail,
  Calculation,
} from "../types/domain";
import {
  ErrorBox,
  Issues,
  Loading,
  PageHeader,
  SearchInput,
  useToast,
} from "../components/ui";
import { Review } from "../components/Review";
export function InvoiceDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi<Detail>("/invoices/" + id);
  const [tab, setTab] = useState("review"),
    [query, setQuery] = useState(""),
    [copied, setCopied] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [busy, setBusy] = useState(false);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const navigate = useNavigate(),
    toast = useToast();
  const xmlLines = useMemo(() => data?.xml?.split("\n") || [], [data?.xml]);
  async function duplicate() {
    setBusy(true);
    try {
      const invoice = await api<Invoice>(
        "/invoices/" + id + "/duplicate",
        "POST",
        {},
      );
      navigate("/new", { state: { invoice } });
    } catch (e) {
      toast(message(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api("/invoices/" + id, "DELETE");
      toast("NF-e excluída.");
      navigate("/invoices");
    } catch (e) {
      toast(message(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        tab === "json"
          ? JSON.stringify(data?.invoice, null, 2)
          : data?.xml || "",
      );
      setCopied(true);
      toast("Conteúdo copiado.");
    } catch {
      toast("Não foi possível copiar. Use o botão baixar.", true);
    }
  }
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error} />;
  return (
    <>
      <PageHeader
        eyebrow="NF-E GERADA"
        title={
          data.number
            ? "Nota #" + String(data.number).padStart(6, "0")
            : "Tentativa com erro"
        }
        description={
          "Série " +
          data.series +
          " · " +
          date(data.created_at) +
          " · " +
          (data.generation_type === "automatic"
            ? "Geração automática"
            : "Geração manual")
        }
      >
        <button className="button" onClick={duplicate} disabled={busy}>
          <Files size={16} /> Duplicar / editar
        </button>
        <Link className="button primary" to="/new">
          <Plus size={16} /> Nova NF-e
        </Link>
      </PageHeader>
      <Issues issues={data.issues} />
      <section className="card">
        <div className="detail-toolbar">
          <div className="tabs">
            {[
              [Eye, "review", "Visão geral"],
              [FileCode2, "xml", "XML"],
              [Braces, "json", "JSON"],
            ].map(([Icon, key, label]) => {
              const Glyph = Icon as typeof Eye;
              return (
                <button
                  key={String(key)}
                  className={tab === key ? "active" : ""}
                  onClick={() => {
                    setTab(String(key));
                    setCopied(false);
                  }}
                >
                  <Glyph size={16} />
                  {String(label)}
                </button>
              );
            })}
          </div>
          <div className="actions">
            {data.xml && (
              <a
                className="button small"
                href={"/api/invoices/" + id + "/xml"}
                download
              >
                <Download size={15} /> XML
              </a>
            )}
            <a
              className="button small"
              href={"/api/invoices/" + id + "/json"}
              download
            >
              <Download size={15} /> JSON
            </a>
          </div>
        </div>
        {tab === "review" ? (
          <DetailReview
            data={data}
            calculation={calculation}
            setCalculation={setCalculation}
          />
        ) : tab === "xml" && !data.xml ? (
          <div className="empty">
            <h3>XML não gerado</h3>
            <p>Duplique a nota e corrija os erros para gerar novamente.</p>
          </div>
        ) : (
          <>
            <div className="code-toolbar">
              {tab === "xml" ? (
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Pesquisar tag ou valor no XML…"
                />
              ) : (
                <span className="mono">NF-e · objeto de domínio</span>
              )}
              <div className="actions">
                {query && (
                  <small>
                    {
                      xmlLines.filter((l) =>
                        l.toLowerCase().includes(query.toLowerCase()),
                      ).length
                    }{" "}
                    linhas encontradas
                  </small>
                )}
                <button className="button small" onClick={copy}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
            <pre className="code-view">
              {tab === "xml" ? (
                xmlLines.map((line, i) => (
                  <div
                    className={
                      query && line.toLowerCase().includes(query.toLowerCase())
                        ? "matched"
                        : ""
                    }
                    key={i}
                  >
                    <span className="line-number">{i + 1}</span>
                    <code
                      dangerouslySetInnerHTML={{
                        __html: Prism.highlight(
                          line,
                          Prism.languages.markup,
                          "markup",
                        ),
                      }}
                    />
                  </div>
                ))
              ) : (
                <code>{JSON.stringify(data.invoice, null, 2)}</code>
              )}
            </pre>
          </>
        )}
      </section>
      <div className="detail-footer">
        <span className="mono">ID {data.id}</span>
        <button
          className="text-button danger-text"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} /> Excluir NF-e
        </button>
      </div>
      {confirmDelete && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Excluir NF-e"
          >
            <div className="modal-body">
              <h2>Excluir esta NF-e?</h2>
              <p>
                Os dados e arquivos desta nota serão removidos do histórico.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="button"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
              <button
                className="button destructive"
                disabled={busy}
                onClick={remove}
              >
                Excluir nota
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
import { useEffect } from "react";
function DetailReview({
  data,
  calculation,
  setCalculation,
}: {
  data: Detail;
  calculation: Calculation | null;
  setCalculation: (c: Calculation) => void;
}) {
  useEffect(() => {
    api<Calculation>("/invoices/calculate", "POST", data.invoice)
      .then(setCalculation)
      .catch(() => {});
  }, [data.invoice, setCalculation]);
  return <Review invoice={data.invoice} calculation={calculation} />;
}
