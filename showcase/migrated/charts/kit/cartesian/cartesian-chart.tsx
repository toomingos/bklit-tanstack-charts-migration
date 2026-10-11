// Shared shell for LineChart / AreaChart: children -> series -> one native
// definition -> RendererChart with the native `motion()` entrance.
import { RevealArm, useReadyGate } from "../entrance/reveal-arm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { RendererChart } from "../tooltip/tooltip-leaf";
import { useHostSize } from "../size/host-size";
import { useParentSizeMounted } from "../size/parent-size-arm";
import { buildCartesianDefinition } from "./definition";
import { useDataUpdateStep } from "./use-data-update-step";
import type { CartesianInput } from "./definition";
import { LegendHostSync, useHoverHostSync } from "./hover-host";
import { type DragGeom, useDragSelect } from "./drag-select";
import { useKeyboardFocusHold } from "./keyboard-hold";
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
import { pillLayoutOf } from "./date-pill";
import { FocusLayer, useFocusStore } from "./focus-layer";
import { erase } from "./erased-types";
import type { AnyPoint } from "./erased-types";
import { contextValueHook, useChartBase, useChartSelection, usePlotMeasure, useRendererTooltip, useSeriesTable } from "./cartesian-hooks";
import type { CartesianFocus } from "./cartesian-hooks";
import { cartesianHostStyle, cartesianStaticCss } from "./host-style";
import { BackgroundResources } from "./background-resources";
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


// The definition is width-keyed, so it is built once at the real width (host-size.ts), and the svg mounts on bklit's ParentSize commit: line-chart.tsx:265 / area-chart.tsx:234 wrap ChartInner in `<ParentSize debounceTime={10}>`
// (@visx/responsive useParentSize.js:37-63: ResizeObserver -> rAF -> leading debounce); useParentSizeMounted (parent-size-arm.tsx) waits on those events and <RevealArm> counts bklit's ready -> revealing commits from that mount.
export function CartesianChart(props: Readonly<CartesianChartProps>): ReactElement {
  const { ref, size } = useHostSize();
  const parentSized = useParentSizeMounted(ref, size !== null);
  if (!size || !parentSized) {
    // bklit's outer div carries the size from its first render (line-chart.tsx:221 default "2 / 1", :260 `aspectRatio` before `style`); only the svg waits.
    return <div ref={ref} className={props.className} style={{ width: "100%", position: "relative", aspectRatio: props.aspectRatio === undefined ? "2 / 1" : String(props.aspectRatio), ...props.style }}>{props.status === "loading" ? <LoadingLabel text={props.loadingLabel ?? ""} /> : null}</div>;
  }
  return <CartesianChartMounted {...props} initialWidth={Math.round(size.width)} initialHeight={Math.round(size.height)} />;
}

/** bklit ChartBrushTrackOverlay: the strip outside the selection is blurred, faded out toward the outer ends. Static (not hover). */
const BrushPanes = ({ fade }: Readonly<{ fade: boolean }>): ReactElement => (
  <>
    <div aria-hidden="true" className="bkm-brush-pane" data-edge="left" data-fade={fade ? "" : undefined} />
    <div aria-hidden="true" className="bkm-brush-pane" data-edge="right" data-fade={fade ? "" : undefined} />
  </>
);

