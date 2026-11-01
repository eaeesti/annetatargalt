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
    fewerAdults: "Vähem täiskasvanuid",
    moreAdults: "Rohkem täiskasvanuid",
    fewerChildren: "Vähem lapsi",
    moreChildren: "Rohkem lapsi",
    close: "Sulge",
  },
  en: {
    openMenu: "Open main menu",
    closeMenu: "Close menu",
    breadcrumbs: "Breadcrumbs",
    fewerAdults: "Fewer adults",
    moreAdults: "More adults",
    fewerChildren: "Fewer children",
    moreChildren: "More children",
    close: "Close",
  },
} satisfies Record<Locale, Record<string, string>>;

export function uiText(locale: Locale) {
  return UI_TEXT[locale];
}
