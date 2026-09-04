// Q2 API fixture: exercises migrated HeatmapChart family public props; must typecheck (tsc --noEmit).
// OPEN: index.ts not yet wired with Heatmap exports; tsc reports TS2305 until then.
// HeatmapLegend* render OUTSIDE <HeatmapChart> with independent props (they don't read HeatmapContext).
// Disclosed scope cuts, exercised as absent: aspectRatio, loadingOpacity, showLoadingCells.
import * as React from "react";
import {
  HeatmapChart,
  type HeatmapChartProps,
  HeatmapCells,
  HeatmapXAxis,
  HeatmapYAxis,
  HeatmapTooltip,
  HeatmapLegend,
  HeatmapLegendSwatch,
  HeatmapLegendGradient,
  HeatmapInteractionProvider,
  HeatmapInteractionBoundary,
  HeatmapInteractionRoot,
  HeatmapChartLoading,
  generateHeatmapSkeletonFromTarget,
  HeatmapSeparator,
  type HeatmapColumn,
  type HeatmapBin,
  type HeatmapColumnSeparatorsConfig,
  type HeatmapSeparatorGradient,
  type HeatmapWeekStartDay,
  type HeatmapYAxisLabelFormat,
  type HeatmapYAxisTickFilter,
  type HeatmapEnterTransition,
  type HeatmapLevelColors,
  type HeatmapLevelStyles,
  HEATMAP_DEFAULT_LEVEL_COLORS,
  HEATMAP_DEFAULT_LEVEL_STYLES,
  HEATMAP_INACTIVE_OPACITY,
} from "@migrated/charts";

function buildSampleColumns(weekCount: number, startDate: Date): HeatmapColumn[] {
  const columns: HeatmapColumn[] = [];
  for (let week = 0; week < weekCount; week++) {
    const bins: HeatmapBin[] = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + week * 7 + day);
      bins.push({ count: (week + day) % 9, bin: day, date });
    }
    columns.push({ bin: week, bins });
  }
  return columns;
}

const anchorDate = new Date(2026, 0, 4); // a Sunday
const basicData = buildSampleColumns(12, anchorDate);
const largeData = buildSampleColumns(53, anchorDate);

const customLevelColors: HeatmapLevelColors = [
  "#e5e7eb",
  "#a7f3d0",
  "#6ee7b7",
  "#34d399",
  "#059669",
];

const customLevelStyles: HeatmapLevelStyles = [
  { color: "#e5e7eb", fillMode: "solid" },
  { color: "#bae6fd", fillMode: "solid" },
  { color: "#7dd3fc", fillMode: "solid" },
  { color: "#38bdf8", fillMode: "solid" },
  { color: "#0284c7", fillMode: "pattern", pattern: "diagonal", patternColor: "#0369a1" },
];

const tweenTransition: HeatmapEnterTransition = { type: "tween", duration: 1.2, ease: [0.4, 0, 0.2, 1] };
const springTransition: HeatmapEnterTransition = { type: "spring", stiffness: 220, damping: 20, mass: 1 };

const everySeparators: HeatmapColumnSeparatorsConfig = { every: 4, groupBy: "every", spacing: 6 };
const quarterSeparators: HeatmapColumnSeparatorsConfig = { groupBy: "quarter", spacing: 8 };

const separatorGradient: HeatmapSeparatorGradient = {
  from: "var(--chart-grid-line)",
  via: "var(--chart-grid-line-strong)",
  to: "var(--chart-grid-line)",
  fromOpacity: 0.1,
  viaOpacity: 0.4,
  toOpacity: 0.1,
};

const weekStart: HeatmapWeekStartDay = 1;
const yAxisLabelFormat: HeatmapYAxisLabelFormat = "full";
const yAxisTickFilter: HeatmapYAxisTickFilter = "all";

