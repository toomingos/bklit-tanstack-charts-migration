// RingChart — ports repos/bklit-ui/packages/ui/src/charts/{ring-chart,ring,
// ring-context,ring-center,chart-stat-flow,chart-center-typography}.tsx.
//
// --- Architecture (TanStack-native, PLAN Phase 1.2 redo, D76) ------------
// The previous revision (D51) sidestepped TanStack entirely — plain React
// Context + hand-rolled d3-shape arcs, with one `<Ring>` React component per
// datum carrying its own refs, effects, paths, and event handlers. That
// faithfully reproduced bklit's composable-children API but inherited bklit's
// per-component React overhead (~2ms/ring), landing M1a within noise of bklit
// at every gate size (23.2 vs 23.9ms at n=4).
//
// This revision uses the TanStack rendering pipeline directly:
// `radialArc` marks inside a `polar()` container, emitted by `defineChart`
// and rendered by `<Chart>`. The `<Ring>` children are classified but never
// rendered as React components — their props are extracted and baked into the
// mark definitions. The WAAPI reveal, imperative hover springs, and
// `RingCenter` overlay are layered on TanStack-rendered DOM via
// `data-ts-key` queries. `focusDisabled` suppresses TanStack's own pointer
// handling so Ring's custom hover owns the surface entirely.
//
// Expected M1a savings: eliminates 4 × ~2ms per-ring React overhead
// (~8ms total) plus per-ring hook registration, context reads, and path
// computation in React render. The SVG rendering itself moves from
// React-managed DOM to TanStack's optimized scene-graph pipeline.
//
// --- Preserved from D51 (all previous findings verified and carried forward)
// * bklit fade + glow DEAD at runtime (empirically verified) — C1
//   (states+legend) deletes the corresponding dead DOM-mutation code in
//   internal/ring-hover-chrome.ts outright rather than porting non-rendering
//   pixels (see that file's header for the empirical evidence)
// * `animationDuration` dead prop, `isLoaded`/`animationKey` dead state
// * d3-arc full-circle verification (cornerRadius branch not taken for 2π)
// * RingCenter with real NumberFlow digit-roll (sanctioned D10 exception)
// * Scrub layers bypass marks entirely (TanStack `animate: false`)
// * `spring.ts` REST_DELTA fix (D51)
// * Deferred center mount (D75, setTimeout past M1a doubleRaf clock)
//
// --- C3 (native motion, Phase 6, D432): two-phase reveal + hover springs
// split between native motion and one scoped imperative exception ---------
// PROGRESS arc (the sweep): fully native. `dist/motion.js`'s `createArcTracks`
// — the DEFAULT entrance for every `g.ts-chart__arc` mark — already plays an
// angular clip-path sweep from `startAngle` to the row's own `endAngle`,
// which is EXACTLY bklit's progress-sweep shape; the `progressMark`'s
// `motion` callback below only supplies the enter-phase `delay` (legacy's
// `0.1*enterStaggerScale*1000` each / `0.6*enterStaggerScale*1000` offset
// formula, computed directly per ring index rather than via TanStack's own
// `stagger()` helper — each ring is its own top-level mark, not a datum
// within one shared mark, so there is no single `seriesIndex` sequence for
// `stagger()` to count against) and, for the update phase, HOVER_SPRING.
//
// TRACK arc (the background band): legacy pops the whole band in with a
// uniform `transform: scale(p)` — the band's `{startAngle,endAngle}` is
// ALREADY the full rest-state angular range, so there is no angular growth
// to sweep, only a radial "grow from the center" pop. Read directly against
// `dist/motion.js`: `createArcTracks` (the only entrance mechanism registered
// for role "arc") implements nothing but the clip-path angular sweep above;
// the renderer's only other built-in entrance primitives are a cartesian
// baseline-grow matrix (bar-shaped marks, ~line 900) and `createRadialPathTracks`
// (radar's `.ts-chart__radial-{line,area,dot}` marks, ~line 939) — neither
// targets `.ts-chart__arc`, and neither is a general "scale from center" pop.
// No native mechanism reproduces the track's entrance, so — same D420
// precedent as radar's grid-ring/spoke/label reveal (`internal/reveal-wipe.ts`
// header) — it stays a scoped, narrowly-documented imperative WAAPI reach-in:
// `handleRender` below (renamed nothing, same function, progress-half deleted)
// still resets `trackGroup.style.transform` and plays the `scale(p)` keyframe
// tween/spring exactly as before, gated by `motion: (ctx) => ctx.phase ===
// "enter" ? false : ...` on the TRACK mark so native's own clip-sweep never
// plays underneath it.
//
// HOVER SCALE (both track + progress, 1.03 hovered / 1.02 pushed-out / 1
// rest): now a REACTIVE DEFINITION PARAMETER, not a DOM write. A CSS
// `transform: scale(s)` centered at the polar origin is pixel-identical to
// multiplying `innerRadius`/`outerRadius`/`cornerRadius` by `s` (arc geometry
// is entirely a function of (radius, angle) about that same origin) — see
// `internal/ring-hover-chrome.ts`'s header. `RingChart` now subscribes to the
// hover coordinator via `useSyncExternalStore` (same pattern `useRingHover()`
// already used for external consumers) so hover changes recompute
// `definition`'s radius channels; the mark's `motion` update-phase transition
// (HOVER_SPRING, pie-hover-chrome.ts — the SAME `{stiffness:400,damping:25}`
// bklit spring, see ring-hover-chrome.ts:D10) animates the change smoothly.
// This trades the old "hover never re-renders the chart" optimization for a
// definition-parameter model — the same trade C2 already made for Pie's
// hover-grow. `createRingHoverRuntime`/`RingHoverRuntime` (the old spring
// runtime that wrote `style.transform` on both group elements, gated by a
// `started`/`settleAtRest()` two-writer-hazard flag against the track's WAAPI
// pop) are DELETED — hover now writes geometry (`d`), the pop writes
// `transform`, different attributes, no race, nothing left to gate.
//
// Minor D-ledger note: because native motion's update-phase spring fires on
// ANY change to a mark's keyed row (not just hover-triggered ones), a
// post-mount `data` prop change to a ring's `value`/`maxValue` now also
// animates the progress sweep's endAngle via the same HOVER_SPRING physics —
// legacy had no such post-mount smoothing (the WAAPI reveal only ever played
// once per ring index). Strictly additive, not a regression.
//
// --- C5c (native focus, Phase 6, D435): DOM pointer chrome retired --------
// CONTRARY to this rung's brief, ring already had a per-ring STATIC hitbox
// twin (`hitboxMarks`, D258 fix, above) — no new hitbox mark was authored
// here. `focusDisabled` and the `querySelectorAll`-free but still-imperative
// `[data-ts-key="ring-{i}-hitbox"]` + `pointerenter`/`pointerleave`
// `useLayoutEffect` are GONE. `focus` is omitted from `defineChart` (library
// default) and `<RendererChart onFocusChange>` forwards the resolved point
// to the SAME `RingHoverCoordinator` — unlike pie, `RingArcDatum` carries no
// index field (ring uses three separately-`id`'d marks per index —
// `ring-{i}-track/progress/hitbox` — not one multi-row mark), so the ring
// index is parsed off `ChartPoint.markId` via `/^ring-(\d+)-/`. Cursor style
// (`hitboxGroup.style.cursor`) moves to a CSS rule (styles.css, reported —
// shared file, not owned by this rung). Net-new: native keyboard focus now
// also resolves ring points. Same accepted approximation as pie: no public
// API excludes track/progress/hitbox marks' points from native
// keyboard/focus candidacy (dist/polar.d.ts, @tanstack/charts@0.15.0), so
// keyboard arrow-nav exposes redundant same-position stops; pointer
// resolution is unaffected (hitbox always painted last, wins containment).
import { Children, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, createContext, useContext, type CSSProperties, type ReactElement, type ReactNode, type RefObject } from "react";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { defineChart } from "@tanstack/charts/scene";
import { polar, radialArc } from "@tanstack/charts/polar";
import { pieArcPath } from "./internal/pie-geometry";
import { displayNameOf } from "./children";
// R7 (centralize.md OQ 2): REAL import edge to RingCenter — classification
// below gets an identity fast-path off it instead of relying solely on
// displayName-string matching. The displayName fallback stays so a
// user-supplied center component with matching displayName still classifies.
import { RingCenter } from "./internal/ring-center";
import {
  createRingHoverCoordinator,
  ringHoverScale,
  type RingHoverCoordinator,
} from "./internal/ring-hover-chrome";
import { HOVER_SPRING, motionEasingFromCss } from "./internal/pie-hover-chrome";
import {
  buildProgressKeyframes,
  RING_TWEEN_FALLBACK,
  resolveEnterTransition,
  revealTiming,
  type ResolvedTiming,
  type RingEnterTransition,
} from "./internal/enter-transition";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { nativeStaggerDelayMs } from "./internal/native-stagger";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { hitTestPolarBands, pointerToCenterOffset } from "./internal/polar-hit";
import { useDebouncedContainerSize } from "./internal";
import "./styles.css";

