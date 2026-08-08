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
// --- Preserved from D49 (all previous findings verified and carried forward)
// * d3 pie() computation — identical config to bklit (`.sort(null)` for QA
//   determinism)
// * PieHoverCoordinator + PieSliceHoverRuntime — imperative hover springs
//   (translate/grow/none effects, fade opacity, no-glow dead code)
// * WAAPI angular sweep reveal (startAngle → endAngle per slice)
// * PieCenter: N+1 variant grid with imperative display toggling
// * bklit glow DEAD at runtime (D49) — ported as observed pixels
// * NumberFlow omission (disclosed D49 deviation — uses Intl.NumberFormat)
// * `className` dead prop on PieSlice (D49 finding)
// * Scrub layers bypass TanStack marks entirely (plain React SVG paths)
// * `<defs>` children (gradients/patterns) rendered in a dedicated hidden SVG
import { pie as d3Pie } from "d3-shape";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { polar, radialArc } from "@tanstack/charts/polar";
import { pieArcPath } from "./internal/pie-geometry";
import { displayNameOf } from "./children";

import {
  createPieHoverCoordinator,
  createPieSliceHoverRuntime,
  type PieHoverCoordinator,
  type PieSliceHoverEffect,
} from "./internal/pie-hover-chrome";
import {
  buildProgressKeyframes,
  PIE_TWEEN_FALLBACK,
  resolveEnterTransition,
  revealTiming,
  type PieEnterTransition,
} from "./internal/pie-reveal";
import {
  PieStableContext,
  PieHoverCoordinatorContext,
  type PieStableValue,
} from "./internal/pie-center";
import "./styles.css";

const pieCleanupMap = new WeakMap<Element, () => void>();

export type { PieSliceHoverEffect } from "./internal/pie-hover-chrome";
export type { PieEnterTransition } from "./internal/pie-reveal";

export const DEFAULT_HOVER_OFFSET = 10;

const defaultPieColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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

interface PieRowDatum {
  startAngle: number;
  endAngle: number;
  fill: string;
  sliceIndex: number;
}

