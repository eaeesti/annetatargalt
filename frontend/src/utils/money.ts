import { formatEstonianAmount, formatEstonianAmountWithCents } from "./estonia";
import type { Locale } from "./locale";

const english = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * An amount in a site language's style, with cents.
 * @example
 * formatAmountWithCents(1234.5, "et"); // "1234,50"
 * formatAmountWithCents(1234.5, "en"); // "1,234.50"
 */
export function formatAmountWithCents(amount: number, locale: Locale): string {
  return locale === "en"
    ? english.format(amount)
    : formatEstonianAmountWithCents(amount);
}

/** Like formatAmountWithCents, but without the cents when they're zero. */
export function formatAmount(amount: number, locale: Locale): string {
  return locale === "en"
    ? english.format(amount).replace(/\.00$/, "")
    : formatEstonianAmount(amount);
}

/** A formatted amount with its currency: "25€" in Estonian, "€25" in English. */
export function withCurrency(
  amount: string | number,
  currency: string | null | undefined,
  locale: Locale,
): string {
  return locale === "en"
    ? `${currency ?? ""}${amount}`
    : `${amount}${currency ?? ""}`;
}
