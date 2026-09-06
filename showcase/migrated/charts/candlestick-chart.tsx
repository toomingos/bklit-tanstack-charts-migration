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
import type { CandlestickEnterTransition } from './internal/enter-transition';
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
import { EMPTY_CONTAINER_PX, EMPTY_COUNT, MIN_GEOMETRY_EXTENT_PX } from "./internal/candlestick-chart-shared";
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
  updateCandlePill,
  useCandleGeometry,
  useCandlePatterns,
  useCandlePillChrome,
  useCandleReveal,
  useCandleSelection,
} from "./internal/candlestick-chart-chrome";
import "./styles.css";

// Zero-size defs layers sit outside layout; the style never varies.
const HIDDEN_DEFS_SVG_STYLE = { position: "absolute" } as const;
// Pill host covers the plot without intercepting pointer events.
const PILL_OVERLAY_STYLE = { inset: 0, pointerEvents: "none", position: "absolute" } as const;
const DEFAULT_CANDLE_GAP_RATIO = 0.2;

interface CandlestickChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly margin?: Partial<ChartMargin>;
  readonly animationDuration?: number;
  readonly enterTransition?: CandlestickEnterTransition;
  /** Changing it re-arms the reveal (bklit [animationDuration, revealSignature] deps). */
  readonly revealSignature?: unknown;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly candleGap?: number;
  /** Explicit constant body width in px (overrides the computed width). */
  readonly candleWidth?: number;
  readonly children?: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}


/**
 * Renders one crosshair fade-gradient stop (keeps the layer tree shallow).
 *
 * @param {Readonly<{ offset: string; opacity: number }>} stop - Stop offset and opacity.
 * @param {string} color - Gradient color shared by every stop.
 * @returns {ReactElement} The gradient stop element.
 */