interface PieImperativeState {
  runtime: ReturnType<typeof createPieSliceHoverRuntime>;
  groupEl: SVGPathElement | null;
  pathEl: SVGPathElement | null;
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
  const { containerRef, size } = useMeasuredSize(fixedSize);

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
        guides: false, x: null, y: null,
        focus: focusDisabled, tooltip: false,
      });
    }

    const pieRows: PieRowDatum[] = arcs.map((arc) => {
      const config = sliceConfigMap.get(arc.index);
      return {
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        fill: config?.fill || getFill(arc.index),
        sliceIndex: arc.index,
      };
    });

    const sliceMark = radialArc<PieRowDatum>(pieRows, {
      id: "pie-slices",
      key: (d) => String(d.sliceIndex),
      innerRadius,
      outerRadius: availableRadius,
      cornerRadius: availableRadius > 0 ? cornerRadius : 0,
      fill: (d) => d.fill,
      opacity: 1,
    });

    return defineChart({
      marks: [polar({ inset: hoverOffset, radiusRatio: 1, marks: [sliceMark] })],
      guides: false, x: null, y: null,
      focus: focusDisabled, tooltip: false,
    });
  }, [arcs, sliceConfigMap, getFill, availableRadius, innerRadius, cornerRadius, hoverOffset, geometryScrubbing]);

  // --- Imperative state: one runtime per slice, DOM refs populated after
  // TanStack renders. ---
  const sliceStateRef = useRef<Map<number, PieImperativeState>>(new Map());

  const enterTransitionRef = useRef(enterTransition);
  enterTransitionRef.current = enterTransition;

  const hoverInputsRef = useRef({
    arcs: [] as PieArcData[],
    sliceConfigMap: new Map<number, PieSliceConfig>(),
    innerRadius: 0,
    availableRadius: 0,
    cornerRadius: 0,
    padAngle: 0,
    hoverOffset: 0,
    enterStaggerScale: 1,
    getColor: (() => "") as (index: number) => string,
    getFill: (() => "") as (index: number) => string,
  });
  hoverInputsRef.current = { arcs, sliceConfigMap, innerRadius, availableRadius, cornerRadius, padAngle, hoverOffset, enterStaggerScale, getColor, getFill };

  const sliceElementMapRef = useRef<Map<number, SVGPathElement>>(new Map());

  const handleRender = useCallback(({ container }: { container: HTMLElement }) => {
    if (geometryScrubbing) return;

    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup || marksGroup.dataset.bkmRevealed === "1") return;
    marksGroup.dataset.bkmRevealed = "1";

    const { arcs, sliceConfigMap, innerRadius, availableRadius, cornerRadius, enterStaggerScale } = hoverInputsRef.current;

    // Index-based mapping: TanStack renders radialArc paths in data array
    // order, so pathEls[i] corresponds to arcs[i].index (the sliceIndex).
    const pathEls = Array.from(marksGroup.querySelectorAll("path")) as SVGPathElement[];
    const elementMap = sliceElementMapRef.current;
    elementMap.clear();
    for (let i = 0; i < arcs.length && i < pathEls.length; i++) {
      elementMap.set(arcs[i].index, pathEls[i]);
    }

    const resolved = resolveEnterTransition(enterTransitionRef.current, PIE_TWEEN_FALLBACK);
    const timing = revealTiming(resolved);

    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i] as PieArcData | undefined;
      if (!arc) continue;

      const config = sliceConfigMap.get(i);
      if (!config || !config.animate) continue;

      const pathEl = elementMap.get(i);
      if (!pathEl) continue;

      const delayMs = (0.1 + i * 0.08) * enterStaggerScale * 1000;

      const keyframes = buildProgressKeyframes(timing, (p) => {
        const currentEnd = arc.startAngle + (arc.endAngle - arc.startAngle) * p;
        if (currentEnd <= arc.startAngle + 0.01) {
          return { d: "none" };
        }
        const d = pieArcPath(innerRadius, availableRadius, arc.startAngle, currentEnd, cornerRadius, arc.padAngle);
        return { d: `path('${d.replace(/'/g, "\\'")}')` };
      });

      const anim = pathEl.animate(keyframes, {
        duration: timing.durationMs,
        delay: delayMs,
        easing: timing.easing,
        fill: "backwards",
      });

      anim.onfinish = () => {
        anim.cancel();
        pathEl.style.visibility = "visible";
      };
    }
  }, [geometryScrubbing]);

  useLayoutEffect(() => {
    if (geometryScrubbing) return;
    const container = containerRef.current;
    if (!container) return;
    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup) return;

    const { arcs, sliceConfigMap, innerRadius, availableRadius, cornerRadius, hoverOffset, getColor, getFill } = hoverInputsRef.current;

    const stateMap = sliceStateRef.current;
    for (const state of stateMap.values()) {
      state.runtime.stop();
    }
    for (const state of stateMap.values()) {
      const cleanup = state.groupEl ? pieCleanupMap.get(state.groupEl) : undefined;
      if (cleanup) {
        cleanup();
        pieCleanupMap.delete(state.groupEl!);
      }
    }
    stateMap.clear();

    const elementMap = sliceElementMapRef.current;

    for (let i = 0; i < arcs.length; i++) {
      const pathEl = elementMap.get(i) ?? null;
      const groupEl = pathEl;
      const runtime = createPieSliceHoverRuntime();
      stateMap.set(i, { runtime, groupEl, pathEl });
    }

    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i] as PieArcData | undefined;
      if (!arc) continue;
      const state = stateMap.get(i);
      const config = sliceConfigMap.get(i);
      if (!state || !state.pathEl || !config) continue;

      const sliceHoverOffset = config.hoverOffset ?? hoverOffset;
      const sliceFill = config.fill || getFill(i);

      state.runtime.update({
        index: i,
        visibleEl: state.pathEl,
        innerRadius,
        outerRadius: availableRadius,
        cornerRadius,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        padAngle: arc.padAngle,
        hoverOffset: sliceHoverOffset,
        hoverEffect: config.hoverEffect,
        showGlow: config.showGlow,
        color: getColor(i),
        fill: sliceFill,
      });
      state.runtime.paint(coordinator.getHovered());
    }

    for (let i = 0; i < arcs.length; i++) {
      const state = stateMap.get(i);
      const groupEl = state?.groupEl;
      if (!groupEl) continue;

      groupEl.style.cursor = "pointer";

      const enter = () => coordinator.requestHover(i);
      const leave = () => coordinator.requestUnhover();

      groupEl.addEventListener("pointerenter", enter);
      groupEl.addEventListener("pointerleave", leave);

      pieCleanupMap.set(groupEl, () => {
        groupEl.removeEventListener("pointerenter", enter);
        groupEl.removeEventListener("pointerleave", leave);
      });
    }

    const unsub = coordinator.subscribe(() => {
      const hov = coordinator.getHovered();
      for (let i = 0; i < arcs.length; i++) {
        const state = stateMap.get(i);
        if (!state) continue;
        state.runtime.paint(hov);
      }
    });

    return () => {
      unsub();
      for (const state of stateMap.values()) state.runtime.stop();
      for (const state of stateMap.values()) {
        const cleanup = state.groupEl ? pieCleanupMap.get(state.groupEl) : undefined;
        if (cleanup) {
          cleanup();
          pieCleanupMap.delete(state.groupEl!);
        }
      }
    };
  }, [data.length, geometryScrubbing]);

  // Unmount safety net — stop runtimes, remove listeners.
  // The hover useLayoutEffect return handles normal cleanup; this catches
  // the rare case where the effect hasn't run (e.g., size < 10 early return).
  useEffect(() => {
    return () => {
      const stateMap = sliceStateRef.current;
      for (const state of stateMap.values()) {
        state.runtime.stop();
        const cleanup = state.groupEl ? pieCleanupMap.get(state.groupEl) : undefined;
        if (cleanup) {
          cleanup();
          pieCleanupMap.delete(state.groupEl!);
        }
      }
    };
  }, []);

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
            <Chart
              ariaLabel="Pie chart"
              width={size}
              height={size}
              definition={definition}
              onRender={handleRender}
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
