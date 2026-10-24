/*
 * Narrowing for values that arrive untyped: request bodies and query
 * strings, other services' replies, a JSON column. Each is checked before
 * the code relies on its type, instead of being cast to it.
 */

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
