// Server-renders a few charts from the installed package, the way a TanStack Start route would on the server.
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";

const name = process.argv[2];
const Charts = await import(name);

const days = Array.from({ length: 7 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)), users: 1200 + i * 90, pageviews: 4500 + i * 210 }));
const months = ["Jan", "Feb", "Mar", "Apr"].map((month, i) => ({ month, revenue: 12000 + i * 1500, profit: 4000 + i * 600 }));
const slices = [{ label: "Direct", value: 40 }, { label: "Search", value: 35 }, { label: "Social", value: 25 }];

const cases = {
  LineChart: () => h(Charts.LineChart, { data: days, aspectRatio: "2/1" }, h(Charts.Grid, { horizontal: true }), h(Charts.Line, { dataKey: "users" }), h(Charts.XAxis), h(Charts.ChartTooltip)),
  BarChart: () => h(Charts.BarChart, { data: months, xDataKey: "month", aspectRatio: "2/1" }, h(Charts.Bar, { dataKey: "revenue" }), h(Charts.BarXAxis)),
  // Gated charts are client-only: the server render must not throw, and draws no svg until the client takes over.
  PieChart: () => h(Charts.PieChart, { data: slices }, ...slices.map((s, i) => h(Charts.PieSlice, { index: i, key: s.label }))),
};

const CLIENT_ONLY = new Set(["PieChart"]);
let failed = 0;
for (const [label, render] of Object.entries(cases)) {
  try {
    const html = renderToString(render());
    const svgs = html.match(/<svg/g)?.length ?? 0;
    if (!svgs && !CLIENT_ONLY.has(label)) throw new Error("rendered no <svg>");
    console.log(`  PASS  ${label} (${svgs} svg, ${html.length} bytes${svgs ? "" : ", client-only"})`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${label}: ${String(error?.message ?? error).split("\n")[0]}`);
  }
}
process.exit(failed ? 1 : 0);
