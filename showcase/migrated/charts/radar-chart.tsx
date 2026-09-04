// Bklit RadarChart on TanStack polar marks; area/dot entrance is native motion, grid reveal stays WAAPI.
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import { useEffectEvent } from "./internal/use-effect-event";
import { scaleLinear, scalePoint } from "d3-scale";
import { curveLinearClosed } from "d3-shape";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import type { ChartMotionContext, ChartValue, DomChartDefinition, MarkScene, SceneNode } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { angleGrid, polar, radialArea, radialDot } from "@tanstack/charts/polar";
import type { PolarGuide, PolarMark } from "@tanstack/charts/polar";
import { roleOf } from "./internal/children-extract";
import type { RadarAreaProps } from "./internal/radar-area-child";
import type { RadarAxisProps } from "./internal/radar-axis-child";
import type { RadarGridProps } from "./internal/radar-grid-child";
import type { RadarLabelsProps } from "./internal/radar-labels-child";
import {
  buildProgressKeyframes as buildRadarProgressKeyframes,
  revealTiming as radarRevealTiming,
  resolveEnterTransition as resolveRadarEnterTransition,
} from "./internal/enter-transition";
import { bklitRadarGrid, radarMotionTransition } from "./internal/radar-reveal";
import {
  estimateSpringSettleMs,
  sampleSpringProgress,
} from "./internal/radar-spring";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { useDebouncedContainerSize } from "./internal/use-container-size";
import { chartMotionRenderer } from "./internal/motion-renderer";
import "./styles.css";

const DEFAULT_LEVELS = 5;
const DEFAULT_MARGIN = 60;

const RADAR_BORDER_VAR = "var(--border)";
const RADAR_LABEL_VAR = "var(--chart-label, oklch(0.65 0.01 260))";
const RADAR_FOREGROUND_MUTED_VAR = "var(--chart-foreground-muted)";
const RADAR_BACKGROUND_VAR = "var(--chart-background)";
// Shared categorical palette; legacy builds its own from radarCssVars.area1..5 (value-identical).
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

// Selector for the TanStack marks group rendered inside the chart container.
const MARKS_GROUP_SELECTOR = ".ts-chart__marks";

// WAAPI reveal never stomps live TanStack motions: bail while the renderer is mid-reconcile.
const hasLiveRevealAnims = (container: HTMLElement): boolean => {
  const els = container.querySelectorAll('[data-ts-key^="radar-area:"]');
  for (const el of els) {
    if (el.getAnimations().length > 0) {return true;}
  }
  const fallback = container.querySelectorAll(".ts-chart__radial-area path");
  for (const el of fallback) {
    if (el.getAnimations().length > 0) {return true;}
  }
  return false;
}

const FILL_OPACITY_HOVER = 0.35;
const FILL_OPACITY_REST = 0.15;
const STROKE_WIDTH_REST = 2;
const DOT_R_HOVER = 6;
const DOT_R_REST = 4;
// Dim factor multiplies into fill/stroke alpha: radial marks have no per-datum opacity channel.
const DIM_OPACITY = 0.3;

// Percent scale: alpha fractions convert to color-mix percentages via *100, clamped to [0, 100].
const ALPHA_PERCENT_MAX = 100;
const PERCENT_SCALE = 100;
// Default enter duration; the reveal scales stagger delays by enterDurationMs / this value.
const RADAR_ENTER_DURATION_MS = 1100;
// Per-ring grid reveal stagger, scaled by staggerScale * durationFactor.
const RADAR_GRID_STAGGER_MS = 80;
// Base delay added after the last grid ring before the first series campaign starts.
const RADAR_CAMPAIGN_BASE_DELAY_MS = 200;
// Per-series stagger added on top of the campaign base delay.
const RADAR_SERIES_STAGGER_MS = 150;
// Below this size there is nothing to lay out; the chart definition stays undefined.
const RADAR_MIN_CHART_SIZE_PX = 10;
// Default grid/spoke stroke opacity (bklit grid chrome).
const RADAR_GRID_STROKE_OPACITY = 0.6;
// Axis-label spring (stiffness/damping/mass) shared by the settle estimate and the sampler.
const LABEL_SPRING_STIFFNESS = 80;
const LABEL_SPRING_DAMPING = 15;
const LABEL_SPRING_MASS = 1;
// Per-spoke reveal stagger, scaled by staggerScale * durationFactor.
const SPOKE_STAGGER_MS = 50;
// Label fade-in base delay: 5 grid staggers, halved.
const LABEL_BASE_DELAY_GRID_STAGGER_FACTOR = 5;
const LABEL_BASE_DELAY_FRACTION = 0.5;
// Label fade-in runs at half the enter duration.
const LABEL_FADE_DURATION_FRACTION = 0.5;
// Per-label stagger inside each label group (grid-ring labels vs angle labels).
const GRID_LABEL_STAGGER_MS = 60;
const ANGLE_LABEL_STAGGER_MS = 80;
// Spring progress sampling step for the label outward-spring keyframes.
const LABEL_SPRING_SAMPLE_STEP_MS = 40;
// Radius scale domain max (radar values are percentages).
const RADAR_RADIUS_DOMAIN_MAX = 100;

