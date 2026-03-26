"use client";

import {
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  ComposedChart,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../../../components/ui/chart";
import type { RecurringChurnRow } from "../types";

function shortMonth(yyyymm: string) {
  const [y, m] = yyyymm.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("et-EE", {
    month: "short",
    year: "2-digit",
  });
}

const chartConfig = {
  newDonors: { label: "New", color: "hsl(142 76% 36%)" },
  churned: { label: "Churned", color: "hsl(0 72% 51%)" },
  active: { label: "Active", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function RecurringChurnChart({ data }: { data: RecurringChurnRow[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <ComposedChart
        data={data}
        margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
      >
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
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(l: unknown) => shortMonth(String(l))} />}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="newDonors"
          name="New"
          fill="var(--color-newDonors)"
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="churned"
          name="Churned"
          fill="var(--color-churned)"
          radius={[2, 2, 0, 0]}
        />
        <Line
          type="monotone"
          dataKey="active"
          name="Active"
          stroke="var(--color-active)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
