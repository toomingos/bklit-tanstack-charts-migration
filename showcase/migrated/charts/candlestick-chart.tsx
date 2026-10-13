"use client";
// bklit CandlestickChart on native TanStack Charts: the Candlestick/Grid/XAxis/YAxis/ChartTooltip
// children are config carriers compiled into one defineChart definition (candlestick).
import { erase } from "./kit/erased-types";
import { useHydratingAttrs } from "./kit/use-hydrating";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { useInteractionHandle, usePressGuard } from "./kit/touch-focus";
import { RendererChart } from "./kit/tooltip/tooltip-leaf";
import { motion } from "@tanstack/charts/motion";
import type { ChartPoint } from "@tanstack/charts";
import { propsFor } from "./kit/read-children";
import { useChildTable } from "./kit/stable-children";
import { BklitTooltipBody, bklitTooltipOptions } from "./kit/tooltip/tooltip-body";
import type { BklitTooltipCarrier, TooltipBodyOptions } from "./kit/tooltip/tooltip-body";
import { bklitSurfaceStyle, DEFAULT_ANIMATION_MS, DEFAULT_MARGIN, parseAspectRatio } from "./kit/theme";
import type { ChartMargin } from "./kit/theme";
import { OWN_PILL_NAMES, pillTickStaticCss, syncPillHost } from "./kit/cartesian/date-pill";
import { writeFocusHost } from "./kit/host-write";
import { buildCandlestickDefinition, CANDLE_HOVER_CSS, candlestickDomains } from "./candlestick/definition";
import { DEFAULT_Y_AXIS_ID, toDate } from "./kit/cartesian/series";
import { HoverOverlay } from "./kit/cartesian/hover-overlay";
import type { Candle } from "./candlestick/definition";
import type { EnterTransition } from "./kit/motion/phase";
import { useChartLegendHover } from "./kit/legend/legend";
import { FocusLayer, useFocusStore } from "./kit/cartesian/focus-layer";
import type { LineConfig } from "./kit/cartesian/chart-context";
import { useFocusRow } from "./kit/cartesian/chart-context-focus";
import { timeScale, useBridgedContext, useReferenceAreas, valueScale } from "./kit/cartesian/context-bridge";
import { useResizeBox } from "./kit/size/use-resize-box";
import type { FocusedRow } from "./kit/cartesian/context-bridge";
import { shortDateFmt } from "./kit/format";
import { focusEmptyHiddenCss } from "./kit/cartesian/gate-css";
import { getOverlayResources } from "./kit/cartesian/features";
import { useSanitizedId } from "./kit/use-sanitized-id";
import { useReadyGate } from "./kit/entrance/reveal-arm";

export interface OHLCDataPoint {
  /** String-keyed so a row is assignable to the definition's `Candle` record without a cast. */
  readonly [key: string]: unknown;
  /** Time of the candle. Must be a `Date` (the x key is `xDataKey`, default `"date"`). */
  date: Date;
  /** Opening price. */
  open: number;
  /** Highest price of the period. */
  high: number;
  /** Lowest price of the period. */
  low: number;
  /** Closing price. A candle with `close >= open` is positive. */
  close: number;
}

