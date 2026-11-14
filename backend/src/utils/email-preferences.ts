/*
 * A donor's settings for the emails besides the confirmations of their
 * donations, as the page in each email and the admin panel change them.
 */

import type { EmailKind } from "./email-campaign";
import { LOCALES, type Locale } from "./locale";
import { oneOf } from "./narrow";

export const EMAIL_PREFERENCES = [
  "newsletter",
  "transferEmails",
  "yearlyEmails",
] as const;

export type EmailPreference = (typeof EMAIL_PREFERENCES)[number];
export type EmailPreferences = Partial<Record<EmailPreference, boolean>> & {
  /** The language of these emails; null for the one the donor last gave in. */
  emailLocale?: Locale | null;
};

/** The setting a donor turns off to stop getting a kind of email. */
export const SETTING_OF_KIND = {
  newsletter: "newsletter",
  transfer: "transferEmails",
  yearly: "yearlyEmails",
} as const satisfies Record<EmailKind, EmailPreference>;

/**
 * What a mail client's unsubscribe button stops: the kind of email it was
 * in, or, in a confirmation of a donation, which can't be stopped, every
 * kind that can.
 */
export type UnsubscribeKind = EmailKind | "all";

/** The settings an unsubscribe button turns off. */
export function unsubscribing(kind: UnsubscribeKind): EmailPreferences {
  if (kind !== "all") return { [SETTING_OF_KIND[kind]]: false };
  const changes: EmailPreferences = {};
  for (const preference of EMAIL_PREFERENCES) changes[preference] = false;
  return changes;
}

/**
 * The settings a request changes: each one its body has, as true or false,
 * and the language as a locale or null. What's wrong instead, when one of
 * them is anything else.
 */
export function preferenceChanges(
  body: Record<string, unknown>,
): { changes: EmailPreferences } | { error: string } {
  const changes: EmailPreferences = {};
  for (const preference of EMAIL_PREFERENCES) {
    const value = body[preference];
    if (typeof value === "boolean") changes[preference] = value;
    else if (value !== undefined) {
      return { error: `${preference} must be true or false` };
    }
  }
  const locale = body.emailLocale;
  if (locale === null) changes.emailLocale = null;
  else if (locale !== undefined) {
    const known = oneOf(locale, LOCALES);
    if (!known) {
      return { error: `emailLocale must be ${LOCALES.join(" or ")} or null` };
    }
    changes.emailLocale = known;
  }
  return { changes };
}
