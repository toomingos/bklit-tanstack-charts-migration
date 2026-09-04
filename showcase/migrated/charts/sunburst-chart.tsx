// SunburstChart — TanStack-native redo from first principles (D102).
//
// Architecture:
//   <SunburstSegment> children are config carriers (return null, classified by
//   displayName). A single <RendererChart renderer={chartMotionRenderer()}>
//   renders ONE `polar()` container with ONE native `sunburst()` mark
//   (`@tanstack/charts/hierarchy/sunburst`) fed FLAT rows
//   (`buildSunburstFlatRows`, sunburst-geometry.ts) — native's own d3-
//   hierarchy pipeline (stratify → sum → partition) computes every arc's
//   angle/radius, replacing the pre-C5d design's hand-rolled `geometryFor`/
//   `ringOptions` math driving a raw custom `d3Arc()` generator on
//   `radialArc`. `sunburst()` is the sole carrier of `[sceneMotionNode]`
//   scene metadata (`dist/motion.js`) in the whole mark catalog — i.e. the
//   only mark whose `d` morph is genuinely SHAPE-aware
//   (`compatiblePathGeometry`/`hierarchyRelatedGeometry`) instead of the
//   generic numeric-token `d`-string diff every raw-generator arc mark
//   (gauge/pie/ring, and this file pre-C5d) falls back to.
//
// --- C5d (native semantic motion, Phase 6): three angle-parity conditions,
// verified against real d3-hierarchy 3.1.2 -------------------------------
//   1. `value` is LEAF-ONLY (`d.hasChildren ? 0 : (d.rawValue ?? 0)`):
//      native's `hierarchy.root.sum()` ADDS an internal node's own value on
//      top of its children's, unlike `sumValues` (sunburst-geometry.ts,
//      unchanged, still feeds `buildArcs`) which ignores a node's own value
//      whenever it has children. Getting this wrong measurably diverges
//      angles by up to ~3 rad for a tree where internal nodes carry values.
//   2. NO `sort` is passed to `sunburst()` — native only sorts siblings if
//      explicitly told to; omitted, it preserves `data`'s own child order,
//      matching `buildArcs`'s own pre-order traversal.
//   3. The polar CONTAINER (not the mark) sets `startAngle: -Math.PI/2,
//      endAngle: -Math.PI/2 + 2*Math.PI` — native's own polar default is
//      0→2π starting at 3 o'clock (`dist/polar.d.ts`), not bklit's
//      12-o'clock-clockwise origin every other geometry helper in this file
//      assumes (`sunburst-geometry.ts`'s `TOP = -Math.PI/2`).
//   A 4th, self-discovered parity requirement beyond those three: native's
//   automatic `visibleDepth` default is the LOCAL subtree height under the
//   active `rootId`, which can silently diverge from `ringOptions`'s
//   `visibleRings = Math.max(1, maxDepth - focus.depth)` (keyed off the
//   GLOBAL `maxDepth`) for a tree with irregular branch depths — so
//   `visibleDepth` is passed explicitly to force exact ring-count parity
//   against the still-`ringOptions`-driven hit-layer/labels/center overlay.
//
//   Focus/drill/hover/dim STILL read exclusively from `buildArcs`/`arcs`/
//   `arcsById` (never from native mark data) — REQUIRED because native
//   filters `node.x1 > node.x0`, so a zero-value branch produces no arc at
//   all (vs. the pre-C5d code's zero-span arc that painted nothing but was
//   still a real row). Keeping drill on `arcsById`/`zoomTo(id)` keeps a
//   zero-value branch reachable via keyboard/hit-layer/programmatic drill
//   even though native never paints a path for it.
//
//   Zoom morph (native "update"): `rootId: focus.id` + the explicit
//   `visibleDepth` above reproduce `geometryFor`'s focus-relative angle
//   remap — d3-hierarchy's `.copy()` resets a re-rooted subtree's depth to
//   0, so `partition()` re-normalizes it to fill the full sweep exactly
//   like the old `mapAngle` did. Persisting arcs keep their native scene key
//   (`${markId}:node:${valueKey(node.id)}`, id-derived, focus-independent)
//   across a `zoomTo` commit, so they hit the mark's "update" phase — a
//   REAL semantic `d`-morph, not a numeric-token diff — while
//   newly-(in)visible descendants unfold from / collapse into their nearest
//   surviving ancestor sector (native `hierarchyRelatedGeometry`, confirmed
//   in `dist/motion.js`; this is a strict upgrade over the pre-C5d design's
//   `buildZoomKeyframes` 30-sample generator, DELETED outright).
//   Reveal (native "enter"): per-arc ring-staggered delay (unchanged
//   `buildRevealTiming` math, internal/sunburst-reveal.ts) + the resolved
//   sweep tween (`sweepDurationMs`/`sweepEasingCss`, SB2 below), read off
//   `ctx.datum.id` — `ctx.datum` in `sunburst()`'s `motion` callback is the
//   WRAPPED `SunburstNode<TDatum>` (`ChartMarkMotionOptions<SunburstNode
//   <TDatum>>`, confirmed against `hierarchy-sunburst.d.ts` AND the shipped
//   `docs/reference/marks/sunburst.md`), so no raw-flat-row key-decoding is
//   needed here (unlike the DOM click-listener below, which has no typed
//   API to lean on and must decode native's internal key scheme itself).
//   `playKey` is folded into the MARK's own `id` (`sunburst-arcs-{playKey}`)
//   rather than a per-datum `key` — `SunburstOptions` has no such option
//   (verified against `hierarchy-sunburst.d.ts`) — so a playKey bump changes
//   every child's derived scene key at once, replaying the full staggered
//   reveal exactly like a fresh mount.
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
//   Hover chrome, DELIBERATE deviation (D-TBD, disclose to orchestrator):
//   native `sunburst()` has NO per-datum radius/size VisualChannel — only
//   `fill`/`stroke` are per-node (`hierarchy-sunburst.d.ts`'s
//   `SunburstSharedOptions`); `innerRadius`/`outerRadius`/`ringPadding` are
//   whole-mark scalars or responsive `PolarLength` callbacks, never a
//   per-datum channel. The radial hover pop-out is therefore not expressible
//   on native `sunburst()` at 0.15.0 and is DROPPED outright; `hoverPop` is
//   kept as a prop for API compatibility but is now inert (D450). Hover-DIM
//   is fully preserved: non-related-arc dimming (bklit:
//   0.25 alpha, 160ms ease-out, styles.css:424-427) is still computed as a
//   `fill` color-mix alpha inside the mark's `fill` callback, reactive by
//   construction (the callback closes over `hoveredArc`, which is React
//   state — a hover change recomputes `definition` → native reconciles
//   fresh `fill` colors, same "no imperative DOM opacity mutation" model as
//   before).
//
// --- C5c (native focus, Phase 6, D435): scoped correction, not a straight
// port of pie/ring's pattern -------------------------------------------
//   Unlike pie/ring, sunburst's ACTUAL hover mechanism is NOT a
//   `querySelectorAll`+`addEventListener` DOM reach-in against
//   TanStack-rendered nodes — it is `SunburstHitLayer` (internal/sunburst-
//   hit.tsx), a separate, ordinary React-owned SVG overlay with plain JSX
//   `onPointerEnter`/`onClick` props. `SunburstHitLayer` is rendered as a
//   LATER JSX sibling of `<RendererChart>` inside the same `position:
//   relative` box, absolutely positioned at 100%×100% — it therefore sits
//   geometrically on top of and fully occludes `<RendererChart>`'s own
//   `svg.ts-chart` (both cover the identical size×size rect). This is
//   REQUIRED to stay (D384): the click half's bench-dispatched synthetic
//   `.click()` needs a real DOM element to target with no `clientX`/
//   `clientY`, which only a real rendered `<path>` element (not native
//   pointer-coordinate resolution) can serve. Because it fully occludes the
//   chart's own SVG, native pointer events NEVER reach `svg.ts-chart` in any
//   region covered by an arc — so native pointer-driven `onFocusChange`
//   cannot replace `SunburstHitLayer`'s hover handlers; they stay unchanged.
//   `focus: focusDisabled` is still dropped (native default) and
//   `<RendererChart onFocusChange>` is still wired to `setHoveredArcIndex`,
//   because KEYBOARD focus (Tab into the SVG, arrow keys) is NOT blocked by
//   the overlay — it targets `svg.ts-chart` directly via its own `tabIndex`,
//   independent of pointer z-order — so this rung is a genuine, if narrower,
//   capability add: keyboard users get arc hover-preview (dim/grow) for the
//   first time. The one reach-in this rung DOES retire is SB15's
//   `useLayoutEffect` querying `svg.ts-chart` for a `pointerleave` listener
//   — confirmed dead in practice by the same occlusion finding
//   (`svg.ts-chart` never receives a `pointerenter`, so never fires
//   `pointerleave`, in any pointer-covered region); `SunburstHitLayer`'s own
//   `<svg onPointerLeave={onHitLeaveAll}>` (identical footprint, rendered on
//   top) already reproduces the intended "leave the stage clears hover"
//   behavior and was doing the actual work all along.
//   6.5 gate check (D448 → D471): the occlusion argument above covers
//   pointer RESOLUTION only. The host also re-reports its still-focused
//   keyboard point on every render and emits `null` on `focusout`, so the
//   two paths CAN fight over the single hover cell. `pointerInsideStageRef`
//   (below, at the hit handlers) makes the pointer the owner while it is
//   inside the stage; keyboard focus drives hover only when it is not.

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import type { ChartMotionContext } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { polar } from "@tanstack/charts/polar";
import {
  sunburst,
  type SunburstNode as TSSunburstNode,
} from "@tanstack/charts/hierarchy/sunburst";
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
  type ArcDatum,
  type Focus,
  type SunburstFlatRow,
} from "./internal/sunburst-geometry";
import {
  defaultSunburstColors,
  opacityForRelativeDepth,
} from "./internal/sunburst-colors";
import type { SunburstNode } from "./internal/sunburst-types";
import { buildRevealTiming, maxRevealDelayMs } from "./internal/sunburst-reveal";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { displayNameOf } from "./internal/children-extract";
import { SunburstCenterOverlay } from "./internal/sunburst-center-overlay";
import { SunburstLabelsOverlay } from "./internal/sunburst-labels-overlay";
import {
  SunburstHitLayer,
  type SunburstHitItem,
} from "./internal/sunburst-hit";
import { resolveSunburstHintContent } from "./internal/sunburst-hint-content";
import {
  SunburstHintDisplay,
  type SunburstHintProps,
} from "./internal/sunburst-hint";
import { CHART_CATEGORY_PALETTE } from "./internal/design-tokens";
import { clipRevealTiming, type EnterTransition } from "./internal/enter-transition";
import { motionEasingFromCss } from "./internal/pie-hover-chrome";
import { chartMotionRenderer } from "./internal/motion-renderer";
import "./styles.css";

