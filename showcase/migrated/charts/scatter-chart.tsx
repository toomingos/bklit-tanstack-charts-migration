"use client";
// bklit ScatterChart on native TanStack Charts: <Scatter> children are config
// carriers compiled into one definition (see scatter/definition.ts).
import { erase } from "./kit/erased-types";
import { useHydratingAttrs } from "./kit/use-hydrating";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useRevealClock } from "./kit/size/parent-size-arm";
import { useReadyGate } from "./kit/entrance/reveal-arm";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { useInteractionHandle, usePressGuard } from "./kit/touch-focus";
import { measureNoText } from "./kit/polar/measure-no-text";
import { RendererChart } from "./kit/tooltip/tooltip-leaf";
import { motion } from "@tanstack/charts/motion";
import { BklitTooltipBody } from "./kit/tooltip/tooltip-body";
import { useChildTable } from "./kit/stable-children";
import { bklitSurfaceStyle, DEFAULT_ANIMATION_MS, DEFAULT_MARGIN, parseAspectRatio } from "./kit/theme";
import type { ChartMargin } from "./kit/theme";
import { buildScatterDefinition, createSizeStore, SCATTER_HOVER_CSS } from "./scatter/definition";
import { parseEasing } from "./kit/motion/easing";
import { toEaseFn } from "./kit/motion/enter-transition";
import type { EnterTransition } from "./kit/motion/phase";
import type { Row } from "./kit/cartesian/series";
import { FocusLayer, useFocusStore } from "./kit/cartesian/focus-layer";
import { HoverOverlay } from "./kit/cartesian/hover-overlay";
import type { LineConfig } from "./kit/cartesian/chart-context";
import { useFocusRow } from "./kit/cartesian/chart-context-focus";
import { timeScale, useBridgedContext, useReferenceAreas, valueScale } from "./kit/cartesian/context-bridge";
import type { FocusedRow } from "./kit/cartesian/context-bridge";
import { shortDateFmt } from "./kit/format";
import { OWN_PILL_NAMES, pillTickStaticCss, syncPillHost } from "./kit/cartesian/date-pill";
import { writeFocusHost } from "./kit/host-write";
import { focusEmptyHiddenCss } from "./kit/cartesian/gate-css";
import { useSanitizedId } from "./kit/use-sanitized-id";

/** Lifecycle phase reported by `ScatterChart`'s `onPhaseChange`: `"revealing"` while the points enter, `"ready"` once the chart is interactive. */
type ScatterChartPhase = "loading" | "revealing" | "ready";

/** Props of {@link ScatterChart}. */
export interface ScatterChartProps {
  /** The rows to plot. Each row holds the x value under `xDataKey` and one number per `Scatter` series under that series' `dataKey`. */
  readonly data: readonly Row[];
  /**
   * Key of the x value in each row. The value must be a `Date` (or something `new Date()` accepts, such as a timestamp).
   * @default "date"
   */
  readonly xDataKey?: string;
  /**
   * Duration of the entrance reveal in milliseconds. `0` skips the animation. `enterTransition.duration` overrides it.
   * @default 1100
   */
  readonly animationDuration?: number;
  /**
   * Space around the plot area in pixels. Missing sides use the default.
   * @default { top: 40, right: 40, bottom: 40, left: 40 }
   */
  readonly margin?: Partial<ChartMargin>;
  /**
   * CSS aspect ratio of the chart (`"width / height"` or a number), applied to the container width.
   * @default "2 / 1"
   */
  readonly aspectRatio?: string;
  /** Extra CSS class name for the chart container. */
  readonly className?: string;
  /** Inline styles for the chart container. */
  readonly style?: CSSProperties;
  /** Called with `"revealing"` when the entrance starts and `"ready"` when the chart becomes interactive. */
  readonly onPhaseChange?: (phase: ScatterChartPhase) => void;
  /** CSS easing for the per-point entrance, for example `"cubic-bezier(0.85, 0, 0.15, 1)"`. When unset, `enterTransition.ease` or the default reveal easing is used. */
  readonly animationEasing?: string;
  /** Entrance timing: `duration` (in seconds) sets the length of the reveal and `ease` (a four-number cubic bezier) the easing. */
  readonly enterTransition?: { readonly duration?: number; readonly ease?: unknown };
  /** Changing this string replays the entrance animation. */
  readonly revealSignature?: string;
  /** The layers to draw: `Grid`, one or more `Scatter`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children. */
  readonly children: ReactNode;
  /**
   * Accessible name of the chart.
   * @default "Scatter chart"
   */
  readonly ariaLabel?: string;
  /** Longer accessible description of the chart, exposed as `aria-description`. */
  readonly ariaDescription?: string;
}

