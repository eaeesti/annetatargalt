import type { Locale } from "./locale";

/**
 * Where an income in Estonia stands among the world's.
 *
 * The data is the world's income distribution for 2024, in 2021 international
 * dollars, and Estonia's purchasing power parity with the inflation since 2021
 * added. The page's sources name where it's from; a newer release replaces
 * both numbers below.
 */

/**
 * The daily income per person, in international dollars, below which each
 * percent of the world lives: the first is the 1st percentile, the last the
 * 99th.
 */
export const WORLD_PERCENTILES = [
  0.92, 1.28, 1.56, 1.81, 2.04, 2.24, 2.44, 2.62, 2.78, 2.94, 3.1, 3.26, 3.4,
  3.54, 3.68, 3.82, 3.96, 4.08, 4.22, 4.34, 4.46, 4.58, 4.7, 4.84, 4.96, 5.1,
  5.2, 5.35, 5.45, 5.6, 5.7, 5.85, 6.0, 6.15, 6.3, 6.45, 6.6, 6.75, 6.9, 7.1,
  7.25, 7.45, 7.65, 7.85, 8.05, 8.25, 8.45, 8.7, 8.95, 9.2, 9.45, 9.75, 10.0,
  10.3, 10.6, 11.0, 11.3, 11.7, 12.1, 12.5, 12.9, 13.4, 13.8, 14.3, 14.9, 15.4,
  16.0, 16.6, 17.3, 18.0, 18.7, 19.6, 20.4, 21.3, 22.3, 23.4, 24.6, 25.9, 27.3,
  28.8, 30.4, 32.2, 34.2, 36.3, 38.7, 41.2, 44.0, 47.0, 50.3, 54.1, 58.2, 62.9,
  68.3, 74.7, 82.4, 92.3, 105.1, 124.7, 162.6,
].map((daily, index) => ({ percentile: index + 1, daily }));

/** Euros that buy in Estonia what an international dollar buys. */
const ESTONIA_PPP = 0.8511289101388542;

export const DAYS_PER_MONTH = 365.2425 / 12;

/** A household's monthly net income in euros and the people living on it. */
export interface Household {
  income: number;
  adults: number;
  children: number;
}

export const MAX_ADULTS = 10;
export const MAX_CHILDREN = 10;

/**
 * A household's income per person, by the original OECD scale: the first
 * adult counts as 1, every other adult as 0.7 and every child as 0.5.
 */
export function equivalisedIncome({
  income,
  adults,
  children,
}: Household): number {
  return income / (0.3 + 0.7 * adults + 0.5 * children);
}

/** A monthly income in euros as international dollars. */
export function internationalIncome(monthlyIncome: number): number {
  return monthlyIncome / ESTONIA_PPP;
}

/** A monthly income in international dollars as euros in Estonia. */
export function euroIncome(internationalMonthlyIncome: number): number {
  return internationalMonthlyIncome * ESTONIA_PPP;
}

function interpolate(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/** Where the richest end of the scale stops: no one is richer than everyone. */
const MAX_PERCENTILE = 99.9;

/**
 * The percent of the world that lives on less than a monthly income in
 * international dollars. Past the 99th percentile, where the data ends, the
 * line from the 98th continues, up to 99.9.
 */
export function worldPercentileOfInternational(monthlyIncome: number): number {
  const daily = monthlyIncome / DAYS_PER_MONTH;
  const above = WORLD_PERCENTILES.findIndex((point) => point.daily >= daily);
  if (above === 0) return WORLD_PERCENTILES[0].percentile;
  const [low, high] =
    above === -1
      ? WORLD_PERCENTILES.slice(-2)
      : WORLD_PERCENTILES.slice(above - 1, above + 1);
  const percentile = interpolate(
    daily,
    low.daily,
    high.daily,
    low.percentile,
    high.percentile,
  );
  return Math.min(percentile, MAX_PERCENTILE);
}

/** The percent of the world that lives on less than a monthly income in euros. */
export function worldPercentile(monthlyIncome: number): number {
  return worldPercentileOfInternational(internationalIncome(monthlyIncome));
}

/** The world's median monthly income in international dollars. */
export const WORLD_MEDIAN_INCOME =
  (WORLD_PERCENTILES.find((point) => point.percentile === 50)?.daily ?? 0) *
  DAYS_PER_MONTH;

export interface IncomeComparison {
  /**
   * How much of the world is richer, in percent: whole, rounded up, until it's
   * below 1, then to one decimal.
   */
  top: number;
  /** How much of the world is poorer: the rest. */
  percentile: number;
  /** How many times the world's median the income is. */
  timesMedian: number;
}

/** How a monthly income per person in euros compares with the world's. */
export function compareIncome(monthlyIncome: number): IncomeComparison {
  const position = worldPercentile(monthlyIncome);
  const exactTop = 100 - position;
  const top = exactTop < 1 ? round(exactTop, 1) : Math.ceil(round(exactTop, 1));
  return {
    top,
    percentile: round(100 - top, 1),
    timesMedian: internationalIncome(monthlyIncome) / WORLD_MEDIAN_INCOME,
  };
}

/**
 * A monthly income as typed: digits with up to two decimals after a point or
 * a comma, spaces allowed ("2 500,50"). Null unless it's above zero.
 */
export function parseIncome(text: string): number | null {
  const compact = text.replace(/\s/g, "");
  if (!/^\d*([.,]\d{1,2})?$/.test(compact)) return null;
  const income = Number(compact.replace(",", "."));
  return income > 0 ? income : null;
}

/** A whole number from min to max, as written, or null. */
export function parseCount(
  text: string | null,
  min: number,
  max: number,
): number | null {
  if (!text || !/^\d+$/.test(text)) return null;
  const count = Number(text);
  return count >= min && count <= max ? count : null;
}

/**
 * The household a link's query describes (?income=1500&adults=2&children=1),
 * or null if it doesn't describe one. Without adults or children, it's one
 * adult on their own.
 */
export function householdFromQuery(query: {
  get: (key: string) => string | null;
}): Household | null {
  const income = parseIncome(query.get("income") ?? "");
  const adults = query.get("adults")
    ? parseCount(query.get("adults"), 1, MAX_ADULTS)
    : 1;
  const children = query.get("children")
    ? parseCount(query.get("children"), 0, MAX_CHILDREN)
    : 0;
  if (!income || !adults || children === null) return null;
  return { income, adults, children };
}

/** The query string of a household, the other way round. */
export function householdQuery({ income, adults, children }: Household) {
  return new URLSearchParams({
    income: String(income),
    adults: String(adults),
    children: String(children),
  }).toString();
}

export function round(number: number, digits = 0): number {
  return Math.round(number * 10 ** digits) / 10 ** digits;
}

/**
 * A number in a site language's style, to at most `digits` decimals.
 * @example
 * formatNumber(12345.67, "et", 1); // "12 345,7"
 * formatNumber(8, "en", 1);        // "8"
 */
export function formatNumber(
  number: number,
  locale: Locale,
  digits = 0,
): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "et", {
    maximumFractionDigits: digits,
  }).format(number);
}