// Bklit sunburst arc sweep: 1100ms cubic-bezier(.85,0,.15,1) (was inlined at
// The two call sites below before P5.5 SB2 gave `enterTransition` a home).
const SUNBURST_SWEEP_MS = 1100;
const SUNBURST_SWEEP_EASE = "cubic-bezier(0.85,0,0.15,1)";
// Bklit sunburst zoom morph: 750ms cubic-bezier(0.22,1,0.36,1) — legacy
// Verbatim, previously the WAAPI zoom effect's `.animate()` options
// (deleted, C5); now the arc mark's native "update" transition.
const SUNBURST_ZOOM_MS = 750;
const SUNBURST_ZOOM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SUNBURST_LABEL_TEXT_SELECTOR = "text.ts-bkm-sunburst-label";

// ---------------------------------------------------------------------------
// Helpers (shared — were duplicated across 4 call sites)
// ---------------------------------------------------------------------------

const applyAlphaToColor = (color: string, alpha: number): string => {
  if (alpha >= 1) {return color;}
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

const isRelatedArc = (a: ArcDatum, hovered: ArcDatum): boolean =>
  a.id === hovered.id || a.id.startsWith(`${hovered.id} / `) || hovered.id.startsWith(`${a.id} / `);

// Hover/dim small helpers, hoisted so render-path callbacks stay thin.
const hoverDimFactor = (arcId: string, hoveredId: string | undefined): number => {
  if (hoveredId === undefined) {
    return 1;
  }
  if (arcId === hoveredId || arcId.startsWith(`${hoveredId} / `) || hoveredId.startsWith(`${arcId} / `)) {
    return 1;
  }
  return 0.25;
};
const resolveVisibleDepth = (maxDepth: number, focusDepth: number): number => Math.max(1, maxDepth - focusDepth);
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

// C5d — native `sunburst()`'s own scene keys are NOT the old
// `radialArc`+custom-`key` scheme (`sunburst-arc-{playKey}-{arcIndex}`);
// They're internally fixed as `${markId}:node:${valueKey(node.id)}`
// (`dist/hierarchy-sunburst.js`'s `key`, `dist/scales.js`'s `valueKey` — no
// Public `key` option exists on `SunburstOptions`, verified against
// `hierarchy-sunburst.d.ts`). `valueKey` encodes a string id as
// `string:<length>:<id>`, so this reconstructs the expected id per rendered
// Path by slicing exactly `<length>` characters after that header — a
// Length-prefixed decode (not a delimiter split) so an arc id containing
// "-", ":", or " / " (our own `nodeId` separator) can never be
// Misparsed. `markId` must be the SAME string passed as the mark's `id`
// Option below (`sunburst-arcs-{playKey}`) or no path will match.
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
    const id = parseSunburstPathId(el.getAttribute("data-ts-key") ?? "", prefix);
    if (id !== undefined && !map.has(id)) {map.set(id, el);}
  }
  return map;
}

