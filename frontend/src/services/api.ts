import type { Issue } from "../types/domain";
export class ApiError extends Error {
  constructor(
    public issues: Issue[],
    public status: number,
  ) {
    super(issues.map((i) => i.message).join(" "));
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    throw new ApiError(
      Array.isArray(detail)
        ? detail
        : [
            {
              path: "",
              message:
                typeof detail === "string"
                  ? detail
                  : "Não foi possível concluir a operação.",
              severity: "error",
            },
          ],
      response.status,
    );
  }
  return data as T;
}
export const brl = (value: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
export const date = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
