// Migrated bklit-ui RadarChart — same public API, rendered by TanStack
// Charts' `polar()` mark family (@tanstack/charts/polar).
//
// Architecture: TanStack-native polar marks + WAAPI deferred reveal
// (matching bklit's useMountProgress flow: grid 0.08s stagger → axis
// spokes 0.05s → area 0.6s+0.15s*i with 1100ms cubic-bezier). Hover uses
// focus:"nearest" + useLayoutEffect DOM walk (area dim/glow/scale/dot r).

import * as React from "react";
import { scaleLinear, scalePoint } from "d3-scale";
import { curveLinearClosed } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { angleGrid, polar, radialArea, radialDot } from "@tanstack/charts/polar";
import type { PolarGuide } from "@tanstack/charts/polar";
import { CHART_ROLE, roleOf } from "./children";
import {
  bklitRadarGrid,
  buildRadarProgressKeyframes,
  radarRevealTiming,
  resolveRadarEnterTransition,
} from "./internal/radar-reveal";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { useMeasuredRect } from "./internal";
import "./styles.css";

const DEFAULT_LEVELS = 5;
const DEFAULT_MARGIN = 60;

const RADAR_BORDER_VAR = "var(--border)";
const RADAR_LABEL_VAR = "var(--chart-label, oklch(0.65 0.01 260))";
const RADAR_FOREGROUND_MUTED_VAR = "var(--chart-foreground-muted)";
const RADAR_BACKGROUND_VAR = "var(--chart-background)";
const DEFAULT_RADAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const LABEL_DEFAULT_OFFSET = 24;
const LABEL_DEFAULT_FONT_SIZE = 11;

const Z_PAD = 5;

// Shared reveal-flight guard used by both the mount and motionReplayKey
// replay layout effects: bails when TanStack's own motions are still live
// (e.g. mid data-update reconcile) so WAAPI reveal anims never stomp them.
function hasLiveRevealAnims(container: HTMLElement): boolean {
  const els = container.querySelectorAll('[data-ts-key^="radar-area:"]');
  for (const el of els) {
    if ((el as unknown as { getAnimations?: () => Animation[] }).getAnimations?.().length) return true;
  }
  const fallback = container.querySelectorAll(".ts-chart__radial-area path");
  for (const el of fallback) {
    if ((el as unknown as { getAnimations?: () => Animation[] }).getAnimations?.().length) return true;
  }
  return false;
}

const HOVER_SCALE = 1.05;
const FILL_OPACITY_HOVER = 0.35;
const FILL_OPACITY_REST = 0.15;
const STROKE_WIDTH_HOVER = 3;
const STROKE_WIDTH_REST = 2;
const DOT_R_HOVER = 6;
const DOT_R_REST = 4;

export interface RadarMetric {
  key: string;
  label: string;
}

export interface RadarData {
  label: string;
  color?: string;
  values: Record<string, number>;
}

export interface RadarEnterTransition {
  type?: "spring" | "tween";
  duration?: number;
  ease?: readonly [number, number, number, number];
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export interface RadarChartProps {
  data: RadarData[];
  metrics: RadarMetric[];
  size?: number;
  levels?: number;
  margin?: number;
  animate?: boolean;
  enterDurationMs?: number;
  staggerScale?: number;
  enterTransition?: RadarEnterTransition;
  motionReplayKey?: string;
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const ROLE_GRID = "radar-grid";
const ROLE_AXIS = "radar-axis";
const ROLE_LABELS = "radar-labels";
const ROLE_AREA = "radar-area";

type RoleCarrier = { [CHART_ROLE]?: string };

export interface RadarGridProps {
  showLabels?: boolean;
  stroke?: string;
  strokeOpacity?: number;
  className?: string;
}
export function RadarGrid(_props: RadarGridProps): null { return null; }
(RadarGrid as RoleCarrier)[CHART_ROLE] = ROLE_GRID;

export interface RadarAxisProps {
  stroke?: string;
  strokeOpacity?: number;
  className?: string;
}
export function RadarAxis(_props: RadarAxisProps): null { return null; }
(RadarAxis as RoleCarrier)[CHART_ROLE] = ROLE_AXIS;

export interface RadarLabelsProps {
  offset?: number;
  fontSize?: number;
  interactive?: boolean;
  className?: string;
}
export function RadarLabels(_props: RadarLabelsProps): null { return null; }
(RadarLabels as RoleCarrier)[CHART_ROLE] = ROLE_LABELS;

export interface RadarAreaProps {
  index: number;
  color?: string;
  showPoints?: boolean;
  showStroke?: boolean;
  showGlow?: boolean;
  className?: string;
}
export function RadarArea(_props: RadarAreaProps): null { return null; }
(RadarArea as RoleCarrier)[CHART_ROLE] = ROLE_AREA;

interface ExtractedRadarChildren {
  grid: RadarGridProps | null;
  axis: RadarAxisProps | null;
  labels: RadarLabelsProps | null;
  areas: RadarAreaProps[];
}

function extractRadarChildren(children: React.ReactNode): ExtractedRadarChildren {
  const out: ExtractedRadarChildren = { grid: null, axis: null, labels: null, areas: [] };
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      const role = roleOf(child.type);
      const props = child.props as never;
      if (role === ROLE_GRID) out.grid = props;
      else if (role === ROLE_AXIS) out.axis = props;
      else if (role === ROLE_LABELS) out.labels = props;
      else if (role === ROLE_AREA) out.areas.push(props);
    }
  };
  visit(children);
  return out;
}

