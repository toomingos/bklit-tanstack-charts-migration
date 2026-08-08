// SunburstChart — TanStack-native redo (D82) using stock `radialArc` with a
// custom `generator` instead of the custom `PolarMark` approach.
//
// Architecture:
//   <SunburstSegment> children are config carriers (return null, classified
//   by displayName). A single <Chart> renders ONE `polar()` container with
//   ONE `radialArc()` mark whose custom d3 `arc()` generator computes
//   per-datum inner/outer radii using bklit's own `geometryFor` →
//   `applyHoverGrow` layout math. Opacity is baked into the fill color per
//   datum via `applyAlphaToColor`, so a single mark achieves per-datum
//   opacity without the multi-mark per-depth overhead.
//
// WAAPI zoom: computes keyframes from transitionGeometry and animates
// paths imperatively.
//
// Hover effects (grow, dim): applied imperatively by querying rendered paths
// and writing style properties directly.

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
import {
  createSunburstHoverCoordinator,
  type SunburstHoverCoordinator,
} from "./internal/sunburst-hover-chrome";
import { onPostPaint } from "./internal/deferred-reveal";
import { displayNameOf } from "./children";
import { SunburstCenterOverlay } from "./internal/sunburst-center";
import { SunburstLabelsOverlay } from "./internal/sunburst-labels";
import { SunburstHintDisplay } from "./internal/sunburst-hint";
import "./styles.css";

// ---------------------------------------------------------------------------
// Color helper: converts hex/rgb to rgba with baked alpha.
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
  // CSS variable, named color, or other — use color-mix() to bake alpha
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
  /** Bump to replay the initialization animation. */
  playKey?: number;
  className?: string;
  /** Controlled focus node id for drill-down. */
  focusId?: string;
  /** Called when focus changes via segment click or breadcrumb. */
  onFocusChange?: (focusId: string) => void;
  /** Controlled hover — arc index in the arcs array. */
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  hoverPop?: number;
  /** Inset reserved for hover growth. */
  padding?: number;
  /** Phase tracking for bench/QA harness. */
  onPhaseChange?: (phase: "loading" | "revealing" | "ready") => void;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Flat row type for radialArc — one datum per rendered arc path
// ---------------------------------------------------------------------------

interface SunburstArcRow {
  id: string;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  fill: string;
  /** Stable index for post-render lookups. */
  arcIndex: number;
  /** Absolute depth in the tree (root = 0). */
  depth: number;
  /** Depth relative to current focus (focus depth = 0). */
  relativeDepth: number;
  /** Whether this arc has children (drillable). */
  hasChildren: boolean;
  /** Depth-based base opacity (without hover dimming). */
  baseFillOpacity: number;
}

// ---------------------------------------------------------------------------
// Children classification — SunburstSegment are carrier elements.
// ---------------------------------------------------------------------------

function isSunburstCenterElement(child: ReactNode): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    displayNameOf(child.type as { displayName?: string }) === "SunburstCenter"
  );
}

function isSunburstLabelsElement(child: ReactNode): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    displayNameOf(child.type as { displayName?: string }) === "SunburstLabels"
  );
}

function isSunburstHintElement(child: ReactNode): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    displayNameOf(child.type as { displayName?: string }) === "SunburstHint"
  );
}

function isSunburstSegmentElement(child: ReactNode): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    displayNameOf(child.type as { displayName?: string }) === "SunburstSegment"
  );
}

interface SunburstSegmentConfig {
  arcIndex: number;
  color?: string;
  fill?: string;
  fillOpacity?: number;
}

interface ClassifiedChildren {
  centerChildren: ReactNode[];
  labelsChildren: ReactNode[];
  hintChildren: ReactNode[];
  segmentConfigs: SunburstSegmentConfig[];
}

