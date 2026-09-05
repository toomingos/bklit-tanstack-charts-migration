// Bklit LineChart, same API, on TanStack Charts; children compile to one defineChart spec.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useEffectEvent } from "./internal/use-effect-event";
import type { ScaleTime } from "d3-scale";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { ChartHost, HOST_INITIAL_WIDTH, adoptHostWidth } from "./internal/chart-host";
import { useChartRenderer } from "./internal/motion-renderer";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { extractChildren } from "./internal/children-extract";
import { useFocusInjection } from "./internal/focus-injection";
import {
  ChartSelectionContext,
} from "./internal/chart-selection";
import {
  extractProjectionLineConfigs,
} from "./internal/projection-config";
import type { ProjectionPhaseHandle } from './internal/terminal-marker';
import { extractProfitLossHoveredIndex } from "./internal/profit-loss-config";
import {
  DISCRETE_INTERACTION_THRESHOLD,
} from "./internal/design-tokens";
import { weekdayDateFmt } from "./internal/formatters";
import { renderSeriesTooltipBody } from "./internal/native-tooltip";
import type { ChartDatum, ChartStatus } from "./internal/types";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from './internal/chart-phase';
import type { ChartPhase } from './internal/chart-phase';
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import { useChartMargin, DEFAULT_CHART_MARGIN } from "./internal/use-chart-margin";
import type { ChartMargin } from "./internal/use-chart-margin";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useChartPhaseOrchestrator } from "./internal/use-chart-phase-orchestrator";
import { clipRevealTiming } from './internal/enter-transition';
import type { EnterTransition } from './internal/enter-transition';
import type { LabelFadeState } from "./internal/line-x-scale";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import {
  DEFAULT_LINE_STROKE,
  DEFAULT_LINE_STROKE_WIDTH,
  findPointColorForSeries,
  firstNonEmptyString,
  isNumber,
  isString,
  renderLoadingSkeleton,
  resolveChartHeightPx,
  resolveEffectiveYDomainTweenBase,
  stringifyDatumValue,
} from "./internal/line-chart-support";
import { useLineMarkerGradients } from "./internal/use-line-marker-gradients";
import { useLineBrushControls } from "./internal/use-line-brush-controls";
import { useLineYDomains } from "./internal/use-line-y-domains";
import { useLineChartSpec } from "./internal/use-line-chart-spec";
import { useLineFocusChrome } from "./internal/use-line-focus-chrome";
import { useLineReveal } from "./internal/use-line-reveal";
import { useLineOverlays } from "./internal/use-line-overlays";
import "./styles.css";

export interface LineChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly status?: ChartStatus;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  readonly children?: ReactNode;
  readonly loadingLabel?: string;
  readonly style?: CSSProperties;
  readonly animationEasing?: string;
  readonly yDomainTween?: boolean;
  readonly yDomainTweenDuration?: number;
  readonly xDomain?: [Date, Date];
  /** Accepted but inert (no columnWidth consumer here); kept for bklit API parity. */
  readonly xDomainSlotCount?: number;
  readonly tweenYDomainOnXDomainChange?: boolean;
  /** Overrides the clip-reveal timing; springs coerce to tweens (bklit animation.ts:18). */
  readonly enterTransition?: EnterTransition;
  /** Replay epoch input: changing it replays the mount reveal without a data change. */
  readonly revealSignature?: string;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

