import { allCharts } from "@/lib/chart-data";
import { bundleGeo, bundleTotal } from "./bundle-data";
import type { Headline } from "./headline-cards";
import { type Metric, summarise } from "./headline-data";

const routes = allCharts.map((c) => c.route);

/** Card figure: geometric mean of per-chart ratios; the values under it are means of the per-chart medians. */
function card(label: string, metric: Metric, digits = 1, floor = 0): Headline {
  const s = summarise(routes, metric, floor);
  return { label, bklit: s?.bklitMs ?? null, migrated: s?.migratedMs ?? null, ratio: s?.geo, unit: "ms", digits };
}

/** The three core metrics of the production sweep, shared by the performance page and the home page. */
export const summaryHeadlines: Headline[] = [
  card("Time to Render", "render"),
  card("On hover", "busy", 2, 0.05),
  { label: "Bundle Size", bklit: bundleTotal[0], migrated: bundleTotal[1], ratio: bundleGeo, unit: "KB" },
];