// Sunburst reveal phase, shared by the phase plumbing below.
type SunburstPhase = "loading" | "revealing" | "ready";

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
  onPhaseChange?: (phase: SunburstPhase) => void;
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
// Children classification — SunburstSegment are config carriers.
// ---------------------------------------------------------------------------

// P5.5 SB8 — the `typeof child.type === "function"` guard this used to carry
// Was narrower than bklit's `componentDisplayName`
// (`repos/bklit-ui/.../sunburst-chart.tsx:38-44`), which reads `displayName`
// Off `child.type` whatever it is. A `memo()` element's `type` is an OBJECT,
// Not a function, so any memoised carrier — bklit memoises
// `SunburstBreadcrumb` — silently failed to classify and was dropped. Matching
// Bklit: accept both, and let `displayName` alone decide.
const isChildOfKind = (child: ReactNode, displayName: string): boolean => {
  if (!isValidElement(child)) {return false;}
  const type = child.type as { displayName?: string } | string;
  if (typeof type === "string") {return false;}
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
  hintProps: SunburstHintProps | undefined;
  /** P5.5 SB8 — bklit's `isOutsideSvgComponent` (`sunburst-chart.tsx:56-58`)
      pulls `SunburstBreadcrumb` out of the SVG and renders it ABOVE the square
      chart box (`:449-454`). Unlike the other carriers this one draws its own
      markup, so the elements are kept as-is and re-emitted in that slot. */
  breadcrumbChildren: ReactNode[];
  segmentConfigs: SunburstSegmentConfig[];
}

const classifyChildren = (children: ReactNode): ClassifiedChildren => {
  let centerCount = 0;
  let labelsCount = 0;
  let hintCount = 0;
  let hintProps: SunburstHintProps | undefined;
  const breadcrumbChildren: ReactNode[] = [];
  const segmentConfigs: SunburstSegmentConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {return;}
    if (isChildOfKind(child, "SunburstCenter")) {
      centerCount += 1;
    } else if (isChildOfKind(child, "SunburstLabels")) {
      labelsCount += 1;
    } else if (isChildOfKind(child, "SunburstHint")) {
      hintCount += 1;
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
    } else {
      // Non-carrier child (e.g. plain text) — nothing to classify.
    }
  });

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
  setPhase: (p: SunburstPhase) => void;
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

