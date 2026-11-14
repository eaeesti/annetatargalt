import { describe, expect, it } from "vitest";
import { sitemapEntries } from "../sitemap";

const HOST = "https://site.example";

describe("sitemapEntries", () => {
  const entries = sitemapEntries(
    [
      {
        locale: "et",
        pages: [
          { slug: "/", document: "page:home" },
          { slug: "kkk", document: "page:faq" },
          { slug: "ainult-eesti", document: "page:et-only" },
        ],
      },
      { locale: "en", pages: [{ slug: "faq", document: "page:faq" }] },
    ],
    HOST,
  );
  const entry = (url: string) => entries.find((e) => e.url === url);

  it("lists every page once in each language, the home page included", () => {
    expect(entries.map((e) => e.url)).toEqual([
      HOST,
      `${HOST}/kkk`,
      `${HOST}/ainult-eesti`,
      `${HOST}/en`,
      `${HOST}/en/faq`,
    ]);
  });

  it("pairs each page with its translation", () => {
    const faq = { et: `${HOST}/kkk`, en: `${HOST}/en/faq` };
    expect(entry(`${HOST}/kkk`)?.alternates).toEqual({ languages: faq });
    expect(entry(`${HOST}/en/faq`)?.alternates).toEqual({ languages: faq });
    expect(entry(HOST)?.alternates).toEqual({
      languages: { et: HOST, en: `${HOST}/en` },
    });
    expect(entry(`${HOST}/ainult-eesti`)?.alternates).toBeUndefined();
  });
});
