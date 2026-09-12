import { strapiAdmin } from "../../lib/api";
import {
  MonthlyTotalsChart,
  CumulativeChart,
} from "./_components/monthly-totals-chart";
import { ActiveDonorsChart } from "./_components/active-donors-chart";
import { RecurringChurnChart } from "./_components/recurring-churn-chart";
import { TrendBadge } from "./_components/trend-badge";
import type { DashboardStats, DashboardCharts } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEur(cents: number): string {
  return `€${(cents / 100).toLocaleString("et-EE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCount(n: number): string {
  return n.toLocaleString("et-EE");
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "September" — or "December 2025" once it's not the current calendar year. */
function monthLabel(fromIso: string, currentYear: number): string {
  const d = new Date(fromIso);
  const name = MONTH_NAMES[d.getUTCMonth()];
  return d.getUTCFullYear() === currentYear
    ? name
    : `${name} ${d.getUTCFullYear()}`;
}

/** "Q3" — or "Q4 2025" once it's not the current calendar year. */
function quarterLabel(fromIso: string, currentYear: number): string {
  const d = new Date(fromIso);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return d.getUTCFullYear() === currentYear
    ? `Q${q}`
    : `Q${q} ${d.getUTCFullYear()}`;
}

function yearLabel(fromIso: string): string {
  return String(new Date(fromIso).getUTCFullYear());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PeriodRow({
  label,
  current,
  prior,
  showDelta = true,
}: {
  label: string;
  current: { count: number; total: number };
  prior: { count: number; total: number };
  /** Off for in-progress periods (current month/quarter/year) — a delta
   * against a not-yet-finished period vs. a complete prior one is misleading. */
  showDelta?: boolean;
}) {
  return (
    <div className="grid grid-cols-[14rem_1fr_1fr] gap-4 items-center text-sm py-2 border-b last:border-0">
      <span className="text-muted-foreground font-medium whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="tabular-nums font-medium">
          {formatEur(current.total)}
        </span>
        {showDelta && (
          <TrendBadge
            pct={pctChange(current.total, prior.total)}
            currentLabel={formatEur(current.total)}
            priorLabel={formatEur(prior.total)}
          />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="tabular-nums text-muted-foreground">
          {formatCount(current.count)} donations
        </span>
        {showDelta && (
          <TrendBadge
            pct={pctChange(current.count, prior.count)}
            currentLabel={formatCount(current.count)}
            priorLabel={formatCount(prior.count)}
          />
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [statsRes, chartsRes] = await Promise.all([
    strapiAdmin("/api/admin-panel/dashboard/stats", { cache: "no-store" }),
    strapiAdmin("/api/admin-panel/dashboard/charts", { cache: "no-store" }),
  ]);

  if (!statsRes.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Could not load stats ({statsRes.status}).
        </p>
      </div>
    );
  }

  const { data }: { data: DashboardStats } = await statsRes.json();
  const { totalDonations, totalDonors, activeDonors, mrr, periods } = data;
  // Reference year for deciding whether a month/quarter label needs a year
  // suffix (e.g. "December 2025" once "last month" crosses into last year).
  const thisYear = new Date(periods.currentYear.from).getUTCFullYear();

  const charts: DashboardCharts | null = chartsRes.ok
    ? ((await chartsRes.json()) as { data: DashboardCharts }).data
    : null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total donated"
          value={formatEur(totalDonations.sum)}
          sub={`${formatCount(totalDonations.count)} donations`}
        />
        <StatCard label="Total donors" value={formatCount(totalDonors)} />
        <StatCard
          label="Active donors"
          value={formatCount(activeDonors)}
          sub="last 12 months"
        />
        <StatCard
          label="MRR"
          value={formatEur(mrr)}
          sub="active recurring/month"
        />
      </div>

      {/* Period comparison */}
      <div className="rounded-lg border bg-card p-5 space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pb-2">
          Period comparison (vs prior period)
        </h2>
        <PeriodRow
          label={`Current month (${monthLabel(periods.currentMonth.from, thisYear)})`}
          current={periods.currentMonth.current}
          prior={periods.currentMonth.prior}
          showDelta={false}
        />
        <PeriodRow
          label={`Last month (${monthLabel(periods.lastMonth.from, thisYear)})`}
          current={periods.lastMonth.current}
          prior={periods.lastMonth.prior}
        />
        <PeriodRow
          label={`Current quarter (${quarterLabel(periods.currentQuarter.from, thisYear)})`}
          current={periods.currentQuarter.current}
          prior={periods.currentQuarter.prior}
          showDelta={false}
        />
        <PeriodRow
          label={`Last quarter (${quarterLabel(periods.lastQuarter.from, thisYear)})`}
          current={periods.lastQuarter.current}
          prior={periods.lastQuarter.prior}
        />
        <PeriodRow
          label={`Current year (${yearLabel(periods.currentYear.from)})`}
          current={periods.currentYear.current}
          prior={periods.currentYear.prior}
          showDelta={false}
        />
        <PeriodRow
          label={`Last year (${yearLabel(periods.lastYear.from)})`}
          current={periods.lastYear.current}
          prior={periods.lastYear.prior}
        />
      </div>

      {/* Charts */}
      {charts && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Monthly donations (last 24 months)">
              <MonthlyTotalsChart data={charts.monthlyTotals} />
            </ChartCard>
            <ChartCard title="Cumulative donations (all time)">
              <CumulativeChart data={charts.monthlyTotals} />
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Active donors per month (rolling 12 months)">
              <ActiveDonorsChart data={charts.activeDonorsPerMonth} />
            </ChartCard>
            <ChartCard title="Recurring donors — new vs churned">
              <RecurringChurnChart data={charts.recurringChurn} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
