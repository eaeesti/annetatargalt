/**
 * A list request with `export=true` asks for every matching row at once, for
 * a CSV download, and is logged as an export rather than a list.
 */

/** The most rows one export returns; the admin refuses an export it would cut short. */
export const EXPORT_ROW_LIMIT = 20000;

export function isExport(query: Record<string, unknown>): boolean {
  return query.export === "true";
}
