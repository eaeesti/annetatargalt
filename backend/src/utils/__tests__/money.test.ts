import { describe, it, expect } from "vitest";
import { formatAmount, withCurrency } from "../money";
import { toLocale } from "../locale";

describe("formatAmount", () => {
  it("keeps the Estonian style for Estonian", () => {
    expect(formatAmount(1234.5, "et")).toBe("1 234,50");
    expect(formatAmount(25, "et")).toBe("25");
  });

  it("uses a decimal point and thousands commas for English", () => {
    expect(formatAmount(1234.5, "en")).toBe("1,234.50");
    expect(formatAmount(0.05, "en")).toBe("0.05");
  });

  it("drops whole cents in English too", () => {
    expect(formatAmount(25, "en")).toBe("25");
    expect(formatAmount(12000, "en")).toBe("12,000");
  });
});

describe("withCurrency", () => {
  it("puts the sign after the amount in Estonian and before it in English", () => {
    expect(withCurrency("25", "€", "et")).toBe("25€");
    expect(withCurrency("25", "€", "en")).toBe("€25");
  });

  it("leaves a missing currency out", () => {
    expect(withCurrency("25", null, "en")).toBe("25");
  });
});

describe("toLocale", () => {
  it("accepts the site's languages", () => {
    expect(toLocale("en")).toBe("en");
    expect(toLocale("et")).toBe("et");
  });

  it("falls back to Estonian for anything else", () => {
    expect(toLocale("de")).toBe("et");
    expect(toLocale(undefined)).toBe("et");
    expect(toLocale(["en"])).toBe("et");
  });
});
