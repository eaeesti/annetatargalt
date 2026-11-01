import type { Core } from "@strapi/strapi";
import { emailLayout, emailTextFooter } from "./utils/email-layout";
import { emailPreferencesToken } from "./utils/email-token";
import {
  emailService,
  type EmailRecipient,
  type EmailTemplate,
  type MailMessage,
} from "./strapi-internals";
import type { EmailKind } from "./utils/email-campaign";
import type { UnsubscribeKind } from "./utils/email-preferences";
import { DEFAULT_LOCALE, type Locale } from "./utils/locale";
import { isRecord } from "./utils/narrow";

/**
 * Something from the CMS in a language, or in Estonian when it has no version
 * in that language.
 */
export async function inLocale<T>(
  locale: Locale,
  find: (locale: Locale) => Promise<T | null>,
): Promise<T | null> {
  const found = await find(locale);
  return found || locale === DEFAULT_LOCALE ? found : find(DEFAULT_LOCALE);
}

export function findEmailConfig(strapi: Core.Strapi, locale: Locale) {
  return inLocale(locale, (l) =>
    strapi.documents("api::email-config.email-config").findFirst({ locale: l }),
  );
}

/**
 * The link to that page when the email config has no text for it: every
 * email to a donor has the link.
 */
const PREFERENCES_LINK_TEXTS: Record<Locale, string> = {
  et: "Vali, milliseid e-kirju meilt saad",
  en: "Choose which emails you get from us",
};

/** What the links to that page are signed with: the app's first key. */
export function emailTokenSecret(strapi: Core.Strapi): string {
  const keys: unknown = strapi.config.get("server.app.keys");
  const key: unknown = Array.isArray(keys) ? keys[0] : null;
  if (typeof key !== "string" || !key) {
    throw new Error("The app has no key to sign email links with");
  }
  return key;
}

/**
 * The page where a donor chooses which emails to get, in a language: an
 * address on the site that sends them on to wherever the CMS has that page
 * now, so a page renamed there breaks no link already sent. Without a
 * token, it shows no one's choices.
 */
function preferencesPageUrl(locale: Locale): string {
  return `${process.env.FRONTEND_URL}/api/email-settings?${new URLSearchParams({ locale })}`;
}

/**
 * The page where a donor chooses which emails to get, with their token. The
 * token is in the fragment, which browsers never send: no server's log, and
 * no Referer the page's own requests carry, ever has it.
 */
export function emailPreferencesUrl(
  strapi: Core.Strapi,
  donorId: number,
  locale: Locale,
): string {
  const token = emailPreferencesToken(donorId, emailTokenSecret(strapi));
  return `${preferencesPageUrl(locale)}#${new URLSearchParams({ token })}`;
}

/** The logo at the top of every email, from the site's navbar. */
async function findLogo(strapi: Core.Strapi, locale: Locale) {
  const global = await inLocale(locale, (l) =>
    strapi.documents("api::global.global").findFirst({
      locale: l,
      populate: { navbar: { populate: { logo: { populate: ["file"] } } } },
    }),
  );
  const logo = global?.navbar?.logo;
  const logoUrl = logo?.file?.url;
  return logoUrl ? { url: logoUrl, alt: logo?.alt ?? "" } : null;
}

type Logo = Awaited<ReturnType<typeof findLogo>>;

interface FrameTexts {
  footerText?: string | null;
  preferencesLinkText?: string | null;
}

/**
 * What every email has around its text: the logo, who sends it and, for a
 * donor, the link to `preferencesUrl`, the page where they choose which
 * emails to get.
 */
function frame(
  locale: Locale,
  logo: Logo,
  emailConfig: FrameTexts,
  preferencesUrl: string | null,
) {
  return {
    logo,
    footer: emailConfig.footerText?.trim() || null,
    preferences: preferencesUrl
      ? {
          url: preferencesUrl,
          text:
            emailConfig.preferencesLinkText?.trim() ||
            PREFERENCES_LINK_TEXTS[locale],
        }
      : null,
  };
}

interface SendEmailOptions {
  recipient: EmailRecipient;
  template: EmailTemplate;
  /** The values for the template's <%= %> fields. */
  data: Record<string, unknown>;
  locale: Locale;
  emailConfig: FrameTexts;
  /**
   * The donor it's to, whose emails link to the page where they choose
   * which emails to get; null for anyone else.
   */
  donorId: number | null;
}

