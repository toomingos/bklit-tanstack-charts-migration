// Bklit BarChart on native TanStack Charts: compound children are read into one
// `defineChart` definition (bar); the `motion()` renderer plays the entrance.
import { erase } from "./kit/erased-types";
import "./styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { RendererChart, sameCategoryTarget } from "./kit/tooltip/tooltip-leaf";
import { useInteractionHandle, useTouchInert } from "./kit/touch-focus";
import { useHostMounted } from "./kit/size/parent-size-arm";
import { useReadyGate } from "./kit/entrance/reveal-arm";
import { motion } from "@tanstack/charts/motion";
import { buildBarDefinition } from "./bar/definition";
import { useDataUpdated } from "./kit/use-data-updated";
import { useChildTable } from "./kit/stable-children";
import { readBarChildren } from "./bar/read-children";
import { numberOrZero, resolveBarSeries } from "./bar/model";
import { hasDepth } from "./bar/depth-feature";
import { BarDepthConfigProvider } from "./bar/depth-entries";
import type { BarDepthProviderProps, BarXAxisProps } from "./bar/carriers";
import { barDimCss, FOCUS_X_VAR, MAX_INDEX } from "./bar/hover";
import type { TickFade } from "./bar/hover";
import type { Row } from "./bar/model";
import { BarTooltipBody } from "./bar/tooltip";
import { bklitSurfaceStyle, DEFAULT_ANIMATION_MS, DEFAULT_MARGIN, parseAspectRatio } from "./kit/theme";
import type { ChartMargin } from "./kit/theme";
import { pillLayout, writePillRollIn } from "./kit/cartesian/date-pill";
import { useChartLegendHover } from "./kit/legend/legend";
import { scaleBand, scaleLinear, scaleUtc } from "d3-scale";
import type { LineConfig } from "./kit/cartesian/chart-context";
import { useFocusRow } from "./kit/cartesian/chart-context-focus";
import type { ChartPhase, ChartStatus, Transition } from "./kit/motion/phase";
import { BarLoadingSkeleton } from "./kit/loading/sweep";
import { useBridgedContext, useReferenceAreas, valueScale } from "./kit/cartesian/context-bridge";
import { useResizeBox } from "./kit/size/use-resize-box";
import type { FocusedRow } from "./kit/cartesian/context-bridge";
import { propsFor } from "./kit/read-children";
import { shortDateFmt } from "./kit/format";
import { FocusLayer, useFocusStore } from "./kit/cartesian/focus-layer";
import { readyGateCss, focusEmptyHiddenCss } from "./kit/cartesian/gate-css";
import { typedAttr } from "./kit/css-hooks";
import { useSanitizedId } from "./kit/use-sanitized-id";
import { clearAttribute, clearVar, raiseAttribute, writeHoverIndex, writeVar } from "./kit/host-write";
import { keyStarts } from "./kit/renderer-dom";

// Container-owned height: the host follows the wrapper's CSS content height (TanStack renderer.ts observesContainerHeight, responsive-charts.md).
const HOVER_ON_ATTR = "data-bkm-on";
const FILL_HOST_STYLE: CSSProperties = { height: "100%" };

// bklit bar-chart.tsx:54-55: skeleton bars when `data` is empty.
const FALLBACK_LOADING_BARS = 12;

type BarOrientation = "vertical" | "horizontal";

interface BarChartProps {
  data: Row[];
  xDataKey?: string;
  animationDuration?: number;
  // Accepted divergence: typed as bklit's but not read here (the entrance is fixed; square snapping follows <BarSquares> props).
  animationEasing?: string;
  enterTransition?: Transition;
  revealSignature?: string;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  style?: CSSProperties;
  barGap?: number;
  barWidth?: number;
  orientation?: BarOrientation;
  stacked?: boolean;
  stackGap?: number;
  squareSnap?: { squareGap: number; groupGap?: number; fit?: boolean };
  onPhaseChange?: (phase: ChartPhase) => void;
  children?: ReactNode;
  ariaLabel?: string;
  ariaDescription?: string;
  status?: ChartStatus;
}

