"use client";
// Bklit BarChart on native TanStack Charts: compound children are read into one
// `defineChart` definition (bar); the `motion()` renderer plays the entrance.
import { erase } from "./kit/erased-types";
import { useHydratingAttrs } from "./kit/use-hydrating";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { RendererChart, sameCategoryTarget } from "./kit/tooltip/tooltip-leaf";
import { useInteractionHandle, useTouchInert } from "./kit/touch-focus";
import { useReadyGate } from "./kit/entrance/reveal-arm";
import { motion } from "@tanstack/charts/motion";
import { buildBarDefinition } from "./bar/definition";
import { useDataUpdated } from "./kit/use-data-updated";
import { useChildTable } from "./kit/stable-children";
import { readBarChildren } from "./bar/read-children";
import { hasDepth } from "./bar/depth-feature";
import { resolveBarSeries } from "./bar/model";
import { BarSizedLayer } from "./bar/sized-layer";
import { useFocusStore } from "./kit/cartesian/focus-layer";
import { scaleBand } from "d3-scale";
import type { BarDepthProviderProps, BarXAxisProps } from "./bar/carriers";
import { barDimCss, FOCUS_X_VAR, MAX_INDEX } from "./bar/hover";
import type { TickFade } from "./bar/hover";
import type { Row } from "./bar/model";
import { BarTooltipBody } from "./bar/tooltip";
import { bklitSurfaceStyle, DEFAULT_ANIMATION_MS, DEFAULT_MARGIN, parseAspectRatio } from "./kit/theme";
import type { ChartMargin } from "./kit/theme";
import { HoverOverlay } from "./kit/cartesian/hover-overlay";
import { useChartLegendHover } from "./kit/legend/legend";
import type { ChartPhase, ChartStatus, Transition } from "./kit/motion/phase";
import type { FocusedRow } from "./kit/cartesian/context-bridge";
import { propsFor } from "./kit/read-children";
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

/** Direction the bars grow: `"vertical"` (columns) or `"horizontal"` (rows). */
type BarOrientation = "vertical" | "horizontal";

/** Props of {@link BarChart}. */
interface BarChartProps {
  /**
   * The rows to plot. Each row holds a category label under `xDataKey` and one number per series under that series' `dataKey`.
   */
  data: Row[];
  /**
   * Key of the category label in each row.
   * @default "name"
   */
  xDataKey?: string;
  /**
   * Duration of the entrance in milliseconds. Bars are staggered across 40% of this duration.
   * @default 1100
   */
  animationDuration?: number;
  // Accepted divergence: typed as bklit's but not read here (the entrance is fixed; square snapping follows <BarSquares> props).
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The entrance always uses the default reveal easing.
   */
  animationEasing?: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  enterTransition?: Transition;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  revealSignature?: string;
  /**
   * Space around the plot area in pixels, for axis labels and the tooltip. Missing sides use the default.
   * @default { top: 40, right: 40, bottom: 40, left: 40 }
   */
  margin?: Partial<ChartMargin>;
  /**
   * CSS aspect ratio of the chart, as `"width / height"`.
   * @default "2 / 1"
   */
  aspectRatio?: string;
  /** Extra CSS class name for the chart container. */
  className?: string;
  /**
   * Inline styles for the chart container. Set `aspectRatio: "unset"` to let the chart fill the height of its parent.
   */
  style?: CSSProperties;
  /**
   * Gap between bar groups as a fraction of the band width (0 to 1).
   * @default 0.2
   */
  barGap?: number;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Bars always fill their band; use `barGap` to change their width.
   */
  barWidth?: number;
  /**
   * Direction the bars grow. `"horizontal"` puts the categories on the y axis.
   * @default "vertical"
   */
  orientation?: BarOrientation;
  /**
   * Stack the series on top of each other instead of grouping them side by side.
   * @default false
   */
  stacked?: boolean;
  /**
   * Gap between stacked segments in px.
   * @default 0
   */
  stackGap?: number;
  /**
   * Snap the tooltip dots of grouped vertical bars onto the centre of the top square of a `squareGap` column (`fit` redistributes the gap); `groupGap` sets the ring dot's slot gap.
   */
  squareSnap?: { squareGap: number; groupGap?: number; fit?: boolean };
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The bar chart does not report phases.
   */
  onPhaseChange?: (phase: ChartPhase) => void;
  /**
   * The layers to draw: `Bar`, `BarSquares`, `Grid`, `BarXAxis`, `BarYAxis`, `ChartTooltip` and the other chart children. Optional for a `status="loading"` skeleton.
   */
  children?: ReactNode;
  /**
   * Accessible name of the chart.
   * @default "Bar chart"
   */
  ariaLabel?: string;
  /** Longer accessible description of the chart, exposed as `aria-description`. */
  ariaDescription?: string;
  /**
   * `"loading"` replaces the bars with a shimmering skeleton and ignores the pointer; switching to `"ready"` grows the real bars.
   * @default "ready"
   */
  status?: ChartStatus;
}

