import { describe, expect, it } from "vitest";
import { automationSchema } from "./Automatic";
describe("automation constraints", () => {
  const options = {
    min_products: 1,
    max_products: 3,
    min_value: "100",
    max_value: "1000",
    existing_only: false,
    allow_fictitious: true,
  };
  it("accepts a coherent range", () =>
    expect(automationSchema.safeParse(options).success).toBe(true));
  it("rejects reversed quantity bounds", () =>
    expect(
      automationSchema.safeParse({ ...options, min_products: 4 }).success,
    ).toBe(false));
  it("rejects reversed value bounds", () =>
    expect(
      automationSchema.safeParse({ ...options, min_value: "2000" }).success,
    ).toBe(false));
  it("rejects negative amounts", () =>
    expect(
      automationSchema.safeParse({ ...options, min_value: "-1" }).success,
    ).toBe(false));
});
