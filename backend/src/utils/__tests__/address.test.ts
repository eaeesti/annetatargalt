import { describe, expect, it } from "vitest";
import { normalAddress } from "../address";

describe("normalAddress", () => {
  it("is the address in lower case, without the spaces around it", () => {
    expect(normalAddress("  Mari@Example.org ")).toBe("mari@example.org");
  });

  it("trims only spaces, as SQL's trim does", () => {
    expect(normalAddress("mari@example.org\t")).toBe("mari@example.org\t");
    expect(normalAddress("mari@example.org ")).toBe("mari@example.org ");
  });
});
