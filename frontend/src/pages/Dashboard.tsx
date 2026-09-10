import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  FilePlus2,
  Package,
  Users,
  Workflow,
  Sparkles,
  Check,
  Settings2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api, brl, message } from "../services/api";
import type { DashboardData } from "../types/domain";
import {
  Empty,
  ErrorBox,
  InvoiceTable,
  Loading,
  PageHeader,
  useToast,
} from "../components/ui";
import { useState } from "react";
export function Dashboard() {
  const { data, error, loading, reload } = useApi<DashboardData>("/dashboard");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function seed() {
    setBusy(true);
    try {
      const result = await api<{ message: string }>("/test-data", "POST", {});
      toast(result.message);
      reload();
    } catch (e) {
      toast(message(e), true);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error} retry={reload} />;
  const stats = [
    ["Geradas hoje", data.today, "Neste ambiente"],
    ["Geradas no mês", data.month, brl(data.month_total) + " em notas"],
    ["Erros de validação", data.errors, "Tentativas a revisar"],
    ["Destinatários", data.recipients, "Cadastros disponíveis"],
    ["Produtos", data.products, "Prontos para reutilizar"],
  ];
  return (
    <>
      <PageHeader
        eyebrow="SEU AMBIENTE DE TESTES"
        title="Visão geral"
        description="Tudo pronto para o seu próximo cenário fiscal."
      >
        <Link className="button" to="/automatic">
          <Sparkles size={16} /> Gerar automaticamente
        </Link>
        <Link className="button primary" to="/new">
          <FilePlus2 size={16} /> Nova NF-e
        </Link>
      </PageHeader>
      <div className="stats">
        {stats.map(([label, value, caption], i) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong className={i === 2 && Number(value) > 0 ? "red" : ""}>
              {value}
            </strong>
            <small>{caption}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card start-card">
          <div className="kicker">
            <span className="line-icon">
              <Workflow size={19} />
            </span>{" "}
            DO CADASTRO AO XML
          </div>
          <h2>
            Menos preenchimento.
            <br /> Mais cenários de teste.
          </h2>
          <p>
            Reutilize seus cadastros ou monte uma combinação automática. Revise
            os dados e exporte seu XML.
          </p>
          <Link className="button primary" to="/new">
            Criar uma NF-e <ArrowRight size={16} />
          </Link>
          <div className="flow">
            <span>
              <Check size={13} />
              Preencher
            </span>
            <i />
            <span>
              <Check size={13} />
              Validar
            </span>
            <i />
            <span>
              <FilePlus2 size={13} />
              Exportar
            </span>
          </div>
        </section>
        <section className="card shortcuts">
          <div className="section-heading">
            <h2>Seu espaço de trabalho</h2>
            <span className="badge">NF-e 4.00</span>
          </div>
          {[
            [
              Building2,
              "Emitentes",
              "Empresas e configurações fiscais",
              "/issuers",
              data.issuers,
            ],
            [
              Users,
              "Destinatários",
              "Pessoas físicas e jurídicas",
              "/recipients",
              data.recipients,
            ],
            [
              Package,
              "Produtos",
              "Itens, valores e tributação",
              "/products",
              data.products,
            ],
          ].map(([Icon, label, description, path, count]) => {
            const Glyph = Icon as typeof Building2;
            return (
              <Link className="shortcut" to={String(path)} key={String(path)}>
                <span className="shortcut-icon">
                  <Glyph size={19} />
                </span>
                <div>
                  <strong>{String(label)}</strong>
                  <small>{String(description)}</small>
                </div>
                <span className="count">{String(count)}</span>
                <ArrowUpRight size={16} />
              </Link>
            );
          })}
          <Link className="settings-link" to="/settings">
            <Settings2 size={15} /> Configurações do ambiente{" "}
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="card">
        <div className="section-heading padded">
          <div>
            <h2>Últimas NF-e</h2>
            <p>Os cenários mais recentes do seu ambiente.</p>
          </div>
          <Link className="text-button" to="/invoices">
            Ver histórico <ArrowRight size={15} />
          </Link>
        </div>
        {data.recent.length ? (
          <InvoiceTable rows={data.recent} />
        ) : (
          <Empty
            title="Seu histórico começa aqui"
            description="Gere sua primeira nota para visualizar, duplicar e baixar os arquivos."
          >
            <Link className="button" to="/new">
              Criar primeira NF-e <ArrowRight size={15} />
            </Link>
          </Empty>
        )}
      </section>
      {!data.issuers && (
        <div className="seed-banner">
          <Sparkles size={20} />
          <div>
            <strong>Quer experimentar antes de cadastrar?</strong>
            <p>
              Adicione um conjunto de emitente, destinatários e produtos
              fictícios, identificados como teste.
            </p>
          </div>
          <button className="button" disabled={busy} onClick={seed}>
            {busy ? "Adicionando…" : "Adicionar dados de teste"}
          </button>
        </div>
      )}
      <footer className="page-footer">
        <span>
          NF-e Lab <span className="dot-separator">/</span> Ferramentas fiscais
          para desenvolvimento
        </span>
        <span>Homologação · Sem valor fiscal</span>
      </footer>
    </>
  );
}
