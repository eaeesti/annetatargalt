import type { EventArgs, Events } from "./analytics";

/**
 * The names Plausible has always had for each event, so its dashboard keeps
 * counting the same goals beside Umami.
 */
export const PLAUSIBLE_EVENTS: {
  [E in keyof Events]: (...args: EventArgs<E>) => string[];
} = {
  "button:clicked": ({ button }) => [button],
  "faq:expanded": ({ question }) => [question],
  "page:not-found": () => ["404"],

  "donation-form:step-opened": ({ step }) => [`donation-${step}-stage`],
  "donation:submitted": () => ["donation-clicked"],
  "donation:failed": () => ["donation-error"],
  "recurring-donation:created": () => ["donation-recurring-created"],
  "donation:paid": () => ["donation-paid"],

  "foreign-donation:submitted": () => ["foreign-donation-clicked"],
  "foreign-donation:failed": () => ["foreign-donation-error"],

  "contact-form:sent": () => ["contact-form-sent"],

  "income:calculated": () => ["income-calculated"],
  "income-comparison:changed": () => ["income-comparison-changed"],
  "income:shared": ({ network }) => [`income-shared-${network}`],
};
