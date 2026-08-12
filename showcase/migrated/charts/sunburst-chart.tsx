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
//   The definition includes hover grow — geometry changes go through the
//   TanStack pipeline (arcRows → definition → render → reconcile). Hover dim
//   is imperative CSS opacity on cached path refs. Reveal and zoom use WAAPI.
//
//   WAAPI zoom: computes keyframes from transitionGeometry between prev/next
//   focus states. Focus state changes only AFTER zoom completes (TanStack
//   re-renders with final geometry, no visual jump).
//
//   WAAPI reveal: ring-staggered angular sweep (onPostPaint → per-arc
//   keyframes), bkmRevealed DOM guard prevents re-animation on focus/data
//   changes. Deadline timer → setPhase("ready") for bench settle detection.
//
//   Hover chrome: one consolidated useLayoutEffect subscribes to the hover
//   coordinator and applies dim (CSS opacity from styles.css transition rule)
//   + grow (WAAPI d-keyframe 420ms cubic-bezier) in batch per pointer change.
//   Cached path element refs are populated in handleRender (called during
//   Chart's useLayoutEffect, before our own hover useLayoutEffect fires).

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
} from "./internal/sunburst-reveal";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { displayNameOf } from "./children";
import { SunburstCenterOverlay } from "./internal/sunburst-center";
import { SunburstLabelsOverlay } from "./internal/sunburst-labels";
import { SunburstHintDisplay } from "./internal/sunburst-hint";
import "./styles.css";

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

function isChildOfKind(child: ReactNode, displayName: string): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    displayNameOf(child.type as { displayName?: string }) === displayName
  );
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
  segmentConfigs: SunburstSegmentConfig[];
}

