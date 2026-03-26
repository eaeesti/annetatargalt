import { strapiAdmin } from "../../lib/api";
import {
  MonthlyTotalsChart,
  CumulativeChart,
} from "./_components/monthly-totals-chart";
import { ActiveDonorsChart } from "./_components/active-donors-chart";
import { RecurringChurnChart } from "./_components/recurring-churn-chart";
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

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const positive = pct >= 0;
  return (
    <span
      className={`text-xs font-medium px-1.5 py-0.5 rounded ${positive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
    >
      {positive ? "+" : ""}
      {pct}%
    </span>
  );
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
}: {
  label: string;
  current: { count: number; total: number };
  prior: { count: number; total: number };
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr_1fr_auto] gap-4 items-center text-sm py-2 border-b last:border-0">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="tabular-nums font-medium">
        {formatEur(current.total)}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {formatCount(current.count)} donations
      </span>
      <div className="flex gap-1.5">
        <TrendBadge pct={pctChange(current.total, prior.total)} />
        <TrendBadge pct={pctChange(current.count, prior.count)} />
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
          label="Last 30 days"
          current={periods.days30.current}
          prior={periods.days30.prior}
        />
        <PeriodRow
          label="Last 90 days"
          current={periods.days90.current}
          prior={periods.days90.prior}
        />
        <PeriodRow
          label="Last 365 days"
          current={periods.days365.current}
          prior={periods.days365.prior}
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
