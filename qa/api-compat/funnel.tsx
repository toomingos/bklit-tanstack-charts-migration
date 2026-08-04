// Q2 API-compatibility fixture: exercises the full public prop surface of
// the migrated FunnelChart (both orientations) against
// repos/bklit-ui/packages/ui/src/charts/funnel-chart.tsx. Must typecheck
// with zero errors via `tsc --noEmit` (included from bench/app/tsconfig.json)
// -- OPEN ITEM: as of this writing `@migrated/charts`'s `index.ts` has not
// yet been wired with FunnelChart's export lines (Fable's job, per this
// deliverable's own constraints -- see the migration report's "registry
// export lines" section for the exact lines to add), so `tsc --noEmit`
// currently reports one `TS2305 has no exported member 'FunnelChart'` error
// for this file until that wiring lands; every other prop/type usage below
// has been verified error-free via a scoped relative-import probe. Runtime
// smoke is covered by the bench scenarios (bklit-funnel(vertical).tsx /
// migrated-funnel(vertical).tsx).
import * as React from "react";
import {
  FunnelChart,
  type FunnelChartProps,
  type FunnelEnterTransition,
  type FunnelGradientStop,
  type FunnelStage,
} from "@migrated/charts";

const basicData: FunnelStage[] = [
  { label: "Visitors", value: 5000 },
  { label: "Signups", value: 3200 },
  { label: "Trials", value: 1800 },
  { label: "Customers", value: 620 },
];

const gradientStops: FunnelGradientStop[] = [
  { offset: "0%", color: "#8B5CF6" },
  { offset: "100%", color: "#3B82F6" },
];

const richData: FunnelStage[] = [
  { label: "Impressions", value: 12000, displayValue: "12,000 views" },
  { label: "Clicks", value: 4200, color: "var(--chart-2)" },
  { label: "Leads", value: 900, gradient: gradientStops },
  { label: "Deals", value: 260, gradient: [{ offset: 0, color: "#F59E0B" }, { offset: 1, color: "#EF4444" }] },
  { label: "Won", value: 90 },
];

const tweenTransition: FunnelEnterTransition = { type: "tween", duration: 0.9, ease: [0.85, 0, 0.15, 1] };
const springTransition: FunnelEnterTransition = { type: "spring", bounce: 0.2, stiffness: 120, damping: 14, mass: 1 };

const customFormatPercentage = (pct: number): string => `${pct.toFixed(1)}%`;
const customFormatValue = (value: number): string => `$${value.toLocaleString("en-US")}`;

const renderPattern = (id: string, color: string): React.ReactNode => (
  <pattern height={8} id={id} patternUnits="userSpaceOnUse" width={8}>
    <rect fill={color} height={8} opacity={0.15} width={8} />
    <path d="M0 8 L8 0" stroke={color} strokeWidth={1} />
  </pattern>
);

export function FunnelChartApiFixture() {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const onHoverChange = (index: number | null): void => {
    setHoveredIndex(index);
  };

  return (
    <>
      {/* Canonical docs-demo path (D30 basis) -- horizontal, fixed color +
          layers, everything else default. */}
      <FunnelChart color="var(--chart-1)" data={basicData} layers={3} />

      {/* Vertical orientation, same data. */}
      <FunnelChart color="var(--chart-1)" data={basicData} layers={3} orientation="vertical" />

      {/* Straight edges, custom gap, controlled hover, className/style. */}
      <FunnelChart
        className="fixture-funnel"
        data={basicData}
        edges="straight"
        gap={8}
        hoveredIndex={hoveredIndex}
        layers={4}
        onHoverChange={onHoverChange}
        style={{ width: "100%" }}
      />

      {/* Per-stage color/gradient overrides, displayValue, custom
          renderPattern (innermost ring only), showValues/showPercentage/
          showLabels toggles. */}
      <FunnelChart data={richData} renderPattern={renderPattern} showLabels showPercentage showValues />

      <FunnelChart data={richData} showLabels={false} showPercentage={false} showValues={false} />

      {/* Custom formatPercentage/formatValue. */}
      <FunnelChart data={basicData} formatPercentage={customFormatPercentage} formatValue={customFormatValue} />

      {/* Explicit enterTransition (tween) + staggerDelay override. */}
      <FunnelChart data={basicData} enterTransition={tweenTransition} staggerDelay={0.2} />

      {/* Spring enterTransition (bounce shorthand + explicit constants). */}
      <FunnelChart data={basicData} enterTransition={springTransition} orientation="vertical" />

      {/* Grid: boolean shorthand and full object form (bands/lines toggled
          independently, custom colors/opacity/width) -- both orientations. */}
      <FunnelChart data={basicData} grid />
      <FunnelChart data={basicData} grid={false} />
      <FunnelChart
        data={basicData}
        grid={{ bands: true, bandColor: "var(--color-muted)", lineColor: "var(--chart-grid)", lineOpacity: 0.5, lines: true, lineWidth: 2 }}
        orientation="vertical"
      />
      <FunnelChart data={basicData} grid={{ bands: false, lines: true }} />

      {/* labelLayout="grouped" with explicit labelOrientation/labelAlign,
          both orientations. */}
      <FunnelChart data={basicData} labelAlign="start" labelLayout="grouped" labelOrientation="horizontal" />
      <FunnelChart data={basicData} labelAlign="end" labelLayout="grouped" labelOrientation="vertical" orientation="vertical" />
      <FunnelChart data={basicData} labelAlign="center" labelLayout="spread" />

      {/* Exhaustive `FunnelChartProps` reference (kept last, purely for
          typecheck coverage of every documented prop at once). */}
      {((): FunnelChartProps => ({
        data: richData,
        orientation: "vertical",
        color: "var(--chart-1)",
        layers: 3,
        className: "fixture-funnel",
        style: { width: "100%" },
        showPercentage: true,
        showValues: true,
        showLabels: true,
        hoveredIndex: null,
        onHoverChange: () => {},
        formatPercentage: customFormatPercentage,
        formatValue: customFormatValue,
        staggerDelay: 0.12,
        enterTransition: tweenTransition,
        gap: 4,
        renderPattern,
        edges: "curved",
        labelLayout: "grouped",
        labelOrientation: "vertical",
        labelAlign: "center",
        grid: { bands: true, bandColor: "var(--color-muted)", lines: true, lineColor: "var(--chart-grid)", lineOpacity: 1, lineWidth: 1 },
      }))() && null}
    </>
  );
}
