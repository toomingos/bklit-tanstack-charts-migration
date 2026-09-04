// Bklit FunnelChart as plain SVG (no TanStack funnel primitive; geometry is pure pixel arithmetic).
// One FunnelSegment per stage owns graphic + label overlay; keyed by stage.label (replay-vs-snap free).
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { intFmt } from "./internal/formatters";
import { usePositiveChartSize } from "./internal/use-container-size";
import { funnelSegBox, resolveFunnelGrid } from './internal/funnel-geometry';
import { createFunnelHoverCoordinator } from './internal/funnel-hover-chrome';
import type { FunnelHoverCoordinator } from './internal/funnel-hover-chrome';
import type { FunnelEnterTransition } from './internal/enter-transition';
import { FunnelSegment } from './internal/funnel-segment';
import type { FunnelLabelAlign, FunnelLabelOrientation, FunnelStage } from './internal/funnel-segment';
import "./styles.css";

// Default ring-layer count when the layers prop is omitted (bklit parity).
const FUNNEL_DEFAULT_LAYERS = 3;
// Default reveal stagger between stages in seconds (bklit parity).
const FUNNEL_DEFAULT_STAGGER_DELAY_S = 0.12;
// Default gap between stages in pixels (bklit parity).
const FUNNEL_DEFAULT_GAP = 4;
// Fraction-to-percent scale for stage share labels.
const FUNNEL_PERCENT_SCALE = 100;

// Static grid svg style shared by every grid layer.
const FUNNEL_GRID_SVG_STYLE: CSSProperties = { height: "100%", inset: 0, pointerEvents: "none", position: "absolute", width: "100%" };

// Chart container style as a function of the computed aspect ratio plus the style prop.
const buildFunnelContainerStyle = (aspectRatio: string, style?: Readonly<CSSProperties>): CSSProperties => ({
  aspectRatio,
  overflow: "visible",
  position: "relative",
  userSelect: "none",
  width: "100%",
  ...style,
});

interface FunnelChartProps {
  readonly data: readonly FunnelStage[];
  readonly orientation?: "horizontal" | "vertical";
  readonly color?: string;
  readonly layers?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly showPercentage?: boolean;
  readonly showValues?: boolean;
  readonly showLabels?: boolean;
  readonly hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly formatPercentage?: (pct: number) => string;
  readonly formatValue?: (value: number) => string;
  readonly staggerDelay?: number;
  readonly enterTransition?: FunnelEnterTransition;
  readonly gap?: number;
  /** Render-prop for visx pattern defs; innermost ring takes fill="url(#id)", halos stay solid. */
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly edges?: "curved" | "straight";
  /** Label arrangement: "spread" (default) or "grouped" (with labelOrientation/labelAlign). */
  readonly labelLayout?: "spread" | "grouped";
  /** Stack direction of a grouped label group (orientation-dependent default). */
  readonly labelOrientation?: FunnelLabelOrientation;
  /** Position of the label group within the cell (start/center/end). */
  readonly labelAlign?: FunnelLabelAlign;
  readonly grid?:
    | boolean
    | {
        readonly bands?: boolean;
        readonly bandColor?: string;
        readonly lines?: boolean;
        readonly lineColor?: string;
        readonly lineOpacity?: number;
        readonly lineWidth?: number;
      };
}

const fmtPct = (pctValue: number): string => `${Math.round(pctValue)}%`;
const fmtVal = intFmt;

const useFunnelHoverCoordinator = (
  hoveredIndexProp: number | null | undefined,
  onHoverChange: ((index: number | null) => void) | undefined,
): FunnelHoverCoordinator => {
  // Controlled/uncontrolled hover split matches bklit FunnelChart.setHoveredIndex exactly.
  const isControlled = hoveredIndexProp !== undefined;
  const isControlledRef = useRef(isControlled);
  const onHoverChangeRef = useRef(onHoverChange);
  useEffect(() => {
    isControlledRef.current = isControlled;
    onHoverChangeRef.current = onHoverChange;
  }, [isControlled, onHoverChange]);

  // Created once via lazy state init (render-pure); the callbacks read latest props through refs.
  const [coordinator] = useState<FunnelHoverCoordinator>(() => createFunnelHoverCoordinator(
    (index) => onHoverChangeRef.current?.(index),
    () => isControlledRef.current,
  ));

  useEffect(() => {
    if (hoveredIndexProp !== undefined) {
      coordinator.setHovered(hoveredIndexProp);
    }
  }, [hoveredIndexProp, coordinator]);
  return coordinator;
};

