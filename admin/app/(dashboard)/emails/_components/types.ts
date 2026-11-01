export type Locale = "et" | "en";
export type Localized = Record<Locale, string>;

export interface Variable {
  name: string;
  label: string;
  example: string;
  /** About what a donor gave in the email's period, so it needs one. */
  needsPeriod: boolean;
  // Absent from a backend older than this page: the two deploy separately.
  /** About the yearly tax limit, so the period has to be one whole year. */
  needsYear?: boolean;
  /** Whether a subject can have it: a list can't. */
  inSubject?: boolean;
}

export interface Option {
  value: string;
  label: string;
}

/** What an email can be made of, from the backend. */
export interface EmailOptions {
  kinds: (Option & { variables: Variable[] })[];
  /** What a donor is or isn't: who a block is for, or the preview shows. */
  traits: (Option & { needsPeriod: boolean; needsYear?: boolean })[];
  /** The income tax rate a refund is worked out at, in percent. */
  defaultTaxRate: number;
}

/** What a donor is or isn't, by trait: true is, false isn't. */
export type Traits = Record<string, boolean>;

export interface EmailBlock {
  id: string;
  /** Who it's for; none set is everyone. */
  traits: Traits;
  text: Localized;
}

export interface EmailContent {
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

/** Whether a period is one whole calendar year, as the tax limit is. */
export function isWholeYear(period: Period | undefined): boolean {
  const year = period?.from.slice(0, 4);
  return period?.from === `${year}-01-01` && period.to === `${year}-12-31`;
}

export interface Audience {
  locale?: Locale;
  recurring?: boolean;
  hasIdCode?: boolean;
  /** Gave in it; a summary's figures are about it too. */
  period?: Period;
  /**
   * Only these addresses: a list as stored, and the text as typed in the
   * editor, which the backend reads into one.
   */
  emails?: string[] | string;
}

/** How many of an email's copies are at each point, and whether it's going. */
export interface Progress {
  /** Still to go */
  queued: number;
  /** Being sent, or cut off while being sent, when nothing is running */
  sending: number;
  sent: number;
  failed: number;
  /** The donor turned that kind of email off after it was queued */
  skipped: number;
  running: boolean;
  failures: { donorId: number; error: string | null }[];
  // Absent from a backend older than this page: the two deploy separately.
  /** Why sending last stopped before it finished, if it did. */
  stoppedBy?: string | null;
  /** Of those still to go, how many wait to be tried again, their addresses refused for now */
  waiting?: number;
  /** When the first of those is */
  nextTry?: string | null;
}

export interface Campaign {
  id: number;
  kind: string;
  name: string;
  content: EmailContent;
  audience: Audience;
  status: "draft" | "sending" | "sent";
  createdBy: string | null;
  createdAt: string;
  sentAt: string | null;
  // Absent from a backend older than this page: the two deploy separately.
  /** Why sending stopped to wait for the team to go on, if it did. */
  heldFor?: string | null;
  progress: Progress;
}

export interface Issue {
  severity: "error" | "warning";
  message: string;
}

/** Who an email goes to and what's wrong with it, from the backend. */
export interface Check {
  count: number;
  /** How many of them each block reaches, by its id. */
  reach: { id: string; count: number }[];
  recipients: {
    donorId: number;
    name: string;
    email: string;
    locale: Locale;
  }[];
  issues: Issue[];
}

export const LANGUAGES: { locale: Locale; label: string }[] = [
  { locale: "et", label: "Estonian" },
  { locale: "en", label: "English" },
];
