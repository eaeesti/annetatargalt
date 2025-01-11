import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const YTick = (props) => {
  let { payload, tickFormatter, verticalAnchor, visibleTicksCount, ...rest } =
    props;
  rest.className += " text-xs md:text-base";
  return <text {...rest}>{payload.value}</text>;
};

const XTick = (props) => {
  let { payload, tickFormatter, verticalAnchor, visibleTicksCount, ...rest } =
    props;
  rest.className += " text-xs md:text-base";
  return (
    <text dy="1em" {...rest}>
      {payload.value}
    </text>
  );
};

export default function ResultBarChart({
  medianIncome,
  internationalizedIncome,
}) {
  const data = [
    {
      name: "Mediaan",
      income: medianIncome,
    },
    {
      name: "Sinu sissetulek",
      income: internationalizedIncome,
    },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{
          top: 0,
          right: 0,
          left: 0,
          bottom: 0,
        }}
        barCategoryGap="25%"
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={XTick} />
        <YAxis tick={YTick} />
        <Bar
          dataKey="income"
          fill="#047857"
          animationBegin={0}
          animationDuration={1200}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
