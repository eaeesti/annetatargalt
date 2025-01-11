import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import colors from "tailwindcss/colors";
import { getHistogramData } from "./utils/calculator";

const data = [
  {
    name: "Page A",
    uv: 4000,
    pv: 2400,
    amt: 2400,
  },
  {
    name: "Page B",
    uv: 3000,
    pv: 1398,
    amt: 2210,
  },
  {
    name: "Page C",
    uv: 2000,
    pv: 9800,
    amt: 2290,
  },
  {
    name: "Page D",
    uv: 2780,
    pv: 3908,
    amt: 2000,
  },
  {
    name: "Page E",
    uv: 1890,
    pv: 4800,
    amt: 2181,
  },
  {
    name: "Page F",
    uv: 2390,
    pv: 3800,
    amt: 2500,
  },
  {
    name: "Page G",
    uv: 3490,
    pv: 4300,
    amt: 2100,
  },
];

export default function ResultHistogram() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={getHistogramData()}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="percentage" />
        <YAxis
        //scale="log" domain={["auto", "auto"]}
        />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="international_dollars"
          stroke={colors.teal[700]}
          fill={colors.teal[600]}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
