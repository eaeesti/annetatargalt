"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
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

export function MonthlyTotalsChart({ data }: { data: MonthlyTotalsRow[] }) {
  const last24 = data.slice(-24);

  return (
    <ChartContainer config={barConfig} className="h-[220px] w-full">
      <BarChart data={last24} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickFormatter={shortMonth}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={2}
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
              labelFormatter={(l: unknown) => shortMonth(String(l))}
            />
          }
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
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
