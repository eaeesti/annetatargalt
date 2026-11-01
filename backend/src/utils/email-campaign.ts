/*
 * The emails the team writes and sends from the admin panel to a group of
 * donors: what one is made of, the {{variables}} its text can have, which
 * blocks of it each donor gets, and the checks before it can go out.
 */
import { Marked } from "marked";
import { normalAddress } from "./address";
import { emailPictureUrl, isOurImage } from "./email-image";
import { CARD_TEXT_WIDTH } from "./email-layout";
import { dayOf, isRecord, oneOf } from "./narrow";
import { LOCALES, type Locale } from "./locale";
import { formatAmount, withCurrency } from "./money";
import { sanitize } from "./string";

/** Markdown that only reads texts, for what's in them: see imagesIn. */
const reader = new Marked();

const markdowns = new WeakMap<RenderContext, Marked>();

/**
 * Markdown as emails have it, for the context they're made in. A picture is
 * asked for in a size and format every email client shows, and styled
 * inline, as some clients drop the layout's stylesheet. Its width is an
 * attribute too, the only one Outlook for Windows reads: its width in the
 * media library, at most the card's. One from elsewhere has none, and shows
 * at its own size there.
 */
function emailMarkdown(context: RenderContext): Marked {
  const known = markdowns.get(context);
  if (known) return known;
  const marked = new Marked({
    renderer: {
      image({ href, text }) {
        const library = context.pictureWidth(href);
        const width = library ? Math.min(library, CARD_TEXT_WIDTH) : null;
        const size = width
          ? ` width="${width}" style="display: block; width: 100%; max-width: ${width}px;`
          : ` style="display: block; max-width: 100%;`;
        return `<img src="${sanitize(emailPictureUrl(href))}" alt="${sanitize(text)}"${size} height: auto; border: 0; border-radius: 8px;">`;
      },
    },
  });
  markdowns.set(context, marked);
  return marked;
}

