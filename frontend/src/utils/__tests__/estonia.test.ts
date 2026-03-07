import { describe, it, expect } from "vitest";
import { validateIdCode, formatEstonianAmount, formatEstonianAmountWithCents } from "../estonia";

describe("validateIdCode", () => {
  it("accepts valid Estonian ID codes", () => {
    expect(validateIdCode("49403136515")).toBe(true);
    expect(validateIdCode("37605030299")).toBe(true);
  });

  it("rejects codes with incorrect checksum", () => {
    expect(validateIdCode("49403136516")).toBe(false);
  });

  it("rejects codes with invalid format", () => {
    expect(validateIdCode("12345678901")).toBe(false);
    expect(validateIdCode("123")).toBe(false);
    expect(validateIdCode("")).toBe(false);
  });
});

describe("formatEstonianAmount", () => {
  it("formats whole numbers without cents", () => {
    expect(formatEstonianAmount(1234)).toBe("1234");
    expect(formatEstonianAmount(1)).toBe("1");
  });

  it("adds thousands separator for numbers >= 10000", () => {
    expect(formatEstonianAmount(12345)).toBe("12 345");
    expect(formatEstonianAmount(1000000)).toBe("1 000 000");
  });

  it("formats decimal amounts with comma", () => {
    expect(formatEstonianAmount(1234.56)).toBe("1234,56");
    expect(formatEstonianAmount(1234.5)).toBe("1234,50");
  });

  it("strips trailing ,00", () => {
    expect(formatEstonianAmount(100)).toBe("100");
  });
});

describe("formatEstonianAmountWithCents", () => {
  it("always includes cents", () => {
    expect(formatEstonianAmountWithCents(1234)).toBe("1234,00");
    expect(formatEstonianAmountWithCents(1234.5)).toBe("1234,50");
    expect(formatEstonianAmountWithCents(1234.56)).toBe("1234,56");
  });
});
