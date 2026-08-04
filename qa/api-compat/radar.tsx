// Q2 API-compatibility fixture (research/05): exercises every public prop
// the migrated RadarChart supports at pilot scope (docs/LOG.md D24 — the
// canonical docs-demo path plus the pilot's documented extras). Must
// typecheck with zero errors via `tsc --noEmit` (included from
// bench/app/tsconfig.json). Runtime smoke is covered by the bench scenarios
// (console-errors column in docs/BENCHMARKS.md must be 0). Note: RadarChart
// has no onPhaseChange/status prop (bklit parity — verified directly in
// repos/bklit-ui/packages/ui/src/charts/radar-chart.tsx).
import * as React from "react";
import {
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
  type RadarData,
  type RadarEnterTransition,
  type RadarMetric,
} from "@migrated/charts";

const metrics: RadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
  { key: "safety", label: "Safety" },
  { key: "efficiency", label: "Efficiency" },
];

const data: RadarData[] = [
  {
    label: "Model A",
    values: { speed: 80, reliability: 65, comfort: 90, safety: 70, efficiency: 55 },
  },
  {
    label: "Model B",
    color: "var(--chart-2)",
    values: { speed: 60, reliability: 85, comfort: 50, safety: 95, efficiency: 75 },
  },
];

const tweenTransition: RadarEnterTransition = { type: "tween", duration: 0.8, ease: [0.85, 0, 0.15, 1] };
const springTransition: RadarEnterTransition = { type: "spring", bounce: 0.15, stiffness: 90, damping: 12, mass: 1 };

export function RadarChartApiFixture() {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const onHoverChange = (index: number | null): void => {
    setHoveredIndex(index);
  };

  return (
    <>
      {/* Canonical demo path (docs demo parity). */}
      <RadarChart data={data} metrics={metrics} size={400}>
        <RadarGrid />
        <RadarAxis />
        <RadarLabels />
        {data.map((series, index) => (
          <RadarArea index={index} key={series.label} />
        ))}
      </RadarChart>

      {/* Full pilot prop surface — tween enterTransition variant. */}
      <RadarChart
        data={data}
        metrics={metrics}
        size={320}
        levels={4}
        margin={48}
        animate
        enterDurationMs={900}
        staggerScale={1.2}
        enterTransition={tweenTransition}
        motionReplayKey="epoch-1"
        hoveredIndex={hoveredIndex}
        onHoverChange={onHoverChange}
        className="chart"
        style={{ width: "100%" }}
      >
        <RadarGrid showLabels stroke="var(--chart-grid)" strokeOpacity={0.6} className="grid" />
        <RadarAxis stroke="var(--chart-grid)" strokeOpacity={0.6} className="axis" />
        <RadarLabels offset={24} fontSize={11} interactive className="labels" />
        <RadarArea index={0} color="var(--chart-1)" showPoints showStroke showGlow className="area-0" />
        <RadarArea
          index={1}
          showPoints={false}
          showStroke={false}
          showGlow={false}
          className="area-1"
        />
      </RadarChart>

      {/* Full pilot prop surface — spring enterTransition variant, animate
          disabled, no grid labels, uncontrolled hover. */}
      <RadarChart
        data={data}
        metrics={metrics}
        levels={6}
        margin={72}
        animate={false}
        enterDurationMs={1200}
        staggerScale={0.8}
        enterTransition={springTransition}
        motionReplayKey="epoch-2"
      >
        <RadarGrid showLabels={false} />
        <RadarAxis />
        {data.map((series, index) => (
          <RadarArea index={index} key={series.label} />
        ))}
      </RadarChart>

      {/* Responsive sizing (no `size` prop) with no optional children at
          all — <RadarAxis>/<RadarLabels>/<RadarGrid> are independently
          optional per bklit parity. */}
      <RadarChart data={data} metrics={metrics}>
        {data.map((series, index) => (
          <RadarArea index={index} key={series.label} />
        ))}
      </RadarChart>
    </>
  );
}
