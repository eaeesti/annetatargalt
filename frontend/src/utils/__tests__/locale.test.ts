import { describe, it, expect } from "vitest";
import {
  isLocale,
  localeOf,
  localePrefix,
  otherLocale,
  pagePath,
} from "../locale";

describe("pagePath", () => {
  it("keeps Estonian at the root", () => {
    expect(pagePath("/", "et")).toBe("/");
    expect(pagePath("kkk", "et")).toBe("/kkk");
    expect(pagePath("kuhu-annetada/inimeste-heaolu", "et")).toBe(
      "/kuhu-annetada/inimeste-heaolu",
    );
  });

  it("puts English under /en", () => {
    expect(pagePath("/", "en")).toBe("/en");
    expect(pagePath("faq", "en")).toBe("/en/faq");
    expect(pagePath("/where-to-donate", "en")).toBe("/en/where-to-donate");
  });
});

describe("locale helpers", () => {
  it("recognises only the site's locales", () => {
    expect(isLocale("et")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fi")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("reads an entry's locale, defaulting to Estonian", () => {
    expect(localeOf({ locale: "en" })).toBe("en");
    expect(localeOf({ locale: null })).toBe("et");
    expect(localeOf(undefined)).toBe("et");
  });

  it("knows the other language and its prefix", () => {
    expect(otherLocale("et")).toBe("en");
    expect(otherLocale("en")).toBe("et");
    expect(localePrefix("et")).toBe("");
    expect(localePrefix("en")).toBe("/en");
  });
});