export function HeatmapChartApiFixture() {
  const [status, setStatus] = React.useState<"loading" | "ready">("ready");
  const [revealSignature, setRevealSignature] = React.useState(0);

  return (
    <>
      <HeatmapInteractionProvider>
        <HeatmapInteractionBoundary>
          <div className="flex w-full flex-col items-stretch gap-3">
            <HeatmapChart className="w-full" data={basicData} layout="fluid">
              <HeatmapCells />
              <HeatmapXAxis />
              <HeatmapYAxis />
              <HeatmapTooltip />
            </HeatmapChart>
            <HeatmapLegend />
          </div>
        </HeatmapInteractionBoundary>
      </HeatmapInteractionProvider>

      <HeatmapInteractionRoot>
        <HeatmapChart
          data={largeData}
          layout="fill"
          binSize={14}
          margin={{ top: 20, right: 8, bottom: 24, left: 32 }}
          xDomain={[anchorDate, new Date(2026, 5, 30)]}
          sizingColumnCount={53}
        >
          <HeatmapCells colorScale={(count) => (count > 4 ? "#059669" : "#e5e7eb")} />
          <HeatmapXAxis className="fixture-x-axis" />
          <HeatmapYAxis className="fixture-y-axis" />
          <HeatmapTooltip instant showDelay={50} hideDelay={200} />
        </HeatmapChart>
      </HeatmapInteractionRoot>

      <HeatmapInteractionProvider>
        <HeatmapInteractionBoundary>
          <div className="flex w-full flex-col items-stretch gap-3">
            <HeatmapChart
              data={basicData}
              gap={3}
              weekStartDay={weekStart}
              levelColors={customLevelColors}
              columnSeparators={everySeparators}
            >
              <HeatmapCells interactive inactiveOpacity={0.2} inactiveScale={0.95} activeScale={1.05} />
              <HeatmapXAxis />
              <HeatmapYAxis labelFormat={yAxisLabelFormat} tickFilter={yAxisTickFilter} />
              <HeatmapTooltip />
              <HeatmapSeparator every={4} groupBy="every" spacing={6} />
            </HeatmapChart>
            <HeatmapLegend inactiveOpacity={0.2} inactiveScale={0.95} activeScale={1.05} />
          </div>
        </HeatmapInteractionBoundary>
      </HeatmapInteractionProvider>

      {/* Pattern fillMode is accepted for API-compat though pattern rendering itself is a disclosed cut. */}
      <HeatmapInteractionProvider>
        <HeatmapInteractionBoundary>
          <div className="flex w-full flex-col items-stretch gap-3">
            <HeatmapChart
              data={largeData}
              status={status}
              levelStyles={customLevelStyles}
              animationDuration={900}
              enterTransition={tweenTransition}
              enterStaggerScale={0.6}
              animate
              revealSignature={String(revealSignature)}
              loadingCellMaxOpacity={0.7}
              loadingCellRandomness={0.5}
              loadingLabel="Loading contributions…"
              columnSeparators={quarterSeparators}
            >
              <HeatmapCells />
              <HeatmapXAxis />
              <HeatmapYAxis />
              <HeatmapTooltip />
              <HeatmapSeparator
                groupBy="quarter"
                spacing={8}
                strokeStyle="dashed"
                strokeDasharray="2,3"
                strokeWidth={1.5}
                gradient={separatorGradient}
                showLabels
                className="fixture-separator"
              />
            </HeatmapChart>
            <HeatmapLegendGradient
              levels={[0, 1, 2, 3, 4]}
              levelStyles={customLevelStyles}
              cellSize={10}
              gap={2}
              cornerRadius={2}
              gradientSpan={5}
              highlightedLevel={null}
              isDimming={false}
              inactiveOpacity={0.3}
              inactiveScale={1}
              activeScale={1}
              isInteractive={false}
              onEnter={() => {}}
              onLeave={() => {}}
            />
          </div>
        </HeatmapInteractionBoundary>
      </HeatmapInteractionProvider>

      <HeatmapInteractionProvider>
        <HeatmapInteractionBoundary>
          <HeatmapChart data={basicData} enterTransition={springTransition} animate={false}>
            <HeatmapCells />
            <HeatmapSeparator every={3} strokeStyle="solid" stroke="var(--chart-grid-line)" strokeWidth={1} showLabels={false} />
          </HeatmapChart>
          <div className="flex items-center gap-1">
            <HeatmapLegendSwatch level={0} style={HEATMAP_DEFAULT_LEVEL_STYLES[0]} cellSize={11} cornerRadius={2} />
            <HeatmapLegendSwatch level={1} style={HEATMAP_DEFAULT_LEVEL_STYLES[1]} cellSize={11} cornerRadius={2} />
            <HeatmapLegendSwatch level={2} style={HEATMAP_DEFAULT_LEVEL_STYLES[2]} cellSize={11} cornerRadius={2} />
            <HeatmapLegendSwatch level={3} style={customLevelStyles[3]} cellSize={11} cornerRadius={2} />
            <HeatmapLegendSwatch level={4} style={customLevelStyles[4]} cellSize={11} cornerRadius={2} />
          </div>
        </HeatmapInteractionBoundary>
      </HeatmapInteractionProvider>

      {/* Loading shape matches bklit's single-overload array form (`data`/`label` prop names). */}
      <HeatmapChartLoading data={basicData} label="Loading…" className="w-full" xDomain={[anchorDate, new Date(2026, 5, 30)]} margin={{ top: 16, right: 4, bottom: 20, left: 28 }} gap={3} cornerRadius={3} />
      <HeatmapChartLoading data={largeData} />
      {(() => {
        const skeletonFromColumns = generateHeatmapSkeletonFromTarget(basicData);
        return (
          <HeatmapChart data={skeletonFromColumns} status="loading">
            <HeatmapCells />
            <HeatmapXAxis />
            <HeatmapYAxis />
          </HeatmapChart>
        );
      })()}

      <button onClick={() => setStatus((s) => (s === "ready" ? "loading" : "ready"))} type="button">
        toggle status
      </button>
      <button onClick={() => setRevealSignature((n) => n + 1)} type="button">
        replay reveal
      </button>

      {/* Deliberately excludes aspectRatio/loadingOpacity/showLoadingCells (disclosed scope cuts). */}
      {((): HeatmapChartProps => ({
        data: basicData,
        xDomain: [anchorDate, new Date(2026, 5, 30)],
        sizingColumnCount: 12,
        layout: "fluid",
        margin: { top: 16, right: 4, bottom: 20, left: 28 },
        binSize: undefined,
        gap: 2,
        levelColors: HEATMAP_DEFAULT_LEVEL_COLORS,
        levelStyles: HEATMAP_DEFAULT_LEVEL_STYLES,
        className: "fixture-heatmap",
        status: "ready",
        loadingLabel: "Loading…",
        animationDuration: 1600,
        enterTransition: tweenTransition,
        revealSignature: "v1",
        enterStaggerScale: 1,
        animate: true,
        loadingCellMaxOpacity: 0.85,
        loadingCellRandomness: 1,
        columnSeparators: everySeparators,
        weekStartDay: 0,
        children: <HeatmapCells />,
      }))() && null}
    </>
  );
}