export interface CandlestickChartProps {
  /** The candles to plot, one row per period. */
  readonly data: OHLCDataPoint[];
  /**
   * Key of the time value in each row. The value must be a `Date` or something `new Date()` accepts.
   * @default "date"
   */
  readonly xDataKey?: string;
  /**
   * Space around the plot area in pixels. Missing sides use the default.
   * @default { top: 40, right: 40, bottom: 40, left: 40 }
   */
  readonly margin?: Partial<ChartMargin>;
  /**
   * Duration of the entrance in milliseconds.
   * @default 1100
   */
  readonly animationDuration?: number;
  /**
   * Customizes the entrance: a spring, or a cubic-bezier tween with a `duration` in seconds. See `EnterTransition`.
   */
  readonly enterTransition?: EnterTransition;
  /** Changing this string replays the entrance animation. */
  readonly revealSignature?: string;
  /**
   * CSS aspect ratio of the chart, as `"width / height"`.
   * @default "2 / 1"
   */
  readonly aspectRatio?: string;
  /** Extra CSS class name for the chart container. */
  readonly className?: string;
  /**
   * Inline styles for the chart container. `aspectRatio: "unset"` or an explicit `height` makes the chart fill the container height.
   */
  readonly style?: CSSProperties;
  /**
   * Gap between candle slots as a fraction of the slot width (0-1). Ignored when `candleWidth` is set. A gap below the default cannot widen candles past 80% of their spacing.
   * @default 0.2
   */
  readonly candleGap?: number;
  /** Fixed candle body width in px. When unset, candles size to the spacing between them. */
  readonly candleWidth?: number;
  /** Visible x range as `[start, end]`, used for brush zoom. The chart plots only this range of `data`. */
  readonly xDomain?: [Date, Date];
  /**
   * Length of the full dataset while `xDomain` zooms into part of it. It keeps candle spacing consistent with the unzoomed chart.
   */
  readonly xDomainSlotCount?: number;
  /** The layers to draw: `Candlestick`, `Grid`, `XAxis`, `YAxis`, `ChartTooltip` and the other chart children. */
  readonly children: ReactNode;
  /**
   * Accessible name of the chart.
   * @default "Candlestick chart"
   */
  readonly ariaLabel?: string;
  /** Longer accessible description of the chart, exposed as `aria-description`. */
  readonly ariaDescription?: string;
}

const CLOSE_COLOR = "var(--chart-line-primary)";

// Container-owned height: the host follows the wrapper's CSS content height (TanStack renderer.ts observesContainerHeight, responsive-charts.md).
const FILL_HOST_STYLE: CSSProperties = { height: "100%" };

