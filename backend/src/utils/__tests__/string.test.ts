import { describe, it, expect } from "vitest";
import { format } from "../string";

describe("format", () => {
  it("replaces every occurrence of a placeholder", () => {
    // Emails greet and thank the donor by name: the closing one used to stay
    // a literal "<%= firstName %>".
    expect(
      format("Hea <%= firstName %> … Suur tänu, <%= firstName %>!", {
        firstName: "Mari",
      }),
    ).toBe("Hea Mari … Suur tänu, Mari!");
  });

  it("replaces several placeholders", () => {
    expect(
      format("<%= amount %><%= currency %>", { amount: "25", currency: "€" }),
    ).toBe("25€");
  });

  it("inserts values literally, even with $ patterns", () => {
    expect(format("Hi <%= name %>", { name: "A$&B$1" })).toBe("Hi A$&B$1");
  });
});
