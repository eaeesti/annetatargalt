/**
 * The site's languages. Estonian is the default and lives at the root;
 * English lives under /en. The Strapi locales have the same codes.
 */
export const LOCALES = ["et", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "et";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/** The locale of something Strapi returned, falling back to the default. */
export function localeOf(entry: { locale?: string | null } | null | undefined) {
  return isLocale(entry?.locale) ? entry.locale : DEFAULT_LOCALE;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "et" ? "en" : "et";
}

/** "" for Estonian, "/en" for English. */
export function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "" : `/${locale}`;
}

/**
 * The URL path of a slug in a locale: "/" and "kkk" in Estonian become "/"
 * and "/kkk"; in English, "/en" and "/en/faq".
 */
export function pagePath(slug: string, locale: Locale): string {
  const path = slug === "/" ? "" : `/${slug.replace(/^\/+/, "")}`;
  return `${localePrefix(locale)}${path}` || "/";
}
