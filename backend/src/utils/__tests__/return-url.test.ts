import { describe, it, expect, afterEach } from "vitest";
import { isAllowedReturnUrl } from "../return-url";

const ALLOWED = "https://annetatargalt.ee";

describe("isAllowedReturnUrl", () => {
  afterEach(() => {
    delete process.env.EXTERNAL_RETURN_ORIGINS;
  });

  it("accepts an allowlisted origin, with or without a path", () => {
    expect(isAllowedReturnUrl(ALLOWED)).toBe(true);
    expect(isAllowedReturnUrl(`${ALLOWED}/aitah`)).toBe(true);
    expect(isAllowedReturnUrl(`${ALLOWED}/aitah?x=1#y`)).toBe(true);
  });

  it("ignores case in the host", () => {
    expect(isAllowedReturnUrl("https://AnnetaTargalt.EE/aitah")).toBe(true);
  });

  it("rejects an unrelated origin", () => {
    expect(isAllowedReturnUrl("https://evil.example")).toBe(false);
  });

  it("rejects a host that merely contains an allowed one", () => {
    // The two shapes a naive prefix/suffix check would wave through.
    expect(isAllowedReturnUrl("https://annetatargalt.ee.evil.example")).toBe(
      false,
    );
    expect(isAllowedReturnUrl("https://notannetatargalt.ee")).toBe(false);
  });

  it("rejects an allowed host embedded in credentials or a path", () => {
    expect(isAllowedReturnUrl("https://annetatargalt.ee@evil.example/")).toBe(
      false,
    );
    expect(
      isAllowedReturnUrl("https://evil.example/https://annetatargalt.ee"),
    ).toBe(false);
  });

  it("rejects a matching host on a different scheme or port", () => {
    expect(isAllowedReturnUrl("http://annetatargalt.ee")).toBe(false);
    expect(isAllowedReturnUrl("https://annetatargalt.ee:8443")).toBe(false);
  });

  it("rejects non-http schemes that still parse as URLs", () => {
    expect(isAllowedReturnUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedReturnUrl("data:text/html,<script>alert(1)</script>")).toBe(
      false,
    );
  });

  it("rejects relative and malformed values", () => {
    expect(isAllowedReturnUrl("/aitah")).toBe(false);
    expect(isAllowedReturnUrl("//evil.example")).toBe(false);
    expect(isAllowedReturnUrl("not a url")).toBe(false);
  });

  it("rejects non-strings and blanks", () => {
    expect(isAllowedReturnUrl("")).toBe(false);
    expect(isAllowedReturnUrl("   ")).toBe(false);
    expect(isAllowedReturnUrl(undefined)).toBe(false);
    expect(isAllowedReturnUrl(null)).toBe(false);
    expect(isAllowedReturnUrl(42)).toBe(false);
  });

  it("accepts origins added via EXTERNAL_RETURN_ORIGINS", () => {
    expect(isAllowedReturnUrl("https://partner.example/thanks")).toBe(false);

    process.env.EXTERNAL_RETURN_ORIGINS =
      " https://partner.example , https://other.example ";

    expect(isAllowedReturnUrl("https://partner.example/thanks")).toBe(true);
    expect(isAllowedReturnUrl("https://other.example")).toBe(true);
    expect(isAllowedReturnUrl("https://still-evil.example")).toBe(false);
  });

  it("treats a blank EXTERNAL_RETURN_ORIGINS as unset", () => {
    // env.array() would turn this into [""], which matches nothing but also
    // masks the fact that nothing was configured.
    process.env.EXTERNAL_RETURN_ORIGINS = "";
    expect(isAllowedReturnUrl(ALLOWED)).toBe(true);
    expect(isAllowedReturnUrl("https://evil.example")).toBe(false);
  });
});
