// Exact datasets from bklit-ui docs pages — used by showcase demo components
// to match the look and feel of production bklit.com/docs/components/* pages.
//
// Every export here is verbatim from repos/bklit-ui/apps/web/:
//   content/docs/components/*.mdx        (inline data)
//   components/docs/*-demo.tsx           (demo components)
//   components/docs/*-docs-data.ts       (shared data files)
//   lib/composed-demo-data.ts            (composed time-series)
//   lib/heatmap-demo-data.ts             (heatmap calendar grid)
//
// HEATMAP note: data depends on "today", so it's generated once per app load
// via the helper below (seeded deterministic, same shape as bklit's
// `getHeatmapDemoData()` output).
//
// All coordinates preserved verbatim — no numeric fudging.

/* ------------------------------------------------------------------ */
/*  LINE CHART  (line-chart-docs-data.ts)                              */
/* ------------------------------------------------------------------ */

export const lineChartDocsData = [
  { date: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), users: 1200, pageviews: 4500 },
  { date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), users: 1350, pageviews: 4800 },
  { date: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000), users: 1100, pageviews: 4200 },
  { date: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000), users: 1450, pageviews: 5100 },
  { date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), users: 1380, pageviews: 4900 },
  { date: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000), users: 1520, pageviews: 5400 },
  { date: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000), users: 1600, pageviews: 5800 },
  { date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), users: 1480, pageviews: 5200 },
  { date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), users: 1550, pageviews: 5500 },
  { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), users: 1420, pageviews: 5000 },
  { date: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000), users: 1680, pageviews: 6100 },
  { date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), users: 1750, pageviews: 6400 },
  { date: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000), users: 1620, pageviews: 5900 },
  { date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), users: 1580, pageviews: 5700 },
  { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), users: 1720, pageviews: 6200 },
  { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), users: 1850, pageviews: 6800 },
  { date: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000), users: 1780, pageviews: 6500 },
  { date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), users: 1650, pageviews: 6000 },
  { date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), users: 1920, pageviews: 7100 },
  { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), users: 1880, pageviews: 6900 },
  { date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),  users: 1750, pageviews: 6400 },
  { date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),  users: 1980, pageviews: 7300 },
  { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  users: 2050, pageviews: 7600 },
  { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),  users: 1920, pageviews: 7100 },
  { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),  users: 2100, pageviews: 7800 },
  { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),  users: 2180, pageviews: 8100 },
  { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),  users: 2050, pageviews: 7600 },
  { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),  users: 2250, pageviews: 8400 },
  { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),  users: 2320, pageviews: 8700 },
  { date: new Date(),                                      users: 2400, pageviews: 9000 },
];

export const lineChartDocsMarkers = [
  { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),  icon: "\uD83D\uDE80",  title: "v1.2.0 Released",      description: "New chart animations",        href: "https://github.com/bklit/bklit-ui/releases", target: "_blank" },
  { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),  icon: "\uD83D\uDC1B",  title: "Bug Fix",               description: "Fixed tooltip positioning",    href: "https://github.com/bklit/bklit-ui/issues",   target: "_blank" },
  { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),  icon: "\uD83D\uDCE6",  title: "Dependency Update",      description: "Updated motion to v12",        href: "https://motion.dev",                        target: "_blank" },
  { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),  icon: "\u26A1",        title: "Performance",            description: "50% faster renders",           href: "#performance",                               target: "_self" },
  { date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), icon: "\u2728",        title: "Feature Launch",         description: "Added grid support",           href: "#grid",                                      target: "_self" },
  { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), icon: "\uD83C\uDFA8",  title: "Design Update",          description: "New color system",             href: "#theming",                                   target: "_self" },
  { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), icon: "\uD83D\uDCDD",  title: "Docs Updated",           description: "Added examples",               href: "#usage",                                     target: "_self" },
];

/* ------------------------------------------------------------------ */
/*  AREA CHART  (inline in area-chart.mdx)                             */
/* ------------------------------------------------------------------ */

