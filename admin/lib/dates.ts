/*
 * Dates and times as they are in Estonia, whatever time zone the server
 * (UTC on Vercel) or the browser is in. Without the time zone, a page drawn
 * on the server showed times two or three hours early, and a donation made
 * just after midnight on the day before.
 */

export const TIME_ZONE = "Europe/Tallinn";

const DATE = new Intl.DateTimeFormat("et-EE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_TIME = new Intl.DateTimeFormat("et-EE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Swedish writes dates the ISO way, which inputs and spreadsheets read
const ISO_DAY = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ISO_MINUTE = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** "24.10.2026", or "24.10.2026 15:05" with the time. */
export function formatDate(iso: string, includeTime = false): string {
  return (includeTime ? DATE_TIME : DATE).format(new Date(iso));
}

/** "24.10.2026 15:05" */
export function formatDateTime(iso: string): string {
  return formatDate(iso, true);
}

/** The day a moment falls on in Estonia, as "2026-10-24". */
export function isoDay(moment: Date | string): string {
  return ISO_DAY.format(new Date(moment));
}

/** A moment to the minute in Estonia, as "2026-10-24 15:05". */
export function isoMinute(moment: Date | string): string {
  return ISO_MINUTE.format(new Date(moment));
}

/** Today in Estonia, as "2026-10-24". */
export function currentDay(): string {
  return isoDay(new Date());
}