const withAlpha = (color: string, alphaPercent: number): string => {
  const pct = Math.max(0, Math.min(ALPHA_PERCENT_MAX, alphaPercent));
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

const polarValueKey = (value: string): string => `string:${value.length}:${value}`

// Per-series targeting walks the scene tree by node key through the public PolarMark surface.
const withMarkNodeClassName = <TDatum, TAngle extends ChartValue, TRadius extends ChartValue,>(mark: Readonly<PolarMark<TDatum, TAngle, TRadius>>, classNameForKey: (key: string) => string | undefined): PolarMark<TDatum, TAngle, TRadius> => {
  const stampNode = (node: Readonly<SceneNode>): SceneNode => {
    if (node.kind === "group") {
      return { ...node, children: node.children.map(stampNode) };
    }
    const extra = classNameForKey(node.key);
    return (extra ?? "") === "" ? node : { ...node, className: [node.className, extra].filter(Boolean).join(" ") };
  }
  return {
    ...mark,
    initialize: (context) => {
      const initialized = mark.initialize(context);
      return {
        ...initialized,
        render: (renderContext): MarkScene<TDatum, TAngle, TRadius> => {
          const scene = initialized.render(renderContext);
          return { ...scene, nodes: scene.nodes.map(stampNode) };
        },
      };
    },
  };
}

interface RadarMetric {
  readonly key: string;
  readonly label: string;
}

interface RadarData {
  readonly label: string;
  readonly color?: string;
  readonly values: Readonly<Record<string, number>>;
}

interface RadarEnterTransition {
  readonly type?: "spring" | "tween";
  readonly duration?: number;
  readonly ease?: readonly [number, number, number, number];
  readonly bounce?: number;
  readonly stiffness?: number;
  readonly damping?: number;
  readonly mass?: number;
}

interface RadarChartProps {
  readonly data: readonly RadarData[];
  readonly metrics: readonly RadarMetric[];
  readonly size?: number;
  readonly levels?: number;
  readonly margin?: number;
  readonly animate?: boolean;
  readonly enterDurationMs?: number;
  readonly staggerScale?: number;
  readonly enterTransition?: RadarEnterTransition;
  readonly motionReplayKey?: string;
  readonly hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

const ROLE_GRID = "radar-grid";
const ROLE_AXIS = "radar-axis";
const ROLE_LABELS = "radar-labels";
const ROLE_AREA = "radar-area";

interface ExtractedRadarChildren {
  grid?: RadarGridProps;
  axis?: RadarAxisProps;
  labels?: RadarLabelsProps;
  readonly areas: RadarAreaProps[];
}

const collectRadarChild = (child: Readonly<ReactElement>, out: ExtractedRadarChildren): void => {
  const role = roleOf(child.type);
  if (role === ROLE_GRID && isValidElement<RadarGridProps>(child)) {out.grid = child.props;}
  else if (role === ROLE_AXIS && isValidElement<RadarAxisProps>(child)) {out.axis = child.props;}
  else if (role === ROLE_LABELS && isValidElement<RadarLabelsProps>(child)) {out.labels = child.props;}
  else if (role === ROLE_AREA && isValidElement<RadarAreaProps>(child)) {out.areas.push(child.props);}
  else {
    // Unknown roles carry no radar geometry: only grid, axis, labels, and areas populate the spec.
  }
}

const extractRadarChildren = (children: ReactNode): ExtractedRadarChildren => {
  const out: ExtractedRadarChildren = { areas: [] };
  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) {
      if (isValidElement(child)) {
        if (child.type === Fragment && isValidElement<{ children?: ReactNode }>(child)) {visit(child.props.children);}
        else {collectRadarChild(child, out);}
      }
    }
  };
  visit(children);
  return out;
}

interface ResolvedRadarArea {
  readonly index: number;
  readonly datum: RadarData;
  readonly color: string;
  readonly showPoints: boolean;
  readonly showStroke: boolean;
  readonly showGlow: boolean;
  readonly className: string;
}

interface RadarRow {
  readonly metric: string;
  readonly value: number;
  readonly series: string;
  readonly replayGroup: string;
}

interface RadarEnterSnapshot {
  readonly enterTransition: RadarEnterTransition | undefined;
  readonly staggerScale: number;
  readonly enterDurationMs: number;
  readonly levels: number;
}

interface RadarSeriesEnter {
  readonly delay: number;
  readonly transition: ReturnType<typeof radarMotionTransition>;
}

const resolveRadarSeriesEnter = (seriesIndex: number, snapshot: Readonly<RadarEnterSnapshot>): RadarSeriesEnter => {
  const resolved = resolveRadarEnterTransition(snapshot.enterTransition);
  const durationFactor = snapshot.enterDurationMs / RADAR_ENTER_DURATION_MS;
  const gridStaggerMs = RADAR_GRID_STAGGER_MS * snapshot.staggerScale * durationFactor;
  const campaignBaseDelayMs = (snapshot.levels * gridStaggerMs + RADAR_CAMPAIGN_BASE_DELAY_MS) * durationFactor;
  const delayMs = campaignBaseDelayMs + seriesIndex * RADAR_SERIES_STAGGER_MS * snapshot.staggerScale * durationFactor;
  return { delay: delayMs, transition: radarMotionTransition(resolved) };
}

interface RadarGuidesInput {
  readonly grid: Readonly<RadarGridProps> | undefined;
  readonly axis: Readonly<RadarAxisProps> | undefined;
  readonly labels: Readonly<RadarLabelsProps> | undefined;
  readonly levels: number;
  readonly metricKeys: readonly string[];
  readonly metricLabelByKey: Readonly<ReadonlyMap<string, string>>;
}

const buildRadarGridGuide = (grid: Readonly<RadarGridProps>, levels: number, metricsCount: number): PolarGuide => bklitRadarGrid({
  className: grid.className,
  labelClassName: "ts-bkm-radar-grid-labels",
  labelFill: RADAR_FOREGROUND_MUTED_VAR,
  levels,
  metricsCount,
  showLabels: grid.showLabels ?? true,
  stroke: grid.stroke ?? RADAR_BORDER_VAR,
  strokeOpacity: grid.strokeOpacity ?? RADAR_GRID_STROKE_OPACITY,
});

const makeRadarLabelFormat = (metricLabelByKey: Readonly<ReadonlyMap<string, string>>): ((value: Readonly<ChartValue>) => string) => (value: Readonly<ChartValue>): string =>
  metricLabelByKey.get(String(value)) ?? String(value);

