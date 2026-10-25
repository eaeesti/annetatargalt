import type { Metadata } from "next";
import Link from "next/link";
import { strapiAdmin } from "../../../../lib/api";
import { readJson } from "../../../../lib/read-json";
import { BackLink } from "../../../../components/back-link";

export const metadata: Metadata = { title: "Recurring donations by month" };

// ── Types ─────────────────────────────────────────────────────────────────────

type GridRow = {
  donorId: number;
  donorName: string;
  startMonth: string; // "YYYY-MM"
  monthAmounts: Record<string, number>; // "YYYY-MM" -> cents donated
  // A finalized recurring payment within the last 60 days. Absent from a
  // backend older than this page: the two deploy separately.
  recurringActive?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate list of "YYYY-MM" strings from `monthsBack` months ago to now. */
function buildMonthRange(monthsBack: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return months;
}

function shortMonth(yyyymm: string) {
  const [y, m] = yyyymm.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("et-EE", { month: "short", year: "2-digit" });
}

function formatEur(cents: number) {
  return `€${(cents / 100).toFixed(0)}`;
}

// ── Cell ──────────────────────────────────────────────────────────────────────

type CellState = "paid" | "gap" | "before-start" | "expected";

function cellState(
  month: string,
  row: GridRow,
  currentMonth: string,
): CellState {
  if (month < row.startMonth) return "before-start";
  if (month in row.monthAmounts) return "paid";
  // The current month is not over yet: an active recurring donor who has
  // not given this month is still expected to, rather than missing it.
  if (month === currentMonth && row.recurringActive) return "expected";
  return "gap";
}

const cellStyles: Record<CellState, string> = {
  paid: "bg-green-500/20 text-green-700 dark:text-green-400",
  gap: "bg-red-500/15 text-red-600 dark:text-red-400",
  "before-start": "",
  expected: "opacity-30",
};

// ── Page ──────────────────────────────────────────────────────────────────────

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RecurringGridPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const showAll = params.months === "all";
  const monthsBack = showAll
    ? null
    : Math.min(36, Math.max(6, Number(params.months ?? 24) || 24));

  const res = await strapiAdmin("/api/admin-panel/recurring-donations/grid", {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Recurring Grid</h1>
        <p className="text-destructive">
          Failed to load grid. Please try again later.
        </p>
      </div>
    );
  }

  const { data: rows } = await readJson<{ data: GridRow[] }>(res);

  // For "all": span from the earliest startMonth across all rows to now
  // An async server component renders once per request, so reading the clock
  // here is not the impure render the React Compiler rule warns about.
  // oxlint-disable-next-line react/purity
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const months =
    monthsBack !== null
      ? buildMonthRange(monthsBack)
      : (() => {
          const earliest = rows.reduce(
            (min, r) => (r.startMonth < min ? r.startMonth : min),
            currentMonth,
          );
          const [ey, em] = earliest.split("-").map(Number);
          const result: string[] = [];
          let y = ey,
            m = em;
          while (true) {
            const key = `${y}-${String(m).padStart(2, "0")}`;
            result.push(key);
            if (key === currentMonth) break;
            m++;
            if (m > 12) {
              m = 1;
              y++;
            }
          }
          return result;
        })();

  // Gap summary per row
  const rowsWithMeta = rows.map((row) => {
    const gapCount = months.filter(
      (m) => cellState(m, row, currentMonth) === "gap",
    ).length;
    return { ...row, gapCount };
  });

  // Sort: earliest start month first, then by name
  rowsWithMeta.sort((a, b) => {
    if (a.startMonth !== b.startMonth)
      return a.startMonth.localeCompare(b.startMonth);
    return a.donorName.localeCompare(b.donorName);
  });

  const totalGaps = rowsWithMeta.reduce((s, r) => s + r.gapCount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-3">
            <BackLink href="/recurring-donations">List view</BackLink>
            <h1 className="text-2xl font-bold">Recurring Grid</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {rows.length} donors · {totalGaps} gaps in view
          </p>
        </div>
        {/* Months range selector */}
        <div className="flex items-center gap-1 text-sm">
          {([12, 24, 36] as const).map((n) => (
            <Link
              key={n}
              href={`/recurring-donations/grid?months=${n}`}
              className={`rounded border px-2.5 py-1 transition-colors ${
                monthsBack === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {n}mo
            </Link>
          ))}
          <Link
            href="/recurring-donations/grid?months=all"
            className={`rounded border px-2.5 py-1 transition-colors ${
              showAll
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </Link>
        </div>
      </div>

      {/*
        Grid. The container was already a scrollport for the frozen donor
        column; capping its height makes it scroll vertically too, which is
        what lets the month headers stick.

        Three overlapping sticky layers, so the z-order is load-bearing:
        the donor column (z-10) slides under the month headers (z-20), and
        the Donor cell is both at once, so it has to sit above both (z-30)
        or it is overdrawn at the corner where they cross.

        Each header cell carries its own opaque background and its own
        underline. A background on the <tr> would not travel with a sticky
        cell, and in a collapsed table the borders belong to the table
        rather than the cell, so a border-b would be left behind as the
        rows scroll under it.
      */}
      <div className="max-h-[calc(100svh-13rem)] overflow-auto rounded-lg border">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr>
              {/* Frozen corner: sticky on both axes, above both. */}
              <th className="sticky top-0 left-0 z-30 min-w-[180px] border-r bg-muted px-3 py-2 text-left font-semibold whitespace-nowrap shadow-[inset_0_-1px_0_var(--border)]">
                Donor
              </th>
              <th className="sticky top-0 z-20 w-12 border-r bg-muted px-2 py-2 text-center font-semibold whitespace-nowrap shadow-[inset_0_-1px_0_var(--border)]">
                Gaps
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={`sticky top-0 z-20 w-16 bg-muted px-1.5 py-2 text-center font-medium whitespace-nowrap shadow-[inset_0_-1px_0_var(--border)] ${
                    m === currentMonth
                      ? "font-bold text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {shortMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsWithMeta.map((row, i) => (
              <tr
                key={row.donorId}
                className={`border-b transition-colors last:border-0 hover:bg-muted/30 ${
                  i % 2 === 0 ? "" : "bg-muted/10"
                }`}
              >
                {/* Sticky donor name */}
                <td className="sticky left-0 z-10 border-r bg-card px-3 py-1.5 whitespace-nowrap">
                  <Link
                    href={`/donors/${row.donorId}`}
                    className="font-medium hover:underline"
                  >
                    {row.donorName}
                  </Link>
                </td>
                <td
                  className={`border-r px-2 py-1.5 text-center font-medium tabular-nums ${
                    row.gapCount > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {row.gapCount > 0 ? row.gapCount : "—"}
                </td>
                {months.map((m) => {
                  const state = cellState(m, row, currentMonth);
                  const amount = row.monthAmounts[m];
                  return (
                    <td
                      key={m}
                      className={`px-1 py-1.5 text-center tabular-nums ${cellStyles[state]}`}
                      title={
                        state === "gap"
                          ? `${row.donorName} — missing ${m}`
                          : state === "paid"
                            ? `${row.donorName} — ${m}: ${formatEur(amount)}`
                            : state === "expected"
                              ? `${row.donorName} — expected in ${m}`
                              : undefined
                      }
                    >
                      {state === "paid"
                        ? formatEur(amount)
                        : state === "gap"
                          ? "✗"
                          : state === "expected"
                            ? "·"
                            : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-8 items-center justify-center rounded bg-green-500/20 text-[10px] font-medium text-green-700 dark:text-green-400">
            €50
          </span>
          Donated
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-red-500/15 font-bold text-red-600 dark:text-red-400">
            ✗
          </span>
          Gap
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded border font-bold opacity-30">
            ·
          </span>
          Expected this month
        </span>
      </div>
    </div>
  );
}
