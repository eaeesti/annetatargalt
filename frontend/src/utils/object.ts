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
export function pick<V>(object: Record<string, V>, keys: string[]): Record<string, V> {
  return Object.keys(object)
    .filter((key) => keys.includes(key))
    .reduce<Record<string, V>>((obj, key) => {
      obj[key] = object[key];
      return obj;
    }, {});
}