export type { RingEnterTransition } from "./internal/enter-transition";

const RING_BACKGROUND = "var(--border)";

export const defaultRingColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export interface RingData {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
}

export type RingLineCap = "round" | "butt";

// ---------------------------------------------------------------------------
// Context — same split stable/hover-coordinator as D51. RingCenter still
// reads `stable` for geometry + data, and the coordinator for hover
// subscriptions. The `<Ring>` components no longer read either context
// (they're not rendered), but the imperative chrome in RingChart reads the
// stable value to compute geometry and arm the coordinator.
// ---------------------------------------------------------------------------

interface ScrubRingLayer {
  bgPath: string;
  progressPath: string;
  color: string;
}

export interface RingStableValue {
  data: RingData[];
  size: number;
  center: number;
  strokeWidth: number;
  ringGap: number;
  baseInnerRadius: number;
  // P5.6 R2 — legacy's `RingStableContextValue` (`ring-context.tsx:63-70`)
  // carries these three; migrated had dropped them because nothing INSIDE the
  // chart reads them any more (the reveal is WAAPI, not `isLoaded`-gated —
  // see the file header). They are restored, not versioned, because they are
  // part of the hook's published payload: a bklit consumer calling
  // `useRingStable()` for `containerRef` (to portal into the chart box) or for
  // `isLoaded` (to gate its own entrance off the chart's) got them in legacy
  // and would get `undefined` here. Values are legacy's own, verbatim:
  // `animationKey` is `useState(0)` never incremented (`ring-chart.tsx:151`),
  // `isLoaded` is the 100ms post-mount flip OR'd with `geometryScrubbing`
  // (`:261,264-273`).
  animationKey: number;
  isLoaded: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  enterTransition?: RingEnterTransition;
  enterStaggerScale: number;
  totalValue: number;
  getColor: (index: number) => string;
  getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };
  startAngle: number;
  endAngle: number;
  geometryScrubbing: boolean;
  scrubRingLayers: readonly ScrubRingLayer[] | null;
}

