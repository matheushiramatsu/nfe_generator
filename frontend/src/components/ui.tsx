import { createContext, useContext, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  X,
  AlertCircle,
  LoaderCircle,
  FileText,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { InvoiceSummary, Issue } from "../types/domain";
import { brl, date } from "../services/api";
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  return (
    <ToastContext.Provider
      value={(message, error = false) => setToast({ message, error })}
    >
      {children}
      {toast && (
        <div className={"toast " + (toast.error ? "error" : "")} role="status">
          {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>Carregando seu ambiente…</span>
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="notice danger" role="alert">
      <AlertCircle size={18} />
      <div>
        {message}
        {retry && (
          <button className="text-button" onClick={retry}>
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
export function Issues({ issues }: { issues: Issue[] }) {
  return (
    <div className="issues">
      {issues.map((i, n) => (
        <div
          className={
            "notice " + (i.severity === "error" ? "danger" : "warning")
          }
          key={n}
        >
          <AlertCircle size={16} />
          <span>{i.message}</span>
        </div>
      ))}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Pesquisar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function InvoiceTable({ rows }: { rows: InvoiceSummary[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Nota fiscal</th>
            <th>Destinatário</th>
            <th>Emissão</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Origem</th>
            <th>
              <span className="sr-only">Ação</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="table-title" to={"/invoices/" + row.id}>
                  <FileText size={16} />
                  {row.number
                    ? "#" + String(row.number).padStart(6, "0")
                    : "Tentativa"}
                </Link>
                <small>
                  Série {row.series} · {row.item_count}{" "}
                  {row.item_count === 1 ? "item" : "itens"}
                </small>
              </td>
              <td>
                <strong>{row.recipient_name}</strong>
                <small className="mono">{row.recipient_document}</small>
              </td>
              <td>{date(row.created_at)}</td>
              <td className="money">{brl(row.total)}</td>
              <td>
                <span
                  className={
                    "badge " +
                    (row.status === "generated" ? "success" : "danger")
                  }
                >
                  {row.status === "generated"
                    ? "XML gerado"
                    : "Erro de validação"}
                </span>
              </td>
              <td>
                <span className="badge">
                  {row.generation_type === "automatic"
                    ? "Automática"
                    : "Manual"}
                </span>
              </td>
              <td>
                <Link className="text-button" to={"/invoices/" + row.id}>
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
