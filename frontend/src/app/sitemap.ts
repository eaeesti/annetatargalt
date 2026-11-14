import type { MetadataRoute } from "next";
import { isLaunched } from "@/components/CmsRoute";
import { findGlobal, getSitemapPages, type SitemapPage } from "@/utils/cms";
import { LOCALES, type Locale } from "@/utils/locale";
import { sitemapEntries } from "@/utils/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host_url = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const pagesByLocale: { locale: Locale; pages: SitemapPage[] }[] = [];
  for (const locale of LOCALES) {
    // A language that isn't public yet stays out, so search engines don't
    // find it before its reviewers are done.
    if (locale !== "et") {
      const global = await findGlobal(locale);
      if (!global || !isLaunched(global)) continue;
    }
    pagesByLocale.push({ locale, pages: await getSitemapPages(locale) });
  }
  return sitemapEntries(pagesByLocale, host_url);
}