function classifyChildren(children: ReactNode): ClassifiedChildren {
  let centerCount = 0;
  let labelsCount = 0;
  let hintCount = 0;
  const segmentConfigs: SunburstSegmentConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (isChildOfKind(child, "SunburstCenter")) {
      centerCount++;
    } else if (isChildOfKind(child, "SunburstLabels")) {
      labelsCount++;
    } else if (isChildOfKind(child, "SunburstHint")) {
      hintCount++;
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

  return { centerCount, labelsCount, hintCount, segmentConfigs };
}

// ---------------------------------------------------------------------------
// SunburstChart
// ---------------------------------------------------------------------------

export function SunburstChart({
  data,
  size = 520,
  className,
  focusId: focusIdProp,
  onFocusChange,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  hoverPop = 8,
  padding: paddingProp,
  onPhaseChange,
  children,
}: SunburstChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = usePrefersReducedMotion();

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

  const fullRadius = size / 2;
  const growPadding = paddingProp ?? defaultSunburstGrowPadding(maxDepth, size, hoverPop);
  const radius = Math.max(8, fullRadius - growPadding);

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

  const rootFocus = focusById.get(rootId);
  const focus = focusById.get(focusId) ?? rootFocus;
  if (!(focus && rootFocus)) return null;

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
  const { centerCount, labelsCount, hintCount, segmentConfigs } =
    useMemo(() => classifyChildren(children), [children]);

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
  const [zoomT, setZoomT] = useState(1);
  const [prevFocusId, setPrevFocusId] = useState(rootId);
  const prevFocus = focusById.get(prevFocusId) ?? focus;
  const zoomGen = useRef(0);
  const zoomTargetRef = useRef<Focus>(focus);
  const zoomAnimationsRef = useRef<Set<Animation>>(new Set());
  const seenRevealedRef = useRef<Set<number>>(new Set());
  const pendingRevealIds = useRef<Set<number>>(new Set());
  const revealAnimsRef = useRef<Animation[]>([]);

  useEffect(() => {
    setPrevFocusId(rootId);
    setZoomT(1);
    zoomTargetRef.current = focusById.get(rootId) ?? rootFocus!;
  }, [rootId]);

  const zoomTo = useCallback(
    (nextId: string) => {
      if (nextId === focusId) return;
      const toFocus = focusById.get(nextId) ?? focus;
      if (!toFocus) return;

      // If a zoom is in-flight, snapshot the visual midpoint as the new source
      // so rapid A→B clicks don't skip the root ring (audit §4 row1).
      if (zoomT < 1) {
        for (const anim of zoomAnimationsRef.current) anim.cancel();
        zoomAnimationsRef.current.clear();
        // Bump generation so the old rAF loop exits.
        zoomGen.current++;
      }

      setPrevFocusId(focusId);
      zoomTargetRef.current = toFocus;
      setHoveredArcIndex(null);

      const gen = ++zoomGen.current;

      if (prefersReducedMotion) {
        setZoomT(1);
        setPrevFocusId(nextId);
        zoomTargetRef.current = toFocus;
        if (isFocusControlled) onFocusChange?.(nextId);
        else setInternalFocusId(nextId);
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
            setPrevFocusId(nextId);
            zoomTargetRef.current = toFocus;
            if (isFocusControlled) onFocusChange?.(nextId);
            else setInternalFocusId(nextId);
          }
        }
        requestAnimationFrame(tick);
      });
    },
    [focusId, focus, focusById, isFocusControlled, onFocusChange, setHoveredArcIndex],
  );

  // --- Arc rows (static-layout + hover grow baked in) ---
  // Hover grow drives arcRows → definition → TanStack re-render. Geometry changes
  // go through the TanStack pipeline. Only CSS opacity dimming is imperative.
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
      const relativeDepth = a.depth - focus.depth;
      const resolvedFill = getFill(a.arcIndex, config?.fill, config?.color);
      const baseOpacity = config?.fillOpacity ?? opacityForRelativeDepth(relativeDepth);
      const fill = applyAlphaToColor(resolvedFill, baseOpacity);

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
                const gen = (d: SunburstArcRow) =>
                  arcPath({ a0: d.startAngle, a1: d.endAngle, innerR: d.innerRadius, outerR: d.outerRadius }, 1, 1) ?? "";
                // TanStack's WrappedArc type expects these accessors — stub them for type compat
                (gen as any).startAngle = () => gen;
                (gen as any).endAngle = () => gen;
                (gen as any).innerRadius = () => gen;
                (gen as any).outerRadius = () => gen;
                (gen as any).centroid = () => [0, 0];
                (gen as any).padAngle = () => gen;
                (gen as any).cornerRadius = () => gen;
                (gen as any).padRadius = () => gen;
                (gen as any).context = () => gen;
                return gen as any;
              },
              fill: (d) => d.fill,
              stroke: "var(--chart-background)",
              strokeWidth: 1,
            }),
          ],
        }),
      ],
      guides: false,
      x: null,
      y: null,
      focus: focusDisabled,
      tooltip: false,
    });
  }, [arcRows]);

  // --- handleRender: WAAPI reveal + hover dim re-apply (pie/radar pattern) ---
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

    // Re-apply hover dimming after TanStack reconcile (keyed)
    if (hoveredArc) {
      for (const a of sortedArcs) {
        const pathEl = elementMap.get(a.arcIndex);
        if (!pathEl) continue;
        pathEl.style.opacity = isRelatedArc(a, hoveredArc) ? "1" : "0.25";
      }
    }

    if (svgForBkm.dataset.bkmRevealed === "1") return;

    const timingList = buildRevealTiming(arcs);
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
      svgForBkm.dataset.bkmRevealed = "1";
      return;
    }

    if (prefersReducedMotion) {
      svgForBkm.dataset.bkmRevealed = "1";
      setPhase("ready");
      return;
    }

    svgForBkm.dataset.bkmRevealed = "1";
    marksGroup.classList.add("ts-chart__marks--revealing");
    setPhase("revealing");

    const maxDelay = timingList.length > 0 ? timingList[timingList.length - 1]!.delayMs : 0;
    for (const { arc } of toReveal) {
      pendingRevealIds.current.add(arc.arcIndex);
    }
    setRevealDeadline(1100 + maxDelay + 935, {
      animationsRef: revealAnimsRef,
      onDeadline: () => setPhase("ready"),
    });

    onPostPaint(() => {
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
          duration: 1100,
          delay: delayMs,
          easing: "cubic-bezier(0.85,0,0.15,1)",
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
  }, [arcs, sortedArcs, focus, maxDepth, radius, setPhase, hoveredArc, prefersReducedMotion]);

  // --- Hover chrome: CSS opacity dimming + pointer listeners (keyed, pending-gated) ---
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const elementMap = getSunburstPathMap(container);
    if (elementMap.size === 0) return;

    const cleanups: Array<() => void> = [];
    for (const a of sortedArcs) {
      const pathEl = elementMap.get(a.arcIndex);
      if (!pathEl) continue;

      pathEl.style.cursor = a.hasChildren ? "pointer" : "default";

      const arcIndex = a.arcIndex;
      const onEnter = () => {
        if (pendingRevealIds.current.has(arcIndex)) return;
        setHoveredArcIndex(arcIndex);
      };
      const onLeave = () => {
        if (pendingRevealIds.current.has(arcIndex)) return;
        if (hoveredArcIndex === arcIndex) setHoveredArcIndex(null);
      };
      const onClick = () => { if (a.hasChildren) zoomTo(a.id); };

      pathEl.addEventListener("pointerenter", onEnter);
      pathEl.addEventListener("pointerleave", onLeave);
      pathEl.addEventListener("click", onClick);

      cleanups.push(() => {
        pathEl.removeEventListener("pointerenter", onEnter);
        pathEl.removeEventListener("pointerleave", onLeave);
        pathEl.removeEventListener("click", onClick);
      });
    }

    return () => {
      for (const c of cleanups) c();
    };
  }, [sortedArcs, zoomTo, setHoveredArcIndex, hoveredArcIndex]);

  // --- Zoom WAAPI tweens (keyed) ---
  const prevZoomTRef = useRef(zoomT);

  useEffect(() => {
    const wasAtRest = prevZoomTRef.current === 1;
    prevZoomTRef.current = zoomT;
    if (!wasAtRest || zoomT !== 0) return;

    const toF = zoomTargetRef.current;
    if (prevFocus.id === toF.id) return;

    const container = containerRef.current;
    if (!container) return;
    const elementMap = getSunburstPathMap(container);
    if (elementMap.size === 0) return;

    for (const anim of zoomAnimationsRef.current) anim.cancel();
    zoomAnimationsRef.current.clear();

    for (const a of sortedArcs) {
      const pathEl = elementMap.get(a.arcIndex);
      if (!pathEl) continue;

      const keyframes = buildZoomKeyframes(a, prevFocus, toF, maxDepth, radius);
      if (!keyframes || keyframes.length < 2) continue;

      const anim = pathEl.animate(keyframes, {
        duration: 750,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      });
      zoomAnimationsRef.current.add(anim);
    }
  }, [zoomT, sortedArcs, maxDepth, radius, prevFocus]);

  useEffect(() => {
    return () => {
      pendingRevealIds.current.clear();
      for (const anim of revealAnimsRef.current) {
        try { anim.cancel(); } catch {}
      }
      revealAnimsRef.current = [];
      for (const anim of zoomAnimationsRef.current) {
        try { anim.cancel(); } catch {}
      }
      zoomAnimationsRef.current.clear();
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
  const { centerR: liveCenterR } = useMemo(
    () => ringOptions(focus.depth, maxDepth, radius),
    [focus.depth, maxDepth, radius],
  );

  const centerColor = focus.depth === 0
    ? "var(--chart-background)"
    : getColor(focus.categoryIndex);

  // --- Labels: zoom-morphed via transitionGeometry(prevFocus→target, zoomT), hover dimmed not culled.
  const enterDurationMs = 1100;

  const labelItems = useMemo(() => {
    if (labelsCount === 0) return [];
    const inZoom = zoomT < 1;
    const toF = inZoom ? zoomTargetRef.current : focus;
    const fromF = inZoom ? prevFocus : focus;
    return arcs
      .map((a) => {
        const base = inZoom
          ? transitionGeometry(a, fromF, toF, maxDepth, radius, zoomT)
          : geometryFor(a, focus, maxDepth, radius);
        if (!base) return null;
        const r = geomCentroidRadius(base);
        const angleSpan = base.a1 - base.a0;
        if (angleSpan * r < 26 || base.outerR - base.innerR < 16) return null;
        const mid = geomCentroidAngle(base);
        const x = Math.sin(mid) * r;
        const y = -Math.cos(mid) * r;
        let deg = (mid * 180) / Math.PI - 90;
        if (deg > 90) deg -= 180;
        if (deg < -90) deg += 180;
        const dimmed = !!(hoveredArc && !isRelatedArc(a, hoveredArc));
        return { x, y, deg, label: a.name, id: a.id, dimmed };
      })
      .filter(Boolean) as Array<{
        x: number; y: number; deg: number; label: string; id: string; dimmed: boolean;
      }>;
  }, [labelsCount, arcs, focus, prevFocus, maxDepth, radius, hoveredArc, zoomT]);

  const maxRevealDelayMs = useMemo(() => {
    const timing = buildRevealTiming(arcs);
    return timing.length > 0 ? Math.max(...timing.map((t) => t.delayMs)) : 0;
  }, [arcs]);

  const labelsRevealDelayMs = maxRevealDelayMs + enterDurationMs * 0.85;

  const labelRevealAnimsRef = useRef<Animation[]>([]);
  const labelsContainerRef = useRef<SVGSVGElement | null>(null);

  // Deferred label reveal: once per mount, hover/zoom must not restart it.
  useLayoutEffect(() => {
    if (labelsCount === 0) return;
    if (prefersReducedMotion) return;
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
    labelsContainerRef.current = svg;
    if (!svg) return;
    const already = (svg as unknown as HTMLElement & { dataset: DOMStringMap }).dataset.bkmLabelsRevealed === "1";
    if (already) return;
    for (const anim of labelRevealAnimsRef.current) {
      try { anim.cancel(); } catch {}
    }
    labelRevealAnimsRef.current = [];
    const liveSvg = svg;
    onPostPaint(() => {
      // Re-query inside postPaint so we animate the live nodes, dim via CSS after.
      const liveTexts = Array.from(liveSvg.querySelectorAll<SVGTextElement>("text.ts-bkm-sunburst-label"));
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
      (liveSvg as unknown as HTMLElement & { dataset: DOMStringMap }).dataset.bkmLabelsRevealed = "1";
      for (const t of liveSvg.querySelectorAll<SVGTextElement>("text.ts-bkm-sunburst-label")) {
        if (t.isConnected) t.style.opacity = "";
      }
    }, labelsRevealDelayMs + enterDurationMs + 30);
    return () => {
      window.clearTimeout(timer);
      for (const anim of labelRevealAnimsRef.current) {
        try { anim.cancel(); } catch {}
      }
    };
  }, [labelsCount, labelsRevealDelayMs, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      for (const anim of labelRevealAnimsRef.current) {
        try { anim.cancel(); } catch {}
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
      <div style={{ aspectRatio: "1 / 1", maxWidth: size, position: "relative" }}>
        <Chart
          ariaLabel={`Sunburst chart of ${data.name}`}
          width={size}
          height={size}
          definition={definition}
          onRender={handleRender}
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
      {hintCount > 0 && <SunburstHintDisplay text={hintText} />}
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
export { SunburstHint } from "./internal/sunburst-hint";

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
