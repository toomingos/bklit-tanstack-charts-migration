// Bklit BarChart on TanStack Charts. Vertical grouped bars only; stacked/orientation out of scope.
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import { ChartHost, ChartRegistryBridge, HOST_INITIAL_WIDTH, adoptHostWidth, useRegistryEntriesState } from "./internal/chart-host";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { extractChildren } from "./internal/children-extract";
import { useFocusInjection } from "./internal/focus-injection";
import { renderPatternPreset } from "./internal/pattern-preset-render";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartLegendHover } from "./internal/chart-legend-hover-context";
import { useChartRenderer } from "./internal/motion-renderer";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { useChartMargin, DEFAULT_CHART_MARGIN } from "./internal/use-chart-margin";
import type { ChartMargin } from "./internal/use-chart-margin";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import type { EnterTransition } from "./internal/enter-transition";
import { BAR_DEPTH_BACK_NODES_PER_ROW, countSquarePrimitives } from "./internal/bar-chart-series-marks";
import { handleBarSvgRender } from "./internal/bar-chart-overlays";
import { useBarTooltipBody } from "./internal/bar-tooltip-body";
import { useBarScales } from "./internal/use-bar-scales";
import { useBarDefinition } from "./internal/use-bar-definition";
import type { ChartDatum, ChartPhase } from "./internal/types";
import "./styles.css";

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
  // One prefix per mount scopes renderer ids and seam ids alike.
  const idPrefix = useSanitizedId();
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const width = liveWidth;
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
  // Registry union (V1.3 carriers): entries report up from inside the host.
  const [registryEntries, handleRegistryEntries] = useRegistryEntriesState();
  // Package-resolved band snapshot for the label-fade anchor (V1.2/G6); hover
  // Cannot precede first paint, so the null fallback never paints.
  const bandSnapshotRef = useRef<{ map: (label: string) => number | undefined; bandwidth: number } | null>(null);

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
    () => extractChildren(children, registryEntries),
    [children, registryEntries],
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
    dotSeriesList,
    nicedDomainsByAxis,
    nicedPrimaryDomain,
    resolvedBarSquares,
    totalSeriesCount,
  } = scales;
  const heightPxBar = width / parseAspectRatio(aspectRatio);
  const definitionState = useBarDefinition({
    allSeriesKeys: scales.allSeriesKeys,
    animationDuration,
    animationEasing,
    barDepthBacksRaw,
    barDepthFrontsRaw,
    barDepthProvider,
    barFocusStrategy: scales.barFocusStrategy,
    barPulsesRaw,
    barXAxis,
    categoryAccessor: scales.categoryAccessor,
    categoryOrder,
    dotSeriesList,
    enterTransition,
    grid,
    groupBandwidth: scales.groupBandwidth,
    groupScale: scales.groupScale,
    hasBarColumnTrack: scales.hasBarColumnTrack,
    hasBarSquares: scales.hasBarSquares,
    idPrefix,
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
    definition,
    hasBarDepth,
    hasBarSquares,
    revealDurationMs,
    setLabelFade,
    squaresDefs,
  } = definitionState;

  const handleFocusGroupChange = useCallback(
    (points: readonly Readonly<ChartPoint<ChartDatum, string, number>>[]) => {
      if (points.length === 0) {
        setLabelFade((previous) => (previous === undefined ? previous : undefined));
        return;
      }
      const categoryLabel = points[0].xValue;
      // Anchor from the package-resolved band, not mean point.x (asymmetric under group padding).
      const band = bandSnapshotRef.current;
      const anchorX = band === null ? 0 : (band.map(categoryLabel) ?? 0) + band.bandwidth / 2;
      setLabelFade((previous) => {
        if (previous === undefined) {return { hoveredLabel: categoryLabel, primaryX: anchorX };}
        if (previous.primaryX === anchorX && previous.hoveredLabel === categoryLabel) {return previous;}
        return { hoveredLabel: categoryLabel, primaryX: anchorX };
      });
    },
    [setLabelFade],
  );

  const renderTooltipBody = useBarTooltipBody({ categoryAccessor: scales.categoryAccessor, series: dotSeriesList, tooltip });

// HandleRender only tracks phase and syncs BarPulse; native motion owns the reveal.
// Reveal end is timer-approximated: native motion exposes no per-mark completion hook.
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<ChartDatum, string, number>>): void => {
    captureRenderContext(context);
    adoptHostWidth(setLiveWidth, context.scene.width);
    // Snapshot the package-resolved band for the label-fade anchor (V1.2/G6).
    const resolved = context.scene.scales.x;
    if (resolved.bandwidth > 0) {
      const snapshot = resolved;
      bandSnapshotRef.current = {
        bandwidth: snapshot.bandwidth,
        map: (label: string): number | undefined => {
          const center = snapshot.map(label);
          // Package band map returns the band center; the anchor needs starts.
          return Number.isFinite(center) ? center - snapshot.bandwidth / 2 : undefined;
        },
      };
    }
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

  const barRootStyle = useMemo((): CSSProperties => ({ aspectRatio, isolation: "isolate", position: "relative", width: "100%" }), [aspectRatio]);

  // Reference-area geometry reads bounds from the host; only data domains travel by prop.
  const referenceAreaGeom = useMemo((): ReferenceAreaLayersGeom | undefined => {
    if (heightPxBar <= 0 || categoryOrder.length === 0) { return undefined; }
    return {
      isBarChart: true,
      // Reference areas need the NICED domain the bars paint in, not raw yDomain.
      yDomain: nicedPrimaryDomain,
      yDomainsByAxis: nicedDomainsByAxis,
    };
  }, [heightPxBar, categoryOrder, nicedDomainsByAxis, nicedPrimaryDomain]);

  const tooltipBody = tooltipEnabled ? renderTooltipBody : undefined;
  // Seam resources carry the mount prefix; squares reference them as url(#id).
  // Squares gradients stay userSpace slices; the band crosshair needs no def (band form).
  const barSeamResources = (
    <>
      {squaresDefs.map((def) => (
        <Fragment key={def.gradientId}>
          <linearGradient id={def.gradientId} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={100}>
            {def.gradientStops.map((stop) => (
              <stop key={`${stop.offset}-${stop.color}`} offset={`${stop.offset}%`} stopColor={stop.color} />
            ))}
          </linearGradient>
          {def.patternId !== undefined && def.patternId !== "" && def.patternPreset !== undefined && renderPatternPreset(def.patternPreset, def.patternId, { color: `url(#${def.gradientId})` })}
        </Fragment>
      ))}
    </>
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
      {definition && (
          <ChartHost
            ariaLabel={ariaLabel}
            ariaDescription={ariaDescription}
            aspectRatio={parseAspectRatio(aspectRatio)}
            className={className}
            height={heightPxBar}
            idPrefix={idPrefix}
            initialWidth={HOST_INITIAL_WIDTH}
            definition={definition}
            resources={barSeamResources}
            renderer={barChartRenderer}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
            renderTooltipBody={tooltipBody}
          >
            {children}
            <ChartRegistryBridge onEntries={handleRegistryEntries} />
            {background && (
              <BackgroundLayer
                config={background}
                idPrefix={idPrefix}
              />
            )}
            {referenceAreaLayer}
          </ChartHost>
      )}
    </div>
  );
};

BarChart.displayName = "BarChart";
export type { BarChartProps, BarOrientation };
export { BarChart };
