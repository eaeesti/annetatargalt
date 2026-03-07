/**
 * Returns an array of numbers from `from` to `to`, excluding `to`.
 * @example
 * range(5);    // [0, 1, 2, 3, 4]
 * range(2, 5); // [2, 3, 4]
 * range(5, 1); // []
 */
export function range(from: number, to?: number): number[] {
  let start = from;
  let end = to;
  if (!end) {
    end = start;
    start = 0;
  }

  return Array.from({ length: end - start }, (_, i) => i + start);
}