/**
 * Bar chart over categories, grouped or stacked, vertical or horizontal. Compose it from children: `Bar` (or `BarSquares`), `Grid`, `BarXAxis`, `BarYAxis`, `ChartTooltip`.
 * Bars grow in with a stagger; hover and keyboard focus pick a category and show the tooltip.
 */
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
    squareSnap: squareSnapProp,
    children,
    status = "ready",
  } = props;
  // Keyed on its values so an inline `squareSnap` object does not rebuild the definition every render.
  const snapGap = squareSnapProp?.squareGap;
  const snapGroupGap = squareSnapProp?.groupGap;
  const snapFit = squareSnapProp?.fit;
  const squareSnap = useMemo(
    () => (snapGap === undefined ? undefined : { squareGap: snapGap, groupGap: snapGroupGap, fit: snapFit }),
    [snapGap, snapGroupGap, snapFit],
  );
  const loading = status === "loading";
  const legendHovered = useChartLegendHover().hoveredIndex;
  const containerRef = useRef<HTMLDivElement | null>(null);
  useTouchInert(containerRef);
  const fillHeight = style?.aspectRatio === "unset";
  // Hover lives in a ref store read only by <FocusLayer>: no re-render / rebuild of the chart on focus.
  const focusStore = useFocusStore<FocusedRow>();
  // The hover indicator (rule, dots, date pill) is an element we own, appended to the host and moved imperatively (kit/cartesian/hover-overlay.ts).
  const overlayRef = useRef<HoverOverlay | null>(null);
  overlayRef.current ??= new HoverOverlay();
  const overlay = overlayRef.current;
  useLayoutEffect(() => {
    containerRef.current?.append(overlay.root);
    return () => { overlay.root.remove(); };
  }, [overlay]);
  // Custom marks (squares, depth) only animate enter when they join a painted scene, so charts that have them
  // paint a seeded first build, then one `entered` flip builds the full definition and the update tweens it in.
  const [entered, setEntered] = useState(false);
  const clock = useRef<{ at: number | null }>({ at: null }).current;
  const uid = `b${useSanitizedId()}`;
  const hydratingAttrs = useHydratingAttrs();
  // Legend hover re-renders the host with fresh `children`; keep the previous table while every carrier is structurally equal.
  const { table, custom, ready: childrenReady } = useChildTable(children, readBarChildren);
  const series = useMemo(() => resolveBarSeries(table), [table]);
  const needsSeed = useMemo(() => series.some((s) => s.squares) || hasDepth(table), [series, table]);
  const seed = needsSeed && !entered;
  useEffect(() => {
    if (needsSeed) { setEntered(true); }
  }, [needsSeed]);
  const resolvedMargin = useMemo(() => ({ ...DEFAULT_MARGIN, ...margin }), [margin]);
  // The plot rect comes from each scene render (`scene.chart`), so hover reads it without measuring the host.
  const plotRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
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
        squareSnap,
        seed,
        clock,
        updated,
        plot,
        loading,
      }),
    [loading, seed, clock, data, xDataKey, table, series, resolvedMargin, barGap, animationDuration, uid, orientation, stacked, stackGap, squareSnap, plot, updated],
  );
  const renderer = useMemo(
    // `initial: "always"` replays the entrance on hydrated (server-rendered) SVG too.
    () => motion({ initial: "always", transition: { type: "tween", duration: animationDuration } }),
    [animationDuration],
  );
  const horizontal = orientation === "horizontal";
  const categoryOf = useCallback((d: Row): string => String(d[xDataKey]), [xDataKey]);
  const categories = useMemo(() => data.map(categoryOf), [data, categoryOf]);
  const { interaction: barInteraction, onRender: onBarRender } = useInteractionHandle();
  // The overlay is rebuilt only when the model or the plot rect changes: a draw that moved nothing (an entrance frame) leaves it alone.
  const placed = useRef<{ model: unknown; key: string }>({ key: "", model: null });
  const onRender = useCallback(
    (context: Parameters<typeof onBarRender>[0]): void => {
      onBarRender(context);
      const { chart } = context.scene;
      plotRef.current = { left: chart.x, top: chart.y, width: chart.width, height: chart.height };
      const key = `${chart.x},${chart.y},${chart.width},${chart.height}`;
      if (placed.current.model !== built.overlay || placed.current.key !== key) {
        placed.current = { key, model: built.overlay };
        const value = built.valueDomain;
        overlay.update(
          built.overlay,
          { height: chart.y + chart.height + resolvedMargin.bottom, innerWidth: chart.width, innerHeight: chart.height, xDomain: [0, 1], yDomains: horizontal ? {} : { y: value } },
          resolvedMargin,
        );
      }
    },
    [onBarRender, built, overlay, resolvedMargin, horizontal],
  );
  // bklit `canInteract = isLoaded` (bar-chart.tsx:549), set by a setTimeout at animationDuration + staggerMs, staggerMs =
  // data.length > 1 ? animationDuration * 0.4 : 0 (bklit bar-chart.tsx:381-384): hover is inert until then. Armed on the ParentSize commit.
  const { arm: armReady, store: readyStore } = useReadyGate(containerRef, animationDuration + (data.length > 1 ? animationDuration * 0.4 : 0));
  const tooltipOptions = useMemo(
    () => ({ order: series.map((s) => s.key), colors: Object.fromEntries(series.map((s) => [s.key, s.fill])), horizontal: orientation === "horizontal" }),
    [series, orientation],
  );
  // The focus-guide pill replaces the focused category's tick label (bklit). Hidden by CSS keyed on the focus
  // so hovering never re-resolves the definition (a rebuild defers state paint ~150ms behind data motion).
  const hasSeries = series.length > 0;
  const scope = `[data-bkm-bar="${uid}"]`;
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
    return `${scope}[data-bkm-status="loading"] .ts-chart-host{pointer-events:none}${readyGateCss(scope, true)}${scope}:not([data-bkm-ready]) .bkm-hov{visibility:hidden}${focusEmptyHiddenCss(scope)}${dim}${corners}`;
  }, [scope, built.hover, tickPositions, hasSeries, horizontal, tickerHalfWidth]);
  // The effect re-runs on a status flip (bklit bar-chart.tsx:372-386): loading holds the skeleton (no reveal, no interaction, the host
  // is pointer-events:none below), the flip to ready restarts the reveal and the timer.
  useEffect(() => {
    if (!loading) { armReady(); }
  }, [loading, armReady]);
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
        overlay.focus(null, null);
        writeHoverIndex(host, null);
        clearVar(host, FOCUS_X_VAR);
        return;
      }
      overlay.focus(index, f.row);
      if (!host.hasAttribute(HOVER_ON_ATTR)) {
        raiseAttribute(host, HOVER_ON_ATTR);
      }
      writeHoverIndex(host, index >= MAX_INDEX ? null : index);
      if (horizontal) { clearVar(host, FOCUS_X_VAR); }
      else {
        const band = scaleBand().domain(categories).range([0, plotRef.current.width]).padding(barGap);
        writeVar(host, FOCUS_X_VAR, ((band(categories[index] ?? "") ?? 0) + band.bandwidth() / 2 + resolvedMargin.left).toFixed(2));
      }
    };
    apply();
    return focusStore.subscribe(apply);
  }, [focusStore, overlay, horizontal, categories, barGap, resolvedMargin.left]);
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
  // Entrance starts on the first draw, without bklit's ParentSize frames (bar-chart.tsx:701), at the user's direction (no frame waits); the curve is unchanged.
  return (
    <div
      ref={containerRef}
      className={className}
      data-bkm-chart="bar"
      {...hydratingAttrs}
      data-bkm-bar={uid}
      data-bkm-status={loading ? "loading" : undefined}
      data-legend={legendHovered !== null && legendHovered < MAX_INDEX ? legendHovered : undefined}
      {...built.gridAttrs}
      data-slot="chart"
      // bklit's outer div carries `style={{ aspectRatio }}` from its first render (bar-chart.tsx:696-700); only the svg waits for the layout-effect mount.
      style={{ width: "100%", position: "relative", aspectRatio, ...bklitSurfaceStyle, ...style }}
    >
      {childrenReady ? (
        <RendererChart
          idPrefix={uid}
          definition={erase(built.definition)}
          renderer={renderer}
          aspectRatio={fillHeight ? undefined : parseAspectRatio(aspectRatio)}
          style={fillHeight ? FILL_HOST_STYLE : undefined}
          ariaLabel={props.ariaLabel ?? "Bar chart"}
          ariaDescription={props.ariaDescription}
          onFocusChange={onFocusChange}
          onRender={erase(onRender)}
          renderTooltipBody={erase(renderTooltipBody)}
          tooltipEqual={sameCategoryTarget}
        />
      ) : null}
      {staticCss ? <style>{staticCss}</style> : null}
      {loading || custom.length > 0 ? (
        <BarSizedLayer
          host={containerRef}
          data={data}
          xDataKey={xDataKey}
          orientation={orientation}
          stacked={stacked}
          barGap={barGap}
          series={series}
          valueDomain={built.valueDomain}
          resolvedMargin={resolvedMargin}
          animationDuration={animationDuration}
          table={table}
          barInteraction={barInteraction}
          readyStore={readyStore}
          focusStore={focusStore}
          depthConfig={depthConfig}
          custom={custom}
          loading={loading}
        />
      ) : null}
    </div>
  );
};

export type { BarChartProps, BarOrientation };
export { BarChart };
