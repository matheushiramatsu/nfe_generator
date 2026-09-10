import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, brl } from "./api";
afterEach(() => vi.unstubAllGlobals());
describe("API adapter", () => {
  it("preserves field-level validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 422,
          json: async () => ({
            detail: [
              {
                path: "items.0.ncm",
                message: "NCM deve possuir 8 números.",
                severity: "error",
              },
            ],
          }),
        }),
    );
    try {
      await api("/invoices/generate", "POST", {});
      throw new Error("should reject");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).issues[0].path).toBe("items.0.ncm");
    }
  });
  it("formats decimal strings as BRL", () =>
    expect(brl("1234.56")).toContain("1.234,56"));
});
