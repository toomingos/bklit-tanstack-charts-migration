// PieChart — ports repos/bklit-ui/packages/ui/src/charts/{pie-chart,
// pie-slice,pie-context,pie-center}.tsx.
//
// --- Architecture (TanStack-native, PLAN Phase 1.2 redo, D77) ------------
// The previous revision (D49) sidestepped TanStack entirely — plain React
// Context + hand-rolled d3-shape arcs, with one `<PieSlice>` React component
// per datum carrying its own refs, effects, paths, and event handlers. That
// faithfully reproduced bklit's composable-children API but inherited bklit's
// per-component React overhead (~2ms/slice), landing M1a at 12.7ms vs B 15.1ms
// vs T 10.8ms at n=4 (G2 0.56 vs the 0.6 bar on 4.3ms of headroom — D55).
//
// This revision uses the TanStack rendering pipeline directly:
// `radialArc` marks inside a `polar()` container, emitted by `defineChart`
// and rendered by `<Chart>`. The `<PieSlice>` children are classified but never
// rendered as React components — their props are extracted and baked into the
// mark definitions. The WAAPI reveal, imperative hover springs, and
// `PieCenter` overlay are layered on TanStack-rendered DOM via
// `data-ts-key` queries. `focusDisabled` suppresses TanStack's own pointer
// handling so Pie's custom hover owns the surface entirely.
//
// Expected M1a savings: eliminates N × ~2ms per-slice React overhead plus
// per-slice hook registration, context reads, and path computation in React
// render. The SVG rendering moves from React-managed DOM to TanStack's
// optimized scene-graph pipeline (same transformation that took Ring from
// 23.2ms → 13.6ms at n=4, a 41% improvement).
//
// --- C5c (native focus, Phase 6, D435): DOM pointer chrome retired --------
// `focusDisabled` and the `querySelectorAll('path[data-ts-key^="pie-hitbox:"]')`
// + `pointerenter`/`pointerleave` `useLayoutEffect` (both described below and
// in C2's note) are GONE. The static hitbox twin (`hitboxMark`, unchanged)
// now carries native focus instead: `focus` is omitted from `defineChart`
// (library default — pointer resolves the topmost containing interactive
// primitive, which is always the hitbox twin since it paints last), and
// `<RendererChart onFocusChange>` forwards the resolved point's
// `datum.sliceIndex` straight to the SAME `PieHoverCoordinator` used before
// (`requestHover`/`requestUnhover`) — the coordinator, broadcast store, fade,
// and spring geometry are UNCHANGED, only the DOM-query pointer-detection
// layer is gone. `groupEl.style.cursor` writes are replaced by a CSS rule
// (styles.css, reported to the C5c orchestrator — this file cannot own that
// shared stylesheet). Net-new, previously entirely absent: native keyboard
// focus (Tab into the SVG, arrow keys) now also resolves points and fires
// `onFocusChange`, so keyboard users get slice hover-preview + fade for the
// first time. One accepted approximation: `RadialArcOptions` has no API to
// exclude the visible `sliceMark`'s points from native focus/keyboard
// candidacy (dist/polar.d.ts, @tanstack/charts@0.15.0), so keyboard
// arrow-navigation exposes both the visible mark's and the hitbox twin's
// points as separate stops at the same position — pointer hover is
// unaffected (paint-order containment always resolves to the hitbox, which
// is declared last) since it only matters for pointer resolution.
//
// --- Preserved from D49 (all previous findings verified and carried forward)
// * d3 pie() computation — identical config to bklit (`.sort(null)` for QA
//   determinism)
// * PieHoverCoordinator — hover-index state broadcast (still imperative:
//   pointer detection + `requestHover`/`requestUnhover`, C2 below)
// * PieCenter overlay (internal/pie-center.tsx) rendering shared CenterStat
//   (real @number-flow/react digit roll; the D49-era "NumberFlow omission"
//   deviation is resolved — see center-stat.tsx's header)
// * `className` dead prop on PieSlice (D49 finding)
//
// --- C1 (states+legend, Phase 6): fade moved off DOM, glow deleted --------
// Pie uses a native `radialArc` mark (no `states` option — Cartesian-only;
// see polar.d.ts) so the non-hovered-slice fade (bklit: opacity 0.4, 0.15s
// ease-in-out — pie-hover-chrome.ts's original `OPACITY_TRANSITION`, NOT the
// 0.4s figure in some historical docs) can no longer live as an imperative
// `el.style.opacity` write. It now rides a REACTIVE definition instead: a
// tiny `fadeHoveredIndex` React-state slice (below), fed by the existing
// imperative `PieHoverCoordinator` via `subscribe`, drives each row's `fill`
// through `applyAlphaToColor` in the `definition` useMemo — same
// `color-mix()` pattern sunburst-chart.tsx already used for depth opacity,
// necessary because radialArc's `opacity` mark option is a single number for
// the whole mark, not a per-datum channel. bklit's glow (`showGlow`
// drop-shadow) was DEAD at runtime (D49) and is deleted outright by C1, not
// ported.
//
// --- C2 (native motion, Phase 6, D432): WAAPI reveal + hover springs
// deleted, both now native ------------------------------------------------
// `<RendererChart renderer={chartMotionRenderer()}>` replaces `<Chart>`.
// `sliceMark`'s entrance (angular sweep) plays via the mark's own `motion`
// callback — `stagger({each,offset})` reproduces the legacy per-slice delay
// formula (pie-slice.tsx: `(0.1 + dataIndex*0.08) * enterStaggerScale`) — so
// the hand-rolled `handleRender` WAAPI reveal (per-slice `.animate()` with
// sampled `d` keyframes) is GONE outright, not ported. The translate/grow
// hover effects are no longer per-frame `setAttribute('d', …)` writes either:
// `pieRows` (below) computes each slice's live geometry (`dx`/`dy` offset via
// `createOffsetArc`, grown `outerRadius`) REACTIVELY off `fadeHoveredIndex`,
// and `sliceMark.generator` bakes that into the arc `d` — the same
// `{stiffness:400,damping:25}` HOVER_SPRING (pie-hover-chrome.ts) now drives
// the keyed-`d` morph via the mark's `motion` update-phase transition instead
// of `pie-hover-chrome.ts`'s `createSpring` runtime. Only pointer detection
// (hitbox `pointerenter`/`pointerleave` -> `coordinator.requestHover`) stays
// imperative — DOM events have no reactive-definition equivalent.
// * Scrub layers bypass TanStack marks entirely (plain React SVG paths)
// * `<defs>` children (gradients/patterns) rendered in a dedicated hidden SVG
import { pie as d3Pie } from "d3-shape";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { defineChart } from "@tanstack/charts/scene";
import { polar, radialArc } from "@tanstack/charts/polar";
import { stagger } from "@tanstack/charts/motion/definition";
import { pieArcPath, sliceMidOffset } from "./internal/pie-geometry";
import { displayNameOf } from "./children";

