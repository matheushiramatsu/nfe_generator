import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { Fields } from "../components/forms";
import { ErrorBox, Loading, PageHeader, useToast } from "../components/ui";
import { Review } from "../components/Review";
import { useApi } from "../hooks/useApi";
import { api, message } from "../services/api";
import type {
  AutomationOptions,
  Calculation,
  Invoice,
  Settings,
} from "../types/domain";
export const automationSchema = z
  .object({
    min_products: z.number().int().min(1).max(100),
    max_products: z.number().int().min(1).max(100),
    min_value: z
      .union([z.string(), z.number()])
      .refine((v) => Number(v) > 0, "Informe um valor positivo."),
    max_value: z
      .union([z.string(), z.number()])
      .refine((v) => Number(v) > 0, "Informe um valor positivo."),
    existing_only: z.boolean(),
    allow_fictitious: z.boolean(),
  })
  .refine((v) => v.min_products <= v.max_products, {
    message: "O máximo deve ser maior ou igual ao mínimo.",
    path: ["max_products"],
  })
  .refine((v) => Number(v.min_value) <= Number(v.max_value), {
    message: "O máximo deve ser maior ou igual ao mínimo.",
    path: ["max_value"],
  });
export const automationFields = [
  {
    name: "min_products",
    label: "Mínimo de produtos",
    type: "number" as const,
    integer: true,
  },
  {
    name: "max_products",
    label: "Máximo de produtos",
    type: "number" as const,
    integer: true,
  },
  { name: "min_value", label: "Valor mínimo (R$)", type: "number" as const },
  { name: "max_value", label: "Valor máximo (R$)", type: "number" as const },
  {
    name: "existing_only",
    label: "Utilizar somente cadastros existentes",
    type: "checkbox" as const,
  },
  {
    name: "allow_fictitious",
    label: "Permitir dados fictícios quando necessário",
    type: "checkbox" as const,
  },
];
export function Automatic() {
  const settings = useApi<Settings>("/settings");
  const form = useForm<AutomationOptions>({
    resolver: zodResolver(automationSchema),
  });
  const [invoice, setInvoice] = useState<Invoice | null>(null),
    [calculation, setCalculation] = useState<Calculation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const navigate = useNavigate(),
    toast = useToast();
  useEffect(() => {
    if (settings.data) form.reset(settings.data.automation);
  }, [settings.data, form]);
  async function generate(value: AutomationOptions) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Invoice>(
        "/invoices/generate-random",
        "POST",
        value,
      );
      const calc = await api<Calculation>(
        "/invoices/calculate",
        "POST",
        result,
      );
      setInvoice(result);
      setCalculation(calc);
      toast("Nova combinação pronta para revisão.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (settings.loading) return <Loading />;
  if (settings.error) return <ErrorBox message={settings.error} />;
  return (
    <>
      <PageHeader
        eyebrow="CENÁRIOS DE TESTE"
        title="Gerar NF-e automática"
        description="Uma nova combinação de dados coerentes, pronta para você revisar."
      />
      <div className="automatic-layout">
        <section className="card padded">
          <div className="section-heading">
            <h2>
              <Sparkles size={19} /> Sua combinação
            </h2>
          </div>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(generate)}>
              <Fields fields={automationFields} />
              <p className="muted">
                Produtos são selecionados sem repetição. Se houver dados
                fictícios, eles serão identificados na nota.
              </p>
              {error && <ErrorBox message={error} />}
              <button
                className="button primary full-width top-gap"
                disabled={busy}
              >
                {invoice ? <RefreshCw size={16} /> : <Sparkles size={16} />}{" "}
                {busy
                  ? "Gerando combinação…"
                  : invoice
                    ? "Gerar outra combinação"
                    : "Gerar combinação"}
              </button>
            </form>
          </FormProvider>
        </section>
        <section className="card">
          {invoice ? (
            <>
              <div className="section-heading padded">
                <div>
                  <h2>Combinação pronta</h2>
                  <p>Revise e ajuste qualquer campo antes de gerar.</p>
                </div>
                <span className="badge">Automática</span>
              </div>
              <Review invoice={invoice} calculation={calculation} />
              <div className="modal-footer">
                <button
                  className="button primary"
                  onClick={() =>
                    navigate("/new", { state: { invoice, review: true } })
                  }
                >
                  Revisar e gerar XML <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="auto-empty">
              <div className="auto-illustration">
                <Sparkles size={36} />
              </div>
              <h2>Um novo cenário em um clique.</h2>
              <p>
                Defina os limites ao lado. Vamos combinar emitente,
                destinatário, produtos e pagamento para você.
              </p>
              <div className="flow">
                <span>Combinar</span>
                <i />
                <span>Revisar</span>
                <i />
                <span>Gerar XML</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
