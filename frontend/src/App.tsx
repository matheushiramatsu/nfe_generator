import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  Blocks,
  LayoutDashboard,
  FilePlus2,
  Sparkles,
  Building2,
  Users,
  Package,
  History,
  Settings2,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { ToastProvider } from "./components/ui";
import { Dashboard } from "./pages/Dashboard";
import { Catalog } from "./pages/Catalog";
import { History as InvoiceHistory } from "./pages/History";
import { InvoiceEditor } from "./pages/InvoiceEditor";
import { Automatic } from "./pages/Automatic";
import { InvoiceDetail } from "./pages/InvoiceDetail";
import { Settings } from "./pages/Settings";
const groups = [
  {
    label: "WORKSPACE",
    items: [
      [LayoutDashboard, "Visão geral", "/"],
      [FilePlus2, "Nova NF-e", "/new"],
      [Sparkles, "Gerar automaticamente", "/automatic"],
    ],
  },
  {
    label: "CADASTROS",
    items: [
      [Building2, "Emitentes", "/issuers"],
      [Users, "Destinatários", "/recipients"],
      [Package, "Produtos", "/products"],
    ],
  },
  {
    label: "GERENCIAMENTO",
    items: [
      [History, "NF-e geradas", "/invoices"],
      [Settings2, "Configurações", "/settings"],
    ],
  },
];
function Shell() {
  const [dark, setDark] = useState(
      () => localStorage.getItem("nfe-theme") === "dark",
    ),
    [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("nfe-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const current =
    groups
      .flatMap((g) => g.items)
      .find((i) => String(i[2]) === location.pathname)?.[1] || "Nota fiscal";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      {open && (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} />
      )}
      <aside className={"sidebar " + (open ? "open" : "")}>
        <NavLink to="/" className="brand">
          <span className="brand-icon">
            <Blocks size={21} />
          </span>
          <strong>
            NF-e <span>Lab</span>
          </strong>
          <span className="version">BETA</span>
        </NavLink>
        <div className="workspace-switch">
          <span className="workspace-avatar">H</span>
          <div>
            <strong>Workspace local</strong>
            <small>Desenvolvimento & testes</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <nav>
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([Icon, label, path]) => {
                const Glyph = Icon as typeof LayoutDashboard;
                return (
                  <NavLink
                    key={String(path)}
                    end={path === "/"}
                    to={String(path)}
                  >
                    <Glyph size={18} />
                    <span>{String(label)}</span>
                    {path === "/automatic" && (
                      <span className="nav-new">AUTO</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-note">
            <span className="status-dot" />
            <strong>Ambiente de homologação</strong>
            <p>
              Liberdade para testar.
              <br />
              Sem valor fiscal.
            </p>
          </div>
          <button className="theme-button" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            <span>{dark ? "Tema claro" : "Tema escuro"}</span>
          </button>
          <a
            className="repo-link"
            href="https://github.com/matheushiramatsu/nfe_generator"
            target="_blank"
            rel="noreferrer"
          >
            Documentação do projeto <ExternalLink size={13} />
          </a>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{String(current)}</strong>
          </div>
          <span className="environment-badge">
            <span /> AMBIENTE DE HOMOLOGAÇÃO
          </span>
        </header>
        <main id="main" className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/issuers" element={<Catalog kind="issuers" />} />
            <Route path="/recipients" element={<Catalog kind="recipients" />} />
            <Route path="/products" element={<Catalog kind="products" />} />
            <Route path="/new" element={<InvoiceEditor />} />
            <Route path="/automatic" element={<Automatic />} />
            <Route path="/invoices" element={<InvoiceHistory />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Página não encontrada</h1>
                  <NavLink className="button" to="/">
                    Voltar à visão geral
                  </NavLink>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </BrowserRouter>
  );
}
