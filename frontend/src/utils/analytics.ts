import type { DonationType } from "./donation-draft";
import { PLAUSIBLE_EVENTS } from "./plausible-events";

/**
 * Every event the site sends, and what it carries. Umami gets the event with
 * its properties; Plausible, until it goes, gets the names it has always had
 * (plausible-events.ts).
 *
 * - Names are `thing:action`: the thing on screen and a past-tense verb, both
 *   in kebab-case (`donation:paid`, `faq:expanded`). Names stay few and
 *   stable, so they work as funnel steps.
 * - The page isn't in the name: Umami records the page's address with every
 *   event, and its language with it.
 * - Everything that varies goes in properties: snake_case keys; values are
 *   numbers, booleans or short strings from our own code or the CMS's ids,
 *   never anything a person typed or anything that names them. Amounts are in
 *   euros.
 */
export interface Events {
  // Anywhere
  /** A button with an id in the CMS (its "plausibleEvent" field) */
  "button:clicked": { button: string };
  /** A question with an id in the CMS (its "plausibleEvent" field) */
  "faq:expanded": { question: string };
  "page:not-found": undefined;

  // The donation form
  /** Its steps after the first, in order: the donor, the tip, the summary */
  "donation-form:step-opened": {
    step: "info" | "support" | "summary";
    type: DonationType;
  };
  "donation:submitted": {
    type: DonationType;
    /** Without the tip */
    amount: number;
    /** The tip chosen, as a percentage of the amount: 0 without one */
    tip_percent: number;
    /** One-off donations only */
    payment_method?: "bank" | "card";
    company: boolean;
    dedication: boolean;
    /** Opened from a link that chose the type or an organization */
    from_link: boolean;
  };
  "donation:failed": { type: DonationType; reason: FailureReason };
  /** A monthly donation saved, and the standing order's details shown */
  "recurring-donation:created": { amount: number };
  /**
   * A one-off donation paid, from either donation form. revenue and currency
   * are what Umami's revenue report reads; revenue includes the tip.
   */
  "donation:paid": { revenue: number; currency: "EUR" };

  // The foreign donation form
  "foreign-donation:submitted": { amount: number };
  "foreign-donation:failed": { reason: FailureReason };

  // The contact form
  "contact-form:sent": undefined;

  // The income calculator
  "income:calculated": { adults: number; children: number };
  /** The slider comparing what an amount buys, let go of */
  "income-comparison:changed": { amount: number };
  "income:shared": {
    network: "facebook" | "twitter" | "bluesky" | "linkedin";
  };
}

/** "network" when no answer came, "server" when the answer was an error */
type FailureReason = "network" | "server";

type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: ((eventName: string) => void) & { q?: string[][] };
    umami?: { track: (eventName: string, data?: EventData) => void };
  }
}

// Umami's events from before its script ran
const umamiQueue: [string, EventData | undefined][] = [];

/** What track() takes after an event's name: its properties, or nothing for events without any */
export type EventArgs<E extends keyof Events> = Events[E] extends undefined
  ? []
  : [Events[E]];

export function track<E extends keyof Events>(name: E, ...args: EventArgs<E>) {
  if (typeof window === "undefined") return;
  // Plausible's script is deferred, so events from a page that has only just
  // loaded (the thank-you page, a 404) can come before it. They wait in the
  // queue it sends when it starts.
  const queue: string[][] = [];
  window.plausible ??= Object.assign(
    (eventName: string) => void queue.push([eventName]),
    { q: queue },
  );
  for (const old of PLAUSIBLE_EVENTS[name](...args)) window.plausible(old);

  // Umami's script has no queue, and won't start if window.umami is already
  // there. Deferred scripts run before the page's load event, so what comes
  // earlier waits for that; after it, an Umami that isn't there was blocked
  // or switched off, and the event is dropped.
  const [data] = args;
  const props =
    data &&
    Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
  if (window.umami) {
    window.umami.track(name, props);
  } else if (document.readyState !== "complete") {
    if (umamiQueue.length === 0) {
      window.addEventListener(
        "load",
        () => {
          for (const [queued, queuedData] of umamiQueue.splice(0)) {
            window.umami?.track(queued, queuedData);
          }
        },
        { once: true },
      );
    }
    umamiQueue.push([name, props]);
  }
}
