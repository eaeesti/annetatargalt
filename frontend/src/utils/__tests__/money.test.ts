import { describe, it, expect } from "vitest";
import { formatAmount, formatAmountWithCents, withCurrency } from "../money";

describe("formatAmountWithCents", () => {
  it("keeps the Estonian style for Estonian", () => {
    expect(formatAmountWithCents(1234.5, "et")).toBe("1234,50");
    expect(formatAmountWithCents(12345, "et")).toBe("12 345,00");
  });

  it("uses a decimal point and thousands commas for English", () => {
    expect(formatAmountWithCents(1234.5, "en")).toBe("1,234.50");
    expect(formatAmountWithCents(25, "en")).toBe("25.00");
  });
});

describe("formatAmount", () => {
  it("drops whole cents in both languages", () => {
    expect(formatAmount(25, "et")).toBe("25");
    expect(formatAmount(25, "en")).toBe("25");
    expect(formatAmount(12000, "en")).toBe("12,000");
  });

  it("keeps real cents", () => {
    expect(formatAmount(26.25, "et")).toBe("26,25");
    expect(formatAmount(26.25, "en")).toBe("26.25");
  });
});

describe("withCurrency", () => {
  it("puts the sign after the amount in Estonian and before it in English", () => {
    expect(withCurrency("25", "€", "et")).toBe("25€");
    expect(withCurrency(25, "€", "en")).toBe("€25");
  });

  it("leaves a missing currency out", () => {
    expect(withCurrency("25", null, "en")).toBe("25");
  });
});
