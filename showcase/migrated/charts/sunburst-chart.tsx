/*
 * TanStack-native redo (D102). Architecture, the C5d angle-parity conditions verified against
 * d3-hierarchy 3.1.2, and the deliberate hover-pop deviation: ./sunburst-architecture.md
 */

import {
  isValidElement,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import type { ChartMotionContext } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { polar } from "@tanstack/charts/polar";
import { sunburst } from "@tanstack/charts/hierarchy/sunburst";
import type { SunburstNode as TSSunburstNode } from "@tanstack/charts/hierarchy/sunburst";
import {
  arcPath,
  buildArcs,
  buildSunburstFlatRows,
  geometryFor,
  ringOptions,
  geomCentroidAngle,
  geomCentroidRadius,
  defaultSunburstGrowPadding,
  transitionGeometry,
} from "./internal/sunburst-geometry";
import type { ArcDatum, ArcGeometry, Focus, SunburstFlatRow } from "./internal/sunburst-geometry";
import {
  defaultSunburstColors,
  opacityForRelativeDepth,
} from "./internal/sunburst-colors";
import type { SunburstNode } from "./internal/sunburst-types";
import { buildRevealTiming, maxRevealDelayMs } from "./internal/sunburst-reveal";
import { setRevealDeadline } from "./internal/deferred-reveal";
import {
  cancelLabelAnimations,
  resetLabelsOverlayForReplay,
  startLabelReveal,
} from "./internal/sunburst-label-reveal";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { displayNameOf } from "./internal/children-extract";
import { SunburstCenterOverlay } from "./internal/sunburst-center-overlay";
import { SunburstLabelsOverlay } from "./internal/sunburst-labels-overlay";
import { SunburstHitLayer } from "./internal/sunburst-hit";
import type { SunburstHitItem } from "./internal/sunburst-hit";
import type { SunburstSegmentProps } from "./internal/sunburst-segment";
import { resolveSunburstHintContent } from "./internal/sunburst-hint-content";
import { SunburstHintDisplay } from "./internal/sunburst-hint";
import type { SunburstHintProps } from "./internal/sunburst-hint";
import { CHART_CATEGORY_PALETTE } from "./internal/design-tokens";
import { clipRevealTiming } from "./internal/enter-transition";
import type { EnterTransition } from "./internal/enter-transition";
import { motionEasingFromCss } from "./internal/pie-hover-chrome";
import { chartMotionRenderer } from "./internal/motion-renderer";
import "./styles.css";

// Bklit sunburst arc sweep: 1100ms cubic-bezier(.85,0,.15,1) (was inlined at
// The two call sites below before P5.5 SB2 gave `enterTransition` a home).
const SUNBURST_SWEEP_MS = 1100;
const SUNBURST_SWEEP_EASE = "cubic-bezier(0.85,0,0.15,1)";
// Legacy zoom timing, now the arc mark's native update transition.
const SUNBURST_ZOOM_MS = 750;
const SUNBURST_ZOOM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// Full opacity: the undimmed alpha for the hovered arc and its relatives.
const FULL_OPACITY = 1;
// Hover-dim alpha for arcs unrelated to the hovered arc (bklit 0.25, styles.css:424-427).
const HOVER_DIM_ALPHA = 0.25;
// Minimum visible ring depth: resolveVisibleDepth never drops below the focused ring itself.
const MIN_VISIBLE_DEPTH = 1;
// Label legibility floors: minimum arc length and ring thickness in pixels for a label to render.
const LABEL_MIN_ARC_LENGTH_PX = 26;
const LABEL_MIN_RING_WIDTH_PX = 16;
// SB15 whole-stage fade-in duration, matching legacy motion.svg opacity 0 to 1.
const STAGE_FADE_IN_MS = 350;
// Slack added to sweep plus stagger when scheduling the reveal-phase deadline timer.
const REVEAL_DEADLINE_SLACK_MS = 935;
// Fraction of the sweep duration added to the max stagger delay before labels reveal.
const LABELS_REVEAL_DELAY_FRACTION = 0.85;
// Smallest chart radius in pixels after grow-padding is subtracted.
const MIN_SUNBURST_RADIUS_PX = 8;
// Default chart size and hover pop-out, matching bklit's SunburstChart defaults.
const DEFAULT_SUNBURST_SIZE = 520;
const DEFAULT_HOVER_POP = 8;
// Percentage scale for color-mix alpha weights: unit alpha (0-1) formats as 0-100%.
const ALPHA_TO_PERCENT = 100;
// Degree geometry for label rotation: radians-to-degrees half-circle and the flip threshold.
const DEGREES_PER_HALF_CIRCLE = 180;
const LABEL_FLIP_THRESHOLD_DEGREES = 90;

const applyAlphaToColor = (color: string, alpha: number): string => {
  if (alpha >= FULL_OPACITY) {return color;}
  return `color-mix(in srgb, ${color} ${Math.round(alpha * ALPHA_TO_PERCENT)}%, transparent)`;
}

const isRelatedArc = (arc: ReadonlySunburstArc, hovered: ReadonlySunburstArc): boolean =>
  arc.id === hovered.id || arc.id.startsWith(`${hovered.id} / `) || hovered.id.startsWith(`${arc.id} / `);

// Hover/dim small helpers, hoisted so render-path callbacks stay thin.
const hoverDimFactor = (arcId: string, hoveredId: string | undefined): number => {
  if (hoveredId === undefined) {
    return FULL_OPACITY;
  }
  if (arcId === hoveredId || arcId.startsWith(`${hoveredId} / `) || hoveredId.startsWith(`${arcId} / `)) {
    return FULL_OPACITY;
  }
  return HOVER_DIM_ALPHA;
};
const resolveVisibleDepth = (maxDepth: number, focusDepth: number): number => Math.max(MIN_VISIBLE_DEPTH, maxDepth - focusDepth);
const resolveCenterR = (focusDepth: number, maxDepth: number, radius: number): number =>
  ringOptions(focusDepth, maxDepth, radius).centerR;
const resolveSunburstHintText = (hoveredTrail: readonly string[] | undefined, focusDepth: number): string => {
  if (hoveredTrail !== undefined) {
    return hoveredTrail.join("  \u203A  ");
  }
  if (focusDepth === 0) {
    return "Click a segment to zoom in · hover to inspect";
  }
  return "Click the center to zoom out";
};

/*
 * Native keys are fixed `${markId}:node:${valueKey(id)}` with no key option; length-prefix decode keeps separator-bearing ids intact.
 */
// Decodes a native sunburst scene key's trailing "<length>:<id>" payload.
// Returns undefined when the key does not carry a parseable id.
const parseSunburstPathId = (key: string, prefix: string): string | undefined => {
  // The remainder is "<length>:<id>".
  const rest = key.slice(prefix.length);
  const sep = rest.indexOf(":");
  if (sep === -1) {return undefined;}
  const length = Number(rest.slice(0, sep));
  if (!Number.isFinite(length)) {return undefined;}
  return rest.slice(sep + 1, sep + 1 + length);
};

const getSunburstPathMap = (container: HTMLElement, markId: string): Map<string, SVGPathElement> => {
  const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
  const prefix = `${markId}:node:string:`;
  const allPaths = marksGroup
    ? marksGroup.querySelectorAll<SVGPathElement>(`path[data-ts-key^="${prefix}"]`)
    : container.querySelectorAll<SVGPathElement>(`path[data-ts-key^="${prefix}"]`);
  const map = new Map<string, SVGPathElement>();
  for (const el of allPaths) {
    const id = parseSunburstPathId(el.dataset.tsKey ?? "", prefix);
    if (id !== undefined && !map.has(id)) {map.set(id, el);}
  }
  return map;
}

/*
 * Deep-readonly arc view: `Readonly<ArcDatum>` leaves `trail` mutable; mirrors the unexported helper in sunburst-geometry.ts.
 */
type ReadonlySunburstArc = Readonly<Omit<ArcDatum, "trail">> & {
  readonly trail: readonly string[];
};

// Single label overlay entry, resolved from an arc's zoom-morphed geometry.
interface SunburstLabelEntry {
  readonly deg: number;
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

// Normalizes a centroid angle into a readable label rotation in degrees.
const normalizeLabelRotation = (midAngle: number): number => {
  const rawDegrees = (midAngle * DEGREES_PER_HALF_CIRCLE) / Math.PI - LABEL_FLIP_THRESHOLD_DEGREES;
  if (rawDegrees > LABEL_FLIP_THRESHOLD_DEGREES) {return rawDegrees - DEGREES_PER_HALF_CIRCLE;}
  if (rawDegrees < -LABEL_FLIP_THRESHOLD_DEGREES) {return rawDegrees + DEGREES_PER_HALF_CIRCLE;}
  return rawDegrees;
};

// Builds the zero-or-one label entries for one arc's resolved geometry,
// Applying the hover-cull and minimum-size rules.
const buildLabelEntry = (
  arc: ReadonlySunburstArc,
  base: Readonly<ArcGeometry>,
  hoveredArc: ReadonlySunburstArc | null,
): SunburstLabelEntry[] => {
  if (hoveredArc && !isRelatedArc(arc, hoveredArc)) {return [];}
  const centroidRadius = geomCentroidRadius(base);
  if ((base.a1 - base.a0) * centroidRadius < LABEL_MIN_ARC_LENGTH_PX || base.outerR - base.innerR < LABEL_MIN_RING_WIDTH_PX) {return [];}
  const midAngle = geomCentroidAngle(base);
  const itemX = Math.sin(midAngle) * centroidRadius;
  const itemY = -Math.cos(midAngle) * centroidRadius;
  return [{ deg: normalizeLabelRotation(midAngle), id: arc.id, label: arc.name, x: itemX, y: itemY }];
};

// Binds one rendered arc path's click-to-zoom listener, returning its cleanup.
const bindArcClick = (
  pathElement: SVGPathElement,
  arc: ReadonlySunburstArc,
  onZoomId: (zoomId: string) => void,
): (() => void) => {
  const handleClick = (): void => {
    if (arc.hasChildren) {onZoomId(arc.id);}
  };
  pathElement.addEventListener("click", handleClick);
  return (): void => {
    pathElement.removeEventListener("click", handleClick);
  };
};

const attachSunburstPathClicks = (
  elementMap: ReadonlyMap<string, SVGPathElement>,
  sortedArcs: readonly ReadonlySunburstArc[],
  onZoomId: (zoomId: string) => void,
): (() => void) | undefined => {
  if (elementMap.size === 0) {return undefined;}
  const cleanups: (() => void)[] = [];
  for (const arc of sortedArcs) {
    const pathElement = elementMap.get(arc.id);
    if (pathElement) {cleanups.push(bindArcClick(pathElement, arc, onZoomId));}
  }
  return (): void => {
    for (const cleanup of cleanups) {cleanup();}
  };
};

// Fades the chart stage in on mount, returning its teardown, or undefined when
// The stage is not rendered yet.
const fadeInChartStage = (container: HTMLElement): (() => void) | undefined => {
  const stage = container.querySelector<SVGSVGElement>("svg.ts-chart");
  if (!stage) {return undefined;}
  stage.style.opacity = "0";
  const fadeAnimation = stage.animate(
    [{ opacity: "0" }, { opacity: "1" }],
    { duration: STAGE_FADE_IN_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
  );
  return (): void => {
    fadeAnimation.cancel();
    stage.style.opacity = "";
  };
};

// Sunburst reveal phase, shared by the phase plumbing below.
type SunburstPhase = "loading" | "revealing" | "ready";

interface SunburstChartProps {
  readonly data: SunburstNode;
  readonly size?: number;
  readonly playKey?: number;
  readonly className?: string;
  readonly focusId?: string;
  readonly onFocusChange?: (focusId: string) => void;
  hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly hoverPop?: number;
  readonly padding?: number;
  readonly onPhaseChange?: (phase: SunburstPhase) => void;
  /** P5.5 SB2 — bklit `sunburst-chart.tsx:101`. Overrides the per-arc angular
      sweep's duration/easing (spring coerced to tween, bklit `animation.ts:18`;
      the sweep animates path `d`, which springs cannot drive natively). */
  readonly enterTransition?: EnterTransition;
  /** P5.5 SB2 — bklit `sunburst-chart.tsx:102`, default 1. Multiplies the
      ring-stagger spread; `internal/sunburst-reveal.ts`'s `buildRevealTiming`
      / `maxRevealDelayMs` already take it (clamped at 0.25) — it was simply
      never plumbed from the prop. */
  readonly enterStaggerScale?: number;
  readonly children: ReactNode;
}

/*
 * Match bklit: accept function or object types so memoised carriers still classify by displayName alone.
 */
const isDisplayNameCarrier = (type: ReactElement["type"]): type is ReactElement["type"] & { displayName?: string } =>
  typeof type === "function" || typeof type === "object";

const isChildOfKind = (child: ReactNode, displayName: string): boolean => {
  if (!isValidElement(child)) {return false;}
  const type: ReactElement["type"] = child.type;
  if (!isDisplayNameCarrier(type)) {return false;}
  return displayNameOf(type) === displayName;
}

interface SunburstSegmentConfig {
  arcIndex: number;
  readonly color?: string;
  readonly fill?: string;
  readonly fillOpacity?: number;
}

interface ClassifiedChildren {
  readonly centerCount: number;
  readonly labelsCount: number;
  readonly hintCount: number;
  /** P5.5 SB4 — the last `<SunburstHint>`'s own props, so the chart can
      resolve its render-prop `children` against live state. */
  readonly hintProps: SunburstHintProps | undefined;
  /** P5.5 SB8 — bklit's `isOutsideSvgComponent` (`sunburst-chart.tsx:56-58`)
      pulls `SunburstBreadcrumb` out of the SVG and renders it ABOVE the square
      chart box (`:449-454`). Unlike the other carriers this one draws its own
      markup, so the elements are kept as-is and re-emitted in that slot. */
  readonly breadcrumbChildren: readonly ReactNode[];
  readonly segmentConfigs: readonly SunburstSegmentConfig[];
}

const classifyChildren = (children: ReactNode): ClassifiedChildren => {
  let centerCount = 0;
  let labelsCount = 0;
  let hintCount = 0;
  let hintProps: SunburstHintProps | undefined = undefined;
  const breadcrumbChildren: ReactNode[] = [];
  const segmentConfigs: SunburstSegmentConfig[] = [];

  // Flatten nested child arrays without React.Children; key assignment is unused here.
  for (const child of [children].flat(Infinity)) {
    if (isChildOfKind(child, "SunburstCenter")) {
      centerCount += 1;
    } else if (isChildOfKind(child, "SunburstLabels")) {
      labelsCount += 1;
    } else if (isChildOfKind(child, "SunburstHint")) {
      hintCount += 1;
      if (isValidElement<SunburstHintProps>(child)) {
        hintProps = child.props;
      }
    } else if (isChildOfKind(child, "SunburstBreadcrumb")) {
      breadcrumbChildren.push(child);
    } else if (isChildOfKind(child, "SunburstSegment")) {
      if (isValidElement<SunburstSegmentProps>(child)) {
        const { index, color, fill, fillOpacity } = child.props;
        segmentConfigs.push({
          arcIndex: index,
          color,
          fill,
          fillOpacity,
        });
      }
    } else {
      // Non-carrier child (e.g. plain text) — nothing to classify.
    }
  };

  return {
    breadcrumbChildren,
    centerCount,
    hintCount,
    hintProps,
    labelsCount,
    segmentConfigs,
  };
}

interface SunburstChartInnerProps {
  readonly data: SunburstNode;
  readonly size: number;
  readonly rootClassName?: string;
  readonly focus: Focus;
  readonly layout: {
    arcs: ArcDatum[];
    maxDepth: number;
    focusById: Map<string, Focus>;
    rootId: string;
    sortedArcs: ArcDatum[];
  };
  readonly focusId: string;
  readonly isFocusControlled: boolean;
  readonly setInternalFocusId: (id: string) => void;
  readonly setPhase: (phase: SunburstPhase) => void;
  readonly onFocusChange?: (focusId: string) => void;
  readonly hoveredIndexProp?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly hoverPop: number;
  readonly paddingProp?: number;
  readonly prefersReducedMotion: boolean;
  readonly playKey: number;
  /** SB2 — resolved arc-sweep timing, computed once in the outer component. */
  readonly sweepDurationMs: number;
  readonly sweepEasingCss: string;
  readonly enterStaggerScale: number;
  readonly children: ReactNode;
}

const SunburstChartInner = ({
  data,
  size,
  rootClassName,
  focus,
  layout,
  focusId,
  isFocusControlled,
  setInternalFocusId,
  setPhase,
  onFocusChange,
  hoveredIndexProp,
  onHoverChange,
  hoverPop,
  paddingProp,
  prefersReducedMotion,
  playKey,
  sweepDurationMs,
  sweepEasingCss,
  enterStaggerScale,
  children,
}: SunburstChartInnerProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Layout (verbatim bklit math) ---
  const { arcs, maxDepth, focusById, rootId, sortedArcs } = layout;

  const fullRadius = size / 2;
  const growPadding = paddingProp ?? defaultSunburstGrowPadding(maxDepth, size, hoverPop);
  const radius = Math.max(MIN_SUNBURST_RADIUS_PX, fullRadius - growPadding);

  // --- Hover state (direct React state, no coordinator mediator) ---
  const isHoverControlled = hoveredIndexProp !== undefined;
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const hoveredArcIndex = hoveredIndexProp ?? internalHoveredIndex;

  const setHoveredArcIndex = useCallback(
    (index: number | null) => {
      if (isHoverControlled) {
        onHoverChange?.(index);
      } else {
        setInternalHoveredIndex(index);
      }
    },
    [isHoverControlled, onHoverChange],
  );

  const hoveredArc = useMemo(() => {
    if (hoveredArcIndex === null) {return null;}
    return arcs[hoveredArcIndex] ?? null;
  }, [arcs, hoveredArcIndex]);

  // --- Children classification ---
  const {
    centerCount,
    labelsCount,
    hintCount,
    hintProps,
    breadcrumbChildren,
    segmentConfigs,
  } = useMemo(() => classifyChildren(children), [children]);

  const segmentConfigMap = useMemo(
    () => new Map(segmentConfigs.map((config) => [config.arcIndex, config])),
    [segmentConfigs],
  );

  // --- Color helpers ---
  const getColor = useCallback(
    (categoryIndex: number, nodeColor?: string) =>
      nodeColor ?? defaultSunburstColors[categoryIndex % defaultSunburstColors.length],
    [],
  );

  const getFill = useCallback(
    (arcIndex: number, fillOverride?: string, colorOverride?: string) => {
      if (fillOverride !== undefined && fillOverride !== "") {return fillOverride;}
      if (!Number.isInteger(arcIndex) || arcIndex < 0 || arcIndex >= arcs.length) {return defaultSunburstColors[0];}
      const arc = arcs[arcIndex];
      return colorOverride ?? arc.fill ?? arc.color ?? getColor(arc.categoryIndex);
    },
    [arcs, getColor],
  );

  /*
   * Click commits focus immediately; the committed geometry renders under the in-flight morph so nothing jumps.
   */
  const [zoomT, setZoomT] = useState(1);
  const [prevFocusId, setPrevFocusId] = useState(rootId);
  const prevFocus = focusById.get(prevFocusId) ?? focus;
  const zoomGen = useRef(0);
  /*
   * Reveal-cycle identity: resets only the labels-reveal mount-vs-replay guard; arcs replay via the mark's own key.
   */
  const playCycleRef = useRef<string>(`${playKey}`);
  const revealDeadlineTimerRef = useRef<number | null>(null);

  /*
   * Reset during render so the first commit carries it; an effect would flash one stale-focus frame.
   */
  const [prevRootId, setPrevRootId] = useState(rootId);
  if (prevRootId !== rootId) {
    setPrevRootId(rootId);
    setPrevFocusId(rootId);
    setZoomT(1);
  }

  const commitFocus = useCallback(
    (nextId: string) => {
      if (isFocusControlled) {onFocusChange?.(nextId);}
      else {setInternalFocusId(nextId);}
    },
    [isFocusControlled, onFocusChange, setInternalFocusId],
  );

  /*
   * Native morph interpolates from the live `d`, so an interrupted zoom continues visually; the generation guard retires old ticks.
   */
  const beginZoomTween = useCallback((): void => {
    if (prefersReducedMotion) {
      setZoomT(1);
      return;
    }
    zoomGen.current += 1;
    const gen = zoomGen.current;
    setZoomT(0);
    requestAnimationFrame((): void => {
      if (zoomGen.current !== gen) {return;}
      const start = performance.now();
      const tick = (): void => {
        if (zoomGen.current !== gen) {return;}
        const elapsed = performance.now() - start;
        const progress = Math.min(1, elapsed / SUNBURST_ZOOM_MS);
        setZoomT(progress);
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setZoomT(1);
        }
      };
      requestAnimationFrame(tick);
    });
  }, [prefersReducedMotion]);

  const zoomTo = useCallback(
    (nextId: string) => {
      if (nextId === focusId || !focusById.has(nextId)) {return;}

      // Midpoint-snapshot nuance (audit §4 row1): if a zoom is already
      // In-flight, bump the rAF generation so the old tick loop exits.
      if (zoomT < 1) {
        zoomGen.current += 1;
      }

      // Commit immediately — prevFocusId becomes the tween's FROM state.
      setPrevFocusId(focusId);
      commitFocus(nextId);
      setHoveredArcIndex(null);
      beginZoomTween();
    },
    [
      beginZoomTween,
      commitFocus,
      focusById,
      focusId,
      setHoveredArcIndex,
      zoomT,
    ],
  );

  const zoomToEvent = useEffectEvent((nextId: string): void => {
    zoomTo(nextId);
  });

  /*
   * Native stratifies flat rows, not the nested tree; `arcsById` bridges native callbacks back to `buildArcs` state.
   */
  const flatRows = useMemo(() => buildSunburstFlatRows(data), [data]);
  const arcsById = useMemo(() => new Map(arcs.map((arc) => [arc.id, arc])), [arcs]);

  const revealDelayById = useMemo(() => {
    const timingList = buildRevealTiming(arcs, enterStaggerScale);
    return new Map(timingList.map((timing) => [timing.arcId, timing.delayMs]));
  }, [arcs, enterStaggerScale]);

  /*
   * `playKey` is folded into the mark id so a bump re-keys every child at once; `getSunburstPathMap` must receive the same string.
   */
  const sunburstMarkId = `sunburst-arcs-${playKey}`;
  // C5d: focus-derived mark options, hoisted so the definition below stays shallow.
  const visibleDepthValue = resolveVisibleDepth(maxDepth, focus.depth);
  const centerRValue = resolveCenterR(focus.depth, maxDepth, radius);

  // --- TanStack definition: native `sunburst()` (C5d, D-TBD — see file ---
  // --- header for the full design writeup and the hover-grow deviation) ---
  const definition = useMemo(() => defineChart({
      /*
       * Keyboard focus only; `focusRing: false` because dim geometry is already the authored focus treatment.
       */
      focusRing: false,
      guides: false,
      marks: [
        polar({
          endAngle: -Math.PI / 2 + 2 * Math.PI,
          marks: [
            sunburst(flatRows, {
              fill: (node: TSSunburstNode<SunburstFlatRow>) => {
                const arc = arcsById.get(node.id);
      if (!arc) {return defaultSunburstColors[0];}
                const config = segmentConfigMap.get(arc.arcIndex);
                const resolvedFill = getFill(arc.arcIndex, config?.fill, config?.color);
                const relativeDepth = arc.depth - focus.depth;
                const baseOpacity = config?.fillOpacity ?? opacityForRelativeDepth(relativeDepth);
                /*
                 * Native has no per-datum opacity channel, so hover dimming is folded into the per-datum `fill` alpha.
                 */
                const dimFactor = hoverDimFactor(arc.id, hoveredArc?.id);
                return applyAlphaToColor(resolvedFill, baseOpacity * dimFactor);
              },
              id: sunburstMarkId,
              /*
               * Same growPadding-shrunk radius as the overlays, so native rings land exactly on hit layer, labels, and center.
               */
              innerRadius: centerRValue,
              /*
               * `ctx.datum` is the wrapped `SunburstNode`, not the raw flat row; `ctx.datum.id` needs no key-decoding.
               */
              motion: (ctx: ChartMotionContext<TSSunburstNode<SunburstFlatRow>>) => {
                if (ctx.phase === "exit") {
                  // No legacy exit animation existed; degenerate arcs vanish instantly.
                  return { transition: { duration: 0, type: "tween" } };
                }
                if (ctx.phase === "update") {
                  return {
                    transition: {
                      duration: SUNBURST_ZOOM_MS,
                      easing: motionEasingFromCss(SUNBURST_ZOOM_EASE),
                      type: "tween",
                    },
                  };
                }
                const delayMs = ctx.datum ? (revealDelayById.get(ctx.datum.id) ?? 0) : 0;
                return {
                  delay: delayMs,
                  transition: {
                    duration: sweepDurationMs,
                    easing: motionEasingFromCss(sweepEasingCss),
                    type: "tween",
                  },
                };
              },
              nodeId: (row: SunburstFlatRow) => row.id,
              // Shares the overlay-alignment note on innerRadius above.
              outerRadius: radius,
              parentId: (row: SunburstFlatRow) => row.parentId,
              /*
               * Re-rooting resets subtree depth to 0 so partition refills the sweep; explicit `visibleDepth` keeps irregular trees aligned with overlays.
               */
              rootId: focus.id,
              stroke: "var(--chart-background)",
              strokeWidth: 1,
              /*
               * Leaf-only values: native `sum` adds an internal node's own value, diverging angles by up to ~3 rad if passed through.
               */
              value: (row: SunburstFlatRow) => (row.hasChildren ? 0 : (row.rawValue ?? 0)),
              // Shares the focus-remap note on rootId above.
              visibleDepth: visibleDepthValue,
            }),
          ],
          radiusRatio: 1,
          /*
           * Native sweeps from 3 o'clock by default; bklit geometry assumes a 12-o'clock origin, so set it explicitly.
           */
          startAngle: -Math.PI / 2,
        }),
      ],
      scales: { x: null, y: null },
      /*
       * Explicit 5-entry palette override; every row already carries per-datum `fill`, so no pixel effect today.
       */
      theme: { palette: CHART_CATEGORY_PALETTE },
      tooltip: false,
    }),
  [
    flatRows,
    arcsById,
    sunburstMarkId,
    focus,
    radius,
    visibleDepthValue,
    centerRValue,
    segmentConfigMap,
    getFill,
    hoveredArc,
    revealDelayById,
    sweepDurationMs,
    sweepEasingCss,
  ]);

  /*
   * Phase reporting only, never animation; deps on `[arcs, playKey, ...]` keep hover/zoom recomputes from restarting the timer.
   */
  useEffect((): (() => void) | undefined => {
    if (prefersReducedMotion) {
      setPhase("ready");
      return undefined;
    }
    setPhase("revealing");
    const maxDelay = maxRevealDelayMs(arcs, enterStaggerScale);
    revealDeadlineTimerRef.current = setRevealDeadline(sweepDurationMs + maxDelay + REVEAL_DEADLINE_SLACK_MS, {
      onDeadline: () => { setPhase("ready"); },
    });
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        globalThis.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, [arcs, playKey, enterStaggerScale, sweepDurationMs, prefersReducedMotion, setPhase]);

  /*
   * Click-only listeners for programmatic bench dispatch on rendered paths; real pointer interaction stays on the hit layer.
   */
  useEffect((): (() => void) | undefined => {
    const container = containerRef.current;
    if (!container) {return undefined;}
    const elementMap = getSunburstPathMap(container, sunburstMarkId);
    return attachSunburstPathClicks(elementMap, sortedArcs, zoomToEvent);
  }, [sortedArcs, sunburstMarkId]);

  /*
   * Pointer owns the shared hover cell while inside the stage; keyboard focus drives hover only when it is outside.
   */
  const pointerInsideStageRef = useRef(false);

  const handleHitEnter = useCallback(
    (arcIndex: number) => {
      pointerInsideStageRef.current = true;
      setHoveredArcIndex(arcIndex);
    },
    [setHoveredArcIndex],
  );

  const handleHitLeaveAll = useCallback(() => {
    pointerInsideStageRef.current = false;
    setHoveredArcIndex(null);
  }, [setHoveredArcIndex]);

  const handleHitClick = useCallback(
    (arcIndex: number) => {
      if (!Number.isInteger(arcIndex) || arcIndex < 0 || arcIndex >= arcs.length) {return;}
      const arc = arcs[arcIndex];
      if (arc.hasChildren) {zoomTo(arc.id);}
    },
    [arcs, zoomTo],
  );

  const handleSunburstFocusChange = useCallback(
    (point: { datum: TSSunburstNode<SunburstFlatRow> } | null) => {
      // Pointer owns hover (D471).
      if (pointerInsideStageRef.current) {return;}
      const arc = point ? arcsById.get(point.datum.id) : undefined;
      setHoveredArcIndex(arc ? arc.arcIndex : null);
    },
    [setHoveredArcIndex, arcsById],
  );

  // --- SB15: 350ms fade-in of the whole chart stage on mount ---
  // Legacy: motion.svg opacity 0→1, duration 0.35, ease [0.22,1,0.36,1].
  useLayoutEffect((): (() => void) | undefined => {
    if (prefersReducedMotion) {return undefined;}
    const container = containerRef.current;
    if (!container) {return undefined;}
    return fadeInChartStage(container);
  }, [prefersReducedMotion]);

  // --- Center circle geometry ---
  // Hub radius blends with the in-flight d-morph instead of snapping at commit.
  const liveCenterR = useMemo(() => {
    const toR = ringOptions(focus.depth, maxDepth, radius).centerR;
    const fromR = ringOptions(prevFocus.depth, maxDepth, radius).centerR;
    return toR * zoomT + fromR * (1 - zoomT);
  }, [focus.depth, prevFocus.depth, maxDepth, radius, zoomT]);

  const centerColor = focus.depth === 0
    ? "var(--chart-background)"
    : getColor(focus.categoryIndex);

  // --- Labels: zoom-morphed via transitionGeometry(prevFocus→focus, zoomT);
  // SB12 (legacy parity): unrelated arcs' labels are CULLED on hover (not dimmed).
  const labelItems = useMemo(() => {
    if (labelsCount === 0) {return [];}
    const inZoom = zoomT < 1;
    const fromF = inZoom ? prevFocus : focus;
    return arcs
      .flatMap((arc: ReadonlySunburstArc): SunburstLabelEntry[] => {
        const base = inZoom
          ? transitionGeometry(arc, fromF, focus, maxDepth, radius, zoomT)
          : geometryFor(arc, focus, maxDepth, radius);
        if (!base) {return [];}
        return buildLabelEntry(arc, base, hoveredArc);
      });
  }, [labelsCount, arcs, focus, prevFocus, maxDepth, radius, hoveredArc, zoomT]);

  /*
   * Hover resolves against static base geometry, matching bklit's fill-only hit path and knife-edge boundary outcome.
   */
  const hitItems = useMemo((): SunburstHitItem[] => {
    const inZoom = zoomT < 1;
    const fromF = inZoom ? prevFocus : focus;
    const items: SunburstHitItem[] = [];
    for (const arc of sortedArcs) {
      const base = inZoom
        ? transitionGeometry(arc, fromF, focus, maxDepth, radius, zoomT)
        : geometryFor(arc, focus, maxDepth, radius);
      if (base) {
        const pathData = arcPath(base, 1, 1);
        if (pathData !== null && pathData !== "") {
          items.push({ arcIndex: arc.arcIndex, hasChildren: arc.hasChildren, pathData });
        }
      }
    }
    return items;
  }, [sortedArcs, focus, prevFocus, maxDepth, radius, zoomT]);

  const maxRevealDelay = useMemo(() => maxRevealDelayMs(arcs, enterStaggerScale), [arcs, enterStaggerScale]);

  const labelsRevealDelayMs = maxRevealDelay + SUNBURST_SWEEP_MS * LABELS_REVEAL_DELAY_FRACTION;

  const labelRevealAnimsRef = useRef<Animation[]>([]);

  const runLabelsReveal = useCallback(() => {
    const container = containerRef.current;
    if (!container) {return null;}
    const svg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
    if (!svg) {return null;}
    cancelLabelAnimations(labelRevealAnimsRef.current);
    labelRevealAnimsRef.current = [];
    return startLabelReveal(svg, labelsRevealDelayMs, SUNBURST_SWEEP_MS);
  }, [labelsRevealDelayMs]);

  // Redundant dep omitted: runLabelsReveal already changes identity exactly
  // When labelsRevealDelayMs changes (its useCallback dep, above).
  useLayoutEffect((): (() => void) | undefined => {
    if (labelsCount === 0) {return undefined;}
    if (prefersReducedMotion) {return undefined;}
    return runLabelsReveal() ?? undefined;
  }, [labelsCount, prefersReducedMotion, runLabelsReveal]);

  // --- Latest-ref so the SB1 replay can re-drive labels without adding ---
  // --- runLabelsReveal as an effect dep (which would loop). ---
  const runLabelsRevealRef = useRef(runLabelsReveal);
  useLayoutEffect(() => {
    runLabelsRevealRef.current = runLabelsReveal;
  });

  /*
   * Arcs and phase already replay via the mark key and reveal-phase effect; this effect replays only the WAAPI labels overlay.
   */
  useEffect(() => {
    const next = `${playKey}`;
    if (next === playCycleRef.current) {return;}
    playCycleRef.current = next;

    const container = containerRef.current;
    if (!container) {return;}
    const rerunReveal = (): void => {
      runLabelsRevealRef.current();
    };
    resetLabelsOverlayForReplay(container, rerunReveal);
  }, [playKey]);


  useEffect(
    () => (): void => {
      cancelLabelAnimations(labelRevealAnimsRef.current);
      labelRevealAnimsRef.current = [];
    },
    [],
  );

  // --- Hint text ---
  const hintText = resolveSunburstHintText(hoveredArc?.trail, focus.depth);
  // Hoisted so the zoom-to-parent closure below captures a narrowed string.
  const zoomParentId = focus.parentId;
  const handleZoomToParent = useCallback(() => {
    if (zoomParentId !== null && zoomParentId !== "") {zoomTo(zoomParentId);}
  }, [zoomParentId, zoomTo]);
  const { boxStyle, outerStyle } = useMemo(() => ({
    boxStyle: { aspectRatio: "1 / 1", maxWidth: size, position: "relative" } as const,
    outerStyle: { maxWidth: "100%", position: "relative", width: size } as const,
  }), [size]);

  return (
    <div
      className={rootClassName}
      data-bkm-chart="sunburst"
      ref={containerRef}
      style={outerStyle}
    >
      {breadcrumbChildren}
      <div style={boxStyle}>
        <RendererChart
          ariaLabel={`Sunburst chart of ${data.name}`}
          width={size}
          height={size}
          definition={definition}
          renderer={chartMotionRenderer<TSSunburstNode<SunburstFlatRow>, number, number>()}
          onFocusChange={handleSunburstFocusChange}
        />
        <SunburstHitLayer
          items={hitItems}
          fullRadius={fullRadius}
          size={size}
          onHitEnter={handleHitEnter}
          onHitLeaveAll={handleHitLeaveAll}
          onHitClick={handleHitClick}
        />
        <SunburstCenterOverlay
          visible={centerCount > 0 && liveCenterR > 1}
          liveCenterR={liveCenterR}
          centerColor={centerColor}
          onZoomToParent={zoomParentId !== null && zoomParentId !== "" ? handleZoomToParent : undefined}
        />
        {labelsCount > 0 && (
          <SunburstLabelsOverlay items={labelItems} fullRadius={fullRadius} size={size} />
        )}
      </div>
      {hintCount > 0 && (
        <SunburstHintDisplay hintClassName={hintProps?.className}>
          {resolveSunburstHintContent(hintProps?.children, {
            focus,
            hintText,
            hoveredArc,
          })}
        </SunburstHintDisplay>
      )}
    </div>
  );
};

/*
 * Small hooks keep the outer component under its statement and line budgets; all are called unconditionally in order.
 */

/*
 * Only `type`/`duration`/`ease` are read and the primitives stay value-stable, so inline-object identity changes retrigger nothing.
 */
const useSunburstSweepTiming = (
  enterTransition: Readonly<EnterTransition> | undefined,
): { durationMs: number; easingCss: string } =>
  clipRevealTiming(enterTransition, SUNBURST_SWEEP_MS, SUNBURST_SWEEP_EASE);

// Phase tracking with last-value dedup so repeated commits stay silent.
const useSunburstPhase = (
  onPhaseChange: ((phase: SunburstPhase) => void) | undefined,
): ((phase: SunburstPhase) => void) => {
  const phaseRef = useRef<SunburstPhase>("revealing");
  return useCallback((nextPhase: SunburstPhase): void => {
    if (phaseRef.current === nextPhase) {return;}
    phaseRef.current = nextPhase;
    onPhaseChange?.(nextPhase);
  }, [onPhaseChange]);
};

interface SunburstLayoutState {
  readonly arcs: ArcDatum[];
  readonly focusById: Map<string, Focus>;
  maxDepth: number;
  readonly rootId: string;
  readonly sortedArcs: ArcDatum[];
}

// Layout derivation (verbatim bklit math), shared by the outer component.
const useSunburstLayout = (data: SunburstNode): SunburstLayoutState => {
  const { arcs, maxDepth, focusById, rootId } = useMemo(
    () => buildArcs(data),
    [data],
  );
  // Depth-descending sort for DOM order (outer rings first = hit-test priority).
  const sortedArcs = useMemo(
    () => arcs.toSorted((firstArc: ReadonlySunburstArc, secondArc: ReadonlySunburstArc) => secondArc.depth - firstArc.depth || secondArc.arcIndex - firstArc.arcIndex),
    [arcs],
  );
  return useMemo(() => ({ arcs, focusById, maxDepth, rootId, sortedArcs }), [
    arcs,
    focusById,
    maxDepth,
    rootId,
    sortedArcs,
  ]);
};

interface SunburstFocusControl {
  readonly focusId: string;
  readonly isFocusControlled: boolean;
  readonly setInternalFocusId: (id: string) => void;
}

// Uncontrolled-focus state plus the data-shape reset, kept together.
const useSunburstFocusControl = (
  rootId: string,
  focusIdProp: string | undefined,
): SunburstFocusControl => {
  const isFocusControlled = focusIdProp !== undefined;
  const [internalFocusId, setInternalFocusId] = useState(rootId);
  const focusId = focusIdProp ?? internalFocusId;
  /*
   * Re-seed during render so no stale-focus commit flashes first; a mode toggle resyncs the same way.
   */
  const [prevFocusReset, setPrevFocusReset] = useState({ isControlled: isFocusControlled, rootId });
  if (prevFocusReset.rootId !== rootId || prevFocusReset.isControlled !== isFocusControlled) {
    setPrevFocusReset({ isControlled: isFocusControlled, rootId });
    if (!isFocusControlled) {setInternalFocusId(rootId);}
  }
  return { focusId, isFocusControlled, setInternalFocusId };
};

interface SunburstResolvedFocus {
  readonly focus: Focus | undefined;
  readonly layout: SunburstLayoutState;
  readonly rootFocus: Focus | undefined;
}

// Resolves the active focus against the layout and memoizes the inner layout.
const useSunburstResolvedFocus = (
  baseLayout: Readonly<SunburstLayoutState>,
  focusId: string,
): SunburstResolvedFocus => {
  const rootFocus = baseLayout.focusById.get(baseLayout.rootId);
  const focus = baseLayout.focusById.get(focusId) ?? rootFocus;
  const layout = useMemo(() => ({
    arcs: baseLayout.arcs,
    focusById: baseLayout.focusById,
    maxDepth: baseLayout.maxDepth,
    rootId: baseLayout.rootId,
    sortedArcs: baseLayout.sortedArcs,
  }), [baseLayout]);
  return { focus, layout, rootFocus };
};

interface SunburstInnerRenderProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly data: SunburstNode;
  readonly enterStaggerScale: number;
  readonly focus: Focus;
  readonly focusId: string;
  readonly hoverPop: number;
  readonly hoveredIndexProp?: number | null;
  readonly isFocusControlled: boolean;
  readonly layout: SunburstLayoutState;
  readonly onFocusChange?: (focusId: string) => void;
  readonly onHoverChange?: (index: number | null) => void;
  readonly paddingProp?: number;
  readonly playKey: number;
  readonly prefersReducedMotion: boolean;
  readonly setInternalFocusId: (id: string) => void;
  readonly setPhase: (phase: SunburstPhase) => void;
  readonly size: number;
  readonly sweepDurationMs: number;
  readonly sweepEasingCss: string;
}

// Renders the inner chart as a plain function call (not a component), so the
// Element tree — and therefore reconciliation — is unchanged.
const renderSunburstInner = (props: Readonly<SunburstInnerRenderProps>): ReactElement => {
  const {
    children,
    className,
    data,
    enterStaggerScale,
    focus,
    focusId,
    hoverPop,
    hoveredIndexProp,
    isFocusControlled,
    layout,
    onFocusChange,
    onHoverChange,
    paddingProp,
    playKey,
    prefersReducedMotion,
    setInternalFocusId,
    setPhase,
    size,
    sweepDurationMs,
    sweepEasingCss,
  } = props;
  return (
    <SunburstChartInner
      data={data}
      size={size}
      rootClassName={className}
      focus={focus}
      layout={layout}
      focusId={focusId}
      isFocusControlled={isFocusControlled}
      setInternalFocusId={setInternalFocusId}
      setPhase={setPhase}
      onFocusChange={onFocusChange}
      hoveredIndexProp={hoveredIndexProp}
      onHoverChange={onHoverChange}
      hoverPop={hoverPop}
      paddingProp={paddingProp}
      prefersReducedMotion={prefersReducedMotion}
      playKey={playKey}
      sweepDurationMs={sweepDurationMs}
      sweepEasingCss={sweepEasingCss}
      enterStaggerScale={enterStaggerScale}
    >
      {children}
    </SunburstChartInner>
  );
};

const SunburstChart = ({
  data,
  size = DEFAULT_SUNBURST_SIZE,
  playKey = 0,
  className,
  focusId: focusIdProp,
  onFocusChange,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  hoverPop = DEFAULT_HOVER_POP,
  padding: paddingProp,
  onPhaseChange,
  enterTransition,
  enterStaggerScale = 1,
  children,
}: SunburstChartProps): ReactElement | null => {
  const { durationMs: sweepDurationMs, easingCss: sweepEasingCss } =
    useSunburstSweepTiming(enterTransition);
  const setPhase = useSunburstPhase(onPhaseChange);
  const baseLayout = useSunburstLayout(data);
  const { focusId, isFocusControlled, setInternalFocusId } = useSunburstFocusControl(baseLayout.rootId, focusIdProp);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { focus, layout, rootFocus } = useSunburstResolvedFocus(baseLayout, focusId);
  if (!(focus && rootFocus)) {return null;}

  // The subtree below needs non-null focus/rootFocus; render it through an inner
  // Component so every hook stays unconditional (react-hooks/rules-of-hooks).
  return renderSunburstInner({
    children,
    className,
    data,
    enterStaggerScale,
    focus,
    focusId,
    hoverPop,
    hoveredIndexProp,
    isFocusControlled,
    layout,
    onFocusChange,
    onHoverChange,
    paddingProp,
    playKey,
    prefersReducedMotion,
    setInternalFocusId,
    setPhase,
    size,
    sweepDurationMs,
    sweepEasingCss,
  });
};

SunburstChart.displayName = "SunburstChart";

export { SunburstCenter } from "./internal/sunburst-center";
export { SunburstLabels } from "./internal/sunburst-labels";
export type { SunburstLabelsProps } from "./internal/sunburst-labels";
export { SunburstHint } from "./internal/sunburst-hint";
export type { SunburstHintContext, SunburstHintProps } from "./internal/sunburst-hint";
export {
  SunburstBreadcrumb,
} from "./internal/sunburst-breadcrumb";
export { buildSunburstBreadcrumbItems, useSunburstBreadcrumbItems } from "./internal/sunburst-breadcrumb-items";
export type {
  SunburstBreadcrumbProps,
} from "./internal/sunburst-breadcrumb";
export type { SunburstBreadcrumbItem } from "./internal/sunburst-breadcrumb-items";
export type { ArcDatum, Focus } from "./internal/sunburst-geometry";
export type { SunburstNode } from "./internal/sunburst-types";
export { SunburstChart };
export { SunburstSegment } from "./internal/sunburst-segment";
export type { SunburstChartProps };
export type { SunburstSegmentProps } from "./internal/sunburst-segment";