const buildRadarSpokeGuide = (axis: Readonly<RadarAxisProps> | undefined, labels: Readonly<RadarLabelsProps> | undefined, metricLabelByKey: Readonly<ReadonlyMap<string, string>>): PolarGuide => {
  const spokeOptions = axis
    ? {
      className: (axis.className ?? "") === "" ? "ts-bkm-radar-spokes" : `ts-bkm-radar-spokes ${axis.className}`,
      stroke: axis.stroke ?? RADAR_BORDER_VAR,
      strokeOpacity: axis.strokeOpacity ?? RADAR_GRID_STROKE_OPACITY,
      strokeWidth: 1,
    }
    : { strokeWidth: 0 };
  const labelOptions = labels
    ? {
      format: makeRadarLabelFormat(metricLabelByKey),
      labelAnchor: "middle" as const,
      labelBaseline: "middle" as const,
      labelClassName: [
        "ts-bkm-radar-axis-labels",
        labels.interactive === true ? "ts-bkm-radar-axis-labels--interactive" : "",
        labels.className ?? "",
      ]
        .filter(Boolean)
        .join(" "),
      labelFill: RADAR_LABEL_VAR,
      labelFontSize: labels.fontSize ?? LABEL_DEFAULT_FONT_SIZE,
      labelOffset: labels.offset ?? LABEL_DEFAULT_OFFSET,
      labels: true as const,
    }
    : { labels: false as const };
  return angleGrid({ ...spokeOptions, ...labelOptions });
}

const buildRadarGuides = (input: Readonly<RadarGuidesInput>): PolarGuide[] => {
  const { grid, axis, labels, levels, metricKeys, metricLabelByKey } = input;
  const guides: PolarGuide[] = [];
  if (grid) {guides.push(buildRadarGridGuide(grid, levels, metricKeys.length));}
  if (axis || labels) {guides.push(buildRadarSpokeGuide(axis, labels, metricLabelByKey));}
  return guides;
}

const seriesIndexOfRow = (row: RadarRow, resolvedCount: number): number =>
  Math.min(Math.trunc(Number(row.series)), resolvedCount - 1);

const makeRadarAreaClassName = (hoveredAreaNodeKey: string | undefined, hoveredIndex: number | null): ((key: string) => string | undefined) => (key: string): string | undefined =>
  key === hoveredAreaNodeKey && hoveredIndex !== null
    ? `bkm-radar-area bkm-radar-area--hovered bkm-radar-area--hovered-${hoveredIndex % DEFAULT_RADAR_COLORS.length}`
    : "bkm-radar-area";

interface RadarDefinitionOptions {
  readonly chartSize: number;
  readonly resolvedAreas: readonly ResolvedRadarArea[];
  readonly metricKeys: readonly string[];
  readonly metricLabelByKey: Readonly<ReadonlyMap<string, string>>;
  readonly grid: Readonly<RadarGridProps> | undefined;
  readonly axis: Readonly<RadarAxisProps> | undefined;
  readonly labels: Readonly<RadarLabelsProps> | undefined;
  readonly levels: number;
  readonly radarAreaMark: Readonly<PolarMark<RadarRow, string, number>>;
  readonly radarDotMark: Readonly<PolarMark<RadarRow, string, number>>;
  readonly margin: number;
  readonly hoveredIndex: number | null;
  readonly motionReplayKey: string;
}

// Chart definition from resolved areas, guides, and hover state.
// Caller passes the same memoized marks with every input in its dependency array.
const buildRadarDefinition = (options: Readonly<RadarDefinitionOptions>): DomChartDefinition<RadarRow, string, number> | undefined => {
  const { chartSize, resolvedAreas, metricKeys, metricLabelByKey, grid, axis, labels, levels, radarAreaMark, radarDotMark, margin, hoveredIndex, motionReplayKey } = options;
  if (chartSize < RADAR_MIN_CHART_SIZE_PX || resolvedAreas.length === 0 || metricKeys.length === 0) {return undefined;}

  // Group keys run through valueKey's string:length: wrapper; reproduce it to find the hovered node.
  const hoveredGroupKey = polarValueKey(`${motionReplayKey}:${String(hoveredIndex).padStart(Z_PAD, "0")}`);
  const hoveredAreaNodeKey = hoveredIndex === null
    ? undefined
    : `radar-area:${hoveredGroupKey}`;

  const guides = buildRadarGuides({ axis, grid, labels, levels, metricKeys, metricLabelByKey });
  const hoveredAreaMark = withMarkNodeClassName(radarAreaMark, makeRadarAreaClassName(hoveredAreaNodeKey, hoveredIndex));

  return defineChart({
    focus: focusDisabled,
    guides: false,
    margin,
    marks: [
      polar({
        guides,
        id: "radar",
        marks: [
          // Hover dim/pop rides fill/stroke/r channels + one CSS class for stroke-width (no states option).
          hoveredAreaMark,
          radarDotMark,
        ],
        scales: {
          angle: { scale: scalePoint().domain(metricKeys) },
          radius: { scale: scaleLinear().domain([0, RADAR_RADIUS_DOMAIN_MAX]) },
        },
      }),
    ],
    scales: { x: null, y: null },
    svgAnimation: false,
    tooltip: false,
  });
};

const makeRadarAreaFill = (resolvedAreas: readonly ResolvedRadarArea[], hoveredIndex: number | null): ((row: RadarRow) => string) => (row: RadarRow): string => {
  const clampedIdx = seriesIndexOfRow(row, resolvedAreas.length);
  const color = resolvedAreas[clampedIdx]?.color ?? DEFAULT_RADAR_COLORS[0];
  const isHovered = hoveredIndex === clampedIdx;
  const isDimmed = hoveredIndex !== null && !isHovered;
  const baseAlpha = isHovered ? FILL_OPACITY_HOVER : FILL_OPACITY_REST;
  return withAlpha(color, (isDimmed ? baseAlpha * DIM_OPACITY : baseAlpha) * PERCENT_SCALE);
}

const makeRadarAreaStroke = (resolvedAreas: readonly ResolvedRadarArea[], hoveredIndex: number | null): ((row: RadarRow) => string) => (row: RadarRow): string => {
  const clampedIdx = seriesIndexOfRow(row, resolvedAreas.length);
  const area = resolvedAreas[clampedIdx];
  if (!area.showStroke) {return "none";}
  const isHovered = hoveredIndex === clampedIdx;
  const isDimmed = hoveredIndex !== null && !isHovered;
  return withAlpha(area.color, (isDimmed ? DIM_OPACITY : 1) * PERCENT_SCALE);
}

