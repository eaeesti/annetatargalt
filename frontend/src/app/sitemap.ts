import type { MetadataRoute } from "next";
import { isLaunched } from "@/components/CmsRoute";
import { findGlobal, getAllSlugs } from "@/utils/strapi";
import { LOCALES, pagePath } from "@/utils/locale";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host_url = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    // A language that isn't public yet stays out, so search engines don't
    // find it before its reviewers are done.
    if (locale !== "et") {
      const global = await findGlobal(locale);
      if (!global || !isLaunched(global)) continue;
    }

    const slugs = ["/", ...(await getAllSlugs(locale))];
    for (const slug of new Set(slugs)) {
      const path = pagePath(slug, locale);
      entries.push({
        url: path === "/" ? host_url : `${host_url}${path}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: slug === "/" ? 1 : 0.8,
      });
    }
  }
  return entries;
}
