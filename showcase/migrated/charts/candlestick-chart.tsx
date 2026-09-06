// Bklit CandlestickChart on TanStack Charts. Custom wick/body marks over raw data; no status prop.
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { ChartHost, ChartRegistryBridge, HOST_INITIAL_WIDTH, adoptHostWidth, useRegistryEntriesState } from "./internal/chart-host";
import { defineChart } from "@tanstack/charts";
import type {
  ChartMotionContext,
  ChartMotionDefinition,
  ChartMotionTiming,
  ChartMotionTransition,
  ChartLinearGradient,
  ChartPoint,
  ChartRendererRenderContext,
  ChartScale,
  DomChartDefinition,
} from "@tanstack/charts";
import { extractChildren } from "./internal/children-extract";
import { TooltipContent } from "./internal/tooltip-components";
import { DISCRETE_INTERACTION_THRESHOLD } from "./internal/design-tokens";
import { buildFadeXAxisOptions } from "./internal/axis-ticks";
import { useChartRenderer } from "./internal/motion-renderer";
import type { CandlestickEnterTransition } from './internal/parity/animation';
import { resolveGridGuide } from "./internal/grid";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { ChartSelectionContext } from "./internal/chart-selection";
import { SegmentOverlay } from "./internal/segment-visuals";
import { useChartConfig } from "./internal/use-chart-config";
import { renderPatternPreset } from "./internal/pattern-preset-render";
import type { ChartDatum, TooltipRow } from "./internal/types";
import type { OHLCDataPoint } from "./internal/parity/candlestick";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { createCandlestickFocusStrategy } from "./internal/candlestick-focus-strategy";
import { CARTESIAN_MAX_FOCUS_DISTANCE_PX } from "./internal/cartesian-focus-distance";
import { useChartMargin, DEFAULT_CHART_MARGIN } from "./internal/use-chart-margin";
import type { ChartMargin } from "./internal/use-chart-margin";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import { useFocusInjection } from "./internal/focus-injection";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { DEFAULT_ANIMATION_DURATION_MS } from "./internal/animation-defaults";
import { EMPTY_CONTAINER_PX, EMPTY_COUNT } from "./internal/candlestick-chart-shared";
import {
  buildCandleCrosshairFadeGradient,
  buildCandleDefinitionMarks,
  resolveSpringCandleTransition,
  resolveTweenCandleTransition,
} from "./internal/candlestick-chart-marks";
import {
  buildCandleTooltipOption,
  buildCandleXScale,
  buildCandleYScale,
  findCandleTimeExtent,
  resolveCandleTargetGeometry,
} from "./internal/candlestick-chart-scales";
import {
  buildDefaultCandleCloseRow,
  resolveCandleTooltipModel,
  resolveCandleTooltipPanel,
  updateCandleLabelFade,
  useCandleChrome,
  useCandleGeometry,
  useCandlePatterns,
  useCandleReveal,
  useCandleSelection,
} from "./internal/candlestick-chart-chrome";
import "./styles.css";

// Crosshair fade-gradient bare id; the mount idPrefix scopes it per instance.
const CANDLE_CROSSHAIR_GRADIENT_ID = "candle-crosshair";
// Percent-stop scale for the spec-gradient offset mapping below.
const STOP_PERCENT_SCALE = 100;
const DEFAULT_CANDLE_GAP_RATIO = 0.2;

interface CandlestickChartProps {
  readonly data: OHLCDataPoint[];
  readonly xDataKey?: string;
  readonly margin?: Partial<ChartMargin>;
  readonly animationDuration?: number;
  readonly enterTransition?: CandlestickEnterTransition;
  /** Changing it re-arms the reveal (bklit [animationDuration, revealSignature] deps). */
  readonly revealSignature?: string;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly candleGap?: number;
  /** Explicit constant body width in px (overrides the computed width). */
  readonly candleWidth?: number;
  /** When set, xScale uses this domain instead of deriving from data. Use with brush so main chart and strip share the same scale. */
  readonly xDomain?: [Date, Date];
  /** When xDomain is set, use this as the number of slots for scale padding (e.g. full data length). */
  readonly xDomainSlotCount?: number;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}


