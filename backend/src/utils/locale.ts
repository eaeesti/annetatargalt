/**
 * The site's languages, as Strapi locale codes. Estonian is the default.
 */
export const LOCALES = ["et", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "et";

/** A site language from untrusted input, falling back to the default. */
export function toLocale(value: unknown): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}
