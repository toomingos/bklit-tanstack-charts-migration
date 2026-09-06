// Bklit FunnelChart on TanStack marks (no TanStack funnel primitive; geometry is pure pixel arithmetic).
// One createMark per orientation owns the stage areas; labels stay HTML overlays keyed by stage.label.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { defineChart } from "@tanstack/charts/scene";
import type { ChartLinearGradient, ChartPoint, ChartRendererRenderContext, DomChartDefinition } from "@tanstack/charts";
import { intFmt } from "./internal/formatters";
import { usePositiveChartSize } from "./internal/use-container-size";
import { ChartHost, HOST_INITIAL_WIDTH } from "./internal/chart-host";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { useFocusInjection } from "./internal/focus-injection";
import type { ChartFocusInjectionSource } from "./internal/focus-injection";
import { createHoverSource } from "./internal/hover-motion";
import type { HoverSource } from "./internal/hover-motion";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { withStates } from "./internal/with-states";
import { funnelSegBox, resolveFunnelGrid } from './internal/funnel-geometry';
import type { FunnelSegBox } from './internal/funnel-geometry';
import {
  buildFunnelStageRows,
  createFunnelStageMark,
  funnelDimStates,
  funnelGradientId,
  funnelPatternId,
} from "./internal/funnel-mark";
import type { FunnelEnterTransition, FunnelStageRow } from "./internal/funnel-mark";
import { FunnelStageLabel } from './internal/funnel-segment';
import type { FunnelLabelAlign, FunnelLabelOrientation, FunnelStage } from './internal/funnel-segment';
import "./styles.css";

// Default ring-layer count when the layers prop is omitted (bklit parity).
const FUNNEL_DEFAULT_LAYERS = 3;
// Default reveal stagger between stages in seconds (bklit parity).
const FUNNEL_DEFAULT_STAGGER_DELAY_S = 0.12;
// Default gap between stages in pixels (bklit parity).
const FUNNEL_DEFAULT_GAP = 4;
// SSR fallback height ratios (match the frame aspect ratios: horizontal 2.2/1, vertical 1/1.8).
const FUNNEL_SSR_HORIZONTAL_WIDTH_DIVISOR = 2.2;
const FUNNEL_SSR_VERTICAL_HEIGHT_FACTOR = 1.8;
// Fraction-to-percent scale for stage share labels.
const FUNNEL_PERCENT_SCALE = 100;
// Seconds-to-milliseconds scale for the mark enter stagger (staggerDelay is in seconds).
const MS_PER_SECOND = 1000;

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
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const fmtPct = (pctValue: number): string => `${Math.round(pctValue)}%`;
const fmtVal = intFmt;

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

interface BuildFunnelDefinitionOptions {
  readonly rows: readonly FunnelStageRow[];
  readonly gradients: readonly ChartLinearGradient[];
  readonly isHorizontal: boolean;
  readonly enterTransition: FunnelEnterTransition | undefined;
  readonly staggerDelayMs: number;
}

// Hover scale-up re-emits geometry (the definition rebuilds on hoveredIndex).
// Dim rides focus states over the base fill colours.
const buildFunnelDefinition = (options: Readonly<BuildFunnelDefinitionOptions>): DomChartDefinition<FunnelStageRow, number, number> => {
  const { rows, gradients, isHorizontal, enterTransition, staggerDelayMs } = options;
  const stageMark = createFunnelStageMark(rows, { enterTransition, isHorizontal, staggerDelayMs });
  return defineChart({
    focusRing: false,
    gradients,
    guides: false,
    marks: [withStates(stageMark, rows, funnelDimStates())],
    scales: { x: null, y: null },
    tooltip: false,
  });
};

const isNumber = <Subject,>(value: Subject): value is Subject & number => typeof value === "number";

// Spec gradients want 0..1 ratios; stage stops carry ratios or "NN%" strings.
const funnelStopOffsetToRatio = (offset: string | number): number => {
  if (isNumber(offset)) {
    return Math.max(0, Math.min(1, offset));
  }
  const match = /^([0-9.]+)%$/u.exec(offset.trim());
  if (!match) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(match[1]) / FUNNEL_PERCENT_SCALE));
};

interface FunnelSpecGradientOptions {
  readonly data: readonly FunnelStage[];
  readonly isHorizontal: boolean;
}