const makeRadarDotFill = (resolvedAreas: readonly ResolvedRadarArea[], hoveredIndex: number | null): ((row: RadarRow) => string) => (row: RadarRow): string => {
  const clampedIdx = seriesIndexOfRow(row, resolvedAreas.length);
  const color = resolvedAreas[clampedIdx]?.color ?? DEFAULT_RADAR_COLORS[0];
  const isDimmed = hoveredIndex !== null && hoveredIndex !== clampedIdx;
  return withAlpha(color, (isDimmed ? DIM_OPACITY : 1) * PERCENT_SCALE);
}

const makeRadarDotRadius = (resolvedCount: number, hoveredIndex: number | null): ((row: RadarRow) => number) => (row: RadarRow): number =>
  hoveredIndex === seriesIndexOfRow(row, resolvedCount) ? DOT_R_HOVER : DOT_R_REST;

type RadarRevealTiming = ReturnType<typeof radarRevealTiming>;

const flagRadarSvgRevealed = (container: HTMLElement): void => {
  const svgForBkm = container.querySelector<SVGElement>("svg.ts-chart");
  if (svgForBkm && (svgForBkm.dataset.bkmRevealed ?? "") === "") {svgForBkm.dataset.bkmRevealed = "1";}
}

const beginRadarReveal = (container: HTMLElement, animate: boolean, revealedRef: RefObject<boolean>): SVGGElement | undefined => {
  if (!animate || revealedRef.current) {return undefined;}
  const marksGroup = container.querySelector<SVGGElement>(MARKS_GROUP_SELECTOR);
  if (!marksGroup) {return undefined;}
  revealedRef.current = true;
  flagRadarSvgRevealed(container);
  marksGroup.classList.add("ts-chart__marks--revealing");
  return marksGroup;
}

interface RadarRevealSetup {
  readonly deadlineMs: number;
  readonly durationFactor: number;
  readonly gridStaggerMs: number;
  readonly labelSpringSettleMs: number;
  readonly renderStaggerScale: number;
  readonly timing: RadarRevealTiming;
}

const resolveRadarRevealSetup = (snapshot: Readonly<RadarEnterSnapshot>): RadarRevealSetup => {
  const resolved = resolveRadarEnterTransition(snapshot.enterTransition);
  const timing = radarRevealTiming(resolved);
  const renderStaggerScale = snapshot.staggerScale;
  const durationFactor = snapshot.enterDurationMs / RADAR_ENTER_DURATION_MS;
  const gridStaggerMs = RADAR_GRID_STAGGER_MS * renderStaggerScale * durationFactor;
  const labelSpringSettleMs = estimateSpringSettleMs(LABEL_SPRING_STIFFNESS, LABEL_SPRING_DAMPING, LABEL_SPRING_MASS);
  const deadlineMs = Math.max(timing.durationMs + snapshot.levels * gridStaggerMs, labelSpringSettleMs);
  return { deadlineMs, durationFactor, gridStaggerMs, labelSpringSettleMs, renderStaggerScale, timing };
}

const clearRadarLabelStyles = (liveMarksGroup: SVGGElement): void => {
  const clearLabels = liveMarksGroup.querySelectorAll<HTMLElement>('[data-ts-key$=":labels"]');
  for (const labelGroup of clearLabels) {for (const labelText of labelGroup.querySelectorAll<SVGTextElement>("text")) {labelText.style.opacity = "";}}
}

const clearRadarRevealStyles = (liveMarksGroup: SVGGElement): void => {
  const gridRings = liveMarksGroup.querySelectorAll<SVGPathElement>('[data-ts-key^="radar-ring:"]');
  const spokes = liveMarksGroup.querySelectorAll<SVGLineElement>('[data-ts-key^="spoke:"]');
  for (const el of gridRings) { el.style.transform = ""; el.style.opacity = ""; }
  for (const el of spokes) { el.style.transform = ""; el.style.opacity = ""; }
  clearRadarLabelStyles(liveMarksGroup);
}

interface RadarLabelGroups {
  readonly gridLabelsGroup: Element | null;
  readonly angleLabelsGroup: Element | null;
}

const findRadarLabelGroups = (liveMarksGroup: SVGGElement, container: HTMLElement): RadarLabelGroups => {
  const gridLabelsGroup = liveMarksGroup.querySelector('[data-ts-key="radar:bklit-radar-grid-0:labels"]') ??
    liveMarksGroup.querySelector('[data-ts-key="polar-0:bklit-radar-grid-0:labels"]') ??
    container.querySelector('[data-ts-key="radar:bklit-radar-grid-0:labels"]');
  const angleLabelsGroup = liveMarksGroup.querySelector('[data-ts-key="radar:angle-grid-1:labels"]') ??
    liveMarksGroup.querySelector('[data-ts-key="polar-0:angle-grid-1:labels"]') ??
    container.querySelector('[data-ts-key="radar:angle-grid-1:labels"]');
  return { angleLabelsGroup, gridLabelsGroup };
}

interface RadarRingRevealOptions {
  readonly liveMarksGroup: SVGGElement;
  readonly timing: RadarRevealTiming;
  readonly gridStaggerMs: number;
  readonly revealAnims: Animation[];
}

interface RadarRingOptions {
  readonly path: SVGPathElement;
  readonly ringIdx: number;
  readonly timing: RadarRevealTiming;
  readonly gridStaggerMs: number;
  readonly revealAnims: Animation[];
}

const revealRadarRing = (options: Readonly<RadarRingOptions>): void => {
  const { path, ringIdx, timing, gridStaggerMs, revealAnims } = options;
  const delay = ringIdx * gridStaggerMs;
  const kfScale = buildRadarProgressKeyframes(timing, (progress) => ({ transform: `scale(${progress})` }));
  const kfOpacity = buildRadarProgressKeyframes(timing, (progress) => ({ opacity: String(progress) }));
  const animScale = path.animate(kfScale, { delay, duration: timing.durationMs, easing: timing.easing, fill: "backwards" });
  const animOpacity = path.animate(kfOpacity, { delay, duration: timing.durationMs, easing: timing.easing, fill: "backwards" });
  revealAnims.push(animScale, animOpacity);
  animScale.onfinish = (): void =>{  animScale.cancel(); };
  animOpacity.onfinish = (): void =>{  animOpacity.cancel(); };
}

