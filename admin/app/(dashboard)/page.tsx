import { strapiAdmin } from "../../lib/api";
import type { DashboardStats } from "./types";

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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {sub && <span>{sub}</span>}
          {trend !== undefined && <TrendBadge pct={trend} />}
        </div>
      )}
    </div>
  );
}

// ── Period section ────────────────────────────────────────────────────────────

function PeriodRow({
  label,
  current,
  prior,
}: {
  label: string;
  current: { count: number; total: number };
  prior: { count: number; total: number };
}) {
  const eurTrend = pctChange(current.total, prior.total);
  const cntTrend = pctChange(current.count, prior.count);
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
        <TrendBadge pct={eurTrend} />
        <TrendBadge pct={cntTrend} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const res = await strapiAdmin("/api/admin-panel/dashboard/stats", {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Could not load stats ({res.status}).
        </p>
      </div>
    );
  }

  const { data }: { data: DashboardStats } = await res.json();
  const { totalDonations, totalDonors, activeDonors, mrr, periods } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Top KPIs */}
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
    </div>
  );
}