const ScatterChartInner = ({
  data,
  xDataKey = "date",
  animationDuration: animationDurationProp = DEFAULT_ANIMATION_MS,
  enterTransition,
  margin,
  aspectRatio = "2 / 1",
  className,
  style,
  onPhaseChange,
  animationEasing,
  children,
  ariaLabel = "Scatter chart",
  ariaDescription,
}: Readonly<ScatterChartProps>): ReactElement => {
  const { table, custom, ready: childrenReady } = useChildTable(children);
  const resolvedMargin = useMemo(() => ({ ...DEFAULT_MARGIN, ...margin }), [margin]);
  // bklit: `enterTransition.duration` (seconds) replaces the reveal span; its `ease` array replaces the default easing.
  const enterSeconds = enterTransition?.duration;
  const animationDuration = typeof enterSeconds === "number" ? enterSeconds * 1000 : animationDurationProp;
  const enterEase = enterTransition?.ease;
  const easing = useMemo(
    // SAFETY: bklit's `ease` is a Transition easing (name or bezier array); toEaseFn narrows it itself.
    () => (animationEasing === undefined || animationEasing === "" ? toEaseFn(enterEase as EnterTransition["ease"]) : parseEasing(animationEasing)),
    [enterEase, animationEasing],
  );
  // Two-pass mount: the first pass paints grid + axes only; the dots then enter as new data
  // (native keyed enter + per-datum `motion` delay), because the renderer has no initial dot entrance.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { interaction, onRender } = useInteractionHandle();
  usePressGuard(containerRef, interaction, true);
  const holdFocus = useKeyboardFocusHold(containerRef, () => interaction.current);
  // The plot size comes from TanStack's own measure (the definition's `chart` callback writes it), never from React state.
  const sizeStore = useRef(createSizeStore()).current;
  // Hover lives in a ref store read only by <FocusLayer>: focus never re-renders this component
  // (no definition rebuild, no re-resolve); fixed CSS (`SCATTER_HOVER_CSS`) carries the visual emphasis.
  const focusStore = useFocusStore<FocusedRow>();
  // The hover indicator (crosshair, dots, date pill) is an element we own, appended to the host and moved imperatively (kit/cartesian/hover-overlay.ts).
  const overlayRef = useRef<HoverOverlay | null>(null);
  overlayRef.current ??= new HoverOverlay();
  const overlay = overlayRef.current;
  useLayoutEffect(() => {
    containerRef.current?.append(overlay.root);
    return () => { overlay.root.remove(); };
  }, [overlay]);
  const uid = `s${useSanitizedId()}`;
  const hydratingAttrs = useHydratingAttrs();
  // Entrance starts on the first draw, without bklit's react-use-measure hop (scatter-chart.tsx:154), at the user's direction (no frame waits); the curve is unchanged.
  // The renderer mounts in its own layout effect, which runs first; `revealed` flips in the next one, before first paint.
  const [revealed, setRevealed] = useState(false);
  useLayoutEffect(() => {
    if (childrenReady) {
      setRevealed(true);
    }
  }, [childrenReady]);
  const revealClock = useRevealClock(revealed);
  const built = useMemo(
    () => buildScatterDefinition({ data, xKey: xDataKey, table, margin: resolvedMargin, uid: "scatter", animationDuration, easing, revealed, revealClock, sizeStore }),
    [data, xDataKey, table, resolvedMargin, animationDuration, easing, revealed, revealClock, uid, sizeStore],
  );
  // `initial: "always"` replays the entrance on hydrated (server-rendered) SVG too.
  const renderer = useMemo(() => motion(erase({ initial: "always", transition: { type: "tween", duration: 500 } })), []);
  const colors = useMemo(() => Object.fromEntries(built.series.map((s) => [s.dataKey, s.tooltipColor])), [built.series]);
  const order = useMemo(() => built.series.map((s) => s.dataKey), [built.series]);
  const tooltipOptions = useMemo(() => ({ order, colors }), [order, colors]);

  // bklit's reveal timer (scatter-chart-shell.tsx:146-154) starts once useMeasure reports a size (scatter-chart.tsx:154,166), so on `revealed`.
  // It drives onPhaseChange "ready" (shell :156-158) and `canInteract` (shell :160) via `data-bkm-ready` (SCATTER_HOVER_CSS); no re-render.
  const phaseRef = useRef(onPhaseChange);
  phaseRef.current = onPhaseChange;
  const { arm: armReady, store: readyStore } = useReadyGate(containerRef, animationDuration, { onReady: useCallback(() => phaseRef.current?.("ready"), []) });
  useEffect(() => {
    if (!revealed) {
      return;
    }
    phaseRef.current?.("revealing");
    armReady();
  }, [revealed, armReady]);

  // Public `useChart()` context, derived from the native focus + resolved domains; built only inside <FocusLayer> (custom children), at the size TanStack measured.
  // SAFETY: `data` is only read; the bridge and kit helpers type rows as a mutable array.
  const rows = data as Row[];
  const rowIndex = useMemo(() => new Map(rows.map((row, i) => [row, i] as const)), [rows]);
  // SAFETY: the x column holds a Date, epoch number or date string, as toDate expects.
  const xAccessor = useCallback((d: Row): Date => new Date(d[xDataKey] as string | number | Date), [xDataKey]);
  const dateLabels = useMemo(() => rows.map((row) => shortDateFmt.format(xAccessor(row))), [rows, xAccessor]);
  const lines = useMemo<LineConfig[]>(
    () => built.series.map((s) => ({ dataKey: s.dataKey, stroke: s.tooltipColor, strokeWidth: 0, yAxisId: s.yAxisId })),
    [built.series],
  );
  const referenceAreas = useReferenceAreas(table);
  // Rows are focused at their data x on the plot's middle line; group-x snaps like a pointer move.
  const pixelOf = useCallback(
    (index: number) => {
      const { width, height } = sizeStore.get();
      const innerWidth = Math.max(0, width - resolvedMargin.left - resolvedMargin.right);
      const innerHeight = Math.max(0, height - resolvedMargin.top - resolvedMargin.bottom);
      return rows[index] ? { x: resolvedMargin.left + timeScale(built.domains.x(width), innerWidth)(xAccessor(rows[index])), y: resolvedMargin.top + innerHeight / 2 } : null;
    },
    [rows, resolvedMargin, built.domains, xAccessor, sizeStore],
  );
  useEffect(() => {
    // The plot size is TanStack's own measure (sizeStore); the effect re-runs when the build or the measured size changes.
    const place = (): void => {
      const { width, height } = sizeStore.get();
      const innerWidth = Math.max(0, width - resolvedMargin.left - resolvedMargin.right);
      const innerHeight = Math.max(0, height - resolvedMargin.top - resolvedMargin.bottom);
      const [x0, x1] = built.domains.x(width);
      overlay.update(built.overlay, { height, innerWidth, innerHeight, xDomain: [x0.getTime(), x1.getTime()], yDomains: built.domains.y }, resolvedMargin);
    };
    place();
    return sizeStore.subscribe(place);
  }, [overlay, built, resolvedMargin, sizeStore]);
  const focusRow = useFocusRow(containerRef, interaction, pixelOf);
  const useContextValue = (focused: FocusedRow | null): ReturnType<typeof useBridgedContext> => {
    const size = useSyncExternalStore(sizeStore.subscribe, sizeStore.get, sizeStore.get);
    const innerWidth = Math.max(0, size.width - resolvedMargin.left - resolvedMargin.right);
    const innerHeight = Math.max(0, size.height - resolvedMargin.top - resolvedMargin.bottom);
    const xScale = useMemo(() => timeScale(built.domains.x(size.width), innerWidth), [size.width, innerWidth]);
    const yScales = useMemo(() => Object.fromEntries(Object.entries(built.domains.y).map(([id, domain]) => [id, valueScale(domain, innerHeight)])), [innerHeight]);
    return useBridgedContext({ data: rows, margin: resolvedMargin, size, containerRef, ready: readyStore, xScale, yScales, lines, animationDuration, xAccessor, dateLabels, focusRow, referenceAreas, focused });
  };
  // Hover emphasis is static CSS (SCATTER_HOVER_CSS) keyed on the host.
  const dimSeries = built.series.find((s) => s.dim);
  const hoverVars = useMemo(
    // SAFETY: CSSProperties has no typed index for custom properties.
    () => ({ "--bkm-inactive": dimSeries?.inactiveOpacity ?? 1, "--bkm-blur": dimSeries?.inactiveBlur ?? 0, "--bkm-enter-blur": built.series[0]?.enterBlur ?? 2 }) as CSSProperties,
    [dimSeries, built.series[0]?.enterBlur],
  );
  const dimOn = dimSeries !== undefined;
  const pillStaticCss = useMemo(
    // The rule text holds no width-dependent value (tick times only gate it on), so one nominal width serves.
    () => {
      const pill = built.pillTicks(1);
      return pill ? (pillTickStaticCss(`[data-bkm-kit="${uid}"]`, pill.times, pill.reachPx, OWN_PILL_NAMES) ?? "") : "";
    },
    [built, uid],
  );
  const onFocusChange = useCallback(
    (point: { datum: unknown; x: number } | null) => {
      holdFocus(erase(point));
      // SAFETY: focus points carry rows from this chart's data.
      const index = point ? (rowIndex.get(point.datum as Row) ?? -1) : -1;
      focusStore.set(index < 0 ? null : { row: rows[index], index });
      // SAFETY: the x column holds a Date, epoch number or date string (see xAccessor).
      overlay.focus(index < 0 ? null : new Date(rows[index]?.[xDataKey] as string | number | Date).getTime(), index < 0 ? null : rows[index]);
      const host = containerRef.current;
      const pillCss = built.pillTicks(sizeStore.get().width);
      if (host && pillCss) {
        // SAFETY: the x column holds a Date, epoch number or date string (see xAccessor).
        syncPillHost(host, pillCss.times, pillCss.spanMs, pillCss.plotWidth, index < 0 ? null : new Date(rows[index]?.[xDataKey] as string | number | Date).getTime());
      }
      if (host) {
        // Fixed rule (below) hides the tooltip/focus layers at once when the pointer is in the chart but nothing is focused (bklit unmounts them).
        // A press hides the chrome (usePressGuard) until the next focus, so any non-empty focus lifts it; the dim is keyed on `data-bkm-hover` (SCATTER_HOVER_CSS).
        writeFocusHost(host, { focused: index >= 0, hovered: dimOn && point !== null && index >= 0, liftPress: true });
      }
    },
    [rowIndex, rows, focusStore, dimOn, xDataKey, built, sizeStore, overlay],
  );
  const renderTooltipBody = useCallback(
    // SAFETY: erased datum generics, as at the other kit call sites.
    ({ points }: { points: never }) => <BklitTooltipBody points={points} options={tooltipOptions} />,
    [tooltipOptions],
  );
  const emptyFocusCss = focusEmptyHiddenCss(`[data-bkm-kit="${uid}"]`);
  return (
    <div ref={containerRef} className={className} data-bkm-chart="scatter" {...hydratingAttrs} data-bkm-kit={uid} {...built.gridAttrs} style={{ width: "100%", position: "relative", ...hoverVars, ...bklitSurfaceStyle, ...style }}>
      <style>{`${SCATTER_HOVER_CSS}${pillStaticCss}${emptyFocusCss}`}</style>
      {childrenReady ? <RendererChart
        definition={erase(built.definition)}
        idPrefix={uid}
        renderer={renderer}
        aspectRatio={parseAspectRatio(aspectRatio)}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        onFocusChange={erase(onFocusChange)}
        // Axes use fixed margins and no label thinning, so layout never reads text metrics; skipping the DOM measurer also skips its font-load re-render (renderer.ts handleFontLoad).
        measureText={measureNoText}
        onRender={erase(onRender)}
        renderTooltipBody={erase(renderTooltipBody)}
      /> : null}
      <FocusLayer
        store={focusStore}
        useContextValue={useContextValue}
      >
        {custom}
      </FocusLayer>
    </div>
  );
};

/** Time-series scatter chart. Compose it from children: `Grid`, one or more `Scatter` series, `XAxis`, `YAxis` and `ChartTooltip`. Points enter one after another; hover or keyboard focus reports the nearest x position through the tooltip. */
export const ScatterChart = ({ revealSignature = "", ...props }: Readonly<ScatterChartProps>): ReactElement => (
  // Remounting on `revealSignature` replays the entrance.
  <ScatterChartInner key={revealSignature} {...props} />
);

ScatterChart.displayName = "ScatterChart";
