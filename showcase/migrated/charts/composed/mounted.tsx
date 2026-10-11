import { erase } from "../kit/cartesian/erased-types";
import { writePresence } from "../kit/host-write";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { useDragSelect } from "../kit/cartesian/drag-select";
import type { DragGeom } from "../kit/cartesian/drag-select";
import { useKeyboardFocusHold } from "../kit/cartesian/keyboard-hold";
import { RevealArm, useReadyGate } from "../kit/entrance/reveal-arm";
import { RendererChart, sameCategoryTarget } from "../kit/tooltip/tooltip-leaf";
import { motion } from "@tanstack/charts/motion";
import type { ChartPoint, DomChartDefinition } from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { pillLayoutOf, syncPillHost } from "../kit/cartesian/date-pill";
import { HighlightBandClip } from "../kit/cartesian/band-clip";
import { LegendHostSync, useHoverHostSync } from "../kit/cartesian/hover-host";
import { propsFor } from "../kit/read-children";
import { useChildTable } from "../kit/stable-children";
import { resolveSeries } from "../kit/cartesian/series";
import type { Row } from "../kit/cartesian/series";
import { BklitTooltipBody, bklitTooltipOptions } from "../kit/tooltip/tooltip-body";
import { bklitSurfaceStyle, DEFAULT_ANIMATION_MS, DEFAULT_MARGIN, DEFAULT_LINE_STROKE, parseAspectRatio } from "../kit/theme";
import { FocusLayer, useFocusStore } from "../kit/cartesian/focus-layer";
import type { FocusedRow } from "../kit/cartesian/context-bridge";
import type { SeriesBarSpec } from "./bars";
import { childOrder } from "./series-order";
import { composedStaticCss } from "./static-css";
import type { ComposedChartProps } from "./types";
import { useComposedBuild } from "./use-composed-build";
import { useComposedContext } from "./use-composed-context";
import type { SeriesBarProps } from "./series-bar";

const DEFAULT_BAR_GAP = 4;
let nextUid = 0;

/** First non-empty colour, like `a || b || c` on optional strings. */
const firstColor = (...colors: readonly (string | undefined)[]): string | undefined => colors.find((c) => c !== undefined && c !== "");