const revealRadarRings = (options: Readonly<RadarRingRevealOptions>): void => {
  const { liveMarksGroup, timing, gridStaggerMs, revealAnims } = options;
  const gridRings = liveMarksGroup.querySelectorAll<SVGPathElement>('[data-ts-key^="radar-ring:"]');
  for (const [ringIdx, path] of gridRings.entries()) {
    revealRadarRing({ gridStaggerMs, path, revealAnims, ringIdx, timing });
  }
}

interface RadarSpokeRevealOptions {
  readonly liveMarksGroup: SVGGElement;
  readonly timing: RadarRevealTiming;
  readonly spokeStaggerMs: number;
  readonly revealAnims: Animation[];
}

interface RadarSpokeOptions {
  readonly line: SVGLineElement;
  readonly spokeIdx: number;
  readonly timing: RadarRevealTiming;
  readonly spokeStaggerMs: number;
  readonly revealAnims: Animation[];
}

const revealRadarSpoke = (options: Readonly<RadarSpokeOptions>): void => {
  const { line, spokeIdx, timing, spokeStaggerMs, revealAnims } = options;
  const delay = spokeIdx * spokeStaggerMs;
  const kfScale = buildRadarProgressKeyframes(timing, (progress) => ({ transform: `scale(${progress})` }));
  const kfOpacity = buildRadarProgressKeyframes(timing, (progress) => ({ opacity: String(progress) }));
  const animScale = line.animate(kfScale, { delay, duration: timing.durationMs, easing: timing.easing, fill: "backwards" });
  const animOpacity = line.animate(kfOpacity, { delay, duration: timing.durationMs, easing: timing.easing, fill: "backwards" });
  revealAnims.push(animScale, animOpacity);
  animScale.onfinish = (): void =>{  animScale.cancel(); };
  animOpacity.onfinish = (): void =>{  animOpacity.cancel(); };
}

const revealRadarSpokes = (options: Readonly<RadarSpokeRevealOptions>): void => {
  const { liveMarksGroup, timing, spokeStaggerMs, revealAnims } = options;
  const spokes = liveMarksGroup.querySelectorAll<SVGLineElement>('[data-ts-key^="spoke:"]');
  for (const [spokeIdx, line] of spokes.entries()) {
    revealRadarSpoke({ line, revealAnims, spokeIdx, spokeStaggerMs, timing });
  }
}

interface RadarLabelTextRevealOptions {
  readonly texts: NodeListOf<SVGTextElement>;
  readonly baseDelay: number;
  readonly staggerMs: number;
  readonly timing: RadarRevealTiming;
  readonly durationMs: number;
  readonly revealAnims: Animation[];
}

const revealRadarLabelTexts = (options: Readonly<RadarLabelTextRevealOptions>): void => {
  const { texts, baseDelay, staggerMs, timing, durationMs, revealAnims } = options;
  for (const [textIdx, labelText] of texts.entries()) {
    const delay = baseDelay + textIdx * staggerMs;
    const keyframes = buildRadarProgressKeyframes(timing, (progress) => ({ opacity: String(progress) }));
    const anim = labelText.animate(keyframes, { delay, duration: durationMs, easing: timing.easing, fill: "backwards" });
    revealAnims.push(anim);
    anim.onfinish = (): void =>{  anim.cancel(); };
  }
}

interface RadarLabelRevealOptions {
  readonly gridLabelsGroup: Element | null;
  readonly angleLabelsGroup: Element | null;
  readonly gridStaggerMs: number;
  readonly renderStaggerScale: number;
  readonly durationFactor: number;
  readonly timing: RadarRevealTiming;
  readonly revealAnims: Animation[];
}

const revealRadarLabels = (options: Readonly<RadarLabelRevealOptions>): void => {
  const { gridLabelsGroup, angleLabelsGroup, gridStaggerMs, renderStaggerScale, durationFactor, timing, revealAnims } = options;
  const labelGroups = [gridLabelsGroup, angleLabelsGroup].filter((group): group is Element => group !== null);
  for (const [groupIdx, labelGroup] of labelGroups.entries()) {
    const baseDelay = LABEL_BASE_DELAY_GRID_STAGGER_FACTOR * gridStaggerMs * LABEL_BASE_DELAY_FRACTION;
    const texts = labelGroup.querySelectorAll<SVGTextElement>("text");
    revealRadarLabelTexts({ baseDelay, durationMs: timing.durationMs * LABEL_FADE_DURATION_FRACTION, revealAnims, staggerMs: (groupIdx === 0 ? GRID_LABEL_STAGGER_MS : ANGLE_LABEL_STAGGER_MS) * renderStaggerScale * durationFactor, texts, timing });
  }
}

interface RadarSpringRevealOptions {
  readonly angleLabelsGroup: Element | null;
  readonly labelSpringSettleMs: number;
  readonly revealAnims: Animation[];
}

interface SpringRadarLabelOptions {
  readonly labelEl: SVGTextElement;
  readonly target: Readonly<{ x: number; y: number }>;
  readonly springProgress: readonly number[];
  readonly settleMs: number;
  readonly revealAnims: Animation[];
}

const springRadarLabel = (options: Readonly<SpringRadarLabelOptions>): void => {
  const { labelEl, target, springProgress, settleMs, revealAnims } = options;
  const { x, y } = target;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    const keyframes = springProgress.map((progress) =>
      ({ transform: `translate(${-(1 - progress) * x}px, ${-(1 - progress) * y}px)` }),
    );
    const anim = labelEl.animate(keyframes, {
      delay: 0,
      duration: settleMs,
      easing: "linear",
      fill: "backwards",
    });
    revealAnims.push(anim);
    anim.onfinish = (): void => {
      anim.cancel();
      labelEl.style.transform = "";
    };
  }
}

