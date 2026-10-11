// Bklit FunnelChart on TanStack Charts 1.0: stages are native area marks (concentric rings, gradient fill), hover dim is static CSS,
// the entrance is the `motion()` renderer with a per-stage delay, and hover/keyboard focus is a cell-containment focus strategy.
"use client";

import { clearAttribute, raiseAttribute, writeHoverIndex } from "./kit/host-write";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts/scene";
import { motion } from "@tanstack/charts/motion";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import type { ChartInteractionController, ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import type { Transition } from "./kit/motion/phase";
import { toMotionTransition } from "./kit/motion/enter-transition";
import { buildFunnelGradients, createFunnelMarks, dimmedRingOpacity, popExtra, ringOpacity, stageColor } from "./funnel/marks";
import type { FunnelGradientStopInput, FunnelStageInput } from "./funnel/marks";
import { createFunnelFocus, FUNNEL_FOCUS_LAYER } from "./funnel/focus";
import { ResourceHost, scopeResourceIds, translatePatterns } from "./kit/resource-host";
import { FUNNEL_ENTRANCE_CSS, funnelEntranceVars } from "./funnel/entrance-css";
import { funnelHoverCss, funnelHoverVars, MAX_STAGES } from "./funnel/hover-css";
import { createFunnelPop } from "./funnel/pop-spring";
import type { FunnelPop } from "./funnel/pop-spring";
import type { FunnelDatum } from "./funnel/focus";
import { useKeyboardFocusHold } from "./kit/cartesian/keyboard-hold";
import { intFmt } from "./kit/format";
import { useFluidWidth } from "./kit/size/use-fluid-width";
import { EntranceAlign, useRenderStart } from "./kit/entrance/entrance-align";
import type { EntranceOrigin } from "./kit/entrance/entrance-origin";
import { useTapFocus } from "./kit/cartesian/touch-focus";
import "./styles.css";
import { useSanitizedId } from "./kit/use-sanitized-id";

const FUNNEL_ENTRANCE_ORIGINS = { "bkm-funnel-grow": "motion", "bkm-funnel-label-in": "frame" } as const satisfies Readonly<Record<string, EntranceOrigin>>;

type FunnelGradientStop = FunnelGradientStopInput;
type FunnelStage = FunnelStageInput & { readonly gradient?: FunnelGradientStop[] };
type FunnelLabelOrientation = "vertical" | "horizontal";
type FunnelLabelAlign = "center" | "start" | "end";

interface FunnelChartProps {
  readonly data: FunnelStage[];
  readonly orientation?: "horizontal" | "vertical";
  readonly color?: string;
  readonly layers?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly showPercentage?: boolean;
  readonly showValues?: boolean;
  readonly showLabels?: boolean;
  readonly hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly formatPercentage?: (pct: number) => string;
  readonly formatValue?: (value: number) => string;
  /** Seconds between stage entrances. */
  readonly staggerDelay?: number;
  readonly enterTransition?: Transition;
  /** Pixel gap between stages (approximated in chart units). */
  readonly gap?: number;
  /** Visx-style pattern definition per stage; paints the innermost ring while the outer halo rings stay solid. */
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly edges?: "curved" | "straight";
  readonly labelLayout?: "spread" | "grouped";
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign?: FunnelLabelAlign;
  readonly grid?:
    | boolean
    | {
        readonly bands?: boolean;
        readonly bandColor?: string;
        readonly lines?: boolean;
        readonly lineColor?: string;
        readonly lineOpacity?: number;
        readonly lineWidth?: number;
      };
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

// `initial: "always"` replays the entrance on mount; updates (hover pop-out) use the marks' own spring motion.
const RENDERER = motion({ initial: "always", respectReducedMotion: true, transition: { duration: 200, easing: "ease-out", type: "tween" } });
const ASPECT_HORIZONTAL = 2.2;
const ASPECT_VERTICAL = 1 / 1.8;
const fmtPct = (pct: number): string => `${Math.round(pct)}%`;
const CHART_STYLE: CSSProperties = { overflow: "visible", width: "100%" };

type ResolvedGrid = NonNullable<Parameters<typeof createFunnelMarks>[0]["grid"]>;

const resolveGrid = (grid: FunnelChartProps["grid"]): ResolvedGrid | null => {
  if (grid === false || grid === undefined) {return null;}
  const options = grid === true ? {} : grid;
  const lines = options.lines ?? true;
  const bands = options.bands ?? true;
  return {
    bandColor: options.bandColor ?? "var(--color-muted)",
    bands,
    lineColor: options.lineColor ?? "var(--chart-grid)",
    lineOpacity: options.lineOpacity ?? 1,
    lines,
    lineWidth: options.lineWidth ?? 1,
  };
};

interface StagePatternOptions {
  readonly color: string;
  readonly horizontal: boolean;
  readonly patternPrefix: string;
  readonly stagePx: number;
}

const stagePatterns = (
  data: readonly FunnelStage[],
  renderPattern: NonNullable<FunnelChartProps["renderPattern"]>,
  { color, horizontal, patternPrefix, stagePx }: Readonly<StagePatternOptions>,
): ReactElement[] => data.map((stage, index) => {
  const pattern = scopeResourceIds(renderPattern(`${patternPrefix}-${index}`, stageColor(stage, color)), patternPrefix);
  const offset = index * stagePx;
  return <Fragment key={`${stage.label}-${patternPrefix}`}>{translatePatterns(pattern, horizontal ? offset : 0, horizontal ? 0 : offset)}</Fragment>;
});

const FunnelChart = ({
  data,
  orientation = "horizontal",
  color = "var(--chart-1)",
  layers = 3,
  className,
  style,
  showPercentage = true,
  showValues = true,
  showLabels = true,
  hoveredIndex,
  onHoverChange,
  formatPercentage = fmtPct,
  formatValue = intFmt,
  staggerDelay = 0.12,
  renderPattern,
  enterTransition,
  gap = 4,
  edges = "curved",
  labelLayout = "spread",
  labelOrientation,
  labelAlign = "center",
  grid = false,
  ariaLabel,
  ariaDescription,
}: Readonly<FunnelChartProps>): ReactElement | null => {
  const renderStart = useRenderStart();
  const idPrefix = useSanitizedId();
  // Pattern defs live in a hidden resource host (url(#id) resolves document-wide). The definition keys on whether a pattern exists, never on the
  // render function's identity, so an inline renderPattern cannot rebuild it.
  const patternPrefix = `${idPrefix}-fp`;
  const hasPattern = renderPattern !== undefined;
  const horizontal = orientation === "horizontal";
  const gridConfig = resolveGrid(grid);
  // Measured plot size drives the px-based gap and label geometry; the hovered stage drives ring pop-out.
  // The host is measured once before <Chart> mounts (kit/size/use-fluid-width.ts), so no post-mount resize rebuilds the definition.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const aspect = horizontal ? ASPECT_HORIZONTAL : ASPECT_VERTICAL;
  const { ready: measured, width } = useFluidWidth(hostRef, { epsilon: 0.01, initialWidth: 640 });
  const size = useMemo(() => ({ height: width / aspect, width }), [width, aspect]);
  // Ring pop springs (pop-spring.ts): velocity-preserving retarget on a hover change; the resting pop is static CSS.
  const popRef = useRef<FunnelPop | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) { return undefined; }
    const pop = createFunnelPop(host, { horizontal, layers: Math.max(1, layers), popOf: popExtra });
    popRef.current = pop;
    return (): void => { pop.dispose(); popRef.current = null; };
  }, [horizontal, layers]);
  // Gates the entrance CSS (data-entering on the host) so definition rebuilds on hover never replay it; cleared once the stagger ends.
  const [entering, setEntering] = useState(true);
  // A stage's rings remount at its bklit enterComplete, stage * staggerDelay + duration (funnel-chart.tsx:241-244,268-269 vs :319-320, use-enter-complete.ts:12-27, use-mount-progress.ts:21-24);
  // `data-g<stage>` is held until then and its removal restarts the pop spring. `data-entering` ends with the last label fade (:653-654, :722-723).
  useEffect(() => {
    const host = hostRef.current;
    const durationSec = enterTransition?.duration ?? 1.1;
    const timers: number[] = [];
    for (let stage = 0; stage < Math.min(data.length, MAX_STAGES); stage += 1) {
      raiseAttribute(host, `data-g${stage}`);
      // Per-stage enterComplete at stage * staggerDelay + duration: use-enter-complete.ts:12-27, funnel-chart.tsx:244,268 (UPSTREAM-GAPS #38).
      timers.push(window.setTimeout(() => { clearAttribute(host, `data-g${stage}`); popRef.current?.restart(stage); }, (stage * staggerDelay + durationSec) * 1000));
    }
    const last = Math.max(0, data.length - 1) * staggerDelay;
    // Ends with the last label fade (0.25s delay + 0.35s): funnel-chart.tsx:653-654, :722-723; timers because there is no motion-finished signal (UPSTREAM-GAPS #38).
    timers.push(window.setTimeout(() => { setEntering(false); }, (last + Math.max(durationSec, 0.25 + 0.35)) * 1000));
    return (): void => { for (const timer of timers) { window.clearTimeout(timer); } };
    // Replays only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Hover never touches React state or the definition: the focused stage is written to the host as `data-hover` and the
  // static rules in funnel/hover-css.ts do the dim, pop-out and label dim.
  const applyHover = useCallback((stage: number | null): void => {
    const host = hostRef.current;
    if (!host) { return; }
    // Beyond the rule cap a stage has no emphasis rules: leave the host un-hovered rather than dimming everything.
    const capped = stage === null || stage >= MAX_STAGES ? null : stage;
    writeHoverIndex(host, capped);
    popRef.current?.to(capped);
  }, []);

  // bklit paints each stage in its own svg, so a pattern's tile origin is the stage's top-left; here every stage shares the plot's
  // origin, so each stage's pattern is shifted by its stage offset when the resources are rendered.
  const stagePx = ((horizontal ? size.width : size.height) + gap) / Math.max(1, data.length);

  const definition = useMemo(() => {
    // Not mounted until measured: building at the 640px placeholder would be swapped for the real size one commit later.
    if (!measured) { return null; }
    const { marks } = createFunnelMarks({
      color,
      curved: edges === "curved",
      fontFamily: hostRef.current ? getComputedStyle(hostRef.current).fontFamily : "ui-sans-serif, system-ui, sans-serif",
      formatPercentage,
      formatValue,
      gapPx: gap,
      labelAlign,
      labelLayout,
      labelOrientation,
      size,
      grid: gridConfig,
      horizontal,
      layers: Math.max(1, layers),
      patternPrefix: hasPattern ? patternPrefix : undefined,
      showLabels,
      showPercentage,
      showValues,
      stages: data,
      transition: toMotionTransition(enterTransition),
    });
    const stageAxis = scaleLinear().domain(horizontal ? [0, data.length] : [data.length, 0]);
    const crossAxis = scaleLinear().domain([-0.5, 0.5]);
    return defineChart({
      focus: createFunnelFocus(horizontal),
      focusRing: false,
      gradients: buildFunnelGradients(data, horizontal),
      guides: false,
      margin: { bottom: 0, left: 0, right: 0, top: 0 },
      marks,
      scales: horizontal ? { x: { scale: stageAxis }, y: { scale: crossAxis } } : { x: { scale: crossAxis }, y: { scale: stageAxis } },
    });
    // staggerDelay is not read here but stays a dependency so a stagger change still rebuilds the definition as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, color, data, edges, patternPrefix, hasPattern, enterTransition, labelAlign, labelLayout, labelOrientation, size, formatPercentage, formatValue, gap, gridConfig, horizontal, layers, showLabels, showPercentage, showValues, staggerDelay]);

  // Controlled hover: drive the same native focus the pointer would.
  const interactionRef = useRef<ChartInteractionController<FunnelDatum, number, number> | null>(null);
  const sceneRef = useRef<ChartRendererRenderContext<FunnelDatum, number, number>["scene"] | null>(null);
  const hoveredRef = useRef(hoveredIndex);
  hoveredRef.current = hoveredIndex;
  useTapFocus(hostRef, () => interactionRef.current, { mode: "tap" });
  const applyControlledHover = useCallback((): void => {
    const interaction = interactionRef.current;
    const target = hoveredRef.current;
    if (!interaction || target === undefined) {return;}
    if (target === null) {
      interaction.setControlledFocus(null);
      return;
    }
    const point = sceneRef.current?.points.find((candidate) => candidate.datum.stage === target && candidate.datum.layer === FUNNEL_FOCUS_LAYER);
    if (point) {interaction.setControlledFocus(point);}
  }, []);
  useEffect(() => {
    if (hoveredIndex !== undefined) { applyHover(hoveredIndex); }
    applyControlledHover();
  }, [applyControlledHover, applyHover, hoveredIndex]);

  const handleRender = useCallback((context: ChartRendererRenderContext<FunnelDatum, number, number>): void => {
    interactionRef.current = context.interaction;
    sceneRef.current = context.scene;
    applyControlledHover();
  }, [applyControlledHover]);

  const lastStageRef = useRef<number | null>(null);
  const onHoverChangeRef = useRef(onHoverChange);
  onHoverChangeRef.current = onHoverChange;
  const holdFocus = useKeyboardFocusHold(hostRef, () => interactionRef.current);
  const handleFocusChange = useCallback((point: ChartPoint<FunnelDatum, number, number> | null) => {
    holdFocus(point);
    // A rebuild with new datum objects re-reports the same stage (core dedupes only on identity + Object.is datum); one commit per stage.
    const stage = point ? point.datum.stage : null;
    if (stage === lastStageRef.current) {return;}
    lastStageRef.current = stage;
    applyHover(stage);
    onHoverChangeRef.current?.(stage);
  }, [applyHover, holdFocus]);

  const hoverVars = useMemo(() => funnelHoverVars(Math.max(1, layers), horizontal, ringOpacity, dimmedRingOpacity, popExtra), [layers, horizontal]);

  const entranceVars = useMemo(() => funnelEntranceVars({
    durationSec: enterTransition?.duration ?? 1.1, ease: Array.isArray(enterTransition?.ease) ? enterTransition.ease : undefined, horizontal, staggerDelaySec: staggerDelay,
  }), [enterTransition?.duration, enterTransition?.ease, horizontal, staggerDelay]);

  const hostStyle = useMemo((): CSSProperties => ({ position: "relative", userSelect: "none", width: "100%", ...hoverVars, ...entranceVars, ...style }), [hoverVars, entranceVars, style]);

  if (data.length === 0) {return null;}

  return (
    <div className={className} data-bkm-chart="funnel" data-entering={entering ? "" : undefined} data-slot="chart" ref={hostRef} style={hostStyle}>
      <style>{FUNNEL_ENTRANCE_CSS + funnelHoverCss(Math.max(1, layers))}</style>
      {measured ? <EntranceAlign hostRef={hostRef} renderStart={renderStart} origins={FUNNEL_ENTRANCE_ORIGINS} /> : null}
      {measured && definition !== null ? <RendererChart
        ariaDescription={ariaDescription}
        ariaLabel={ariaLabel ?? "Funnel chart"}
        definition={definition}
        height={size.height}
        idPrefix={idPrefix}
        initialWidth={640}
        onFocusChange={handleFocusChange}
        onRender={handleRender}
        renderer={RENDERER}
        style={CHART_STYLE}
        width={size.width}
      /> : null}
      {renderPattern ? <ResourceHost idPrefix={patternPrefix} resources={stagePatterns(data, renderPattern, { color, horizontal, patternPrefix, stagePx })} /> : null}
    </div>
  );
};

FunnelChart.displayName = "FunnelChart";

export { FunnelChart };
export type { FunnelChartProps, FunnelGradientStop, FunnelStage };
