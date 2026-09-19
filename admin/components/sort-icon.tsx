import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

/**
 * The sort affordance in every list table's column header.
 *
 * This was copied byte-for-byte into four table components before it lived
 * here. It is shared rather than duplicated so the three states stay visually
 * identical across the admin: an unsorted column reads as faintly interactive,
 * and the active column shows which way it is pointing.
 *
 * `sortBy`/`sortDir` are passed in rather than read from a context because the
 * tables disagree about where sort state lives — most keep it in the URL and
 * re-query the server, while smaller lists hold it in local component state.
 * Both shapes reduce to these two strings.
 */
export function SortIcon({
  col,
  sortBy,
  sortDir,
}: {
  col: string;
  sortBy: string;
  sortDir: string;
}) {
  if (sortBy !== col)
    return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ChevronUp className="ml-1 h-3 w-3" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3" />
  );
}