/**
 * Send an email written in Strapi's email config, laid out with the logo and
 * the footer. Strapi fills in the <%= %> fields after the layout is added,
 * and nothing the layout adds has any.
 */
export async function sendEmail(
  strapi: Core.Strapi,
  { recipient, template, data, locale, emailConfig, donorId }: SendEmailOptions,
): Promise<void> {
  // A receipt goes out without the logo rather than not at all.
  const logo = await findLogo(strapi, locale).catch((error: unknown) => {
    strapi.log.error(`The emails' logo couldn't be read: ${String(error)}`);
    return null;
  });
  const { footer, preferences } = frame(
    locale,
    logo,
    emailConfig,
    donorId ? emailPreferencesUrl(strapi, donorId, locale) : null,
  );

  await emailService(strapi).sendTemplatedEmail(
    {
      ...recipient,
      // A confirmation can't be stopped: its button stops all the rest.
      headers: unsubscribeHeaders(
        strapi,
        locale,
        donorId ? { id: donorId, stops: "all" } : null,
      ),
    },
    {
      subject: template.subject,
      text: template.text
        ? template.text + emailTextFooter({ footer, preferences })
        : template.text,
      html: template.html
        ? emailLayout({
            body: template.html,
            locale,
            logo,
            footer,
            preferences,
          })
        : template.html,
    },
    data,
  );
}

/** What the CMS gives an email from the admin panel in one language. */
interface CampaignFrame {
  logo: Logo;
  emailConfig: (FrameTexts & { confirmationReplyTo?: string | null }) | null;
}

/**
 * The CMS's part of the emails from the admin panel, read once per language
 * and kept: a send of hundreds of emails doesn't read it for every one.
 */
export type CampaignFrames = (locale: Locale) => Promise<CampaignFrame>;

export function campaignFrames(strapi: Core.Strapi): CampaignFrames {
  const read = new Map<Locale, Promise<CampaignFrame>>();
  return (locale) => {
    const known = read.get(locale);
    if (known) return known;
    const reading = (async () => ({
      logo: await findLogo(strapi, locale),
      emailConfig: await findEmailConfig(strapi, locale),
    }))();
    read.set(locale, reading);
    // A read that failed isn't kept: the next copy reads again, instead of
    // every copy left in that language failing with it.
    reading.catch(() => read.delete(locale));
    return reading;
  };
}

/**
 * A copy of an email from the admin panel, laid out: a donor's, whose copy
 * links to the page where they choose which emails to get, or, with a null
 * donorId, a test or a preview, whose link shows no one's choices.
 */
export async function layOutCampaignEmail(
  strapi: Core.Strapi,
  {
    html,
    text,
    locale,
    donorId,
  }: { html: string; text: string; locale: Locale; donorId: number | null },
  frames: CampaignFrames = campaignFrames(strapi),
) {
  const { logo, emailConfig } = await frames(locale);
  const { footer, preferences } = frame(
    locale,
    logo,
    emailConfig ?? {},
    donorId
      ? emailPreferencesUrl(strapi, donorId, locale)
      : preferencesPageUrl(locale),
  );
  return {
    html: emailLayout({ body: html, locale, logo, footer, preferences }),
    text: text + emailTextFooter({ footer, preferences }),
    replyTo: emailConfig?.confirmationReplyTo ?? null,
  };
}

/**
 * Where a mail client's own unsubscribe button posts to. It's on the site,
 * which passes it on: the backend doesn't know its own public address.
 *
 * The donor's token has to be in this address: the client posts to it as it
 * is (RFC 8058), and it's all that says whose emails to stop. It's the one
 * address with a token in its query string.
 */
function unsubscribeUrl(
  strapi: Core.Strapi,
  donorId: number,
  kind: UnsubscribeKind,
  locale: Locale,
): string {
  const token = emailPreferencesToken(donorId, emailTokenSecret(strapi));
  // With the email's language, for someone who opens the link instead: the
  // site takes them to the settings page in it.
  return `${process.env.FRONTEND_URL}/api/unsubscribe?${new URLSearchParams({ token, kind, locale })}`;
}

