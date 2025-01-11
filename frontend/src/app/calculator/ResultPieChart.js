import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import colors from "tailwindcss/colors";

const COLORS = [colors.slate[400], "#047857"];
const RADIAN = Math.PI / 180;

const PieChartLabel = ({
  name,
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  index,
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill={COLORS[index]}
      textAnchor="middle"
      dominantBaseline="central"
      className="font-semibold leading-tight transition-opacity cursor-text md:text-xl animate-fade-in"
    >
      {name}
    </text>
  );
};

export default function ResultPieChart({
  percentile,
  topPercentile,
  animated = true,
}) {
  const data = [
    { name: `Sinust rikkamad`, value: +topPercentile },
    { name: `Sinust vaesemad`, value: +percentile },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          startAngle={-270 - topPercentile * 1.8}
          dataKey="value"
          animationBegin={0}
          animationDuration={animated ? 1200 : 0}
          labelLine={false}
          label={PieChartLabel}
        >
          <Cell key="percentile" fill={COLORS[0]} />
          <Cell key="topPercentile" fill={COLORS[1]} />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