export const ComposedChartMounted = ({
  data,
  xDataKey = "date",
  animationDuration = DEFAULT_ANIMATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  barSize,
  maxBarSize,
  barGap = DEFAULT_BAR_GAP,
  stacked = false,
  stackGap = 0,
  enterTransition,
  revealSignature = "",
  children,
  ariaLabel = "Composed chart",
  ariaDescription,
  initialWidth,
  initialHeight,
}: Readonly<ComposedChartProps & { initialWidth: number; initialHeight: number }>): ReactElement => {
  useEffect(() => {
    onPhaseChange?.("ready");
  }, [onPhaseChange]);

  const duration = enterTransition?.duration === undefined ? animationDuration : enterTransition.duration * 1000;
  const [uid] = useState(() => {
    nextUid += 1;
    return `c${nextUid.toString(36)}`;
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Measured by the wrapper before this mounts (a later width change would cancel the entrance); bar px widths derive from it.
  const [width, setWidth] = useState(initialWidth);
  // A rect enters natively only into a painted scene: paint once with zero-height bar seeds, then flip `entered` so the keyed
  // bars UPDATE (grow, staggered by the mark `motion`): one build, nothing re-resolves during it (the reveal-end snap is in the easing).
  const [enteredSig, setEnteredSig] = useState<string | null>(null);
  const entered = enteredSig === revealSignature;
  // Read by the bar mark `motion` while the renderer reconciles the entered render (layout effect),
  // cleared in the passive effect after it so later updates (hover, resize) are not staggered.
  const growing = useRef<number | null>(null);
  useEffect(() => {
    growing.current = null;
  }, [entered]);
  // The entrance waits for <RevealArm> (bklit's reveal trigger, the commit after mount); it re-fires when the signature changes.
  // The same trigger starts the interaction ready timer (useReadyGate): hover is inert until then.
  const { arm: armReady, store: readyStore } = useReadyGate(containerRef, duration);
  const enter = useCallback(() => {
    growing.current = performance.now();
    setEnteredSig(revealSignature);
    armReady();
  }, [revealSignature, armReady]);

  // Hover lives in a ref store read only by <FocusLayer>: no re-render / rebuild of the chart on focus.
  const focusStore = useFocusStore<FocusedRow>();

  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const { table, custom, ready: childrenReady } = useChildTable(children);
  const series = useMemo(() => resolveSeries(table), [table]);
  const orderKey = childOrder(children).join("\u0000");
  const order = useMemo(() => orderKey.split("\u0000").filter(Boolean), [orderKey]);
  const bars = useMemo<SeriesBarSpec[]>(
    () =>
      propsFor<SeriesBarProps>(table, "seriesBar").flatMap((p) =>
        p.dataKey === ""
          ? []
          : [
              {
                dataKey: p.dataKey,
                fill: p.fill ?? DEFAULT_LINE_STROKE,
                dotColor: firstColor(p.stroke, p.fill) ?? DEFAULT_LINE_STROKE,
                radius: p.radius ?? 0,
                animate: p.animate ?? true,
                fadedOpacity: p.fadedOpacity ?? 0.3,
              },
            ],
      ),
    [table],
  );

  const built = useComposedBuild({ data, xDataKey, table, series, bars, order, margin, uid, duration, width, aspectRatio, barSize, maxBarSize, barGap, stacked, stackGap, entered, growing });

  const renderer = useMemo(() => motion({ transition: { type: "tween", duration } }), [duration]);
  const tooltipOptions = useMemo(() => {
    const t = propsFor<NonNullable<Parameters<typeof bklitTooltipOptions>[0]>>(table, "tooltip").at(0);
    const colors: Record<string, string> = Object.fromEntries(series.map((s) => [s.dataKey, s.stroke]));
    for (const bar of bars) {
      colors[bar.dataKey] = bar.dotColor;
    }
    return bklitTooltipOptions(t, data, { order, colors });
  }, [table, series, bars, order, data]);

  const style = useMemo<CSSProperties & { readonly "--bkm-enter-ms": string }>(() => ({ width: "100%", position: "relative", aspectRatio, ...bklitSurfaceStyle, "--bkm-enter-ms": `${duration}ms` }), [aspectRatio, duration]);

  const { geom: hostGeom, sync: syncHost, drag: dragHost, press: pressHost } = useHoverHostSync(containerRef);
  // bklit's drag selection (kit/cartesian/drag-select.ts): the press hides the tooltip and bar fade, the drag dims the series (host attributes only).
  const dragGeom = useRef<DragGeom>({ left: 0, top: 0, innerWidth: 0, innerHeight: 0 });
  const { interaction: dragInteraction, onRender: onDragRender } = useDragSelect(containerRef, dragGeom, { drag: dragHost, press: pressHost });
  const { useContextValue, innerWidth, innerHeight, rows, times } = useComposedContext({ initialSize: { width: Math.round(initialWidth), height: Math.round(initialHeight) }, containerRef, ready: readyStore, data, xDataKey, margin, domains: built.domains, series, bars, duration, barSize, maxBarSize, barGap, stacked, stackGap, table, interaction: dragInteraction });
  const xStartMs = built.domains.x[0].getTime();
  const xSpanMs = built.domains.x[1].getTime() - xStartMs;
  dragGeom.current = { left: margin.left, top: margin.top, innerWidth, innerHeight };
  // Before the entrance a width change would cancel it, so the first measure is final; after it the bar widths follow
  // `onRender({ scene })` (`ChartScene extends ChartSize`, dom-types.ts:243), the guard stopping the rebuild loop.
  const onRender = useCallback(
    (context: Parameters<typeof onDragRender>[0]): void => {
      onDragRender(context);
      if (entered) {
        setWidth((current) => (context.scene.width > 0 && context.scene.width !== current ? context.scene.width : current));
      }
    },
    [onDragRender, entered],
  );
  // Keyboard-held focus survives a pointer pass (kit/cartesian/keyboard-hold.ts, UPSTREAM-GAPS #42).
  const holdFocus = useKeyboardFocusHold(containerRef, () => dragInteraction.current);
  hostGeom.current = { times: built.hover.times, left: margin.left, xStart: xStartMs, xSpan: xSpanMs, innerWidth, signs: built.hover.plSigns, pillLayout: built.pillTicks.active ? pillLayoutOf(built.pillTicks.times) : null };
  const staticCss = useMemo(() => composedStaticCss({ uid, built, bars, order, series }), [uid, built, bars, order, series]);
  const timesRef = useRef(times);
  timesRef.current = times;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const onFocusChange = useCallback(
    (point: ChartPoint<Row, Date, number> | null) => {
      holdFocus(point);
      const time = point ? point.xValue.getTime() : null;
      const index = time === null ? -1 : timesRef.current.indexOf(time);
      focusStore.set(index < 0 ? null : { row: rowsRef.current[index], index });
      const host = containerRef.current;
      if (host) {
        const pt = built.pillTicks;
        syncPillHost(host, pt.times, xSpanMs, innerWidth, index < 0 ? null : time, index);
        syncHost(index < 0 ? null : time);
        writePresence(host, "data-bkm-bi", index >= 0);
      }
    },
    [focusStore, built.pillTicks, xSpanMs, innerWidth, syncHost, holdFocus],
  );
  const tooltipRef = useRef(tooltipOptions);
  tooltipRef.current = tooltipOptions;
  const renderTooltipBody = useCallback(
    ({ points }: ChartTooltipBodyRenderContext<Row, Date, number>) => <BklitTooltipBody points={points} options={tooltipRef.current} />,
    [],
  );
  // SAFETY: the composed definition has no tooltip-host typed part; the host string only narrows `tooltip`, which this build never sets by host.
  const domDefinition = built.definition as DomChartDefinition<Row, Date, number>;
  return (
    <div ref={containerRef} className={className} data-bkm-chart="composed" data-slot="chart" data-bkm-kit={uid} {...built.gridAttrs} style={style}>
      {staticCss ? <style>{staticCss}</style> : null}
      {built.hover.highlights.length > 0 ? <HighlightBandClip id={built.hover.bandClip} /> : null}
      <LegendHostSync hostRef={containerRef} />
      <RevealArm hostRef={containerRef} onArm={enter} />
      {width > 0 && childrenReady && (
        <RendererChart<Row, Date, number>
          key={revealSignature}
          definition={domDefinition}
          idPrefix={uid}
          renderer={renderer}
          aspectRatio={parseAspectRatio(aspectRatio)}
          ariaLabel={ariaLabel}
          ariaDescription={ariaDescription}
          onFocusChange={onFocusChange}
          onRender={erase(onRender)}
          renderTooltipBody={renderTooltipBody}
          tooltipEqual={sameCategoryTarget}
        />
      )}
      <FocusLayer store={focusStore} useContextValue={useContextValue}>
        {custom}
      </FocusLayer>
    </div>
  );
};