export const areaChartDocsData = [
  { date: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), revenue: 12000, costs: 8500 },
  { date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), revenue: 13500, costs: 9200 },
  { date: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000), revenue: 11000, costs: 7800 },
  { date: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000), revenue: 14500, costs: 10100 },
  { date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), revenue: 13800, costs: 9400 },
  { date: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000), revenue: 15200, costs: 10800 },
  { date: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000), revenue: 16000, costs: 11200 },
  { date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), revenue: 14800, costs: 10500 },
  { date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), revenue: 15500, costs: 10900 },
  { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), revenue: 14200, costs: 9800 },
  { date: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000), revenue: 16800, costs: 11800 },
  { date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), revenue: 17500, costs: 12400 },
  { date: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000), revenue: 16200, costs: 11500 },
  { date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), revenue: 15800, costs: 11200 },
  { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), revenue: 17200, costs: 12100 },
  { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), revenue: 18500, costs: 13200 },
  { date: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000), revenue: 17800, costs: 12600 },
  { date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), revenue: 16500, costs: 11700 },
  { date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), revenue: 19200, costs: 13800 },
  { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), revenue: 18800, costs: 13400 },
  { date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),  revenue: 17500, costs: 12400 },
  { date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),  revenue: 19800, costs: 14200 },
  { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  revenue: 20500, costs: 14800 },
  { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),  revenue: 19200, costs: 13600 },
  { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),  revenue: 21000, costs: 15200 },
  { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),  revenue: 21800, costs: 15800 },
  { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),  revenue: 20500, costs: 14600 },
  { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),  revenue: 22500, costs: 16200 },
  { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),  revenue: 23200, costs: 16800 },
  { date: new Date(),                                      revenue: 24000, costs: 17400 },
];

/* ------------------------------------------------------------------ */
/*  BAR CHART  (inline in bar-chart.mdx)                               */
/* ------------------------------------------------------------------ */

export const barChartDocsData = [
  { month: "Jan", revenue: 12000, profit: 4500 },
  { month: "Feb", revenue: 15500, profit: 5200 },
  { month: "Mar", revenue: 11000, profit: 3800 },
  { month: "Apr", revenue: 18500, profit: 7100 },
  { month: "May", revenue: 16800, profit: 5400 },
  { month: "Jun", revenue: 21200, profit: 8800 },
];

/* ------------------------------------------------------------------ */
/*  SCATTER CHART  (scatter-chart-demo.tsx)                            */
/* ------------------------------------------------------------------ */

export const scatterChartDocsData = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(2023, i, 1),
  sessions: Math.floor(140 + Math.sin(i / 3) * 90 + ((i * 11) % 40)),
  conversions: Math.floor(70 + Math.cos(i / 2.5) * 55 + ((i * 7) % 35)),
}));

/* ------------------------------------------------------------------ */
/*  CANDLESTICK CHART  (candlestick-chart-demo.tsx)                    */
/* ------------------------------------------------------------------ */

export const candlestickChartDocsData = [
  { date: new Date(2024, 0, 1), open: 100, high: 108, low: 96, close: 104 },
  { date: new Date(2024, 0, 2), open: 104, high: 112, low: 101, close: 109 },
  { date: new Date(2024, 0, 3), open: 109, high: 115, low: 105, close: 108 },
  { date: new Date(2024, 0, 4), open: 108, high: 114, low: 102, close: 110 },
  { date: new Date(2024, 0, 5), open: 110, high: 118, low: 108, close: 115 },
  { date: new Date(2024, 0, 6), open: 115, high: 120, low: 111, close: 113 },
  { date: new Date(2024, 0, 7), open: 113, high: 119, low: 110, close: 117 },
  { date: new Date(2024, 0, 8), open: 117, high: 124, low: 115, close: 121 },
  { date: new Date(2024, 0, 9), open: 121, high: 126, low: 118, close: 120 },
  { date: new Date(2024, 0, 10), open: 120, high: 128, low: 117, close: 125 },
];

/* ------------------------------------------------------------------ */
/*  COMPOSED CHART  (lib/composed-demo-data.ts + composed-chart-docs-preview.tsx) */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
const START_MS = Date.UTC(2024, 0, 1, 12, 0, 0);
const COMPOSED_DEMO_DAY_COUNT = 30;

function isoDay(i: number): string {
  return new Date(START_MS + i * DAY_MS).toISOString();
}

function smoothCycle(i: number, phase: number): number {
  const u = i / (COMPOSED_DEMO_DAY_COUNT - 1);
  return Math.sin(u * Math.PI * 2 + phase);
}

