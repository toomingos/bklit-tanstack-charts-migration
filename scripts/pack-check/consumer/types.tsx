// Type-level consumer: the public API used the way the README will show it.
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, Line, LineChart, PieChart, PieSlice, XAxis } from "__PKG__";

const days = [
  { date: new Date("2026-01-01"), users: 1200, pageviews: 4500 },
  { date: new Date("2026-01-02"), users: 1350, pageviews: 4800 },
];
const months = [
  { month: "Jan", revenue: 12000, profit: 4000 },
  { month: "Feb", revenue: 15000, profit: 5200 },
];
const slices = [
  { label: "Direct", value: 40 },
  { label: "Search", value: 35 },
];

export const charts = (
  <>
    <LineChart data={days} aspectRatio="2/1">
      <Grid horizontal />
      <Line dataKey="users" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
    <BarChart data={months} xDataKey="month" aspectRatio="2/1">
      <Bar dataKey="revenue" />
      <BarXAxis />
    </BarChart>
    <PieChart data={slices}>
      {slices.map((s, i) => (
        <PieSlice index={i} key={s.label} />
      ))}
    </PieChart>
  </>
);