/** P5.6 R3 — legacy's `RingHoverContextValue` (`ring-context.tsx:47-50`),
    the shape `useRingHover()` returns. */
export interface RingHoverValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

/** P5.6 R4 — legacy's `RingContextValue` (`ring-context.tsx:92`). */
export type RingContextValue = RingStableValue & RingHoverValue;

const RingStableContext = createContext<RingStableValue | null>(null);
const RingHoverCoordinatorContext = createContext<RingHoverCoordinator | null>(null);

export function useRingStable(): RingStableValue {
  const ctx = useContext(RingStableContext);
  if (!ctx) {
    throw new Error(
      "Ring components must be used within <RingChart>. Make sure <Ring>/<RingCenter> are children of a <RingChart>.",
    );
  }
  return ctx;
}

export function useRingHoverCoordinator(): RingHoverCoordinator {
  const ctx = useContext(RingHoverCoordinatorContext);
  if (!ctx) {
    throw new Error(
      "Ring components must be used within <RingChart>. Make sure <Ring>/<RingCenter> are children of a <RingChart>.",
    );
  }
  return ctx;
}

/**
 * P5.6 R3 — legacy-named compat hook over the imperative coordinator.
 *
 * Legacy `useRingHover()` (`ring-context.tsx:173`) returns React state:
 * `{ hoveredIndex, setHoveredIndex }`, and a consumer that reads
 * `hoveredIndex` re-renders when hover moves. Migrated's coordinator is an
 * imperative store precisely so that hover DOESN'T re-render the chart — but
 * an external consumer asking for `hoveredIndex` is asking to re-render, so
 * this binds the store with `useSyncExternalStore` (the same sanctioned
 * exception `useCenterStatHover` already makes for the center readout) and
 * subscribes only the caller.
 *
 * `setHoveredIndex` maps onto `requestHover`/`requestUnhover`, which carry
 * legacy's own controlled-vs-uncontrolled split (`ring-chart.tsx:157-...`:
 * controlled ⇒ call `onHoverChange`, uncontrolled ⇒ set internal state).
 * `setHovered` is deliberately NOT used here — that one skips
 * `onHoverChange`, which is the controlled-prop push path, not this one.
 */
export function useRingHover(): RingHoverValue {
  const coordinator = useRingHoverCoordinator();
  const hoveredIndex = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getHovered,
    coordinator.getHovered,
  );
  const setHoveredIndex = useCallback(
    (index: number | null) => {
      if (index === null) coordinator.requestUnhover();
      else coordinator.requestHover(index);
    },
    [coordinator],
  );
  return { hoveredIndex, setHoveredIndex };
}

/** P5.6 R4 — legacy's combiner, verbatim in shape
    (`ring-context.tsx:184-185`: `{ ...useRingStable(), ...useRingHover() }`).
    Reads the RESTORED payload, so `animationKey`/`isLoaded`/`containerRef`
    come through here too. Note it inherits `useRingHover`'s subscription:
    calling `useRing()` re-renders the caller on every hover change. */
export function useRing(): RingContextValue {
  return { ...useRingStable(), ...useRingHover() };
}

// ---------------------------------------------------------------------------
// Children classification — Ring elements are NOT rendered as React
// components in this revision. Their props are extracted and baked into
// the TanStack `radialArc` marks. RingCenter elements ARE rendered (overlay).
// ---------------------------------------------------------------------------

function isRingElement(child: ReactNode): boolean {
  return isValidElement(child) && typeof child.type === "function" && displayNameOf(child.type as { displayName?: string }) === "Ring";
}

function isRingCenterElement(child: ReactNode): boolean {
  if (isValidElement(child) && child.type === RingCenter) return true;
  return isValidElement(child) && typeof child.type === "function" && displayNameOf(child.type as { displayName?: string }) === "RingCenter";
}

