"use client";
// Bklit RadarChart on TanStack Charts 1.0 native polar marks: radialLine rings, radialRule spokes,
// radialText labels, radialArea + radialDot series, mark `states` for hover emphasis, `motion()` for entrances.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { motion } from "@tanstack/charts/motion";
import type { ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import type { RadarEnterTransition } from "./radar/transition";
import { RadarProvider } from "./radar/context";
import { RADAR_ENTRANCE_CSS, RADAR_ENTRANCE_ORIGINS, radarEntranceVars } from "./radar/entrance";
import { EntranceAlign, useRenderStart } from "./kit/entrance/entrance-align";
import { MAX_SERIES, RADAR_HOVER_CSS } from "./radar/hover-css";
import { springRadarHover } from "./radar/hover-springs";
import { createHoverSource } from "./kit/polar/polar-hover";
import { buildDefinition, GRID_STAGGER_MS, isAreaPoint, LABEL_OFFSET, MS_BASE_DURATION, SERIES_BASE_MS, SERIES_STAGGER_MS } from "./radar/definition";
import type { ResolvedArea } from "./radar/definition";
import { extract } from "./radar/extract";
import { RADAR_VALUE_MAX } from "./radar/rows";
import type { RadarData, RadarMetric, RadarRow } from "./radar/rows";
import { DEFAULT_RADAR_COLORS, radarAreaColor } from "./radar/area";
import type { RadarLabelsProps } from "./radar/labels";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { useTapFocus } from "./kit/touch-focus";
import { clearAttribute, raiseAttribute, readHoverIndex, writeHoverIndex, writeVar } from "./kit/host-write";
import { joinClasses } from "./kit/cn";
import { TAU } from "./kit/polar/tau";

export type { RadarData, RadarMetric } from "./radar/rows";
export type { RadarAreaProps } from "./radar/area";
export type { RadarAxisProps } from "./radar/axis";
export type { RadarGridProps } from "./radar/grid";
export type { RadarLabelsProps } from "./radar/labels";
export { DEFAULT_RADAR_COLORS } from "./radar/area";
export { RadarArea } from "./radar/area";
export { RadarAxis } from "./radar/axis";
export { RadarGrid } from "./radar/grid";
export { RadarLabels } from "./radar/labels";

const DEFAULT_LEVELS = 5;
const DEFAULT_MARGIN = 60;
const DEFAULT_ENTER_MS = 1100;
const MIN_SIZE = 10;
const DEFAULT_VIEWBOX = 400;

const radarMotion = motion({ initial: "always", respectReducedMotion: true });
const GLOW_ATTR = "data-bkm-glow";

interface PointPosition {
  readonly x: number;
  readonly y: number;
}

// SAFETY: these keys are JSON.stringify of the same-typed prop (or null), made in RadarChart for the memo dependency lists.
const parseTransitionKey = (key: string): RadarEnterTransition | null => JSON.parse(key) as RadarEnterTransition | null;
// SAFETY: as parseTransitionKey, for the labels config.
const parseLabelsKey = (key: string): RadarLabelsProps | null => JSON.parse(key) as RadarLabelsProps | null;

/** Props for `RadarChart`. */
export interface RadarChartProps {
  /**
   * The series to draw, one polygon each. Every item holds a `values` record keyed by metric `key`; the series index is what `RadarArea` refers to with `index`.
   */
  readonly data: RadarData[];
  /**
   * The metrics, one spoke each, in clockwise order from 12 o'clock. A metric's `key` selects its value in every series' `values`, and its `label` is what `RadarLabels` prints.
   */
  readonly metrics: RadarMetric[];
  /** Chart width and height in pixels. Omit to fill the width of the parent element; the chart stays square. */
  readonly size?: number;
  /**
   * Number of concentric grid rings drawn by `RadarGrid`. Ring `n` marks `n / levels` of the 0 to 100 value scale.
   * @default 5
   */
  readonly levels?: number;
  /**
   * Space in pixels kept free around the chart for the metric labels.
   * @default 60
   */
  readonly margin?: number;
  /**
   * Play the entrance animation. Set `false` to draw the chart immediately.
   * @default true
   */
  readonly animate?: boolean;
  /**
   * Total time budget of the entrance animation in milliseconds. Grid, labels and series timings scale with it.
   * @default 1100
   */
  readonly enterDurationMs?: number;
  /**
   * Multiplier for the delays between grid rings, labels and series during the entrance. `0` starts everything together.
   * @default 1
   */
  readonly staggerScale?: number;
  /**
   * Transition for the series entrance, in the shape used by the `motion` library (`type: "spring"` with spring values, or a tween with `duration` in seconds and `ease`). Defaults to a 1.1 second tween on the shared reveal curve.
   */
  readonly enterTransition?: RadarEnterTransition;
  /**
   * Changing this string replays the entrance animation.
   * @default ""
   */
  readonly motionReplayKey?: string;
  /**
   * Index of the hovered series, for controlled hover. Pass `null` for no hover; leave it `undefined` to let the chart manage hover itself.
   */
  readonly hoveredIndex?: number | null;
  /** Called with the index of the hovered or keyboard-focused series, or `null` when hover ends. */
  readonly onHoverChange?: (index: number | null) => void;
  /** Extra class name for the chart container. */
  readonly className?: string;
  /** Inline styles for the chart container, merged over the default sizing. */
  readonly style?: CSSProperties;
  /**
   * The parts to draw: `RadarGrid`, `RadarAxis`, `RadarLabels` and one `RadarArea` per series. Only the parts you include are drawn.
   */
  readonly children: ReactNode;
  /**
   * Accessible name of the chart.
   * @default "Radar chart"
   */
  readonly ariaLabel?: string;
  /** Longer accessible description of the chart. */
  readonly ariaDescription?: string;
}

/**
 * Radar (spider) chart that compares several series across the same set of metrics. Compose it from `RadarGrid`, `RadarAxis`, `RadarLabels` and one `RadarArea` per series.
 * Hovering or keyboard-focusing a series enlarges it and dims the others. The chart is drawn on the client after mount; on the server it renders an empty shell.
 */
export const RadarChart = ({
  data,
  metrics,
  size,
  levels = DEFAULT_LEVELS,
  margin = DEFAULT_MARGIN,
  animate = true,
  enterDurationMs = DEFAULT_ENTER_MS,
  staggerScale = 1,
  enterTransition,
  motionReplayKey = "",
  hoveredIndex,
  onHoverChange,
  className,
  style,
  children,
  ariaLabel = "Radar chart",
  ariaDescription,
}: Readonly<RadarChartProps>): ReactElement | null => {
  const renderStart = useRenderStart();
  const extracted = extract(children);
  const { grid, axis, labels } = extracted;
  const areasKey = JSON.stringify(extracted.areas);
  const gridKey = JSON.stringify(grid ?? null);
  const axisKey = JSON.stringify(axis ?? null);
  const labelsKey = JSON.stringify(labels ?? null);
  const transitionKey = JSON.stringify(enterTransition ?? null);

  // Hover never touches React state or the definition: the hovered series lives in a store mirrored onto the host as
  // `data-hover` / `--bkm-radar-glow`; static CSS (radar/hover-css.ts) does the scale, emphasis, glow and dim.
  const [source] = useState(() => createHoverSource());
  const hostRef = useRef<HTMLDivElement | null>(null);
  // The scene mounts after the host commits (before paint), the same gate pie/ring/funnel use: the renderer then mounts once instead of
  // being created, torn down and recreated by the dev double-mount of an initial-tree child, which replays every entrance animation.
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => { setMounted(true); }, []);
  // bklit's label / dot / grid-label fades are WAAPI opacity and its dot travel and label glide are JS tweens; re-stamp ours to those origins
  // (kit/entrance/entrance-origin.ts). The scene mounts in the commit the layout effect above schedules, so its CSS animations exist by frame N + 1.
  const areasRef = useRef(extracted.areas);
  areasRef.current = extracted.areas;
  const dataRef = useRef(data);
  dataRef.current = data;

  const definition = useMemo(() => {
    const resolved: ResolvedArea[] = [];
    for (const a of extracted.areas) {
      if (Number.isInteger(a.index) && a.index >= 0 && a.index < data.length) {
        resolved.push({
          className: a.className,
          color: radarAreaColor(a, data),
          index: a.index,
          showGlow: a.showGlow ?? true,
          showPoints: a.showPoints ?? true,
          showStroke: a.showStroke ?? true,
        });
      }
    }
    if (metrics.length === 0) { return undefined; }
    return buildDefinition({ animate, areas: resolved, axis, data, enterDurationMs, enterTransition, grid, labels, levels, margin, metrics, radius: Math.max(1, ((size ?? DEFAULT_VIEWBOX) - margin * 2) / 2), staggerScale });
    // Children props are keyed by value so hover re-renders never rebuild the definition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, areasKey, axisKey, data, enterDurationMs, transitionKey, gridKey, labelsKey, levels, margin, metrics, size, staggerScale]);

  // Controlled hover: bklit's hoveredIndex drives native controlled focus; native focus reports back.
  const sceneRef = useRef<ChartRendererRenderContext<RadarRow, string | number, number> | null>(null);
  const lastReported = useRef<number | null>(null);
  const onHoverRef = useRef(onHoverChange);
  onHoverRef.current = onHoverChange;

  const hoveredRef = useRef(hoveredIndex);
  hoveredRef.current = hoveredIndex;

  useTapFocus(hostRef, () => sceneRef.current?.interaction, { mode: "tap" });
  const onRender = useCallback((context: ChartRendererRenderContext<RadarRow, string | number, number>) => { sceneRef.current = context; }, []);
  const holdFocus = useKeyboardFocusHold(hostRef, () => sceneRef.current?.interaction);
  const onFocusChange = useCallback((point: ChartPoint<RadarRow, string | number, number> | null) => {
    holdFocus(point);
    const next = point && isAreaPoint(point) ? point.datum.series : null;
    if (lastReported.current === next) { return; }
    lastReported.current = next;
    if (hoveredRef.current === undefined) { source.setHovered(next); }
    onHoverRef.current?.(next);
  }, [holdFocus, source]);

  // Mirror the store onto the host (imperative: no render).
  useEffect(() => {
    const apply = (): void => {
      const host = hostRef.current;
      if (!host) { return; }
      const raw = source.getHovered();
      const index = raw === null || raw >= MAX_SERIES ? null : raw;
      const previous = readHoverIndex(host);
      writeHoverIndex(host, index);
      springRadarHover(host, previous, index);
      if (index === null) {
        clearAttribute(host, GLOW_ATTR);
        return;
      }
      const area = areasRef.current.find((a) => a.index === index);
      // Host glow attribute (UPSTREAM-GAPS #31: a mark `states` glow would repaint the scene on hover).
      if (area?.showGlow ?? true) { raiseAttribute(host, GLOW_ATTR); } else { clearAttribute(host, GLOW_ATTR); }
      if (area !== undefined) { writeVar(host, "--bkm-radar-glow", radarAreaColor(area, dataRef.current)); }
    };
    apply();
    return source.subscribe(apply);
  }, [source]);

  useEffect(() => {
    if (hoveredIndex !== undefined) { source.setHovered(hoveredIndex); }
  }, [hoveredIndex, source]);

  useEffect(() => {
    if (hoveredIndex === undefined || lastReported.current === hoveredIndex) { return; }
    lastReported.current = hoveredIndex;
    const context = sceneRef.current;
    if (!context) { return; }
    const point = hoveredIndex === null ? null : context.scene.points.find((p) => isAreaPoint(p) && p.datum.series === hoveredIndex) ?? null;
    context.interaction.setControlledFocus(point, { source: "pointer" });
  }, [hoveredIndex]);

  const setHoveredIndex = useCallback((index: number | null) => {
    const context = sceneRef.current;
    if (!context) { return; }
    const point = index === null ? null : context.scene.points.find((p) => isAreaPoint(p) && p.datum.series === index) ?? null;
    context.interaction.setControlledFocus(point, { source: "pointer" });
  }, []);
  const contextValue = useMemo(() => {
    const px = size ?? 0;
    const radius = Math.max(0, (px - margin * 2) / 2);
    const step = TAU / Math.max(1, metrics.length);
    const getAngle = (i: number): number => i * step - Math.PI / 2;
    const yScale = (v: number): number => (v / RADAR_VALUE_MAX) * radius;
    return {
      animate, data: [...data], enterDurationMs, getAngle,
      getColor: (i: number): string => data.at(i)?.color ?? DEFAULT_RADAR_COLORS.at(i % DEFAULT_RADAR_COLORS.length) ?? "var(--chart-1)",
      getPointPosition: (i: number, v: number): PointPosition => ({ x: yScale(v) * Math.cos(getAngle(i)), y: yScale(v) * Math.sin(getAngle(i)) }),
      levels, metrics: [...metrics], motionReplayKey, radius, setHoveredIndex, size: px, staggerScale, yScale,
    };
  }, [animate, data, enterDurationMs, levels, margin, metrics, motionReplayKey, setHoveredIndex, size, staggerScale]);

  // Entrance pieces 1.0 text/dot motion cannot express: fixed-text CSS (radar/entrance.ts) driven by host vars.
  const entranceVars = useMemo(() => {
    const df = enterDurationMs / MS_BASE_DURATION;
    return radarEntranceVars({
      enterDurationMs,
      enterTransition: parseTransitionKey(transitionKey) ?? undefined,
      labelOffset: parseLabelsKey(labelsKey)?.offset ?? LABEL_OFFSET,
      levels,
      margin,
      metricCount: metrics.length,
      seriesBaseMs: (levels * GRID_STAGGER_MS * staggerScale * df + SERIES_BASE_MS) * df,
      seriesStepMs: SERIES_STAGGER_MS * staggerScale * df,
      size: size ?? DEFAULT_VIEWBOX,
      staggerScale,
    });
  }, [enterDurationMs, labelsKey, levels, margin, metrics.length, size, staggerScale, transitionKey]);

  const hasSize = size !== undefined && size > 0;
  const hostStyle = useMemo((): CSSProperties => {
    const out: CSSProperties = {};
    if (hasSize) { out.height = size; out.width = size; }
    if (animate) { Object.assign(out, entranceVars); }
    return Object.assign(out, style);
  }, [animate, entranceVars, hasSize, size, style]);

  if (!definition || (size !== undefined && size < MIN_SIZE)) { return null; }

  return (
    <RadarProvider source={source} value={contextValue}>
    <div
      data-bkm-enter={animate ? "" : undefined}
      data-bkm-radar=""
      ref={hostRef}
      className={joinClasses("bk-radar", hasSize ? "bk-radar-fixed" : "bk-radar-fluid", className)}
      style={hostStyle}
    >
      <style>{RADAR_HOVER_CSS + RADAR_ENTRANCE_CSS}</style>
      {mounted && animate ? <EntranceAlign hostRef={hostRef} renderStart={renderStart} key={`align-${motionReplayKey}`} origins={RADAR_ENTRANCE_ORIGINS} /> : null}
      {mounted ? <RendererChart
        ariaDescription={ariaDescription}
        ariaLabel={ariaLabel}
        aspectRatio={1}
        definition={definition}
        height={size}
        key={motionReplayKey}
        onFocusChange={onFocusChange}
        onRender={onRender}
        renderer={radarMotion}
        width={size}
      /> : null}
    </div>
    </RadarProvider>
  );
};
