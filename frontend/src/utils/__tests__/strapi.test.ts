import { describe, it, expect } from "vitest";
import { getStrapiURL, snakeCaseToPascalCase, strapiSectionNameToReactComponentName } from "../strapi";

describe("getStrapiURL", () => {
  it("returns base URL with empty path", () => {
    expect(getStrapiURL()).toBe("http://127.0.0.1:1337");
  });

  it("appends path to base URL", () => {
    expect(getStrapiURL("/api/pages")).toBe("http://127.0.0.1:1337/api/pages");
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
    expect(strapiSectionNameToReactComponentName("sections.donation-section")).toBe("DonationSection");
    expect(strapiSectionNameToReactComponentName("sections.hero")).toBe("Hero");
    expect(strapiSectionNameToReactComponentName("sections.faq-section")).toBe("FaqSection");
  });

  it("uses the part after the dot", () => {
    expect(strapiSectionNameToReactComponentName("other-ns.my-component")).toBe("MyComponent");
  });
});