interface RingChildConfig {
  index: number;
  color?: string;
  animate: boolean;
  // Extracted for bklit prop parity (`<Ring showGlow={false}>` still
  // compiles/classifies), but unread from here on — C1 deleted the dead
  // glow computation this fed (internal/ring-hover-chrome.ts never rendered
  // it; see that file's header). Same category as PieSlice's dead
  // `className` prop (D49).
  showGlow: boolean;
  lineCap: RingLineCap;
}

interface ClassifiedChildren {
  centerChildren: ReactNode[];
  ringConfigs: RingChildConfig[];
}

function classifyChildren(children: ReactNode, geometryScrubbing: boolean): ClassifiedChildren {
  const centerChildren: ReactNode[] = [];
  const ringConfigs: RingChildConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (isRingCenterElement(child)) {
      centerChildren.push(child);
    } else if (isRingElement(child) && !geometryScrubbing) {
      // Extract config from the React element's props without rendering it.
      const props = (child as ReactElement).props as {
        index: number;
        color?: string;
        animate?: boolean;
        showGlow?: boolean;
        lineCap?: RingLineCap;
      };
      ringConfigs.push({
        index: props.index,
        color: props.color,
        animate: props.animate !== false,
        showGlow: props.showGlow !== false,
        lineCap: props.lineCap ?? "round",
      });
    }
  });

  return { centerChildren, ringConfigs };
}

// ---------------------------------------------------------------------------
// RingChart
// ---------------------------------------------------------------------------

export interface RingChartProps {
  data: RingData[];
  size?: number;
  strokeWidth?: number;
  ringGap?: number;
  baseInnerRadius?: number;
  animationDuration?: number;
  className?: string;
  style?: CSSProperties;
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  startAngle?: number;
  endAngle?: number;
  enterTransition?: RingEnterTransition;
  enterStaggerScale?: number;
  geometryScrubbing?: boolean;
  children: ReactNode;
}

// TanStack `radialArc` expects `startAngle`/`endAngle` channels on the datum
// by default — exactly these field names match the mark's default channel
// resolvers (polar.ts `radialArc` options: `startAngle`/`endAngle` resolve
// from datum fields of the same name unless overridden).
interface RingArcDatum {
  startAngle: number;
  endAngle: number;
}

type AnyRadialArcMark = ReturnType<typeof radialArc<RingArcDatum>>;

