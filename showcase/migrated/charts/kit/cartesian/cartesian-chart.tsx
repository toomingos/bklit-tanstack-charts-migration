// Shared shell for LineChart / AreaChart: children -> series -> one native
// definition -> RendererChart with the native `motion()` entrance.
import { RevealArm, useReadyGate } from "../entrance/reveal-arm";
import { useHydratingAttrs } from "../use-hydrating";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { RendererChart } from "../tooltip/tooltip-leaf";
import { buildCartesianDefinition, gridAttrsOf, hasHighlight } from "./definition";
import { useDataUpdateStep } from "./use-data-update-step";
import type { CartesianInput } from "./definition";
import type { CartesianSpec } from "./input";
import { LegendHostSync, useHoverHostSync } from "./hover-host";
import { type DragGeom, useDragSelect } from "./drag-select";
import { clearAttribute } from "../host-write";
import { useKeyboardFocusHold } from "../keyboard-hold";
import { toDate } from "./series";
import type { Row } from "./series";
import { DEFAULT_ANIMATION_MS, DEFAULT_MARGIN, parseAspectRatio } from "../theme";
import type { ChartMargin } from "../theme";
import type { ChartStatus } from "../types";
import { LoadingLabel } from "../loading-label";
import { propsFor } from "../read-children";
import { loadingHostAttrs, loadingHostStyle } from "./loading";
import { loadingFlags, loadingWipe, useLoadingPhase, useRevealedFromConcealed, yDomainsTween } from "./loading-phase";
import { useSkeletonData } from "./loading-data";
import { LoadingSweepOverlays } from "./loading-sweep-overlays";
import { useSanitizedId } from "../use-sanitized-id";
import { useStaticChartPreview } from "./chart-config";
import { HoverOverlay, overlayPlotOf } from "./hover-overlay";
import { FocusLayer, useFocusStore } from "./focus-layer";
import { erase } from "../erased-types";
import type { AnyPoint } from "../erased-types";
import { contextValueHook, useRendererTooltip, useSeriesTable } from "./cartesian-hooks";
import type { CartesianFocus } from "./cartesian-hooks";
import { cartesianHostStyle, cartesianStaticCss, writeSizeVars } from "./host-style";
import { createPlotStore, usePlotSnapshot } from "./plot-size";
import type { PlotSnapshot, PlotStore } from "./plot-size";
import { getBackgroundResources, getOverlayResources } from "./features";
import { HighlightBandClip } from "./band-clip";
import { useBrush } from "./use-brush";

interface CartesianChartProps {
  readonly data: readonly Row[];
  readonly xDataKey?: string;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string | number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly xDomain?: [Date, Date];
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
  readonly children?: ReactNode;
  readonly onFocusChange?: (row: Row | null) => void;
  readonly extra?: Partial<
    Pick<CartesianInput, "extraMarks" | "extraXValues" | "extraYValues" | "extraGradients">
  >;
  readonly defs?: ReactNode;
  readonly defaultAriaLabel: string;
  /** `"loading"`: series pulse instead of drawing, the grid takes its loading look, the host is inert (bklit chart phase "loading"). */
  readonly status?: ChartStatus;
  /** Centered shimmer label while loading. */
  readonly loadingLabel?: string;
  /** Animate the y domain on the loading -> ready transition. Default: true. */
  readonly yDomainTween?: boolean;
  /** Full dataset length while brush-zoomed: the slot count behind `columnWidth`. */
  readonly xDomainSlotCount?: number;
}

const NONE: never[] = [];
const WIPE_IN_ATTR = "data-bkm-wipe-in";
const FILL_HEIGHT_STYLE: CSSProperties = { height: "100%" };

/** bklit ChartBrushTrackOverlay: the strip outside the selection is blurred, faded out toward the outer ends. Static (not hover). Mounts with the size the draw published. */
const BrushPanes = ({ fade, store }: Readonly<{ fade: boolean; store: PlotStore }>): ReactElement | null => {
  const snapshot = usePlotSnapshot(store);
  if (!snapshot || snapshot.size.innerWidth <= 0 || snapshot.built.domains.x[1].getTime() <= snapshot.built.domains.x[0].getTime()) {
    return null;
  }
  return (
    <>
      <div aria-hidden="true" className="bkm-brush-pane" data-edge="left" data-fade={fade ? "" : undefined} />
      <div aria-hidden="true" className="bkm-brush-pane" data-edge="right" data-fade={fade ? "" : undefined} />
    </>
  );
};