function CartesianChartMounted(props: Readonly<CartesianChartProps & { initialWidth: number; initialHeight: number }>): ReactElement {
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
  const sweepRef = useRef(false);
  // Whether the latest build's y domains move enough to tween (assigned after the build below; read when a tween phase starts).
  const yTweenRef = useRef(false);
  const { phase, onAnimationEvent } = useLoadingPhase(status, { sweep: sweepRef, yTween: yTweenRef, yDomainTween: props.yDomainTween !== false, animationDuration, host: containerRef });
  // chartLoading drives the loading chrome (pulse, shimmer, label); swap / tween / concealing hold the series concealed.
  const { chartLoading, skeletonRows, gridLoading } = loadingFlags(phase);
  const fillHeight = style?.aspectRatio === "unset";
  const { fitHeight, plotWidth, measuredHeight, sized } = usePlotMeasure(containerRef, fillHeight, { width: props.initialWidth, height: props.initialHeight });
  // A fill-height chart draws once its host height is measured: a later height change is a resize, which snaps the wipe tween (`motion.resize` is off).
  // The host's height is produced by the chart itself, so observing it would re-key the definition
  // right after mount and cancel the entrance. Derive it from the width unless the host fills.
  const plotHeight = fillHeight ? measuredHeight : Math.round(plotWidth / parseAspectRatio(aspectRatio));
  // Hover lives in a ref store read only by <FocusLayer> (no re-render / rebuild of this component on focus).
  const focusStore = useFocusStore<CartesianFocus>();
  const onFocusChangeProp = props.onFocusChange;
  // Focus lives on the host, not in React state or a regenerated <style> (see hover-host.tsx).
  const { geom: hostGeom, sync: syncHost, drag: dragHost, press: pressHost } = useHoverHostSync(containerRef);
  // Keyboard-held focus survives a pointer pass (kit/cartesian/keyboard-hold.ts); the hook is armed below, after the interaction handle exists.
  const holdFocusRef = useRef<((point: AnyPoint) => void) | null>(null);
  const rowIndexRef = useRef(new Map<Row, number>());
  const onFocusChange = useCallback(
    (point: { xValue: unknown; datum: unknown; datumIndex: number } | null) => {
      holdFocusRef.current?.(erase(point));
      const time = point ? toDate(point.xValue).getTime() : null;
      // SAFETY: every datum of this chart is a Row of its data prop.
      const row = point ? (point.datum as Row) : undefined;
      // A decimated chart's datumIndex counts the drawn rows; the context indexes `data`.
      focusStore.set(point && row && time !== null ? { row, index: rowIndexRef.current.get(row) ?? point.datumIndex, time } : null);
      syncHost(time);
      onFocusChangeProp?.(row ?? null);
    },
    [focusStore, onFocusChangeProp, syncHost],
  );
  // bklit's drag selection (use-chart-interaction, kit/cartesian/drag-select.ts): raw plot-space pixels, not snapped to data.
  const [selection, setSelection] = useState<{ startX: number; endX: number } | null>(null);
  // Latest plot geometry for the drag listeners (assigned after the x scale below).
  const dragGeom = useRef<DragGeom>({ left: 0, top: 0, innerWidth: 0, innerHeight: 0 });
  const uid = `c${useSanitizedId()}`;
  const { table, hasMarkers, series, onPulseIteration, custom, childrenReady, times } = useSeriesTable(children, targetData, xDataKey, containerRef, chartLoading);
  sweepRef.current = series.some((s) => s.loading?.style === "sweep");
  const data = useSkeletonData(skeletonRows, targetData, series);
  rowIndexRef.current = useMemo(() => new Map(data.map((row, i) => [row, i] as const)), [data]);
  const loadingGrid = chartLoading ? propsFor<{ shimmer?: boolean; shimmerSpeed?: number }>(table, "grid")[0] : undefined;
  const { clear: clearSelection, interaction: dragInteraction, onRender } = useDragSelect(
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
  // Native line / area wipe progress (definition.ts wipeWrap): seeded closed, opened by RevealArm's arm so the keyed groups tween 0 -> 1.
  const [wipeStateP, setWipeP] = useState(animationDuration > 0 ? 0 : 1);
  useRevealedFromConcealed(phase, gateArm);
  const armedAt = useRef<number | null>(null);
  const onRevealArm = useCallback(() => {
    gateArm();
    armedAt.current = performance.now();
    setWipeP(1);
  }, [gateArm]);
  // The wipe render has committed (the tween resumed from the arm): later wipe renders start fresh.
  useEffect(() => { armedAt.current = null; }, [wipeStateP]);
  const { brushProps, brush, brushCollapsed, shownRange, bindChange } = useBrush({ table, children, data, xDataKey });
  const marginKey = JSON.stringify(margin ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolvedMargin = useMemo(() => ({ ...DEFAULT_MARGIN, ...margin }), [marginKey]);
  const plotInnerWidth = Math.max(0, plotWidth - resolvedMargin.left - resolvedMargin.right);
  // The conceal window runs past the plot by the left margin its fixed clip carries (wipe.ts), so the last data is gone at the end.
  const { p: wipeP, ms: wipeMs } = loadingWipe(phase, wipeStateP, animationDuration, 2 + resolvedMargin.left / Math.max(1, plotInnerWidth));
  const update = useDataUpdateStep(data, [xDataKey, table, series, resolvedMargin, uid, animationDuration, extra, brush, plotWidth, plotHeight], xDomain);
  const built = useMemo(
    () =>
      buildCartesianDefinition({
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
        plotWidth: plotInnerWidth,
        innerWidth: plotInnerWidth,
        plotHeight: plotHeight - resolvedMargin.top - resolvedMargin.bottom,
        wipe: { p: wipeP, ms: wipeMs, armedAt, w: Math.max(0, plotWidth - resolvedMargin.left - resolvedMargin.right), h: Math.max(0, plotHeight - resolvedMargin.top - resolvedMargin.bottom) },
      }),
    [data, xDataKey, table, series, resolvedMargin, xDomain, uid, gridLoading, animationDuration, extra, brush, plotWidth, plotInnerWidth, plotHeight, update.step, update.from, wipeP, wipeMs],
  );
  yTweenRef.current = yDomainsTween(built.domains.y, built.targetY);
  bindChange(built, plotWidth, resolvedMargin);
  const { renderer, renderTooltipBody } = useRendererTooltip({ built, settle: update.settle, animationDuration, table, data, series });
  const { stable, xScale, innerWidth, innerHeight, xAccessor, xStart, xEnd, setTooltipData } = useChartBase({
    built, series, data, xDataKey, table, containerRef, ready: readyStore, dragInteraction, plotWidth, plotHeight, resolvedMargin, animationDuration, xDomain, xDomainSlotCount,
  });
  dragGeom.current = { left: resolvedMargin.left, top: resolvedMargin.top, innerWidth, innerHeight };
  const chartSelection = useChartSelection(selection, xScale, times);
  const useContextValue = contextValueHook({ stable, xAccessor, setTooltipData, chartSelection, clearSelection });
  // The date pill replaces the tick labels under it and the hover dim / highlight run on the same fixed text: the host
  // attributes above carry the focus, so this string only changes with the definition.
  const xSpanMs = xEnd - xStart;
  hostGeom.current = { times: built.hover.times, left: resolvedMargin.left, xStart, xSpan: xSpanMs, innerWidth, signs: built.hover.plSigns, hasBand: built.hover.highlights.length > 0 || built.hover.segmentLeft !== null, pillTicks: built.pillTicks.active ? built.pillTicks.times : undefined, pillLayout: built.pillTicks.active ? pillLayoutOf(built.pillTicks.times) : null };
  const hasBrush = brushProps !== undefined;
  const staticCss = useMemo(() => cartesianStaticCss(uid, built, hasBrush, series), [uid, built, hasBrush, series]);
  return (
    <div
      ref={containerRef}
      className={className}
      data-bkm-kit={uid}
      onAnimationStart={onAnimationEvent}
      onAnimationIteration={onAnimationIteration}
      {...built.gridAttrs}
      data-bkm-clip={xDomain === undefined ? undefined : ""}
      {...(chartLoading ? loadingHostAttrs(loadingGrid) : null)}
      data-bkm-evt={hasMarkers ? "" : undefined}
      data-bkm-brushreset={brush && brushCollapsed ? "" : undefined}
      style={cartesianHostStyle({
        animationDuration,
        margin: resolvedMargin,
        innerWidth,
        innerHeight,
        xStart,
        xSpanMs,
        brush: brush ? { shownStart: shownRange.start.getTime(), shownEnd: shownRange.end.getTime(), blurPx: brushProps?.blurPx } : undefined,
        clipped: xDomain !== undefined,
        style: phase === "ready" ? style : loadingHostStyle(style, loadingGrid),
      })}
    >
      {defs}
      <BackgroundResources table={table} uid={uid} />
      {built.hover.highlights.length > 0 ? <HighlightBandClip id={built.hover.bandClip} /> : null}
      {staticCss ? <style>{staticCss}</style> : null}
      <LegendHostSync hostRef={containerRef} />
      {sized && <RevealArm hostRef={containerRef} onArm={onRevealArm} />}
      {plotWidth > 0 && childrenReady && sized && (
      <RendererChart
        definition={erase(built.definition)}
        idPrefix={uid}
        renderer={renderer}
        aspectRatio={fillHeight ? undefined : parseAspectRatio(aspectRatio)}
        height={fillHeight ? (fitHeight ?? 200) : undefined}
        ariaLabel={props.ariaLabel ?? (brush ? "Range selector (drag to select a range)" : props.defaultAriaLabel)}
        ariaDescription={props.ariaDescription}
        // The brush strip is pointer-only (TanStack's brush keyboard needs discrete values, which would snap the pointer range).
        tabIndex={brush ? -1 : undefined}
        onFocusChange={onFocusChange}
        onRender={erase(onRender)}
        renderTooltipBody={erase(renderTooltipBody)}
      />
      )}
      {chartLoading ? <LoadingSweepOverlays series={series} exiting={phase === "exiting"} margin={resolvedMargin} innerWidth={innerWidth} innerHeight={innerHeight} /> : null}
      {phase === "ready" || phase === "concealing" || phase === "tweenLoading" ? null : <LoadingLabel text={props.loadingLabel ?? ""} exiting={phase !== "loading"} />}
      {brush && plotWidth > 0 && xSpanMs > 0 ? <BrushPanes fade={brushProps?.fadeOuterEdges !== false} /> : null}
      <FocusLayer store={focusStore} useContextValue={useContextValue}>
        {custom}
      </FocusLayer>
    </div>
  );
}
