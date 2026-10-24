import { describe, it, expect } from "vitest";
import { cleanFileName, inlineDisposition, isPdf } from "../pdf-file";

describe("isPdf", () => {
  it("accepts a file starting with the PDF header", () => {
    expect(isPdf(Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj"))).toBe(true);
  });

  it("accepts a header a few bytes in, as PDF readers do", () => {
    expect(
      isPdf(Buffer.concat([Buffer.alloc(16), Buffer.from("%PDF-1.4")])),
    ).toBe(true);
  });

  it("refuses anything else", () => {
    expect(
      isPdf(Buffer.from("<html><body>%PDF-</body></html>".padStart(1100))),
    ).toBe(false);
    expect(isPdf(Buffer.from("PK\x03\x04 a zip file"))).toBe(false);
    expect(isPdf(Buffer.alloc(0))).toBe(false);
  });
});

describe("cleanFileName", () => {
  it("keeps an ordinary name", () => {
    expect(cleanFileName("Receipt AB12CD.pdf")).toBe("Receipt AB12CD.pdf");
  });

  it("drops folders, control characters and extra spaces", () => {
    expect(cleanFileName("..\\..\\x/receipt.pdf")).toBe("receipt.pdf");
    expect(cleanFileName("  two\tparts \n\u0000here.pdf ")).toBe(
      "two parts here.pdf",
    );
  });

  it("names a file that has no usable name", () => {
    expect(cleanFileName(null)).toBe("document.pdf");
    expect(cleanFileName("folder/")).toBe("document.pdf");
    expect(cleanFileName("\u0001\u0002")).toBe("document.pdf");
  });

  it("shortens a long name but keeps its extension", () => {
    const name = cleanFileName(`${"a".repeat(300)}.pdf`);
    expect(name).toHaveLength(255);
    expect(name.endsWith("a.pdf")).toBe(true);
  });
});

describe("inlineDisposition", () => {
  it("opens the file in the browser under its own name", () => {
    expect(inlineDisposition("Receipt AB12CD.pdf")).toBe(
      `inline; filename="Receipt AB12CD.pdf"; filename*=UTF-8''Receipt%20AB12CD.pdf`,
    );
  });

  it("gives non-ASCII names an ASCII stand-in and a UTF-8 original", () => {
    expect(inlineDisposition("Kinnitus õäöü (1).pdf")).toBe(
      `inline; filename="Kinnitus oaou (1).pdf"; filename*=UTF-8''Kinnitus%20%C3%B5%C3%A4%C3%B6%C3%BC%20%281%29.pdf`,
    );
  });

  it("can't be broken out of by quotes", () => {
    expect(inlineDisposition('a"; filename="evil.html.pdf')).toBe(
      `inline; filename="a; filename=evil.html.pdf"; filename*=UTF-8''a%22%3B%20filename%3D%22evil.html.pdf`,
    );
  });
});
