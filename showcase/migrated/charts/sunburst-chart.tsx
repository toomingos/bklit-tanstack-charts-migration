// SunburstChart — TanStack-native redo from first principles (D102).
//
// Architecture:
//   <SunburstSegment> children are config carriers (return null, classified by
//   displayName). A single <RendererChart renderer={chartMotionRenderer()}>
//   (C1) renders ONE `polar()` container with ONE `radialArc()` mark whose
//   custom d3 `arc()` generator computes per-datum inner/outer radii using
//   bklit's `geometryFor` → `ringOptions` layout. Depth-based opacity is
//   baked into fill (radialArc's fillOpacity is `number`, not VisualChannel
//   — no per-datum opacity channel exists).
//
//   The definition includes hover grow AND hover dim — both go through the
//   TanStack pipeline (arcRows → definition → render → reconcile). Dim (C1,
//   states+legend) rides the same per-datum `fill` color-mix alpha as
//   depth-opacity, since radialArc has no per-datum opacity channel either
//   (see above) — no imperative DOM opacity mutation.
//
// --- C5 (native motion, Phase 6, D432): reveal sweep + zoom morph both
// native now; both WAAPI generators deleted outright -----------------------
//   The arc mark's `generator` already declares real d3-arc accessors
//   (`.startAngle`/`.endAngle`/`.innerRadius`/`.outerRadius` — unchanged from
//   pre-C5) — the confirmed mechanism (gauge C4 precedent; `dist/motion.js`'s
//   `addSemanticPathUpdateTrack`/`compatiblePathGeometry`) native reads to
//   interpolate a matched keyed path's `d` attribute directly, with zero
//   imperative `.animate()` calls:
//     - Reveal (native "enter"): per-arc ring-staggered delay (unchanged
//       `buildRevealTiming` math, internal/sunburst-reveal.ts) + the
//       resolved sweep tween (`sweepDurationMs`/`sweepEasingCss`, SB2 below).
//       Same disclosed deviation as gauge/pie's own custom-generator arc
//       marks: native's per-datum arc "enter" animates opacity only (no
//       angular-growth-from-zero primitive for a raw-`d` generator mark) —
//       the staggered fade-in reproduces the "sweeping in sequentially" look
//       the same way pie's own native conversion already established
//       (pie-chart.tsx's `sliceMark.motion` comment cites sunburst's
//       generator pattern as ITS precedent — this is the mark shape both
//       families share).
//     - Zoom (native "update"): `arcRows` recomputes geometry off `focus`
//       immediately on every `zoomTo` commit (unchanged — focus commits
//       immediately, legacy parity); the mark's `motion` update-phase
//       transition (750ms `cubic-bezier(0.22,1,0.36,1)`, legacy verbatim)
//       is now what plays the `d` morph, native's own keyed diff supplying
//       the interpolation instead of `buildZoomKeyframes`'s 30-sample
//       generator (DELETED, internal/sunburst-reveal.ts).
//   Key stability (verified by reading `buildArcs`, sunburst-geometry.ts):
//   `arcIndex` is assigned once, by a monotonic counter, during a pre-order
//   traversal of `data` alone — `buildArcs` never takes `focus` as an input,
//   so the SAME arc keeps the SAME `arcIndex` (and therefore the same mark
//   key) across every zoom/focus rebuild. Only genuinely-degenerate arcs
//   (sub-0.001-rad span or sub-0.5px thickness, the pre-existing culling
//   rule in `arcRows` below) ever exit/re-enter on a focus change — every
//   other arc is a native "update" (d-morph), never a replayed "enter".
//   `playKey` is folded into the mark `key` (`sunburst-arc-{playKey}-
//   {arcIndex}`) specifically so a playKey bump — and ONLY a playKey bump —
//   invalidates every key at once, replaying the full staggered reveal
//   exactly like a fresh mount (native's own enter/exit diff does the
//   replay; no more imperative `handleRenderRef` re-invocation, see the
//   playKey effect below).
//   Reduced motion: the arc mark's own motion (enter/update/exit) needs no
//   local `prefersReducedMotion` branch — `chartMotionRenderer()`'s policy
//   defaults `respectReducedMotion: true` (gauge/pie/ring precedent).
//   `prefersReducedMotion` STILL gates three unrelated, non-native-scene
//   concerns below: the whole-stage 350ms fade-in (SB15), the zoomT rAF
//   tween-vs-snap branch (labels/hit-layer/center-circle overlays, none of
//   which are TanStack scene nodes), and the phase-tracking deadline timer
//   (skipped straight to "ready" — see the consolidated reveal-phase effect
//   below) — none of those have a native-motion equivalent to fall back on.
//
//   Hover chrome: hover index (`hoveredArc`) is React state, read directly by
//   the `arcRows` definition memo — dim (bklit: non-related arcs to 0.25
//   alpha, 160ms ease-out, see styles.css:424-427) is computed there as a
//   `fill` alpha multiplier, reactive by construction. Grow (geometry expand
//   via `buildHoverGrowTargets`/`applyHoverGrow`, also baked into `arcRows`)
//   rides the SAME native "update" transition as zoom above (`ChartMotionContext`
//   can't distinguish a hover-grow update from a zoom update, so both share
//   one timing — same "every OTHER phase" deviation pie/gauge already
//   documented; low-risk since it's strictly smoother than an un-animated
//   snap, and zoom — the more visually prominent, legacy-timed case — keeps
//   its exact authored timing).

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
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { defineChart, type ChartMotionContext } from "@tanstack/charts";
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
import { buildRevealTiming, maxRevealDelayMs } from "./internal/sunburst-reveal";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
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
import { motionEasingFromCss } from "./internal/pie-hover-chrome";
import { chartMotionRenderer } from "./internal/motion-renderer";
import "./styles.css";

