// Migrated bklit-ui RadarChart — same public API, rendered by TanStack
// Charts' `polar()` mark family (@tanstack/charts/polar).
//
// Architecture: TanStack-native animation (`animate:true`) and focus engine
// (`focus:"nearest"` + `onFocusGroupChange`) replace the old custom WAAPI
// reveal and imperative hover chrome. Visual hover effects (dim/glow/scale/
// dot-size) are applied via a lightweight useLayoutEffect that walks the
// rendered DOM by position (z-grouped marks are ordered by zero-padded
// series index, which sorts alphabetically = numerically).
//
// Grid rings: custom `bklitRadarGrid` PolarGuide (internal/radar-reveal.ts)
// because `radialGrid({shape:"polygon"})` can't reproduce bklit's half-step
// vertex offset. See that file for full derivation.

import * as React from "react";
import { scaleLinear, scalePoint } from "d3-scale";
import { curveLinearClosed } from "d3-shape";
import { Chart, type ChartPoint } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { angleGrid, polar, radialArea, radialDot } from "@tanstack/charts/polar";
import type { PolarGuide } from "@tanstack/charts/polar";
import { CHART_ROLE, roleOf } from "./children";
import { bklitRadarGrid } from "./internal/radar-reveal";
import "./styles.css";

// --- Defaults / constants (bklit-ui sources) ------------------------------
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

// bklit visual spec (radar-area.tsx) — applied via useLayoutEffect.
const HOVER_SCALE = 1.05;
const FILL_OPACITY_HOVER = 0.35;
const FILL_OPACITY_REST = 0.15;
const STROKE_WIDTH_HOVER = 3;
const STROKE_WIDTH_REST = 2;
const DOT_R_HOVER = 6;
const DOT_R_REST = 4;

// --- Public data/config types (bklit-ui radar-context.tsx parity) ---------
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

// --- Config-carrier children (local role strings) -------------------------
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
    (index: number | null) => {
      if (isControlled) {
        onHoverChange?.(index);
      } else {
        setInternalHoveredIndex(index);
      }
    },
    [isControlled, onHoverChange],
  );

  const areaPathsRef = React.useRef<(SVGPathElement | null)[]>([]);
  const dotCirclesRef = React.useRef<(SVGCircleElement | null)[]>([]);

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
      animate: animate
        ? {
            duration: enterDurationMs,
            easing: "ease-in-out",
            resize: false,
          }
        : false,
      focus: "nearest",
      maxFocusDistance: Infinity,
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
    animate,
    enterDurationMs,
  ]);

  // --- Hover detection via TanStack native focus engine ---
  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<RadarRow, string, number>[]) => {
      if (points.length === 0) {
        setHoveredIndex(null);
        return;
      }
      const zVal = points[0]?.zValue;
      const idx = zVal != null ? parseInt(String(zVal), 10) : null;
      setHoveredIndex(idx != null && !isNaN(idx) ? idx : null);
    },
    [setHoveredIndex],
  );

  const handleRender = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const areaPaths = el.querySelectorAll<SVGPathElement>(
      ".ts-chart__radial-area path",
    );
    areaPathsRef.current = [];
    for (let i = 0; i < areaPaths.length; i++) {
      areaPathsRef.current[i] = areaPaths[i]!;
    }
    const dotCircles = el.querySelectorAll<SVGCircleElement>(
      ".ts-chart__radial-dot circle",
    );
    dotCirclesRef.current = [];
    for (let i = 0; i < dotCircles.length; i++) {
      dotCirclesRef.current[i] = dotCircles[i]!;
    }
  }, []);

  // --- Hover visual effects: sync inline styles on hover change ---
  // z-grouped marks render in alphabetical z order. Zero-padded indices
  // ("00000","00001",...) sort alphabetically = numerically, so path/dot
  // position within the cached element arrays maps directly to series index.
  // Elements are tracked in handleRender (onRender) and read from refs here
  // to avoid per-hover DOM queries against TanStack internal class names.
  React.useLayoutEffect(() => {
    const { resolvedAreas, metricKeysLength } = hoverInputsRef.current;
    const areaPaths = areaPathsRef.current;
    const dotCircles = dotCirclesRef.current;
    const metricsLen = metricKeysLength;

    for (let i = 0; i < areaPaths.length; i++) {
      const path = areaPaths[i]!;
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

      path.style.transform = isHovered ? `scale(${HOVER_SCALE})` : "";

      const dotStart = i * metricsLen;
      for (let j = 0; j < metricsLen; j++) {
        const circle = dotCircles[dotStart + j];
        if (!circle) continue;
        circle.style.opacity = isDimmed ? "0.3" : "1";
        circle.setAttribute("r", String(isHovered ? DOT_R_HOVER : DOT_R_REST));
        circle.style.transform = isHovered ? `scale(${HOVER_SCALE})` : "";
        circle.style.transformOrigin = "";
        if (area?.showGlow && isHovered) {
          circle.style.filter = `drop-shadow(0 0 8px ${area.color})`;
        } else {
          circle.style.filter = "";
        }
      }
    }

    const expectedCircles = resolvedAreas.length * metricsLen;
    for (let i = expectedCircles; i < dotCircles.length; i++) {
      const circle = dotCircles[i];
      if (circle) {
        circle.style.opacity = "1";
        circle.setAttribute("r", String(DOT_R_REST));
        circle.style.filter = "";
      }
    }
  }, [hoveredIndex]);

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
          onFocusGroupChange={handleFocusGroupChange}
          onRender={handleRender}
        />
      ) : null}
    </div>
  );
}