/** Which of a donor's email settings decides whether they get it. */
export const EMAIL_KINDS = ["newsletter", "transfer", "yearly"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export type Localized = Record<Locale, string>;

/**
 * What a donor is or isn't. A block of the email is for the donors who are
 * each of its traits set to true and none of those set to false; a block
 * with none set is for everyone. The preview can show the email as such a
 * donor too.
 */
export const TRAITS = [
  "recurring",
  "hasIdCode",
  "underTaxLimit",
  "supportedUs",
  "gaveViaCompany",
] as const;
export type Trait = (typeof TRAITS)[number];
export type Traits = Partial<Record<Trait, boolean>>;

export const TRAIT_LABELS: Record<Trait, string> = {
  recurring: "Recurring",
  hasIdCode: "ID code",
  underTaxLimit: "Under the tax limit",
  supportedUs: "Supported us",
  gaveViaCompany: "Via a company",
};

/** Traits about what a donor gave, which only an email with a period has. */
const PERIOD_TRAITS: ReadonlySet<Trait> = new Set([
  "underTaxLimit",
  "supportedUs",
  "gaveViaCompany",
]);

export function traitNeedsPeriod(trait: Trait): boolean {
  return PERIOD_TRAITS.has(trait);
}

/** Traits about the yearly tax limit, which need a whole year. */
export function traitNeedsYear(trait: Trait): boolean {
  return trait === "underTaxLimit";
}

/**
 * Whether a period is one whole calendar year. The tax limit is a year's, so
 * what's left under it is only known from all that was given in one.
 */
export function isWholeYear(period: Period | undefined): boolean {
  const year = period?.from.slice(0, 4);
  return period?.from === `${year}-01-01` && period.to === `${year}-12-31`;
}

/** Whether a donor is what `traits` asks: true is, false isn't. */
export function hasTraits(
  recipient: Recipient,
  traits: Traits,
  context: RenderContext,
): boolean {
  return TRAITS.every(
    (trait) =>
      traits[trait] === undefined ||
      isTrait(trait, recipient, context) === traits[trait],
  );
}

/** The traits from a request; anything else is left out. */
export function parseTraits(value: unknown): Traits {
  const record = isRecord(value) ? value : {};
  const traits: Traits = {};
  for (const trait of TRAITS) {
    const wanted = record[trait];
    if (typeof wanted === "boolean") traits[trait] = wanted;
  }
  return traits;
}

/**
 * The most a person's donations in a year can be for an income tax refund in
 * Estonia, in cents. A company's are deducted differently, so only a
 * donor's own count towards it.
 */
export const TAX_LIMIT_CENTS = 120_000;

/** The income tax rate a new email's refund is worked out at, in percent. */
export const DEFAULT_TAX_RATE = 22;

export interface EmailBlock {
  id: string;
  /** Who it's for: see TRAITS. */
  traits: Traits;
  /** Markdown with {{variables}}, in each language. */
  text: Localized;
}

export interface CampaignContent {
  subject: Localized;
  blocks: EmailBlock[];
  /** The income tax rate {{taxRefund}} is worked out at, in percent. */
  taxRate?: number;
}

/** A span of days, both included, as YYYY-MM-DD. */
export interface Period {
  from: string;
  to: string;
}

/** Narrows the group the email goes to; a filter left out doesn't narrow. */
export interface AudienceFilters {
  locale?: Locale;
  recurring?: boolean;
  hasIdCode?: boolean;
  /** Gave in it. A summary's figures are about what was given in it, too. */
  period?: Period;
  /** Only these addresses, such as the team's for a first real send. */
  emails?: string[];
}

/** What one person gave in an email's period, in cents. */
export interface Gifts {
  count: number;
  /** All of it, to each organization, by its internal ID. */
  byOrganization: { internalId: string; cents: number }[];
  /** The part given through a company. */
  companyCents: number;
}

/** A donor the email goes to, with what the variables and traits need. */
export interface Recipient {
  donorId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  idCode: string | null;
  /** The language they last gave in, which their email is in. */
  locale: Locale;
  recurring: boolean;
  /** What they gave in the email's period, when it has one. */
  gifts?: Gifts;
}

/** An organization as an email names it, in one language. */
export interface OrganizationName {
  title: string;
  /** Its cause's title, when it has one. */
  cause: string | null;
}

/** What the variables need besides the donor: names and settings. */
export interface RenderContext {
  /** An organization's name in a language, by its internal ID. */
  organization: (internalId: string, locale: Locale) => OrganizationName | null;
  /** The organization a donor's support for Anneta Targalt goes to. */
  supportOrganization: string | null;
  taxRate: number;
  /** A picture's width in the media library, in pixels, by its address. */
  pictureWidth: (url: string) => number | null;
}

export const NO_CONTEXT: RenderContext = {
  organization: () => null,
  supportOrganization: null,
  taxRate: DEFAULT_TAX_RATE,
  pictureWidth: () => null,
};

interface Variable {
  name: string;
  label: string;
  example: string;
  /** Whether it's about what was given in the email's period. */
  needsPeriod?: boolean;
  /**
   * Whether it's about the yearly tax limit, so that period has to be one
   * whole calendar year.
   */
  needsYear?: boolean;
  /** Whether it's more than a line, which a subject can't have. */
  lines?: boolean;
  value: (recipient: Recipient, context: RenderContext) => string | null;
  /**
   * Its value as Markdown, for one that's more than words, like a list,
   * with each of its words in `place(words)`.
   */
  markdown?: (
    recipient: Recipient,
    context: RenderContext,
    place: (words: string) => string,
  ) => string | null;
}

/** An amount in cents, in the donor's language: "25,50€" or "€25.50". */
function money(cents: number, locale: Locale): string {
  return withCurrency(formatAmount(cents / 100, locale), "€", locale);
}

/** What a donor gave, sorted out: support apart, and their own apart. */
function totals(gifts: Gifts, context: RenderContext) {
  const all = gifts.byOrganization.reduce((sum, gift) => sum + gift.cents, 0);
  const support = gifts.byOrganization
    .filter((gift) => gift.internalId === context.supportOrganization)
    .reduce((sum, gift) => sum + gift.cents, 0);
  return { all, support, own: all - gifts.companyCents };
}

/** Their gifts to organizations other than Anneta Targalt, largest first. */
function charities(recipient: Recipient, context: RenderContext) {
  return (recipient.gifts?.byOrganization ?? [])
    .filter((gift) => gift.internalId !== context.supportOrganization)
    .map((gift) => ({
      ...gift,
      name: context.organization(gift.internalId, recipient.locale),
    }))
    .sort((a, b) => b.cents - a.cents);
}

/** "a, b and c" in a language. */
function joinWords(words: string[], locale: Locale): string {
  if (words.length < 2) return words.join("");
  const and = locale === "en" ? " and " : " ja ";
  return `${words.slice(0, -1).join(", ")}${and}${words[words.length - 1] ?? ""}`;
}

/**
 * Each cause's share of what a donor gave to charities, as whole percents
 * that add up to 100: the largest takes what rounding leaves over.
 */
function causeShares(recipient: Recipient, context: RenderContext) {
  const byCause = new Map<string, number>();
  for (const gift of charities(recipient, context)) {
    const cause = gift.name?.cause;
    if (cause) byCause.set(cause, (byCause.get(cause) ?? 0) + gift.cents);
  }
  const total = [...byCause.values()].reduce((sum, cents) => sum + cents, 0);
  if (total === 0) return [];
  const shares = [...byCause]
    .sort((a, b) => b[1] - a[1])
    .map(([cause, cents]) => ({
      cause,
      percent: Math.round((cents / total) * 100),
    }));
  const [largest] = shares;
  if (largest) {
    largest.percent += 100 - shares.reduce((sum, s) => sum + s.percent, 0);
  }
  return shares.filter((share) => share.percent > 0);
}

/** How much more a donor could give and still get the tax back, in cents. */
function taxRoomCents(recipient: Recipient, context: RenderContext) {
  if (!recipient.gifts) return 0;
  return Math.max(0, TAX_LIMIT_CENTS - totals(recipient.gifts, context).own);
}

/** A variable's value from a donor's gifts, or nothing when they have none. */
const fromGifts =
  (
    value: (
      gifts: Gifts,
      recipient: Recipient,
      context: RenderContext,
    ) => string | null,
  ) =>
  (recipient: Recipient, context: RenderContext) =>
    recipient.gifts ? value(recipient.gifts, recipient, context) : null;

const VARIABLES: Variable[] = [
  {
    name: "firstName",
    label: "First name",
    example: "Mari",
    value: (recipient) => recipient.firstName,
  },
  {
    name: "lastName",
    label: "Last name",
    example: "Maasikas",
    value: (recipient) => recipient.lastName,
  },
  {
    name: "donationCount",
    label: "Number of donations",
    example: "12",
    needsPeriod: true,
    value: fromGifts((gifts) => String(gifts.count)),
  },
  {
    name: "total",
    label: "Total given, support included",
    example: "240€",
    needsPeriod: true,
    value: fromGifts((gifts, recipient, context) =>
      money(totals(gifts, context).all, recipient.locale),
    ),
  },
  {
    name: "organizations",
    label: "List of organizations and amounts",
    example: "Näidisorganisatsioon: 120€",
    needsPeriod: true,
    lines: true,
    value: (recipient, context) => {
      const lines = charities(recipient, context).map(
        (gift) =>
          `${gift.name?.title ?? gift.internalId}: ${money(gift.cents, recipient.locale)}`,
      );
      return lines.length ? lines.join("\n") : null;
    },
    markdown: (recipient, context, place) => {
      const lines = charities(recipient, context).map(
        (gift) =>
          `- ${place(gift.name?.title ?? gift.internalId)}: ${place(money(gift.cents, recipient.locale))}`,
      );
      // A list has to start on a line of its own.
      return lines.length ? `\n\n${lines.join("\n")}\n\n` : null;
    },
  },
  {
    name: "causes",
    label: "Share of each cause",
    example: "60% loomade heaolu ja 40% inimeste heaolu",
    needsPeriod: true,
    value: (recipient, context) => {
      const shares = causeShares(recipient, context);
      return shares.length
        ? joinWords(
            shares.map(
              // In a sentence, as "60% animal welfare"
              (share) =>
                `${share.percent}% ${share.cause.toLocaleLowerCase(recipient.locale)}`,
            ),
            recipient.locale,
          )
        : null;
    },
  },
  {
    name: "support",
    label: "Support for Anneta Targalt",
    example: "20€",
    needsPeriod: true,
    value: fromGifts((gifts, recipient, context) => {
      const { support } = totals(gifts, context);
      return support > 0 ? money(support, recipient.locale) : null;
    }),
  },
  {
    name: "companyTotal",
    label: "Given via a company",
    example: "500€",
    needsPeriod: true,
    value: fromGifts((gifts, recipient) =>
      gifts.companyCents > 0
        ? money(gifts.companyCents, recipient.locale)
        : null,
    ),
  },
  {
    name: "taxRoom",
    label: "Left under the tax limit",
    example: "960€",
    needsPeriod: true,
    needsYear: true,
    value: (recipient, context) => {
      const room = taxRoomCents(recipient, context);
      return room > 0 ? money(room, recipient.locale) : null;
    },
  },
  {
    name: "taxRefund",
    label: "Tax refund on what's left",
    example: "211,20€",
    needsPeriod: true,
    needsYear: true,
    value: (recipient, context) => {
      const room = taxRoomCents(recipient, context);
      return room > 0
        ? money(Math.round((room * context.taxRate) / 100), recipient.locale)
        : null;
    },
  },
];

const VARIABLE_BY_NAME = new Map(VARIABLES.map((v) => [v.name, v]));

/** A variable's example value, as the editor shows it. */
export function exampleOf(name: string): string | null {
  return VARIABLE_BY_NAME.get(name)?.example ?? null;
}

/** The variables an email can have, for the editor. */
export function variablesFor() {
  return VARIABLES.map(
    ({ name, label, example, needsPeriod, needsYear, lines }) => ({
      name,
      label,
      example,
      needsPeriod: Boolean(needsPeriod),
      needsYear: Boolean(needsYear),
      inSubject: !lines,
    }),
  );
}

// ─── Reading what the admin panel sends ──────────────────────────────────────

function localized(value: unknown): Localized {
  const record = isRecord(value) ? value : {};
  return {
    et: typeof record.et === "string" ? record.et : "",
    en: typeof record.en === "string" ? record.en : "",
  };
}

/** An email's content from a request, or null when it isn't one. */
export function parseContent(value: unknown): CampaignContent | null {
  if (!isRecord(value) || !Array.isArray(value.blocks)) return null;
  const blocks: EmailBlock[] = [];
  for (const block of value.blocks) {
    if (!isRecord(block) || typeof block.id !== "string") return null;
    blocks.push({
      id: block.id,
      traits: parseTraits(block.traits),
      text: localized(block.text),
    });
  }
  const content: CampaignContent = {
    subject: localized(value.subject),
    blocks,
  };
  if (
    typeof value.taxRate === "number" &&
    value.taxRate >= 0 &&
    value.taxRate <= 100
  ) {
    content.taxRate = value.taxRate;
  }
  return content;
}

/**
 * The addresses in what someone typed or pasted: one per line or separated
 * by commas, in lower case, each once. Whatever isn't an address is kept
 * too, for the check to name and the editor to show again.
 */
export function parseAddresses(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.filter((part): part is string => typeof part === "string")
    : typeof value === "string"
      ? value.split(/[\s,;]+/)
      : [];
  return [...new Set(parts.map(normalAddress).filter(Boolean))];
}

/**
 * Whether something typed, or a donor's address, is an email address, like
 * name@example.org, and only one.
 */
export function isAddress(entry: string): boolean {
  return /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(entry);
}

/** The filters from a request; anything that isn't a filter is left out. */
export function parseAudience(value: unknown): AudienceFilters {
  const record = isRecord(value) ? value : {};
  const filters: AudienceFilters = {};
  const locale = oneOf(record.locale, LOCALES);
  if (locale) filters.locale = locale;
  if (typeof record.recurring === "boolean") {
    filters.recurring = record.recurring;
  }
  if (typeof record.hasIdCode === "boolean") {
    filters.hasIdCode = record.hasIdCode;
  }
  if (isRecord(record.period)) {
    const from = dayOf(record.period.from);
    const to = dayOf(record.period.to);
    if (from && to && from <= to) filters.period = { from, to };
  }
  // What's typed is kept whether or not it's addresses, for the check to
  // name what isn't. With nothing in it but separators, it's no list, as
  // the box shows it when it's opened again.
  const emails = parseAddresses(record.emails);
  if (emails.length) filters.emails = emails;
  return filters;
}

export function emptyContent(): CampaignContent {
  return {
    subject: { et: "", en: "" },
    blocks: [{ id: "1", traits: {}, text: { et: "", en: "" } }],
  };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

const VARIABLE = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Every Markdown picture in a text, as rendering finds them: its
 * description and address.
 */
export function imagesIn(text: string) {
  const images: { description: string; url: string }[] = [];
  reader.walkTokens(reader.lexer(text), (token) => {
    if (token.type === "image") {
      images.push({ description: token.text, url: token.href });
    }
  });
  return images;
}

/** Every {{name}} in a text. */
export function variablesIn(text: string): string[] {
  return [...text.matchAll(VARIABLE)].map((match) => match[1] ?? "");
}

/** A text with its variables filled in, for one donor, as plain text. */
export function fillIn(
  text: string,
  recipient: Recipient,
  context: RenderContext = NO_CONTEXT,
): string {
  return text.replace(VARIABLE, (whole, name: string) => {
    const variable = VARIABLE_BY_NAME.get(name);
    return variable ? (variable.value(recipient, context) ?? "") : whole;
  });
}

/**
 * Where a value goes in an email's Markdown: a number between two
 * characters of Unicode's private use, which Markdown reads as nothing, and
 * leaves as they are in text, a picture's description or code alike. In a
 * link's address, it encodes them.
 */
const PLACE = /\uE000(\d+)\uE001|%EE%80%80(\d+)%EE%80%81/g;

/**
 * An email's Markdown for one donor, rendered, with its values put in
 * afterwards: a value, such as a donor's name, is never read as markup, and
 * shows as it is wherever the team put it, in Markdown or in HTML they
 * wrote.
 */
function renderMarkdown(
  texts: InLanguage[],
  recipient: Recipient,
  context: RenderContext,
): string {
  const values: string[] = [];
  const place = (words: string) => {
    values.push(words);
    return `\uE000${values.length - 1}\uE001`;
  };
  const markdown = texts
    .map(({ text, locale }) => {
      const reader = { ...recipient, locale };
      return text.replace(VARIABLE, (whole, name: string) => {
        const variable = VARIABLE_BY_NAME.get(name);
        if (!variable) return whole;
        if (variable.markdown) {
          return variable.markdown(reader, context, place) ?? "";
        }
        return place(variable.value(reader, context) ?? "");
      });
    })
    .join("\n\n");
  return emailMarkdown(context)
    .parse(markdown, { async: false })
    .replace(PLACE, (_, inText?: string, inAddress?: string) =>
      inText !== undefined
        ? sanitize(values[Number(inText)] ?? "")
        : encodeURIComponent(values[Number(inAddress)] ?? ""),
    );
}

/** Whether a donor is `trait`. */
function isTrait(
  trait: Trait,
  recipient: Recipient,
  context: RenderContext,
): boolean {
  const gifts = recipient.gifts;
  switch (trait) {
    case "recurring":
      return recipient.recurring;
    case "hasIdCode":
      return Boolean(recipient.idCode);
    case "underTaxLimit":
      return (
        Boolean(gifts && recipient.idCode) &&
        taxRoomCents(recipient, context) > 0
      );
    case "supportedUs":
      return Boolean(gifts && totals(gifts, context).support > 0);
    case "gaveViaCompany":
      return Boolean(gifts && gifts.companyCents > 0);
  }
}

/** A text in one language, and that language. */
interface InLanguage {
  text: string;
  locale: Locale;
}

/**
 * A text in the recipient's language, or in Estonian when it has none. Its
 * amounts, names and causes are then in Estonian too, as the text is.
 */
function inLanguage(text: Localized, locale: Locale): InLanguage {
  return text[locale].trim()
    ? { text: text[locale], locale }
    : { text: text.et, locale: "et" };
}

/** The texts a donor gets: of the blocks for them, in their language. */
function textsFor(
  content: CampaignContent,
  recipient: Recipient,
  context: RenderContext,
): InLanguage[] {
  return content.blocks
    .filter((block) => hasTraits(recipient, block.traits, context))
    .map((block) => inLanguage(block.text, recipient.locale))
    .filter(({ text }) => text.trim());
}

/** Whether no block of an email is for a donor, which leaves theirs empty. */
export function isEmptyFor(
  content: CampaignContent,
  recipient: Recipient,
  context: RenderContext = NO_CONTEXT,
): boolean {
  return textsFor(content, recipient, context).length === 0;
}

/** The email one donor gets: its subject, HTML body and plain text. */
export function renderEmail(
  content: CampaignContent,
  recipient: Recipient,
  context: RenderContext = NO_CONTEXT,
) {
  const texts = textsFor(content, recipient, context);
  const subject = inLanguage(content.subject, recipient.locale);
  return {
    // On one line whatever's in it, as an email's header has to be
    subject: fillIn(
      subject.text,
      { ...recipient, locale: subject.locale },
      context,
    )
      .replace(/\s+/g, " ")
      .trim(),
    html: renderMarkdown(texts, recipient, context),
    text: texts
      .map(({ text, locale }) =>
        fillIn(text, { ...recipient, locale }, context),
      )
      .join("\n\n"),
  };
}

// ─── Checks ──────────────────────────────────────────────────────────────────

export interface Issue {
  /** An error stops the email from being sent; a warning doesn't. */
  severity: "error" | "warning";
  message: string;
}

const LANGUAGE_NAMES: Record<Locale, string> = {
  et: "Estonian",
  en: "English",
};

/**
 * What's wrong with an email before it goes to `recipients`: variables that
 * don't exist, that need a period it doesn't have or that some of them have
 * no value for, missing text, donors no block is for, and listed addresses
 * that aren't in the group.
 */
export function lint(
  content: CampaignContent,
  kind: EmailKind,
  recipients: Recipient[],
  audience: AudienceFilters = {},
  context: RenderContext = NO_CONTEXT,
): Issue[] {
  const issues: Issue[] = [];
  // Who sees each variable that's used: everyone sees the subject, and a
  // block only the donors its traits pick.
  const seenBy = new Map<string, Set<Recipient>>();

  // A text's readers are those who get it in its language: their own, or
  // Estonian when theirs has none.
  const readersIn = (text: Localized, locale: Locale, of: Recipient[]) =>
    of.filter((r) => (text[r.locale].trim() ? r.locale : "et") === locale);
  const places: {
    where: string;
    text: string;
    readers: Recipient[];
    subject?: boolean;
  }[] = [];
  for (const locale of LOCALES) {
    places.push({
      where: `the ${LANGUAGE_NAMES[locale]} subject`,
      text: content.subject[locale],
      readers: readersIn(content.subject, locale, recipients),
      subject: true,
    });
    content.blocks.forEach((block, index) =>
      places.push({
        where: `block ${index + 1} (${LANGUAGE_NAMES[locale]})`,
        text: block.text[locale],
        readers: readersIn(
          block.text,
          locale,
          recipients.filter((r) => hasTraits(r, block.traits, context)),
        ),
      }),
    );
  }
  for (const { where, text, readers, subject } of places) {
    for (const name of variablesIn(text)) {
      const variable = VARIABLE_BY_NAME.get(name);
      if (!variable) {
        issues.push({
          severity: "error",
          message: `{{${name}}} in ${where} isn't a variable this email can have.`,
        });
      } else if (variable.needsPeriod && !audience.period) {
        issues.push({
          severity: "error",
          message: `{{${name}}} in ${where} is about what a donor gave in a period: set "Gave between" first.`,
        });
      } else if (variable.needsYear && !isWholeYear(audience.period)) {
        issues.push({
          severity: "error",
          message: `{{${name}}} in ${where} is about the yearly tax limit: set "Gave between" to one whole year, as "Last year" or "This year" do.`,
        });
      } else if (variable.lines && subject) {
        issues.push({
          severity: "error",
          message: `{{${name}}} in ${where} is a list, which a subject can't have: put it in a block.`,
        });
      } else {
        const seen = seenBy.get(name) ?? new Set<Recipient>();
        for (const reader of readers) seen.add(reader);
        seenBy.set(name, seen);
      }
    }
    for (const image of imagesIn(text)) {
      if (!image.description.trim()) {
        issues.push({
          severity: "error",
          message: `A picture in ${where} has no description: write what it shows between its [ ], for readers whose email hides pictures.`,
        });
      }
      if (!isOurImage(image.url)) {
        issues.push({
          severity: "warning",
          message: `A picture in ${where} isn't from the media library (${image.url}): it can change or disappear after the email is sent.`,
        });
      }
    }
    // What's left of "{{" once the variables are out is a broken one.
    if (text.replace(VARIABLE, "").includes("{{")) {
      issues.push({
        severity: "error",
        message: `${where[0]?.toUpperCase()}${where.slice(1)} has a "{{" that isn't a whole variable, like {{firstName}}.`,
      });
    }
  }

  content.blocks.forEach((block, index) => {
    const needsPeriod = TRAITS.filter(
      (trait) => block.traits[trait] !== undefined && traitNeedsPeriod(trait),
    );
    const needsYear = TRAITS.filter(
      (trait) => block.traits[trait] !== undefined && traitNeedsYear(trait),
    );
    if (needsPeriod.length && !audience.period) {
      issues.push({
        severity: "error",
        message: `Block ${index + 1} is for donors by "${needsPeriod.map((trait) => TRAIT_LABELS[trait]).join('", "')}", which is about what they gave in a period: set "Gave between" first.`,
      });
    } else if (needsYear.length && !isWholeYear(audience.period)) {
      issues.push({
        severity: "error",
        message: `Block ${index + 1} is for donors by "${needsYear.map((trait) => TRAIT_LABELS[trait]).join('", "')}", which is about the yearly tax limit: set "Gave between" to one whole year, as "Last year" or "This year" do.`,
      });
    } else if (
      recipients.length > 0 &&
      (block.text.et.trim() || block.text.en.trim()) &&
      !recipients.some((r) => hasTraits(r, block.traits, context))
    ) {
      issues.push({
        severity: "warning",
        message: `Block ${index + 1} reaches no one in this group: no donor in it is all of what the block is for.`,
      });
    }
  });

  // Each donor reads their language, or Estonian where it has nothing: the
  // subject has to be there for the languages the group reads. With no one
  // in it, for the group's language, or Estonian.
  const locales = recipients.length
    ? [...new Set(recipients.map((r) => r.locale))]
    : [audience.locale ?? "et"];
  const noSubject = locales.filter(
    (locale) => !inLanguage(content.subject, locale).text.trim(),
  );
  if (noSubject.length) {
    issues.push({
      severity: "error",
      message: `The ${LANGUAGE_NAMES[noSubject.includes("et") ? "et" : "en"]} subject is empty.`,
    });
  }
  if (
    !content.blocks.some(
      (block) => block.text.et.trim() || block.text.en.trim(),
    )
  ) {
    issues.push({ severity: "error", message: "The email has no text." });
  } else {
    const empty = recipients.filter((r) =>
      isEmptyFor(content, r, context),
    ).length;
    if (empty > 0) {
      issues.push({
        severity: "error",
        message: `${empty} ${empty === 1 ? "donor gets" : "donors get"} an empty email: no block is for them, or none has text in their language or Estonian. Add a block for everyone, or narrow the group.`,
      });
    }
  }

  const english = recipients.filter((r) => r.locale === "en").length;
  if (english > 0) {
    const missing = [
      ...(content.subject.et.trim() && !content.subject.en.trim()
        ? ["the subject"]
        : []),
      ...content.blocks.flatMap((block, index) =>
        block.text.et.trim() && !block.text.en.trim()
          ? [`block ${index + 1}`]
          : [],
      ),
    ];
    if (missing.length) {
      issues.push({
        severity: "warning",
        message: `${english} ${english === 1 ? "donor gets" : "donors get"} emails in English, but ${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} no English text: they'll get the Estonian.`,
      });
    }
  }

  for (const variable of VARIABLES) {
    const seen = seenBy.get(variable.name);
    if (!seen) continue;
    const without = [...seen].filter(
      (r) => !variable.value(r, context)?.trim(),
    ).length;
    if (without > 0) {
      issues.push({
        severity: "warning",
        message: `${without} ${without === 1 ? "donor" : "donors"} who ${without === 1 ? "gets" : "get"} {{${variable.name}}} ${without === 1 ? "has" : "have"} no ${variable.label.toLowerCase()}: it will be left empty for them.`,
      });
    }
  }

  // Organizations given to that the site has no more, not even as a draft:
  // there's no name to put in for them.
  const unnamed = new Set<string>();
  const readersOfUnnamed = new Set<Recipient>();
  for (const name of ["organizations", "causes"]) {
    for (const reader of seenBy.get(name) ?? []) {
      for (const gift of charities(reader, context)) {
        if (gift.name) continue;
        unnamed.add(gift.internalId);
        readersOfUnnamed.add(reader);
      }
    }
  }
  if (unnamed.size) {
    const one = unnamed.size === 1;
    const readers = readersOfUnnamed.size;
    issues.push({
      severity: "warning",
      message: `${readers} ${readers === 1 ? "donor" : "donors"} gave to ${[...unnamed].join(", ")}, which the site has no organization for any more: {{organizations}} shows ${one ? "its" : "their"} internal ID, and {{causes}} leaves ${one ? "it" : "them"} out. Adding ${one ? "it" : "them"} back, even as a draft, gives ${one ? "it its" : "them their"} name.`,
    });
  }

  const notAddresses = (audience.emails ?? []).filter(
    (entry) => !isAddress(entry),
  );
  if (notAddresses.length) {
    issues.push({
      severity: "error",
      message: `In "Only these addresses", ${joinWords(
        notAddresses.map((entry) => `"${entry}"`),
        "en",
      )} ${notAddresses.length === 1 ? "isn't an address" : "aren't addresses"}: write whole addresses, like name@example.org.`,
    });
  }
  if (audience.emails) {
    const inGroup = new Set(recipients.map((r) => normalAddress(r.email)));
    const missing = audience.emails.filter(
      (email) => isAddress(email) && !inGroup.has(email),
    );
    if (missing.length) {
      issues.push({
        severity: "warning",
        message: `${missing.join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} in the group, so ${missing.length === 1 ? "it" : "they"} won't get it: not a donor${audience.period ? " in the period" : ""}, left out by another filter, or turned this kind of email off.`,
      });
    }
  }

  return issues;
}
