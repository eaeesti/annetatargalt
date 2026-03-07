import { describe, it, expect } from "vitest";
import { format, validatePrice, validateEmail } from "../string";

describe("format", () => {
  it("replaces a single placeholder", () => {
    expect(format("Hello <%= name %>", { name: "World" })).toBe("Hello World");
  });

  it("replaces multiple placeholders", () => {
    expect(format("<%= greeting %>, <%= name %>!", { greeting: "Hi", name: "Alice" })).toBe("Hi, Alice!");
  });

  it("leaves unmatched placeholders untouched", () => {
    expect(format("Hello <%= name %>", {})).toBe("Hello <%= name %>");
  });
});

describe("validatePrice", () => {
  it("accepts valid prices", () => {
    expect(validatePrice("1")).toBe(true);
    expect(validatePrice("1.23")).toBe(true);
    expect(validatePrice("1,23")).toBe(true);
    expect(validatePrice("1.2")).toBe(true);
    expect(validatePrice("123")).toBe(true);
    expect(validatePrice("99")).toBe(true);
  });

  it("rejects invalid prices", () => {
    expect(validatePrice("1.")).toBe(false);
    expect(validatePrice("1,")).toBe(false);
    expect(validatePrice("1.234")).toBe(false);
    expect(validatePrice("0.23")).toBe(false);
    expect(validatePrice("0")).toBe(false);
    expect(validatePrice("01")).toBe(false);
    expect(validatePrice("")).toBe(false);
    expect(validatePrice("hehe")).toBe(false);
  });
});

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("test@example.com")).toBe(true);
    expect(validateEmail("user.name+tag@domain.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(validateEmail("notanemail")).toBe(false);
    expect(validateEmail("missing@")).toBe(false);
    expect(validateEmail("@nodomain")).toBe(false);
    expect(validateEmail("")).toBe(false);
  });
});
