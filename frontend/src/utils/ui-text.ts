import type { Locale } from "./locale";

/**
 * Labels only screen readers announce. Everything visible comes from Strapi;
 * these are too small to be worth an editor's attention there.
 */
const UI_TEXT = {
  et: {
    openMenu: "Ava menüü",
    closeMenu: "Sulge menüü",
    breadcrumbs: "Leivapururada",
  },
  en: {
    openMenu: "Open main menu",
    closeMenu: "Close menu",
    breadcrumbs: "Breadcrumbs",
  },
} satisfies Record<Locale, Record<string, string>>;

export function uiText(locale: Locale) {
  return UI_TEXT[locale];
}