export const composedDocsData = Array.from(
  { length: COMPOSED_DEMO_DAY_COUNT },
  (_, i) => {
    const units = Math.round(
      46 + 14 * smoothCycle(i, 0.35) + 6 * Math.sin(i / 14) + (i / COMPOSED_DEMO_DAY_COUNT) * 10
    );
    const revenue = Math.round(
      96 + 11 * smoothCycle(i, 1.05) + 5 * Math.sin(i / 17) + (i / COMPOSED_DEMO_DAY_COUNT) * 18
    );
    const runRate = Math.round(
      82 + 9 * smoothCycle(i, 1.9) + 5 * Math.cos(i / 16) + (i / COMPOSED_DEMO_DAY_COUNT) * 8
    );
    return {
      date: isoDay(i),
      units: Math.max(18, Math.min(95, units)),
      revenue: Math.max(72, Math.min(155, revenue)),
      runRate: Math.max(62, Math.min(118, runRate)),
    };
  }
);

/* ------------------------------------------------------------------ */
/*  RADAR CHART  (radar-chart-demo.tsx)                                */
/* ------------------------------------------------------------------ */

export const radarDocsMetrics = [
  { key: "engagement", label: "Engagement" },
  { key: "pagesPerSession", label: "Pages/Session" },
  { key: "sessionDuration", label: "Session Duration" },
  { key: "conversionRate", label: "Conversion" },
  { key: "bounceInverse", label: "Retention" },
];

export const radarDocsData = [
  {
    label: "Google Search",
    color: "#3b82f6",
    values: { engagement: 72, pagesPerSession: 68, sessionDuration: 70, conversionRate: 75, bounceInverse: 65 },
  },
  {
    label: "Display Ads",
    color: "#f59e0b",
    values: { engagement: 85, pagesPerSession: 45, sessionDuration: 40, conversionRate: 30, bounceInverse: 88 },
  },
  {
    label: "Newsletter",
    color: "#10b981",
    values: { engagement: 45, pagesPerSession: 90, sessionDuration: 92, conversionRate: 88, bounceInverse: 42 },
  },
  {
    label: "Social",
    color: "#ec4899",
    values: { engagement: 95, pagesPerSession: 35, sessionDuration: 25, conversionRate: 55, bounceInverse: 78 },
  },
];

/* ------------------------------------------------------------------ */
/*  PIE CHART  (pie-chart-demo.tsx)                                    */
/* ------------------------------------------------------------------ */

export const pieDocsData = [
  { label: "Electronics", value: 4250, color: "#0ea5e9" },
  { label: "Clothing", value: 3120, color: "#a855f7" },
  { label: "Food", value: 2100, color: "#f59e0b" },
  { label: "Home", value: 1580, color: "#10b981" },
  { label: "Other", value: 1050, color: "#ef4444" },
];

/* ------------------------------------------------------------------ */
/*  RING CHART  (ring-chart-demo.tsx)                                  */
/* ------------------------------------------------------------------ */

export const ringDocsData = [
  { label: "Organic", value: 4250, maxValue: 5000, color: "#0ea5e9" },
  { label: "Paid", value: 3120, maxValue: 5000, color: "#a855f7" },
  { label: "Email", value: 2100, maxValue: 5000, color: "#f59e0b" },
  { label: "Social", value: 1580, maxValue: 5000, color: "#10b981" },
  { label: "Referral", value: 1050, maxValue: 5000, color: "#ef4444" },
  { label: "Direct", value: 747, maxValue: 5000, color: "#6366f1" },
];

/* ------------------------------------------------------------------ */
/*  GAUGE  (gauge-chart-demo.tsx)                                      */
/* ------------------------------------------------------------------ */

export const gaugeDocsProps = {
  value: 66,
  centerValue: 428_000,
  defaultLabel: "ARR run rate",
  spacing: 25,
  inactiveFillOpacity: 0.4,
  formatOptions: { style: "currency" as const, currency: "USD", maximumFractionDigits: 0 },
};

/* ------------------------------------------------------------------ */
/*  FUNNEL CHART  (inline in funnel-chart.mdx)                         */
/* ------------------------------------------------------------------ */

export const funnelDocsData = [
  { label: "Visitors", value: 12400, displayValue: "12.4k" },
  { label: "Leads", value: 6800, displayValue: "6.8k" },
  { label: "Qualified", value: 3200, displayValue: "3.2k" },
  { label: "Proposals", value: 1500, displayValue: "1.5k" },
  { label: "Closed", value: 620, displayValue: "620" },
];