interface FunnelLayoutOptions {
  readonly data: readonly FunnelStage[];
  readonly baseValue: number;
  readonly chartW: number;
  readonly chartH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly gridProp: FunnelChartProps["grid"];
}

interface FunnelChartFrame {
  readonly stageCount: number;
  readonly norms: readonly number[];
  readonly segW: number;
  readonly segH: number;
  readonly grid: ReturnType<typeof resolveFunnelGrid>;
  readonly hasChartArea: boolean;
  readonly showBandGrid: boolean;
  readonly showLineGrid: boolean;
  readonly isHorizontal: boolean;
  readonly aspectRatio: string;
}

const computeFunnelChartFrame = (options: Readonly<FunnelLayoutOptions>): FunnelChartFrame => {
  const { data, baseValue, chartW, chartH, gap, isHorizontal, gridProp } = options;
  const stageCount = data.length;
  const norms = data.map((stage) => stage.value / baseValue);
  const totalGap = gap * (stageCount - 1);
  const segW = (chartW - (isHorizontal ? totalGap : 0)) / stageCount;
  const segH = (chartH - (isHorizontal ? 0 : totalGap)) / stageCount;
  const grid = resolveFunnelGrid(gridProp);
  return {
    aspectRatio: isHorizontal ? "2.2 / 1" : "1 / 1.8",
    grid,
    hasChartArea: chartW > 0 && chartH > 0,
    isHorizontal,
    norms,
    segH,
    segW,
    showBandGrid: grid.enabled,
    showLineGrid: grid.enabled && grid.showGridLines,
    stageCount,
  };
};

interface BandGridOptions {
  readonly data: readonly FunnelStage[];
  readonly segW: number;
  readonly segH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly grid: ReturnType<typeof resolveFunnelGrid>;
  readonly chartW: number;
  readonly chartH: number;
}

const renderBandGrid = (options: Readonly<BandGridOptions>): ReactElement => {
  const { data, segW, segH, gap, isHorizontal, grid, chartW, chartH } = options;
  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      role="presentation"
      style={FUNNEL_GRID_SVG_STYLE}
      viewBox={`0 0 ${chartW} ${chartH}`}
    >
      {grid.showBands &&
        data.map((stage, stageIndex) => {
          if (stageIndex % 2 !== 0) {return false;}
          return isHorizontal ? (
            <rect fill={grid.bandColor} height={chartH} key={`band-${stage.label}`} width={segW} x={(segW + gap) * stageIndex} y={0} />
          ) : (
            <rect fill={grid.bandColor} height={segH} key={`band-${stage.label}`} width={chartW} x={0} y={(segH + gap) * stageIndex} />
          );
        })}
    </svg>
  );
};

interface LineGridOptions {
  readonly stageCount: number;
  readonly segW: number;
  readonly segH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly grid: ReturnType<typeof resolveFunnelGrid>;
  readonly chartW: number;
  readonly chartH: number;
}

const renderLineGrid = (options: Readonly<LineGridOptions>): ReactElement => {
  const { stageCount, segW, segH, gap, isHorizontal, grid, chartW, chartH } = options;
  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      role="presentation"
      style={FUNNEL_GRID_SVG_STYLE}
      viewBox={`0 0 ${chartW} ${chartH}`}
    >
      {Array.from({ length: stageCount - 1 }, (_unused, stageIndex) => {
        const gridIndex = stageIndex + 1;
        const gridKey = `grid-${gridIndex}`;
        if (isHorizontal) {
          const gridX = segW * gridIndex + gap * stageIndex + gap / 2;
          return (
            <line
              key={gridKey}
              stroke={grid.gridLineColor}
              strokeOpacity={grid.gridLineOpacity}
              strokeWidth={grid.gridLineWidth}
              x1={gridX}
              x2={gridX}
              y1={0}
              y2={chartH}
            />
          );
        }
        const gridY = segH * gridIndex + gap * stageIndex + gap / 2;
        return (
          <line
            key={gridKey}
            stroke={grid.gridLineColor}
            strokeOpacity={grid.gridLineOpacity}
            strokeWidth={grid.gridLineWidth}
            x1={0}
            x2={chartW}
            y1={gridY}
            y2={gridY}
          />
        );
      })}
    </svg>
  );
};