/**
 * The headers of a mail client's unsubscribe button, which every email of
 * ours has: Brevo, which sends them, gives one without its own, whose one
 * click puts the address on Brevo's list of those it no longer delivers to,
 * confirmations of donations included, without us ever knowing.
 *
 * For a donor, one click stops `donor.stops`. Anyone else, as the team or
 * the one a donation was dedicated to, has nothing of ours to stop: their
 * button opens the page for choosing emails, which doesn't do anything by
 * itself.
 */
export function unsubscribeHeaders(
  strapi: Core.Strapi,
  locale: Locale,
  donor: { id: number; stops: UnsubscribeKind } | null,
): Record<string, string> {
  return donor
    ? {
        "List-Unsubscribe": `<${unsubscribeUrl(strapi, donor.id, donor.stops, locale)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : { "List-Unsubscribe": `<${preferencesPageUrl(locale)}>` };
}

export interface SendCampaignEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  locale: Locale;
  /**
   * The donor whose copy it is, whose unsubscribing it offers; null for a
   * test to someone on the team, which offers no one's.
   */
  donorId: number | null;
  kind: EmailKind;
}

/**
 * A copy of an email from the admin panel as it goes to the mail server:
 * laid out, and with the headers of an unsubscribe button, which for a
 * donor stops that kind of email.
 */
export async function campaignMessage(
  strapi: Core.Strapi,
  { to, subject, html, text, locale, donorId, kind }: SendCampaignEmailOptions,
  frames?: CampaignFrames,
): Promise<MailMessage> {
  const laidOut = await layOutCampaignEmail(
    strapi,
    { html, text, locale, donorId },
    frames,
  );
  return {
    to,
    replyTo: laidOut.replyTo,
    subject,
    html: laidOut.html,
    text: laidOut.text,
    headers: unsubscribeHeaders(
      strapi,
      locale,
      donorId ? { id: donorId, stops: kind } : null,
    ),
  };
}

/** System errors that mean the mail server was never reached. */
const UNREACHED = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

/**
 * Nodemailer's timeouts while connecting: to the server, for its greeting,
 * starting TLS. It names every connection error's command "CONN", so these
 * are what tell one from before the email was sent.
 */
const CONNECTING_TIMEOUTS = new Set([
  "CONNECT_TIMEOUT",
  "GREETING_TIMEOUT",
  "UPGRADE_TIMEOUT",
]);

/**
 * What an email whose sending failed means for it:
 *
 * - "refused": the server refused its address for good, a permanent
 *   reply to RCPT TO. Another address may well go through.
 * - "deferred": the server refused its address for now, as for a full
 *   mailbox, a temporary reply to RCPT TO other than 421, which closes the
 *   connection. Another address may well go through.
 * - "notTaken": the server surely didn't take it, but not for its address:
 *   it said no to something else, such as the sign-in or "try again later",
 *   or it was never reached, or nodemailer never asked it. The next email
 *   would most likely fail the same way.
 * - "maybeTaken": the connection went in a way that leaves it open whether
 *   the server took it, as while waiting for its reply.
 */
export function sendFailure(
  error: unknown,
): "refused" | "deferred" | "notTaken" | "maybeTaken" {
  if (!isRecord(error)) return "maybeTaken";
  if (error.command === "RCPT TO" && error.permanent === true) {
    return "refused";
  }
  if (
    error.command === "RCPT TO" &&
    typeof error.responseCode === "number" &&
    error.responseCode >= 400 &&
    error.responseCode < 500 &&
    error.responseCode !== 421
  ) {
    return "deferred";
  }
  if (typeof error.responseCode === "number" || error.command === "API") {
    return "notTaken";
  }
  const connecting =
    error.code === "EDNS" ||
    error.code === "ETLS" ||
    CONNECTING_TIMEOUTS.has(String(error.timeoutType)) ||
    UNREACHED.has(String(error.originalCode));
  return connecting ? "notTaken" : "maybeTaken";
}

/** Send a copy of an email from the admin panel: see campaignMessage. */
export async function sendCampaignEmail(
  strapi: Core.Strapi,
  options: SendCampaignEmailOptions,
  frames?: CampaignFrames,
): Promise<void> {
  await emailService(strapi).send(
    await campaignMessage(strapi, options, frames),
  );
}
