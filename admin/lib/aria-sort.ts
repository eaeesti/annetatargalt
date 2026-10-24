/**
 * A column header's `aria-sort`, so a screen reader says how the table is
 * sorted: set on the column the table is sorted by, left off the others.
 */
export function ariaSort(
  column: string,
  sortBy: string,
  sortDir: string,
): "ascending" | "descending" | undefined {
  if (column !== sortBy) return undefined;
  return sortDir === "asc" ? "ascending" : "descending";
}
