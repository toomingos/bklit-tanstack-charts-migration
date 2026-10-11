// bklit ScatterChart on native TanStack Charts: <Scatter> children are config
// carriers compiled into one definition (see scatter/definition.ts).
import { erase } from "./kit/erased-types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useRevealClock } from "./kit/size/parent-size-arm";
import { useReadyGate } from "./kit/entrance/reveal-arm";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { useInteractionHandle, usePressGuard } from "./kit/touch-focus";
import { RendererChart } from "./kit/tooltip/tooltip-leaf";
import { motion } from "@tanstack/charts/motion";
import { BklitTooltipBody } from "./kit/tooltip/tooltip-body";
import { useChildTable } from "./kit/stable-children";
import { bklitSurfaceStyle, DEFAULT_ANIMATION_MS, DEFAULT_MARGIN, parseAspectRatio } from "./kit/theme";
import type { ChartMargin } from "./kit/theme";
import { buildScatterDefinition, SCATTER_HOVER_CSS } from "./scatter/definition";
import { parseEasing } from "./kit/motion/easing";
import { toEaseFn } from "./kit/motion/enter-transition";
import type { EnterTransition } from "./kit/motion/phase";
import type { Row } from "./kit/cartesian/series";
import { FocusLayer, useFocusStore } from "./kit/cartesian/focus-layer";
import type { LineConfig } from "./kit/cartesian/chart-context";
import { useFocusRow } from "./kit/cartesian/chart-context-focus";
import { timeScale, useBridgedContext, useReferenceAreas, valueScale } from "./kit/cartesian/context-bridge";
import { useResizeBox } from "./kit/size/use-resize-box";
import type { FocusedRow } from "./kit/cartesian/context-bridge";
import { shortDateFmt } from "./kit/format";
import { OWN_PILL_NAMES, pillTickStaticCss, syncPillHost } from "./kit/cartesian/date-pill";
import { writeFocusHost } from "./kit/host-write";
import { focusEmptyHiddenCss } from "./kit/cartesian/gate-css";
import { useSanitizedId } from "./kit/use-sanitized-id";

type ScatterChartPhase = "loading" | "revealing" | "ready";

export interface ScatterChartProps {
  readonly data: readonly Row[];
  readonly xDataKey?: string;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly onPhaseChange?: (phase: ScatterChartPhase) => void;
  /** CSS easing for the per-point enter, e.g. "cubic-bezier(0.85, 0, 0.15, 1)". */
  readonly animationEasing?: string;
  /** bklit `Transition` subset: `duration` (seconds) sets the reveal span, `ease` the per-point easing. */
  readonly enterTransition?: { readonly duration?: number; readonly ease?: unknown };
  /** Changing it replays the entrance. */
  readonly revealSignature?: string;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
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
  const size = useResizeBox(containerRef, undefined, true);
  // Hover lives in a ref store read only by <FocusLayer>: focus never re-renders this component
  // (no definition rebuild, no re-resolve); fixed CSS (`SCATTER_HOVER_CSS`) carries the visual emphasis.
  const focusStore = useFocusStore<FocusedRow>();
  const uid = `s${useSanitizedId()}`;
  // Dots enter from the layout-effect commit after the renderer's first (empty) mount, before first paint: bklit's react-use-measure hop
  // (scatter-chart.tsx:154) is skipped, as the lead approved. The renderer mounts in its own layout effect, which runs first.
  const [revealed, setRevealed] = useState(false);
  useLayoutEffect(() => {
    if (childrenReady) {
      setRevealed(true);
    }
  }, [childrenReady]);
  const revealClock = useRevealClock(revealed);
  const built = useMemo(
    () => buildScatterDefinition({ data, xKey: xDataKey, table, margin: resolvedMargin, uid: "scatter", idPrefix: uid, animationDuration, easing, revealed, revealClock }),
    [data, xDataKey, table, resolvedMargin, animationDuration, easing, revealed, revealClock, uid],
  );
  const renderer = useMemo(() => motion(erase({ transition: { type: "tween", duration: 500 } })), []);
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

