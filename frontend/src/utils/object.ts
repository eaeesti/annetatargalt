/**
 * Returns an array of values from an object, based on the keys provided.
 * @example
 * at({ a: 1, b: 2, c: 3 }, ["a", "c"]); // [1, 3]
 */
export function at<V>(object: Record<string, V>, keys: string[]): V[] {
  return Object.keys(object)
    .map((key) => {
      if (keys.includes(key)) {
        return object[key];
      }
    })
    .filter((value): value is V => value !== undefined);
}

/**
 * Returns an object with the keys and values from the provided object, based
 * on the keys provided.
 * @example
 * pick({ a: 1, b: 2, c: 3 }, ["a", "c"]); // { a: 1, c: 3 }
 */
export function pick<V>(
  object: Record<string, V>,
  keys: string[],
): Record<string, V> {
  return Object.keys(object)
    .filter((key) => keys.includes(key))
    .reduce<Record<string, V>>((obj, key) => {
      obj[key] = object[key];
      return obj;
    }, {});
}

/**
 * The string in a field whose name is only known at runtime, such as one a
 * CMS editor picked, or null when that field holds anything else.
 * @example
 * stringField({ a: "x", b: 2 }, "a"); // "x"
 * stringField({ a: "x", b: 2 }, "b"); // null
 */
export function stringField(object: object, field: string): string | null {
  const value: unknown = Reflect.get(object, field);
  return typeof value === "string" ? value : null;
}

/**
 * Whether a value from outside, such as parsed JSON, is a plain object whose
 * fields can be read and checked.
 * @example
 * isRecord({ a: 1 }); // true
 * isRecord([1]); // false
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
