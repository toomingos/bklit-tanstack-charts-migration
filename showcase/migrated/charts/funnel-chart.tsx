// Bklit FunnelChart on TanStack Charts 1.1: one custom mark lays the stages out from the final plot bounds (concentric ring areas, gradient fill),
// hover dim, pop-out and entrance are static CSS (styles.css), and hover/keyboard focus is a cell-containment focus strategy.
"use client";

import { writeHoverIndex } from "./kit/host-write";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { defineChart } from "@tanstack/charts/scene";
import { motion } from "@tanstack/charts/motion";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import type { ChartInteractionController, ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import type { Transition } from "./kit/motion/phase";
import { buildFunnelGradients, createFunnelMark, popExtra, stageColor } from "./funnel/marks";
import type { FunnelGradientStopInput, FunnelMarkConfig, FunnelStageInput } from "./funnel/marks";
import { createFunnelFocus, FUNNEL_FOCUS_LAYER } from "./funnel/focus";
import { ResourceHost, scopeResourceIds, translatePatterns } from "./kit/resource-host";
import { funnelEntranceVars, funnelHoverVars, MAX_STAGES } from "./funnel/host-vars";
import { createFunnelPop } from "./funnel/pop-spring";
import type { FunnelPop } from "./funnel/pop-spring";
import type { FunnelDatum } from "./funnel/focus";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { intFmt } from "./kit/format";
import { EntranceAlign, useRenderStart } from "./kit/entrance/entrance-align";
import type { EntranceOrigin } from "./kit/entrance/entrance-origin";
import { useTapFocus } from "./kit/touch-focus";
import { useSanitizedId } from "./kit/use-sanitized-id";
import { useHydrating, useHydratingAttrs } from "./kit/use-hydrating";

const FUNNEL_ENTRANCE_ORIGINS = { "bkm-funnel-grow": "motion", "bkm-funnel-label-in": "frame" } as const satisfies Readonly<Record<string, EntranceOrigin>>;

/** One colour stop of a stage `gradient`: an `offset` and a `color`. */
type FunnelGradientStop = FunnelGradientStopInput;
/** One stage of a `FunnelChart`: `label`, `value`, and optional `displayValue`, `color` and `gradient`. */
type FunnelStage = FunnelStageInput & {
  /** Colour stops for a linear gradient on this stage. Takes precedence over `color` for the innermost ring; the outer halo rings use the first stop as a solid colour. */
  readonly gradient?: FunnelGradientStop[];
};
/** Stack direction of grouped funnel labels. */
type FunnelLabelOrientation = "vertical" | "horizontal";
/** Where grouped funnel labels sit in their segment. */
type FunnelLabelAlign = "center" | "start" | "end";

/** Props for `FunnelChart`. */
interface FunnelChartProps {
  /** The stages, in order from widest to narrowest. The chart renders nothing when this is empty. */
  readonly data: FunnelStage[];
  /**
   * `"horizontal"` lays the stages out left to right; `"vertical"` top to bottom.
   * @default "horizontal"
   */
  readonly orientation?: "horizontal" | "vertical";
  /**
   * Default colour of the stages. A stage's own `color` or `gradient` overrides it.
   * @default "var(--chart-1)"
   */
  readonly color?: string;
  /**
   * Number of concentric halo rings drawn for each stage.
   * @default 3
   */
  readonly layers?: number;
  /** Extra class name for the chart container. */
  readonly className?: string;
  /** Inline styles for the chart container. */
  readonly style?: CSSProperties;
  /**
   * Show each stage's share of the first stage as a badge.
   * @default true
   */
  readonly showPercentage?: boolean;
  /**
   * Show each stage's value.
   * @default true
   */
  readonly showValues?: boolean;
  /**
   * Show each stage's name.
   * @default true
   */
  readonly showLabels?: boolean;
  /**
   * Index of the hovered stage, for controlled hover. Pass `null` for no hover; leave it `undefined` to let the chart manage hover itself.
   */
  readonly hoveredIndex?: number | null;
  /** Called with the index of the hovered or keyboard-focused stage, or `null` when hover ends. */
  readonly onHoverChange?: (index: number | null) => void;
  /** Formats a percentage (0 to 100) for the badge. Defaults to a rounded whole number with a `%` sign. */
  readonly formatPercentage?: (pct: number) => string;
  /** Formats a stage value for display. Defaults to a whole number with locale grouping. */
  readonly formatValue?: (value: number) => string;
  /**
   * Delay between one stage's entrance and the next, in seconds.
   * @default 0.12
   */
  readonly staggerDelay?: number;
  /**
   * Transition for the stage entrance. Only `duration` (seconds, default 1.1) and a four-number cubic-bezier `ease` are used.
   */
  readonly enterTransition?: Transition;
  /**
   * Gap between stages in pixels.
   * @default 4
   */
  readonly gap?: number;
  /**
   * Returns a pattern definition (for example an SVG `<pattern>`) for each stage, called with a unique `id` and the stage colour. The pattern paints the innermost ring; the outer halo rings stay solid.
   */
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  /**
   * `"curved"` joins stages with smooth curves; `"straight"` uses straight edges.
   * @default "curved"
   */
  readonly edges?: "curved" | "straight";
  /**
   * `"spread"` places the value, percentage and name apart within the segment; `"grouped"` stacks them together.
   * @default "spread"
   */
  readonly labelLayout?: "spread" | "grouped";
  /**
   * Stack direction of grouped labels. Only used with `labelLayout="grouped"`. Defaults to `"vertical"` for horizontal funnels and `"horizontal"` for vertical ones.
   */
  readonly labelOrientation?: FunnelLabelOrientation;
  /**
   * Where grouped labels sit in their segment: `"center"`, `"start"` (top or left) or `"end"` (bottom or right). Only used with `labelLayout="grouped"`.
   * @default "center"
   */
  readonly labelAlign?: FunnelLabelAlign;
  /**
   * Background bands and grid lines. `true` enables both with default styling; an object adjusts them. Off by default.
   * @default false
   */
  readonly grid?:
    | boolean
    | {
        /**
         * Show alternating background bands behind the stages.
         * @default true
         */
        readonly bands?: boolean;
        /**
         * Colour of the background bands.
         * @default "var(--bkm-muted)"
         */
        readonly bandColor?: string;
        /**
         * Show grid lines at each gap between stages.
         * @default true
         */
        readonly lines?: boolean;
        /**
         * Colour of the grid lines.
         * @default "var(--chart-grid)"
         */
        readonly lineColor?: string;
        /**
         * Opacity of the grid lines, from 0 to 1.
         * @default 1
         */
        readonly lineOpacity?: number;
        /**
         * Width of the grid lines in pixels.
         * @default 1
         */
        readonly lineWidth?: number;
      };
  /**
   * Accessible name of the chart.
   * @default "Funnel chart"
   */
  readonly ariaLabel?: string;
  /** Longer accessible description of the chart. */
  readonly ariaDescription?: string;
}

// `initial: "always"` replays the entrance on mount; updates (hover pop-out) use the marks' own spring motion.
const RENDERER = motion({ initial: "always", respectReducedMotion: true, transition: { duration: 200, easing: "ease-out", type: "tween" } });
const ASPECT_HORIZONTAL = 2.2;
const ASPECT_VERTICAL = 1 / 1.8;
const fmtPct = (pct: number): string => `${Math.round(pct)}%`;
const CHART_STYLE: CSSProperties = { overflow: "visible", width: "100%" };

type ResolvedGrid = NonNullable<FunnelMarkConfig["grid"]>;

const resolveGrid = (grid: FunnelChartProps["grid"]): ResolvedGrid | null => {
  if (grid === false || grid === undefined) {return null;}
  const options = grid === true ? {} : grid;
  const lines = options.lines ?? true;
  const bands = options.bands ?? true;
  return {
    bandColor: options.bandColor ?? "var(--bkm-muted)",
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

/**
 * Funnel chart that shows how a value narrows across ordered stages, such as a sales pipeline. Each stage is drawn as a segment with halo rings, sized relative to the first stage, with its value, percentage and name.
 * Hovering or keyboard-focusing a stage pops it out and dims the others. Server-rendered; the entrance plays after hydration.
 */
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
  // The hovered stage drives ring pop-out; the plot size is TanStack's own container measure (the mark lays out in `resolveLayout`).
  const hostRef = useRef<HTMLDivElement | null>(null);
  const aspect = horizontal ? ASPECT_HORIZONTAL : ASPECT_VERTICAL;
  // Only a renderPattern needs the width in React (tile origins per stage); it arrives with the first render and costs the pattern users one commit.
  const [patternWidth, setPatternWidth] = useState(0);
  // Ring pop springs (pop-spring.ts): velocity-preserving retarget on a hover change; the resting pop is static CSS.
  const popRef = useRef<FunnelPop | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) { return undefined; }
    const pop = createFunnelPop(host, { horizontal, layers: Math.max(1, layers), popOf: popExtra });
    popRef.current = pop;
    return (): void => { pop.dispose(); popRef.current = null; };
  }, [horizontal, layers]);
  // A stage's rings remount at its bklit enterComplete, stage * staggerDelay + duration (funnel-chart.tsx:241-244,268-269 vs :319-320, use-enter-complete.ts:12-27, use-mount-progress.ts:21-24):
  // a hovered stage springs up from rest again then.
  useEffect(() => {
    const durationSec = enterTransition?.duration ?? 1.1;
    const timers: number[] = [];
    for (let stage = 0; stage < Math.min(data.length, MAX_STAGES); stage += 1) {
      // Per-stage enterComplete at stage * staggerDelay + duration: use-enter-complete.ts:12-27, funnel-chart.tsx:244,268 (UPSTREAM-GAPS #38).
      timers.push(window.setTimeout(() => { popRef.current?.restart(stage); }, (stage * staggerDelay + durationSec) * 1000));
    }
    return (): void => { for (const timer of timers) { window.clearTimeout(timer); } };
    // Replays only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Hover never touches React state or the definition: the focused stage is written to the host as `data-hover` and the
  // static rules in styles.css do the dim, pop-out and label dim.
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
  const stagePx = ((horizontal ? patternWidth : patternWidth / aspect) + gap) / Math.max(1, data.length);

  // Accepted divergence (SSR only): the hydrating render repeats the server's fallback label measurements so the markup matches;
  // the next render measures with canvas, so pills and label baselines can shift by up to ~7px after hydration. Client-only mounts measure from the first frame.
  const hydrating = useHydrating();
  const hydratingAttrs = useHydratingAttrs();
  const definition = useMemo(() => {
    const stageAxis = scaleLinear().domain(horizontal ? [0, data.length] : [data.length, 0]);
    const crossAxis = scaleLinear().domain([-0.5, 0.5]);
    return defineChart({
      focus: createFunnelFocus(horizontal),
      focusRing: false,
      gradients: buildFunnelGradients(data, horizontal),
      guides: false,
      margin: { bottom: 0, left: 0, right: 0, top: 0 },
      marks: [createFunnelMark({
        color,
        curved: edges === "curved",
        formatPercentage,
        formatValue,
        gapPx: gap,
        grid: gridConfig,
        horizontal,
        labelAlign,
        labelLayout,
        labelOrientation,
        layers: Math.max(1, layers),
        measureText: !hydrating,
        patternPrefix: hasPattern ? patternPrefix : undefined,
        showLabels,
        showPercentage,
        showValues,
        stages: data,
      })],
      scales: horizontal ? { x: { scale: stageAxis }, y: { scale: crossAxis } } : { x: { scale: crossAxis }, y: { scale: stageAxis } },
    });
  }, [color, data, edges, hydrating, patternPrefix, hasPattern, labelAlign, labelLayout, labelOrientation, formatPercentage, formatValue, gap, gridConfig, horizontal, layers, showLabels, showPercentage, showValues]);

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
    if (hasPattern) { setPatternWidth(context.scene.width); }
    applyControlledHover();
  }, [applyControlledHover, hasPattern]);

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

  const hoverVars = useMemo(() => funnelHoverVars(Math.max(1, layers), horizontal, popExtra), [layers, horizontal]);

  const entranceVars = useMemo(() => funnelEntranceVars({
    durationSec: enterTransition?.duration ?? 1.1, ease: Array.isArray(enterTransition?.ease) ? enterTransition.ease : undefined, horizontal, staggerDelaySec: staggerDelay,
  }), [enterTransition?.duration, enterTransition?.ease, horizontal, staggerDelay]);

  const hostStyle = useMemo((): CSSProperties => ({ position: "relative", userSelect: "none", width: "100%", ...hoverVars, ...entranceVars, ...style }), [hoverVars, entranceVars, style]);

  if (data.length === 0) {return null;}

  // Entrance starts on the first draw, without bklit's measure-effect re-render (funnel-chart.tsx:798-803), at the user's direction (no frame waits); the curve is unchanged.
  return (
    <div className={className} data-bkm-chart="funnel" {...hydratingAttrs} data-slot="chart" ref={hostRef} style={hostStyle}>
      <EntranceAlign hostRef={hostRef} renderStart={renderStart} origins={FUNNEL_ENTRANCE_ORIGINS} />
      <RendererChart
        ariaDescription={ariaDescription}
        ariaLabel={ariaLabel ?? "Funnel chart"}
        aspectRatio={aspect}
        definition={definition}
        idPrefix={idPrefix}
        onFocusChange={handleFocusChange}
        onRender={handleRender}
        renderer={RENDERER}
        style={CHART_STYLE}
      />
      {renderPattern ? <ResourceHost idPrefix={patternPrefix} resources={stagePatterns(data, renderPattern, { color, horizontal, patternPrefix, stagePx })} /> : null}
    </div>
  );
};

FunnelChart.displayName = "FunnelChart";

export { FunnelChart };
export type { FunnelChartProps, FunnelGradientStop, FunnelStage };
