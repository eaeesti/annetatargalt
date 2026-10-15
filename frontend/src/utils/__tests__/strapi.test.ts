import { describe, it, expect } from "vitest";
import {
  describeErrorResponse,
  getStrapiURL,
  snakeCaseToPascalCase,
  strapiSectionNameToReactComponentName,
} from "../strapi";

describe("getStrapiURL", () => {
  it("returns base URL with empty path", () => {
    expect(getStrapiURL()).toBe("http://127.0.0.1:1337");
  });

  it("appends path to base URL", () => {
    expect(getStrapiURL("/api/pages")).toBe("http://127.0.0.1:1337/api/pages");
  });
});

describe("describeErrorResponse", () => {
  it("uses Strapi's error name and message", async () => {
    const response = Response.json(
      { error: { name: "ValidationError", message: "Invalid email" } },
      { status: 400, statusText: "Bad Request" },
    );
    expect(await describeErrorResponse(response)).toBe(
      "ValidationError: Invalid email",
    );
  });

  it("falls back to the status for a proxy's HTML error page", async () => {
    const response = new Response("<html>502 Bad Gateway</html>", {
      status: 502,
      statusText: "Bad Gateway",
    });
    expect(await describeErrorResponse(response)).toBe("502 Bad Gateway");
  });

  it("falls back to the status for JSON that isn't a Strapi error", async () => {
    const response = Response.json({ message: "nope" }, { status: 500 });
    expect(await describeErrorResponse(response)).toBe("500");
  });
});

describe("snakeCaseToPascalCase", () => {
  it("converts a single word", () => {
    expect(snakeCaseToPascalCase("hero")).toBe("Hero");
  });

  it("converts kebab-case to PascalCase", () => {
    expect(snakeCaseToPascalCase("donation-section")).toBe("DonationSection");
    expect(snakeCaseToPascalCase("hero-section")).toBe("HeroSection");
  });

  it("handles multiple segments", () => {
    expect(snakeCaseToPascalCase("a-b-c")).toBe("ABC");
  });
});

describe("strapiSectionNameToReactComponentName", () => {
  it("converts a Strapi component UID to a React component name", () => {
    expect(
      strapiSectionNameToReactComponentName("sections.donation-section"),
    ).toBe("DonationSection");
    expect(strapiSectionNameToReactComponentName("sections.hero")).toBe("Hero");
    expect(strapiSectionNameToReactComponentName("sections.faq-section")).toBe(
      "FaqSection",
    );
  });

  it("uses the part after the dot", () => {
    expect(strapiSectionNameToReactComponentName("other-ns.my-component")).toBe(
      "MyComponent",
    );
  });
});