/* ------------------------------------------------------------------ */
/*  SANKEY CHART  (inline in sankey-chart.mdx)                         */
/* ------------------------------------------------------------------ */

export const sankeyDocsData: {
  nodes: Array<{ name: string; category?: "source" | "landing" | "outcome"; [key: string]: unknown }>;
  links: Array<{ source: number; target: number; value: number; [key: string]: unknown }>;
} = {
  nodes: [
    { name: "Organic Search", category: "source" },
    { name: "Paid Search", category: "source" },
    { name: "Paid Social", category: "source" },
    { name: "Email", category: "source" },
    { name: "Referral", category: "source" },
    { name: "Direct", category: "source" },
    { name: "Blog", category: "landing" },
    { name: "Pricing", category: "landing" },
    { name: "Product", category: "landing" },
    { name: "Docs", category: "landing" },
    { name: "Homepage", category: "landing" },
    { name: "Converted", category: "outcome" },
    { name: "Engaged", category: "outcome" },
    { name: "Bounced", category: "outcome" },
  ],
  links: [
    { source: 0, target: 6, value: 4200 },
    { source: 0, target: 9, value: 2800 },
    { source: 0, target: 7, value: 1500 },
    { source: 1, target: 7, value: 3100 },
    { source: 1, target: 8, value: 2200 },
    { source: 1, target: 6, value: 800 },
    { source: 2, target: 6, value: 2800 },
    { source: 2, target: 10, value: 1900 },
    { source: 2, target: 8, value: 600 },
    { source: 3, target: 7, value: 2100 },
    { source: 3, target: 8, value: 1400 },
    { source: 3, target: 6, value: 900 },
    { source: 4, target: 6, value: 1800 },
    { source: 4, target: 9, value: 1200 },
    { source: 4, target: 7, value: 700 },
    { source: 5, target: 10, value: 3500 },
    { source: 5, target: 7, value: 1800 },
    { source: 5, target: 8, value: 1100 },
    { source: 6, target: 11, value: 2100 },
    { source: 6, target: 12, value: 4800 },
    { source: 6, target: 13, value: 3600 },
    { source: 7, target: 11, value: 4500 },
    { source: 7, target: 12, value: 3200 },
    { source: 7, target: 13, value: 1500 },
    { source: 8, target: 11, value: 2800 },
    { source: 8, target: 12, value: 1900 },
    { source: 8, target: 13, value: 600 },
    { source: 9, target: 11, value: 800 },
    { source: 9, target: 12, value: 2400 },
    { source: 9, target: 13, value: 800 },
    { source: 10, target: 11, value: 1200 },
    { source: 10, target: 12, value: 1800 },
    { source: 10, target: 13, value: 2400 },
  ],
};

/* ------------------------------------------------------------------ */
/*  SUNBURST CHART  (sunburst-chart-demo-data.ts)                      */
/* ------------------------------------------------------------------ */

export const sunburstDocsData = {
  name: "Revenue",
  children: [
    {
      name: "Product",
      children: [
        {
          name: "Enterprise",
          children: [
            { name: "North America", children: [
              { name: "Direct", value: 52 },
              { name: "Channel", value: 38 },
            ] },
            { name: "EMEA", value: 60 },
            { name: "APAC", value: 48 },
          ],
        },
        { name: "Pro", children: [
          { name: "Teams", value: 90 },
          { name: "Solo", value: 55 },
        ] },
        { name: "Starter", value: 95 },
      ],
    },
    {
      name: "Services",
      children: [
        { name: "Consulting", children: [
          { name: "Strategy", value: 72 },
          { name: "Implementation", value: 88 },
        ] },
        { name: "Support", children: [
          { name: "Premium", value: 48 },
          { name: "Standard", value: 42 },
        ] },
        { name: "Training", value: 55 },
      ],
    },
    {
      name: "Partners",
      children: [
        { name: "Referrals", value: 120 },
        { name: "Affiliates", value: 75 },
        { name: "Resellers", children: [
          { name: "Regional", value: 64 },
          { name: "Global", value: 46 },
        ] },
      ],
    },
    {
      name: "Other",
      children: [
        { name: "Licensing", value: 85 },
        { name: "Events", value: 42 },
      ],
    },
  ],
};
