/**
 * Returns an array of values from an object, based on the keys provided.
 * @param {Object} object - The object to pick values from.
 * @param {Array} keys - The keys to pick values for.
 * @return {Array} - An array of values.
 * @example
 * pick({ a: 1, b: 2, c: 3 }, ["a", "c"]); // [1, 3]
 */
export function pick(object, keys) {
  return Object.keys(object)
    .map((key) => {
      if (keys.includes(key)) {
        return object[key];
      }
    })
    .filter((value) => value !== undefined);
}