function classifyChildren(children: ReactNode): ClassifiedChildren {
  const centerChildren: ReactNode[] = [];
  const labelsChildren: ReactNode[] = [];
  const hintChildren: ReactNode[] = [];
  const segmentConfigs: SunburstSegmentConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (isSunburstCenterElement(child)) {
      centerChildren.push(child);
    } else if (isSunburstLabelsElement(child)) {
      labelsChildren.push(child);
    } else if (isSunburstHintElement(child)) {
      hintChildren.push(child);
    } else if (isSunburstSegmentElement(child)) {
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

  return { centerChildren, labelsChildren, hintChildren, segmentConfigs };
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
  const cachedSvgRef = useRef<SVGSVGElement | null>(null);
  const cachedMarkGroupRef = useRef<SVGGElement | null>(null);
  const cachedPathElsRef = useRef<SVGPathElement[]>([]);

  // --- Phase tracking (D84: refactored to Fable/Sonnet gold pattern) ---
  const phaseRef = useRef<"loading" | "revealing" | "ready">("revealing");
  const revealAnimationsRef = useRef<Animation[]>([]);
  const revealEpochRef = useRef(0);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const setPhase = useCallback((p: "loading" | "revealing" | "ready") => {
    if (phaseRef.current === p) return;
    phaseRef.current = p;
    onPhaseChangeRef.current?.(p);
  }, []);

  function setRevealDeadline(deadlineMs: number) {
    const epoch = ++revealEpochRef.current;
    setTimeout(() => {
      if (revealEpochRef.current !== epoch) return;
      for (const anim of revealAnimationsRef.current) anim.cancel();
      revealAnimationsRef.current = [];
      setPhase("ready");
    }, deadlineMs);
  }

  // --- Layout (verbatim bklit math) ---
  const { arcs, maxDepth, focusById, rootId } = useMemo(
    () => buildArcs(data),
    [data],
  );

  const fullRadius = size / 2;
  const growPadding = paddingProp ?? defaultSunburstGrowPadding(maxDepth, size, hoverPop);
  const radius = Math.max(8, fullRadius - growPadding);

  const sortedArcs = useMemo(
    () => [...arcs].sort((a, b) => b.depth - a.depth || b.arcIndex - a.arcIndex),
    [arcs],
  );

  // --- Focus state ---
  const isFocusControlled = focusIdProp !== undefined;
  const [internalFocusId, setInternalFocusId] = useState(rootId);
  const focusId = isFocusControlled ? focusIdProp! : internalFocusId;

  useEffect(() => {
    if (!isFocusControlled) {
      setInternalFocusId(rootId);
    }
  }, [rootId, isFocusControlled]);

  const rootFocus = focusById.get(rootId);
  const focus = focusById.get(focusId) ?? rootFocus;
  if (!(focus && rootFocus)) {
    return null;
  }

  // --- Hover state ---
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
    if (hoveredArcIndex != null) {
      return arcs[hoveredArcIndex] ?? null;
    }
    return null;
  }, [arcs, hoveredArcIndex]);

  // --- Hover coordinator (D84: init-on-null singleton, pie/ring/funnel pattern) ---
  const isHoverControlledRef = useRef(isHoverControlled);
  isHoverControlledRef.current = isHoverControlled;
  const onHoverChangeRef = useRef(onHoverChange);
  onHoverChangeRef.current = onHoverChange;

  const coordinatorRef = useRef<SunburstHoverCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createSunburstHoverCoordinator(
      (index) => onHoverChangeRef.current?.(index),
      () => isHoverControlledRef.current,
    );
  }
  const coordinator = coordinatorRef.current;

  useEffect(() => {
    if (hoveredIndexProp !== undefined) {
      coordinator.setHovered(hoveredIndexProp ?? null);
    }
  }, [hoveredIndexProp, coordinator]);

  // --- Children classification ---
  const { centerChildren, labelsChildren, hintChildren, segmentConfigs } =
    useMemo(() => classifyChildren(children), [children]);

  const segmentConfigMap = useMemo(
    () => new Map(segmentConfigs.map((c) => [c.arcIndex, c])),
    [segmentConfigs],
  );

  // --- Color helpers ---
  const getColor = useCallback(
    (categoryIndex: number, nodeColor?: string) => {
      if (nodeColor) return nodeColor;
      return defaultSunburstColors[
        categoryIndex % defaultSunburstColors.length
      ] as string;
    },
    [],
  );

  const getFill = useCallback(
    (arcIndex: number, fillOverride?: string, colorOverride?: string) => {
      if (fillOverride) return fillOverride;
      const a = arcs[arcIndex];
      if (!a) return defaultSunburstColors[0] as string;
      return (
        colorOverride ?? a.fill ?? a.color ?? getColor(a.categoryIndex)
      );
    },
    [arcs, getColor],
  );

  // --- Zoom ---
  const [zoomT, setZoomT] = useState(1);
  const [prevFocusId, setPrevFocusId] = useState(rootId);
  const prevFocus = focusById.get(prevFocusId) ?? focus;
  const zoomGen = useRef(0);
  const zoomTargetRef = useRef<Focus>(focus);
  const growAnimationsRef = useRef<Map<SVGPathElement, Animation>>(new Map());
  const zoomAnimationsRef = useRef<Set<Animation>>(new Set());
  const prevHoveredArcRef = useRef<ArcDatum | null>(null);

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

      setPrevFocusId(focusId);
      zoomTargetRef.current = toFocus;
      setHoveredArcIndex(null);

      const gen = ++zoomGen.current;

      if (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        setZoomT(1);
        setPrevFocusId(nextId);
        zoomTargetRef.current = toFocus;
        if (isFocusControlled) {
          onFocusChange?.(nextId);
        } else {
          setInternalFocusId(nextId);
        }
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
            if (isFocusControlled) {
              onFocusChange?.(nextId);
            } else {
              setInternalFocusId(nextId);
            }
          }
        }
        requestAnimationFrame(tick);
      });
    },
    [focusId, focus, focusById, isFocusControlled, onFocusChange, setHoveredArcIndex],
  );

  // --- Compute arc rows for radialArc ---
  // One flat datum per visible arc, with pre-computed angles and radii.
  // Sorted depth-descending (inner rings last in DOM for hit-test priority).
  const arcRows = useMemo((): SunburstArcRow[] => {
    const rows: SunburstArcRow[] = [];

    // Hover grow targets
    let growAmountForArc: (id: string) => number = () => 0;
    let expandedThickness = 0;
    if (hoveredArc && focus) {
      const targets = buildHoverGrowTargets(
        arcs,
        hoveredArc,
        focus,
        maxDepth,
        radius,
        hoverPop,
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

      // Apply hover grow to geometry
      const grown = applyHoverGrow(base, a.id, growAmountForArc, expandedThickness);
      const relativeDepth = a.depth - focus.depth;
      const fill = getFill(a.arcIndex, config?.fill, config?.color);
      const baseFillOpacity =
        config?.fillOpacity ?? opacityForRelativeDepth(relativeDepth);

      rows.push({
        id: a.id,
        startAngle: grown.a0,
        endAngle: grown.a1,
        innerRadius: grown.innerR,
        outerRadius: grown.outerR,
        fill,
        arcIndex: a.arcIndex,
        depth: a.depth,
        relativeDepth,
        hasChildren: a.hasChildren,
        baseFillOpacity,
      });
    }

    // Sort depth-descending; tiebreak by arcIndex descending
    rows.sort((a, b) => {
      if (a.depth !== b.depth) return b.depth - a.depth;
      return b.arcIndex - a.arcIndex;
    });

    return rows;
  }, [arcs, focus, maxDepth, radius, segmentConfigMap, getFill, hoveredArc, hoverPop]);

  // --- TanStack definition: single radialArc mark with opacity baked into
  //     the fill color per datum (avoids multi-mark per-depth overhead). ---
  const definition = useMemo(() => {
    return defineChart({
      marks: [
        polar({
          radiusRatio: 1,
          marks: [
            radialArc<SunburstArcRow>(arcRows, {
              id: "sunburst-arcs",
              key: (d) => `sunburst-arc-${d.arcIndex}`,
              generator: () =>
                arc<unknown, SunburstArcRow>()
                  .startAngle((d) => d.startAngle)
                  .endAngle((d) => d.endAngle)
                  .innerRadius((d) => d.innerRadius)
                  .outerRadius((d) => d.outerRadius)
                  .padAngle(0.01),
              fill: (d: SunburstArcRow) => applyAlphaToColor(d.fill, d.baseFillOpacity),
              fillOpacity: 1,
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector<SVGSVGElement>("svg");
    cachedSvgRef.current = svg;
    if (!svg) {
      cachedMarkGroupRef.current = null;
      cachedPathElsRef.current = [];
      return;
    }
    const markGroup = svg.querySelector<SVGGElement>('[data-ts-key="sunburst-arcs"]');
    cachedMarkGroupRef.current = markGroup;
    if (!markGroup) {
      cachedPathElsRef.current = [];
      return;
    }
    const els: SVGPathElement[] = [];
    markGroup.querySelectorAll<SVGPathElement>("[data-ts-key] path").forEach((p) => els.push(p));
    cachedPathElsRef.current = els;
  }, [arcRows]);

  // --- handleRender: deferred WAAPI reveal via onPostPaint (D84 gold pattern) ---
  const revealInputsRef = useRef({
    arcs: null as ArcDatum[] | null,
    sortedArcs: null as ArcDatum[] | null,
    focus: null as Focus | null,
    maxDepth: 0,
    radius: 0,
  });
  revealInputsRef.current = { arcs, sortedArcs, focus, maxDepth, radius };

  const handleRender = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector<SVGSVGElement>("svg");
    if (!svg) return;
    const markGroup = svg.querySelector<SVGGElement>('[data-ts-key="sunburst-arcs"]');
    if (!markGroup || markGroup.dataset.bkmRevealed === "1") return;

    markGroup.dataset.bkmRevealed = "1";
    setPhase("revealing");

    const { arcs: a, sortedArcs: sa, focus: f, maxDepth: md, radius: r } = revealInputsRef.current;
    if (!a || !sa || !f) return;

    const timingList = buildRevealTiming(a);
    const delayByArcId = new Map(timingList.map((t) => [t.arcId, t.delayMs]));
    const pathEls = cachedPathElsRef.current;

    markGroup.classList.add("ts-chart__marks--revealing");

    onPostPaint(() => {
      for (let i = 0; i < sa.length && i < pathEls.length; i++) {
        const arc = sa[i] as ArcDatum;
        const pathEl = pathEls[i] as SVGPathElement;
        if (!pathEl) continue;

        const geom = geometryFor(arc, f, md, r);
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
        revealAnimationsRef.current.push(anim);
      }

      markGroup.classList.remove("ts-chart__marks--revealing");

      // Deadline: max delay + duration + margin
      const maxDelay = timingList.length > 0 ? timingList[timingList.length - 1]!.delayMs : 0;
      const deadlineMs = maxDelay + 1100 + 935;
      setRevealDeadline(deadlineMs);
    });
  }, [setPhase]);

  // --- Hover: consolidated dimming + grow + pointer listeners (D84 gold pattern) ---

  function applyHoverStyles(hoveredArc: ArcDatum | null): void {
    if (!focus) return;
    const pathEls = cachedPathElsRef.current;
    const sa = sortedArcs as ArcDatum[];
    if (pathEls.length === 0) return;

    // Dim via CSS opacity with 0.15s transition (set once, not every frame)
    for (let i = 0; i < sa.length && i < pathEls.length; i++) {
      const a = sa[i] as ArcDatum;
      const pathEl = pathEls[i];
      if (!pathEl) continue;

      // Ensure opacity transition is set (once per path element lifetime)
      if (pathEl.dataset.bkmHoverTransition !== "1") {
        pathEl.dataset.bkmHoverTransition = "1";
        pathEl.style.transition = "opacity 0.15s ease-in-out";
      }

      const isRelated =
        !hoveredArc ||
        a.id === hoveredArc.id ||
        a.id.startsWith(hoveredArc.id + " / ") ||
        hoveredArc.id.startsWith(a.id + " / ");

      pathEl.style.opacity = isRelated ? "1" : "0.25";
    }

    // Grow: WAAPI d-keyframe (420ms cubic-bezier) — prev→current target diff
    const prevHovered = prevHoveredArcRef.current;
    const expandedThickness = maxHoverSegmentThickness(maxDepth, radius, hoverPop);

    const prevTargets = new Map<string, number>();
    if (prevHovered && focus) {
      const targets = buildHoverGrowTargets(
        arcs, prevHovered, focus, maxDepth, radius, hoverPop,
        (d: ArcDatum, hoveredId: string) =>
          d.id === hoveredId || hoveredId.startsWith(`${d.id} / `),
      );
      for (const [k, v] of targets) prevTargets.set(k, v);
    }

    const currentTargets = new Map<string, number>();
    if (hoveredArc && focus) {
      const targets = buildHoverGrowTargets(
        arcs, hoveredArc, focus, maxDepth, radius, hoverPop,
        (d: ArcDatum, hoveredId: string) =>
          d.id === hoveredId || hoveredId.startsWith(`${d.id} / `),
      );
      for (const [k, v] of targets) currentTargets.set(k, v);
    }

    for (let i = 0; i < sa.length && i < pathEls.length; i++) {
      const a = sa[i] as ArcDatum;
      const pathEl = pathEls[i];
      if (!pathEl) continue;

      const baseGeom = geometryFor(a, focus, maxDepth, radius);
      if (!baseGeom) continue;

      const prevGrow = prevTargets.get(a.id) ?? 0;
      const currentGrow = currentTargets.get(a.id) ?? 0;
      if (prevGrow === currentGrow) continue;

      const existing = growAnimationsRef.current.get(pathEl);
      if (existing) {
        existing.cancel();
      }

      const prevGrowFn = (id: string) => prevTargets.get(id) ?? 0;
      const currentGrowFn = (id: string) => currentTargets.get(id) ?? 0;

      const prevGeom = applyHoverGrow(baseGeom, a.id, prevGrowFn, expandedThickness);
      const currentGeom = applyHoverGrow(baseGeom, a.id, currentGrowFn, expandedThickness);

      const dFrom = arcPath(prevGeom, 1, 1);
      const dTo = arcPath(currentGeom, 1, 1);
      if (!dFrom || !dTo) continue;

      const anim = pathEl.animate(
        [
          { d: `path('${dFrom.replace(/'/g, "\\'")}')` },
          { d: `path('${dTo.replace(/'/g, "\\'")}')` },
        ],
        {
          duration: 420,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        },
      );

      anim.onfinish = () => {
        anim.cancel();
      };

      growAnimationsRef.current.set(pathEl, anim);
    }

    prevHoveredArcRef.current = hoveredArc ?? null;
  }

  useLayoutEffect(() => {
    const pathEls = cachedPathElsRef.current;
    if (pathEls.length === 0) return;

    const cleanups: Array<() => void> = [];

    for (let i = 0; i < sortedArcs.length && i < pathEls.length; i++) {
      const a = sortedArcs[i] as ArcDatum;
      const pathEl = pathEls[i];
      if (!pathEl) continue;

      pathEl.style.cursor = a.hasChildren ? "pointer" : "default";

      const onEnter = () => {
        coordinator.requestHover(a.arcIndex);
      };

      const onLeave = () => {
        coordinator.requestUnhover();
      };

      const onClick = () => {
        if (a.hasChildren) {
          zoomTo(a.id);
        }
      };

      pathEl.addEventListener("pointerenter", onEnter);
      pathEl.addEventListener("pointerleave", onLeave);
      pathEl.addEventListener("click", onClick);

      cleanups.push(() => {
        pathEl.removeEventListener("pointerenter", onEnter);
        pathEl.removeEventListener("pointerleave", onLeave);
        pathEl.removeEventListener("click", onClick);
      });
    }

    // Subscribe to coordinator for dimming + grow repaint
    const unsub = coordinator.subscribe(() => {
      const hoveredIdx = coordinator.getHovered();
      const hoveredArc =
        hoveredIdx != null ? (arcs[hoveredIdx] ?? null) : null;
      applyHoverStyles(hoveredArc);
    });

    // Initial paint
    applyHoverStyles(coordinator.getHovered() != null ? (arcs[coordinator.getHovered()!] ?? null) : null);

    return () => {
      unsub();
      for (const cleanup of cleanups) cleanup();
      for (const anim of growAnimationsRef.current.values()) {
        anim.cancel();
      }
      growAnimationsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedArcs.length, focus, maxDepth, radius, hoverPop]);

  // --- Zoom WAAPI tweens ---
  const prevZoomTRef = useRef(zoomT);

  useEffect(() => {
    const wasAtRest = prevZoomTRef.current === 1;
    prevZoomTRef.current = zoomT;

    if (!wasAtRest || zoomT !== 0) return;

    const toF = zoomTargetRef.current;
    if (prevFocus.id === toF.id) return;

    const pathEls = cachedPathElsRef.current;
    if (pathEls.length === 0) return;

    for (const anim of zoomAnimationsRef.current) {
      anim.cancel();
    }
    zoomAnimationsRef.current.clear();

    for (let i = 0; i < sortedArcs.length && i < pathEls.length; i++) {
      const a = sortedArcs[i] as ArcDatum;
      const pathEl = pathEls[i];
      if (!pathEl) continue;

      const keyframes = buildZoomKeyframes(
        a,
        prevFocus,
        toF,
        maxDepth,
        radius,
      );
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

  const centerColor =
    focus.depth === 0
      ? "var(--chart-background)"
      : getColor(focus.categoryIndex);

  // --- Labels ---
  const hasLabels = labelsChildren.length > 0;

  const labelItems = useMemo(() => {
    if (!hasLabels) return [];
    return arcs
      .map((a) => {
        const base = geometryFor(a, focus, maxDepth, radius);
        if (!base) return null;
        const r = geomCentroidRadius(base);
        const angleSpan = base.a1 - base.a0;
        if (angleSpan * r < 26 || base.outerR - base.innerR < 16) return null;

        const isRelated =
          !hoveredArc ||
          a.id === hoveredArc.id ||
          a.id.startsWith(hoveredArc.id + " / ") ||
          hoveredArc.id.startsWith(a.id + " / ");
        if (!isRelated) return null;

        const mid = geomCentroidAngle(base);
        const x = Math.sin(mid) * r;
        const y = -Math.cos(mid) * r;
        let deg = (mid * 180) / Math.PI - 90;
        if (deg > 90) deg -= 180;
        if (deg < -90) deg += 180;
        return { x, y, deg, label: a.name, id: a.id };
      })
      .filter(Boolean) as Array<{
        x: number;
        y: number;
        deg: number;
        label: string;
        id: string;
      }>;
  }, [hasLabels, arcs, focus, maxDepth, radius, hoveredArc]);

  // --- Hint text ---
  const hasHint = hintChildren.length > 0;
  const hintText = (() => {
    if (hoveredArc) {
      return hoveredArc.trail.join("  \u203A  ");
    }
    if (focus.depth === 0) {
      return "Click a segment to zoom in · hover to inspect";
    }
    return "Click the center to zoom out";
  })();

  return (
    <div
      className={className}
      data-bkm-chart="sunburst"
      ref={containerRef}
      style={{ maxWidth: "100%", width: size, position: "relative" }}
    >
      <div
        style={{
          aspectRatio: "1 / 1",
          maxWidth: size,
          position: "relative",
        }}
      >
        <Chart
          ariaLabel={`Sunburst chart of ${data.name}`}
          width={size}
          height={size}
          definition={definition}
          onRender={handleRender}
        />

        {/* SunburstCenter as absolute overlay */}
        <SunburstCenterOverlay
          visible={centerChildren.length > 0 && liveCenterR > 1}
          liveCenterR={liveCenterR}
          centerColor={centerColor}
          onZoomToParent={
            focus.parentId ? () => zoomTo(focus.parentId!) : undefined
          }
        />

        {/* SunburstLabels as SVG overlay */}
        {hasLabels && <SunburstLabelsOverlay items={labelItems} fullRadius={fullRadius} size={size} />}
      </div>

      {/* SunburstHint: outside the chart area, center-aligned */}
      {hasHint && <SunburstHintDisplay text={hintText} />}
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
