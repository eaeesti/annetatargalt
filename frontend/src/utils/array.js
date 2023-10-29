/**
 * Returns an array of numbers from `from` to `to`, excluding `to`.
 * @param {number} from - The starting number if there is a `to` argument, otherwise the ending number.
 * @param {number} [to] - The ending number.
 * @return {Array} - An array of numbers.
 * @example
 * range(5); // [0, 1, 2, 3, 4]
 * range(2, 5); // [2, 3, 4]
 * range(5, 1); // []
 */
export function range(from, to) {
  let start = from;
  let end = to;
  if (!end) {
    end = start;
    start = 0;
  }

  return Array.from({ length: end - start }, (_, i) => i + start);
}