// One React commit: the definition's `chart({ width, height })` runs inside TanStack's draw (a layout effect before paint) and builds everything that depends on the size, so no measure or
// size state sits before the first draw. bklit waits on ParentSize first (line-chart.tsx:265, area-chart.tsx:234: ResizeObserver -> rAF); the migrated chart does not. <RevealArm> counts from the mount.
export function CartesianChart(props: Readonly<CartesianChartProps>): ReactElement {
  const {
    data: targetData,
    xDataKey = "date",
    animationDuration: animationDurationProp = DEFAULT_ANIMATION_MS,
    margin,
    aspectRatio = "2 / 1",
    className,
    style,
    xDomain,
    xDomainSlotCount,
    children,
    extra,
    defs,
    status = "ready",
  } = props;
  const animationDuration = useStaticChartPreview() ? 0 : animationDurationProp;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const sweepRef = useRef(false);
  // Whether the latest build's y domains move enough to tween (assigned from each draw; read when a tween phase starts).
  const yTweenRef = useRef(false);
  const { phase, onAnimationEvent } = useLoadingPhase(status, { sweep: sweepRef, yTween: yTweenRef, yDomainTween: props.yDomainTween !== false, animationDuration, host: containerRef });
  // chartLoading drives the loading chrome (pulse, shimmer, label); swap / tween / concealing hold the series concealed.
  const { chartLoading, skeletonRows, gridLoading } = loadingFlags(phase);
  const fillHeight = style?.aspectRatio === "unset";
  // Hover lives in a ref store read only by <FocusLayer> (no re-render / rebuild of this component on focus).
  const focusStore = useFocusStore<CartesianFocus>();
  const onFocusChangeProp = props.onFocusChange;
  // Focus lives on the host, not in React state or a regenerated <style> (see hover-host.tsx).
  const { geom: hostGeom, sync: syncHost, drag: dragHost, press: pressHost } = useHoverHostSync(containerRef);
  // Keyboard-held focus survives a pointer pass (kit/keyboard-hold.ts); the hook is armed below, after the interaction handle exists.
  const holdFocusRef = useRef<((point: AnyPoint) => void) | null>(null);
  const rowIndexRef = useRef(new Map<Row, number>());
  // The hover indicator (crosshair, dots, date pill) is an element we own, appended to the host and moved imperatively (hover-overlay.ts).
  const overlayRef = useRef<HoverOverlay | null>(null);
  overlayRef.current ??= new HoverOverlay();
  const overlay = overlayRef.current;
  const onFocusChange = useCallback(
    (point: { xValue: unknown; datum: unknown; datumIndex: number } | null) => {
      holdFocusRef.current?.(erase(point));
      const time = point ? toDate(point.xValue).getTime() : null;
      // SAFETY: every datum of this chart is a Row of its data prop.
      const row = point ? (point.datum as Row) : undefined;
      // A decimated chart's datumIndex counts the drawn rows; the context indexes `data`.
      focusStore.set(point && row && time !== null ? { row, index: rowIndexRef.current.get(row) ?? point.datumIndex, time } : null);
      syncHost(time);
      overlay.focus(time, row ?? null);
      onFocusChangeProp?.(row ?? null);
    },
    [focusStore, onFocusChangeProp, syncHost, overlay],
  );
  // bklit's drag selection (use-chart-interaction, kit/cartesian/drag-select.ts): raw plot-space pixels, not snapped to data.
  const [selection, setSelection] = useState<{ startX: number; endX: number } | null>(null);
  // Latest plot geometry for the drag listeners (assigned by each draw).
  const dragGeom = useRef<DragGeom>({ left: 0, top: 0, innerWidth: 0, innerHeight: 0 });
  const uid = `c${useSanitizedId()}`;
  const hydratingAttrs = useHydratingAttrs();
  const { table, hasMarkers, series, onPulseIteration, custom, childrenReady, times } = useSeriesTable(children, targetData, xDataKey, containerRef, chartLoading);
  sweepRef.current = series.some((s) => s.loading?.style === "sweep");
  const data = useSkeletonData(skeletonRows, targetData, series);
  rowIndexRef.current = useMemo(() => new Map(data.map((row, i) => [row, i] as const)), [data]);
  const loadingGrid = chartLoading ? propsFor<{ shimmer?: boolean; shimmerSpeed?: number }>(table, "grid")[0] : undefined;
  const { clear: clearSelection, interaction: dragInteraction, onRender: onDragRender } = useDragSelect(
    containerRef,
    dragGeom,
    { drag: dragHost, press: pressHost },
    (edges) => { setSelection((prev) => (prev?.startX === edges?.startX && prev?.endX === edges?.endX ? prev : edges)); },
  );
  const onAnimationIteration = useCallback((event: { animationName: string; timeStamp: number }): void => {
    onAnimationEvent(event);
    onPulseIteration(event);
  }, [onAnimationEvent, onPulseIteration]);
  holdFocusRef.current = useKeyboardFocusHold(containerRef, () => dragInteraction.current);
  const { arm: gateArm, store: readyStore } = useReadyGate(containerRef, animationDuration);
  useRevealedFromConcealed(phase, gateArm);
  // First-mount entrance (status "ready"): the wipe groups play the CSS `bkm-wipe-*` keyframes from the first draw (styles.css); a later loading -> ready reveal is the native `wipe-` tween.
  const [wipeIn] = useState(status !== "loading" && animationDuration > 0);
  useEffect(() => { if (phase !== "ready") { clearAttribute(containerRef.current, WIPE_IN_ATTR); } }, [phase]);
  const onWipeEnd = useCallback((event: { animationName: string }): void => {
    if (event.animationName === "bkm-wipe-o") { clearAttribute(containerRef.current, WIPE_IN_ATTR); }
  }, []);
  const { brushProps, brush, brushCollapsed, shownRange, bindChange } = useBrush({ table, children, data, xDataKey });
  const marginKey = JSON.stringify(margin ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolvedMargin = useMemo(() => ({ ...DEFAULT_MARGIN, ...margin }), [marginKey]);
  const plotRef = useRef<PlotStore | null>(null);
  plotRef.current ??= createPlotStore();
  const plot = plotRef.current;
  bindChange(plot.get);
  const { p: wipeP, ms: wipeMs, conceal: wipeConceal } = loadingWipe(phase, 1, animationDuration);
  // The conceal window runs past the plot by the left margin its fixed clip carries (wipe.ts), so the last data is gone at the end; it depends on the plot, so the draw resolves it.
  const wipe = useMemo(() => ({ ms: wipeMs, progress: (size: { readonly innerWidth: number }): number => (wipeConceal ? 2 + resolvedMargin.left / Math.max(1, size.innerWidth) : wipeP) }), [wipeMs, wipeP, wipeConceal, resolvedMargin.left]);
  const update = useDataUpdateStep(data, [xDataKey, table, series, resolvedMargin, uid, animationDuration, extra, brush], xDomain);
  const settleRef = useRef(update.settle);
  settleRef.current = update.settle;
  const hasBrush = brushProps !== undefined;
  const brushVars = brush ? { shownStart: shownRange.start.getTime(), shownEnd: shownRange.end.getTime(), blurPx: brushProps?.blurPx } : undefined;
  // What a draw hands back to the host: static css, host vars and the lazy geometry hover and drag read. Latest render's inputs (assigned each render, run from `chart`).
  const publishRef = useRef<(snapshot: PlotSnapshot) => void>(() => undefined);
  publishRef.current = (snapshot) => {
    const { built, size } = snapshot;
    plot.set(snapshot);
    overlay.update(built.overlay, overlayPlotOf(snapshot), resolvedMargin);
    yTweenRef.current = yDomainsTween(built.domains.y, built.targetY);
    const xStart = built.domains.x[0].getTime();
    hostGeom.current = { times: built.hover.times, left: resolvedMargin.left, xStart, xSpan: built.domains.x[1].getTime() - xStart, innerWidth: size.innerWidth, signs: built.hover.plSigns, hasBand: built.hover.highlights.length > 0 || built.hover.segmentLeft !== null, pillTicks: built.pillTicks.active ? built.pillTicks.times : undefined };
    dragGeom.current = { left: resolvedMargin.left, top: resolvedMargin.top, innerWidth: size.innerWidth, innerHeight: Math.max(0, size.innerHeight) };
    writeHostRef.current(snapshot);
  };
  // The first draw can run before the host refs attach; the layout effect below re-writes once they exist.
  const writeHostRef = useRef<(snapshot: PlotSnapshot) => void>(() => undefined);
  writeHostRef.current = (snapshot) => {
    const host = containerRef.current;
    const sheet = styleRef.current;
    if (!host || !sheet) { return; }
    const css = cartesianStaticCss(uid, snapshot.built, hasBrush, series);
    if (sheet.textContent !== css) { sheet.textContent = css; }
    writeSizeVars(host, snapshot, resolvedMargin, brushVars);
  };
  const onBuilt = useCallback((snapshot: PlotSnapshot): void => { publishRef.current(snapshot); }, []);
  // On mount (refs now attached) and on a brush gesture, which moves the shown range without a draw.
  const brushStart = brushVars?.shownStart;
  const brushEnd = brushVars?.shownEnd;
  const brushBlur = brushVars?.blurPx;
  useLayoutEffect(() => {
    containerRef.current?.append(overlay.root);
    return () => { overlay.root.remove(); };
  }, [overlay]);
  useLayoutEffect(() => {
    const snapshot = plot.get();
    if (snapshot) { writeHostRef.current(snapshot); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- brushVars is rebuilt from these three every render.
  }, [plot, resolvedMargin, brushStart, brushEnd, brushBlur, hasBrush]);
  const spec = useMemo<CartesianSpec>(
    () => ({
      updateStep: update.step,
      yDomainFrom: update.from,
      data,
      xKey: xDataKey,
      table,
      series,
      margin: resolvedMargin,
      xDomain,
      uid,
      chartLoading: gridLoading,
      animationDuration,
      extraMarks: extra?.extraMarks ?? NONE,
      extraXValues: extra?.extraXValues ?? NONE,
      extraYValues: extra?.extraYValues ?? NONE,
      extraGradients: extra?.extraGradients ?? NONE,
      renderTooltipEnabled: true,
      brush,
      wipe,
    }),
    [data, xDataKey, table, series, resolvedMargin, xDomain, uid, gridLoading, animationDuration, extra, brush, update.step, update.from, wipe],
  );
  const definition = useMemo(() => buildCartesianDefinition(spec, onBuilt), [spec, onBuilt]);
  const { renderer, renderTooltipBody } = useRendererTooltip({ animationDuration, table, data, series });
  // Reported after each draw: the data-update step ends its snap / glide from the domains the draw built.
  const onRender = useCallback((context: Parameters<typeof onDragRender>[0]): void => {
    onDragRender(context);
    const snapshot = plot.get();
    if (snapshot) { settleRef.current(snapshot.built); }
  }, [onDragRender, plot]);
  const useContextValue = contextValueHook({
    store: plot, series, data, xDataKey, table, containerRef, ready: readyStore, dragInteraction, resolvedMargin, animationDuration, xDomain, xDomainSlotCount, selection, times, clearSelection,
  });
  const BackgroundResources = getBackgroundResources();
  const OverlayResources = getOverlayResources();
  return (
    <div
      ref={containerRef}
      className={className}
      data-bkm-kit={uid}
      {...hydratingAttrs}
      onAnimationStart={onAnimationEvent}
      onAnimationEnd={onWipeEnd}
      data-bkm-wipe-in={wipeIn ? "" : undefined}
      onAnimationIteration={onAnimationIteration}
      {...gridAttrsOf(table, gridLoading)}
      data-bkm-clip={xDomain === undefined ? undefined : ""}
      {...(chartLoading ? loadingHostAttrs(loadingGrid) : null)}
      data-bkm-evt={hasMarkers ? "" : undefined}
      data-bkm-brushreset={brush && brushCollapsed ? "" : undefined}
      style={cartesianHostStyle({
        animationDuration,
        margin: resolvedMargin,
        clipped: xDomain !== undefined,
        style: phase === "ready" ? style : loadingHostStyle(style, loadingGrid),
      })}
    >
      {defs}
      {BackgroundResources ? <BackgroundResources table={table} uid={uid} /> : null}
      {OverlayResources ? <OverlayResources table={table} uid={uid} margin={resolvedMargin} /> : null}
      {hasHighlight(table, series) ? <HighlightBandClip id={`${uid}-hlband`} /> : null}
      <style ref={styleRef} />
      <LegendHostSync hostRef={containerRef} />
      <RevealArm hostRef={containerRef} onArm={gateArm} />
      {childrenReady && (
      <RendererChart
        definition={erase(definition)}
        idPrefix={uid}
        renderer={renderer}
        aspectRatio={fillHeight ? undefined : parseAspectRatio(aspectRatio)}
        style={fillHeight ? FILL_HEIGHT_STYLE : undefined}
        ariaLabel={props.ariaLabel ?? (brush ? "Range selector (drag to select a range)" : props.defaultAriaLabel)}
        ariaDescription={props.ariaDescription}
        // The brush strip is pointer-only (TanStack's brush keyboard needs discrete values, which would snap the pointer range).
        tabIndex={brush ? -1 : undefined}
        onFocusChange={onFocusChange}
        onRender={erase(onRender)}
        renderTooltipBody={erase(renderTooltipBody)}
      />
      )}
      {chartLoading ? <LoadingSweepOverlays series={series} exiting={phase === "exiting"} margin={resolvedMargin} store={plot} /> : null}
      {phase === "ready" || phase === "concealing" || phase === "tweenLoading" ? null : <LoadingLabel text={props.loadingLabel ?? ""} exiting={phase !== "loading"} />}
      {brush ? <BrushPanes fade={brushProps?.fadeOuterEdges !== false} store={plot} /> : null}
      <FocusLayer store={focusStore} useContextValue={useContextValue}>
        {custom}
      </FocusLayer>
    </div>
  );
}