const revealRadarLabelSprings = (options: Readonly<RadarSpringRevealOptions>): void => {
  const { angleLabelsGroup, labelSpringSettleMs, revealAnims } = options;
  if (!angleLabelsGroup) {return;}
  // Labels spring outward from center (stiffness 80/damping 15/mass 1) via the shared sampler.
  const springProgress = sampleSpringProgress({ damping: LABEL_SPRING_DAMPING, durationMs: labelSpringSettleMs, mass: LABEL_SPRING_MASS, samples: LABEL_SPRING_SAMPLE_STEP_MS, stiffness: LABEL_SPRING_STIFFNESS });
  const labelEls = [...angleLabelsGroup.querySelectorAll<SVGTextElement>('text')];
  const targets = labelEls.map((labelEl) => ({
    x: Number(labelEl.getAttribute("x") ?? "NaN"),
    y: Number(labelEl.getAttribute("y") ?? "NaN"),
  }));
  for (const [labelIdx, labelEl] of labelEls.entries()) {
    springRadarLabel({ labelEl, revealAnims, settleMs: labelSpringSettleMs, springProgress, target: targets[labelIdx] });
  }
}

type RadarSetHoveredIndex = (index: number | null | ((prev: number | null) => number | null)) => void;

interface PushResolvedAreaOptions {
  readonly area: Readonly<RadarAreaProps>;
  readonly colorForIndex: (index: number) => string;
  readonly data: readonly RadarData[];
  readonly out: ResolvedRadarArea[];
}

const pushResolvedRadarArea = (options: PushResolvedAreaOptions): void => {
  // Skip areas whose index falls outside the data: the lookup below would yield no datum.
  if (!Number.isInteger(options.area.index) || options.area.index < 0 || options.area.index >= options.data.length) {return;}
  const datum: RadarData = options.data[options.area.index];
  options.out.push({
    className: options.area.className ?? "",
    color: options.area.color ?? options.colorForIndex(options.area.index),
    datum,
    index: options.area.index,
    showGlow: options.area.showGlow ?? true,
    showPoints: options.area.showPoints ?? true,
    showStroke: options.area.showStroke ?? true,
  });
};

const bindRadarAreaHovers = (areaEls: NodeListOf<SVGPathElement>, setHoveredIndex: RadarSetHoveredIndex, cleanups: (() => void)[]): void => {
  const areaArr = [...areaEls];
  for (let i = 0; i < areaArr.length; i += 1) {
    const path = areaArr[i];
    const idx = i;
    path.style.cursor = "pointer";
    const enter = (): void => {
      setHoveredIndex(idx);
    };
    const leave = (): void => {
      setHoveredIndex((prev: number | null) => (prev === idx ? null : prev));
    };
    path.addEventListener("pointerenter", enter);
    path.addEventListener("pointerleave", leave);
    cleanups.push(() => {
      path.removeEventListener("pointerenter", enter);
      path.removeEventListener("pointerleave", leave);
    });
  }
}

interface RadarDotHoverOptions {
  readonly dotEls: NodeListOf<SVGCircleElement>;
  readonly metricKeysLength: number;
  readonly setHoveredIndex: RadarSetHoveredIndex;
  readonly cleanups: (() => void)[];
}

const bindRadarDotHover = (circle: SVGCircleElement, seriesIdx: number, setHoveredIndex: RadarSetHoveredIndex): (() => void) => {
  circle.style.cursor = "pointer";
  const enter = (): void => {
    setHoveredIndex(seriesIdx);
  };
  const leave = (): void => {
    setHoveredIndex((prev: number | null) => (prev === seriesIdx ? null : prev));
  };
  circle.addEventListener("pointerenter", enter);
  circle.addEventListener("pointerleave", leave);
  return (): void => {
    circle.removeEventListener("pointerenter", enter);
    circle.removeEventListener("pointerleave", leave);
  };
}

const bindRadarDotHovers = (options: Readonly<RadarDotHoverOptions>): void => {
  const { dotEls, metricKeysLength, setHoveredIndex, cleanups } = options;
  const dotArr = [...dotEls];
  for (let i = 0; i < dotArr.length; i += 1) {
    const circle = dotArr[i];
    const seriesIdx = Math.floor(i / Math.max(1, metricKeysLength));
    cleanups.push(bindRadarDotHover(circle, seriesIdx, setHoveredIndex));
  }
}

const runRadarHoverCleanups = (cleanups: readonly (() => void)[]): void => {
  for (const fn of cleanups) {fn();}
}

interface RadarHoverTargetOptions {
  readonly container: Readonly<HTMLElement>;
  readonly setHoveredIndex: RadarSetHoveredIndex;
  readonly metricKeysLength: number;
}

// Hover wiring for area paths and dots; returns the effect cleanup.
// Enter owns opacity only, hover owns fill/stroke/r: disjoint sets, no two-writer race.
const bindRadarHoverTargets = (options: Readonly<RadarHoverTargetOptions>): (() => void) => {
  const { container, setHoveredIndex, metricKeysLength } = options;
  const areaEls = container.querySelectorAll<SVGPathElement>(".ts-chart__radial-area path");
  const dotEls = container.querySelectorAll<SVGCircleElement>(".ts-chart__radial-dot circle");
  const cleanups: (() => void)[] = [];
  bindRadarAreaHovers(areaEls, setHoveredIndex, cleanups);
  bindRadarDotHovers({ cleanups, dotEls, metricKeysLength, setHoveredIndex });
  return (): void => {
    runRadarHoverCleanups(cleanups);
  };
};

const cancelRadarAnims = (anims: readonly Animation[]): void => {
  for (const anim of anims) {
    try { anim.cancel(); } catch {
      // Cancelling a finished animation throws: the reveal is already settled.
    }
  }
}

interface RadarReplayRefs {
  readonly prevMotionReplayKeyRef: RefObject<string>;
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly gridRevealedRef: RefObject<boolean>;
}

const resetRadarReplay = (motionReplayKey: string, refs: RadarReplayRefs): void => {
  refs.prevMotionReplayKeyRef.current = motionReplayKey;
  for (const anim of refs.revealAnimsRef.current) {
    try { anim.cancel(); } catch {
      // Cancelling a finished animation throws: the replay reset already settled it.
    }
  }
  refs.revealAnimsRef.current = [];
  refs.gridRevealedRef.current = false;
}