interface FunnelStageNodeOptions {
  readonly stage: FunnelStage;
  readonly index: number;
  readonly frame: Readonly<FunnelChartFrame>;
  readonly baseValue: number;
  readonly chartW: number;
  readonly chartH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly color: string;
  readonly layers: number;
  readonly staggerDelay: number;
  readonly enterTransition?: FunnelEnterTransition;
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly edges: "curved" | "straight";
  readonly coordinator: Readonly<FunnelHoverCoordinator>;
  readonly showValues: boolean;
  readonly showPercentage: boolean;
  readonly showLabels: boolean;
  readonly formatPercentage: (pctValue: number) => string;
  readonly formatValue: (stageValue: number) => string;
  readonly labelLayout: "spread" | "grouped";
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign: FunnelLabelAlign;
}

const renderFunnelStage = (options: Readonly<FunnelStageNodeOptions>): ReactElement => {
  const { stage, index, frame, baseValue, chartW, chartH, gap, isHorizontal, edges } = options;
  const normStart = frame.norms[index] ?? 0;
  const normEnd = frame.norms[Math.min(index + 1, frame.stageCount - 1)] ?? 0;
  const firstStop = stage.gradient?.[0];
  const segColor = firstStop ? firstStop.color : (stage.color ?? options.color);
  const box = funnelSegBox({ boxHeight: chartH, boxWidth: chartW, gap, horiz: isHorizontal, segH: frame.segH, segIndex: index, segW: frame.segW });
  const pct = (stage.value / baseValue) * FUNNEL_PERCENT_SCALE;
  return (
    <FunnelSegment
      box={box}
      color={segColor}
      coordinator={options.coordinator}
      crossDim={isHorizontal ? chartH : chartW}
      enterTransition={options.enterTransition}
      formatPercentage={options.formatPercentage}
      formatValue={options.formatValue}
      gradientStops={stage.gradient}
      index={index}
      isHorizontal={isHorizontal}
      key={stage.label}
      labelAlign={options.labelAlign}
      labelLayout={options.labelLayout}
      labelOrientation={options.labelOrientation}
      layers={options.layers}
      normEnd={normEnd}
      normStart={normStart}
      pct={pct}
      renderPattern={options.renderPattern}
      segDim={isHorizontal ? frame.segW : frame.segH}
      showLabels={options.showLabels}
      showPercentage={options.showPercentage}
      showValues={options.showValues}
      stage={stage}
      staggerDelay={options.staggerDelay}
      straight={edges === "straight"}
    />
  );
};

interface FunnelFrameInput {
  readonly data: readonly FunnelStage[];
  readonly chartW: number;
  readonly chartH: number;
  readonly gap: number;
  readonly gridProp: FunnelChartProps["grid"];
  readonly isHorizontal: boolean;
}

interface ResolvedFunnelFrame {
  readonly baseValue: number;
  readonly frame: FunnelChartFrame;
}

// Empty-data guard plus frame computation; undefined means the chart renders null.
// Percentage basis is data[0].value, not the series max (bklit parity).
const resolveFunnelChartFrame = (input: Readonly<FunnelFrameInput>): ResolvedFunnelFrame | undefined => {
  const { data, chartW, chartH, gap, gridProp, isHorizontal } = input;
  if (data.length === 0) {return undefined;}
  const first = data.at(0);
  if (first === undefined) {return undefined;}
  return { baseValue: first.value, frame: computeFunnelChartFrame({ baseValue: first.value, chartH, chartW, data, gap, gridProp, isHorizontal }) };
};

interface FunnelStagesOptions extends Omit<FunnelStageNodeOptions, "index" | "stage"> {
  readonly data: readonly FunnelStage[];
}

const renderFunnelStages = (options: Readonly<FunnelStagesOptions>): ReactNode => {
  const { data, ...stageOptions } = options;
  return data.map((stage, index) => renderFunnelStage({ ...stageOptions, index, stage }));
};

