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
import { arc } from "d3-shape";
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
import { onPostPaint } from "./internal/deferred-reveal";
import { displayNameOf } from "./children";
import { SunburstCenterOverlay } from "./internal/sunburst-center";
import { SunburstLabelsOverlay } from "./internal/sunburst-labels";
import { SunburstHintDisplay } from "./internal/sunburst-hint";
import "./styles.css";

// ---------------------------------------------------------------------------
// Color helper — bakes alpha into fill color string.
// radialArc's fillOpacity is `number` (static), not VisualChannel.
// ---------------------------------------------------------------------------

function applyAlphaToColor(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `,${alpha})`);
  }
  const pct = Math.round(alpha * 100);
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
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

  // --- Phase tracking ---
  const phaseRef = useRef<"loading" | "revealing" | "ready">("revealing");
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const setPhase = useCallback((p: "loading" | "revealing" | "ready") => {
    if (phaseRef.current === p) return;
    phaseRef.current = p;
    onPhaseChangeRef.current?.(p);
  }, []);

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
      const prefersReducedMotion =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
        (d: ArcDatum, hoveredId: string) =>
          d.id === hoveredId || hoveredId.startsWith(`${d.id} / `),
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
                const base = arc<unknown, SunburstArcRow>()
                  .startAngle((d) => d.startAngle)
                  .endAngle((d) => d.endAngle)
                  .innerRadius((d) => d.innerRadius)
                  .outerRadius((d) => d.outerRadius)
                  .padAngle(0.01);
                // Wrap so path strings use bklit's arcPath (byte-identical to bklit SVG)
                const wrapped = function (this: any, d: SunburstArcRow, ...args: any[]) {
                  return arcPath(
                    { a0: d.startAngle, a1: d.endAngle, innerR: d.innerRadius, outerR: d.outerRadius },
                    1,
                    1,
                  ) ?? (base as any)(d, ...args);
                } as any;
                wrapped.startAngle = base.startAngle;
                wrapped.endAngle = base.endAngle;
                wrapped.innerRadius = base.innerRadius;
                wrapped.outerRadius = base.outerRadius;
                wrapped.centroid = base.centroid;
                wrapped.padAngle = base.padAngle;
                wrapped.cornerRadius = base.cornerRadius;
                wrapped.padRadius = base.padRadius;
                wrapped.context = base.context;
                return wrapped;
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

  // --- handleRender: WAAPI reveal + hover dim re-apply ---
  const handleRender = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const markGroup = container.querySelector<SVGGElement>('[data-ts-key="sunburst-arcs"]');
    if (!markGroup) return;

    const byKey = new Map<string, SVGPathElement>();
    markGroup.querySelectorAll<SVGPathElement>("[data-ts-key] path").forEach((p) => {
      const key = p.closest("[data-ts-key]")?.getAttribute("data-ts-key") ?? p.getAttribute("data-ts-key") ?? "";
      if (key) byKey.set(key, p);
      else {
        // Fallback: path itself may carry the key.
        const alt = p.getAttribute("data-ts-key") ?? "";
        if (alt) byKey.set(alt, p);
      }
    });
    // Also index leaf keys: TanStack emits per-arc keys like sunburst-arc-N under the mark group.
    // Use a fallback order map only if key lookup misses (preserves visual even if key encoding drifts).
    const elsByOrder: SVGPathElement[] = [];
    if (byKey.size === 0) {
      markGroup.querySelectorAll<SVGPathElement>("[data-ts-key] path").forEach((p) => elsByOrder.push(p));
    }

    // Re-apply hover dimming after TanStack reconcile (keyed, not positional)
    if (hoveredArc) {
      for (let i = 0; i < sortedArcs.length; i++) {
        const a = sortedArcs[i] as ArcDatum;
        const key = `sunburst-arc-${a.arcIndex}`;
        const pathEl = byKey.get(key) ?? (byKey.size === 0 ? elsByOrder[i] : undefined);
        if (!pathEl || !a) continue;
        const isRelated =
          a.id === hoveredArc.id ||
          a.id.startsWith(hoveredArc.id + " / ") ||
          hoveredArc.id.startsWith(a.id + " / ");
        pathEl.style.opacity = isRelated ? "1" : "0.25";
      }
    }

    // WAAPI reveal (first render only — DOM guard prevents re-animation)
    if (markGroup.getAttribute("data-bkm-revealed") === "1") return;
    markGroup.setAttribute("data-bkm-revealed", "1");

    setPhase("revealing");

    const timingList = buildRevealTiming(arcs);
    const delayByArcId = new Map(timingList.map((t) => [t.arcId, t.delayMs]));

    markGroup.classList.add("ts-chart__marks--revealing");

    onPostPaint(() => {
      for (let i = 0; i < sortedArcs.length; i++) {
        const arc = sortedArcs[i] as ArcDatum;
        const key = `sunburst-arc-${arc.arcIndex}`;
        const pathEl = byKey.get(key) ?? (byKey.size === 0 ? elsByOrder[i] : undefined);
        if (!pathEl || !arc) continue;

        const geom = geometryFor(arc, focus, maxDepth, radius);
        if (!geom) continue;

        const keyframes = buildRevealKeyframes(geom);
        if (!keyframes || keyframes.length < 2) continue;

        const delayMs = delayByArcId.get(arc.id) ?? 0;
        pathEl.style.visibility = "hidden";
        const anim = pathEl.animate(keyframes, {
          duration: 1100,
          delay: delayMs,
          easing: "cubic-bezier(0.85,0,0.15,1)",
          fill: "backwards",
        });
        anim.onfinish = () => {
          pathEl.style.visibility = "visible";
        };
      }

      markGroup.classList.remove("ts-chart__marks--revealing");

      const maxDelay = timingList.length > 0 ? timingList[timingList.length - 1]!.delayMs : 0;
      const deadlineMs = maxDelay + 1100 + 935;
      setTimeout(() => setPhase("ready"), deadlineMs);
    });
  }, [arcs, sortedArcs, focus, maxDepth, radius, setPhase, hoveredArc]);

  // --- Hover chrome: CSS opacity dimming + pointer listeners ---
  // Grow geometry is baked into arcRows → TanStack renders it.
  // CSS opacity dimming is imperative on cached path refs.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const byKeyHover = new Map<string, SVGPathElement>();
    container.querySelectorAll<SVGPathElement>('[data-ts-key="sunburst-arcs"] path').forEach((p) => {
      const k = p.closest("[data-ts-key]")?.getAttribute("data-ts-key") ?? p.getAttribute("data-ts-key") ?? "";
      if (k) byKeyHover.set(k, p);
    });
    const pathElsOrder: SVGPathElement[] = byKeyHover.size === 0
      ? Array.from(container.querySelectorAll<SVGPathElement>('[data-ts-key="sunburst-arcs"] path'))
      : [];
    if (byKeyHover.size === 0 && pathElsOrder.length === 0) return;

    const cleanups: Array<() => void> = [];
    for (let i = 0; i < sortedArcs.length; i++) {
      const a = sortedArcs[i] as ArcDatum;
      const key = `sunburst-arc-${a.arcIndex}`;
      const pathEl = byKeyHover.get(key) ?? (byKeyHover.size === 0 ? pathElsOrder[i] : undefined);
      if (!pathEl || !a) continue;

      pathEl.style.cursor = a.hasChildren ? "pointer" : "default";

      const onEnter = () => setHoveredArcIndex(a.arcIndex);
      const onLeave = () => setHoveredArcIndex(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedArcs.length, focus, maxDepth, radius, hoverPop, zoomTo]);

  // --- Zoom WAAPI tweens ---
  const prevZoomTRef = useRef(zoomT);

  useEffect(() => {
    const wasAtRest = prevZoomTRef.current === 1;
    prevZoomTRef.current = zoomT;
    if (!wasAtRest || zoomT !== 0) return;

    const toF = zoomTargetRef.current;
    if (prevFocus.id === toF.id) return;

    const byKeyZoom = new Map<string, SVGPathElement>();
    containerRef.current?.querySelectorAll<SVGPathElement>('[data-ts-key="sunburst-arcs"] path').forEach((p) => {
      const k = p.closest("[data-ts-key]")?.getAttribute("data-ts-key") ?? p.getAttribute("data-ts-key") ?? "";
      if (k) byKeyZoom.set(k, p);
    });
    const orderZoom: SVGPathElement[] = byKeyZoom.size === 0
      ? Array.from(containerRef.current?.querySelectorAll<SVGPathElement>('[data-ts-key="sunburst-arcs"] path') ?? [])
      : [];
    if (byKeyZoom.size === 0 && orderZoom.length === 0) return;

    for (const anim of zoomAnimationsRef.current) anim.cancel();
    zoomAnimationsRef.current.clear();

    for (let i = 0; i < sortedArcs.length; i++) {
      const a = sortedArcs[i] as ArcDatum;
      const key = `sunburst-arc-${a.arcIndex}`;
      const pathEl = byKeyZoom.get(key) ?? (byKeyZoom.size === 0 ? orderZoom[i] : undefined);
      if (!pathEl || !a) continue;

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

  // --- Center circle geometry ---
  const { centerR: liveCenterR } = useMemo(
    () => ringOptions(focus.depth, maxDepth, radius),
    [focus.depth, maxDepth, radius],
  );

  const centerColor = focus.depth === 0
    ? "var(--chart-background)"
    : getColor(focus.categoryIndex);

  // --- Labels ---
  const labelItems = useMemo(() => {
    if (labelsCount === 0) return [];
    return arcs
      .map((a) => {
        const base = geometryFor(a, focus, maxDepth, radius);
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
        return { x, y, deg, label: a.name, id: a.id };
      })
      .filter(Boolean) as Array<{
        x: number; y: number; deg: number; label: string; id: string;
      }>;
  }, [labelsCount, arcs, focus, maxDepth, radius]);

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
