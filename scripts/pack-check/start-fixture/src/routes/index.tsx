import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid, Line, LineChart, PieChart, PieSlice, XAxis } from "bklit-tanstack-charts";

export const Route = createFileRoute("/")({ component: Page });

const days = Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)), users: 1200 + i * 90 }));
const months = ["Jan", "Feb", "Mar", "Apr"].map((month, i) => ({ month, revenue: 12000 + i * 1500 }));
const slices = [
  { label: "Direct", value: 40 },
  { label: "Search", value: 35 },
  { label: "Social", value: 25 },
];

function Page() {
  return (
    <main>
      <h1>pack-check Start fixture</h1>
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
        {slices.map((slice, i) => (
          <PieSlice index={i} key={slice.label} />
        ))}
      </PieChart>
    </main>
  );
}