import {
  createOffsetArc,
  createPieHoverCoordinator,
  FADE_OPACITY,
  HOVER_SPRING,
  motionEasingFromCss,
  type PieHoverCoordinator,
  type PieSliceHoverEffect,
} from "./internal/pie-hover-chrome";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { hitTestPolarBands, pointerToCenterOffset } from "./internal/polar-hit";
import {
  resolveEnterTransition,
  type PieEnterTransition,
  type ResolvedTiming,
} from "./internal/enter-transition";
import { useDebouncedContainerSize } from "./internal";
import {
  PieStableContext,
  PieHoverCoordinatorContext,
  type PieStableValue,
} from "./internal/pie-center";
import { CHART_CATEGORY_PALETTE } from "./internal/design-tokens";
import "./styles.css";

export type { PieSliceHoverEffect } from "./internal/pie-hover-chrome";
export type { PieEnterTransition } from "./internal/enter-transition";

export const DEFAULT_HOVER_OFFSET = 10;

// T-D15 (P3.1): sourced from the shared 5-entry categorical palette rather
// than a local literal set — see internal/design-tokens.ts. Deliberately NOT
// TanStack's native `defaultChartTheme.palette` (6 entries) — see that
// module's comment for why a 6-long cycle would desync from index 5 on.
export const defaultPieColors: readonly string[] = CHART_CATEGORY_PALETTE;

export interface PieData {
  label: string;
  value: number;
  color?: string;
  fill?: string;
}

export interface PieArcData {
  data: PieData;
  index: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
  value: number;
}


