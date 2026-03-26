"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../../../components/ui/chart";
import type { ActiveDonorsRow } from "../types";

function shortMonth(yyyymm: string) {
  const [y, m] = yyyymm.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("et-EE", {
    month: "short",
    year: "2-digit",
  });
}

const chartConfig = {
  activeDonors: { label: "Active donors", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ActiveDonorsChart({ data }: { data: ActiveDonorsRow[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
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
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(l: unknown) => shortMonth(String(l))} />}
        />
        <Line
          type="monotone"
          dataKey="activeDonors"
          stroke="var(--color-activeDonors)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