/**
 * Parses a "NN%" gradient stop offset into the 0..1 ratio the spec gradient field wants.
 *
 * @param {string} offset - Percent stop offset from the fade-stop builders.
 * @returns {number} The clamped 0..1 ratio (0 when the offset never parses).
 */
const percentOffsetToRatio = (offset: string): number => {
  const match = /^([0-9.]+)%$/u.exec(offset.trim());
  if (!match) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(match[1]) / STOP_PERCENT_SCALE));
};

const CandlestickChart = ({
  data,
  xDataKey = "date",
  margin: marginProp,
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature,
  aspectRatio = "2 / 1",
  className,
  style,
  candleGap = DEFAULT_CANDLE_GAP_RATIO,
  candleWidth: candleWidthProp,
  xDomain,
  xDomainSlotCount,
  children,
  ariaLabel = "Candlestick chart",
  ariaDescription,
}: CandlestickChartProps): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // One prefix per mount scopes renderer ids and seam ids alike.
  const idPrefix = useSanitizedId();
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const width = liveWidth;

  // Registry union (V1.3 carriers): entries report up from inside the host.
  const [registryEntries, handleRegistryEntries] = useRegistryEntriesState();
  const { candlestick, grid, xAxis, yAxis, background, tooltip } = useMemo(
    () => extractChildren(children, registryEntries),
    [children, registryEntries],
  );
  const tooltipEnabled = tooltip?.enabled ?? false;

  // SAFETY: legacy-verbatim OHLC bridge; rows read-only downstream.
  // eslint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion -- see SAFETY above
  const renderData = data as unknown as ChartDatum[];

  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { captureRenderContext, sceneRef, clientToScene } = useFocusInjection<ChartDatum, Date, number>();

  const { negativePattern, positivePattern, resolvedCandlestick, solidFillFor } = useCandlePatterns({ candlestick, defsId: idPrefix });

  const { canInteractRef, revealed, revealSettledRef } = useCandleReveal({
    animate: resolvedCandlestick.animate,
    animationDuration,
    enterTransition,
    revealSignature,
  });

  const { bodyWidthPx, innerWidth, timeExtent, yDomain } = useCandleGeometry({
    candleGap,
    candleWidthProp,
    margin,
    renderData,
    width,
    xDataKey,
    xDomain,
    xDomainSlotCount,
  });

  // Custom resolve() owns the slotWidth/2 range inset; a plain instance would lose it to re-ranging.
  const xScale = useMemo<ChartScale>(
    () => buildCandleXScale({ renderData, timeExtent, xAxis, xDataKey, xDomain, xDomainSlotCount }),
    [renderData, xDataKey, timeExtent, xAxis, xDomain, xDomainSlotCount],
  );

  const candlestickFocusStrategy = useMemo(
    () => createCandlestickFocusStrategy({ canInteractRef }),
    [canInteractRef],
  );

  const chartConfig = useChartConfig();

  // Bbox vertical fade reproduces the retired userSpaceOnUse crosshair gradient pixel-for-pixel.
  const candleSpecGradients = useMemo<readonly ChartLinearGradient[]>(() => {
    const fade = buildCandleCrosshairFadeGradient({ indicatorGradientId: CANDLE_CROSSHAIR_GRADIENT_ID, tooltip, tooltipEnabled });
    if (!fade) {
      return [];
    }
    return [
      {
        id: fade.id,
        stops: fade.stops.map((stop) => ({
          color: fade.color,
          offset: percentOffsetToRatio(stop.offset),
          opacity: stop.opacity,
        })),
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 1,
      },
    ];
  }, [tooltip, tooltipEnabled]);

  const [labelFade, setLabelFade] = useState<{ primaryX: number; hoveredLabel: string | null } | null>(null);

  const showTargetGeometry = resolveCandleTargetGeometry(revealed, animationDuration, resolvedCandlestick.animate);

  // Update-phase delay is zeroed for springs by the engine, so per-candle stagger is dropped (lockstep).
  const candleMotion = useMemo<ChartMotionDefinition<ChartDatum>>(() => {
    const transition: ChartMotionTransition = enterTransition?.type === "tween"
      ? resolveTweenCandleTransition(enterTransition)
      : resolveSpringCandleTransition(enterTransition);
    // After the reveal settles, later rebuilds must snap or the motion surface re-tweens dim opacity.
    return (ctx: Readonly<ChartMotionContext<ChartDatum>>): false | ChartMotionTiming | undefined => ctx.phase === "enter" || revealSettledRef.current ? false : { transition };
  }, [enterTransition, revealSettledRef]);

  const definition = useMemo((): DomChartDefinition<ChartDatum, Date, number> | undefined => {
    if (width <= EMPTY_CONTAINER_PX) {return undefined;}

    const discrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

    const [yDomainMin, yDomainMax] = yDomain;
    const yScale = buildCandleYScale({ formatLargeNumbers: yAxis?.formatLargeNumbers, formatValue: yAxis?.formatValue, gridNumTicks: grid?.numTicks, hasYAxis: yAxis !== null, yMax: yDomainMax, yMin: yDomainMin, yNumTicks: yAxis?.numTicks });

    const marks = buildCandleDefinitionMarks({ bodyWidthPx, candleMotion, discrete, fadedOpacity: resolvedCandlestick.fadedOpacity, indicatorGradientId: CANDLE_CROSSHAIR_GRADIENT_ID, insideStrokeW: resolvedCandlestick.insideStrokeWidth, legendHoveredIndex, negativePattern, positivePattern, showHoverFade: resolvedCandlestick.showHoverFade, showTargetGeometry, solidFillFor, source: renderData, tooltip, tooltipSpring: chartConfig.tooltipSpring, xDataKey });
    const gridGuide = resolveGridGuide(grid);

    const tooltipOption = buildCandleTooltipOption({ discrete, tooltipEnabled });

    return defineChart({
      focus: candlestickFocusStrategy,
      focusRing: false,
      gradients: candleSpecGradients,
      margin,
      marks,
      maxFocusDistance: CARTESIAN_MAX_FOCUS_DISTANCE_PX,
      // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
      scales: {
        x: {
          axis: buildFadeXAxisOptions({
            columnTicks: gridGuide.columnTicks,
            labelFade,
            marginBottom: margin.bottom,
            xAxis: xAxis ?? undefined,
          }),
          grid: gridGuide.vertical,
          scale: xScale,
        },
        y: {
          axis: {
            line: false,
            tickLabels: yAxis ? { dx: -8, fontSize: 12, opacity: 1, thin: false } : false,
            ticks: { count: gridGuide.ticks, padding: 0, size: 0 },
          },
          grid: gridGuide.horizontal,
          scale: yScale,
        },
      },
      // Candle data updates snap, never tween (tween-on-update is Line-only).
      svgAnimation: false,
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: tooltipOption,
    });
  }, [
    renderData,
    xDataKey,
    xScale,
    yDomain,
    bodyWidthPx,
    positivePattern,
    negativePattern,
    solidFillFor,
    resolvedCandlestick.insideStrokeWidth,
    tooltipEnabled,
    resolvedCandlestick.fadedOpacity,
    resolvedCandlestick.showHoverFade,
    legendHoveredIndex,
    grid,
    width,
    margin,
    candleSpecGradients,
    candlestickFocusStrategy,
    tooltip,
    chartConfig,
    xAxis,
    yAxis,
    labelFade,
    showTargetGeometry,
    candleMotion,
  ]);

  const { chromeStateRef, dragSelectionActiveRef } = useCandleChrome({ tooltip });


  const clearLabelFade = useCallback(() => {
    // Nullable labelFade state is read by buildFadeXAxisOptions; clearing it means null,
    // Returning prev when already cleared keeps React from scheduling a no-op render.
    setLabelFade((prev: Readonly<{ primaryX: number; hoveredLabel: string | null }> | null) => (prev === null ? prev : null));
  }, []);

  const handleFocusGroupChange = useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      if (dragSelectionActiveRef.current || points.length === EMPTY_COUNT) {
        clearLabelFade();
        return;
      }
      const [primary] = points;
      // HoveredLabel uses the same formatter as the axis ticks or the fade text-match misses.
      const hoveredLabel = xAxis?.formatValue ? xAxis.formatValue(primary.xValue) : shortDateFmt.format(primary.xValue);
      updateCandleLabelFade({ centerX: primary.x, hoveredLabel, setLabelFade });
    },
    [dragSelectionActiveRef, clearLabelFade, xAxis],
  );

  const renderTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): ReactNode => {
      const model = resolveCandleTooltipModel(ctx, chromeStateRef.current);
      if (model === undefined) {return undefined;}
      const { tt, date, close, pointRec } = model;
      const rows: TooltipRow[] = tt?.rows ? tt.rows(pointRec) : buildDefaultCandleCloseRow(close);
      const panel = resolveCandleTooltipPanel(tt);
      if (tt?.content) {
        return (
          <div className={panel.className} style={panel.style}>
            {tt.content({ index: 0, point: pointRec })}
          </div>
        );
      }
      const title = weekdayDateFmt.format(date);
      return (
        <div className={panel.className} style={panel.style}>
          <TooltipContent title={title} rows={rows}>
            {tt?.children}
          </TooltipContent>
        </div>
      );
    },
    [chromeStateRef],
  );

  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    captureRenderContext(context);
    adoptHostWidth(setLiveWidth, context.scene.width);
  }, [captureRenderContext]);

  const { candleSelection, heightPxCandle, segChildrenCandle } = useCandleSelection({
    aspectRatio,
    children,
    clearLabelFade,
    clientToScene,
    containerRef,
    dragSelectionActiveRef,
    innerWidth,
    marginLeft: margin.left,
    renderData,
    sceneRef,
    width,
    xDataKey,
  });

  const candlestickChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  // Hoisted out of the definition JSX below so no single expression stacks conditionals.
  const containerStyle = useMemo((): CSSProperties => ({
    aspectRatio,
    isolation: "isolate",
    position: "relative",
    width: "100%",
    ...style,
  }), [aspectRatio, style]);
  // Seam resources carry the mount prefix; marks reference them as url(#id).
  const candleSeamResources = (
    <>
      {positivePattern.preset ? renderPatternPreset(positivePattern.preset, `${idPrefix}-candle-pattern-pos`, {}) : undefined}
      {negativePattern.preset ? renderPatternPreset(negativePattern.preset, `${idPrefix}-candle-pattern-neg`, {}) : undefined}
    </>
  );
  const enabledRenderTooltipBody = tooltipEnabled ? renderTooltipBody : undefined;
  const refAreaChildrenCandle = useMemo(() => extractReferenceAreaProps(children), [children]);
  const timeExtentCandle = useMemo(() => findCandleTimeExtent(renderData, xDataKey), [renderData, xDataKey]);
  const referenceAreaGeomCandle = useMemo((): ReferenceAreaLayersGeom => ({
    xDomain: timeExtentCandle ? [new Date(timeExtentCandle.minTime), new Date(timeExtentCandle.maxTime)] : undefined,
    yDomain,
  }), [timeExtentCandle, yDomain]);
  const referenceAreaLayer = heightPxCandle > EMPTY_CONTAINER_PX ? (
    <ReferenceAreaLayers
      configs={refAreaChildrenCandle}
      geom={referenceAreaGeomCandle}
    />
  ) : undefined;

  // Hoisted so the returned tree stays shallow (variables inline into the same element tree).
  const definitionContentNode = definition ? (
    <ChartHost
      ariaLabel={ariaLabel}
      ariaDescription={ariaDescription}
      aspectRatio={parseAspectRatio(aspectRatio)}
      className={className}
      definition={definition}
      height={heightPxCandle > EMPTY_CONTAINER_PX ? heightPxCandle : undefined}
      idPrefix={idPrefix}
      initialWidth={HOST_INITIAL_WIDTH}
      renderer={candlestickChartRenderer}
      resources={candleSeamResources}
      onFocusGroupChange={handleFocusGroupChange}
      onRender={handleRender}
      renderTooltipBody={enabledRenderTooltipBody}
      style={style}
    >
      {children}
      <ChartRegistryBridge onEntries={handleRegistryEntries} />
      {background ? (
        <BackgroundLayer
          config={background}
        />
      ) : undefined}
      {referenceAreaLayer}
      <SegmentOverlay
        selection={candleSelection}
        components={segChildrenCandle}
      />
    </ChartHost>
  ) : undefined;

  return (
    <ChartSelectionContext.Provider value={candleSelection}>
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="candlestick"
      data-slot="chart"
    >
      {definitionContentNode}
    </div>
    </ChartSelectionContext.Provider>
  );
};

CandlestickChart.displayName = "CandlestickChart";
export { CandlestickChart };
export type { CandlestickEnterTransition } from './internal/parity/animation';
export type { CandlestickChartProps };