export const LineChart = ({
  data,
  xDataKey = "date",
  status = "ready",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  children,
  loadingLabel,
  style,
  animationEasing = DEFAULT_ANIMATION_EASING,
  yDomainTween = true,
  yDomainTweenDuration: _yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount: _xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  enterTransition,
  revealSignature = "",
  ariaLabel = "Line chart",
  ariaDescription,
}: Readonly<LineChartProps>): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const width = liveWidth;
  const measuredHeight = 0;
  const heightPx = resolveChartHeightPx(width, measuredHeight, aspectRatio);
  const xScaleD3Ref = useRef<ScaleTime<number, number> | null>(null);
  const onPhaseChangeEvent = useEffectEvent((phase: ChartPhase): void => {
    onPhaseChange?.(phase);
  });
  const projectionPhasePortRef = useRef<ProjectionPhaseHandle | null>(null);

  const effectiveYDomainTweenDuration = useMemo(() => {
    const base = resolveEffectiveYDomainTweenBase(yDomainTween);
    if (!tweenYDomainOnXDomainChange || !xDomain) {return base;}
    return base || DEFAULT_Y_DOMAIN_TWEEN_MS;
  }, [yDomainTween, tweenYDomainOnXDomainChange, xDomain]);
  const {
    chartPhase,
    isLoaded: orchIsLoaded,
    revealEpoch,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    animationDuration,
    chartStatus: status,
    revealSignature,
    skeletonData: [],
    targetData: data,
    yDomainTweenDuration: effectiveYDomainTweenDuration,
  });

  // Primitive deps: enterTransition is usually an inline object literal.
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    [enterTransition, animationDuration, animationEasing],
  );

  const isLoaded = orchIsLoaded;

  useEffect(() => { onPhaseChangeEvent(chartPhase); }, [chartPhase]);

  useEffect(() => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  }, [chartPhase]);

  useEffect(() => {
    if (chartPhase === "gridTweenReady" || chartPhase === "gridTweenLoading") {
      notifyYDomainTweenComplete();
    }
  }, [chartPhase, notifyYDomainTweenComplete]);

  const { lines, grid, xAxis, yAxis, background, tooltip, projectionLines, projectionEndMarkers, terminalMarkers, profitLossLines, chartMarkers, brushes } = useMemo(
    () => extractChildren(children),
    [children],
  );

  const tooltipEnabled = tooltip?.enabled ?? false;
  const projectionConfigs = useMemo(() => extractProjectionLineConfigs(children), [children]);
  const projectionGradientBaseId = useSanitizedId();
  const profitLossHoveredIndex = extractProfitLossHoveredIndex(children);
  const hoveredIndexForPL = profitLossHoveredIndex;
  const [plTooltipSignIndex, setPlTooltipSignIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [labelFade, setLabelFade] = useState<LabelFadeState>();
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { captureRenderContext, sceneRef, interactionRef, clientToScene } =
    useFocusInjection<ChartDatum, Date, number>();

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const renderData = useMemo(() => {
    if (innerWidth <= 0) {return data;}
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      lines.map((line) => line.dataKey),
    );
  }, [data, innerWidth, lines]);
  // Dense data snaps instead of springing (bklit pointCount gate).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

  const { crosshairGradientId, markerGradientDefs, markerGradientIdByKey, markerSeriesConfigs } = useLineMarkerGradients({ defaultStroke: DEFAULT_LINE_STROKE, lines });

  const {
    brushConfig,
    brushControls,
    brushRangeValue,
    brushTrackExtent,
    hasBrush,
    timeExtent,
    timeExtentRaw,
    visibleData,
  } = useLineBrushControls({ brushes, data, projectionConfigs, renderData, xDataKey, xDomain });

  const {
    nicedDomainsByAxis,
    projectorFor,
    yDomainChangedForTween,
    yDomainFinal,
  } = useLineYDomains({ data, lines, projectionConfigs, status, visibleData });

  const isLoading = status === "loading";
  const { definition } = useLineChartSpec({
    brushControls,
    chartPhase,
    crosshairGradientId,
    effectiveYDomainTweenDuration,
    grid,
    heightPx,
    hoveredIndex,
    hoveredIndexForPL,
    isDiscrete,
    isLoaded,
    isLoading,
    labelFade,
    legendHoveredIndex,
    lines,
    margin,
    markerGradientIdByKey,
    markerSeriesConfigs,
    plTooltipSignIndex,
    profitLossLines,
    projectionConfigs,
    projectionGradientBaseId,
    projectionLines,
    projectorFor,
    renderData,
    timeExtent,
    timeExtentRaw,
    tooltip,
    tooltipEnabled,
    visibleData,
    width,
    xAxis,
    xDataKey,
    xDomain,
    xScaleD3Ref,
    yAxis,
    yDomainChangedForTween,
    yDomainFinal,
  });

  const renderTooltipBody = useCallback(
    (ctx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, Readonly<Date>, number>>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (datum, rowsCtx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, Readonly<Date>, number>>) =>
          lines.map((line) => {
            const rowValue = datum[line.dataKey];
            return {
              color: firstNonEmptyString(line.stroke, findPointColorForSeries(rowsCtx.points, line.dataKey)) ?? "transparent",
              label: line.dataKey,
              value: isNumber(rowValue) || isString(rowValue) ? rowValue : stringifyDatumValue({ fallback: "0", value: rowValue ?? 0 }),
            };
          }),
        resolveTitle: (datum) => {
          const date = datum[xDataKey];
          return date instanceof Date ? weekdayDateFmt.format(date) : undefined;
        },
        tooltip,
      }),
    [tooltip, xDataKey, lines],
  );
  const {
    clearFocusChrome,
    datePill,
    dragSelectionActiveRef,
    handleFocusChange,
    markerActiveStore,
  } = useLineFocusChrome({
    chartPhase,
    interactionRef,
    isDiscrete,
    isLoaded,
    profitLossLines,
    renderData,
    setHoveredIndex,
    setLabelFade,
    setPlTooltipSignIndex,
    tooltip,
    tooltipEnabled,
    xDataKey,
    xDomain,
  });

  const { handleRender: revealHandleRender } = useLineReveal({
    animationDuration,
    animationEasing,
    captureRenderContext,
    chartPhase,
    containerRef,
    marginLeft: margin.left,
    marginRight: margin.right,
    markerSeriesConfigs,
    prefersReducedMotion,
    revealDurationMs,
    revealEasingCss,
    revealEpoch,
    width,
  });
  // Host-owned sizing: the host adopts the measured width through this render callback.
  const handleRender = useCallback((context: Parameters<typeof revealHandleRender>[0]): void => {
    revealHandleRender(context);
    adoptHostWidth(setLiveWidth, context.scene.width);
  }, [revealHandleRender]);

  const {
    backgroundNode,
    brushChromeNode,
    brushClipId,
    brushClipNode,
    chartSelection,
    definitionOverlayNode,
    fadeEdgesMask,
    loadingLabelNode,
    needsBrushClip,
    pulseMode,
  } = useLineOverlays({
    animationDuration,
    background,
    brushConfig,
    brushRangeValue,
    brushTrackExtent,
    chartMarkers,
    chartPhase,
    children,
    clearFocusChrome,
    clientToScene,
    containerRef,
    crosshairGradientId,
    data,
    datePill,
    defaultLineStroke: DEFAULT_LINE_STROKE,
    defaultLineStrokeWidth: DEFAULT_LINE_STROKE_WIDTH,
    definition,
    dragSelectionActiveRef,
    hasBrush,
    hasHover: hoveredIndex !== null,
    heightPx,
    innerWidth,
    isLoaded,
    isLoading,
    legendHoveredIndex,
    lines,
    loadingLabel,
    margin,
    markerActiveStore,
    markerGradientDefs,
    nicedDomainsByAxis,
    profitLossLines,
    projectionConfigs,
    projectionEndMarkers,
    projectionGradientBaseId,
    projectionLines,
    projectionPhasePortRef,
    renderData,
    sceneRef,
    terminalMarkers,
    timeExtent,
    timeExtentRaw,
    tooltip,
    tooltipEnabled,
    width,
    xDataKey,
    xDomain,
    xScaleD3Ref,
    yDomainFinal,
  });
  const lineChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);

  const rendererClipStyle = useMemo(
    () => (needsBrushClip ? { clipPath: `url(#${brushClipId})` } : undefined),
    [brushClipId, needsBrushClip],
  );
  const rendererNode = definition && (
    <div style={rendererClipStyle}>
      <ChartHost
        renderer={lineChartRenderer}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        aspectRatio={parseAspectRatio(aspectRatio)}
        className={className}
        height={heightPx > 0 ? heightPx : undefined}
        initialWidth={HOST_INITIAL_WIDTH}
        definition={definition}
        onFocusGroupChange={handleFocusChange}
        onRender={handleRender}
        renderTooltipBody={tooltipEnabled ? renderTooltipBody : undefined}
        style={style}
      />
    </div>
  );
  const containerStyle = useMemo((): CSSProperties => ({ aspectRatio, isolation: "isolate", position: "relative", width: "100%", ...style }), [aspectRatio, style]);
  return (
    <ChartSelectionContext.Provider value={chartSelection}>
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="line"
      data-bkm-fade-edges={fadeEdgesMask["data-bkm-fade-edges"]}
      data-bkm-fade-edges-left={fadeEdgesMask["data-bkm-fade-edges-left"]}
      data-bkm-fade-edges-right={fadeEdgesMask["data-bkm-fade-edges-right"]}
    >
      {brushClipNode}
      {brushChromeNode}
      {loadingLabelNode}
      {backgroundNode}
      {rendererNode}
      {definitionOverlayNode}
      {!definition && isLoading && width > 0 && renderLoadingSkeleton({
        heightPx,
        lines,
        marginBottom: margin.bottom,
        marginLeft: margin.left,
        marginRight: margin.right,
        marginTop: margin.top,
        pulseMode,
        width,
        yDomainFinal,
      })}
    </div>
    </ChartSelectionContext.Provider>
  );
};
