/**
 * Returns an array of values from an object, based on the keys provided.
 * @param {Object} object - The object to get values from.
 * @param {Array} keys - The keys to get values for.
 * @return {Array} - An array of values.
 * @example
 * at({ a: 1, b: 2, c: 3 }, ["a", "c"]); // [1, 3]
 */
export function at(object, keys) {
  return Object.keys(object)
    .map((key) => {
      if (keys.includes(key)) {
        return object[key];
      }
    })
    .filter((value) => value !== undefined);
}

/**
 * Returns an object with the keys and values from the provided object, based
 * on the keys provided.
 * @param {Object} object - The object to get values from.
 * @param {Array} keys - The keys to get values for.
 * @return {Object} - An object with the keys and values.
 * @example
 * pick({ a: 1, b: 2, c: 3 }, ["a", "c"]); // { a: 1, c: 3 }
 */
export function pick(object, keys) {
  return Object.keys(object)
    .filter((key) => keys.includes(key))
    .reduce((obj, key) => {
      obj[key] = object[key];
      return obj;
    }, {});
}
