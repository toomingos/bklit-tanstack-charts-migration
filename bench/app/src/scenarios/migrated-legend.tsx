// Migrated Legend scenario — IDENTICAL usage to bklit-legend.tsx (same
// component tree, same items/props), only the import source changes.
import { useEffect, useState } from "react";
import {
  ChartLegend,
  Legend,
  LegendItemComponent,
  LegendMarker,
  LegendLabel,
  LegendValue,
  LegendProgress,
} from "@migrated/charts";

const ITEMS = [
  { label: "Alpha", value: 4200, maxValue: 6000, color: "var(--chart-1)" },
  { label: "Beta", value: 3100, maxValue: 6000, color: "var(--chart-2)" },
  { label: "Gamma", value: 1800, maxValue: 6000, color: "var(--chart-3)" },
  { label: "Delta", value: 950, maxValue: 6000, color: "var(--chart-4)" },
];

export default function MigratedLegend({ n: _n }: { n: number; state?: "ready" | "loading" }) {
  void _n;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    let resolveFn: () => void = () => {};
    window.__benchSettled = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => resolveFn()),
    );
    (window as unknown as Record<string, unknown>).__qaSetLegendHover = (
      i: number | null,
    ) => setHoveredIndex(i);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        gap: 48,
        padding: 24,
        alignItems: "flex-start",
      }}
    >
      <div style={{ width: 300 }}>
        <ChartLegend
          hoveredIndex={hoveredIndex}
          items={ITEMS}
          onHover={setHoveredIndex}
          showProgress
          title="Legacy ChartLegend"
        />
      </div>
      <div style={{ width: 300 }}>
        <Legend
          hoveredIndex={hoveredIndex}
          items={ITEMS}
          onHoverChange={setHoveredIndex}
          title="Composable Legend"
        >
          <LegendItemComponent>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LegendMarker />
              <LegendLabel />
              <span style={{ marginLeft: "auto" }}>
                <LegendValue showPercentage />
              </span>
            </div>
            <LegendProgress />
          </LegendItemComponent>
        </Legend>
      </div>
    </div>
  );
}