// Children classification — PieSlice elements are NOT rendered as React
// components in this revision. Their props are extracted and baked into the
// TanStack `radialArc` marks. PieCenter elements ARE rendered (overlay).
// Defs children (gradients/patterns) go to a dedicated hidden SVG.
// ---------------------------------------------------------------------------

// C1 (states+legend): bakes the non-hovered-slice fade into the per-datum
// `fill` string (radialArc has no per-datum opacity channel — see file
// header). Same helper/pattern as sunburst-chart.tsx's `applyAlphaToColor`.
function applyAlphaToColor(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

function isPieCenterElement(child: ReactNode): boolean {
  return isValidElement(child) && typeof child.type === "function" && displayNameOf(child.type as { displayName?: string }) === "PieCenter";
}

function isPieSliceElement(child: ReactNode): boolean {
  return isValidElement(child) && typeof child.type === "function" && displayNameOf(child.type as { displayName?: string }) === "PieSlice";
}

function isDefsComponent(child: ReactElement): boolean {
  const name = displayNameOf(child.type as { displayName?: string }) ?? "";
  return (
    name.includes("Gradient") ||
    name.includes("Pattern") ||
    name === "LinearGradient" ||
    name === "RadialGradient"
  );
}

interface PieSliceConfig {
  index: number;
  color?: string;
  fill?: string;
  animate: boolean;
  // Extracted for bklit prop parity (`<PieSlice showGlow={false}>` still
  // compiles/classifies), but unread from here on — C1 deleted the dead
  // glow computation this fed (internal/pie-hover-chrome.ts never rendered
  // it; see that file's header). Same category as PieSlice's dead
  // `className` prop (D49).
  showGlow: boolean;
  hoverEffect: PieSliceHoverEffect;
  hoverOffset?: number;
}

interface ClassifiedChildren {
  centerChildren: ReactNode[];
  defsChildren: ReactElement[];
  sliceConfigs: PieSliceConfig[];
}

function classifyChildren(children: ReactNode, geometryScrubbing: boolean): ClassifiedChildren {
  const centerChildren: ReactNode[] = [];
  const defsChildren: ReactElement[] = [];
  const sliceConfigs: PieSliceConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (isPieCenterElement(child)) {
      centerChildren.push(child);
    } else if (isDefsComponent(child)) {
      defsChildren.push(child);
    } else if (isPieSliceElement(child) && !geometryScrubbing) {
      const props = (child as ReactElement).props as {
        index: number;
        color?: string;
        fill?: string;
        animate?: boolean;
        showGlow?: boolean;
        hoverEffect?: PieSliceHoverEffect;
        hoverOffset?: number;
      };
      sliceConfigs.push({
        index: props.index,
        color: props.color,
        fill: props.fill,
        animate: props.animate !== false,
        showGlow: props.showGlow !== false,
        hoverEffect: props.hoverEffect ?? "translate",
        hoverOffset: props.hoverOffset,
      });
    }
  });

  return { centerChildren, defsChildren, sliceConfigs };
}

// ---------------------------------------------------------------------------
// PieChart
// ---------------------------------------------------------------------------

export interface PieChartProps {
  data: PieData[];
  size?: number;
  innerRadius?: number;
  padAngle?: number;
  cornerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  className?: string;
  style?: CSSProperties;
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  hoverOffset?: number;
  children: ReactNode;
  enterTransition?: PieEnterTransition;
  enterStaggerScale?: number;
  geometryScrubbing?: boolean;
}

interface PieRowDatum {
  startAngle: number;
  endAngle: number;
  fill: string;
  sliceIndex: number;
  // C2 (D432, native motion): per-datum GEOMETRY, reactive on hover state —
  // replaces pie-hover-chrome.ts's imperative per-frame `d` rewrite. `grow`
  // varies `outerRadius`; `translate`/`none` vary `dx`/`dy` (consumed by
  // `createOffsetArc`, since RadialArcOptions has no transform channel).
  // Both a slice's own hover AND every other slice fading in/out share the
  // SAME rebuild (`fadeHoveredIndex` already drives `fill` — this is the
  // same "hover change -> recompute rows -> rebuild definition -> TanStack
  // reconciles" model sunburst-chart.tsx's C1 work established), so no new
  // hover-triggered-reanimation guard is needed beyond the mark's own
  // `motion` callback distinguishing "enter" (stagger sweep) from "update"
  // (hover spring) below.
  innerRadius: number;
  outerRadius: number;
  cornerRadius: number;
  dx: number;
  dy: number;
  /** `PieSlice`'s `animate` prop (default true) — legacy suppressed the
      WAAPI reveal per-slice; native suppression is `motion: false` on the
      enter phase for that datum, read via `ctx.datum.animate` below. */
  animate: boolean;
}