const scheduleRadarReveal = (container: HTMLElement, shouldReveal: () => boolean, handleRender: (args: { container: HTMLElement }) => void): (() => void) => {
  const raf = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!shouldReveal()) {return;}
      handleRender({ container });
    });
  });
  return (): void =>{  cancelAnimationFrame(raf); };
}

type HoveredIndexUpdater = (prev: number | null) => number | null;

// Anti-slop permits `typeof` inside a type guard; setHoveredIndex branches on this predicate instead.
const isHoveredIndexUpdater = (index: number | null | HoveredIndexUpdater): index is HoveredIndexUpdater =>
  typeof index === "function";

const RadarChart = ({
  data,
  metrics,
  size: fixedSize,
  levels = DEFAULT_LEVELS,
  margin = DEFAULT_MARGIN,
  animate = true,
  enterDurationMs = RADAR_ENTER_DURATION_MS,
  staggerScale = 1,
  enterTransition,
  motionReplayKey = "",
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  className,
  style,
  children,
}: Readonly<RadarChartProps>): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useDebouncedContainerSize(containerRef);
  const chartSize = fixedSize ?? Math.min(width, height);

  const { grid, axis, labels, areas } = useMemo(
    () => extractRadarChildren(children),
    [children],
  );

  const isControlled = controlledHoveredIndex !== undefined;
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const hoveredIndex = isControlled ? (controlledHoveredIndex ?? null) : internalHoveredIndex;

  const setHoveredIndex = useCallback(
    (index: number | null | HoveredIndexUpdater) => {
      const prevValue = isControlled ? controlledHoveredIndex ?? null : internalHoveredIndex;
      const next = isHoveredIndexUpdater(index) ? index(prevValue) : index;
      if (isControlled) {
        onHoverChange?.(next);
      } else {
        setInternalHoveredIndex(next);
      }
    },
    [isControlled, onHoverChange, controlledHoveredIndex, internalHoveredIndex],
  );

  const gridRevealedRef = useRef(false);
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  const colorForIndex = useCallback(
    (index: number): string => {
      const item = data[index];
      const itemColor: string = item.color ?? "";
      if (itemColor !== "") {return itemColor;}
      return DEFAULT_RADAR_COLORS[index % DEFAULT_RADAR_COLORS.length];
    },
    [data],
  );

  const resolvedAreas = useMemo<ResolvedRadarArea[]>(() => {
    const out: ResolvedRadarArea[] = [];
    for (const area of areas) {pushResolvedRadarArea({ area, colorForIndex, data, out });}
    return out;
  }, [areas, data, colorForIndex]);

  const metricKeys = useMemo(() => metrics.map((metric) => metric.key), [metrics]);
  const areaCount = resolvedAreas.length;

  const metricLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const metric of metrics) {map.set(metric.key, metric.label);}
    return map;
  }, [metrics]);

  const allRows = useMemo<RadarRow[]>(() => {
    // Wide->long reshape is a manual fold: Metric keys are dynamic strings, which match
    // No public fold overload (fields requires a literal tuple), so TanStack fold is unusable here.
    const rows: RadarRow[] = [];
    for (const [areaIndex, area] of resolvedAreas.entries()) {
      const paddedIndex = String(areaIndex).padStart(Z_PAD, "0");
      // MotionReplayKey rides the z-group identity so bumps replay the campaign (sunburst playKey precedent).
      const replayGroup = `${motionReplayKey}:${paddedIndex}`;
      for (const metric of metrics) {
        rows.push({
          metric: metric.key,
          replayGroup,
          series: paddedIndex,
          value: area.datum.values[metric.key] ?? 0,
        });
      }
    }
    return rows;
  }, [resolvedAreas, metrics, motionReplayKey]);

  const prevMotionReplayKeyRef = useRef(motionReplayKey);

  const radarMarkMotion = useCallback(
    (ctx: Readonly<ChartMotionContext<RadarRow>>) => {
      if (!animate) {return false as const;}
      if (ctx.phase !== "enter") {
        // Hover/remove changes stay instant: legacy never transitioned those, so update/exit pin to 0.
        return { transition: { duration: 0, type: "tween" as const } };
      }
      return resolveRadarSeriesEnter(ctx.seriesIndex, { enterDurationMs, enterTransition, levels, staggerScale });
    },
    [animate, enterDurationMs, enterTransition, levels, staggerScale],
  );

  const radarAreaMark = useMemo(() => radialArea(allRows, {
    angle: "metric",
    curve: curveLinearClosed,
    fill: makeRadarAreaFill(resolvedAreas, hoveredIndex),
    fillOpacity: 1,
    id: "radar-area",
    key: "metric",
    motion: radarMarkMotion,
    radius: "value",
    stroke: makeRadarAreaStroke(resolvedAreas, hoveredIndex),
    strokeWidth: STROKE_WIDTH_REST,
    z: "replayGroup",
  }), [allRows, resolvedAreas, hoveredIndex, radarMarkMotion]);

  const radarDotMark = useMemo(() => radialDot(allRows, {
    angle: "metric",
    fill: makeRadarDotFill(resolvedAreas, hoveredIndex),
    id: "radar-dot",
    key: "metric",
    motion: radarMarkMotion,
    r: makeRadarDotRadius(resolvedAreas.length, hoveredIndex),
    radius: "value",
    stroke: RADAR_BACKGROUND_VAR,
    strokeWidth: 2,
    z: "replayGroup",
  }), [allRows, resolvedAreas, hoveredIndex, radarMarkMotion]);

  const definition = useMemo((): DomChartDefinition<RadarRow, string, number> | undefined =>
    buildRadarDefinition({ axis, chartSize, grid, hoveredIndex, labels, levels, margin, metricKeys, metricLabelByKey, motionReplayKey, radarAreaMark, radarDotMark, resolvedAreas })
  , [
    chartSize,
    grid,
    axis,
    labels,
    levels,
    metricKeys,
    metricLabelByKey,
    resolvedAreas,
    radarAreaMark,
    radarDotMark,
    margin,
    hoveredIndex,
    motionReplayKey,
  ]);

  const handleRender = useCallback(
    ({ container }: { container: HTMLElement }): void => {
      if (!beginRadarReveal(container, animate, gridRevealedRef)) {return;}
      // DurationFactor scales stagger delays only, not transition timing.
      // Label springs ignore durationFactor: the deadline must cover the longest live animation.
      const setup = resolveRadarRevealSetup({ enterDurationMs, enterTransition, levels, staggerScale });

      revealDeadlineTimerRef.current = setRevealDeadline(
        setup.deadlineMs,
        {
          animationsRef: revealAnimsRef,
          onDeadline: () => {
            // No deadline fallback: the animation finish handlers settle the reveal.
          },
        },
      );

      revealPostPaintCancelRef.current = onPostPaint(() => {
        const liveMarksGroup = container.querySelector<SVGGElement>(MARKS_GROUP_SELECTOR);
        if (!liveMarksGroup) {return;}
        clearRadarRevealStyles(liveMarksGroup);
        const { gridLabelsGroup, angleLabelsGroup } = findRadarLabelGroups(liveMarksGroup, container);
        revealRadarRings({ gridStaggerMs: setup.gridStaggerMs, liveMarksGroup, revealAnims: revealAnimsRef.current, timing: setup.timing });
        revealRadarSpokes({ liveMarksGroup, revealAnims: revealAnimsRef.current, spokeStaggerMs: SPOKE_STAGGER_MS * setup.renderStaggerScale * setup.durationFactor, timing: setup.timing });
        revealRadarLabels({ angleLabelsGroup, durationFactor: setup.durationFactor, gridLabelsGroup, gridStaggerMs: setup.gridStaggerMs, renderStaggerScale: setup.renderStaggerScale, revealAnims: revealAnimsRef.current, timing: setup.timing });
        revealRadarLabelSprings({ angleLabelsGroup, labelSpringSettleMs: setup.labelSpringSettleMs, revealAnims: revealAnimsRef.current });

        liveMarksGroup.classList.remove("ts-chart__marks--revealing");
      });
    },
    [animate, enterDurationMs, enterTransition, levels, staggerScale],
  );

  useLayoutEffect((): (() => void) | undefined => {
    const container = containerRef.current;
    if (!container) {return undefined;}
    // With no series there are no hover targets, so there is nothing to bind.
    if (areaCount === 0) {return undefined;}
    return bindRadarHoverTargets({ container, metricKeysLength: metricKeys.length, setHoveredIndex });
  }, [areaCount, metricKeys, setHoveredIndex]);

  useEffect(() => {
    const revealAnims = revealAnimsRef.current;
    isMountedRef.current = true;
    return (): void => {
      isMountedRef.current = false;
      setTimeout(() => {
        if (isMountedRef.current) {return;}
        if (revealDeadlineTimerRef.current !== null) {
          globalThis.clearTimeout(revealDeadlineTimerRef.current);
          revealDeadlineTimerRef.current = null;
        }
        revealPostPaintCancelRef.current?.();
        revealPostPaintCancelRef.current = null;
        cancelRadarAnims(revealAnims);
        revealAnimsRef.current = [];
      }, 0);
    };
  }, []);


  // Non-reactive reveal trigger: the grid-reveal effect below only re-runs when
  // Animation toggles, while always invoking the latest `handleRender` post-paint.
  const handleGridRevealPaint = useEffectEvent((): void => {
    const container = containerRef.current;
    if (!container) {return;}
    handleRender({ container });
  });

  useLayoutEffect((): (() => void) | undefined => {
    if (gridRevealedRef.current) {return undefined;}
    if (!animate) {return undefined;}
    const container = containerRef.current;
    if (!container) {return undefined;}
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gridRevealedRef.current) {return;}
        if (!container.querySelector(MARKS_GROUP_SELECTOR)) {return;}
        if (hasLiveRevealAnims(container)) {return;}
        handleGridRevealPaint();
      });
    });
    return (): void =>{  cancelAnimationFrame(raf); };
  }, [animate]);

  // MotionReplayKey remounts grid/labels (WAAPI half); the area/dot half replays natively via keys.
  useLayoutEffect((): (() => void) | undefined => {
    if (!animate || prevMotionReplayKeyRef.current === motionReplayKey) {return undefined;}
    resetRadarReplay(motionReplayKey, { gridRevealedRef, prevMotionReplayKeyRef, revealAnimsRef });
    const container = containerRef.current;
    if (!container) {return undefined;}
    return scheduleRadarReveal(container, (): boolean => container.querySelector(MARKS_GROUP_SELECTOR) !== null && !hasLiveRevealAnims(container), handleRender);
  }, [animate, motionReplayKey, handleRender]);

  const containerStyle = useMemo((): CSSProperties => ({
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    position: "relative",
    ...((fixedSize ?? 0) === 0
      ? { aspectRatio: "1 / 1", width: "100%" }
      : { height: fixedSize, width: fixedSize }),
    ...style,
  }), [fixedSize, style]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="radar"
    >
      {definition && (
        <RendererChart
          ariaLabel="Radar chart"
          width={chartSize}
          height={chartSize}
          definition={definition}
          renderer={chartMotionRenderer<RadarRow, string, number>()}
          onRender={handleRender}
        />
      )}
    </div>
  );
}

export { RadarArea } from "./internal/radar-area-child";
export { RadarAxis } from "./internal/radar-axis-child";
export { RadarGrid } from "./internal/radar-grid-child";
export { RadarLabels } from "./internal/radar-labels-child";
export type { RadarAreaProps } from "./internal/radar-area-child";
export type { RadarAxisProps } from "./internal/radar-axis-child";
export type { RadarGridProps } from "./internal/radar-grid-child";
export type { RadarLabelsProps } from "./internal/radar-labels-child";
export { DEFAULT_RADAR_COLORS, RadarChart };
export type { RadarChartProps, RadarData, RadarEnterTransition, RadarMetric };