interface ResolvedRadarArea {
  index: number;
  datum: RadarData;
  color: string;
  showPoints: boolean;
  showStroke: boolean;
  showGlow: boolean;
  className: string;
}

interface RadarRow {
  metric: string;
  value: number;
  series: string;
}

export function RadarChart({
  data,
  metrics,
  size: fixedSize,
  levels = DEFAULT_LEVELS,
  margin = DEFAULT_MARGIN,
  animate = true,
  enterDurationMs = 1100,
  staggerScale = 1,
  enterTransition,
  motionReplayKey = "",
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  className,
  style,
  children,
}: RadarChartProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { width, height } = useMeasuredRect(containerRef, !fixedSize);
  const chartSize = fixedSize ?? Math.min(width, height);

  const { grid, axis, labels, areas } = React.useMemo(
    () => extractRadarChildren(children),
    [children],
  );

  const isControlled = controlledHoveredIndex !== undefined;
  const [internalHoveredIndex, setInternalHoveredIndex] = React.useState<number | null>(null);
  const hoveredIndex = isControlled ? (controlledHoveredIndex ?? null) : internalHoveredIndex;

  const setHoveredIndex = React.useCallback(
    (index: number | null | ((prev: number | null) => number | null)) => {
      const next = typeof index === "function" ? (index as (p: number | null) => number | null)(isControlled ? controlledHoveredIndex ?? null : internalHoveredIndex) : index;
      if (isControlled) {
        onHoverChange?.(next);
      } else {
        setInternalHoveredIndex(next);
      }
    },
    [isControlled, onHoverChange, controlledHoveredIndex, internalHoveredIndex],
  );

  const areaPathsRef = React.useRef<SVGPathElement[]>([]);
  const dotCirclesRef = React.useRef<SVGCircleElement[]>([]);
  const pendingRevealRef = React.useRef<Map<number, Animation>>(new Map());
  const seenRevealedRef = React.useRef<Set<number>>(new Set());
  const revealAnimsRef = React.useRef<Animation[]>([]);
  const revealDeadlineTimerRef = React.useRef<number | null>(null);
  const revealPostPaintCancelRef = React.useRef<(() => void) | null>(null);
  const isMountedRef = React.useRef(true);

  const colorForIndex = React.useCallback(
    (index: number): string => {
      const item = data[index];
      if (item?.color) return item.color;
      return DEFAULT_RADAR_COLORS[index % DEFAULT_RADAR_COLORS.length]!;
    },
    [data],
  );

  const resolvedAreas = React.useMemo<ResolvedRadarArea[]>(() => {
    const out: ResolvedRadarArea[] = [];
    for (const area of areas) {
      const datum = data[area.index];
      if (!datum) continue;
      out.push({
        index: area.index,
        datum,
        color: area.color ?? colorForIndex(area.index),
        showPoints: area.showPoints ?? true,
        showStroke: area.showStroke ?? true,
        showGlow: area.showGlow ?? true,
        className: area.className ?? "",
      });
    }
    return out;
  }, [areas, data, colorForIndex]);

  const metricKeys = React.useMemo(() => metrics.map((m) => m.key), [metrics]);
  const hoverInputsRef = React.useRef({
    resolvedAreas,
    metricKeysLength: metricKeys.length,
  });
  hoverInputsRef.current = {
    resolvedAreas,
    metricKeysLength: metricKeys.length,
  };

  const metricLabelByKey = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const metric of metrics) map.set(metric.key, metric.label);
    return map;
  }, [metrics]);

  const allRows = React.useMemo<RadarRow[]>(() => {
    const out: RadarRow[] = [];
    for (let i = 0; i < resolvedAreas.length; i++) {
      const area = resolvedAreas[i]!;
      for (const metric of metrics) {
        out.push({
          metric: metric.key,
          value: area.datum.values[metric.key] ?? 0,
          series: String(i).padStart(Z_PAD, "0"),
        });
      }
    }
    return out;
  }, [resolvedAreas, metrics]);

  // TanStack definition: animate disabled — reveal is WAAPI deferred (bklit parity).
  const definition = React.useMemo(() => {
    if (chartSize < 10 || resolvedAreas.length === 0 || metricKeys.length === 0) return null;

    const guides: PolarGuide[] = [];
    if (grid) {
      guides.push(
        bklitRadarGrid({
          levels,
          metricsCount: metricKeys.length,
          stroke: grid.stroke ?? RADAR_BORDER_VAR,
          strokeOpacity: grid.strokeOpacity ?? 0.6,
          showLabels: grid.showLabels ?? true,
          className: grid.className,
          labelClassName: "ts-bkm-radar-grid-labels",
          labelFill: RADAR_FOREGROUND_MUTED_VAR,
        }),
      );
    }

    if (axis || labels) {
      const spokeOptions = axis
        ? {
            className: axis.className
              ? `ts-bkm-radar-spokes ${axis.className}`
              : "ts-bkm-radar-spokes",
            stroke: axis.stroke ?? RADAR_BORDER_VAR,
            strokeOpacity: axis.strokeOpacity ?? 0.6,
            strokeWidth: 1,
          }
        : { strokeWidth: 0 };
      const labelOptions = labels
        ? {
            labels: true as const,
            labelOffset: labels.offset ?? LABEL_DEFAULT_OFFSET,
            labelFontSize: labels.fontSize ?? LABEL_DEFAULT_FONT_SIZE,
            labelAnchor: "middle" as const,
            labelBaseline: "middle" as const,
            labelFill: RADAR_LABEL_VAR,
            labelClassName: [
              "ts-bkm-radar-axis-labels",
              labels.interactive ? "ts-bkm-radar-axis-labels--interactive" : "",
              labels.className ?? "",
            ]
              .filter(Boolean)
              .join(" "),
            format: (value: unknown) =>
              metricLabelByKey.get(String(value)) ?? String(value),
          }
        : { labels: false as const };
      guides.push(angleGrid({ ...spokeOptions, ...labelOptions }));
    }

    return defineChart({
      marks: [
        polar({
          id: "radar",
          angle: { scale: scalePoint<string>().domain(metricKeys) },
          radius: { scale: scaleLinear().domain([0, 100]) },
          guides,
          marks: [
            radialArea(allRows, {
              id: "radar-area",
              angle: "metric",
              radius: "value",
              z: "series",
              key: "metric",
              curve: curveLinearClosed,
              fill: (row: RadarRow) => {
                const idx = parseInt(row.series, 10);
                const i = Math.min(idx, resolvedAreas.length - 1);
                return resolvedAreas[i]?.color ?? DEFAULT_RADAR_COLORS[0]!;
              },
              fillOpacity: 0.15,
              stroke: (row: RadarRow) => {
                const idx = parseInt(row.series, 10);
                const i = Math.min(idx, resolvedAreas.length - 1);
                const area = resolvedAreas[i];
                return area?.showStroke ? (area.color ?? DEFAULT_RADAR_COLORS[0]!) : "none";
              },
              strokeWidth: 2,
            }),
            radialDot(allRows, {
              id: "radar-dot",
              angle: "metric",
              radius: "value",
              z: "series",
              key: "metric",
              r: 4,
              fill: (row: RadarRow) => {
                const idx = parseInt(row.series, 10);
                const i = Math.min(idx, resolvedAreas.length - 1);
                return resolvedAreas[i]?.color ?? DEFAULT_RADAR_COLORS[0]!;
              },
              stroke: RADAR_BACKGROUND_VAR,
              strokeWidth: 2,
            }),
          ],
        }),
      ],
      margin,
      guides: false,
      x: null,
      y: null,
      animate: false,
      focus: focusDisabled,
      tooltip: false,
    });
  }, [
    chartSize,
    grid,
    axis,
    labels,
    levels,
    metricKeys,
    metricLabelByKey,
    resolvedAreas,
    allRows,
    margin,
  ]);

  const enterTransitionRef = React.useRef(enterTransition);
  enterTransitionRef.current = enterTransition;
  const enterStaggerScaleRef = React.useRef(staggerScale);
  enterStaggerScaleRef.current = staggerScale;
  const enterDurationMsRef = React.useRef(enterDurationMs);
  enterDurationMsRef.current = enterDurationMs;
  const animateRef = React.useRef(animate);
  animateRef.current = animate;
  // First-commit value; the replay layout effect below only fires on an
  // actual key CHANGE (bklit's `key={`...-${motionReplayKey}`}` remounts).
  const prevMotionReplayKeyRef = React.useRef(motionReplayKey);

  const handleRender = React.useCallback(
    ({ container }: { container: HTMLElement }) => {
      if (!animateRef.current) return;
      const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks") as SVGGElement | null;
      if (!marksGroup) return;

      const { resolvedAreas: currAreas, metricKeysLength: metricsLen } = hoverInputsRef.current;
      if (currAreas.length === 0) return;

      for (const v of seenRevealedRef.current) {
        if (v >= currAreas.length) seenRevealedRef.current.delete(v);
      }

      let areaEls = marksGroup.querySelectorAll<SVGPathElement>('path[data-ts-key^="radar-area:"]');
      if (areaEls.length === 0) areaEls = container.querySelectorAll<SVGPathElement>(".ts-chart__radial-area path");
      areaPathsRef.current = Array.from(areaEls);

      let dotEls = marksGroup.querySelectorAll<SVGCircleElement>('circle[data-ts-key^="radar-dot:"]');
      if (dotEls.length === 0) dotEls = container.querySelectorAll<SVGCircleElement>(".ts-chart__radial-dot circle");
      dotCirclesRef.current = Array.from(dotEls);

      const toReveal: number[] = [];
      for (let i = 0; i < currAreas.length; i++) {
        if (seenRevealedRef.current.has(i)) continue;
        if (!areaPathsRef.current[i]) continue;
        seenRevealedRef.current.add(i);
        toReveal.push(i);
      }
      if (toReveal.length === 0) return;

      const svgForBkm = container.querySelector<SVGElement>("svg.ts-chart") as SVGElement | null;
      if (svgForBkm && !svgForBkm.getAttribute("data-bkm-revealed")) {
        svgForBkm.setAttribute("data-bkm-revealed", "1");
      }
      marksGroup.classList.add("ts-chart__marks--revealing");

      const resolved = resolveRadarEnterTransition(enterTransitionRef.current);
      const timing = radarRevealTiming(resolved);
      const staggerScale = enterStaggerScaleRef.current;
      // bklit `durationFactor = enterDurationMs / 1100` (radar-grid.tsx /
      // radar-area.tsx): a pure delay scaler for grid/area/label stagger,
      // INDEPENDENT of the transition's own tween/spring timing.
      const durationFactor = enterDurationMsRef.current / 1100;
      const gridStaggerMs = 80 * staggerScale * durationFactor;
      const campaignBaseDelayMs = (5 * gridStaggerMs * 0.5 + 200) * durationFactor;

      const maxStagger = Math.max(
        ...toReveal.map((idx) => campaignBaseDelayMs + idx * 150 * staggerScale * durationFactor),
        0,
      );
      revealDeadlineTimerRef.current = setRevealDeadline(timing.durationMs + maxStagger, {
        animationsRef: revealAnimsRef,
        onDeadline: () => {},
      });

      for (const idx of toReveal) {
        pendingRevealRef.current.set(idx, {} as unknown as Animation);
      }

      revealPostPaintCancelRef.current = onPostPaint(() => {
        const liveMarksGroup = container.querySelector<SVGGElement>(".ts-chart__marks") as SVGGElement | null;
        if (!liveMarksGroup) return;

        let liveAreaEls = liveMarksGroup.querySelectorAll<SVGPathElement>('path[data-ts-key^="radar-area:"]');
        if (liveAreaEls.length === 0) liveAreaEls = container.querySelectorAll<SVGPathElement>(".ts-chart__radial-area path");
        let liveDotEls = liveMarksGroup.querySelectorAll<SVGCircleElement>('circle[data-ts-key^="radar-dot:"]');
        if (liveDotEls.length === 0) liveDotEls = container.querySelectorAll<SVGCircleElement>(".ts-chart__radial-dot circle");
        const liveAreaArr = Array.from(liveAreaEls);
        const liveDotArr = Array.from(liveDotEls);

        for (const areaIdx of toReveal) {
          const liveEl = liveAreaArr[areaIdx] ?? null;
          if (!liveEl) {
            pendingRevealRef.current.delete(areaIdx);
            continue;
          }
          const delayMs = campaignBaseDelayMs + areaIdx * 150 * staggerScale * durationFactor;
          const kfs = buildRadarProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` } as unknown as Keyframe));
          const anim = liveEl.animate(kfs, {
            duration: timing.durationMs,
            delay: delayMs,
            easing: timing.easing,
            fill: "backwards",
          });
          pendingRevealRef.current.set(areaIdx, anim);
          revealAnimsRef.current.push(anim);
          anim.onfinish = () => {
            anim.cancel();
            pendingRevealRef.current.delete(areaIdx);
          };
          anim.oncancel = () => pendingRevealRef.current.delete(areaIdx);
        }

        for (const areaIdx of toReveal) {
          const delayMs = campaignBaseDelayMs + areaIdx * 150 * staggerScale * durationFactor;
          const kfs = buildRadarProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` } as unknown as Keyframe));
          const start = areaIdx * metricsLen;
          for (let j = 0; j < metricsLen; j++) {
            const circle = liveDotArr[start + j] ?? null;
            if (!circle) continue;
            const anim = circle.animate(kfs, {
              duration: timing.durationMs,
              delay: delayMs,
              easing: timing.easing,
              fill: "backwards",
            });
            revealAnimsRef.current.push(anim);
            anim.onfinish = () => anim.cancel();
            anim.oncancel = () => anim.cancel();
          }
        }

        {
          const gridRings = liveMarksGroup.querySelectorAll<SVGPathElement>('[data-ts-key^="radar-ring:"]');
          const spokes = liveMarksGroup.querySelectorAll<SVGLineElement>('[data-ts-key^="spoke:"]');
          for (const el of gridRings) { (el as SVGElement).style.transform = ""; (el as SVGElement).style.opacity = ""; }
          for (const el of spokes) { (el as SVGElement).style.transform = ""; (el as SVGElement).style.opacity = ""; }
          const clearLabels = liveMarksGroup.querySelectorAll<HTMLElement>('[data-ts-key$=":labels"]');
          for (const g of clearLabels) for (const t of g.querySelectorAll<SVGTextElement>("text")) t.style.opacity = "";
          const gridLabelsGroup = (liveMarksGroup.querySelector('[data-ts-key="radar:bklit-radar-grid-0:labels"]') ??
            liveMarksGroup.querySelector('[data-ts-key="polar-0:bklit-radar-grid-0:labels"]') ??
            container.querySelector('[data-ts-key="radar:bklit-radar-grid-0:labels"]')) as HTMLElement | null;
          const angleLabelsGroup = (liveMarksGroup.querySelector('[data-ts-key="radar:angle-grid-1:labels"]') ??
            liveMarksGroup.querySelector('[data-ts-key="polar-0:angle-grid-1:labels"]') ??
            container.querySelector('[data-ts-key="radar:angle-grid-1:labels"]')) as HTMLElement | null;

          gridRings.forEach((path, i) => {
            const delay = i * gridStaggerMs;
            const kfScale = buildRadarProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` } as unknown as Keyframe));
            const kfOpacity = buildRadarProgressKeyframes(timing, (p) => ({ opacity: String(p) } as unknown as Keyframe));
            const a1 = path.animate(kfScale, { duration: timing.durationMs, delay, easing: timing.easing, fill: "backwards" });
            const a2 = path.animate(kfOpacity, { duration: timing.durationMs, delay, easing: timing.easing, fill: "backwards" });
            revealAnimsRef.current.push(a1, a2);
            a1.onfinish = () => a1.cancel();
            a2.onfinish = () => a2.cancel();
          });

          spokes.forEach((line, i) => {
            const delay = i * 50 * staggerScale * durationFactor;
            const kfScale = buildRadarProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` } as unknown as Keyframe));
            const kfOpacity = buildRadarProgressKeyframes(timing, (p) => ({ opacity: String(p) } as unknown as Keyframe));
            const a1 = line.animate(kfScale, { duration: timing.durationMs, delay, easing: timing.easing, fill: "backwards" });
            const a2 = line.animate(kfOpacity, { duration: timing.durationMs, delay, easing: timing.easing, fill: "backwards" });
            revealAnimsRef.current.push(a1, a2);
            a1.onfinish = () => a1.cancel();
            a2.onfinish = () => a2.cancel();
          });

          const labelGroups = [gridLabelsGroup, angleLabelsGroup].filter(Boolean) as HTMLElement[];
          labelGroups.forEach((g, gi) => {
            const baseDelay = 5 * gridStaggerMs * 0.5;
            const texts = g.querySelectorAll<SVGTextElement>("text");
            texts.forEach((t, i) => {
              const delay = baseDelay + i * (gi === 0 ? 60 : 80) * staggerScale * durationFactor;
              const kf = buildRadarProgressKeyframes(timing, (p) => ({ opacity: String(p) } as unknown as Keyframe));
              const anim = t.animate(kf, { duration: timing.durationMs * 0.5, delay, easing: timing.easing, fill: "backwards" });
              revealAnimsRef.current.push(anim);
              anim.onfinish = () => anim.cancel();
            });
          });
        }

        liveMarksGroup.classList.remove("ts-chart__marks--revealing");
      });
    },
    [],
  );

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const areaEls = container.querySelectorAll<SVGPathElement>(".ts-chart__radial-area path");
    const dotEls = container.querySelectorAll<SVGCircleElement>(".ts-chart__radial-dot circle");
    const areaArr = Array.from(areaEls);
    const dotArr = Array.from(dotEls);

    const applyHover = () => {
      const { resolvedAreas } = hoverInputsRef.current;
      const metricsLen = hoverInputsRef.current.metricKeysLength;

      for (let i = 0; i < resolvedAreas.length; i++) {
        const path = areaArr[i] ?? null;
        if (!path) continue;
        const isHovered = i === hoveredIndex;
        const isDimmed = hoveredIndex !== null && !isHovered;
        const area = resolvedAreas[i];

        path.style.opacity = isDimmed ? "0.3" : "1";
        path.style.fillOpacity = isHovered ? String(FILL_OPACITY_HOVER) : String(FILL_OPACITY_REST);
        path.style.strokeWidth = area?.showStroke ? String(isHovered ? STROKE_WIDTH_HOVER : STROKE_WIDTH_REST) : "0";
        path.style.filter = area?.showGlow && isHovered ? `drop-shadow(0 0 12px ${area.color})` : "none";

        if (!pendingRevealRef.current.has(i)) {
          path.style.transform = isHovered ? `scale(${HOVER_SCALE})` : "";
        }

        for (let j = 0; j < metricsLen; j++) {
          const circle = dotArr[i * metricsLen + j] ?? null;
          if (!circle) continue;
          circle.style.opacity = isDimmed ? "0.3" : "1";
          circle.setAttribute("r", String(isHovered ? DOT_R_HOVER : DOT_R_REST));
          if (!pendingRevealRef.current.has(i)) {
            circle.style.transform = isHovered ? `scale(${HOVER_SCALE})` : "";
          }
          circle.style.transformOrigin = "";
          circle.style.filter = area?.showGlow && isHovered ? `drop-shadow(0 0 8px ${area.color})` : "";
        }
      }

      if (dotArr.length > metricsLen * resolvedAreas.length) {
        for (let k = metricsLen * resolvedAreas.length; k < dotArr.length; k++) {
          const circle = dotArr[k];
          if (!circle) continue;
          circle.style.opacity = "1";
          circle.setAttribute("r", String(DOT_R_REST));
          circle.style.filter = "";
        }
      }
    };

    applyHover();

    const cleanups: (() => void)[] = [];

    for (let i = 0; i < areaArr.length; i++) {
      const path = areaArr[i];
      if (!path) continue;
      const idx = i;
      path.style.cursor = "pointer";
      const enter = () => {
        if (pendingRevealRef.current.has(idx)) return;
        setHoveredIndex(idx);
      };
      const leave = () => {
        if (pendingRevealRef.current.has(idx)) return;
        setHoveredIndex((prev: number | null) => (prev === idx ? null : prev));
      };
      path.addEventListener("pointerenter", enter);
      path.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        path.removeEventListener("pointerenter", enter);
        path.removeEventListener("pointerleave", leave);
      });
    }

    for (let i = 0; i < dotArr.length; i++) {
      const circle = dotArr[i];
      if (!circle) continue;
      const seriesIdx = Math.floor(i / Math.max(1, hoverInputsRef.current.metricKeysLength));
      circle.style.cursor = "pointer";
      const enter = () => {
        if (pendingRevealRef.current.has(seriesIdx)) return;
        setHoveredIndex(seriesIdx);
      };
      const leave = () => {
        if (pendingRevealRef.current.has(seriesIdx)) return;
        setHoveredIndex((prev: number | null) => (prev === seriesIdx ? null : prev));
      };
      circle.addEventListener("pointerenter", enter);
      circle.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        circle.removeEventListener("pointerenter", enter);
        circle.removeEventListener("pointerleave", leave);
      });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [hoveredIndex, resolvedAreas.length, metricKeys, setHoveredIndex]);

  React.useEffect(() => {
    const pendingReveal = pendingRevealRef.current;
    const revealAnims = revealAnimsRef.current;
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setTimeout(() => {
        if (isMountedRef.current) return;
        if (revealDeadlineTimerRef.current !== null) {
          window.clearTimeout(revealDeadlineTimerRef.current);
          revealDeadlineTimerRef.current = null;
        }
        revealPostPaintCancelRef.current?.();
        revealPostPaintCancelRef.current = null;
        for (const anim of pendingReveal.values()) {
          try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
        }
        pendingReveal.clear();
        for (const anim of revealAnims) {
          try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
        }
        revealAnimsRef.current = [];
      }, 0);
    };
  }, []);

  // Keep component TanStack-native: no imperative pre-paint hide here.
  // Flicker is handled inside handleRender → onPostPaint with fill:backwards WAAPI (zero wrappers).
  // Left intentionally minimal.

  React.useLayoutEffect(() => {
    if (seenRevealedRef.current.size > 0) return;
    if (!animateRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (seenRevealedRef.current.size > 0) return;
        if (!container.querySelector(".ts-chart__marks")) return;
        if (hasLiveRevealAnims(container)) return;
        handleRender({ container });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [handleRender]);

  // bklit `motionReplayKey` parity: in bklit it is spliced into the grid /
  // level-label / area `key`s and `useMountProgress(...)`'s replay token, so
  // changing it REMOUNTS those elements and re-runs the whole enter reveal.
  // There is no per-element key to remount in the TanStack scene (the DOM is
  // keyed by data, not by replay token), so the replay is expressed as a
  // full reveal-episode reset: cancel every live WAAPI reveal animation,
  // clear the seen/pending bookkeeping, then re-run handleRender through the
  // same double-rAF handoff the mount path uses (so the new fill:"backwards"
  // anims are created against the same freshly-painted frame the mount path
  // gets). Skipped entirely while `animate={false}` (bklit renders static).
  React.useLayoutEffect(() => {
    if (!animateRef.current) return;
    if (prevMotionReplayKeyRef.current === motionReplayKey) return;
    prevMotionReplayKeyRef.current = motionReplayKey;
    for (const anim of revealAnimsRef.current) {
      try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
    }
    revealAnimsRef.current = [];
    for (const anim of pendingRevealRef.current.values()) {
      try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
    }
    pendingRevealRef.current.clear();
    seenRevealedRef.current.clear();
    const container = containerRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!animateRef.current) return;
        if (!container.querySelector(".ts-chart__marks")) return;
        if (hasLiveRevealAnims(container)) return;
        handleRender({ container });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [motionReplayKey, handleRender]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...(fixedSize
          ? { width: fixedSize, height: fixedSize }
          : { width: "100%", aspectRatio: "1 / 1" }),
        ...style,
      }}
      data-bkm-chart="radar"
    >
      {definition ? (
        <Chart
          ariaLabel="Radar chart"
          width={chartSize}
          height={chartSize}
          definition={definition}
          onRender={handleRender}
        />
      ) : null}
    </div>
  );
}