export function PieChart({
  data,
  size: fixedSize,
  innerRadius = 0,
  padAngle = 0,
  cornerRadius = 0,
  startAngle = -Math.PI / 2,
  endAngle = (3 * Math.PI) / 2,
  className,
  style,
  hoveredIndex,
  onHoverChange,
  hoverOffset = DEFAULT_HOVER_OFFSET,
  enterTransition,
  enterStaggerScale = 1,
  geometryScrubbing = false,
  children,
}: PieChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // P9 (bklit ParentSize debounceTime={10}): measurement goes through the
  // debounced width+height hook, same as gauge's G5 call sites. The retired
  // `useMeasuredRect(containerRef, !fixedSize)` passed `enabled` purely to
  // skip mounting a ResizeObserver in fixed mode — an optimization, not
  // behavior: containerRef is attached on BOTH render branches (:757, :774)
  // and `size` falls back to `fixedSize` below, so a measured value in fixed
  // mode is never read.
  const { width, height } = useDebouncedContainerSize(containerRef);
  const size = fixedSize ?? Math.min(width, height);

  // --- Hover coordinator (unchanged from D49) ---
  const isControlledRef = useRef(hoveredIndex !== undefined);
  isControlledRef.current = hoveredIndex !== undefined;
  const onHoverChangeRef = useRef(onHoverChange);
  onHoverChangeRef.current = onHoverChange;

  const coordinatorRef = useRef<PieHoverCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createPieHoverCoordinator(
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

  // C1 (states+legend): the fade's ONLY reactive (React-state) consumer of
  // the coordinator — pointer detection, translate/grow springs, and cursor
  // handling all stay imperative (unchanged, per file header). This drives
  // the per-datum `fill` alpha in `definition` below; a hover change
  // recomputes `pieRows` → rebuilds the definition → TanStack reconciles
  // fresh colors. That rebuild-on-change IS the library's reactive model —
  // there is no per-datum `opacity` VisualChannel on radialArc to hang a
  // "states"-style definition off (polar.d.ts: `opacity` is a single number
  // for the whole mark), so the fade rides `fill` instead, same as
  // sunburst-chart.tsx's depth/hover opacity.
  const [fadeHoveredIndex, setFadeHoveredIndex] = useState<number | null>(() => coordinator.getHovered());
  useEffect(() => coordinator.subscribe(() => setFadeHoveredIndex(coordinator.getHovered())), [coordinator]);

  const totalValue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  const getColor = useCallback(
    (index: number) => data[index]?.color || (defaultPieColors[index % defaultPieColors.length] as string),
    [data],
  );
  const getFill = useCallback(
    (index: number) => data[index]?.fill || getColor(index),
    [data, getColor],
  );

  const arcs = useMemo((): PieArcData[] => {
    const pieGenerator = d3Pie<PieData>()
      .value((d) => d.value)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .padAngle(padAngle)
      .sort(null);
    return pieGenerator(data).map((arc, index) => ({
      data: arc.data,
      index,
      startAngle: arc.startAngle,
      endAngle: arc.endAngle,
      padAngle: arc.padAngle,
      value: arc.value,
    }));
  }, [data, startAngle, endAngle, padAngle]);

  const center = size / 2;
  const outerRadius = center - hoverOffset;

  const scrubSlicePaths = useMemo((): readonly string[] | null => {
    if (!geometryScrubbing) return null;
    return arcs.map((arc) =>
      pieArcPath(innerRadius, outerRadius, arc.startAngle, arc.endAngle, cornerRadius, arc.padAngle),
    );
  }, [geometryScrubbing, arcs, innerRadius, outerRadius, cornerRadius]);

  const { centerChildren, defsChildren, sliceConfigs } = useMemo(
    () => classifyChildren(children, geometryScrubbing),
    [children, geometryScrubbing],
  );

  // Convert slice configs to a lookup map keyed by index — eliminates
  // O(N²) `find()` scans in the definition + imperative effect.
  const sliceConfigMap = useMemo(
    () => new Map(sliceConfigs.map((c) => [c.index, c])),
    [sliceConfigs],
  );

  const stable: PieStableValue = useMemo(
    () => ({
      data,
      arcs,
      size,
      center,
      outerRadius,
      innerRadius,
      padAngle,
      cornerRadius,
      hoverOffset,
      enterTransition,
      enterStaggerScale,
      totalValue,
      getColor,
      getFill,
      geometryScrubbing,
      scrubSlicePaths,
    }),
    [
      data, arcs, size, center, outerRadius, innerRadius, padAngle,
      cornerRadius, hoverOffset, enterTransition, enterStaggerScale,
      totalValue, getColor, getFill, geometryScrubbing, scrubSlicePaths,
    ],
  );

  // --- TanStack definition: ONE radialArc mark with N data rows ---
  // Phase 2.5→2.2 edge case: Pie's per-element overhead is tiny (~0.12ms),
  // so 50 separate marks cost 50× mark-validation. One multi-row mark
  // validates once, generates per-row arcs via per-datum `fill` channel.
  const availableRadius = center - hoverOffset;

  const definition = useMemo(() => {
    if (geometryScrubbing) {
      return defineChart({
        marks: [polar({ inset: hoverOffset, radiusRatio: 1, marks: [] })],
        guides: false, scales: { x: null, y: null },
        tooltip: false,
        // T-D15 (P3.1): explicit 5-entry palette override — see
        // internal/design-tokens.ts. No visible marks in this branch, wired
        // for consistency with the populated branch below.
        theme: { palette: CHART_CATEGORY_PALETTE },
      });
    }

    const pieRows: PieRowDatum[] = arcs.map((arc) => {
      const config = sliceConfigMap.get(arc.index);
      const baseFill = config?.fill || getFill(arc.index);
      // C1 (states+legend): reactive fade — while ANY slice is hovered, every
      // OTHER slice's fill alpha-mixes down to FADE_OPACITY (bklit: 0.4,
      // 0.15s ease-in-out fill transition — see file header). Recomputing
      // this per hover change is the "reactive definition" standing in for
      // `states`, which radialArc doesn't have.
      const isFaded = fadeHoveredIndex !== null && fadeHoveredIndex !== arc.index;
      // C2 (D432, native motion): geometry rides the SAME reactive rebuild
      // as fill — `hoverEffect` per slice picks which of "grow"
      // (outerRadius) or "translate" (dx/dy via createOffsetArc) actually
      // moves; "none" leaves both at rest.
      const isHovered = fadeHoveredIndex === arc.index;
      const effect = config?.hoverEffect ?? "translate";
      const sliceHoverOffset = config?.hoverOffset ?? hoverOffset;
      const growBy = isHovered && effect === "grow" ? sliceHoverOffset : 0;
      const translateDistance = isHovered && effect === "translate" ? sliceHoverOffset : 0;
      const { x: dx, y: dy } = sliceMidOffset(arc.startAngle, arc.endAngle, translateDistance);
      return {
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        fill: isFaded ? applyAlphaToColor(baseFill, FADE_OPACITY) : baseFill,
        sliceIndex: arc.index,
        innerRadius,
        outerRadius: availableRadius + growBy,
        cornerRadius: availableRadius > 0 ? cornerRadius : 0,
        dx,
        dy,
        animate: config?.animate ?? true,
      };
    });

    const sliceMark = radialArc<PieRowDatum>(pieRows, {
      id: "pie-slices",
      key: (d) => String(d.sliceIndex),
      // C2 (D432): per-datum geometry (grow radius AND translate offset)
      // replaces the mark-level innerRadius/outerRadius/cornerRadius used
      // pre-C2 — `generator` is the confirmed mechanism for this (sunburst
      // C1 precedent, sunburst-chart.tsx:636-646); `createOffsetArc`
      // (pie-hover-chrome.ts) additionally lets the SAME generator express
      // the translate hover effect, which RadialArcOptions has no channel
      // for on its own.
      generator: () => {
        const gen = createOffsetArc<PieRowDatum>((d) => ({ dx: d.dx, dy: d.dy }));
        gen
          .startAngle((d) => d.startAngle)
          .endAngle((d) => d.endAngle)
          .innerRadius((d) => d.innerRadius)
          .outerRadius((d) => d.outerRadius)
          .cornerRadius((d) => d.cornerRadius);
        return gen;
      },
      fill: (d) => d.fill,
      opacity: 1,
      // C2 (D432): "enter" keeps the legacy per-slice angular-sweep stagger
      // (this file's pre-C5 handleRender / bklit pie-slice.tsx: offset
      // 0.1s, each 0.08s, scaled by enterStaggerScale) via native
      // `stagger()` — the renderer's default transition (1100ms tween)
      // already equals REVEAL_DURATION_MS/REVEAL_EASE_CSS (design-tokens.ts
      // T-D1), so only the delay needs authoring UNLESS a caller passes an
      // explicit `enterTransition` override, which replaces duration/easing
      // AND (authored delay replaces automatic stagger) the per-slice delay
      // outright. Every OTHER phase — hover grow/translate AND ordinary
      // data-value changes, which `ChartMotionContext` cannot distinguish —
      // uses HOVER_SPRING (pie-hover-chrome.ts, bklit's own
      // {stiffness:400,damping:25}): a documented, low-risk deviation from
      // legacy (which never animated plain data-value changes at all,
      // per-slice reveal was gated by a mount-only `seen` set) since a
      // responsive spring is strictly an enhancement over an un-animated
      // snap, and hover fidelity — the actually-legacy-matching case — is
      // now driven natively instead of a per-frame `setAttribute('d', …)`.
      motion: (ctx) => {
        if (ctx.phase !== "enter") {
          return {
            transition: { type: "spring", stiffness: HOVER_SPRING.stiffness, damping: HOVER_SPRING.damping },
          };
        }
        if (ctx.datum && !ctx.datum.animate) return false;
        if (enterTransition) {
          const resolved: ResolvedTiming = resolveEnterTransition(enterTransition);
          return {
            transition:
              resolved.kind === "spring"
                ? { type: "spring", stiffness: resolved.stiffness, damping: resolved.damping, mass: resolved.mass }
                : {
                    type: "tween",
                    duration: resolved.durationMs,
                    // ChartMotionTweenTransition['easing'] takes a named
                    // keyword or a progress function — never a raw CSS
                    // string — so `resolved.easingCss` (always a
                    // `cubic-bezier(...)` string, see resolveEnterTransition)
                    // is converted via motionEasingFromCss (pie-hover-chrome.ts).
                    easing: motionEasingFromCss(resolved.easingCss),
                  },
          };
        }
        return stagger({ each: 80 * enterStaggerScale, offset: 100 * enterStaggerScale, phase: "enter" });
      },
    });


    return defineChart({
      marks: [polar({ inset: hoverOffset, radiusRatio: 1, marks: [sliceMark] })],
      guides: false, scales: { x: null, y: null },
      // D473 (6.5 gate, supersedes C5c/D447): pointer detection is app-owned
      // again (`pointer: false` + the wrapper's pointer handlers below,
      // resolved against the static authored geometry via
      // internal/polar-hit.ts). Native focus at 0.15.0 re-resolves the
      // pointer against the motion surface's IN-FLIGHT presentation points on
      // every definition update, so the hover-driven rebuild lost the hit,
      // emitted `onFocusChange(null)`, and the unhover rebuild re-hit it —
      // an unbounded hover/unhover loop (React #185). `focusRing: false`
      // stays: the reactive grow/translate/fade geometry above IS pie's
      // authored focus treatment.
      pointer: false, focusRing: false, tooltip: false,
      // T-D15 (P3.1): explicit 5-entry palette override, NOT the native
      // 6-entry defaultChartTheme.palette (see internal/design-tokens.ts).
      // Every row already carries an explicit per-datum `fill` (getFill
      // above), so this has no pixel effect today — it exists so any native
      // surface that reads the resolved theme's palette (rather than a
      // per-datum channel) agrees with the JS-side color, and to route this
      // part through the theme system per T-D15's contract.
      theme: { palette: CHART_CATEGORY_PALETTE },
    });
  }, [
    arcs, sliceConfigMap, getFill, availableRadius, innerRadius, cornerRadius, hoverOffset,
    geometryScrubbing, fadeHoveredIndex, enterTransition, enterStaggerScale,
  ]);

  // --- App-owned pointer detection (D473, supersedes C5c/D435): native
  // motion (C2, D432) still owns entrance reveal and the hover
  // grow/translate/fade geometry (reactive via `pieRows` ->
  // `fadeHoveredIndex`). Detection hit-tests the pointer against the STATIC
  // rest geometry — the same annulus the legacy transparent hitbox path
  // painted (bklit pie-slice.tsx) — so band growth can never eject a
  // stationary cursor, and no renderer DOM is touched. Requests are
  // de-duplicated on the last REQUESTED index (not `getHovered()`), so a
  // leave→re-enter of the same slice still cancels the coordinator's
  // pending unhover.
  const pieHitBands = useMemo(
    () => arcs.map((arc) => ({ innerRadius, outerRadius: availableRadius, startAngle: arc.startAngle, endAngle: arc.endAngle })),
    [arcs, innerRadius, availableRadius],
  );
  const lastHitRequestRef = useRef<number | null>(null);
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (geometryScrubbing) return;
      const { x, y } = pointerToCenterOffset(event.currentTarget, event.clientX, event.clientY);
      const hit = hitTestPolarBands(x, y, pieHitBands);
      if (hit === lastHitRequestRef.current) return;
      lastHitRequestRef.current = hit;
      if (hit === null) coordinator.requestUnhover();
      else coordinator.requestHover(hit);
    },
    [coordinator, geometryScrubbing, pieHitBands],
  );
  const handlePointerLeave = useCallback(() => {
    if (lastHitRequestRef.current === null) return;
    lastHitRequestRef.current = null;
    coordinator.requestUnhover();
  }, [coordinator]);

  if (size < 10) {
    return (
      <div
        className={className}
        data-bkm-chart="pie"
        ref={containerRef}
        style={{
          ...(fixedSize ? { width: fixedSize, height: fixedSize } : { width: "100%", aspectRatio: "1 / 1" }),
          ...style,
        }}
      />
    );
  }

  return (
    <div
      className={className}
      data-bkm-chart="pie"
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
      <PieStableContext.Provider value={stable}>
        <PieHoverCoordinatorContext.Provider value={coordinator}>
          {/* Dedicated hidden SVG for gradient/pattern <defs> children.
              url(#id) references resolve across SVG trees in the same
              document (Chrome 52+, FF, Safari all support this). */}
          {defsChildren.length > 0 && (
            <svg width={0} height={0} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
              <defs>{defsChildren}</defs>
            </svg>
          )}

          {geometryScrubbing ? (
            <svg
              aria-hidden="true"
              height={size}
              style={{ contain: "layout style paint" }}
              width={size}
            >
              {defsChildren.length > 0 && <defs>{defsChildren}</defs>}
              <g transform={`translate(${center}, ${center})`}>
                {scrubSlicePaths?.map((d, index) =>
                  d ? (
                    <path
                      d={d}
                      fill={getFill(index)}
                      key={data[index]?.label ?? index}
                      pointerEvents="none"
                    />
                  ) : null,
                )}
              </g>
            </svg>
          ) : (
            <RendererChart
              ariaLabel="Pie chart"
              width={size}
              height={size}
              definition={definition}
              renderer={chartMotionRenderer<PieRowDatum, number, number>()}
            />
          )}

          {centerChildren.length > 0 && (
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
        </PieHoverCoordinatorContext.Provider>
      </PieStableContext.Provider>
    </div>
  );
}

PieChart.displayName = "PieChart";

// ---------------------------------------------------------------------------
// PieSlice — config carrier only. Never rendered as a React component in
// the TanStack-native architecture. Exists so JSX `<PieSlice />` compiles,
// and `displayName` is set for children classification (`displayNameOf`).
// All props are extracted in `classifyChildren()` and baked into TanStack
// mark definitions.
// ---------------------------------------------------------------------------

export interface PieSliceProps {
  index: number;
  color?: string;
  fill?: string;
  animate?: boolean;
  showGlow?: boolean;
  hoverEffect?: PieSliceHoverEffect;
  hoverOffset?: number;
  className?: string;
}

export function PieSlice(_props: PieSliceProps): null {
  return null;
}

PieSlice.displayName = "PieSlice";

// Legacy parity: bklit `pie-chart.tsx` ships `export default PieChart;` (T-E2).
export default PieChart;