const renderCandleCrosshairStop = (stop: Readonly<{ offset: string; opacity: number }>, color: string): ReactElement => (
  <stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
);

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
  children,
  ariaLabel = "Candlestick chart",
  ariaDescription,
}: CandlestickChartProps): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Bklit parity: no decimation — every raw candle renders.
  const renderData = data;

  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { captureRenderContext, sceneRef, clientToScene } = useFocusInjection<ChartDatum, Date, number>();

  const { candlePatternDefsId, negativePattern, positivePattern, resolvedCandlestick, solidFillFor } = useCandlePatterns({ candlestick });

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
  });

  // Custom resolve() owns the slotWidth/2 range inset; a plain instance would lose it to re-ranging.
  const xScale = useMemo<ChartScale>(
    () => buildCandleXScale({ renderData, timeExtent, xAxis, xDataKey }),
    [renderData, xDataKey, timeExtent, xAxis],
  );

  const candlestickFocusStrategy = useMemo(
    () => createCandlestickFocusStrategy({ canInteractRef }),
    [canInteractRef],
  );

  const chartConfig = useChartConfig();
  const indicatorGradientId = useSanitizedId();

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

    const marks = buildCandleDefinitionMarks({ bodyWidthPx, candleMotion, discrete, fadedOpacity: resolvedCandlestick.fadedOpacity, indicatorGradientId, insideStrokeW: resolvedCandlestick.insideStrokeWidth, legendHoveredIndex, negativePattern, positivePattern, showHoverFade: resolvedCandlestick.showHoverFade, showTargetGeometry, solidFillFor, source: renderData, tooltip, tooltipSpring: chartConfig.tooltipSpring, xDataKey });
    const gridGuide = resolveGridGuide(grid);

    const tooltipOption = buildCandleTooltipOption({ discrete, tooltipEnabled });

    return defineChart({
      focus: candlestickFocusStrategy,
      focusRing: false,
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
    candlestickFocusStrategy,
    tooltip,
    chartConfig,
    indicatorGradientId,
    xAxis,
    yAxis,
    labelFade,
    showTargetGeometry,
    candleMotion,
  ]);

  const { chromeStateRef, dragSelectionActiveRef, overlayHostRef, pillRef, pillVisibleRef } = useCandlePillChrome({
    chartConfig,
    renderData,
    tooltip,
    tooltipEnabled,
    width,
    xDataKey,
  });


  const hidePill = useCallback(() => {
    pillVisibleRef.current = false;
    const pillBuild = pillRef.current;
    if (pillBuild) {
      pillBuild.layer.style.display = "none";
      pillBuild.spring.stop();
      pillBuild.label.textContent = "";
    }
    // Nullable labelFade state is read by buildFadeXAxisOptions; clearing it means null,
    // Returning prev when already cleared keeps React from scheduling a no-op render.
    setLabelFade((prev: Readonly<{ primaryX: number; hoveredLabel: string | null }> | null) => (prev === null ? prev : null));
  }, [pillRef, pillVisibleRef]);

  const handleFocusGroupChange = useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      if (dragSelectionActiveRef.current || points.length === EMPTY_COUNT) {
        hidePill();
        return;
      }
      const pillBuild = pillRef.current;
      const [primary] = points;
      updateCandlePill({ centerX: primary.x, dateLabels: chromeStateRef.current?.dateLabels, formattedDate: shortDateFmt.format(primary.xValue), pillBuild, pillVisibleRef, rowCount: renderData.length, showDatePill: tooltipEnabled && (tooltip?.showDatePill ?? true), tickerIndex: primary.datumIndex });
      // HoveredLabel uses the same formatter as the axis ticks or the fade text-match misses.
      const hoveredLabel = xAxis?.formatValue ? xAxis.formatValue(primary.xValue) : shortDateFmt.format(primary.xValue);
      updateCandleLabelFade({ centerX: primary.x, hoveredLabel, setLabelFade });
    },
    [chromeStateRef, dragSelectionActiveRef, hidePill, pillRef, pillVisibleRef, renderData.length, tooltipEnabled, tooltip, xAxis],
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
    clientToScene,
    containerRef,
    dragSelectionActiveRef,
    hidePill,
    innerWidth,
    marginLeft: margin.left,
    renderData,
    sceneRef,
    width,
    xDataKey,
  });

  // UserSpaceOnUse required: the crosshair is a zero-bbox line with nothing to map onto.
  const crosshairFadeGradient = useMemo(
    () => buildCandleCrosshairFadeGradient({ indicatorGradientId, tooltip, tooltipEnabled }),
    [tooltipEnabled, tooltip, indicatorGradientId],
  );
  const candlestickChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  // Hoisted out of the definition JSX below so no single expression stacks conditionals.
  const containerStyle = useMemo((): CSSProperties => ({
    aspectRatio,
    isolation: "isolate",
    position: "relative",
    width: "100%",
    ...style,
  }), [aspectRatio, style]);
  const positivePatternLayer = positivePattern.preset ? (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>{renderPatternPreset(positivePattern.preset, `${candlePatternDefsId}-candle-pattern-pos`, {})}</defs>
    </svg>
  ) : undefined;
  const negativePatternLayer = negativePattern.preset ? (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>{renderPatternPreset(negativePattern.preset, `${candlePatternDefsId}-candle-pattern-neg`, {})}</defs>
    </svg>
  ) : undefined;
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
  const pillOverlayLayer = tooltipEnabled ? (
    <div
      ref={overlayHostRef}
      style={PILL_OVERLAY_STYLE}
    />
  ) : undefined;

  // Hoisted so the returned tree stays shallow (variables inline into the same element tree).
  const definitionContentNode = definition ? (
    <>
      {positivePatternLayer}
      {negativePatternLayer}
      <ChartHost
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        aspectRatio={parseAspectRatio(aspectRatio)}
        className={className}
        definition={definition}
        initialWidth={HOST_INITIAL_WIDTH}
        renderer={candlestickChartRenderer}
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
        {pillOverlayLayer}
      </ChartHost>
    </>
  ) : undefined;
  const crosshairLayerNode = crosshairFadeGradient ? (
    <svg width={0} height={0} style={HIDDEN_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient
          id={crosshairFadeGradient.id}
          gradientUnits="userSpaceOnUse"
          x1={0}
          x2={0}
          y1={margin.top}
          y2={margin.top + Math.max(MIN_GEOMETRY_EXTENT_PX, heightPxCandle - margin.top - margin.bottom)}
        >
          {crosshairFadeGradient.stops.map((stop: { readonly offset: string; readonly opacity: number }) => renderCandleCrosshairStop(stop, crosshairFadeGradient.color))}
        </linearGradient>
      </defs>
    </svg>
  ) : undefined;

  return (
    <ChartSelectionContext.Provider value={candleSelection}>
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="candlestick"
    >
      {definitionContentNode}
      {crosshairLayerNode}
    </div>
    </ChartSelectionContext.Provider>
  );
};

export { CandlestickChart };
export type { CandlestickEnterTransition } from './internal/enter-transition';
export type { CandlestickChartProps };
