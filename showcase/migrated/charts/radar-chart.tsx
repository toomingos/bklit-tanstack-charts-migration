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
  motionReplayKey: _motionReplayKey,
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  className,
  style,
  children,
}: RadarChartProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    if (fixedSize) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setMeasured((prev) =>
        Math.abs(prev.width - rect.width) > 0.5 || Math.abs(prev.height - rect.height) > 0.5
          ? { width: rect.width, height: rect.height }
          : prev,
      );
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setMeasured({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, [fixedSize]);

  const chartSize = fixedSize ?? Math.min(measured.width, measured.height);

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

  const areaPathByKeyRef = React.useRef<Map<string, SVGPathElement>>(new Map());
  const dotCircleByKeyRef = React.useRef<Map<string, SVGCircleElement>>(new Map());
  const pendingRevealRef = React.useRef<Map<string, Animation>>(new Map());
  const seenRevealedRef = React.useRef<Set<string>>(new Set());
  const revealAnimsRef = React.useRef<Animation[]>([]);
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
          angle: { scale: scalePoint<string>().domain(metricKeys) },
          radius: { scale: scaleLinear().domain([0, 100]) },
          guides,
          marks: [
            radialArea(allRows, {
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
  const animateRef = React.useRef(animate);
  animateRef.current = animate;

  const handleRender = React.useCallback(
    ({ container }: { container: HTMLElement }) => {
      const areaPaths = container.querySelectorAll<SVGPathElement>(".ts-chart__radial-area path");
      const nextAreaMap = new Map<string, SVGPathElement>();
      for (const p of areaPaths) {
        const k = p.getAttribute("data-ts-key");
        if (k) nextAreaMap.set(k, p);
      }
      areaPathByKeyRef.current = nextAreaMap;

      const dotCircles = container.querySelectorAll<SVGCircleElement>(".ts-chart__radial-dot circle");
      const nextDotMap = new Map<string, SVGCircleElement>();
      for (const c of dotCircles) {
        const k = c.getAttribute("data-ts-key");
        if (k) nextDotMap.set(k, c);
      }
      dotCircleByKeyRef.current = nextDotMap;

      if (!animateRef.current) return;
      const svgForBkm = container.querySelector<SVGElement>("svg.ts-chart");
      if (!svgForBkm) return;
      if (svgForBkm.dataset.bkmRevealed === "1") return;

      const { resolvedAreas: currAreas } = hoverInputsRef.current;
      if (currAreas.length === 0) return;

      const toReveal: { key: string; pathEl: SVGPathElement; areaIndex: number }[] = [];
      for (let i = 0; i < currAreas.length; i++) {
        const key = `polar-0:radial-area-0:string:${String(i).padStart(Z_PAD, "0")}`;
        if (seenRevealedRef.current.has(key)) continue;
        const el = nextAreaMap.get(key);
        if (!el) continue;
        seenRevealedRef.current.add(key);
        toReveal.push({ key, pathEl: el, areaIndex: i });
      }
      if (toReveal.length === 0) {
        svgForBkm.dataset.bkmRevealed = "1";
        return;
      }

      svgForBkm.dataset.bkmRevealed = "1";
      const marksGroup = container.querySelector<HTMLElement>(".ts-chart__marks");
      marksGroup?.classList.add("ts-chart__marks--revealing");

      const resolved = resolveRadarEnterTransition(enterTransitionRef.current);
      const timing = radarRevealTiming(resolved);
      const staggerScale = enterStaggerScaleRef.current;
      const durationFactor = timing.durationMs / 1100;
      const gridStaggerMs = 80 * staggerScale * durationFactor;
      const campaignBaseDelayMs = (5 * gridStaggerMs * 0.5 + 200) * durationFactor;

      const maxStagger = Math.max(
        ...toReveal.map((r) => campaignBaseDelayMs + r.areaIndex * 150 * staggerScale * durationFactor),
        0,
      );
      setRevealDeadline(timing.durationMs + maxStagger, {
        animationsRef: revealAnimsRef,
        onDeadline: () => {},
      });

      // No-op: pre-hide now in useLayoutEffect before paint. Keep handleRender sync-free so WAAPI fill:backwards owns t=0.
      void nextDotMap;

      onPostPaint(() => {
        const liveContainer = container;
        const liveSvg = liveContainer.querySelector<SVGElement>("svg.ts-chart");
        if (!liveSvg) return;
        const liveMarksGroup = liveContainer.querySelector<HTMLElement>(".ts-chart__marks");

        for (const { key: revealKey, areaIndex } of toReveal) {
          const liveEl = liveContainer.querySelector(`[data-ts-key="${revealKey}"]`) as SVGPathElement | null;
          if (!liveEl) continue;
          const delayMs = campaignBaseDelayMs + areaIndex * 150 * staggerScale * durationFactor;
          // Scale 0->1 about polar center (translate 200,200). bklit: animatedPositions = target * t => uniform scale.
          const kfs = buildRadarProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` } as unknown as Keyframe));
          const anim = liveEl.animate(kfs, {
            duration: timing.durationMs,
            delay: delayMs,
            easing: timing.easing,
            fill: "backwards",
          });
          pendingRevealRef.current.set(revealKey, anim);
          revealAnimsRef.current.push(anim);
          anim.onfinish = () => {
            anim.cancel();
            pendingRevealRef.current.delete(revealKey);
          };
          anim.oncancel = () => pendingRevealRef.current.delete(revealKey);
        }

        // Reveal dots — circles use r/cx/cy animation (scale doesn't affect cx/cy). Animate cx/cy from 0 and r from 0.
        // TanStack radialDot renders cx/cy already at target; scale about 0,0 does move them (cx/cy are attributes, not transform-origin dependent)
        // but circle transform-origin 0,0 via CSS makes scale work. Keep same scale path on circles via their parent <g> is at translate(200,200).
        // Animate each circle's transform scale 0->1.
        for (const { key: revealKey, areaIndex } of toReveal) {
          const idx = parseInt(revealKey.split(":string:")[1] ?? "-1", 10);
          if (isNaN(idx)) continue;
          const delayMs = campaignBaseDelayMs + areaIndex * 150 * staggerScale * durationFactor;
          const kfs = buildRadarProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` } as unknown as Keyframe));
          const liveDots = liveContainer.querySelectorAll<SVGCircleElement>(".ts-chart__radial-dot circle");
          for (const circle of liveDots) {
            const ck = circle.getAttribute("data-ts-key") ?? "";
            if (!ck.startsWith(`polar-0:radial-dot-1:string:${String(idx).padStart(Z_PAD, "0")}:`)) continue;
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

          // Grid + spokes + labels reveal (bklit parity: grid 0.08s stagger, spokes 0.05s, labels 0.08s)
          // Clear the sync pre-hide transforms so WAAPI fill:backwards takes over (otherwise inline scale(0) wins)
          {
            const gridStaggerMs = 80 * staggerScale * durationFactor;
            const _spokeGrid = liveContainer.querySelector<HTMLElement>('[data-ts-key="polar-0:bklit-radar-grid-0"]');
            const _angleGridEl = liveContainer.querySelector<HTMLElement>('[data-ts-key="polar-0:angle-grid-1"]');
            void _spokeGrid; void _angleGridEl;
            const gridRings = liveContainer.querySelectorAll<SVGPathElement>('[data-ts-key^="radar-ring:"]');
            const spokes = liveContainer.querySelectorAll<SVGLineElement>('[data-ts-key^="spoke:"]');
            for (const el of gridRings) { (el as SVGElement).style.transform = ""; (el as SVGElement).style.opacity = ""; }
            for (const el of spokes) { (el as SVGElement).style.transform = ""; (el as SVGElement).style.opacity = ""; }
            const clearLabels = liveContainer.querySelectorAll<HTMLElement>('[data-ts-key$=":labels"]');
            for (const g of clearLabels) for (const t of g.querySelectorAll<SVGTextElement>("text")) t.style.opacity = "";
          // Apply revealing class ensures pre-paint hidden; now WAAPI drives it
          const gridLabelsGroup = liveContainer.querySelector<HTMLElement>('[data-ts-key="polar-0:bklit-radar-grid-0:labels"]');
          const angleLabelsGroup = liveContainer.querySelector<HTMLElement>('[data-ts-key="polar-0:angle-grid-1:labels"]');

          // Grid rings: scale 0->1 + opacity 0->1 stagger per ring (bklit spring 100/15 → ease-out surrogate)
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

          // Spokes: scale 0->1 from center (line x2/y2 already full length; scale on line element with origin 0,0 works because line at 0,0->target)
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

          // Labels: fade in (group-level opacity); individual text positions already correct via TanStack layout
          const labelGroups = [gridLabelsGroup, angleLabelsGroup].filter(Boolean) as HTMLElement[];
          labelGroups.forEach((g, gi) => {
            const baseDelay = gi === 0 ? 5 * gridStaggerMs * 0.5 : 5 * gridStaggerMs * 0.5;
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

        liveMarksGroup?.classList.remove("ts-chart__marks--revealing");
      });
    },
    [],
  );

  // Hover chrome — imperative, key-based, pointer-driven (ring pattern).
  // TanStack focus:"nearest" does not hit polar radialArea centroids, so we
  // attach pointer listeners directly to each area path (like bklit motion.g
  // onMouseEnter and ring's trackGroup listeners). useLayoutEffect paints
  // fillOpacity/strokeWidth/filter/opacity; transform is gated on
  // pendingRevealRef (WAAPI owns it until finish).
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applyHover = () => {
      const { resolvedAreas } = hoverInputsRef.current;
      const areaMap = areaPathByKeyRef.current;
      const dotMap = dotCircleByKeyRef.current;
      const metricsLen = hoverInputsRef.current.metricKeysLength;

      for (let i = 0; i < resolvedAreas.length; i++) {
        const key = `polar-0:radial-area-0:string:${String(i).padStart(Z_PAD, "0")}`;
        const path = areaMap.get(key) ?? null;
        if (!path) continue;
        const isHovered = i === hoveredIndex;
        const isDimmed = hoveredIndex !== null && !isHovered;
        const area = resolvedAreas[i];

        path.style.opacity = isDimmed ? "0.3" : "1";
        path.style.fillOpacity = isHovered
          ? String(FILL_OPACITY_HOVER)
          : String(FILL_OPACITY_REST);
        path.style.strokeWidth = area?.showStroke
          ? String(isHovered ? STROKE_WIDTH_HOVER : STROKE_WIDTH_REST)
          : "0";
        path.style.filter =
          area?.showGlow && isHovered
            ? `drop-shadow(0 0 12px ${area.color})`
            : "none";

        if (!pendingRevealRef.current.has(key)) {
          path.style.transform = isHovered ? `scale(${HOVER_SCALE})` : "";
        }

        for (let j = 0; j < metricsLen; j++) {
          const metricKey = metricKeys[j];
          if (!metricKey) continue;
          const dotKey = `polar-0:radial-dot-1:string:${String(i).padStart(Z_PAD, "0")}:string:${metricKey}`;
          const circle = dotMap.get(dotKey) ?? null;
          if (!circle) continue;
          circle.style.opacity = isDimmed ? "0.3" : "1";
          circle.setAttribute("r", String(isHovered ? DOT_R_HOVER : DOT_R_REST));
          if (!pendingRevealRef.current.has(key)) {
            circle.style.transform = isHovered ? `scale(${HOVER_SCALE})` : "";
          }
          circle.style.transformOrigin = "";
          if (area?.showGlow && isHovered) {
            circle.style.filter = `drop-shadow(0 0 8px ${area.color})`;
          } else {
            circle.style.filter = "";
          }
        }
      }

      if (dotCircleByKeyRef.current.size > hoverInputsRef.current.metricKeysLength * hoverInputsRef.current.resolvedAreas.length) {
        for (const [k, circle] of dotCircleByKeyRef.current) {
          const prefix = k.split(":string:")[1];
          if (prefix == null) continue;
          const idx = parseInt(prefix, 10);
          if (isNaN(idx) || idx >= hoverInputsRef.current.resolvedAreas.length) {
            circle.style.opacity = "1";
            circle.setAttribute("r", String(DOT_R_REST));
            circle.style.filter = "";
          }
        }
      }
    };

    applyHover();

    const areaPaths = Array.from(container.querySelectorAll<SVGPathElement>(".ts-chart__radial-area path"));
    const dotCircles = Array.from(container.querySelectorAll<SVGCircleElement>(".ts-chart__radial-dot circle"));
    const cleanups: (() => void)[] = [];

    for (const path of areaPaths) {
      const key = path.getAttribute("data-ts-key") ?? "";
      const m = key.match(/:string:(\d+)$/);
      const idx = m ? parseInt(m[1]!, 10) : NaN;
      if (isNaN(idx)) continue;
      path.style.cursor = "pointer";
      // Defer hover until WAAPI reveal finished for this key (ring settleAtRest gate)
      const enter = () => {
        if (pendingRevealRef.current.has(key)) return;
        setHoveredIndex(idx);
      };
      const leave = () => {
        if (pendingRevealRef.current.has(key)) return;
        setHoveredIndex((prev: number | null) => (prev === idx ? null : prev));
      };
      path.addEventListener("pointerenter", enter);
      path.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        path.removeEventListener("pointerenter", enter);
        path.removeEventListener("pointerleave", leave);
      });
    }

    // Dots also trigger hover (larger hit area near vertices)
    for (const circle of dotCircles) {
      const key = circle.getAttribute("data-ts-key") ?? "";
      const m = key.match(/:string:(\d+):string:/);
      const idx = m ? parseInt(m[1]!, 10) : NaN;
      if (isNaN(idx)) continue;
      const enter = () => {
        const areaKey = `polar-0:radial-area-0:string:${String(idx).padStart(Z_PAD, "0")}`;
        if (pendingRevealRef.current.has(areaKey)) return;
        setHoveredIndex(idx);
      };
      const leave = () => {
        const areaKey = `polar-0:radial-area-0:string:${String(idx).padStart(Z_PAD, "0")}`;
        if (pendingRevealRef.current.has(areaKey)) return;
        setHoveredIndex((prev: number | null) => (prev === idx ? null : prev));
      };
      circle.style.cursor = "pointer";
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
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setTimeout(() => {
        if (isMountedRef.current) return;
        for (const anim of pendingRevealRef.current.values()) {
          try { anim.cancel(); } catch {}
        }
        pendingRevealRef.current.clear();
        for (const anim of revealAnimsRef.current) {
          try { anim.cancel(); } catch {}
        }
        revealAnimsRef.current = [];
      }, 0);
    };
  }, []);

  // Keep component TanStack-native: no imperative pre-paint hide here.
  // Flicker is handled inside handleRender → onPostPaint with fill:backwards WAAPI (zero wrappers).
  // Left intentionally minimal.

  // Stable fallback: if onRender never fired (size<10->>=10), retry once past paint (ring pattern)
  React.useLayoutEffect(() => {
    if (seenRevealedRef.current.size > 0) return;
    if (!animateRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (seenRevealedRef.current.size > 0) return;
        if (!container.querySelector(".ts-chart__marks")) return;
        const hasAnims = () => {
          for (let i = 0; i < hoverInputsRef.current.resolvedAreas.length; i++) {
            const key = `polar-0:radial-area-0:string:${String(i).padStart(Z_PAD, "0")}`;
            const el = container.querySelector(`[data-ts-key="${key}"]`) as unknown as { getAnimations?: () => Animation[] } | null;
            if (el?.getAnimations?.().length) return true;
          }
          return false;
        };
        if (hasAnims()) return;
        handleRender({ container });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [handleRender]);

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
