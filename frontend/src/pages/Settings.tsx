import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Save, ShieldCheck, Code2 } from "lucide-react";
import { Fields } from "../components/forms";
import { ErrorBox, Loading, PageHeader, useToast } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { api, message } from "../services/api";
import type { Settings as SettingsType } from "../types/domain";
import { automationFields } from "./Automatic";
export function Settings() {
  const { data, error, loading } = useApi<SettingsType>("/settings");
  const form = useForm<SettingsType>();
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (data) form.reset(data);
  }, [data, form]);
  async function save(value: SettingsType) {
    setSaving(true);
    try {
      await api("/settings", "PUT", value);
      toast("Configurações salvas.");
    } catch (e) {
      toast(message(e), true);
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  return (
    <>
      <PageHeader
        eyebrow="AMBIENTE"
        title="Configurações"
        description="Defina os padrões das próximas notas e personalize seu ambiente."
      />
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(save)} className="settings-layout">
          <section className="card padded">
            <div className="section-heading">
              <h2>
                <ShieldCheck size={19} /> Ambiente de homologação
              </h2>
              <span className="badge warning">Somente testes</span>
            </div>
            <p className="muted">
              Modelo 55 · Leiaute 4.00 · Schema oficial PL 010f v1.04.
              <br />O XML exportado não é assinado nem enviado à SEFAZ.
            </p>
            <Fields
              fields={[
                { name: "uf", label: "UF padrão" },
                {
                  name: "series",
                  label: "Série padrão",
                  type: "number",
                  integer: true,
                },
                { name: "nature", label: "Natureza da operação padrão" },
                { name: "cfop", label: "CFOP padrão" },
                {
                  name: "crt",
                  label: "CRT padrão",
                  type: "select",
                  options: [
                    ["1", "Simples Nacional"],
                    ["2", "Simples — excesso sublimite"],
                    ["3", "Regime normal"],
                    ["4", "MEI"],
                  ],
                },
                {
                  name: "layout",
                  label: "Leiaute NF-e",
                  type: "select",
                  options: ["4.00"],
                },
              ]}
            />
          </section>
          <section className="card padded">
            <h2>Gerador automático</h2>
            <Fields prefix="automation" fields={automationFields} />
          </section>
          <section className="card padded">
            <h2>
              <Code2 size={19} /> Modo desenvolvedor
            </h2>
            <p className="muted">
              Exibe JSON interno, caminhos de campos e valores calculados
              durante a revisão.
            </p>
            <Fields
              fields={[
                {
                  name: "developer_mode",
                  label: "Habilitar modo desenvolvedor",
                  type: "checkbox",
                },
              ]}
            />
            <a
              className="text-button"
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
            >
              Documentação interativa da API ↗
            </a>
          </section>
          <div className="actions end">
            <button className="button primary" disabled={saving}>
              <Save size={16} />
              {saving ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </form>
      </FormProvider>
    </>
  );
}