// bklit sunburst arc sweep: 1100ms cubic-bezier(.85,0,.15,1) (was inlined at
// the two call sites below before P5.5 SB2 gave `enterTransition` a home).
const SUNBURST_SWEEP_MS = 1100;
const SUNBURST_SWEEP_EASE = "cubic-bezier(0.85,0,0.15,1)";
// bklit sunburst zoom morph: 750ms cubic-bezier(0.22,1,0.36,1) — legacy
// verbatim, previously the WAAPI zoom effect's `.animate()` options
// (deleted, C5); now the arc mark's native "update" transition.
const SUNBURST_ZOOM_MS = 750;
const SUNBURST_ZOOM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

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
  // once-per-mount LABELS-reveal guard resets below (the arc reveal itself
  // now replays via the mark's own playKey-embedded key, C5 — see file
  // header — so this ref only guards `runLabelsReveal`'s mount-vs-replay
  // distinction, not any arc-path animation).
  const playCycleRef = useRef<string>(`${playKey}`);
  const revealDeadlineTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPrevFocusId(rootId);
    setZoomT(1);
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
      // in-flight, bump the rAF generation so the old tick loop exits — the
      // arc path's own d-morph is native now (C5) and needs no separate
      // cancel; native's own reconcile always interpolates from the path's
      // CURRENT live `d`, so an interrupted zoom naturally continues from
      // wherever it visually was, matching the old cancel-and-restart intent.
      if (zoomT < 1) {
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

  // C5: per-arc ring-staggered entrance delay, keyed by arc `id` (matches
  // `handleRender`'s pre-C5 `delayByArcId` lookup, now feeding the mark's
  // own `motion` enter phase instead of a `.animate()` delay option).
  const revealDelayById = useMemo(() => {
    const timingList = buildRevealTiming(arcs, enterStaggerScale);
    return new Map(timingList.map((t) => [t.arcId, t.delayMs]));
  }, [arcs, enterStaggerScale]);

  // --- TanStack definition: single radialArc (opacity baked into fill) ---
  const definition = useMemo(() => {
    return defineChart({
      marks: [
        polar({
          radiusRatio: 1,
          marks: [
            radialArc<SunburstArcRow>(arcRows, {
              id: "sunburst-arcs",
              // `playKey` folded into the key (C5, see file header): a
              // playKey bump invalidates every arc's key at once, so native
              // replays the full staggered reveal exactly like a fresh
              // mount. `arcIndex` alone (unaffected by focus/zoom, verified
              // via `buildArcs`) is what keeps a key STABLE across zoom.
              key: (d) => `sunburst-arc-${playKey}-${d.arcIndex}`,
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
              // C5 (native motion, D432): reveal sweep (enter) + zoom/hover-
              // grow morph (update) — see file header for the full design
              // writeup (semantic `d` morph mechanism, key-stability
              // verification, the "every OTHER phase" deviation).
              motion: (ctx: ChartMotionContext<SunburstArcRow>) => {
                if (ctx.phase === "exit") {
                  // No legacy exit animation ever existed for an individual
                  // arc vanishing (only genuinely-degenerate arcs exit, an
                  // edge case) — instant vanish, same idiom gauge/pie use.
                  return { transition: { type: "tween", duration: 0 } };
                }
                if (ctx.phase === "update") {
                  return {
                    transition: {
                      type: "tween",
                      duration: SUNBURST_ZOOM_MS,
                      easing: motionEasingFromCss(SUNBURST_ZOOM_EASE),
                    },
                  };
                }
                const delayMs = ctx.datum ? (revealDelayById.get(ctx.datum.id) ?? 0) : 0;
                return {
                  delay: delayMs,
                  transition: {
                    type: "tween",
                    duration: sweepDurationMs,
                    easing: motionEasingFromCss(sweepEasingCss),
                  },
                };
              },
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
  }, [arcRows, playKey, revealDelayById, sweepDurationMs, sweepEasingCss]);

  // --- C5: reveal-phase tracking (bench settle detection) ---------------
  // The arc SWEEP itself is now fully native (the mark's own `motion`
  // above) — this effect no longer drives any animation, it only tracks
  // `onPhaseChange` timing so external callers still see "revealing" then
  // "ready" on the same rough schedule the WAAPI reveal used to produce.
  // Deliberately keyed on `[arcs, playKey, ...]`, not `arcRows`: `arcs`
  // (and therefore which keys are "new") only changes on mount or when
  // `data` changes shape — a hover/zoom-triggered `arcRows` recompute must
  // NOT restart this timer (matches the pre-C5 `seenRevealedRef` guard's
  // intent, now for free via the effect's own dependency list). A playKey
  // bump both restarts this timer AND (via the mark's `key`, above)
  // independently triggers native's own enter/exit replay — the two are
  // deliberately decoupled: this effect only ever reports phase, never
  // animates.
  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase("ready");
      return;
    }
    setPhase("revealing");
    const maxDelay = maxRevealDelayMs(arcs, enterStaggerScale);
    revealDeadlineTimerRef.current = setRevealDeadline(sweepDurationMs + maxDelay + 935, {
      onDeadline: () => setPhase("ready"),
    });
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arcs, playKey, enterStaggerScale, sweepDurationMs, prefersReducedMotion, setPhase]);

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
  // C5: the pre-native reveal used to suppress hover while a path's `d` was
  // still owned by an in-flight WAAPI reveal `.animate()` (a two-writer
  // hazard against the SAME attribute). Native motion owns both the reveal
  // and hover-grow through the ONE reconcile pipeline now, so there is no
  // second writer left to race — no guard needed.
  const handleHitEnter = useCallback(
    (arcIndex: number) => {
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

  // C5: the zoom `d`-morph is native now (the arc mark's own "update"
  // transition, SUNBURST_ZOOM_MS/EASE above) — `arcRows` already recomputes
  // off `focus` on every `zoomTo` commit, so TanStack's own keyed reconcile
  // triggers the morph with zero imperative code here. The WAAPI zoom
  // effect (`buildZoomKeyframes`, queried `elementMap`, per-arc `.animate()`
  // calls) is deleted outright, not ported — `zoomT`'s rAF tick loop
  // (`zoomTo`, above) still drives the label/hit-layer/center-circle
  // overlays below, which are NOT TanStack scene nodes and have no native
  // motion equivalent to fall back on. (`revealDeadlineTimerRef`'s teardown
  // is already handled by the reveal-phase effect's own cleanup, above —
  // no separate unmount effect needed here.)

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

  // --- Latest-ref so the SB1 replay can re-drive labels without adding ---
  // --- runLabelsReveal as an effect dep (which would loop). ---
  const runLabelsRevealRef = useRef(runLabelsReveal);
  useLayoutEffect(() => {
    runLabelsRevealRef.current = runLabelsReveal;
  });

  // --- SB1: playKey replays the initialization animation ---
  // Legacy keys its enter tweens with `${playKey}-enter-${arcId}`, so bumping
  // playKey restarts the whole reveal. C5: the ARC reveal replay is now
  // entirely native — `playKey` is folded into the mark's own `key`
  // (definition useMemo, above), so a playKey bump makes every arc key
  // "new" and native replays the full staggered enter on its own; phase
  // tracking (`setPhase("revealing")` → `"ready"`) is likewise already
  // covered by the reveal-phase effect above (also keyed on `[..., playKey,
  // ...]`). This effect's only remaining job is the LABELS overlay, which
  // stays WAAPI (a separate DOM overlay, no native mark to hang motion off)
  // and needs its own once-per-cycle dataset-guard reset + replay.
  useEffect(() => {
    const next = `${playKey}`;
    if (next === playCycleRef.current) return;
    playCycleRef.current = next;

    const container = containerRef.current;
    if (!container) return;
    const labelsSvg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
    if (labelsSvg) {
      delete (labelsSvg as unknown as HTMLElement & { dataset: DOMStringMap }).dataset.bkmLabelsRevealed;
      for (const t of labelsSvg.querySelectorAll<SVGTextElement>("text.ts-bkm-sunburst-label")) {
        t.style.opacity = "";
      }
      runLabelsRevealRef.current?.();
    }
  }, [playKey]);


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
        <RendererChart
          ariaLabel={`Sunburst chart of ${data.name}`}
          width={size}
          height={size}
          definition={definition}
          renderer={chartMotionRenderer<SunburstArcRow, number, number>()}
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
