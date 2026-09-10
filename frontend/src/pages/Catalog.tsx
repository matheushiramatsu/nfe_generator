import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Users,
  Package,
  X,
} from "lucide-react";
import {
  Fields,
  PartyFields,
  productFields,
  TaxFields,
} from "../components/forms";
import {
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  SearchInput,
  useToast,
} from "../components/ui";
import { useApi } from "../hooks/useApi";
import { api, ApiError, brl, message } from "../services/api";
import type { Party, Product, Templates } from "../types/domain";
export function Catalog({
  kind,
}: {
  kind: "issuers" | "recipients" | "products";
}) {
  const [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Party | Product | null>(null),
    [saving, setSaving] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi<(Party | Product)[]>(
    "/" + kind + "?q=" + encodeURIComponent(search),
  );
  const template = useApi<Templates>("/templates");
  const toast = useToast();
  const form = useForm<any>();
  useEffect(() => {
    if (editing) form.reset(editing);
  }, [editing, form]);
  useEffect(() => {
    setSearch("");
    setEditing(null);
  }, [kind]);
  const title = {
    issuers: "Emitentes",
    recipients: "Destinatários",
    products: "Produtos",
  }[kind];
  const singular = {
    issuers: "emitente",
    recipients: "destinatário",
    products: "produto",
  }[kind];
  const Icon = { issuers: Building2, recipients: Users, products: Package }[
    kind
  ];
  async function save(value: Party | Product) {
    setSaving(true);
    try {
      await api(
        "/" + kind + (editing?.id ? "/" + editing.id : ""),
        editing?.id ? "PUT" : "POST",
        value,
      );
      setEditing(null);
      reload();
      toast("Cadastro salvo.");
    } catch (e) {
      if (e instanceof ApiError)
        e.issues.forEach((i) =>
          form.setError(i.path.replace(kind + ".", ""), { message: i.message }),
        );
      toast(message(e), true);
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: string) {
    try {
      await api("/" + kind + "/" + id, "DELETE");
      setDeleting(null);
      reload();
      toast("Cadastro excluído. As notas existentes preservam seus dados.");
    } catch (e) {
      toast(message(e), true);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="CADASTROS"
        title={title}
        description={
          "Cadastre e reutilize " +
          title.toLowerCase() +
          " nos seus cenários de homologação."
        }
      >
        <button
          className="button primary"
          disabled={!template.data}
          onClick={() =>
            setEditing(
              structuredClone(
                kind === "products"
                  ? template.data!.product
                  : template.data!.party,
              ),
            )
          }
        >
          <Plus size={16} /> Novo {singular}
        </button>
      </PageHeader>
      <section className="card">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              kind === "products"
                ? "Buscar por descrição ou código…"
                : "Buscar por nome, CPF ou CNPJ…"
            }
          />
          <span className="muted">{data?.length ?? 0} cadastros</span>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} retry={reload} />
        ) : !data?.length ? (
          <Empty
            title={"Nenhum " + singular + " encontrado"}
            description="Adicione um cadastro para preencher suas notas com poucos cliques."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {kind === "products" ? "Produto" : "Nome / razão social"}
                  </th>
                  <th>{kind === "products" ? "Código / NCM" : "CPF / CNPJ"}</th>
                  <th>
                    {kind === "products" ? "Valor unitário" : "Município / UF"}
                  </th>
                  <th>Identificação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="table-title">
                        <Icon size={17} />
                        {"name" in row ? row.name : row.description}
                      </div>
                      {"is_default" in row && row.is_default && (
                        <small>Emitente padrão</small>
                      )}
                    </td>
                    <td className="mono">
                      {"document" in row
                        ? row.document
                        : row.code + " / " + row.ncm}
                    </td>
                    <td>
                      {"address" in row
                        ? row.address.city + " / " + row.address.uf
                        : brl(row.unit_price)}
                    </td>
                    <td>
                      <span
                        className={"badge " + (row.is_test ? "warning" : "")}
                      >
                        {row.is_test ? "Dado fictício" : "Cadastrado"}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="icon-button"
                          aria-label={"Editar " + singular}
                          onClick={() => setEditing(structuredClone(row))}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={"Excluir " + singular}
                          onClick={() => setDeleting(row.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <div
          className="modal-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(null);
          }}
        >
          <section
            className="modal large"
            role="dialog"
            aria-modal="true"
            aria-label={"Editar " + singular}
          >
            <div className="modal-heading">
              <h2>
                {editing.id ? "Editar" : "Novo"} {singular}
              </h2>
              <button
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setEditing(null)}
              >
                <X size={20} />
              </button>
            </div>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(save)}>
                <div className="modal-body">
                  {kind === "products" ? (
                    <>
                      <Fields fields={productFields} />
                      <details className="details">
                        <summary>Tributação padrão</summary>
                        <TaxFields />
                      </details>
                    </>
                  ) : (
                    <PartyFields issuer={kind === "issuers"} />
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="button"
                    onClick={() => setEditing(null)}
                  >
                    Cancelar
                  </button>
                  <button className="button primary" disabled={saving}>
                    {saving ? "Salvando…" : "Salvar cadastro"}
                  </button>
                </div>
              </form>
            </FormProvider>
          </section>
        </div>
      )}
      {deleting && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Excluir cadastro"
          >
            <div className="modal-body">
              <h2>Excluir {singular}?</h2>
              <p>
                O cadastro deixará de aparecer nas próximas emissões. As notas
                já geradas preservam seus dados.
              </p>
            </div>
            <div className="modal-footer">
              <button className="button" onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button
                className="button destructive"
                onClick={() => remove(deleting)}
              >
                Excluir cadastro
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