const BarChart = (props: Readonly<BarChartProps>): ReactElement => {
  const {
    data,
    xDataKey = "name",
    animationDuration = DEFAULT_ANIMATION_MS,
    margin,
    aspectRatio = "2 / 1",
    className,
    style,
    barGap = 0.2,
    orientation = "vertical",
    stacked = false,
    stackGap = 0,
    children,
    status = "ready",
  } = props;
  const loading = status === "loading";
  const legendHovered = useChartLegendHover().hoveredIndex;
  const containerRef = useRef<HTMLDivElement | null>(null);
  useTouchInert(containerRef);
  // The svg mounts in the layout-effect commit, before first paint; bklit waits on ParentSize's RO+rAF first (bar-chart.tsx:701).
  const parentSized = useHostMounted();
  const fillHeight = style?.aspectRatio === "unset";
  // Hover lives in a ref store read only by <FocusLayer>: no re-render / rebuild of the chart on focus.
  const focusStore = useFocusStore<FocusedRow>();
  // Custom marks (squares, depth) only animate enter when they join a painted scene, so charts that have them
  // paint a seeded first build, then one `entered` flip builds the full definition and the update tweens it in.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (parentSized) { setEntered(true); }
  }, [parentSized]);
  const clock = useRef<{ at: number | null }>({ at: null }).current;
  const uid = `b${useSanitizedId()}`;
  // Legend hover re-renders the host with fresh `children`; keep the previous table while every carrier is structurally equal.
  const { table, custom, ready: childrenReady } = useChildTable(children, readBarChildren);
  const series = useMemo(() => resolveBarSeries(table), [table]);
  const needsSeed = useMemo(() => series.some((s) => s.squares) || hasDepth(table), [series, table]);
  const seed = needsSeed && !entered;
  const resolvedMargin = useMemo(() => ({ ...DEFAULT_MARGIN, ...margin }), [margin]);
  const size = useResizeBox(containerRef, undefined, true);
  const skeletonStyle = useMemo(
    (): CSSProperties => ({ position: "absolute", left: resolvedMargin.left, top: resolvedMargin.top, overflow: "visible", pointerEvents: "none" }),
    [resolvedMargin],
  );
  const plotRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  plotRef.current = {
    left: resolvedMargin.left,
    top: resolvedMargin.top,
    width: Math.max(0, size.width - resolvedMargin.left - resolvedMargin.right),
    height: Math.max(0, size.height - resolvedMargin.top - resolvedMargin.bottom),
  };
  const plot = useCallback(() => plotRef.current, []);
  const updated = useDataUpdated(data);
  const built = useMemo(
    () =>
      buildBarDefinition({
        data,
        xKey: xDataKey,
        table,
        series,
        margin: resolvedMargin,
        barGap,
        animationDuration,
        uid,
        horizontal: orientation === "horizontal",
        stacked,
        stackGap,
        seed,
        clock,
        updated,
        plot,
        loading,
      }),
    [loading, seed, clock, data, xDataKey, table, series, resolvedMargin, barGap, animationDuration, uid, orientation, stacked, stackGap, plot, updated],
  );
  const renderer = useMemo(
    () => motion({ transition: { type: "tween", duration: animationDuration } }),
    [animationDuration],
  );
  // Public `useChart()` context, derived from the native focus + resolved domains.
  const horizontal = orientation === "horizontal";
  const innerWidth = Math.max(0, size.width - resolvedMargin.left - resolvedMargin.right);
  const innerHeight = Math.max(0, size.height - resolvedMargin.top - resolvedMargin.bottom);
  const categoryOf = useCallback((d: Row): string => String(d[xDataKey]), [xDataKey]);
  const categories = useMemo(() => data.map(categoryOf), [data, categoryOf]);
  const bandLength = horizontal ? innerHeight : innerWidth;
  const barScale = useMemo(() => scaleBand().domain(categories).range([0, bandLength]).padding(barGap), [categories, bandLength, barGap]);
  const valueAxis = useMemo(() => {
    const [lo, hi] = built.valueDomain;
    return horizontal ? scaleLinear().domain([lo, hi]).range([0, innerWidth]) : valueScale([lo, hi], innerHeight);
  }, [built.valueDomain, horizontal, innerWidth, innerHeight]);
  const rowIndex = useMemo(() => new Map(data.map((row, i) => [row, i] as const)), [data]);
  // bklit exposes a Date-typed x scale for bar charts: row i maps to the centre of band i.
  const xScale = useMemo(() => {
    const centre = (i: number): number => (barScale(categories[i] ?? "") ?? 0) + barScale.bandwidth() / 2;
    return scaleUtc()
      .domain([new Date(0), new Date(Math.max(1, data.length - 1))])
      .range(horizontal || data.length === 0 ? [0, innerWidth] : [centre(0), centre(Math.max(1, data.length - 1))]);
  }, [barScale, categories, data.length, horizontal, innerWidth]);
  const xAccessor = useCallback((d: Row): Date => new Date(rowIndex.get(d) ?? 0), [rowIndex]);
  const dateLabels = useMemo(() => data.map((row) => (row[xDataKey] instanceof Date ? shortDateFmt.format(row[xDataKey]) : String(row[xDataKey]))), [data, xDataKey]);
  const lines = useMemo<LineConfig[]>(() => series.map((sr) => ({ dataKey: sr.key, stroke: sr.fill, strokeWidth: 2 })), [series]);
  const yScales = useMemo(() => ({ left: valueAxis }), [valueAxis]);
  const stackOffsets = useMemo(() => {
    if (!stacked) {
      return undefined;
    }
    const offsets = new Map<number, Map<string, number>>();
    for (const [i, row] of data.entries()) {
      const point = new Map<string, number>();
      let cumulative = 0;
      for (const line of lines) {
        point.set(line.dataKey, cumulative);
        cumulative += numberOrZero(row[line.dataKey]);
      }
      offsets.set(i, point);
    }
    return offsets;
  }, [data, lines, stacked]);
  const extras = useMemo(
    () => ({
      barScale,
      barXAccessor: categoryOf,
      orientation,
      stacked,
      stackOffsets,
      bandWidth: barScale.bandwidth(),
      columnWidth: data.length > 0 ? bandLength / data.length : 0,
    }),
    [barScale, categoryOf, orientation, stacked, stackOffsets, data.length, bandLength],
  );
  const { interaction: barInteraction, onRender: onBarRender } = useInteractionHandle();
  const referenceAreas = useReferenceAreas(table);
  // Rows are focused at their band centre on the plot's middle line; the category strategy snaps like a pointer move.
  const pixelOf = useCallback(
    (index: number) => {
      if (index < 0 || index >= categories.length) {
        return null;
      }
      const centre = (barScale(categories[index]) ?? 0) + barScale.bandwidth() / 2;
      return horizontal
        ? { x: resolvedMargin.left + innerWidth / 2, y: resolvedMargin.top + centre }
        : { x: resolvedMargin.left + centre, y: resolvedMargin.top + innerHeight / 2 };
    },
    [barScale, categories, horizontal, resolvedMargin, innerWidth, innerHeight],
  );
  const focusRow = useFocusRow(containerRef, barInteraction, pixelOf);
  const xAt = useCallback((f: FocusedRow): number => (barScale(categoryOf(f.row)) ?? 0) + barScale.bandwidth() / 2, [barScale, categoryOf]);
  // bklit `canInteract = isLoaded` (bar-chart.tsx:549), set by a setTimeout at animationDuration + staggerMs, staggerMs =
  // data.length > 1 ? animationDuration * 0.4 : 0 (bklit bar-chart.tsx:381-384): hover is inert until then. Armed on the ParentSize commit.
  const { arm: armReady, store: readyStore } = useReadyGate(containerRef, animationDuration + (data.length > 1 ? animationDuration * 0.4 : 0));
  const bridge = useMemo(
    () => ({ data, margin: resolvedMargin, size, containerRef, ready: readyStore, xScale, yScales, lines, animationDuration, xAccessor, dateLabels, xAt, extras, focusRow, referenceAreas }),
    [data, resolvedMargin, size, readyStore, xScale, yScales, lines, animationDuration, xAccessor, dateLabels, xAt, extras, focusRow, referenceAreas],
  );
  const useContextValue = (focused: FocusedRow | null): ReturnType<typeof useBridgedContext> => {
    const hoverExtras = useMemo(() => ({ ...extras, hoveredBarIndex: focused?.index ?? null, setHoveredBarIndex: focusRow }), [extras, focused]);
    return useBridgedContext({ ...bridge, focused, extras: hoverExtras });
  };
  const tooltipOptions = useMemo(
    () => ({ order: series.map((s) => s.key), colors: Object.fromEntries(series.map((s) => [s.key, s.fill])), horizontal: orientation === "horizontal" }),
    [series, orientation],
  );
  // The focus-guide pill replaces the focused category's tick label (bklit). Hidden by CSS keyed on the focus
  // so hovering never re-resolves the definition (a rebuild defers state paint ~150ms behind data motion).
  const hasSeries = series.length > 0;
  const scope = `[data-bkm-bar="${uid}"]`;
  const pill = useMemo(() => (horizontal ? null : pillLayout(data.map((row) => String(row[xDataKey])))), [data, xDataKey, horizontal]);
  // Static stylesheet: depends on the definition only. The hovered category / legend series are host attributes.
  const { tickPositions } = built;
  // bklit bar-x-axis.tsx:91: the date pill hides ticks within tickerHalfWidth of the focused band centre.
  const xAxisProps = propsFor<BarXAxisProps>(table, "barXAxis").at(0);
  const tickerHalfWidth = xAxisProps?.tickerHalfWidth ?? 50;
  const depthConfig = useMemo(() => {
    const provider = propsFor<BarDepthProviderProps>(table, "barDepthProvider").at(0);
    return { segmentsAccessor: provider?.segmentsAccessor, minBarHeight: provider?.minBarHeight };
  }, [table]);
  const staticCss = useMemo(() => {
    const prefix = `${horizontal ? "y" : "x"}-tick-label:`;
    let tickFade: TickFade | null = null;
    if (hasSeries) {
      const ms = horizontal ? 150 : 400;
      tickFade = horizontal ? { prefix, ms, positions: tickPositions } : { prefix, ramp: tickerHalfWidth, ms, positions: tickPositions };
    }
    const dim = barDimCss(scope, built.hover, tickFade, tickPositions.length);
    // bklit's bar is a rect with rx = ry = min(barWidth / 2, 8) (bar.tsx:262-263, 413-414); the native rect has rx = 8 and no ry, so narrow
    // bars got taller corners: clamp both radii to half the band thickness (each still clamps to its own axis, an oval when short, like bklit).
    const radius = `min(calc(attr(rx type(<number>)) * 1px),calc(attr(${horizontal ? "height" : "width"} type(<number>)) * .5px))`;
    // Typed attr() is Chromium-only (133+): under `@supports`, other browsers keep the native rx (ry follows it).
    // The `bars:` key selector has no documented hook (barY takes no className): gap #36; the scalar rect radius is emitted as `rx` only: gap #25.
    const corners = typedAttr(`${scope} rect${keyStarts("bars:")}[rx]{rx:${radius};ry:${radius}}`);
    return `${scope}[data-bkm-status="loading"] .ts-chart-host{pointer-events:none}${readyGateCss(scope, true)}${focusEmptyHiddenCss(scope)}${dim}${corners}`;
  }, [scope, built.hover, tickPositions, hasSeries, horizontal, tickerHalfWidth]);
  // The effect re-runs on a status flip (bklit bar-chart.tsx:372-386): loading holds the skeleton (no reveal, no interaction, the host
  // is pointer-events:none below), the flip to ready restarts the reveal and the timer.
  useEffect(() => {
    if (parentSized && !loading) { armReady(); }
  }, [parentSized, loading, armReady]);
  // The bars' entrance clock restarts with each reveal.
  useEffect(() => {
    if (loading) { clock.at = null; }
  }, [loading, clock]);
  // Mirror the hovered category and legend series onto the host imperatively (no render, no rebuild).
  useEffect(() => {
    const host = containerRef.current;
    if (!host) { return undefined; }
    // Pointer moves inside one category re-emit the same focus: nothing to write then, so a crossing is the only style invalidation.
    // `data-hover` alone selects the dim, the tick label and the pill's tick (positions are looked up in the stylesheet).
    let applied = Number.NaN;
    const apply = (): void => {
      const f = focusStore.get();
      const index = f === null ? -1 : f.index;
      if (index === applied) { return; }
      applied = index;
      if (f === null) {
        clearAttribute(host, HOVER_ON_ATTR);
        writePillRollIn(host, null, -1);
        writeHoverIndex(host, null);
        clearVar(host, FOCUS_X_VAR);
        return;
      }
      if (!host.hasAttribute(HOVER_ON_ATTR)) {
        writePillRollIn(host, pill, index);
        raiseAttribute(host, HOVER_ON_ATTR);
      }
      writeHoverIndex(host, index >= MAX_INDEX ? null : index);
      if (horizontal) { clearVar(host, FOCUS_X_VAR); }
      else { writeVar(host, FOCUS_X_VAR, ((barScale(categories[index] ?? "") ?? 0) + barScale.bandwidth() / 2 + resolvedMargin.left).toFixed(2)); }
    };
    apply();
    return focusStore.subscribe(apply);
  }, [focusStore, pill, horizontal, barScale, categories, resolvedMargin.left]);
  // Keyboard-held focus survives a pointer pass (kit/keyboard-hold.ts).
  const holdFocus = useKeyboardFocusHold(containerRef, () => barInteraction.current);
  const onFocusChange = useCallback(
    (point: { datum: unknown } | null) => {
      holdFocus(erase(point));
      // SAFETY: every datum of this chart is a BarDatum ({ index, source }), set by buildBarData.
      const datum = point?.datum as { index: number; source: Row } | undefined;
      focusStore.set(datum ? { row: datum.source, index: datum.index } : null);
    },
    [focusStore, holdFocus],
  );
  const barTooltipRef = useRef(tooltipOptions);
  barTooltipRef.current = tooltipOptions;
  const renderTooltipBody = useCallback(
    ({ points }: { points: never }) => <BarTooltipBody points={points} options={barTooltipRef.current} />,
    [],
  );
  return (
    <div
      ref={containerRef}
      className={className}
      data-bkm-chart="bar"
      data-bkm-bar={uid}
      data-bkm-status={loading ? "loading" : undefined}
      data-legend={legendHovered !== null && legendHovered < MAX_INDEX ? legendHovered : undefined}
      {...built.gridAttrs}
      data-slot="chart"
      // bklit's outer div carries `style={{ aspectRatio }}` from its first render (bar-chart.tsx:696-700); only the svg waits for the layout-effect mount.
      style={{ width: "100%", position: "relative", aspectRatio, ...bklitSurfaceStyle, ...style }}
    >
      {parentSized && childrenReady ? (
        <RendererChart
          idPrefix={uid}
          definition={erase(built.definition)}
          renderer={renderer}
          aspectRatio={fillHeight ? undefined : parseAspectRatio(aspectRatio)}
          style={fillHeight ? FILL_HOST_STYLE : undefined}
          ariaLabel={props.ariaLabel ?? "Bar chart"}
          ariaDescription={props.ariaDescription}
          onFocusChange={onFocusChange}
          onRender={erase(onBarRender)}
          renderTooltipBody={erase(renderTooltipBody)}
          tooltipEqual={sameCategoryTarget}
        />
      ) : null}
      {parentSized && loading ? (
        // bklit renders the skeleton inside the margin-translated group, in place of the bars (bar-chart.tsx:654-660; barCount = data.length || 12, :54-55).
        // No native mark paints a masked shimmer, so the skeleton is bklit's own svg laid over the plot rect.
        <svg aria-hidden="true" height={innerHeight} style={skeletonStyle} width={innerWidth}>
          <BarLoadingSkeleton barCount={data.length > 0 ? data.length : FALLBACK_LOADING_BARS} innerHeight={innerHeight} innerWidth={innerWidth} />
        </svg>
      ) : null}
      {staticCss ? <style>{staticCss}</style> : null}
      <FocusLayer store={focusStore} useContextValue={useContextValue}>
        <BarDepthConfigProvider value={depthConfig}>{custom}</BarDepthConfigProvider>
      </FocusLayer>
    </div>
  );
};

export type { BarChartProps, BarOrientation };
export { BarChart };
