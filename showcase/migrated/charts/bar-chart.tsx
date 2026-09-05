// Bklit BarChart on TanStack Charts. Vertical grouped bars only; stacked/orientation out of scope.
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { scaleBand } from "d3-scale";
import type { ScaleBand } from "d3-scale";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import { extractChildren } from "./internal/children-extract";
import { buildPill } from "./internal/date-pill";
import type { PillBuild } from "./internal/date-pill";
import { DISCRETE_INTERACTION_THRESHOLD } from "./internal/design-tokens";
import { useFocusInjection } from "./internal/focus-injection";
import { renderPatternPreset } from "./internal/pattern-preset-render";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import type { IndicatorFadeGradientStop } from "./internal/fade-mask";
import { useChartRenderer } from "./internal/motion-renderer";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { useChartMargin, DEFAULT_CHART_MARGIN } from "./internal/use-chart-margin";
import type { ChartMargin } from "./internal/use-chart-margin";
import { useContainerWidth } from "./internal/use-container-size";
import { shortDateFmt } from "./internal/formatters";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import type { EnterTransition } from "./internal/enter-transition";
import { BAR_DEPTH_BACK_NODES_PER_ROW, countSquarePrimitives } from "./internal/bar-chart-series-marks";
import { clearDatePillForEmptyFocus, handleBarSvgRender, syncDatePillForCategory } from "./internal/bar-chart-overlays";
import type { BarChromeState } from "./internal/bar-chart-overlays";
import { useBarTooltipBody } from "./internal/bar-tooltip-body";
import { useBarScales } from "./internal/use-bar-scales";
import { useBarDefinition } from "./internal/use-bar-definition";
import type { ChartDatum, ChartPhase } from "./internal/types";
import "./styles.css";

// Tooltip overlay covers the plot without intercepting pointer events.
const BAR_TOOLTIP_OVERLAY_STYLE = { inset: 0, pointerEvents: "none", position: "absolute" } as const;
// Hidden gradient-defs SVG takes no space in layout.
const BAR_HIDDEN_DEFS_STYLE = { position: "absolute" } as const;
// Default gap between bar groups (d3 scaleBand padding fraction).
const DEFAULT_BAR_GAP = 0.2;

type BarOrientation = "vertical" | "horizontal";

interface BarChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly animationDuration?: number;
  /** Easing for the per-bar grow reveal (bklit shell default cubic-bezier). */
  readonly animationEasing?: string;
  /** Overrides the reveal timing; springs coerce to tweens. */
  readonly enterTransition?: Readonly<EnterTransition>;
  /** Replay epoch input: bumping it replays the grow reveal with no data change. */
  readonly revealSignature?: string;
  readonly margin?: Readonly<Partial<ChartMargin>>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly barGap?: number;
  /** DOC-9 (B13): bklit `barWidth` (bar-chart.tsx:81) — type surface only, no behavior. */
  readonly barWidth?: number;
  /** DOC-9 (B13): bklit `orientation` (bar-chart.tsx:83) — type surface only; pilot renders vertical. */
  readonly orientation?: BarOrientation;
  /** DOC-9 (B13): bklit `stacked` (bar-chart.tsx:85) — type surface only; pilot renders grouped. */
  readonly stacked?: boolean;
  /** DOC-9 (B13): bklit `stackGap` (bar-chart.tsx:87) — type surface only, no behavior. */
  readonly stackGap?: number;
  /** DOC-9 (B13): bklit `squareSnap` (bar-chart.tsx:89) — type surface only, no behavior. */
  readonly squareSnap?: { readonly squareGap: number; readonly groupGap?: number; readonly fit?: boolean };
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  readonly children?: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const isString = <Value,>(candidate: Value): candidate is Value & string => typeof candidate === "string";
const isNumber = <Value,>(candidate: Value): candidate is Value & number => typeof candidate === "number";

