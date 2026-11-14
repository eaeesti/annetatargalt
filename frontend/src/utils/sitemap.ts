import type { MetadataRoute } from "next";
import type { SitemapPage } from "./cms";
import { pagePath, type Locale } from "./locale";

/**
 * The sitemap's entries, in each public language. A document's translations
 * share its documentId in Strapi, so each entry names the page in every
 * language it has (hreflang), as the pages' own alternate links do. The home
 * page is one document in every language.
 */
export function sitemapEntries(
  pagesByLocale: { locale: Locale; pages: SitemapPage[] }[],
  hostUrl: string,
): MetadataRoute.Sitemap {
  const url = (slug: string, locale: Locale) => {
    const path = pagePath(slug, locale);
    return path === "/" ? hostUrl : `${hostUrl}${path}`;
  };
  const withHome = pagesByLocale.map(({ locale, pages }) => {
    const unique = new Map<string, SitemapPage>([
      ["/", { slug: "/", document: "home" }],
    ]);
    for (const page of pages) {
      if (!unique.has(page.slug)) unique.set(page.slug, page);
    }
    return { locale, pages: [...unique.values()] };
  });

  const languages = new Map<string, Partial<Record<Locale, string>>>();
  for (const { locale, pages } of withHome) {
    for (const page of pages) {
      const urls = languages.get(page.document) ?? {};
      urls[locale] = url(page.slug, locale);
      languages.set(page.document, urls);
    }
  }

  return withHome.flatMap(({ locale, pages }) =>
    pages.map((page) => {
      const urls = languages.get(page.document) ?? {};
      return {
        url: url(page.slug, locale),
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: page.slug === "/" ? 1 : 0.8,
        ...(Object.keys(urls).length > 1
          ? { alternates: { languages: urls } }
          : {}),
      };
    }),
  );
}