export function RingChart({
  data,
  size: fixedSize,
  strokeWidth: strokeWidthProp = 12,
  ringGap: ringGapProp = 6,
  baseInnerRadius: baseInnerRadiusProp = 60,
  className,
  style,
  hoveredIndex,
  onHoverChange,
  startAngle = -Math.PI / 2,
  endAngle = (3 * Math.PI) / 2,
  enterTransition,
  enterStaggerScale = 1,
  geometryScrubbing = false,
  children,
}: RingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // P9 (bklit ParentSize debounceTime={10}): measurement goes through the
  // debounced width+height hook, same as pie (:243-251) and gauge's G5 call
  // sites. The retired `useMeasuredRect(containerRef, !fixedSize)` passed
  // `enabled` purely to skip mounting a ResizeObserver in fixed mode — an
  // optimization, not behavior: containerRef is attached on the single root
  // div on every render branch and `size` falls back to `fixedSize` below,
  // so a measured value in fixed mode is never read.
  const { width, height } = useDebouncedContainerSize(containerRef);
  const size = fixedSize ?? Math.min(width, height);

  // --- Hover coordinator (unchanged from D51). ---
  const isControlledRef = useRef(hoveredIndex !== undefined);
  isControlledRef.current = hoveredIndex !== undefined;
  const onHoverChangeRef = useRef(onHoverChange);
  onHoverChangeRef.current = onHoverChange;

  const coordinatorRef = useRef<RingHoverCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createRingHoverCoordinator(
      (index) => onHoverChangeRef.current?.(index),
      () => isControlledRef.current,
    );
  }
  const coordinator = coordinatorRef.current;

  useEffect(() => {
    if (hoveredIndex !== undefined) {
      coordinator.setHovered(hoveredIndex);
    }
  }, [hoveredIndex, coordinator]);

  // C3 (native motion, D432): hover scale is now a reactive definition
  // parameter (see file header), so `RingChart` itself must re-render on
  // hover changes — subscribe via the same `useSyncExternalStore` pattern
  // `useRingHover()` already used for external consumers.
  const liveHoveredIndex = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getHovered,
    coordinator.getHovered,
  );

  // --- Geometry (same bklit-exact arithmetic as D51). ---
  const center = size / 2;
  const ringCount = data.length;
  const padding = 8;
  const availableRadius = center - padding;

  const designOuterRadius = baseInnerRadiusProp + (ringCount - 1) * (strokeWidthProp + ringGapProp) + strokeWidthProp;
  const renderScale = Math.min(1, availableRadius / designOuterRadius);

  const strokeWidth = strokeWidthProp * renderScale;
  const ringGap = ringGapProp * renderScale;
  const baseInnerRadius = baseInnerRadiusProp * renderScale;

  const totalValue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  const getColor = useCallback(
    (index: number) => data[index]?.color || (defaultRingColors[index % defaultRingColors.length] as string),
    [data],
  );

  const getRingRadii = useCallback(
    (index: number) => {
      const inner = baseInnerRadius + index * (strokeWidth + ringGap);
      return { innerRadius: inner, outerRadius: inner + strokeWidth };
    },
    [baseInnerRadius, strokeWidth, ringGap],
  );

  const arcRange = endAngle - startAngle;

  // --- Children classification (Ring props → configs, RingCenter → overlay). ---
  const rawClassified = useMemo(
    () => classifyChildren(children, geometryScrubbing),
    [children, geometryScrubbing],
  );
  const centerChildren = rawClassified.centerChildren;

  const ringConfigMap = useMemo(
    () => new Map(rawClassified.ringConfigs.map((c) => [c.index, c])),
    [rawClassified.ringConfigs],
  );

  // --- Scrub layers (static paths, bypass TanStack marks entirely). ---
  const scrubRingLayers = useMemo((): readonly ScrubRingLayer[] | null => {
    if (!geometryScrubbing) return null;
    return data.map((ringData, index) => {
      const { innerRadius, outerRadius } = getRingRadii(index);
      const cornerRadius = (outerRadius - innerRadius) / 2;
      const progress = ringData.value / ringData.maxValue;
      const progressEndAngle = startAngle + arcRange * progress;
      return {
        bgPath: pieArcPath(innerRadius, outerRadius, startAngle, endAngle, cornerRadius, 0),
        progressPath:
          progressEndAngle <= startAngle + 0.01
            ? ""
            : pieArcPath(innerRadius, outerRadius, startAngle, progressEndAngle, cornerRadius, 0),
        color: getColor(index),
      };
    });
  }, [geometryScrubbing, data, getRingRadii, getColor, startAngle, endAngle, arcRange]);

  // P5.6 R2 — legacy's dead-at-runtime animation state, restored onto the
  // published payload. Nothing in migrated READS these (the reveal is WAAPI);
  // they exist so `useRingStable()`/`useRing()` hand a bklit consumer the same
  // fields legacy did. `ring-chart.tsx:151,152,261,264-273`.
  const ANIMATION_KEY = 0;
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    if (geometryScrubbing) return;
    setIsLoaded(false);
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, [enterTransition, enterStaggerScale, geometryScrubbing]);
  const effectiveIsLoaded = geometryScrubbing || isLoaded;

  const stable: RingStableValue = useMemo(
    () => ({
      data,
      size,
      center,
      strokeWidth,
      ringGap,
      baseInnerRadius,
      animationKey: ANIMATION_KEY,
      isLoaded: effectiveIsLoaded,
      containerRef,
      enterTransition,
      enterStaggerScale,
      totalValue,
      getColor,
      getRingRadii,
      startAngle,
      endAngle,
      geometryScrubbing,
      scrubRingLayers,
    }),
    [
      data, size, center, strokeWidth, ringGap, baseInnerRadius,
      effectiveIsLoaded, containerRef,
      enterTransition, enterStaggerScale, totalValue,
      getColor, getRingRadii, startAngle, endAngle,
      geometryScrubbing, scrubRingLayers,
    ],
  );

  // --- Deferred center mount (D75). ---
  const [centerVisible, setCenterVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setCenterVisible(true), 0);
    return () => clearTimeout(id);
  }, []);

  // --- TanStack definition — 2× radialArc per ring (track + progress). ---
  const definition = useMemo(() => {
    if (geometryScrubbing) {
      // Scrub mode: render an empty polar container. The scrub layers are
      // drawn as plain React SVG paths outside the Chart (see JSX below).
      return defineChart({
        marks: [polar({ inset: padding, radiusRatio: 1, marks: [] })],
        guides: false, scales: { x: null, y: null },
        tooltip: false,
      });
    }

    const arcMarks: AnyRadialArcMark[] = [];

    // T-D3: progress sweep's native stagger delay — legacy formula
    // (handleRender, pre-C3), computed once per ring index via
    // `nativeStaggerDelayMs` directly (not TanStack's own `stagger()`
    // helper: each ring is its own top-level mark, not a datum inside one
    // shared mark, so there's no single `seriesIndex` sequence to stagger
    // against — see file header).
    const progressStaggerEachMs = 0.1 * enterStaggerScale * 1000;
    const progressStaggerOffsetMs = 0.6 * enterStaggerScale * 1000;

    for (let i = 0; i < data.length; i++) {
      const ringData = data[i] as RingData;
      const config = ringConfigMap.get(i);
      const { innerRadius, outerRadius } = getRingRadii(i);
      const cornerPx = config && config.lineCap === "round" ? (outerRadius - innerRadius) / 2 : 0;
      const color = config?.color || getColor(i);
      const progress = ringData.maxValue > 0 ? Math.min(1, Math.max(0, ringData.value / ringData.maxValue)) : 0;

      // Ratios: divide by `availableRadius` so `radius * ratio = pixel`.
      // The `radius` parameter in PolarLength is the resolved layout radius,
      // which equals `availableRadius` due to `radiusRatio: 1, inset: padding`.
      const innerRatio = innerRadius / availableRadius;
      const outerRatio = outerRadius / availableRadius;
      const cornerRatio = cornerPx / availableRadius;

      // C3 (native motion, D432): hover scale as geometry (see file header
      // + ring-hover-chrome.ts) — `transform: scale(s)` around the polar
      // origin === radii * s. `liveHoveredIndex` is this render's snapshot;
      // the update-phase HOVER_SPRING transition below animates the change.
      const isHovered = liveHoveredIndex === i;
      const isPushedOut = liveHoveredIndex !== null && liveHoveredIndex < i;
      const hoverScale = ringHoverScale(isHovered, isPushedOut);

      const trackRow: RingArcDatum = { startAngle, endAngle };
      const progressRow: RingArcDatum = {
        startAngle,
        endAngle: startAngle + arcRange * progress,
      };

      // T-D3: track's entrance is the D420 imperative exception (handleRender
      // below) — `motion: false` on "enter" suppresses native's default
      // clip-path sweep so it never plays underneath the WAAPI pop. Update
      // phase (hover) is native: HOVER_SPRING on the radius channels above.
      arcMarks.push(
        radialArc<RingArcDatum>([trackRow], {
          id: `ring-${i}-track`,
          key: () => "track",
          innerRadius: ({ radius }) => radius * innerRatio * hoverScale,
          outerRadius: ({ radius }) => radius * outerRatio * hoverScale,
          cornerRadius: ({ radius }) => radius * cornerRatio * hoverScale,
          fill: RING_BACKGROUND,
          opacity: 1,
          motion: (ctx) => {
            if (ctx.phase === "enter") return false;
            return { transition: { type: "spring", stiffness: HOVER_SPRING.stiffness, damping: HOVER_SPRING.damping } };
          },
        }),
      );

      // Skip progress mark when the sweep is effectively empty
      if (progress > 0.001) {
        const progressEnterDelayMs = nativeStaggerDelayMs(progressStaggerEachMs, progressStaggerOffsetMs, i, "arc");
        arcMarks.push(
          radialArc<RingArcDatum>([progressRow], {
            id: `ring-${i}-progress`,
            key: () => "progress",
            innerRadius: ({ radius }) => radius * innerRatio * hoverScale,
            outerRadius: ({ radius }) => radius * outerRatio * hoverScale,
            cornerRadius: ({ radius }) => radius * cornerRatio * hoverScale,
            fill: color,
            opacity: 1,
            // T-D3: native default entrance for role "arc" (`createArcTracks`,
            // dist/motion.js) is already bklit's angular sweep — only the
            // enter-phase `delay` (+ a caller-supplied `enterTransition`'s
            // transition, mirroring pie's C2 handling) needs to be supplied.
            // Update phase (hover / post-mount progress change): HOVER_SPRING.
            motion: (ctx) => {
              if (ctx.phase === "enter") {
                if (!enterTransition) return { delay: progressEnterDelayMs };
                const resolved: ResolvedTiming = resolveEnterTransition(enterTransition, RING_TWEEN_FALLBACK);
                return {
                  delay: progressEnterDelayMs,
                  transition:
                    resolved.kind === "spring"
                      ? { type: "spring", stiffness: resolved.stiffness, damping: resolved.damping, mass: resolved.mass }
                      : { type: "tween", duration: resolved.durationMs, easing: motionEasingFromCss(resolved.easingCss) },
                };
              }
              return { transition: { type: "spring", stiffness: HOVER_SPRING.stiffness, damping: HOVER_SPRING.damping } };
            },
          }),
        );
      }

    }

    return defineChart({
      marks: [polar({ inset: padding, radiusRatio: 1, marks: arcMarks })],
      guides: false, scales: { x: null, y: null },
      // D473 (6.5 gate, supersedes C5c/D435/D447): pointer detection is
      // app-owned again — `pointer: false` + the wrapper's pointer handlers
      // (see `handlePointerMove` below / internal/polar-hit.ts). Same
      // hover/unhover loop as pie (React #185) under native focus at
      // 0.15.0. `focusRing: false` stays: the reactive hover-scale geometry
      // above IS ring's authored focus treatment.
      pointer: false, focusRing: false, tooltip: false,
    });
  }, [data, ringConfigMap, getRingRadii, getColor, availableRadius, padding, startAngle, endAngle, arcRange, geometryScrubbing, liveHoveredIndex, enterTransition, enterStaggerScale]);

  // --- Imperative track-pop state (D420 exception, see file header) — only
  // the track's scale-pop still needs WAAPI; progress + hover are native. ---
  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);

  const enterTransitionRef = useRef(enterTransition);
  enterTransitionRef.current = enterTransition;
  const enterStaggerScaleRef = useRef(enterStaggerScale);
  enterStaggerScaleRef.current = enterStaggerScale;

  const hoverInputsRef = useRef({
    data: [] as RingData[],
    ringConfigMap: new Map<number, RingChildConfig>(),
    geometryScrubbing: false,
  });
  hoverInputsRef.current = { data, ringConfigMap, geometryScrubbing };

  // -----------------------------------------------------------------------
  // handleRender — D420 imperative exception: ONLY the track's scale-pop
  // (see file header — no native "arc" role mechanism reproduces a radial
  // grow-from-center). Animates only rings whose index has NOT yet been seen
  // (Set diff, so growth n=2→4 reveals the 2 new rings without re-animating
  // existing ones). Live DOM queries each invocation — no cached ref that
  // can go stale across growth reconciliations. The progress sweep and both
  // marks' hover scale are fully native now (see `definition` above);
  // pointer wiring is set up separately in the useLayoutEffect below.
  // -----------------------------------------------------------------------
  const seenRingRevealedRef = useRef<Set<number>>(new Set());

   const handleRender = useCallback(({ container }: { container: HTMLElement }) => {
    const { geometryScrubbing: scrubbing } = hoverInputsRef.current;
    if (scrubbing) return;
    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks") as SVGGElement | null;
    if (!marksGroup) return;

    const { data: currData, ringConfigMap: currMap } = hoverInputsRef.current;
    const seen = seenRingRevealedRef.current;

    // Growth: if n shrinks then grows, allow re-reveal of new indices
    // but keep the per-index guard so 2→4 only animates 2,3.
    const toReveal: number[] = [];
    for (let i = 0; i < currData.length; i++) {
      if (seen.has(i)) continue;
      const ringData = currData[i];
      if (!ringData) continue;
      const cfg = currMap.get(i);
      if (!cfg?.animate) {
        seen.add(i);
        continue;
      }
      const tg =
        (marksGroup.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null) ??
        (container.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null);
      if (!tg) continue;
      seen.add(i);
      toReveal.push(i);
    }
    if (toReveal.length === 0) return;

    const svgForBkm = container.querySelector<SVGElement>("svg.ts-chart") as SVGElement | null;
    if (svgForBkm && !svgForBkm.getAttribute("data-bkm-revealed")) {
      svgForBkm.setAttribute("data-bkm-revealed", "1");
    }
    // Hides the marks group for the synchronous gap between resetting the
    // track's inline transform below and its `.animate()` call's
    // `fill:"backwards"` keyframe taking over — same flash-guard as before,
    // now scoped to the track pop alone (progress plays via native motion
    // and isn't reset here, so it only rides along for this same-tick gap).
    marksGroup.classList.add("ts-chart__marks--revealing");

    const resolved = resolveEnterTransition(enterTransitionRef.current, RING_TWEEN_FALLBACK);
    const timing = revealTiming(resolved);
    // T-D3: track's own stagger pass — offset=0, each=0.08*scale*1000
    // (legacy `handleRender`, pre-C3; the progress pass's stagger moved to
    // the native `motion` callback on the progress mark in `definition`).
    const maxDelayMs = Math.max(
      ...toReveal.map((i) => nativeStaggerDelayMs(0.08 * enterStaggerScaleRef.current * 1000, 0, i, "arc")),
    );
    revealDeadlineTimerRef.current = setRevealDeadline(timing.durationMs + maxDelayMs, {
      animationsRef: revealAnimsRef,
      onDeadline: () => {},
    });

    for (const i of toReveal) {
      const trackGroup =
        (marksGroup.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null) ??
        (container.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null);
      if (trackGroup) trackGroup.style.transform = "";
    }

    revealPostPaintCancelRef.current = onPostPaint(() => {
      for (const i of toReveal) {
        const ringData = currData[i];
        if (!ringData) continue;
        // Re-query marksGroup live — TanStack's reconcile may have replaced it
        const liveMarksGroup = container.querySelector<SVGGElement>(".ts-chart__marks") as SVGGElement | null;
        const trackGroup =
          (liveMarksGroup?.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null) ??
          (container.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null);
        const config = currMap.get(i);
        if (!config || !trackGroup) continue;
        const expandDelayMs = nativeStaggerDelayMs(0.08 * enterStaggerScaleRef.current * 1000, 0, i, "arc");

        const expandKeyframes = buildProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` }));
        const expandAnim = trackGroup.animate(expandKeyframes, {
          duration: timing.durationMs,
          delay: expandDelayMs,
          easing: timing.easing,
          fill: "backwards",
        });
        revealAnimsRef.current.push(expandAnim);
        expandAnim.onfinish = () => expandAnim.cancel();
      }
      const liveMarksGroup2 = container.querySelector<SVGGElement>(".ts-chart__marks") as SVGGElement | null;
      liveMarksGroup2?.classList.remove("ts-chart__marks--revealing");
    });
  }, []);

  // -----------------------------------------------------------------------
  // Native focus wiring (C5c, D435): native motion already owns both the
  // progress sweep's entrance and both marks' hover-scale geometry (see
  // `definition` above and file header). Pointer/keyboard DETECTION is now
  // native too — the static hitbox twin's `ChartPoint` (topmost, wins
  // containment) forwards through `onFocusChange` to the SAME coordinator.
  // `RingArcDatum` carries no index field (ring uses per-index `ring-{i}-*`
  // marks, not one multi-row mark like pie), so the index is parsed off
  // `ChartPoint.markId` instead of `datum`.
  // -----------------------------------------------------------------------
  // D473: app-owned hit test against the rest-radius annuli (the geometry
  // the deleted static hitbox twins painted). See pie-chart.tsx for the
  // de-dup rationale (last REQUESTED index, so a same-ring re-entry still
  // cancels a pending coordinator unhover).
  const ringHitBands = useMemo(
    () => data.map((_, i) => ({ ...getRingRadii(i), startAngle, endAngle })),
    [data, getRingRadii, startAngle, endAngle],
  );
  const lastHitRequestRef = useRef<number | null>(null);
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (geometryScrubbing) return;
      const { x, y } = pointerToCenterOffset(event.currentTarget, event.clientX, event.clientY);
      const hit = hitTestPolarBands(x, y, ringHitBands);
      if (hit === lastHitRequestRef.current) return;
      lastHitRequestRef.current = hit;
      if (hit === null) coordinator.requestUnhover();
      else coordinator.requestHover(hit);
    },
    [coordinator, geometryScrubbing, ringHitBands],
  );
  const handlePointerLeave = useCallback(() => {
    if (lastHitRequestRef.current === null) return;
    lastHitRequestRef.current = null;
    coordinator.requestUnhover();
  }, [coordinator]);

  // Cleanup only on actual unmount — NOT on StrictMode double-invoke.
  const isMountedRef = useRef(true);
  useEffect(() => {
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
        for (const anim of revealAnims) {
          try { anim.cancel(); } catch { /* teardown race — already cancelled */ }
        }
        revealAnimsRef.current = [];
      }, 0);
    };
  }, []);

  // size <10 → >=10 fallback: retry handleRender once past first paint if onRender hasn't fired.
  useLayoutEffect(() => {
    if (geometryScrubbing) return;
    if (seenRingRevealedRef.current.size > 0) return;
    const container = containerRef.current;
    if (!container) return;
    const hasAnims = () => {
      for (let i = 0; i < data.length; i++) {
        const el = (container.querySelector(`[data-ts-key="ring-${i}-track"]`) as Element | null);
        if (el && (el as unknown as { getAnimations?: () => Animation[] }).getAnimations?.().length) return true;
      }
      return false;
    };
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (hasAnims()) return;
        if (!container.querySelector(".ts-chart__marks")) return;
        handleRender({ container });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [data.length, geometryScrubbing, handleRender, containerRef]);

  const renderContent = size >= 10;

  return (
    <div
      className={className}
      data-bkm-chart="ring"
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...(fixedSize ? { width: fixedSize, height: fixedSize } : { width: "100%", aspectRatio: "1 / 1" }),
        ...style,
      }}
    >
      {renderContent && (
        <RingStableContext.Provider value={stable}>
          <RingHoverCoordinatorContext.Provider value={coordinator}>
            {geometryScrubbing ? (
              // Scrub mode: plain React SVG paths (same as D51).
              <svg
                aria-hidden="true"
                height={size}
                style={{ contain: "layout style paint" }}
                width={size}
              >
                <g transform={`translate(${center}, ${center})`}>
                  {scrubRingLayers?.map((layer, index) => (
                    <g key={data[index]?.label ?? index}>
                      <path d={layer.bgPath} fill={RING_BACKGROUND} />
                      {layer.progressPath ? <path d={layer.progressPath} fill={layer.color} /> : null}
                    </g>
                  ))}
                </g>
              </svg>
            ) : (
              <RendererChart
                ariaLabel="Ring chart"
                width={size}
                height={size}
                definition={definition}
                onRender={handleRender}
                renderer={chartMotionRenderer<RingArcDatum, number, number>()}
              />
            )}

            {centerChildren.length > 0 && centerVisible && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {centerChildren}
              </div>
            )}
          </RingHoverCoordinatorContext.Provider>
        </RingStableContext.Provider>
      )}
    </div>
  );
}

RingChart.displayName = "RingChart";

// ---------------------------------------------------------------------------
// Ring — config carrier only. Never rendered as a React component in the
// TanStack-native architecture. Exists so JSX `<Ring />` compiles, and
// `displayName` is set for children classification (`displayNameOf` above).
// All props are extracted in `classifyChildren()` and baked into TanStack
// mark definitions.
// ---------------------------------------------------------------------------

export interface RingProps {
  index: number;
  color?: string;
  animate?: boolean;
  showGlow?: boolean;
  lineCap?: RingLineCap;
}

export function Ring(_props: RingProps): null {
  return null;
}

Ring.displayName = "Ring";

// Legacy parity: bklit `ring-chart.tsx` ships `export default RingChart;` (T-E2).
export default RingChart;