const BarChart = ({
  data,
  xDataKey = "name",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  barGap = DEFAULT_BAR_GAP,
  onPhaseChange,
  children,
  ariaLabel = "Bar chart",
  ariaDescription,
}: Readonly<BarChartProps>): ReactElement => {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);
  // Bklit parity: the first phase is always "revealing"; bypass the ref guard once.
  const phaseRef = useRef<ChartPhase>("revealing");
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const setPhase = useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) {return;}
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  useEffect(() => {
    onPhaseChangeRef.current?.("revealing");
  }, []);

  // Cancel the reveal-deadline timer on unmount; an uncancelled one fires on detached DOM.
  useEffect(() =>
    (): void => {
      if (revealDeadlineTimerRef.current !== null) {
        globalThis.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    }
  , []);

  const { bars, barSquares: barSquaresRaw, barColumnTracks: barColumnTracksRaw, barDepthBacks: barDepthBacksRaw, barDepthFronts: barDepthFrontsRaw, barPulses: barPulsesRaw, barDepthProvider, grid, barXAxis, background, tooltip } = useMemo(
    () => extractChildren(children),
    [children],
  );
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { captureRenderContext } = useFocusInjection<ChartDatum, string, number>();
  const tooltipEnabled = tooltip?.enabled ?? false;

  // Bklit parity: no decimation — every row renders a bar.
  const renderData = data;
  // Reveal replays on data change only; legend-hover recreations must not replay.
  const latestRenderDataRef = useRef(renderData);
  latestRenderDataRef.current = renderData;
  const revealedForDataRef = useRef<unknown>(null);

  const revealKey = `${revealSignature}|${animationDuration}`;
  const revealedKeyRef = useRef<string | null>(null);
  const revealKeyRef = useRef(revealKey);
  revealKeyRef.current = revealKey;

  const scales = useBarScales({
    barColumnTracksRaw,
    barGap,
    barSquaresRaw,
    bars,
    margin,
    phaseRef,
    renderData,
    width,
    xDataKey,
  });
  const {
    bandWidth,
    categoryOrder,
    categoryScaleForOverlay,
    dotSeriesList,
    innerWidth,
    nicedDomainsByAxis,
    nicedPrimaryDomain,
    resolvedBarSquares,
    totalSeriesCount,
  } = scales;
  const heightPxBar = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;
  const definitionState = useBarDefinition({
    allSeriesKeys: scales.allSeriesKeys,
    animationDuration,
    animationEasing,
    bandWidth,
    barDepthBacksRaw,
    barDepthFrontsRaw,
    barDepthProvider,
    barFocusStrategy: scales.barFocusStrategy,
    barPulsesRaw,
    barXAxis,
    categoryAccessor: scales.categoryAccessor,
    categoryOrder,
    categoryScaleForOverlay,
    dotSeriesList,
    enterTransition,
    grid,
    groupBandwidth: scales.groupBandwidth,
    groupScale: scales.groupScale,
    groupScaleForOverlay: scales.groupScaleForOverlay,
    hasBarColumnTrack: scales.hasBarColumnTrack,
    hasBarSquares: scales.hasBarSquares,
    legendHoveredIndex,
    margin,
    projectValue: scales.projectValue,
    renderData,
    resolvedBarColumnTracks: scales.resolvedBarColumnTracks,
    resolvedBarSquares,
    resolvedSeries: scales.resolvedSeries,
    tooltip,
    tooltipEnabled,
    totalSeriesCount,
    width,
    xScaleFactory: scales.xScaleFactory,
    yScale: scales.yScale,
  });
  const {
    chartConfig,
    crosshairFadeGradient,
    definition,
    hasBarDepth,
    hasBarSquares,
    revealDurationMs,
    setLabelFade,
    squaresDefs,
  } = definitionState;

  const chromeStateRef = useRef<BarChromeState | null>(null);
  const dateLabelsForPill = useMemo(() => renderData.map((datum: Readonly<ChartDatum>) => {
    const rawValue = datum[xDataKey];
    if (rawValue instanceof Date) {return shortDateFmt.format(rawValue);}
    if (isString(rawValue)) {return rawValue;}
    if (isNumber(rawValue)) {return String(rawValue);}
    return "";
  }), [renderData, xDataKey]);
  // Chrome snapshot only feeds pointer and focus handlers, so syncing post-commit keeps every read fresh.
  useLayoutEffect(() => {
    chromeStateRef.current = {
      dateLabels: dateLabelsForPill,
      tooltip: tooltip ?? undefined,
    };
  });

  const overlayHostRef = useRef<HTMLDivElement | null>(null);

  const pillRef = useRef<PillBuild | null>(null);
  // First pill show jumps the spring; later moves spring (mirrors legacy showing flag).
  const pillVisibleRef = useRef(false);

  useLayoutEffect((): (() => void) | undefined => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) {return undefined;}
    const doc = el.ownerDocument;
    const pillBuild = buildPill(doc, chartConfig.tooltipSpring, () => chromeStateRef.current?.dateLabels ?? []);
    el.append(pillBuild.layer);
    pillRef.current = pillBuild;
    return (): void => {
      pillRef.current = null;
      pillVisibleRef.current = false;
      pillBuild.spring.stop();
      pillBuild.ticker?.detach();
      pillBuild.layer.remove();
    };
  }, [tooltipEnabled, chartConfig]);

  const handleFocusGroupChange = useCallback(
    (points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[]) => {
      const pillBuild = pillRef.current;
      if (points.length === 0) {
        clearDatePillForEmptyFocus({ pillBuild, setLabelFade, visibilityRef: pillVisibleRef });
        return;
      }
      const categoryLabel = points[0].xValue;
      // Bklit indexes the hovered row (tooltipData.index); a label map is wrong with duplicate labels.
      const categoryIndex = points[0].datumIndex;
      // Anchor from the band-scale clone, not mean point.x (asymmetric under group padding).
      const anchorX = (categoryScaleForOverlay(categoryLabel) ?? 0) + bandWidth / 2;
      syncDatePillForCategory({
        anchorX,
        categoryIndex,
        categoryLabel,
        dateLabels: chromeStateRef.current?.dateLabels,
        discrete: renderData.length > DISCRETE_INTERACTION_THRESHOLD,
        pillBuild,
        showDatePill: tooltipEnabled && (tooltip?.showDatePill ?? true),
        showing: !pillVisibleRef.current,
      });
      pillVisibleRef.current = true;

      setLabelFade((prev) =>
        prev?.primaryX === anchorX && prev.hoveredLabel === categoryLabel
          ? prev
          : { hoveredLabel: categoryLabel, primaryX: anchorX },
      );
    },
    [categoryScaleForOverlay, bandWidth, renderData.length, tooltipEnabled, tooltip, setLabelFade],
  );

  const renderTooltipBody = useBarTooltipBody({ categoryAccessor: scales.categoryAccessor, series: dotSeriesList, tooltip });

