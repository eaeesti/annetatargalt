/*
 * Narrowing for values that arrive untyped: request bodies and query
 * strings, other services' replies, a JSON column. Each is checked before
 * the code relies on its type, instead of being cast to it.
 */

import { estonianDay } from "./estonian-time";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `value` if it's one of `options`, else undefined. */
export function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): T | undefined {
  return options.find((option) => option === value);
}

/** The largest id a serial column holds. */
const MAX_ID = 2_147_483_647;

/**
 * A row's id from a request, such as the 7 in "/donors/7": null for
 * anything else, "1.5" or an id too large for the database included.
 */
export function idOf(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && id <= MAX_ID ? id : null;
}

/**
 * A day from a request, written "2026-06-30" and one that exists: not 31
 * February. Undefined for anything else.
 */
export function dayOf(value: unknown): string | undefined {
  const day = typeof value === "string" ? value.trim() : "";
  return estonianDay(day) ? day : undefined;
}
