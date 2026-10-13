import { bundleFor } from "./bundle-data";
import { type Headline, HeadlineCards } from "./headline-cards";
import { chartPair } from "./headline-data";

/** One chart's headline cards from the production sweep (medians of both sides) and the bundle measurement. */
export function FixedHeadlines({ route, name }: { route: string; name: string }) {
  const render = chartPair(route, "render");
  const busy = chartPair(route, "busy");
  const kb = bundleFor(name);
  const items: Headline[] = [
    { label: "Time to Render", bklit: render?.b[0] ?? null, migrated: render?.m[0] ?? null, unit: "ms", pending: "No designed entrance" },
    { label: "On hover", bklit: busy?.b[0] ?? null, migrated: busy?.m[0] ?? null, unit: "ms", digits: 2, pending: "Not measured" },
    { label: "Bundle Size", bklit: kb?.[0] ?? null, migrated: kb?.[1] ?? null, unit: "KB", pending: "Not measured" },
  ];
  return <HeadlineCards items={items} />;
}