// HandleRender only tracks phase and syncs BarPulse; native motion owns the reveal.
// Reveal end is timer-approximated: native motion exposes no per-mark completion hook.
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<ChartDatum, string, number>>): void => {
    captureRenderContext(context);
    const surfaceElement = context.surface.element;
    if (!(surfaceElement instanceof SVGSVGElement)) {
      setPhase("ready");
      return;
    }
    handleBarSvgRender({
      animationDuration,
      latestRenderDataRef,
      phaseRef,
      renderDataLength: renderData.length,
      revealDeadlineTimerRef,
      revealDurationMs,
      revealKeyRef,
      revealedForDataRef,
      revealedKeyRef,
      setPhase,
      svgRoot: surfaceElement,
    });
  }, [animationDuration, revealDurationMs, setPhase, renderData.length, captureRenderContext]);

  const refAreaChildrenBar = useMemo(() => extractReferenceAreaProps(children), [children]);
  // Count emitted primitives (not data rows) for the motion/static renderer gate.
  // Gate on declared depth marks, not applicable ones: the renderer choice latches at first render.
  const motionPrimitiveEstimate = useMemo(() => {
    const rows = renderData.length;
    const squaresN = hasBarSquares ? resolvedBarSquares.length : 0;
    let total = rows * Math.max(0, totalSeriesCount - squaresN);
    if (squaresN > 0) {
      const barLengthPx = Math.max(0, heightPxBar - margin.top - margin.bottom);
      total += countSquarePrimitives({ bandWidth, barLengthPx, rows, squares: resolvedBarSquares, totalSeriesCount });
    }
    if (hasBarDepth) {
      total += rows * (barDepthBacksRaw.length * BAR_DEPTH_BACK_NODES_PER_ROW + barDepthFrontsRaw.length);
    }
    return total;
  }, [hasBarSquares, resolvedBarSquares, renderData.length, heightPxBar, margin.top, margin.bottom, totalSeriesCount, bandWidth, hasBarDepth, barDepthBacksRaw, barDepthFrontsRaw]);
  const barChartRenderer = useChartRenderer<ChartDatum, string, number>(motionPrimitiveEstimate);

  const barScaleForRef = useMemo((): ScaleBand<string> | undefined => {
    if (categoryOrder.length === 0) {return undefined;}
    return scaleBand().domain(categoryOrder).range([0, Math.max(0, width - margin.left - margin.right)]).padding(barGap);
  }, [categoryOrder, width, margin.left, margin.right, barGap]);

  const barRootStyle = useMemo((): CSSProperties => ({ aspectRatio, isolation: "isolate", position: "relative", width: "100%" }), [aspectRatio]);

  const referenceAreaGeom = useMemo((): ReferenceAreaLayersGeom | undefined => {
    if (heightPxBar <= 0 || barScaleForRef === undefined) { return undefined; }
    return {
      barScale: barScaleForRef,
      height: heightPxBar,
      isBarChart: true,
      margin,
      width,
      // Reference areas need the NICED domain the bars paint in, not raw yDomain.
      yDomain: nicedPrimaryDomain,
      yDomainsByAxis: nicedDomainsByAxis,
    };
  }, [barScaleForRef, heightPxBar, margin, nicedDomainsByAxis, nicedPrimaryDomain, width]);

  const tooltipBody = tooltipEnabled ? renderTooltipBody : undefined;
  const squaresGradientDefs = squaresDefs.map((def) => (
    <Fragment key={def.gradientId}>
      <linearGradient id={def.gradientId} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={100}>
        {def.gradientStops.map((stop) => (
          <stop key={`${stop.offset}-${stop.color}`} offset={`${stop.offset}%`} stopColor={stop.color} />
        ))}
      </linearGradient>
      {def.patternId !== undefined && def.patternId !== "" && def.patternPreset !== undefined && renderPatternPreset(def.patternPreset, def.patternId, { color: `url(#${def.gradientId})` })}
    </Fragment>
  ));
  const crosshairGradientDef = crosshairFadeGradient && (
    <linearGradient
      key={crosshairFadeGradient.id}
      id={crosshairFadeGradient.id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      x2={0}
      y1={margin.top}
      y2={margin.top + Math.max(0, heightPxBar - margin.top - margin.bottom)}
    >
      {crosshairFadeGradient.stops.map((stop: Readonly<IndicatorFadeGradientStop>) => (
        <stop key={`${stop.offset}-${stop.opacity}`} offset={stop.offset} stopColor={crosshairFadeGradient.color} stopOpacity={stop.opacity} />
      ))}
    </linearGradient>
  );
  const referenceAreaLayer = referenceAreaGeom === undefined ? undefined : (
    <ReferenceAreaLayers
      configs={refAreaChildrenBar}
      geom={referenceAreaGeom}
    />
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={barRootStyle}
      data-bkm-chart="bar"
    >
      {background && (
        <BackgroundLayer
          config={background}
          innerWidth={innerWidth}
          innerHeight={Math.max(0, heightPxBar - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
        />
      )}
      {definition && (
        <>
          <RendererChart
            ariaLabel={ariaLabel}
            ariaDescription={ariaDescription}
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            renderer={barChartRenderer}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
            renderTooltipBody={tooltipBody}
          />
          {referenceAreaLayer}
          {tooltipEnabled && (
            <div
              ref={overlayHostRef}
              style={BAR_TOOLTIP_OVERLAY_STYLE}
            />
          )}
        </>
      )}
      {(squaresDefs.length > 0 || crosshairFadeGradient) && (
        <svg width={0} height={0} style={BAR_HIDDEN_DEFS_STYLE} aria-hidden="true" focusable="false">
          <defs>
            {squaresGradientDefs}
            {crosshairGradientDef}
          </defs>
        </svg>
      )}
    </div>
  );
};

export type { BarChartProps, BarOrientation };
export { BarChart };