/** A candlestick (OHLC) chart. Pass rows of `OHLCDataPoint` and a `Candlestick` child, plus optional `Grid`, axes and `ChartTooltip`. */
export const CandlestickChart = ({
  data,
  xDataKey = "date",
  margin: marginProp,
  animationDuration = DEFAULT_ANIMATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "2 / 1",
  candleWidth,
  candleGap = 0.2,
  xDomain,
  xDomainSlotCount,
  className,
  style,
  children,
  ariaLabel = "Candlestick chart",
  ariaDescription,
}: Readonly<CandlestickChartProps>): ReactElement => {
  const legendHovered = useChartLegendHover().hoveredIndex;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { interaction, onRender } = useInteractionHandle();
  usePressGuard(containerRef, interaction, false);
  const holdFocus = useKeyboardFocusHold(containerRef, () => interaction.current);
  // bklit: an explicit height (or aspectRatio: unset) wins over the aspect ratio.
  const fillHeight = style?.aspectRatio === "unset" || style?.height !== undefined;
  // bklit `canInteract = isLoaded` (candlestick-chart.tsx:225): `animationDuration` after mount hover goes live and the
  // centre-split entrance marks swap to static candles.
  const { arm: armReady, ready: loaded, store: readyStore } = useReadyGate(containerRef, animationDuration, { resetKey: revealSignature, viaState: true });
  useEffect(() => {
    armReady();
  }, [armReady]);
  // Public `useChart()` context, derived from the native focus + resolved domains.
  const size = useResizeBox(containerRef);
  // Hover lives in a ref store read only by <FocusLayer> (no chart re-render, no definition rebuild per pointermove).
  const focusStore = useFocusStore<FocusedRow>();
  // The hover indicator (crosshair, close dot, date pill) is an element we own, appended to the host and moved imperatively (kit/cartesian/hover-overlay.ts).
  const overlayRef = useRef<HoverOverlay | null>(null);
  overlayRef.current ??= new HoverOverlay();
  const overlay = overlayRef.current;
  useLayoutEffect(() => {
    containerRef.current?.append(overlay.root);
    return () => { overlay.root.remove(); };
  }, [overlay]);
  const uid = `c${useSanitizedId()}`;
  const hydratingAttrs = useHydratingAttrs();
  // A legend hover re-renders the host with fresh children: keep the previous carrier table so the definition is not rebuilt.
  const { table, custom, ready: childrenReady } = useChildTable(children);
  const resolvedMargin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const innerWidth = Math.max(0, size.width - resolvedMargin.left - resolvedMargin.right);
  const slotWidth = innerWidth / Math.max(xDomainSlotCount ?? data.length, 1);
  // bklit's body is `min(candleWidth ?? slot * (1 - candleGap), slot)` (candlestick-chart.tsx:182, candlestick.tsx:321). Native
  // bars on a time scale are already 80% of the closest spacing (one slot), which is bklit's default gap, so only a wider gap
  // needs a cap. A gap below 0.2 cannot widen them: `resolveBarThickness` only shrinks (UPSTREAM-GAPS #24), accepted.
  const bodyWidth = candleWidth ?? (candleGap > 0.2 && slotWidth > 0 ? slotWidth * (1 - candleGap) : undefined);
  const built = useMemo(
    () =>
      buildCandlestickDefinition({
        data,
        xKey: xDataKey,
        table,
        margin: resolvedMargin,
        uid,
        animationDuration,
        enterTransition,
        xDomain,
        xDomainSlotCount,
        candleWidth: bodyWidth,
        entrance: !loaded,
      }),
    [data, xDataKey, table, resolvedMargin, uid, animationDuration, enterTransition, xDomain, xDomainSlotCount, bodyWidth, loaded],
  );
  const renderer = useMemo(
    // `initial: "always"` replays the entrance on hydrated (server-rendered) SVG too.
    () => motion({ initial: "always", transition: { type: "tween", duration: animationDuration } }),
    [animationDuration],
  );
  const tooltipProps = propsFor<BklitTooltipCarrier>(table, "tooltip").at(0);
  const tooltipOptions = useMemo(
    (): TooltipBodyOptions => bklitTooltipOptions(tooltipProps, data, { order: ["close"], colors: { close: CLOSE_COLOR } }),
    [tooltipProps, data],
  );
  const innerHeight = Math.max(0, size.height - resolvedMargin.top - resolvedMargin.bottom);
  const domains = useMemo(
    () => candlestickDomains(data, xDataKey, xDomain, xDomainSlotCount),
    [data, xDataKey, xDomain, xDomainSlotCount],
  );
  const xScale = useMemo(() => timeScale(domains.x, innerWidth), [domains.x, innerWidth]);
  const yScales = useMemo(() => ({ left: valueScale(domains.y, innerHeight) }), [domains.y, innerHeight]);
  const rows: readonly Candle[] = data;
  useLayoutEffect(() => {
    overlay.update(built.overlay, { height: size.height, innerWidth, innerHeight, xDomain: built.plotDomains.x, yDomains: { [DEFAULT_Y_AXIS_ID]: built.plotDomains.y } }, resolvedMargin);
  }, [overlay, built, size.height, innerWidth, innerHeight, resolvedMargin]);
  const rowIndex = useMemo(() => new Map<unknown, number>(data.map((row, i) => [row, i] as const)), [data]);
  const xAccessor = useCallback((d: Candle): Date => toDate(d[xDataKey]), [xDataKey]);
  const dateLabels = useMemo(() => data.map((row) => shortDateFmt.format(xAccessor(row))), [data, xAccessor]);
  const lines = useMemo<LineConfig[]>(() => [{ dataKey: "close", stroke: CLOSE_COLOR, strokeWidth: 2 }], []);
  const extras = useMemo(() => {
    const slots = xDomainSlotCount ?? data.length;
    const columnWidth = slots > 0 ? innerWidth / slots : 0;
    return { columnWidth, bandWidth: candleWidth ?? columnWidth * (1 - candleGap) };
  }, [xDomainSlotCount, data.length, innerWidth, candleWidth, candleGap]);
  const referenceAreas = useReferenceAreas(table);
  // Rows are focused at their data x on the plot's middle line; nearest-x snaps like a pointer move.
  const pixelOf = useCallback(
    (index: number) => {
      const row: Candle | undefined = rows[index];
      return row === undefined ? null : { x: resolvedMargin.left + xScale(xAccessor(row)), y: resolvedMargin.top + innerHeight / 2 };
    },
    [rows, resolvedMargin, xScale, xAccessor, innerHeight],
  );
  const focusRow = useFocusRow(containerRef, interaction, pixelOf);
  const bridge = { data: rows, margin: resolvedMargin, size, containerRef, ready: readyStore, xScale, yScales, lines, animationDuration, xAccessor, dateLabels, focusRow, referenceAreas };
  const fadeOn = built.hoverFadeOpacity !== null;
  const pillStaticCss = useMemo(
    () => (built.pillTicks.active ? (pillTickStaticCss(`[data-bkm-kit="${uid}"]`, built.pillTicks.times, built.pillTicks.reachPx, OWN_PILL_NAMES) ?? "") : ""),
    [built.pillTicks, uid],
  );
  const onFocusChange = useCallback(
    (point: ChartPoint<Candle, Date, number> | null) => {
      holdFocus(point);
      const index = point ? (rowIndex.get(point.datum) ?? point.datumIndex ?? -1) : -1;
      const row: Candle | undefined = rows[index];
      focusStore.set(index < 0 ? null : { row, index });
      overlay.focus(index < 0 ? null : toDate(row?.[xDataKey]).getTime(), index < 0 || row === undefined ? null : row);
      // The dim is static CSS keyed on the host: the focused candle's centre (svg px) rides in one var.
      const host = containerRef.current;
      if (host) {
        const pt = built.pillTicks;
        syncPillHost(host, pt.times, pt.spanMs, innerWidth, index < 0 ? null : toDate(row?.[xDataKey]).getTime());
        // A move inside one candle re-emits the same x: the var and attributes are written only when they change.
        writeFocusHost(host, { focused: index >= 0, hovered: point !== null && index >= 0 && fadeOn, hoverX: point ? String(point.x) : undefined });
      }
    },
    [rowIndex, rows, focusStore, fadeOn, built.pillTicks, innerWidth, xDataKey, overlay],
  );
  const renderTooltipBody = useCallback(
    ({ points }: { points: readonly ChartPoint<Candle, Date, number>[] }) => <BklitTooltipBody points={points} options={tooltipOptions} />,
    [tooltipOptions],
  );
  const emptyFocusCss = focusEmptyHiddenCss(`[data-bkm-kit="${uid}"]`);
  const OverlayResources = getOverlayResources();
  // Entrance starts on the first draw, without bklit's ParentSize frames (candlestick-chart.tsx:398), at the user's direction (no frame waits); the curve is unchanged.
  return (
    <div
      key={revealSignature}
      ref={containerRef}
      className={className}
      data-bkm-chart="candlestick"
      {...hydratingAttrs}
      data-slot="chart"
      data-bkm-kit={uid}
      {...built.gridAttrs}
      data-bkm-legend={legendHovered ?? undefined}
      style={{ width: "100%", position: "relative", "--bkm-faded": built.fadedOpacity, ...bklitSurfaceStyle, ...style } as CSSProperties}
    >
      <style>{`${CANDLE_HOVER_CSS}${pillStaticCss}${emptyFocusCss}`}</style>
      {OverlayResources ? <OverlayResources table={table} uid={uid} margin={resolvedMargin} /> : null}
      {childrenReady ? (
      <RendererChart<Candle, Date, number>
        definition={built.definition}
        idPrefix={uid}
        renderer={renderer}
        aspectRatio={fillHeight ? undefined : parseAspectRatio(aspectRatio)}
        style={fillHeight ? FILL_HOST_STYLE : undefined}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        onFocusChange={onFocusChange}
        onRender={erase(onRender)}
        renderTooltipBody={renderTooltipBody}
      />
      ) : null}
      <FocusLayer
        store={focusStore}
        useContextValue={(focused: FocusedRow | null) =>
          useBridgedContext({ ...bridge, focused, extras: { ...extras, hoveredCandleIndex: focused?.index ?? null, setHoveredCandleIndex: focusRow } })
        }
      >
        {custom}
      </FocusLayer>
    </div>
  );
};

CandlestickChart.displayName = "CandlestickChart";