interface FunnelChartBodyOptions {
  readonly baseValue: number;
  readonly chartH: number;
  readonly chartW: number;
  readonly color: string;
  readonly coordinator: Readonly<FunnelHoverCoordinator>;
  readonly data: readonly FunnelStage[];
  readonly edges: "curved" | "straight";
  readonly enterTransition?: Readonly<FunnelEnterTransition>;
  readonly formatPercentage: (pctValue: number) => string;
  readonly formatValue: (stageValue: number) => string;
  readonly frame: Readonly<FunnelChartFrame>;
  readonly gap: number;
  readonly labelAlign: FunnelLabelAlign;
  readonly labelLayout: "spread" | "grouped";
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly layers: number;
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly showLabels: boolean;
  readonly showPercentage: boolean;
  readonly showValues: boolean;
  readonly staggerDelay: number;
}

// Chart-area content: band grid, stage segments, and line grid.
const renderFunnelChartBody = (options: Readonly<FunnelChartBodyOptions>): ReactElement => {
  const { baseValue, chartH, chartW, frame, gap } = options;
  return (
    <>
      {frame.showBandGrid && renderBandGrid({ chartH, chartW, data: options.data, gap, grid: frame.grid, isHorizontal: frame.isHorizontal, segH: frame.segH, segW: frame.segW })}
      {renderFunnelStages({ baseValue, chartH, chartW, color: options.color, coordinator: options.coordinator, data: options.data, edges: options.edges, enterTransition: options.enterTransition, formatPercentage: options.formatPercentage, formatValue: options.formatValue, frame, gap, isHorizontal: frame.isHorizontal, labelAlign: options.labelAlign, labelLayout: options.labelLayout, labelOrientation: options.labelOrientation, layers: options.layers, renderPattern: options.renderPattern, showLabels: options.showLabels, showPercentage: options.showPercentage, showValues: options.showValues, staggerDelay: options.staggerDelay })}
      {frame.showLineGrid && renderLineGrid({ chartH, chartW, gap, grid: frame.grid, isHorizontal: frame.isHorizontal, segH: frame.segH, segW: frame.segW, stageCount: frame.stageCount })}
    </>
  );
};

const FunnelChart = ({
  data,
  orientation = "horizontal",
  color = "var(--chart-1)",
  layers = FUNNEL_DEFAULT_LAYERS,
  className,
  style,
  showPercentage = true,
  showValues = true,
  showLabels = true,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  formatPercentage = fmtPct,
  formatValue = fmtVal,
  staggerDelay = FUNNEL_DEFAULT_STAGGER_DELAY_S,
  enterTransition,
  gap = FUNNEL_DEFAULT_GAP,
  renderPattern,
  edges = "curved",
  labelLayout = "spread",
  labelOrientation,
  labelAlign = "center",
  grid: gridProp = false,
}: Readonly<FunnelChartProps>): ReactElement | null => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sz = usePositiveChartSize(containerRef);
  const coordinator = useFunnelHoverCoordinator(hoveredIndexProp, onHoverChange);
  const resolved = resolveFunnelChartFrame({ chartH: sz.height, chartW: sz.width, data, gap, gridProp, isHorizontal: orientation === "horizontal" });
  if (resolved === undefined) {
    return null;
  }
  const { baseValue, frame } = resolved;

  return (
    <div
      className={className}
      data-bkm-chart="funnel"
      ref={containerRef}
      style={buildFunnelContainerStyle(frame.aspectRatio, style)}
    >
      {frame.hasChartArea && renderFunnelChartBody({ baseValue, chartH: sz.height, chartW: sz.width, color, coordinator, data, edges, enterTransition, formatPercentage, formatValue, frame, gap, labelAlign, labelLayout, labelOrientation, layers, renderPattern, showLabels, showPercentage, showValues, staggerDelay })}
    </div>
  );
};

export type { FunnelChartProps };
export type { FunnelGradientStop, FunnelLabelAlign, FunnelLabelOrientation, FunnelStage } from "./internal/funnel-segment";
export { FunnelChart };
export type { FunnelEnterTransition } from "./internal/enter-transition";