  // Public `useChart()` context, derived from the native focus + resolved domains.
  const innerWidth = Math.max(0, size.width - resolvedMargin.left - resolvedMargin.right);
  const innerHeight = Math.max(0, size.height - resolvedMargin.top - resolvedMargin.bottom);
  const xScale = useMemo(() => timeScale(built.domains.x(size.width), innerWidth), [built.domains, size.width, innerWidth]);
  const yScales = useMemo(
    () => Object.fromEntries(Object.entries(built.domains.y).map(([id, domain]) => [id, valueScale(domain, innerHeight)])),
    [built.domains, innerHeight],
  );
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
    (index: number) => (rows[index] ? { x: resolvedMargin.left + xScale(xAccessor(rows[index])), y: resolvedMargin.top + innerHeight / 2 } : null),
    [rows, resolvedMargin, xScale, xAccessor, innerHeight],
  );
  const focusRow = useFocusRow(containerRef, interaction, pixelOf);
  const bridge = useMemo(
    () => ({ data: rows, margin: resolvedMargin, size, containerRef, ready: readyStore, xScale, yScales, lines, animationDuration, xAccessor, dateLabels, focusRow, referenceAreas }),
    [rows, resolvedMargin, size, readyStore, xScale, yScales, lines, animationDuration, xAccessor, dateLabels, focusRow, referenceAreas],
  );
  const pill = built.pillTicks(size.width);
  const pillCss = useMemo(() => (pill ? { ...pill } : null), [pill?.spanMs, pill?.plotWidth, pill?.times.join(",")]);
  // Hover emphasis is static CSS (SCATTER_HOVER_CSS) keyed on the host.
  const dimSeries = built.series.find((s) => s.dim);
  const hoverVars = useMemo(
    // SAFETY: CSSProperties has no typed index for custom properties.
    () => ({ "--bkm-inactive": dimSeries?.inactiveOpacity ?? 1, "--bkm-blur": dimSeries?.inactiveBlur ?? 0, "--bkm-enter-blur": built.series[0]?.enterBlur ?? 2 }) as CSSProperties,
    [dimSeries, built.series[0]?.enterBlur],
  );
  const dimOn = dimSeries !== undefined;
  const pillStaticCss = useMemo(
    () => (pillCss ? (pillTickStaticCss(`[data-bkm-kit="${uid}"]`, pillCss.times, pillCss.reachPx, OWN_PILL_NAMES) ?? "") : ""),
    [pillCss, uid],
  );
  const onFocusChange = useCallback(
    (point: { datum: unknown; x: number } | null) => {
      holdFocus(erase(point));
      // SAFETY: focus points carry rows from this chart's data.
      const index = point ? (rowIndex.get(point.datum as Row) ?? -1) : -1;
      focusStore.set(index < 0 ? null : { row: rows[index], index });
      const host = containerRef.current;
      if (host && pillCss) {
        // SAFETY: the x column holds a Date, epoch number or date string (see xAccessor).
        syncPillHost(host, pillCss.times, pillCss.spanMs, pillCss.plotWidth, index < 0 ? null : new Date(rows[index]?.[xDataKey] as string | number | Date).getTime(), index);
      }
      if (host) {
        // Fixed rule (below) hides the tooltip/focus layers at once when the pointer is in the chart but nothing is focused (bklit unmounts them).
        // A press hides the chrome (usePressGuard) until the next focus, so any non-empty focus lifts it; the dim is keyed on `data-bkm-hover` (SCATTER_HOVER_CSS).
        writeFocusHost(host, { focused: index >= 0, hovered: dimOn && point !== null && index >= 0, liftPress: true });
      }
    },
    [rowIndex, rows, focusStore, dimOn, pillCss, xDataKey],
  );
  const renderTooltipBody = useCallback(
    // SAFETY: erased datum generics, as at the other kit call sites.
    ({ points }: { points: never }) => <BklitTooltipBody points={points} options={tooltipOptions} />,
    [tooltipOptions],
  );
  const emptyFocusCss = focusEmptyHiddenCss(`[data-bkm-kit="${uid}"]`);
  return (
    <div ref={containerRef} className={className} data-bkm-chart="scatter" data-bkm-kit={uid} {...built.gridAttrs} style={{ width: "100%", position: "relative", ...hoverVars, ...bklitSurfaceStyle, ...style }}>
      <style>{`${SCATTER_HOVER_CSS}${pillStaticCss}${emptyFocusCss}`}</style>
      {childrenReady ? <RendererChart
        definition={erase(built.definition)}
        idPrefix={uid}
        renderer={renderer}
        aspectRatio={parseAspectRatio(aspectRatio)}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        onFocusChange={erase(onFocusChange)}
        onRender={erase(onRender)}
        renderTooltipBody={erase(renderTooltipBody)}
      /> : null}
      <FocusLayer
        store={focusStore}
        useContextValue={(focused: FocusedRow | null) => useBridgedContext({ ...bridge, focused })}
      >
        {custom}
      </FocusLayer>
    </div>
  );
};

export const ScatterChart = ({ revealSignature = "", ...props }: Readonly<ScatterChartProps>): ReactElement => (
  // Remounting on `revealSignature` replays the entrance.
  <ScatterChartInner key={revealSignature} {...props} />
);

ScatterChart.displayName = "ScatterChart";
