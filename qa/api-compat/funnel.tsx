// Q2 API fixture: exercises migrated FunnelChart public props (both orientations); must typecheck (tsc --noEmit).
// OPEN: index.ts not yet wired with FunnelChart exports; tsc reports TS2305 until then.
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
      <FunnelChart color="var(--chart-1)" data={basicData} layers={3} />

      <FunnelChart color="var(--chart-1)" data={basicData} layers={3} orientation="vertical" />

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

      <FunnelChart data={richData} renderPattern={renderPattern} showLabels showPercentage showValues />

      <FunnelChart data={richData} showLabels={false} showPercentage={false} showValues={false} />

      <FunnelChart data={basicData} formatPercentage={customFormatPercentage} formatValue={customFormatValue} />

      <FunnelChart data={basicData} enterTransition={tweenTransition} staggerDelay={0.2} />

      <FunnelChart data={basicData} enterTransition={springTransition} orientation="vertical" />

      <FunnelChart data={basicData} grid />
      <FunnelChart data={basicData} grid={false} />
      <FunnelChart
        data={basicData}
        grid={{ bands: true, bandColor: "var(--color-muted)", lineColor: "var(--chart-grid)", lineOpacity: 0.5, lines: true, lineWidth: 2 }}
        orientation="vertical"
      />
      <FunnelChart data={basicData} grid={{ bands: false, lines: true }} />

      <FunnelChart data={basicData} labelAlign="start" labelLayout="grouped" labelOrientation="horizontal" />
      <FunnelChart data={basicData} labelAlign="end" labelLayout="grouped" labelOrientation="vertical" orientation="vertical" />
      <FunnelChart data={basicData} labelAlign="center" labelLayout="spread" />

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
