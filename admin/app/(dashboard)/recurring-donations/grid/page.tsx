import Link from "next/link";
import { strapiAdmin } from "../../../../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type GridRow = {
  donorId: number;
  donorName: string;
  startMonth: string; // "YYYY-MM"
  monthAmounts: Record<string, number>; // "YYYY-MM" -> cents donated
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

type CellState = "paid" | "gap" | "before-start" | "future";

function cellState(
  month: string,
  startMonth: string,
  monthAmounts: Record<string, number>,
  currentMonth: string,
): CellState {
  if (month < startMonth) return "before-start";
  if (month > currentMonth) return "future";
  if (month in monthAmounts) return "paid";
  return "gap";
}

const cellStyles: Record<CellState, string> = {
  paid: "bg-green-500/20 text-green-700 dark:text-green-400",
  gap: "bg-red-500/15 text-red-600 dark:text-red-400",
  "before-start": "",
  future: "opacity-30",
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

  const { data: rows }: { data: GridRow[] } = await res.json();

  // For "all": span from the earliest startMonth across all rows to now
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
      (m) =>
        cellState(m, row.startMonth, row.monthAmounts, currentMonth) === "gap",
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-3">
            <Link
              href="/recurring-donations"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← List view
            </Link>
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
              className={`px-2.5 py-1 rounded border transition-colors ${
                monthsBack === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:text-foreground border-border"
              }`}
            >
              {n}mo
            </Link>
          ))}
          <Link
            href="/recurring-donations/grid?months=all"
            className={`px-2.5 py-1 rounded border transition-colors ${
              showAll
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:text-foreground border-border"
            }`}
          >
            All
          </Link>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-lg border overflow-auto">
        <table className="text-xs border-collapse w-max min-w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {/* Sticky donor column */}
              <th className="sticky left-0 z-10 bg-muted/90 backdrop-blur-sm text-left px-3 py-2 font-semibold whitespace-nowrap min-w-[180px] border-r">
                Donor
              </th>
              <th className="px-2 py-2 font-semibold text-center whitespace-nowrap border-r w-12">
                Gaps
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={`px-1.5 py-2 font-medium text-center whitespace-nowrap w-16 ${
                    m === currentMonth
                      ? "text-primary font-bold"
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
                className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                  i % 2 === 0 ? "" : "bg-muted/10"
                }`}
              >
                {/* Sticky donor name */}
                <td className="sticky left-0 z-10 bg-card border-r px-3 py-1.5 whitespace-nowrap">
                  <Link
                    href={`/donors/${row.donorId}`}
                    className="hover:underline font-medium"
                  >
                    {row.donorName}
                  </Link>
                </td>
                <td
                  className={`px-2 py-1.5 text-center tabular-nums font-medium border-r ${
                    row.gapCount > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {row.gapCount > 0 ? row.gapCount : "—"}
                </td>
                {months.map((m) => {
                  const state = cellState(
                    m,
                    row.startMonth,
                    row.monthAmounts,
                    currentMonth,
                  );
                  const amount = row.monthAmounts[m];
                  return (
                    <td
                      key={m}
                      className={`text-center py-1.5 px-1 tabular-nums ${cellStyles[state]}`}
                      title={
                        state === "gap"
                          ? `${row.donorName} — missing ${m}`
                          : state === "paid"
                            ? `${row.donorName} — ${m}: ${formatEur(amount)}`
                            : undefined
                      }
                    >
                      {state === "paid"
                        ? formatEur(amount)
                        : state === "gap"
                          ? "✗"
                          : state === "future"
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
          <span className="w-8 h-4 rounded bg-green-500/20 inline-flex items-center justify-center text-green-700 dark:text-green-400 font-medium text-[10px]">
            €50
          </span>
          Donated
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-red-500/15 inline-flex items-center justify-center text-red-600 dark:text-red-400 font-bold">
            ✗
          </span>
          Gap
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border inline-flex items-center justify-center opacity-30 font-bold">
            ·
          </span>
          Future
        </span>
      </div>
    </div>
  );
}
