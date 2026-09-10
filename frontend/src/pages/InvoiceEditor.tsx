import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileCode2,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError, message } from "../services/api";
import type {
  Calculation,
  Invoice,
  InvoiceDetail,
  Issue,
  Party,
  Settings,
  Templates,
  Validation,
} from "../types/domain";
import {
  Issues,
  Loading,
  ErrorBox,
  PageHeader,
  useToast,
} from "../components/ui";
import {
  PartyStep,
  ProductsStep,
  DetailsStep,
} from "../components/InvoiceSteps";
import { Review, Totals } from "../components/Review";
export function InvoiceEditor() {
  const navigate = useNavigate(),
    location = useLocation();
  const initial = location.state as {
    invoice?: Invoice;
    review?: boolean;
  } | null;
  const form = useForm<Invoice>();
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [step, setStep] = useState(initial?.review ? 4 : 0),
    [calculation, setCalculation] = useState<Calculation | null>(null),
    [issues, setIssues] = useState<Issue[]>([]),
    [busy, setBusy] = useState(false),
    [validated, setValidated] = useState(false),
    [developer, setDeveloper] = useState(false);
  const toast = useToast();
  const invoice = useWatch({ control: form.control }) as Invoice;
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Templates>("/templates"),
      api<Settings>("/settings"),
      api<Party[]>("/issuers"),
    ])
      .then(([templates, settings, issuers]) => {
        if (!active) return;
        const value = initial?.invoice || {
          ...templates.invoice,
          series: settings.series,
          nature: settings.nature,
          issuer:
            issuers.find((i) => i.is_default) || issuers[0] || templates.party,
        };
        form.reset(value);
        setDeveloper(settings.developer_mode);
        setReady(true);
      })
      .catch((e) => setError(message(e)));
    return () => {
      active = false;
    };
  }, [form, initial?.invoice]);
  const serialized = JSON.stringify(invoice);
  useEffect(() => {
    if (!ready) return;
    setValidated(false);
    const controller = new AbortController();
    const timeout = setTimeout(
      () =>
        api<Calculation>(
          "/invoices/calculate",
          "POST",
          JSON.parse(serialized),
          controller.signal,
        )
          .then(setCalculation)
          .catch(() => {
            if (!controller.signal.aborted) setCalculation(null);
          }),
      250,
    );
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [serialized, ready]);
  async function check() {
    setBusy(true);
    form.clearErrors();
    try {
      const result = await api<Validation>(
        "/invoices/validate",
        "POST",
        form.getValues(),
      );
      setCalculation(result);
      setIssues(result.issues);
      setValidated(result.valid);
      result.issues
        .filter((i) => i.severity === "error")
        .forEach((i) => form.setError(i.path as any, { message: i.message }));
      toast(
        result.valid
          ? "Conteúdo fiscal validado no XSD oficial."
          : "Revise os campos indicados.",
        !result.valid,
      );
    } catch (e) {
      if (e instanceof ApiError) {
        setIssues(e.issues);
        e.issues.forEach((i) =>
          form.setError(i.path as any, { message: i.message }),
        );
      } else toast(message(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    try {
      const result = await api<InvoiceDetail>(
        "/invoices/generate",
        "POST",
        form.getValues(),
      );
      toast("XML de homologação gerado.");
      navigate("/invoices/" + result.id);
    } catch (e) {
      if (e instanceof ApiError) {
        setIssues(e.issues);
        e.issues.forEach((i) =>
          form.setError(i.path as any, { message: i.message }),
        );
      }
      toast(message(e), true);
    } finally {
      setBusy(false);
    }
  }
  if (error) return <ErrorBox message={error} />;
  if (!ready) return <Loading />;
  const steps = ["Emitente", "Destinatário", "Produtos", "Operação", "Revisão"];
  return (
    <>
      <PageHeader
        eyebrow={
          invoice.generation_type === "automatic"
            ? "GERAÇÃO AUTOMÁTICA"
            : "EMISSÃO MANUAL"
        }
        title="Nova NF-e"
        description="Monte seu cenário. Revise os dados. Gere o XML de homologação."
      />
      <nav className="steps" aria-label="Etapas da emissão">
        {steps.map((label, i) => (
          <button
            key={label}
            className={i === step ? "active" : i < step ? "done" : ""}
            onClick={() => setStep(i)}
            aria-current={i === step ? "step" : undefined}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <FormProvider {...form}>
        <div className="editor-layout">
          <section className="card editor-card">
            <div className="editor-body">
              {step === 0 ? (
                <PartyStep issuer />
              ) : step === 1 ? (
                <PartyStep />
              ) : step === 2 ? (
                <ProductsStep />
              ) : step === 3 ? (
                <DetailsStep total={calculation?.totals.total || "0"} />
              ) : (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>Revise sua NF-e</h2>
                      <p>Confira os dados antes de gerar o arquivo.</p>
                    </div>
                    {validated && (
                      <span className="badge success">
                        <ShieldCheck size={14} /> XSD infNFe validado
                      </span>
                    )}
                  </div>
                  <Issues issues={issues} />
                  <Review invoice={invoice} calculation={calculation} />
                  {developer && (
                    <details className="details">
                      <summary>
                        Modo desenvolvedor · JSON e valores calculados
                      </summary>
                      <pre>
                        {JSON.stringify(
                          { invoice, calculation, issues },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
            <div className="editor-footer">
              <button
                className="button"
                disabled={step === 0 || busy}
                onClick={() => setStep((s) => s - 1)}
              >
                <ArrowLeft size={15} /> Voltar
              </button>
              <span className="muted">Etapa {step + 1} de 5</span>
              {step < 4 ? (
                <button
                  className="button primary"
                  onClick={() => setStep((s) => s + 1)}
                >
                  Continuar <ArrowRight size={15} />
                </button>
              ) : (
                <div className="actions">
                  <button className="button" disabled={busy} onClick={check}>
                    <ShieldCheck size={16} /> Validar
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={generate}
                  >
                    <FileCode2 size={16} />
                    {busy ? "Processando…" : "Gerar XML"}
                  </button>
                </div>
              )}
            </div>
          </section>
          <aside className="card summary-card">
            <div className="section-heading">
              <h3>Resumo da nota</h3>
              <span className="badge">55</span>
            </div>
            <div className="summary-meta">
              <span>
                Série <strong>{invoice.series}</strong>
              </span>
              <span>
                Itens <strong>{invoice.items?.length || 0}</strong>
              </span>
            </div>
            <Totals calculation={calculation} compact />
            <p className="summary-note">
              Os valores são calculados automaticamente a partir dos itens e
              tributos.
            </p>
            <div className="notice warning">
              Ambiente de homologação.
              <br />
              Sem valor fiscal.
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setStep(4);
                check();
              }}
            >
              Verificar preenchimento <ArrowRight size={15} />
            </button>
          </aside>
        </div>
      </FormProvider>
    </>
  );
}