// Bbox gradients reproduce the retired island pixel-for-pixel (whole-mark horizontal/vertical fades).
const buildFunnelSpecGradients = (options: Readonly<FunnelSpecGradientOptions>): ChartLinearGradient[] =>
  options.data.flatMap((stage, index) => {
    if (stage.gradient === undefined) {
      return [];
    }
    return [
      {
        id: funnelGradientId(options.isHorizontal, index),
        stops: stage.gradient.map((stop) => ({
          color: stop.color,
          offset: funnelStopOffsetToRatio(stop.offset),
        })),
        x1: 0,
        x2: options.isHorizontal ? 1 : 0,
        y1: 0,
        y2: options.isHorizontal ? 0 : 1,
      },
    ];
  });

type FunnelFocusPoint = (
  predicate: (point: ChartPoint<FunnelStageRow, number, number>) => boolean,
  source?: ChartFocusInjectionSource,
) => void;

interface FunnelStageCellProps {
  readonly box: Readonly<FunnelSegBox>;
  readonly stage: Readonly<FunnelStage>;
  readonly index: number;
  readonly pct: number;
  readonly showValues: boolean;
  readonly showPercentage: boolean;
  readonly showLabels: boolean;
  readonly formatPercentage: (pctValue: number) => string;
  readonly formatValue: (stageValue: number) => string;
  readonly labelLayout: "spread" | "grouped";
  readonly isHorizontal: boolean;
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign: FunnelLabelAlign;
  readonly dimmed: boolean;
  readonly focusPoint: FunnelFocusPoint;
  readonly clearFocus: (source?: ChartFocusInjectionSource) => void;
}

// One label overlay per stage; pointer lands here (over the package surface).
// Bridges into package focus, which paints the mark states and the scale-up re-emit.
const FunnelStageCell = (props: Readonly<FunnelStageCellProps>): ReactElement => {
  const { box, stage, index, pct, showValues, showPercentage, showLabels, formatPercentage, formatValue, labelLayout, isHorizontal, labelOrientation, labelAlign, dimmed, focusPoint, clearFocus } = props;
  const handlePointerEnter = useCallback(() => {
    focusPoint((point) => point.datum.stageIndex === index, "pointer");
  }, [focusPoint, index]);
  const handlePointerLeave = useCallback(() => {
    clearFocus("pointer");
  }, [clearFocus]);
  return (
    <FunnelStageLabel
      box={box}
      dimmed={dimmed}
      formatPercentage={formatPercentage}
      formatValue={formatValue}
      isHorizontal={isHorizontal}
      labelAlign={labelAlign}
      labelLayout={labelLayout}
      labelOrientation={labelOrientation}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      pct={pct}
      showLabels={showLabels}
      showPercentage={showPercentage}
      showValues={showValues}
      stage={stage}
    />
  );
};