const SunburstChartInner = ({
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
}: SunburstChartInnerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Layout (verbatim bklit math) ---
  const { arcs, maxDepth, focusById, rootId, sortedArcs } = layout;

  const fullRadius = size / 2;
  const growPadding = paddingProp ?? defaultSunburstGrowPadding(maxDepth, size, hoverPop);
  const radius = Math.max(8, fullRadius - growPadding);

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
    () => new Map(segmentConfigs.map((c) => [c.arcIndex, c])),
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
      if (fillOverride) {return fillOverride;}
      const a = arcs[arcIndex];
                if (!a) {return defaultSunburstColors[0];}
      return colorOverride ?? a.fill ?? a.color ?? getColor(a.categoryIndex);
    },
    [arcs, getColor],
  );

  // --- Zoom state ---
  // SB14 (legacy parity): a click commits the new focus IMMEDIATELY; zoomT
  // Tweens 0→1 and transitionGeometry(prev→committed, zoomT) covers the
  // Morph. The committed target geometry renders underneath the in-flight
  // D-morph, so there is no visual jump.
  const [zoomT, setZoomT] = useState(1);
  const [prevFocusId, setPrevFocusId] = useState(rootId);
  const prevFocus = focusById.get(prevFocusId) ?? focus;
  const zoomGen = useRef(0);
  // SB1: reveal-cycle identity — bumped when playKey changes so the
  // Once-per-mount LABELS-reveal guard resets below (the arc reveal itself
  // Now replays via the mark's own playKey-embedded key, C5 — see file
  // Header — so this ref only guards `runLabelsReveal`'s mount-vs-replay
  // Distinction, not any arc-path animation).
  const playCycleRef = useRef<string>(`${playKey}`);
  const revealDeadlineTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPrevFocusId(rootId);
    setZoomT(1);
  }, [rootId]);

  const commitFocus = useCallback(
    (nextId: string) => {
      if (isFocusControlled) {onFocusChange?.(nextId);}
      else {setInternalFocusId(nextId);}
    },
    [isFocusControlled, onFocusChange, setInternalFocusId],
  );

  const zoomTo = useCallback(
    (nextId: string) => {
      if (nextId === focusId) {return;}
      if (!focusById.has(nextId)) {return;}

      // Midpoint-snapshot nuance (audit §4 row1): if a zoom is already
      // In-flight, bump the rAF generation so the old tick loop exits — the
      // Arc path's own d-morph is native now (C5) and needs no separate
      // Cancel; native's own reconcile always interpolates from the path's
      // CURRENT live `d`, so an interrupted zoom naturally continues from
      // Wherever it visually was, matching the old cancel-and-restart intent.
      if (zoomT < 1) {
        zoomGen.current += 1;
      }

      // Commit immediately — prevFocusId becomes the tween's FROM state.
      setPrevFocusId(focusId);
      commitFocus(nextId);
      setHoveredArcIndex(null);

      zoomGen.current += 1;
      const gen = zoomGen.current;

      if (prefersReducedMotion) {
        setZoomT(1);
        return;
      }

      setZoomT(0);
      requestAnimationFrame(() => {
        if (zoomGen.current !== gen) {return;}
        const start = performance.now();
        const duration = 750;
        const tick = (): void => {
          if (zoomGen.current !== gen) {return;}
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

  // Click listeners below only invoke the latest zoom — reading it through an
  // Effect event keeps the listener subscription stable across zoomTo
  // Identity changes (latest focus/zoomT still observed at click time).
  const zoomToEvent = useEffectEvent((nextId: string): void => {
    zoomTo(nextId);
  });

  // --- C5d: flat source rows + id lookup for native `sunburst()` ---
  // Native's hierarchy pipeline stratifies FLAT rows (nodeId/parentId), not
  // The nested `SunburstNode` tree `buildArcs` walks — `buildSunburstFlatRows`
  // Flattens the SAME `data` prop with the SAME `nodeId` scheme so ids match
  // `ArcDatum.id` 1:1. `arcsById` is the bridge: focus/drill/hover/dim ALL
  // Still read from `buildArcs`'s own `arcs`/`focusById` (D-TBD below, and
  // The file header) — this map is how the native mark's per-node callbacks
  // (which only see the flat row + a bare node id) recover arcIndex,
  // Absolute depth, and color/fill overrides for a given rendered node.
  const flatRows = useMemo(() => buildSunburstFlatRows(data), [data]);
  const arcsById = useMemo(() => new Map(arcs.map((a) => [a.id, a])), [arcs]);

  // C5: per-arc ring-staggered entrance delay, keyed by arc `id` (matches
  // `handleRender`'s pre-C5 `delayByArcId` lookup, now feeding the mark's
  // Own `motion` enter phase instead of a `.animate()` delay option).
  const revealDelayById = useMemo(() => {
    const timingList = buildRevealTiming(arcs, enterStaggerScale);
    return new Map(timingList.map((t) => [t.arcId, t.delayMs]));
  }, [arcs, enterStaggerScale]);

  // C5d: the mark's OWN id (not a per-datum `key` — `SunburstOptions` has no
  // Such option, verified against `hierarchy-sunburst.d.ts`) folds `playKey`
  // In directly. Native derives every rendered path's scene key from this
  // (`${id}:node:${valueKey(node.id)}`, `hierarchy-sunburst.js`), so bumping
  // It changes EVERY child's key at once — the whole group re-enters as a
  // Fresh subtree (`reconcileMotionElement`'s top-level identity match
  // Fails), replaying the full staggered reveal exactly like a fresh mount.
  // `getSunburstPathMap` below must be given this SAME string.
  const sunburstMarkId = `sunburst-arcs-${playKey}`;
  // C5d: focus-derived mark options, hoisted so the definition below stays shallow.
  const visibleDepthValue = resolveVisibleDepth(maxDepth, focus.depth);
  const centerRValue = resolveCenterR(focus.depth, maxDepth, radius);

  // --- TanStack definition: native `sunburst()` (C5d, D-TBD — see file ---
  // --- header for the full design writeup and the hover-grow deviation) ---
  const definition = useMemo(() => defineChart({
      // C5c (D435): native default focus (no `focus` key) replaces
      // `focusDisabled` — enables keyboard-driven focus resolution (see file
      // Header; pointer-driven hover stays on SunburstHitLayer, which
      // Occludes native pointer resolution and is required to stay for
      // D384's click contract). `focusRing: false` suppresses the default
      // Indicator since the dim geometry above already IS sunburst's
      // Authored focus treatment.
      focusRing: false,
      guides: false,
      marks: [
        polar({
          endAngle: -Math.PI / 2 + 2 * Math.PI,
          marks: [
            sunburst(flatRows, {
              fill: (node: TSSunburstNode<SunburstFlatRow>) => {
                const a = arcsById.get(node.id);
      if (!a) {return defaultSunburstColors[0];}
                const config = segmentConfigMap.get(a.arcIndex);
                const resolvedFill = getFill(a.arcIndex, config?.fill, config?.color);
                const relativeDepth = a.depth - focus.depth;
                const baseOpacity = config?.fillOpacity ?? opacityForRelativeDepth(relativeDepth);
                // C1 (states+legend) parity: non-hovered-arc dimming folded
                // Into the per-datum `fill` alpha (native `sunburst()` has
                // No per-datum opacity channel either — `fillOpacity` is a
                // Whole-mark `number`, `hierarchy-sunburst.d.ts`).
                const dimFactor = hoverDimFactor(a.id, hoveredArc?.id);
                return applyAlphaToColor(resolvedFill, baseOpacity * dimFactor);
              },
              id: sunburstMarkId,
              // Matches `ringOptions(focus.depth, maxDepth, radius)`'s own
              // `centerR`/outer-edge — same `radius` (growPadding-shrunk)
              // The hit layer/labels/center overlay below already share, so
              // Native's rings land exactly on top of those overlays.
              innerRadius: centerRValue,
              // C5d: reveal sweep (enter) + zoom morph (update) — see file
              // Header for the full design writeup. `ctx.datum` here is the
              // WRAPPED `SunburstNode<TDatum>` context (confirmed against
              // `hierarchy-sunburst.d.ts`'s `ChartMarkMotionOptions<
              // SunburstNode<TDatum>>` and the shipped
              // `docs/reference/marks/sunburst.md`), not the raw flat row —
              // `ctx.datum.id` is directly usable for the delay lookup.
              motion: (ctx: ChartMotionContext<TSSunburstNode<SunburstFlatRow>>) => {
                if (ctx.phase === "exit") {
                  // No legacy exit animation ever existed for an individual
                  // Arc vanishing (only genuinely-degenerate arcs exit, an
                  // Edge case) — instant vanish, same idiom gauge/pie use.
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
              nodeId: (d: SunburstFlatRow) => d.id,
              // Shares the overlay-alignment note on innerRadius above.
              outerRadius: radius,
              parentId: (d: SunburstFlatRow) => d.parentId,
              // `rootId`/`visibleDepth` reproduce `geometryFor`'s
              // Focus-relative angle remap AND `ringOptions`'s ring count —
              // `resolveLayoutRoot` copies the subtree at `focus.id` and
              // `d3-hierarchy`'s `copy()` resets the copy's depth to 0
              // (confirmed in `dist/d3-hierarchy` docs), so `partition()`
              // Re-normalizes the subtree to fill the full sweep exactly
              // Like `mapAngle` does. `visibleDepth` is passed explicitly
              // (not left to native's own subtree-height default) so ring
              // Count stays keyed off the GLOBAL `maxDepth` — matching
              // `ringOptions`'s `visibleRings` formula exactly — instead of
              // Silently diverging for an irregular (uneven-depth) tree,
              // Which would misalign native's rings against the still-
              // `ringOptions`-driven labels/hit-layer/center-circle overlays.
              rootId: focus.id,
              stroke: "var(--chart-background)",
              strokeWidth: 1,
              // Parity condition 1 (verified against real d3-hierarchy
              // 3.1.2, see file header): native's `hierarchy.root.sum(...)`
              // ADDS a node's own value on top of its children's, unlike
              // `sumValues` (sunburst-geometry.ts) which ignores a node's
              // Own `value` whenever it has children — a leaf-only accessor
              // Is REQUIRED or an internal node carrying its own value
              // Diverges by up to ~3 rad (measured).
              value: (d: SunburstFlatRow) => (d.hasChildren ? 0 : (d.rawValue ?? 0)),
              // Shares the focus-remap note on rootId above.
              visibleDepth: visibleDepthValue,
            }),
          ],
          radiusRatio: 1,
          // Parity condition 3 (verified against real d3-hierarchy 3.1.2,
          // See file header): native's own default sweep is 0→2π starting at
          // 3 o'clock, NOT bklit's 12-o'clock-clockwise origin
          // (`sunburst-geometry.ts`'s `TOP = -Math.PI/2`) — must be set
          // Explicitly or every arc lands rotated 90° from legacy.
          startAngle: -Math.PI / 2,
        }),
      ],
      scales: { x: null, y: null },
      // T-D15 (P3.1): explicit 5-entry palette override, NOT the native
      // 6-entry defaultChartTheme.palette — see internal/design-tokens.ts.
      // Every row already carries an explicit per-datum `fill` (getFill /
      // Colors above), so this has no pixel effect today.
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

  // --- C5: reveal-phase tracking (bench settle detection) ---------------
  // The arc SWEEP itself is now fully native (the mark's own `motion`
  // Above) — this effect no longer drives any animation, it only tracks
  // `onPhaseChange` timing so external callers still see "revealing" then
  // "ready" on the same rough schedule the WAAPI reveal used to produce.
  // Deliberately keyed on `[arcs, playKey, ...]`, not `arcRows`: `arcs`
  // (and therefore which keys are "new") only changes on mount or when
  // `data` changes shape — a hover/zoom-triggered `arcRows` recompute must
  // NOT restart this timer (matches the pre-C5 `seenRevealedRef` guard's
  // Intent, now for free via the effect's own dependency list). A playKey
  // Bump both restarts this timer AND (via the mark's `key`, above)
  // Independently triggers native's own enter/exit replay — the two are
  // Deliberately decoupled: this effect only ever reports phase, never
  // Animates.
  useEffect((): (() => void) | undefined => {
    if (prefersReducedMotion) {
      setPhase("ready");
      return undefined;
    }
    setPhase("revealing");
    const maxDelay = maxRevealDelayMs(arcs, enterStaggerScale);
    revealDeadlineTimerRef.current = setRevealDeadline(sweepDurationMs + maxDelay + 935, {
      onDeadline: () => { setPhase("ready"); },
    });
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        globalThis.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, [arcs, playKey, enterStaggerScale, sweepDurationMs, prefersReducedMotion, setPhase]);

  // --- TanStack-path click listeners (synthetic-dispatch contract) ---
  // Real pointer interaction is served by the hit layer above the stage svg;
  // These click-only listeners exist for programmatic dispatch on the
  // TanStack-rendered paths (bench scenario `__benchDrilldown` clicks
  // `path[data-ts-key^="sunburst-arcs:"]` directly).
  useEffect((): (() => void) | undefined => {
    const container = containerRef.current;
    if (!container) {return undefined;}
    const elementMap = getSunburstPathMap(container, sunburstMarkId);
    if (elementMap.size === 0) {return undefined;}

    const cleanups: Array<() => void> = [];
    for (const a of sortedArcs) {
      const pathEl = elementMap.get(a.id);
      if (pathEl) {
        const onClick = () => {
          if (a.hasChildren) {zoomToEvent(a.id);}
        };
        pathEl.addEventListener("click", onClick);
        cleanups.push(() => {
          pathEl.removeEventListener("click", onClick);
        });
      }
    }
    return () => {
      for (const c of cleanups) {c();}
    };
  }, [sortedArcs, sunburstMarkId]);

  // --- Hit layer handlers (bklit parity: enter per segment, leave only at ---
  // --- svg level — last-enter-wins; click zooms when segment has children) ---
  // C5: the pre-native reveal used to suppress hover while a path's `d` was
  // Still owned by an in-flight WAAPI reveal `.animate()` (a two-writer
  // Hazard against the SAME attribute). Native motion owns both the reveal
  // And hover-grow through the ONE reconcile pipeline now, so there is no
  // Second writer left to race — no guard needed.
  // 6.5 gate (D448 → D471): the pointer overlay and native keyboard focus
  // Share ONE hover cell with no source tag. While the pointer is inside the
  // Overlay it owns that cell — native `onFocusChange` re-reports the still-
  // Focused keyboard point on every host render (dist/renderer.js:165-168)
  // And fires `null` on `focusout` (renderer.js:615), and without this guard
  // Both would overwrite a live pointer hover. Keyboard focus still drives
  // Hover whenever the pointer is outside the stage.
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
      const a = arcs[arcIndex];
      if (a?.hasChildren) {zoomTo(a.id);}
    },
    [arcs, zoomTo],
  );

  // C5c (D435): keyboard-only native focus forwarding — see file header.
  // Pointer resolution never fires here in practice (SunburstHitLayer
  // Occludes svg.ts-chart), but Tab/arrow-key focus is independent of
  // Pointer z-order and DOES resolve, so this is a genuine (if narrow)
  // Capability add: keyboard users get arc dim/grow hover-preview.
  const handleSunburstFocusChange = useCallback(
    (point: { datum: TSSunburstNode<SunburstFlatRow> } | null) => {
      // Pointer owns hover (D471).
      if (pointerInsideStageRef.current) {return;}
      const a = point ? arcsById.get(point.datum.id) : undefined;
      setHoveredArcIndex(a ? a.arcIndex : null);
    },
    [setHoveredArcIndex, arcsById],
  );

  // C5c (D435): the SB15 `useLayoutEffect` DOM reach-in that used to query
  // `container.querySelector("svg.ts-chart")` directly for a `pointerleave`
  // Listener is RETIRED — confirmed dead in practice (svg.ts-chart never
  // Receives pointerenter, hence never pointerleave, in any region covered
  // By SunburstHitLayer's identically-sized, later-painted overlay).
  // `SunburstHitLayer`'s own `<svg onPointerLeave={onHitLeaveAll}>` (its
  // Outer element, full footprint, unchanged below) already reproduces the
  // "leave the stage clears hover" behavior and was doing the actual work.

  // --- SB15: 350ms fade-in of the whole chart stage on mount ---
  // Legacy: motion.svg opacity 0→1, duration 0.35, ease [0.22,1,0.36,1].
  useLayoutEffect((): (() => void) | undefined => {
    if (prefersReducedMotion) {return undefined;}
    const container = containerRef.current;
    if (!container) {return undefined;}
    const stage = container.querySelector<SVGSVGElement>("svg.ts-chart");
    if (!stage) {return undefined;}
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
  // Transition, SUNBURST_ZOOM_MS/EASE above) — `arcRows` already recomputes
  // Off `focus` on every `zoomTo` commit, so TanStack's own keyed reconcile
  // Triggers the morph with zero imperative code here. The WAAPI zoom
  // Effect (`buildZoomKeyframes`, queried `elementMap`, per-arc `.animate()`
  // Calls) is deleted outright, not ported — `zoomT`'s rAF tick loop
  // (`zoomTo`, above) still drives the label/hit-layer/center-circle
  // Overlays below, which are NOT TanStack scene nodes and have no native
  // Motion equivalent to fall back on. (`revealDeadlineTimerRef`'s teardown
  // Is already handled by the reveal-phase effect's own cleanup, above —
  // No separate unmount effect needed here.)

  // --- Center circle geometry ---
  // SB13 (legacy parity): interpolate the hub radius during zoom —
  // Hub radius blends as centerR(focus)·zoomT + centerR(prevFocus)·(1−zoomT) — so the hub grows/
  // Shrinks with the d-morph instead of snapping at commit.
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
    if (labelsCount === 0) {return [];}
    const inZoom = zoomT < 1;
    const fromF = inZoom ? prevFocus : focus;
    return arcs
      .flatMap((a) => {
        const base = inZoom
          ? transitionGeometry(a, fromF, focus, maxDepth, radius, zoomT)
          : geometryFor(a, focus, maxDepth, radius);
        if (!base) {return [];}
        if (hoveredArc && !isRelatedArc(a, hoveredArc)) {return [];}
        const r = geomCentroidRadius(base);
        const angleSpan = base.a1 - base.a0;
        if (angleSpan * r < 26 || base.outerR - base.innerR < 16) {return [];}
        const mid = geomCentroidAngle(base);
        const x = Math.sin(mid) * r;
        const y = -Math.cos(mid) * r;
        let deg = (mid * 180) / Math.PI - 90;
        if (deg > 90) {deg -= 180;}
        if (deg < -90) {deg += 180;}
        return [{ deg, id: a.id, label: a.name, x, y }];
      });
  }, [labelsCount, arcs, focus, prevFocus, maxDepth, radius, hoveredArc, zoomT]);

  // --- Hit layer: bklit-parity hit-testing on BASE (ungrown) geometry ---
  // Bklit's SunburstSegment hit-tests a transparent fill-only path at base
  // Geometry; the grown visual path is pointer-events:none. Porting that
  // Model: hover resolves against static geometry (grow never slides
  // Geometry under the pointer) and the fill-only edge behavior at the
  // Shared-boundary ray matches bklit's knife-edge hit-test outcome.
  const hitItems = useMemo((): SunburstHitItem[] => {
    const inZoom = zoomT < 1;
    const fromF = inZoom ? prevFocus : focus;
    const items: SunburstHitItem[] = [];
    for (const a of sortedArcs) {
      const base = inZoom
        ? transitionGeometry(a, fromF, focus, maxDepth, radius, zoomT)
        : geometryFor(a, focus, maxDepth, radius);
      if (base) {
        const pathData = arcPath(base, 1, 1);
        if (pathData) {
          items.push({ arcIndex: a.arcIndex, hasChildren: a.hasChildren, pathData });
        }
      }
    }
    return items;
  }, [sortedArcs, focus, prevFocus, maxDepth, radius, zoomT]);

  // SB18: was a local re-implementation of the identical logic. `maxRevealDelayMs`
  // (internal/sunburst-reveal.ts:75) is the shared helper; `buildRevealTiming`
  // Returns delays sorted ascending, so its last element IS the max.
  const maxRevealDelay = useMemo(() => maxRevealDelayMs(arcs, enterStaggerScale), [arcs, enterStaggerScale]);

  const labelsRevealDelayMs = maxRevealDelay + enterDurationMs * 0.85;

  const labelRevealAnimsRef = useRef<Animation[]>([]);

  // Deferred label reveal (once per reveal cycle; hover/zoom must not restart
  // It). SB1: the playKey replay effect clears the dataset guard + inline
  // Opacity and re-runs this via its labelsRevealDelayMs dependency.
  const runLabelsReveal = useCallback(() => {
    const container = containerRef.current;
    if (!container) {return null;}
    const svg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
    if (!svg) {return null;}
    const svgDataset = (svg as unknown as HTMLElement & { dataset: DOMStringMap }).dataset;
    for (const anim of labelRevealAnimsRef.current) {
      try {
        anim.cancel();
      } catch {
        // Teardown race — already cancelled.
      }
    }
    labelRevealAnimsRef.current = [];
    const cancelLabelPostPaint = onPostPaint(() => {
      const liveTexts = [...svg.querySelectorAll<SVGTextElement>(SUNBURST_LABEL_TEXT_SELECTOR)];
      for (const t of liveTexts) {
        if (t.isConnected) {
          t.style.opacity = "0";
          const anim = t.animate(
            [{ opacity: "0" }, { opacity: "1" }],
            {
              delay: labelsRevealDelayMs,
              duration: enterDurationMs,
              easing: "cubic-bezier(0.85,0,0.15,1)",
              fill: "backwards",
            },
          );
          labelRevealAnimsRef.current.push(anim);
          anim.onfinish = () => {
            anim.cancel();
            if (t.isConnected) {t.style.opacity = "1";}
          };
        }
      }
    });
    const timer = globalThis.setTimeout(() => {
      svgDataset.bkmLabelsRevealed = "1";
      for (const t of svg.querySelectorAll<SVGTextElement>(SUNBURST_LABEL_TEXT_SELECTOR)) {
        if (t.isConnected) {t.style.opacity = "";}
      }
    }, labelsRevealDelayMs + enterDurationMs + 30);
    return () => {
      cancelLabelPostPaint();
      globalThis.clearTimeout(timer);
      for (const anim of labelRevealAnimsRef.current) {
        try {
          anim.cancel();
        } catch {
          // Teardown race — already cancelled.
        }
      }
    };
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

  // --- SB1: playKey replays the initialization animation ---
  // Legacy keys its enter tweens with `${playKey}-enter-${arcId}`, so bumping
  // Bumping the key restarts the whole reveal. C5: the ARC reveal replay is now
  // Entirely native — `playKey` is folded into the mark's own `key`
  // (definition useMemo, above), so a playKey bump makes every arc key
  // "new" and native replays the full staggered enter on its own; phase
  // Tracking (`setPhase("revealing")` → `"ready"`) is likewise already
  // Covered by the reveal-phase effect above (also keyed on `[..., playKey,
  // ...]`). This effect's only remaining job is the LABELS overlay, which
  // Stays WAAPI (a separate DOM overlay, no native mark to hang motion off)
  // And needs its own once-per-cycle dataset-guard reset + replay.
  useEffect(() => {
    const next = `${playKey}`;
    if (next === playCycleRef.current) {return;}
    playCycleRef.current = next;

    const container = containerRef.current;
    if (!container) {return;}
    const labelsSvg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
    if (labelsSvg) {
      delete (labelsSvg as unknown as HTMLElement & { dataset: DOMStringMap }).dataset.bkmLabelsRevealed;
      for (const t of labelsSvg.querySelectorAll<SVGTextElement>(SUNBURST_LABEL_TEXT_SELECTOR)) {
        t.style.opacity = "";
      }
      runLabelsRevealRef.current?.();
    }
  }, [playKey]);


  useEffect(
    () => () => {
      for (const anim of labelRevealAnimsRef.current) {
        try {
          anim.cancel();
        } catch {
          // Teardown race — already cancelled.
        }
      }
      labelRevealAnimsRef.current = [];
    },
    [],
  );

  // --- Hint text ---
  const hintText = resolveSunburstHintText(hoveredArc?.trail, focus.depth);
  // Hoisted so the zoom-to-parent closure below captures a narrowed string.
  const zoomParentId = focus.parentId;

  return (
    <div
      className={className}
      data-bkm-chart="sunburst"
      ref={containerRef}
      style={{ maxWidth: "100%", position: "relative", width: size }}
    >
      {breadcrumbChildren}
      <div style={{ aspectRatio: "1 / 1", maxWidth: size, position: "relative" }}>
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
          onZoomToParent={zoomParentId ? () => { zoomTo(zoomParentId); } : undefined}
        />
        {labelsCount > 0 && (
          <SunburstLabelsOverlay items={labelItems} fullRadius={fullRadius} size={size} />
        )}
      </div>
      {hintCount > 0 && (
        <SunburstHintDisplay className={hintProps?.className}>
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

// ---------------------------------------------------------------------------
// SunburstChart
// ---------------------------------------------------------------------------

export const SunburstChart = ({
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
}: SunburstChartProps) => {
  // SB2 — sweep timing. Primitive deps: callers pass `enterTransition` inline.
  // An identity-only change must not retrigger the computation; the ref still
  // Hands the memo the latest full object (line-chart precedent).
  const enterType = enterTransition?.type;
  const enterDurationSec = enterTransition?.duration;
  const enterEaseKey = enterTransition?.ease?.join(",");
  const enterTransitionRef = useRef(enterTransition);
  enterTransitionRef.current = enterTransition;
  const { durationMs: sweepDurationMs, easingCss: sweepEasingCss } = useMemo(
    () => clipRevealTiming(enterTransitionRef.current, SUNBURST_SWEEP_MS, SUNBURST_SWEEP_EASE),
    [enterType, enterDurationSec, enterEaseKey],
  );
  // --- Phase tracking (deduped — just gate on last emitted value) ---
  const phaseRef = useRef<SunburstPhase>("revealing");
  const setPhase = useCallback((p: SunburstPhase) => {
    if (phaseRef.current === p) {return;}
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
    () => arcs.toSorted((a, b) => b.depth - a.depth || b.arcIndex - a.arcIndex),
    [arcs],
  );

  // --- Focus state ---
  const isFocusControlled = focusIdProp !== undefined;
  const [internalFocusId, setInternalFocusId] = useState(rootId);
  const focusId = focusIdProp ?? internalFocusId;

  useEffect(() => {
    if (!isFocusControlled) {setInternalFocusId(rootId);}
  }, [rootId, isFocusControlled]);

  const prefersReducedMotion = usePrefersReducedMotion();

  const rootFocus = focusById.get(rootId);
  const focus = focusById.get(focusId) ?? rootFocus;
  if (!(focus && rootFocus)) {return null;}

  // The subtree below needs non-null focus/rootFocus; render it through an inner
  // Component so every hook stays unconditional (react-hooks/rules-of-hooks).
  return (
    <SunburstChartInner
      data={data}
      size={size}
      className={className}
      focus={focus}
      layout={{ arcs, focusById, maxDepth, rootId, sortedArcs }}
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

export const SunburstSegment = (_props: SunburstSegmentProps): null => null;

SunburstSegment.displayName = "SunburstSegment";
