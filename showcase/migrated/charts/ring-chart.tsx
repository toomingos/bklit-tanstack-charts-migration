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
// * Two-phase WAAPI reveal (track scale-pop + progress sweep) with the
//   "pops in mid-sweep" visibility gating and replay semantics
// * Imperative hover springs (scale 1.03 hovered / 1.02 pushed-out) with
//   two-writer hazard resolved via `settleAtRest()` gate
// * bklit fade + glow DEAD at runtime (empirically verified) — ported as
//   observed pixels, not dead source intent (D19/D49 precedent)
// * `animationDuration` dead prop, `isLoaded`/`animationKey` dead state
// * d3-arc full-circle verification (cornerRadius branch not taken for 2π)
// * RingCenter with real NumberFlow digit-roll (sanctioned D10 exception)
// * Scrub layers bypass marks entirely (TanStack `animate: false`)
// * `spring.ts` REST_DELTA fix (D51)
// * Deferred center mount (D75, setTimeout past M1a doubleRaf clock)
import { Children, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, createContext, useContext, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { polar, radialArc, type PolarMark } from "@tanstack/charts/polar";
import { pieArcPath } from "./internal/pie-geometry";
import { displayNameOf } from "./children";
import {
  createRingHoverCoordinator,
  createRingHoverRuntime,
  type RingHoverCoordinator,
  type RingHoverRuntime,
} from "./internal/ring-hover-chrome";
import {
  buildProgressKeyframes,
  RING_TWEEN_FALLBACK,
  resolveEnterTransition,
  revealTiming,
  type RingEnterTransition,
} from "./internal/ring-reveal";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import "./styles.css";

export type { RingEnterTransition } from "./internal/ring-reveal";

const RING_BACKGROUND = "var(--border)";

const defaultRingColors = [
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

interface RingStableValue {
  data: RingData[];
  size: number;
  center: number;
  strokeWidth: number;
  ringGap: number;
  baseInnerRadius: number;
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

// ---------------------------------------------------------------------------
// Children classification — Ring elements are NOT rendered as React
// components in this revision. Their props are extracted and baked into
// the TanStack `radialArc` marks. RingCenter elements ARE rendered (overlay).
// ---------------------------------------------------------------------------

function isRingElement(child: ReactNode): boolean {
  return isValidElement(child) && typeof child.type === "function" && displayNameOf(child.type as { displayName?: string }) === "Ring";
}

function isRingCenterElement(child: ReactNode): boolean {
  return isValidElement(child) && typeof child.type === "function" && displayNameOf(child.type as { displayName?: string }) === "RingCenter";
}

interface RingChildConfig {
  index: number;
  color?: string;
  animate: boolean;
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

function useMeasuredSize(fixedSize: number | undefined): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  size: number;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
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

  return { containerRef, size: fixedSize ?? Math.min(measured.width, measured.height) };
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

// Per-ring state the imperative layer reads at mount time for WAAPI reveal.
// Tracked by ring index so the hover runtime is looked up by the same key.
// Holds both track+progress group els so the hover runtime can write the
// unified scale transform to the whole band (two sibling marks form one ring).
interface RingImperativeState {
  runtime: RingHoverRuntime;
  trackGroupEl: SVGGElement | null;
  progressGroupEl: SVGGElement | null;
  progressPathEl: SVGPathElement | null;
}

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
  const { containerRef, size } = useMeasuredSize(fixedSize);

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
  const ringConfigsKey = useMemo(
    () =>
      rawClassified.ringConfigs
        .map((c) => `${c.index}:${c.animate ? 1 : 0}:${c.showGlow ? 1 : 0}:${c.lineCap}:${c.color ?? ""}`)
        .join("|"),
    [rawClassified.ringConfigs],
  );
  const ringConfigs = useMemo(() => rawClassified.ringConfigs, [ringConfigsKey]);

  const ringConfigMap = useMemo(
    () => new Map(ringConfigs.map((c) => [c.index, c])),
    [ringConfigs],
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

  const stable: RingStableValue = useMemo(
    () => ({
      data,
      size,
      center,
      strokeWidth,
      ringGap,
      baseInnerRadius,
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
        guides: false, x: null, y: null,
        focus: focusDisabled, tooltip: false,
      });
    }

    const arcMarks: AnyRadialArcMark[] = [];

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

      const trackRow: RingArcDatum = { startAngle, endAngle };
      const progressRow: RingArcDatum = {
        startAngle,
        endAngle: startAngle + arcRange * progress,
      };

      arcMarks.push(
        radialArc<RingArcDatum>([trackRow], {
          id: `ring-${i}-track`,
          key: () => "track",
          innerRadius: ({ radius }) => radius * innerRatio,
          outerRadius: ({ radius }) => radius * outerRatio,
          cornerRadius: ({ radius }) => radius * cornerRatio,
          fill: RING_BACKGROUND,
          opacity: 1,
        }),
      );

      // Skip progress mark when the sweep is effectively empty
      if (progress > 0.001) {
        arcMarks.push(
          radialArc<RingArcDatum>([progressRow], {
            id: `ring-${i}-progress`,
            key: () => "progress",
            innerRadius: ({ radius }) => radius * innerRatio,
            outerRadius: ({ radius }) => radius * outerRatio,
            cornerRadius: ({ radius }) => radius * cornerRatio,
            fill: color,
            opacity: 1,
          }),
        );
      }
    }

    return defineChart({
      marks: [polar({ inset: padding, radiusRatio: 1, marks: arcMarks })],
      guides: false, x: null, y: null,
      focus: focusDisabled, tooltip: false,
    });
  }, [data, ringConfigMap, getRingRadii, getColor, availableRadius, padding, startAngle, endAngle, arcRange, geometryScrubbing]);

  // --- Imperative ring state: one runtime per ring, DOM refs populated
  // after TanStack renders. ---
  const ringStateRef = useRef<Map<number, RingImperativeState>>(new Map());
  const pendingExpandAnimsRef = useRef<Map<number, Animation>>(new Map());
  const revealAnimsRef = useRef<Animation[]>([]);

  // --- WAAPI reveal (handleRender) + hover chrome (useLayoutEffect below).
  // Reveal runs once guarded by the SVG's bkmRevealed DOM attribute; hover
  // chrome is set up separately with stable deps. Both query TanStack's
  // data-ts-key attributes on the rendered SVG groups. ---
  const enterTransitionRef = useRef(enterTransition);
  enterTransitionRef.current = enterTransition;
  const enterStaggerScaleRef = useRef(enterStaggerScale);
  enterStaggerScaleRef.current = enterStaggerScale;

  const hoverInputsRef = useRef({
    data: [] as RingData[],
    ringConfigMap: new Map<number, RingChildConfig>(),
    getRingRadii: (() => ({ innerRadius: 0, outerRadius: 0 })) as (index: number) => { innerRadius: number; outerRadius: number },
    getColor: (() => "") as (index: number) => string,
    startAngle: -Math.PI / 2,
    endAngle: (3 * Math.PI) / 2,
    arcRange: 2 * Math.PI,
    geometryScrubbing: false,
  });
  hoverInputsRef.current = { data, ringConfigMap, getRingRadii, getColor, startAngle, endAngle, arcRange, geometryScrubbing };

  // -----------------------------------------------------------------------
  // handleRender — WAAPI reveal. Animates only rings whose index has NOT yet
  // been seen (Set diff, so growth n=2→4 reveals the 2 new rings without
  // re-animating existing ones). Live DOM queries each invocation — no cached
  // ref that can go stale across growth reconciliations. Hover chrome is set
  // up separately in the useLayoutEffect below.
  // -----------------------------------------------------------------------
  const seenRingRevealedRef = useRef<Set<number>>(new Set());

   const handleRender = useCallback(({ container }: { container: HTMLElement }) => {
    const { geometryScrubbing: scrubbing } = hoverInputsRef.current;
    if (scrubbing) return;
    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks") as SVGGElement | null;
    if (!marksGroup) return;

    const { data: currData, ringConfigMap: currMap, getRingRadii: currGetRadii, startAngle: currStartAngle, arcRange: currArcRange } = hoverInputsRef.current;
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
        ringStateRef.current.get(i)?.runtime.settleAtRest();
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
    marksGroup.classList.add("ts-chart__marks--revealing");

    const resolved = resolveEnterTransition(enterTransitionRef.current, RING_TWEEN_FALLBACK);
    const timing = revealTiming(resolved);
    const maxDelayMs = Math.max(...toReveal.map((i) => (0.6 + i * 0.1) * enterStaggerScaleRef.current * 1000));
    setRevealDeadline(timing.durationMs + maxDelayMs, {
      animationsRef: revealAnimsRef,
      onDeadline: () => {},
    });

    for (const i of toReveal) {
      const trackGroup =
        (marksGroup.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null) ??
        (container.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null);
      if (trackGroup) trackGroup.style.transform = "";
      const progressGroup =
        (marksGroup.querySelector(`[data-ts-key="ring-${i}-progress"]`) as SVGGElement | null) ??
        (container.querySelector(`[data-ts-key="ring-${i}-progress"]`) as SVGGElement | null);
      if (progressGroup) progressGroup.style.transform = "";
      pendingExpandAnimsRef.current.set(i, { cancel() {} } as unknown as Animation);
    }

    onPostPaint(() => {
      for (const i of toReveal) {
        const ringData = currData[i];
        if (!ringData) continue;
        // Re-query marksGroup live — TanStack's reconcile may have replaced it
        const liveMarksGroup = container.querySelector<SVGGElement>(".ts-chart__marks") as SVGGElement | null;
        const liveContainer = container;
        const trackGroup =
          (liveMarksGroup?.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null) ??
          (liveContainer.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null);
        const progressGroup =
          (liveMarksGroup?.querySelector(`[data-ts-key="ring-${i}-progress"]`) as SVGGElement | null) ??
          (liveContainer.querySelector(`[data-ts-key="ring-${i}-progress"]`) as SVGGElement | null);
        const progressPathEl = (progressGroup?.querySelector("path") as SVGPathElement | null) ?? null;
        const config = currMap.get(i);
        if (!config || !trackGroup) continue;
        const { innerRadius, outerRadius } = currGetRadii(i);
        const cornerRadius = config.lineCap === "round" ? (outerRadius - innerRadius) / 2 : 0;
        const progress = ringData.value / ringData.maxValue;
        const expandDelayMs = i * 0.08 * enterStaggerScaleRef.current * 1000;
        const progressDelayMs = (0.6 + i * 0.1) * enterStaggerScaleRef.current * 1000;

        const expandKeyframes = buildProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` }));
        const expandAnim = trackGroup.animate(expandKeyframes, {
          duration: timing.durationMs,
          delay: expandDelayMs,
          easing: timing.easing,
          fill: "backwards",
        });
        pendingExpandAnimsRef.current.set(i, expandAnim);
        revealAnimsRef.current.push(expandAnim);
        const settleForI = () => {
          pendingExpandAnimsRef.current.delete(i);
          ringStateRef.current.get(i)?.runtime.settleAtRest();
        };
        expandAnim.onfinish = () => {
          expandAnim.cancel();
          settleForI();
        };
        expandAnim.oncancel = () => {
          pendingExpandAnimsRef.current.delete(i);
        };

        if (progressGroup && progressPathEl && progress > 0.001) {
          const progressKeyframes = buildProgressKeyframes(timing, (p) => {
            const currentEnd = currStartAngle + currArcRange * progress * p;
            if (currentEnd <= currStartAngle + 0.01) return { d: "none" };
            const d = pieArcPath(innerRadius, outerRadius, currStartAngle, currentEnd, cornerRadius, 0);
            return { d: `path('${d.replace(/'/g, "\\'")}')` };
          });
          const progressAnim = progressPathEl.animate(progressKeyframes, {
            duration: timing.durationMs,
            delay: progressDelayMs,
            easing: timing.easing,
            fill: "backwards",
          });
          revealAnimsRef.current.push(progressAnim);
          progressAnim.onfinish = () => progressAnim.cancel();
          progressAnim.oncancel = () => progressAnim.cancel();
        }
      }
      const liveMarksGroup2 = container.querySelector<SVGGElement>(".ts-chart__marks") as SVGGElement | null;
      liveMarksGroup2?.classList.remove("ts-chart__marks--revealing");
    });
  }, []);

  // -----------------------------------------------------------------------
  // Hover chrome — imperative spring runtimes + pointer listeners attached
  // directly to TanStack-rendered SVG groups. Stable deps so it only re-runs
  // on structural changes, not on every prop identity change. Cleaned up on
  // unmount or when deps change.
  //
  // Two-writer handoff (C1): WAAPI expand owns `transform` until its
  // Animation.finished settles the hover runtime. This effect MUST NOT
  // eagerly settle animated rings that are still mid-reveal — doing so
  // writes inline `scale(1)` and clobbers the running WAAPI animation.
  // Only `animate=false` settles immediately; animated rings settle
  // exclusively via handleRender's expandAnim.onfinish.
  // -----------------------------------------------------------------------
  useLayoutEffect(() => {
    const { geometryScrubbing: scrubbing } = hoverInputsRef.current;
    if (scrubbing) return;
    const container = containerRef.current;
    if (!container) return;
    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
    const svgFallback = container.querySelector("svg");
    if (!marksGroup && !svgFallback) return;

    const stateMap = ringStateRef.current;
    const cleanupMap = new Map<Element, () => void>();

    for (const state of stateMap.values()) {
      state.runtime.stop();
    }
    stateMap.clear();

    const { data: currData, ringConfigMap: currMap, getColor: currGetColor, geometryScrubbing: liveScrubbing } = hoverInputsRef.current;
    // Re-check after clearing — outer closure captured stale scrubbing, live ref is current.
    if (liveScrubbing) return;

    for (let i = 0; i < currData.length; i++) {
      const trackGroup =
        (marksGroup?.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null) ??
        (container.querySelector(`[data-ts-key="ring-${i}-track"]`) as SVGGElement | null);
      const progressGroup =
        (marksGroup?.querySelector(`[data-ts-key="ring-${i}-progress"]`) as SVGGElement | null) ??
        (container.querySelector(`[data-ts-key="ring-${i}-progress"]`) as SVGGElement | null);
      const progressPathEl = (progressGroup?.querySelector("path") as SVGPathElement | null) ?? null;

      if (!trackGroup) continue;

      const config = currMap.get(i);
      const runtime = createRingHoverRuntime();
      const color = config?.color || currGetColor(i);

      runtime.update({
        index: i,
        trackGroupEl: trackGroup,
        progressGroupEl: progressGroup,
        showGlow: config?.showGlow ?? true,
        color,
      });

      stateMap.set(i, {
        runtime,
        trackGroupEl: trackGroup,
        progressGroupEl: progressGroup,
        progressPathEl,
      });

      // Defer settleAtRest until WAAPI expand finishes — otherwise hover's inline scale(1) clobbers the running animation.
      // With deferred onPostPaint, pending is empty until that tick, so also guard on !seen (first mount not yet deferred).
      if (!config?.animate) {
        runtime.settleAtRest();
      } else if (pendingExpandAnimsRef.current.has(i)) {
        // WAAPI owns transform; onfinish will settle.
      } else {
        const alreadySeen = seenRingRevealedRef.current.has(i);
        if (alreadySeen) runtime.settleAtRest();
      }

      // Unified hit area: two sibling marks per ring — the colored progress arc
      // sits on top and would otherwise intercept pointer events, so only the
      // grey crescent behind would be hittable. Make the whole band hittable
      // by (a) letting pointer events pass through the progress mark's group
      // + path, so the track remains the hit target everywhere, AND (b)
      // attaching the same hover listeners to both groups so either path works
      // even if pointer-events semantics change. Single spring still owns both
      // groups' transform (see ring-hover-chrome.ts applyTransform).
      for (const el of [trackGroup, progressGroup] as const) {
        if (!el) continue;
        el.style.cursor = "pointer";
      }
      if (progressGroup) {
        progressGroup.style.pointerEvents = "none";
      }
      if (progressPathEl) {
        (progressPathEl as SVGPathElement).style.pointerEvents = "none";
      }

      const enter = () => coordinator.requestHover(i);
      const leave = () => coordinator.requestUnhover();
      // Primary listener on track (always hittable). Secondary on progress
      // group for resilience — harmless if pointerEvents:none makes it never
      // fire, essential if that style is ever removed.
      trackGroup.addEventListener("pointerenter", enter);
      trackGroup.addEventListener("pointerleave", leave);
      cleanupMap.set(trackGroup, () => {
        trackGroup.removeEventListener("pointerenter", enter);
        trackGroup.removeEventListener("pointerleave", leave);
      });
      if (progressGroup) {
        progressGroup.addEventListener("pointerenter", enter);
        progressGroup.addEventListener("pointerleave", leave);
        // Chain with track cleanup under a single key to keep teardown simple.
        const prevCleanup = cleanupMap.get(trackGroup)!;
        cleanupMap.set(trackGroup, () => {
          prevCleanup();
          progressGroup.removeEventListener("pointerenter", enter);
          progressGroup.removeEventListener("pointerleave", leave);
        });
        // Also register directly so the return cleanup can find either key.
        cleanupMap.set(progressGroup, () => {
          progressGroup.removeEventListener("pointerenter", enter);
          progressGroup.removeEventListener("pointerleave", leave);
        });
      }
    }

    const unsub = coordinator.subscribe(() => {
      const hov = coordinator.getHovered();
      const { ringConfigMap: liveMap, getColor: liveGetColor } = hoverInputsRef.current;
      for (let i = 0; i < currData.length; i++) {
        const state = stateMap.get(i);
        if (!state) continue;
        const config = liveMap.get(i);
        const color = config?.color || liveGetColor(i);
        state.runtime.update({
          index: i,
          trackGroupEl: state.trackGroupEl!,
          progressGroupEl: state.progressGroupEl ?? null,
          showGlow: config?.showGlow ?? true,
          color,
        });
        state.runtime.paint(hov);
      }
    });

    const hov = coordinator.getHovered();
    for (let i = 0; i < currData.length; i++) {
      const state = stateMap.get(i);
      if (!state) continue;
      const config = currMap.get(i);
      const color = config?.color || currGetColor(i);
      state.runtime.update({
        index: i,
        trackGroupEl: state.trackGroupEl!,
        progressGroupEl: state.progressGroupEl ?? null,
        showGlow: config?.showGlow ?? true,
        color,
      });
      state.runtime.paint(hov);
    }

    return () => {
      unsub();
      for (const state of stateMap.values()) {
        state.runtime.stop();
        const trackCleanup = state.trackGroupEl ? cleanupMap.get(state.trackGroupEl) : undefined;
        if (trackCleanup) {
          trackCleanup();
          if (state.trackGroupEl) cleanupMap.delete(state.trackGroupEl);
        }
        const progCleanup = state.progressGroupEl ? cleanupMap.get(state.progressGroupEl) : undefined;
        if (progCleanup) {
          progCleanup();
          if (state.progressGroupEl) cleanupMap.delete(state.progressGroupEl);
        }
      }
    };
  }, [data.length, geometryScrubbing]);

  // Cleanup only on actual unmount — NOT on StrictMode double-invoke.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setTimeout(() => {
        if (isMountedRef.current) return;
        for (const anim of pendingExpandAnimsRef.current.values()) {
          try { anim.cancel(); } catch {}
        }
        pendingExpandAnimsRef.current.clear();
        for (const anim of revealAnimsRef.current) {
          try { anim.cancel(); } catch {}
        }
        revealAnimsRef.current = [];
        for (const state of ringStateRef.current.values()) state.runtime.stop();
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
  }, [data.length, geometryScrubbing, handleRender]);

  const renderContent = size >= 10;

  return (
    <div
      className={className}
      data-bkm-chart="ring"
      ref={containerRef}
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
              <Chart
                ariaLabel="Ring chart"
                width={size}
                height={size}
                definition={definition}
                onRender={handleRender}
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