interface FunnelChartScene {
  readonly baseValue: number;
  readonly frame: FunnelChartFrame;
  readonly definition: DomChartDefinition<FunnelStageRow, number, number>;
}

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
  ariaLabel = "Funnel chart",
  ariaDescription,
}: Readonly<FunnelChartProps>): ReactElement | null => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sz = usePositiveChartSize(containerRef);
  const isHorizontal = orientation === "horizontal";
  const ssrHeightPerWidth = isHorizontal
    ? 1 / FUNNEL_SSR_HORIZONTAL_WIDTH_DIVISOR
    : FUNNEL_SSR_VERTICAL_HEIGHT_FACTOR;
  const chartW = sz.width > 0 ? sz.width : HOST_INITIAL_WIDTH;
  const chartH = sz.height > 0 ? sz.height : HOST_INITIAL_WIDTH * ssrHeightPerWidth;

  // Package-owned hover: host focus lands in the source below; labels subscribe to it.
  const [hoverSource] = useState<HoverSource>(() => createHoverSource());
  // One prefix per mount scopes renderer ids and seam ids alike.
  const idPrefix = useSanitizedId();
  const { captureRenderContext, clearFocus, focusPoint } = useFocusInjection<FunnelStageRow, number, number>();
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const hoveredIndex = hoveredIndexProp ?? internalHoveredIndex;
  const [labelHoveredIndex, setLabelHoveredIndex] = useState<number | null>(null);
  useEffect(() => hoverSource.subscribe(() => {
    setLabelHoveredIndex(hoverSource.getHovered());
  }), [hoverSource]);

  // Controlled hover paints through package focus, never a definition rebuild on its own.
  useEffect(() => {
    if (hoveredIndexProp === undefined) {return;}
    if (hoveredIndexProp === null) { clearFocus(); return; }
    const target = hoveredIndexProp;
    focusPoint((point) => point.datum.stageIndex === target);
  }, [clearFocus, focusPoint, hoveredIndexProp]);

  const handleHostRender = useCallback((context: Readonly<ChartRendererRenderContext<FunnelStageRow, number, number>>): void => {
    captureRenderContext(context);
  }, [captureRenderContext]);

  const handleFocusChange = useCallback((point: ChartPoint<FunnelStageRow, number, number> | null): void => {
    const next = point === null ? null : point.datum.stageIndex;
    hoverSource.setHovered(next);
    if (hoveredIndexProp !== undefined) {
      onHoverChange?.(next);
      return;
    }
    setInternalHoveredIndex(next);
  }, [hoverSource, hoveredIndexProp, onHoverChange]);

  const scene = useMemo((): FunnelChartScene | undefined => {
    const resolved = resolveFunnelChartFrame({ chartH, chartW, data, gap, gridProp, isHorizontal });
    if (resolved === undefined) {return undefined;}
    const rows = buildFunnelStageRows({
      baseColor: color,
      chartH,
      chartW,
      data,
      gap,
      hasPattern: renderPattern !== undefined,
      hoveredIndex,
      idPrefix,
      isHorizontal,
      layers,
      norms: resolved.frame.norms,
      segH: resolved.frame.segH,
      segW: resolved.frame.segW,
      straight: edges === "straight",
    });
    return {
      baseValue: resolved.baseValue,
      definition: buildFunnelDefinition({ enterTransition, gradients: buildFunnelSpecGradients({ data, isHorizontal }), isHorizontal, rows, staggerDelayMs: staggerDelay * MS_PER_SECOND }),
      frame: resolved.frame,
    };
  }, [chartH, chartW, color, data, edges, enterTransition, gap, gridProp, hoveredIndex, idPrefix, isHorizontal, layers, renderPattern, staggerDelay]);
  if (scene === undefined) {
    return null;
  }
  const { baseValue, frame } = scene;
  // Seam resources carry the mount prefix; marks reference them as url(#id).
  const funnelSeamResources = renderPattern ? (
    <>
      {data.map((stage, index) => {
        const firstStop = stage.gradient?.[0];
        const segColor = firstStop ? firstStop.color : (stage.color ?? color);
        const patternId = funnelPatternId(idPrefix, frame.isHorizontal, index);
        return <Fragment key={patternId}>{renderPattern(patternId, segColor)}</Fragment>;
      })}
    </>
  ) : undefined;

  return (
    <div
      className={className}
      data-bkm-chart="funnel"
      ref={containerRef}
      style={buildFunnelContainerStyle(frame.aspectRatio, style)}
    >
      {frame.hasChartArea && (
        <>
          {frame.showBandGrid && renderBandGrid({ chartH, chartW, data, gap, grid: frame.grid, isHorizontal: frame.isHorizontal, segH: frame.segH, segW: frame.segW })}
          <ChartHost
            ariaLabel={ariaLabel}
            ariaDescription={ariaDescription}
            width={chartW}
            height={chartH}
            idPrefix={idPrefix}
            initialWidth={chartW}
            definition={scene.definition}
            renderer={chartMotionRenderer<FunnelStageRow, number, number>()}
            resources={funnelSeamResources}
            onRender={handleHostRender}
            onFocusChange={handleFocusChange}
          />
          {frame.showLineGrid && renderLineGrid({ chartH, chartW, gap, grid: frame.grid, isHorizontal: frame.isHorizontal, segH: frame.segH, segW: frame.segW, stageCount: frame.stageCount })}
          {data.map((stage, index) => {
            const box = funnelSegBox({ boxHeight: chartH, boxWidth: chartW, gap, horiz: isHorizontal, segH: frame.segH, segIndex: index, segW: frame.segW });
            const pct = (stage.value / baseValue) * FUNNEL_PERCENT_SCALE;
            return (
              <FunnelStageCell
                box={box}
                dimmed={labelHoveredIndex !== null && labelHoveredIndex !== index}
                focusPoint={focusPoint}
                clearFocus={clearFocus}
                formatPercentage={formatPercentage}
                formatValue={formatValue}
                index={index}
                isHorizontal={frame.isHorizontal}
                key={stage.label}
                labelAlign={labelAlign}
                labelLayout={labelLayout}
                labelOrientation={labelOrientation}
                pct={pct}
                showLabels={showLabels}
                showPercentage={showPercentage}
                showValues={showValues}
                stage={stage}
              />
            );
          })}
        </>
      )}
    </div>
  );
};

export type { FunnelChartProps };
export type { FunnelGradientStop, FunnelLabelAlign, FunnelLabelOrientation, FunnelStage } from "./internal/funnel-segment";
export { FunnelChart, buildFunnelDefinition };
export type { FunnelEnterTransition } from "./internal/funnel-mark";
