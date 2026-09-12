"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { Button } from "../../../components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../../../components/ui/chart";
import type { MonthlyTotalsRow } from "../types";

function shortMonth(yyyymm: string) {
  const [y, m] = yyyymm.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("et-EE", {
    month: "short",
    year: "2-digit",
  });
}

const barConfig = {
  total: { label: "Total donated", color: "var(--chart-1)" },
} satisfies ChartConfig;

const areaConfig = {
  cumulative: { label: "Cumulative", color: "var(--chart-1)" },
} satisfies ChartConfig;

// ── Month/quarter/year toggle for MonthlyTotalsChart ────────────────────────────

type Granularity = "month" | "quarter" | "year";

const GRANULARITIES: Granularity[] = ["month", "quarter", "year"];

/** How far back to show, per granularity — `undefined` means all available. */
const WINDOW: Record<Granularity, number | undefined> = {
  month: 24,
  quarter: undefined,
  year: undefined,
};

const WINDOW_LABEL: Record<Granularity, string> = {
  month: "last 24 months",
  quarter: "all quarters",
  year: "all years",
};

const TITLE: Record<Granularity, string> = {
  month: "Monthly donations",
  quarter: "Quarterly donations",
  year: "Yearly donations",
};

function quarterKey(month: string): string {
  const [y, m] = month.split("-");
  const q = Math.floor((Number(m) - 1) / 3) + 1;
  return `${y}-Q${q}`;
}

function yearKey(month: string): string {
  return month.split("-")[0];
}

/** "Sep '26" / "Q3 '26" / "2026" depending on granularity. */
function periodLabel(key: string, granularity: Granularity): string {
  if (granularity === "year") return key;
  if (granularity === "quarter") {
    const [y, q] = key.split("-Q");
    return `Q${q} '${y.slice(2)}`;
  }
  return shortMonth(key);
}

/** Roll monthly rows up into quarters/years by summing `total`. */
function aggregate(
  data: MonthlyTotalsRow[],
  granularity: Granularity,
): { key: string; total: number }[] {
  if (granularity === "month") {
    return data.map((r) => ({ key: r.month, total: r.total }));
  }
  const keyOf = granularity === "quarter" ? quarterKey : yearKey;
  const totals = new Map<string, number>();
  for (const row of data) {
    const key = keyOf(row.month);
    totals.set(key, (totals.get(key) ?? 0) + row.total);
  }
  // `data` arrives ascending by month, so insertion order keeps this ascending.
  return [...totals.entries()].map(([key, total]) => ({ key, total }));
}

export function MonthlyTotalsChart({ data }: { data: MonthlyTotalsRow[] }) {
  const [granularity, setGranularity] = useState<Granularity>("month");

  const chartData = useMemo(() => {
    const rows = aggregate(data, granularity);
    const window = WINDOW[granularity];
    return window ? rows.slice(-window) : rows;
  }, [data, granularity]);

  // Aim for ~8 visible ticks regardless of how many bars are showing.
  const tickInterval = Math.max(0, Math.ceil(chartData.length / 8) - 1);

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {TITLE[granularity]} ({WINDOW_LABEL[granularity]})
        </h2>
        <div className="flex gap-1">
          {GRANULARITIES.map((g) => (
            <Button
              key={g}
              variant={granularity === g ? "default" : "outline"}
              size="sm"
              className="h-7"
              onClick={() => setGranularity(g)}
            >
              {g[0].toUpperCase() + g.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <ChartContainer config={barConfig} className="h-[220px] w-full">
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="key"
            tickFormatter={(k: string) => periodLabel(k, granularity)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={(v: number) =>
              `€${(v / 100).toLocaleString("et-EE", { maximumFractionDigits: 0 })}`
            }
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(v: unknown) =>
                  `€${(Number(v) / 100).toLocaleString("et-EE", { minimumFractionDigits: 2 })}`
                }
                labelFormatter={(l: unknown) =>
                  periodLabel(String(l), granularity)
                }
              />
            }
          />
          <Bar
            dataKey="total"
            fill="var(--color-total)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function CumulativeChart({ data }: { data: MonthlyTotalsRow[] }) {
  let running = 0;
  const cumulative = data.map((row) => {
    running += row.total;
    return { month: row.month, cumulative: running };
  });

  return (
    <ChartContainer config={areaConfig} className="h-[220px] w-full">
      <AreaChart
        data={cumulative}
        margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
      >
        <defs>
          <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-cumulative)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--color-cumulative)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickFormatter={shortMonth}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(cumulative.length / 6)}
        />
        <YAxis
          tickFormatter={(v: number) => `€${(v / 100 / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v: unknown) =>
                `€${(Number(v) / 100).toLocaleString("et-EE", { minimumFractionDigits: 2 })}`
              }
              labelFormatter={(l: unknown) => shortMonth(String(l))}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="var(--color-cumulative)"
          fill="url(#cumulativeGrad)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
