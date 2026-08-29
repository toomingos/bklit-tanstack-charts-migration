// SunburstChart — TanStack-native redo from first principles (D102).
//
// Architecture:
//   <SunburstSegment> children are config carriers (return null, classified by
//   displayName). A single <Chart> renders ONE `polar()` container with ONE
//   `radialArc()` mark whose custom d3 `arc()` generator computes per-datum
//   inner/outer radii using bklit's `geometryFor` → `ringOptions` layout.
//   Depth-based opacity is baked into fill (radialArc's fillOpacity is `number`,
//   not VisualChannel — no per-datum opacity channel exists).
//
//   The definition includes hover grow AND hover dim — both go through the
//   TanStack pipeline (arcRows → definition → render → reconcile). Dim (C1,
//   states+legend) rides the same per-datum `fill` color-mix alpha as
//   depth-opacity, since radialArc has no per-datum opacity channel either
//   (see above) — no imperative DOM opacity mutation. Reveal and zoom use
//   WAAPI.
//
//   WAAPI zoom: computes keyframes from transitionGeometry between prev/next
//   focus states. Focus commits IMMEDIATELY on click (legacy parity); zoomT
//   tweens 0→1 and the d-morph covers the transition (no visual jump — the
//   committed target geometry sits under the fill-forwards animation).
//
//   WAAPI reveal: ring-staggered angular sweep (onPostPaint → per-arc
//   keyframes), bkmRevealed DOM guard prevents re-animation on focus/data
//   changes. Deadline timer → setPhase("ready") for bench settle detection.
//
//   Hover chrome: hover index (`hoveredArc`) is React state, read directly by
//   the `arcRows` definition memo — dim (bklit: non-related arcs to 0.25
//   alpha, 160ms ease-out, see styles.css:424-427) is computed there as a
//   `fill` alpha multiplier, reactive by construction. Grow (geometry expand
//   via `buildHoverGrowTargets`/`applyHoverGrow`, also baked into `arcRows`)
//   is unchanged — C5's job.

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { polar, radialArc } from "@tanstack/charts/polar";
import {
  arcPath,
  buildArcs,
  geometryFor,
  ringOptions,
  geomCentroidAngle,
  geomCentroidRadius,
  buildHoverGrowTargets,
  applyHoverGrow,
  maxHoverSegmentThickness,
  defaultSunburstGrowPadding,
  transitionGeometry,
  type ArcDatum,
  type Focus,
} from "./internal/sunburst-geometry";
import {
  defaultSunburstColors,
  opacityForRelativeDepth,
} from "./internal/sunburst-colors";
import type { SunburstNode } from "./internal/sunburst-types";
import {
  buildZoomKeyframes,
  buildRevealKeyframes,
  buildRevealTiming,
  maxRevealDelayMs,
} from "./internal/sunburst-reveal";
import { clearRevealed, isRevealed, markRevealed, onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { arc as d3Arc } from "d3-shape";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { displayNameOf } from "./children";
import { SunburstCenterOverlay } from "./internal/sunburst-center";
import { SunburstLabelsOverlay } from "./internal/sunburst-labels";
import {
  SunburstHitLayer,
  type SunburstHitItem,
} from "./internal/sunburst-hit";
import {
  resolveSunburstHintContent,
  SunburstHintDisplay,
  type SunburstHintProps,
} from "./internal/sunburst-hint";
import { CHART_CATEGORY_PALETTE } from "./internal/design-tokens";
import { clipRevealTiming, type EnterTransition } from "./internal/enter-transition";
import "./styles.css";

// bklit sunburst arc sweep: 1100ms cubic-bezier(.85,0,.15,1) (was inlined at
// the two call sites below before P5.5 SB2 gave `enterTransition` a home).
const SUNBURST_SWEEP_MS = 1100;
const SUNBURST_SWEEP_EASE = "cubic-bezier(0.85,0,0.15,1)";

// ---------------------------------------------------------------------------
// Helpers (shared — were duplicated across 4 call sites)
// ---------------------------------------------------------------------------

function applyAlphaToColor(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

function isRelatedArc(a: ArcDatum, hovered: ArcDatum): boolean {
  return a.id === hovered.id || a.id.startsWith(`${hovered.id} / `) || hovered.id.startsWith(`${a.id} / `);
}

function getSunburstPathMap(container: HTMLElement): Map<number, SVGPathElement> {
  const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
  const allPaths = marksGroup
    ? marksGroup.querySelectorAll<SVGPathElement>('path[data-ts-key^="sunburst-arcs:"]')
    : (container.querySelectorAll<SVGPathElement>('path[data-ts-key^="sunburst-arcs:"]') as NodeListOf<SVGPathElement>);
  const map = new Map<number, SVGPathElement>();
  for (const el of allPaths) {
    const k = el.getAttribute("data-ts-key") ?? "";
    const idx = Number(k.slice(k.lastIndexOf("-") + 1));
    if (!Number.isNaN(idx) && !map.has(idx)) map.set(idx, el as SVGPathElement);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Types (matching bklit's public API)
// ---------------------------------------------------------------------------

export type { ArcDatum, Focus } from "./internal/sunburst-geometry";
export type { SunburstNode } from "./internal/sunburst-types";

export interface SunburstChartProps {
  data: SunburstNode;
  size?: number;
  playKey?: number;
  className?: string;
  focusId?: string;
  onFocusChange?: (focusId: string) => void;
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  hoverPop?: number;
  padding?: number;
  onPhaseChange?: (phase: "loading" | "revealing" | "ready") => void;
  /** P5.5 SB2 — bklit `sunburst-chart.tsx:101`. Overrides the per-arc angular
      sweep's duration/easing (spring coerced to tween, bklit `animation.ts:18`;
      the sweep animates path `d`, which springs cannot drive natively). */
  enterTransition?: EnterTransition;
  /** P5.5 SB2 — bklit `sunburst-chart.tsx:102`, default 1. Multiplies the
      ring-stagger spread; `internal/sunburst-reveal.ts`'s `buildRevealTiming`
      / `maxRevealDelayMs` already take it (clamped at 0.25) — it was simply
      never plumbed from the prop. */
  enterStaggerScale?: number;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Flat row type for radialArc — one datum per rendered arc path.
// Contains STATIC (non-hover) geometry only.
// ---------------------------------------------------------------------------

interface SunburstArcRow {
  id: string;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  /** Fill color with depth-based alpha already baked in. */
  fill: string;
  arcIndex: number;
  depth: number;
  hasChildren: boolean;
}

// ---------------------------------------------------------------------------
// Children classification — SunburstSegment are config carriers.
// ---------------------------------------------------------------------------

// P5.5 SB8 — the `typeof child.type === "function"` guard this used to carry
// was narrower than bklit's `componentDisplayName`
// (`repos/bklit-ui/.../sunburst-chart.tsx:38-44`), which reads `displayName`
// off `child.type` whatever it is. A `memo()` element's `type` is an OBJECT,
// not a function, so any memoised carrier — bklit memoises
// `SunburstBreadcrumb` — silently failed to classify and was dropped. Matching
// bklit: accept both, and let `displayName` alone decide.
function isChildOfKind(child: ReactNode, displayName: string): boolean {
  if (!isValidElement(child)) return false;
  const type = child.type as { displayName?: string } | string;
  if (typeof type === "string") return false;
  return displayNameOf(type) === displayName;
}

interface SunburstSegmentConfig {
  arcIndex: number;
  color?: string;
  fill?: string;
  fillOpacity?: number;
}

interface ClassifiedChildren {
  centerCount: number;
  labelsCount: number;
  hintCount: number;
  /** P5.5 SB4 — the last `<SunburstHint>`'s own props, so the chart can
      resolve its render-prop `children` against live state. */
  hintProps: SunburstHintProps | null;
  /** P5.5 SB8 — bklit's `isOutsideSvgComponent` (`sunburst-chart.tsx:56-58`)
      pulls `SunburstBreadcrumb` out of the SVG and renders it ABOVE the square
      chart box (`:449-454`). Unlike the other carriers this one draws its own
      markup, so the elements are kept as-is and re-emitted in that slot. */
  breadcrumbChildren: ReactNode[];
  segmentConfigs: SunburstSegmentConfig[];
}

function classifyChildren(children: ReactNode): ClassifiedChildren {
  let centerCount = 0;
  let labelsCount = 0;
  let hintCount = 0;
  let hintProps: SunburstHintProps | null = null;
  const breadcrumbChildren: ReactNode[] = [];
  const segmentConfigs: SunburstSegmentConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (isChildOfKind(child, "SunburstCenter")) {
      centerCount++;
    } else if (isChildOfKind(child, "SunburstLabels")) {
      labelsCount++;
    } else if (isChildOfKind(child, "SunburstHint")) {
      hintCount++;
      hintProps = (child as ReactElement).props as SunburstHintProps;
    } else if (isChildOfKind(child, "SunburstBreadcrumb")) {
      breadcrumbChildren.push(child);
    } else if (isChildOfKind(child, "SunburstSegment")) {
      const props = (child as ReactElement).props as {
        index: number;
        color?: string;
        fill?: string;
        fillOpacity?: number;
      };
      segmentConfigs.push({
        arcIndex: props.index,
        color: props.color,
        fill: props.fill,
        fillOpacity: props.fillOpacity,
      });
    }
  });

  return {
    centerCount,
    labelsCount,
    hintCount,
    hintProps,
    breadcrumbChildren,
    segmentConfigs,
  };
}

// ---------------------------------------------------------------------------
// SunburstChart
// ---------------------------------------------------------------------------

export function SunburstChart({
  data,
  size = 520,
  playKey = 0,
  className,
  focusId: focusIdProp,
  onFocusChange,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  hoverPop = 8,
  padding: paddingProp,
  onPhaseChange,
  enterTransition,
  enterStaggerScale = 1,
  children,
}: SunburstChartProps) {
  // SB2 — sweep timing. Primitive deps: callers pass `enterTransition` inline.
  const enterType = enterTransition?.type;
  const enterDurationSec = enterTransition?.duration;
  const enterEaseKey = enterTransition?.ease?.join(",");
  const { durationMs: sweepDurationMs, easingCss: sweepEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, SUNBURST_SWEEP_MS, SUNBURST_SWEEP_EASE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterType, enterDurationSec, enterEaseKey],
  );
  // --- Phase tracking (deduped — just gate on last emitted value) ---
  const phaseRef = useRef<"loading" | "revealing" | "ready">("revealing");
  const setPhase = useCallback((p: "loading" | "revealing" | "ready") => {
    if (phaseRef.current === p) return;
    phaseRef.current = p;
    onPhaseChange?.(p);
  }, [onPhaseChange]);

  // --- Layout (verbatim bklit math) ---
  const { arcs, maxDepth, focusById, rootId } = useMemo(
    () => buildArcs(data),
    [data],
  );

  // Depth-descending sort for DOM order (outer rings first = hit-test priority)
  const sortedArcs = useMemo(
    () => [...arcs].sort((a, b) => b.depth - a.depth || b.arcIndex - a.arcIndex),
    [arcs],
  );

  // --- Focus state ---
  const isFocusControlled = focusIdProp !== undefined;
  const [internalFocusId, setInternalFocusId] = useState(rootId);
  const focusId = isFocusControlled ? focusIdProp! : internalFocusId;

  useEffect(() => {
    if (!isFocusControlled) setInternalFocusId(rootId);
  }, [rootId, isFocusControlled]);

  const prefersReducedMotion = usePrefersReducedMotion();

  const rootFocus = focusById.get(rootId);
  const focus = focusById.get(focusId) ?? rootFocus;
  if (!(focus && rootFocus)) return null;

  // The subtree below needs non-null focus/rootFocus; render it through an inner
  // component so every hook stays unconditional (react-hooks/rules-of-hooks).
  return (
    <SunburstChartInner
      data={data}
      size={size}
      className={className}
      focus={focus}
      layout={{ arcs, maxDepth, focusById, rootId, sortedArcs }}
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
      children={children}
    />
  );
}

interface SunburstChartInnerProps {
  data: SunburstNode;
  size: number;
  className?: string;
  focus: Focus;
  layout: {
    arcs: ArcDatum[];
    maxDepth: number;
    focusById: Map<string, Focus>;
    rootId: string;
    sortedArcs: ArcDatum[];
  };
  focusId: string;
  isFocusControlled: boolean;
  setInternalFocusId: (id: string) => void;
  setPhase: (p: "loading" | "revealing" | "ready") => void;
  onFocusChange?: (focusId: string) => void;
  hoveredIndexProp?: number | null;
  onHoverChange?: (index: number | null) => void;
  hoverPop: number;
  paddingProp?: number;
  prefersReducedMotion: boolean;
  playKey: number;
  /** SB2 — resolved arc-sweep timing, computed once in the outer component. */
  sweepDurationMs: number;
  sweepEasingCss: string;
  enterStaggerScale: number;
  children: ReactNode;
}

function SunburstChartInner({
  data,
  size,
  className,
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
}: SunburstChartInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Layout (verbatim bklit math) ---
  const { arcs, maxDepth, focusById, rootId, sortedArcs } = layout;

  const fullRadius = size / 2;
  const growPadding = paddingProp ?? defaultSunburstGrowPadding(maxDepth, size, hoverPop);
  const radius = Math.max(8, fullRadius - growPadding);

  // --- Hover state (direct React state, no coordinator mediator) ---
  const isHoverControlled = hoveredIndexProp !== undefined;
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const hoveredArcIndex = isHoverControlled ? hoveredIndexProp! : internalHoveredIndex;

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
    if (hoveredArcIndex == null) return null;
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
    () => new Map(segmentConfigs.map((c) => [c.arcIndex, c])),
    [segmentConfigs],
  );

  // --- Color helpers ---
  const getColor = useCallback(
    (categoryIndex: number, nodeColor?: string) =>
      nodeColor ?? (defaultSunburstColors[categoryIndex % defaultSunburstColors.length] as string),
    [],
  );

  const getFill = useCallback(
    (arcIndex: number, fillOverride?: string, colorOverride?: string) => {
      if (fillOverride) return fillOverride;
      const a = arcs[arcIndex];
      if (!a) return defaultSunburstColors[0] as string;
      return colorOverride ?? a.fill ?? a.color ?? getColor(a.categoryIndex);
    },
    [arcs, getColor],
  );

  // --- Zoom state ---
  // SB14 (legacy parity): a click commits the new focus IMMEDIATELY; zoomT
  // tweens 0→1 and transitionGeometry(prev→committed, zoomT) covers the
  // morph. The committed target geometry renders underneath the in-flight
  // d-morph, so there is no visual jump.
  const [zoomT, setZoomT] = useState(1);
  const [prevFocusId, setPrevFocusId] = useState(rootId);
  const prevFocus = focusById.get(prevFocusId) ?? focus;
  const zoomGen = useRef(0);
  // SB1: reveal-cycle identity — bumped when playKey changes so the
  // once-per-mount reveal guard resets (legacy replays via playKey keys).
  const playCycleRef = useRef<string>(`${playKey}`);
  const zoomAnimationsRef = useRef<Set<Animation>>(new Set());
  const seenRevealedRef = useRef<Set<number>>(new Set());
  const pendingRevealIds = useRef<Set<number>>(new Set());
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setPrevFocusId(rootId);
    setZoomT(1);
    for (const anim of zoomAnimationsRef.current) anim.cancel();
    zoomAnimationsRef.current.clear();
  }, [rootId]);

  const commitFocus = useCallback(
    (nextId: string) => {
      if (isFocusControlled) onFocusChange?.(nextId);
      else setInternalFocusId(nextId);
    },
    [isFocusControlled, onFocusChange, setInternalFocusId],
  );

  const zoomTo = useCallback(
    (nextId: string) => {
      if (nextId === focusId) return;
      if (!focusById.has(nextId)) return;

      // Midpoint-snapshot nuance (audit §4 row1): if a zoom is already
      // in-flight, cancel its animations so the next effect attaches fresh
      // keyframes from the CURRENT visual state instead of snapping.
      if (zoomT < 1) {
        for (const anim of zoomAnimationsRef.current) anim.cancel();
        zoomAnimationsRef.current.clear();
        // Bump generation so the old rAF loop exits.
        zoomGen.current++;
      }

      // Commit immediately — prevFocusId becomes the tween's FROM state.
      setPrevFocusId(focusId);
      commitFocus(nextId);
      setHoveredArcIndex(null);

      const gen = ++zoomGen.current;

      if (prefersReducedMotion) {
        setZoomT(1);
        return;
      }

      setZoomT(0);
      requestAnimationFrame(() => {
        if (zoomGen.current !== gen) return;
        const start = performance.now();
        const duration = 750;
        function tick() {
          if (zoomGen.current !== gen) return;
          const elapsed = performance.now() - start;
          const t = Math.min(1, elapsed / duration);
          setZoomT(t);
          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            setZoomT(1);
          }
        }
        requestAnimationFrame(tick);
      });
    },
    [
      commitFocus,
      focusById,
      focusId,
      prefersReducedMotion,
      setHoveredArcIndex,
      zoomT,
    ],
  );

  // --- Arc rows (static-layout + hover grow + hover dim baked in) ---
  // Hover grow AND hover dim both drive arcRows → definition → TanStack
  // re-render/reconcile — no imperative DOM mutation for either (C1 moved
  // dim off `pathEl.style.opacity` onto the per-datum `fill` alpha below,
  // same mechanism depth-opacity already used).
  const arcRows = useMemo((): SunburstArcRow[] => {
    const rows: SunburstArcRow[] = [];

    // Compute hover grow targets
    let growAmountForArc: (id: string) => number = () => 0;
    let expandedThickness = 0;
    if (hoveredArc && focus) {
      const targets = buildHoverGrowTargets(
        arcs, hoveredArc, focus, maxDepth, radius, hoverPop,
        (d: ArcDatum, hoveredId: string) => d.id === hoveredId || hoveredId.startsWith(`${d.id} / `),
      );
      expandedThickness = maxHoverSegmentThickness(maxDepth, radius, hoverPop);
      growAmountForArc = (id: string) => targets.get(id) ?? 0;
    }

    for (const a of arcs) {
      const config = segmentConfigMap.get(a.arcIndex);
      const base = geometryFor(a, focus, maxDepth, radius);
      if (!base) continue;

      const grown = applyHoverGrow(base, a.id, growAmountForArc, expandedThickness);
      // Degenerate-arc culling parity: the retired arcPath wrapper returned
      // null (row dropped by TanStack, polar.ts:325) for sub-0.001-rad or
      // sub-0.5px arcs; the d3 generator would emit them as hairline paths.
      if (grown.a1 - grown.a0 < 0.001 || grown.outerR - grown.innerR < 0.5) {
        continue;
      }
      const relativeDepth = a.depth - focus.depth;
      const resolvedFill = getFill(a.arcIndex, config?.fill, config?.color);
      const baseOpacity = config?.fillOpacity ?? opacityForRelativeDepth(relativeDepth);
      // C1 (states+legend): non-hovered-arc dimming (bklit: opacity 0.25,
      // 160ms ease-out — see styles.css:424-427's `[data-bkm-chart="sunburst"]
      // .ts-chart__marks path` transition rule) folded into the per-datum
      // `fill` alpha instead of an imperative `pathEl.style.opacity` DOM
      // mutation. radialArc has no per-datum opacity VisualChannel (`opacity`
      // is `number` on the whole mark — polar.d.ts) so, same as the
      // depth-based `baseOpacity` above, the dim multiplier rides the
      // color-mix alpha. This IS the library's reactive model: `arcRows`
      // already depends on `hoveredArc`, so a hover change recomputes rows →
      // rebuilds `definition` → TanStack reconciles fresh `fill` colors.
      const dimFactor = hoveredArc ? (isRelatedArc(a, hoveredArc) ? 1 : 0.25) : 1;
      const fill = applyAlphaToColor(resolvedFill, baseOpacity * dimFactor);

      rows.push({
        id: a.id,
        startAngle: grown.a0,
        endAngle: grown.a1,
        innerRadius: grown.innerR,
        outerRadius: grown.outerR,
        fill,
        arcIndex: a.arcIndex,
        depth: a.depth,
        hasChildren: a.hasChildren,
      });
    }

    rows.sort((a, b) => {
      if (a.depth !== b.depth) return b.depth - a.depth;
      return b.arcIndex - a.arcIndex;
    });

    return rows;
  }, [arcs, focus, maxDepth, radius, segmentConfigMap, getFill, hoveredArc, hoverPop]);

  // --- TanStack definition: single radialArc (opacity baked into fill) ---
  const definition = useMemo(() => {
    return defineChart({
      marks: [
        polar({
          radiusRatio: 1,
          marks: [
            radialArc<SunburstArcRow>(arcRows, {
              id: "sunburst-arcs",
              key: (d) => `sunburst-arc-${d.arcIndex}`,
              generator: () => {
                const gen = d3Arc<SunburstArcRow>()
                  .startAngle((d) => d.startAngle)
                  .endAngle((d) => d.endAngle)
                  .innerRadius((d) => d.innerRadius)
                  .outerRadius((d) => d.outerRadius)
                  .padAngle(() => 0);
                // TanStack reads these accessors for point geometry
                // (polar.ts:340-352); a real d3 arc provides them natively.
                return gen;
              },
              fill: (d) => d.fill,
              stroke: "var(--chart-background)",
              strokeWidth: 1,
            }),
          ],
        }),
      ],
      guides: false,
      scales: { x: null, y: null },
      focus: focusDisabled,
      tooltip: false,
      // T-D15 (P3.1): explicit 5-entry palette override, NOT the native
      // 6-entry defaultChartTheme.palette — see internal/design-tokens.ts.
      // Every row already carries an explicit per-datum `fill` (getFill /
      // defaultSunburstColors above), so this has no pixel effect today.
      theme: { palette: CHART_CATEGORY_PALETTE },
    });
  }, [arcRows]);

  // --- handleRender: WAAPI reveal (pie/radar pattern). Hover dim is no
  // longer applied here — C1 folded it into the reactive `fill` alpha
  // computed in `arcRows`, so it needs no re-apply on reconcile. ---
  const handleRender = useCallback(({ container }: { container: HTMLElement }) => {
    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup) return;
    const svgForBkm = container.querySelector<SVGElement>("svg.ts-chart");
    if (!svgForBkm) return;

    const seen = seenRevealedRef.current;
    const liveIndices = new Set(arcs.map((a) => a.arcIndex));
    for (const key of seen) {
      if (!liveIndices.has(key)) seen.delete(key);
    }

    const elementMap = getSunburstPathMap(container);

    // C1 (states+legend): hover dimming used to be re-applied here via
    // `pathEl.style.opacity` after every TanStack reconcile (dim is lost on
    // reconcile because reconcile rewrites the path's attributes from the
    // fresh markup). It now rides the reactive `fill` alpha computed in
    // `arcRows` above, so reconcile already paints the dimmed color — no
    // imperative re-apply needed.

    // NOTE: reveal guards live in refs (seenRevealedRef + playCycleRef),
    // NOT in DOM dataset stamps compared here. Any definition change
    // (hover grow, zoom) makes TanStack reconcile the stage svg from fresh
    // markup, and its syncAttributes strips every attribute the markup
    // doesn't carry — including our data-bkm-* stamps. Comparing a dataset
    // stamp here fired on every hover and cleared `seen`, replaying the
    // full 1100ms reveal on each pointer move (Wave-1 regression; cycle
    // identity is now handled wholly by the SB1 effect below).

    if (isRevealed(svgForBkm)) return;

    const timingList = buildRevealTiming(arcs, enterStaggerScale);
    const delayByArcId = new Map(timingList.map((t) => [t.arcId, t.delayMs]));

    const toReveal: { arc: ArcDatum }[] = [];
    for (const arc of sortedArcs) {
      if (seen.has(arc.arcIndex)) continue;
      const pathEl = elementMap.get(arc.arcIndex);
      if (!pathEl) continue;
      seen.add(arc.arcIndex);
      toReveal.push({ arc });
    }
    if (toReveal.length === 0) {
      markRevealed(svgForBkm);
      return;
    }

    if (prefersReducedMotion) {
      markRevealed(svgForBkm);
      setPhase("ready");
      return;
    }

    markRevealed(svgForBkm);
    marksGroup.classList.add("ts-chart__marks--revealing");
    setPhase("revealing");

    const maxDelay = timingList.length > 0 ? timingList[timingList.length - 1]!.delayMs : 0;
    for (const { arc } of toReveal) {
      pendingRevealIds.current.add(arc.arcIndex);
    }
    revealDeadlineTimerRef.current = setRevealDeadline(sweepDurationMs + maxDelay + 935, {
      animationsRef: revealAnimsRef,
      onDeadline: () => setPhase("ready"),
    });

    revealPostPaintCancelRef.current = onPostPaint(() => {
      const liveMap = getSunburstPathMap(container);
      const liveMarksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
      liveMarksGroup?.classList.remove("ts-chart__marks--revealing");

      for (const { arc } of toReveal) {
        const liveEl = liveMap.get(arc.arcIndex);
        if (!liveEl) {
          pendingRevealIds.current.delete(arc.arcIndex);
          continue;
        }
        const geom = geometryFor(arc, focus, maxDepth, radius);
        if (!geom) {
          pendingRevealIds.current.delete(arc.arcIndex);
          continue;
        }
        const keyframes = buildRevealKeyframes(geom);
        if (!keyframes || keyframes.length < 2) {
          pendingRevealIds.current.delete(arc.arcIndex);
          continue;
        }
        const delayMs = delayByArcId.get(arc.id) ?? 0;
        const anim = liveEl.animate(keyframes, {
          duration: sweepDurationMs,
          delay: delayMs,
          easing: sweepEasingCss,
          fill: "backwards",
        });
        revealAnimsRef.current.push(anim);
        anim.onfinish = () => {
          anim.cancel();
          pendingRevealIds.current.delete(arc.arcIndex);
        };
        anim.oncancel = () => {
          pendingRevealIds.current.delete(arc.arcIndex);
        };
      }
    });
  }, [arcs, sortedArcs, focus, maxDepth, radius, setPhase, prefersReducedMotion, enterStaggerScale, sweepDurationMs, sweepEasingCss]);

  // --- TanStack-path click listeners (synthetic-dispatch contract) ---
  // Real pointer interaction is served by the hit layer above the stage svg;
  // these click-only listeners exist for programmatic dispatch on the
  // TanStack-rendered paths (bench scenario `__benchDrilldown` clicks
  // `path[data-ts-key^="sunburst-arcs:"]` directly).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const elementMap = getSunburstPathMap(container);
    if (elementMap.size === 0) return;

    const cleanups: Array<() => void> = [];
    for (const a of sortedArcs) {
      const pathEl = elementMap.get(a.arcIndex);
      if (!pathEl) continue;
      const arcIndex = a.arcIndex;
      const onClick = () => {
        if (a.hasChildren) zoomTo(a.id);
      };
      pathEl.addEventListener("click", onClick);
      cleanups.push(() => {
        pathEl.removeEventListener("click", onClick);
      });
    }
    return () => {
      for (const c of cleanups) c();
    };
  }, [sortedArcs, zoomTo]);

  // --- Hit layer handlers (bklit parity: enter per segment, leave only at ---
  // --- svg level — last-enter-wins; click zooms when segment has children) ---
  const handleHitEnter = useCallback(
    (arcIndex: number) => {
      if (pendingRevealIds.current.has(arcIndex)) return;
      setHoveredArcIndex(arcIndex);
    },
    [setHoveredArcIndex],
  );

  const handleHitLeaveAll = useCallback(() => {
    setHoveredArcIndex(null);
  }, [setHoveredArcIndex]);

  const handleHitClick = useCallback(
    (arcIndex: number) => {
      const a = arcs[arcIndex];
      if (a?.hasChildren) zoomTo(a.id);
    },
    [arcs, zoomTo],
  );

  // --- SB15: svg-level pointerleave clears hover (legacy motion.svg handler) ---
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stage = container.querySelector<SVGElement>("svg.ts-chart");
    if (!stage) return;

    const onStageLeave = () => {
      setHoveredArcIndex(null);
    };
    stage.addEventListener("pointerleave", onStageLeave);
    return () => {
      stage.removeEventListener("pointerleave", onStageLeave);
    };
  }, [setHoveredArcIndex]);

  // --- SB15: 350ms fade-in of the whole chart stage on mount ---
  // Legacy: motion.svg opacity 0→1, duration 0.35, ease [0.22,1,0.36,1].
  useLayoutEffect(() => {
    if (prefersReducedMotion) return;
    const container = containerRef.current;
    if (!container) return;
    const stage = container.querySelector<SVGSVGElement>("svg.ts-chart");
    if (!stage) return;
    stage.style.opacity = "0";
    const anim = stage.animate(
      [{ opacity: "0" }, { opacity: "1" }],
      { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );
    return () => {
      anim.cancel();
      stage.style.opacity = "";
    };
  }, [prefersReducedMotion]);

  // --- Zoom WAAPI tweens (keyed) ---
  // Attaches on every 1→0 zoomT transition (each click restarts the tween,
  // including interrupts — the cancel+gen-bump in zoomTo guarantees fresh
  // keyframes from the CURRENT visual state: the midpoint-snapshot nuance).
  useEffect(() => {
    if (zoomT !== 0) return;

    if (prevFocus.id === focus.id) return;

    const container = containerRef.current;
    if (!container) return;
    const elementMap = getSunburstPathMap(container);
    if (elementMap.size === 0) return;

    for (const anim of zoomAnimationsRef.current) anim.cancel();
    zoomAnimationsRef.current.clear();

    for (const a of sortedArcs) {
      const pathEl = elementMap.get(a.arcIndex);
      if (!pathEl) continue;

      const keyframes = buildZoomKeyframes(a, prevFocus, focus, maxDepth, radius);
      if (!keyframes || keyframes.length < 2) continue;

      const anim = pathEl.animate(keyframes, {
        duration: 750,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      });
      zoomAnimationsRef.current.add(anim);
    }
  }, [zoomT, sortedArcs, maxDepth, radius, prevFocus, focus]);

  useEffect(() => {
    const pendingReveal = pendingRevealIds.current;
    const revealAnims = revealAnimsRef.current;
    const zoomAnims = zoomAnimationsRef.current;
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      pendingReveal.clear();
      for (const anim of revealAnims) {
        try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
      }
      revealAnimsRef.current = [];
      for (const anim of zoomAnims) {
        try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
      }
      zoomAnims.clear();
    };
  }, []);

  // Fallback: if onRender never fired yet (race), retry once past paint (pie/radar pattern)
  useLayoutEffect(() => {
    if (seenRevealedRef.current.size > 0) return;
    const container = containerRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (seenRevealedRef.current.size > 0) return;
        if (!container.querySelector(".ts-chart__marks")) return;
        const hasAnims = () => {
          const paths = container.querySelectorAll('path[data-ts-key^="sunburst-arcs:"]');
          for (const el of paths) {
            const anyEl = el as unknown as { getAnimations?: () => Animation[] };
            if (anyEl.getAnimations?.().length) return true;
          }
          return false;
        };
        if (hasAnims()) return;
        handleRender({ container });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [handleRender]);

  // --- Center circle geometry ---
  // SB13 (legacy parity): interpolate the hub radius during zoom —
  // centerR(focus)·zoomT + centerR(prevFocus)·(1−zoomT) — so the hub grows/
  // shrinks with the d-morph instead of snapping at commit.
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
  const enterDurationMs = 1100;

  const labelItems = useMemo(() => {
    if (labelsCount === 0) return [];
    const inZoom = zoomT < 1;
    const fromF = inZoom ? prevFocus : focus;
    return arcs
      .map((a) => {
        const base = inZoom
          ? transitionGeometry(a, fromF, focus, maxDepth, radius, zoomT)
          : geometryFor(a, focus, maxDepth, radius);
        if (!base) return null;
        if (hoveredArc && !isRelatedArc(a, hoveredArc)) return null;
        const r = geomCentroidRadius(base);
        const angleSpan = base.a1 - base.a0;
        if (angleSpan * r < 26 || base.outerR - base.innerR < 16) return null;
        const mid = geomCentroidAngle(base);
        const x = Math.sin(mid) * r;
        const y = -Math.cos(mid) * r;
        let deg = (mid * 180) / Math.PI - 90;
        if (deg > 90) deg -= 180;
        if (deg < -90) deg += 180;
        return { x, y, deg, label: a.name, id: a.id };
      })
      .filter(Boolean) as Array<{
        x: number; y: number; deg: number; label: string; id: string;
      }>;
  }, [labelsCount, arcs, focus, prevFocus, maxDepth, radius, hoveredArc, zoomT]);

  // --- Hit layer: bklit-parity hit-testing on BASE (ungrown) geometry ---
  // bklit's SunburstSegment hit-tests a transparent fill-only path at base
  // geometry; the grown visual path is pointer-events:none. Porting that
  // model: hover resolves against static geometry (grow never slides
  // geometry under the pointer) and the fill-only edge behavior at the
  // shared-boundary ray matches bklit's knife-edge hit-test outcome.
  const hitItems = useMemo((): SunburstHitItem[] => {
    const inZoom = zoomT < 1;
    const fromF = inZoom ? prevFocus : focus;
    const items: SunburstHitItem[] = [];
    for (const a of sortedArcs) {
      const base = inZoom
        ? transitionGeometry(a, fromF, focus, maxDepth, radius, zoomT)
        : geometryFor(a, focus, maxDepth, radius);
      if (!base) continue;
      const d = arcPath(base, 1, 1);
      if (!d) continue;
      items.push({ arcIndex: a.arcIndex, d, hasChildren: a.hasChildren });
    }
    return items;
  }, [sortedArcs, focus, prevFocus, maxDepth, radius, zoomT]);

  // SB18: was a local re-implementation of the identical logic. `maxRevealDelayMs`
  // (internal/sunburst-reveal.ts:75) is the shared helper; `buildRevealTiming`
  // returns delays sorted ascending, so its last element IS the max.
  const maxRevealDelay = useMemo(() => maxRevealDelayMs(arcs, enterStaggerScale), [arcs, enterStaggerScale]);

  const labelsRevealDelayMs = maxRevealDelay + enterDurationMs * 0.85;

  const labelRevealAnimsRef = useRef<Animation[]>([]);

  // Deferred label reveal (once per reveal cycle; hover/zoom must not restart
  // it). SB1: the playKey replay effect clears the dataset guard + inline
  // opacity and re-runs this via its labelsRevealDelayMs dependency.
  const runLabelsReveal = useCallback(() => {
    const container = containerRef.current;
    if (!container) return null;
    const svg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
    if (!svg) return null;
    const svgDataset = (svg as unknown as HTMLElement & { dataset: DOMStringMap }).dataset;
    for (const anim of labelRevealAnimsRef.current) {
      try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
    }
    labelRevealAnimsRef.current = [];
    const cancelLabelPostPaint = onPostPaint(() => {
      const liveTexts = Array.from(svg.querySelectorAll<SVGTextElement>("text.ts-bkm-sunburst-label"));
      for (const t of liveTexts) {
        if (!t.isConnected) continue;
        t.style.opacity = "0";
        const anim = t.animate(
          [{ opacity: "0" }, { opacity: "1" }],
          {
            duration: enterDurationMs,
            delay: labelsRevealDelayMs,
            easing: "cubic-bezier(0.85,0,0.15,1)",
            fill: "backwards",
          },
        );
        labelRevealAnimsRef.current.push(anim);
        anim.onfinish = () => {
          anim.cancel();
          if (t.isConnected) t.style.opacity = "1";
        };
      }
    });
    const timer = window.setTimeout(() => {
      svgDataset.bkmLabelsRevealed = "1";
      for (const t of svg.querySelectorAll<SVGTextElement>("text.ts-bkm-sunburst-label")) {
        if (t.isConnected) t.style.opacity = "";
      }
    }, labelsRevealDelayMs + enterDurationMs + 30);
    return () => {
      cancelLabelPostPaint();
      window.clearTimeout(timer);
      for (const anim of labelRevealAnimsRef.current) {
        try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
      }
    };
  }, [labelsRevealDelayMs]);

  useLayoutEffect(() => {
    if (labelsCount === 0) return;
    if (prefersReducedMotion) return;
    return runLabelsReveal() ?? undefined;
  }, [labelsCount, labelsRevealDelayMs, prefersReducedMotion, runLabelsReveal]);

  // --- Latest-refs so the SB1 replay can re-drive renders without adding ---
  // --- handleRender/runLabelsReveal as effect deps (which would loop).    ---
  const handleRenderRef = useRef(handleRender);
  const runLabelsRevealRef = useRef(runLabelsReveal);
  useLayoutEffect(() => {
    handleRenderRef.current = handleRender;
    runLabelsRevealRef.current = runLabelsReveal;
  });

  // --- SB1: playKey replays the initialization animation ---
  // Legacy keys its enter tweens with `${playKey}-enter-${arcId}`, so bumping
  // playKey restarts the whole reveal. Here: bump the reveal-cycle identity,
  // cancel in-flight reveal state, clear both once-per-mount guards, and
  // re-drive the arcs + labels imperatively (onRender won't refire — the
  // definition is unchanged).
  useEffect(() => {
    const next = `${playKey}`;
    if (next === playCycleRef.current) return;
    playCycleRef.current = next;

    for (const anim of revealAnimsRef.current) {
      try { anim.cancel(); } catch { /* teardown race */ }
    }
    revealAnimsRef.current = [];
    if (revealDeadlineTimerRef.current !== null) {
      window.clearTimeout(revealDeadlineTimerRef.current);
      revealDeadlineTimerRef.current = null;
    }
    revealPostPaintCancelRef.current?.();
    revealPostPaintCancelRef.current = null;
    pendingRevealIds.current.clear();
    seenRevealedRef.current.clear();

    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector<SVGSVGElement>("svg.ts-chart");
    clearRevealed(svg);
    const labelsSvg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
    if (labelsSvg) {
      delete (labelsSvg as unknown as HTMLElement & { dataset: DOMStringMap }).dataset.bkmLabelsRevealed;
      for (const t of labelsSvg.querySelectorAll<SVGTextElement>("text.ts-bkm-sunburst-label")) {
        t.style.opacity = "";
      }
      runLabelsRevealRef.current?.();
    }

    setPhase("revealing");
    handleRenderRef.current?.({ container });
  }, [playKey, setPhase]);


  useEffect(() => {
    return () => {
      for (const anim of labelRevealAnimsRef.current) {
        try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
      }
      labelRevealAnimsRef.current = [];
    };
  }, []);

  // --- Hint text ---
  const hintText = hoveredArc
    ? hoveredArc.trail.join("  \u203A  ")
    : focus.depth === 0
      ? "Click a segment to zoom in · hover to inspect"
      : "Click the center to zoom out";

  return (
    <div
      className={className}
      data-bkm-chart="sunburst"
      ref={containerRef}
      style={{ maxWidth: "100%", width: size, position: "relative" }}
    >
      {breadcrumbChildren}
      <div style={{ aspectRatio: "1 / 1", maxWidth: size, position: "relative" }}>
        <Chart
          ariaLabel={`Sunburst chart of ${data.name}`}
          width={size}
          height={size}
          definition={definition}
          onRender={handleRender}
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
          onZoomToParent={focus.parentId ? () => zoomTo(focus.parentId!) : undefined}
        />
        {labelsCount > 0 && (
          <SunburstLabelsOverlay items={labelItems} fullRadius={fullRadius} size={size} />
        )}
      </div>
      {hintCount > 0 && (
        <SunburstHintDisplay className={hintProps?.className}>
          {resolveSunburstHintContent(hintProps?.children, {
            hintText,
            hoveredArc,
            focus,
          })}
        </SunburstHintDisplay>
      )}
    </div>
  );
}

SunburstChart.displayName = "SunburstChart";

// ---------------------------------------------------------------------------
// Re-export config carriers (public API)
// ---------------------------------------------------------------------------

export { SunburstCenter } from "./internal/sunburst-center";
export {
  SunburstLabels,
  type SunburstLabelsProps,
} from "./internal/sunburst-labels";
export {
  SunburstHint,
  type SunburstHintContext,
  type SunburstHintProps,
} from "./internal/sunburst-hint";
export {
  buildSunburstBreadcrumbItems,
  SunburstBreadcrumb,
  type SunburstBreadcrumbItem,
  type SunburstBreadcrumbProps,
  useSunburstBreadcrumbItems,
} from "./internal/sunburst-breadcrumb";

// ---------------------------------------------------------------------------
// SunburstSegment config carrier — stays in this file
// ---------------------------------------------------------------------------

export interface SunburstSegmentProps {
  index: number;
  color?: string;
  fill?: string;
  fillOpacity?: number;
}

export function SunburstSegment(_props: SunburstSegmentProps): null {
  return null;
}

SunburstSegment.displayName = "SunburstSegment";
