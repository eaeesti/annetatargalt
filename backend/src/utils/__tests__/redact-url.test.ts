import { describe, it, expect } from "vitest";
import { redactUrl } from "../redact-url";

describe("redactUrl", () => {
  it("leaves a URL without sensitive parameters unchanged", () => {
    expect(redactUrl("/api/pages")).toBe("/api/pages");
    expect(redactUrl("/api/pages?filters%5Bslug%5D=blogi&populate=*")).toBe(
      "/api/pages?filters%5Bslug%5D=blogi&populate=*",
    );
  });

  it("blanks the order token", () => {
    expect(redactUrl("/api/confirm?order-token=eyJhbGciOi.eyJzZW5k.c2ln")).toBe(
      "/api/confirm?order-token=[redacted]",
    );
  });

  it("keeps the other parameters around it", () => {
    expect(redactUrl("/api/confirm?a=1&order-token=eyJ.x.y&b=2")).toBe(
      "/api/confirm?a=1&order-token=[redacted]&b=2",
    );
  });

  it("blanks every occurrence, whatever the case of the name", () => {
    expect(redactUrl("/api/confirm?Order-Token=one&order-token=two")).toBe(
      "/api/confirm?Order-Token=[redacted]&order-token=[redacted]",
    );
  });

  it("leaves a parameter that only ends in the same name alone", () => {
    expect(redactUrl("/api/x?reorder-token=keep")).toBe(
      "/api/x?reorder-token=keep",
    );
  });
});
