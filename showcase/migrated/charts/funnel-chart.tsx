// FunnelChart (both orientations) — ports
// repos/bklit-ui/packages/ui/src/charts/funnel-chart.tsx.
//
// --- Why this is plain SVG, not a TanStack `defineChart`/custom mark -------
// docs/LOG.md D30 confirms FunnelChart is a GAP chart (TanStack has no
// funnel primitive) and describes a binding architecture built around a
// custom `createMark` placed directly in `defineChart({marks:[...], x:null,
// y:null, guides:false})`'s flat `marks` array (no cartesian/polar wrapper
// exists to put it in — verified: `cartesian(` doesn't exist anywhere in
// repos/tanstack-charts/packages/charts-core). Having built that mark, the
// ONLY things `defineChart`/`<Chart>` would actually contribute are: (a) one
// resize-observed SVG root, (b) `MarkRenderContext.chart` giving width/height
// (bklit's own `ResizeObserver` measurement already gives the same numbers),
// and (c) keyed DOM reconciliation via `data-ts-key` (bklit's segments are
// keyed by `stage.label` in PLAIN REACT already — reconciliation is free).
// Funnel's entire geometry is 100% pixel arithmetic with NO scale/domain
// anywhere (`hSegmentPath`/`vSegmentPath` take raw pixel norms/dimensions
// directly, per D30's own formulas) — there is no cartesian/polar layout
// concept for `defineChart` to resolve at all, the EXACT justification
// gauge.tsx's `GaugeLinear` used for its own plain-SVG fallback (its header:
// "no cartesian domain exists ... each notch's slot position is
// i*(slotWidth+gapWidth), not a data-driven x/y value pair"). Wrapping a
// custom mark in `<Chart>` here would add an SVG layer, a scene-diff pass,
// and `data-ts-key` bookkeeping purely to re-derive numbers this component
// already computes directly from its own `ResizeObserver`, for zero
// behavioral benefit — so this file follows the D30-authorized escape
// clause ("if a cartesian container fights the port, the ring/pie/
// gauge-linear plain-SVG fallback is allowed") and ports bklit's own
// plain-SVG/div structure directly, same as ring.tsx/pie-chart.tsx/
// GaugeLinear. FLAGGED FOR FABLE per this deliverable's own instruction —
// every other D30 binding-architecture requirement (explicit cubic-Bézier
// `path` strings, one node PER HALO RING per segment, ZERO ChartPoints,
// native-listener hover, WAAPI tween reveal) is still satisfied verbatim,
// just without the `<Chart>`/`defineChart` wrapper itself.
//
// --- Hover chrome architecture (PieSlice precedent, pie-chart.tsx) --------
// Each rendered stage is a real, individually-mounted `FunnelSegment`
// component (not a mark-reconciled scene node) with its own stable lifetime,
// so it owns ONE `FunnelSegmentHoverRuntime` (internal/funnel-hover-chrome.ts,
// created once via a ref) that subscribes to ONE stable, chart-level
// `FunnelHoverCoordinator` (also created once via a ref, passed down as a
// plain prop — no context needed, since `FunnelChart` maps `data` directly
// into `FunnelSegment` itself; there is no bklit-style user-authored
// `<FunnelSegment>` children API to support, unlike Pie's compositional
// surface). Zero React state and zero framer-motion in the pointer path
// (docs/LOG.md D10): the pointer target (bklit's per-stage label overlay
// div) calls `coordinator.requestHover(index)`/`requestUnhover()` directly;
// every mounted segment repaints imperatively from the coordinator's
// broadcast, matching PieSlice's `subscribe`/`paint` wiring exactly.
//
// --- One `FunnelSegment`, not bklit's HSegment/VSegment/SegmentLabel split -
// bklit splits the ring graphic (`HSegment`/`VSegment`) and the hover-target
// label overlay (`SegmentLabel`, mapped separately at the `FunnelChart`
// level) into different components/passes because framer's per-effect
// MotionValue shapes and its OWN separate `motion.div` for the label overlay
// made that the natural split — not because of any hook-order requirement.
// This port merges both into ONE `FunnelSegment` per stage (same
// "one component, not several" simplification pie-chart.tsx's header already
// documents for `PieSlice`), positioning the ring graphic AND the label
// overlay as two absolutely-positioned children of the SAME per-stage box
// (`funnelSegBox` — the identical `(segW+gap)*i` / `(segH+gap)*i` formula
// bklit itself uses for both its flex-flowed segments container AND its
// independently-absolute-positioned label overlays, so the two layouts are
// numerically identical positions already; this is a mechanism
// simplification, not a visual one). Z-stacking is preserved via the exact
// same z-index values bklit assigns (ring graphic: 1, 10 while hovered;
// label overlay: 20, constant) — CSS's positive-z-index-always-above-auto
// rule means grid lines (z-index:auto, rendered after the segments in DOM,
// bklit's own "above segments so they're visible" comment) still paint over
// the ring graphics but under both hover states and the labels, exactly
// matching bklit's real stacking order regardless of the DOM-order
// simplification here.
//
// --- Reveal architecture ---------------------------------------------------
// bklit's `useMountProgress`/`useEnterComplete` swap a segment from an
// animating `motion.div` (scaleX/scaleY driven by a mount-progress
// MotionValue) to a static plain div once the mount tween completes — this
// port instead always renders a plain, unanimated-by-JSX wrapper div (its
// `transform` is never written by React) and layers a ONE-TIME `.animate()`
// WAAPI overlay for the reveal sweep only (`fill:"backwards"`, D48
// onfinish-release convention isn't needed here since nothing tracks these
// beyond unmount-cancel — mirrors pie-chart.tsx's own "genuine
// simplification over bklit's own dual-MotionValue model" note). This
// component's own React mount lifetime (keyed by `stage.label`, matching
// bklit's `key={stage.label}` exactly) already reproduces bklit's replay-vs-
// snap semantics for free: a genuinely NEW stage mounts fresh and replays
// its reveal; a same-key data UPDATE (value changes, label unchanged — the
// only kind of update `bench/data.ts`'s `generateFunnelUpdate` ever produces)
// re-renders this SAME instance without re-running the mount effect, i.e.
// SNAP, not replay. This was verified empirically against the running
// bklit-funnel bench scenario via a Playwright `__benchUpdate` probe (see
// this deliverable's report for the captured evidence) before being ported
// this way, per docs/LOG.md D30's explicit "must be verified empirically"
// instruction.
//
// The label's own fade-in (bklit `SegmentLabel`'s `motion.div`) uses a fixed
// tween — `{delay: index*staggerDelay+0.25, duration:0.35, ease:"easeOut"}`
// — verified via source NOT to read the caller's `enterTransition` prop at
// all (that prop only reaches `HSegment`/`VSegment`'s `useMountProgress`
// call) — ported as its own independent, always-tween WAAPI animation, never
// resolved through `internal/funnel-reveal.ts`'s spring/tween dispatch.
//
// --- Typography (disclosed adaptation, established precedent) -------------
// bklit's `SegmentLabel` uses plain LITERAL Tailwind classNames (not
// `cn()`/tailwind-merge — confirmed via source, so the D52 tailwind-merge
// dead-class-kill mechanism does not apply here). bench/app's Tailwind
// `@source` only scans repos/bklit-ui's real sources, not migrated/charts,
// so those utility classes would generate no CSS here regardless. Ported as
// plain hand-authored CSS classes instead (styles.css's
// `.ts-bkm-funnel-value/-pct/-label`), byte-identical computed values
// (font-size/weight/color/padding/radius/shadow) to Tailwind's own defaults
// for the exact utilities bklit uses (`text-sm`, `text-xs`, `font-semibold`,
// `font-medium`, `font-bold`, `rounded-full`, `px-3 py-1`, `shadow-sm`) —
// same visual output, different mechanism, matching the PieCenter/RingChart/
// Gauge precedent.
//
// --- `enterTransition` typing (disclosed deviation, established precedent) -
// bklit types this prop as framer's own `Transition` union. This port
// re-declares a narrower structural `FunnelEnterTransition` (spring | tween
// shape only, internal/funnel-reveal.ts) — identical disclosed narrowing to
// `PieEnterTransition`/`RingEnterTransition`, since framer-motion is not a
// runtime dependency of migrated/charts at all.
import {
  type CSSProperties,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { intFmt } from "./internal/formatters";
import {
  computeFunnelRings,
  funnelSegBox,
  hSegmentPath,
  resolveFunnelGrid,
  vSegmentPath,
  type FunnelSegBox,
} from "./internal/funnel-geometry";
import {
  createFunnelHoverCoordinator,
  createFunnelSegmentHoverRuntime,
  type FunnelHoverCoordinator,
} from "./internal/funnel-hover-chrome";
import {
  buildProgressKeyframes,
  FUNNEL_TWEEN_FALLBACK,
  resolveEnterTransition,
  revealTiming,
  type FunnelEnterTransition,
} from "./internal/funnel-reveal";
import "./styles.css";

export type { FunnelEnterTransition } from "./internal/funnel-reveal";

// ─── Orientation context ────────────────────────────────────────────

const FunnelOrientationContext = createContext<boolean>(false);

// ─── Label layout helper ────────────────────────────────────────────

function computeFunnelLabelLayout(params: {
  labelLayout: "spread" | "grouped";
  isHorizontal: boolean;
  labelOrientation?: "vertical" | "horizontal";
  labelAlign: "center" | "start" | "end";
  valueEl: ReactNode;
  pctEl: ReactNode;
  labelEl: ReactNode;
}): { labelContent: ReactNode; outerLabelStyle: CSSProperties } {
  const { labelLayout, isHorizontal, labelOrientation, labelAlign, valueEl, pctEl, labelEl } = params;

  let labelContent: ReactNode;
  if (labelLayout === "spread") {
    labelContent = isHorizontal ? (
      <>
        <div style={{ display: "flex", height: "16%", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4 }}>
          {valueEl}
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>{pctEl}</div>
        <div style={{ display: "flex", height: "16%", alignItems: "flex-start", justifyContent: "center", paddingTop: 4 }}>
          {labelEl}
        </div>
      </>
    ) : (
      <>
        <div style={{ display: "flex", width: "16%", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>
          {valueEl}
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>{pctEl}</div>
        <div style={{ display: "flex", width: "16%", alignItems: "center", justifyContent: "flex-start", paddingLeft: 8 }}>
          {labelEl}
        </div>
      </>
    );
  } else {
    const resolvedOrientation = labelOrientation ?? (isHorizontal ? "vertical" : "horizontal");
    const isVerticalStack = resolvedOrientation === "vertical";
    const itemsMap = { start: "flex-start", center: "center", end: "flex-end" } as const;
    labelContent = (
      <div
        style={{
          display: "flex",
          gap: 6,
          flexDirection: isVerticalStack ? "column" : "row",
          alignItems: isVerticalStack ? itemsMap[isHorizontal ? "center" : labelAlign] : itemsMap.center,
        }}
      >
        {valueEl}
        {pctEl}
        {labelEl}
      </div>
    );
  }

  const outerLabelStyle: CSSProperties =
    labelLayout === "spread"
      ? {
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: isHorizontal ? "column" : "row",
          alignItems: "center",
        }
      : {
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: isHorizontal ? "column" : "row",
          alignItems: "center",
          justifyContent: { start: "flex-start", center: "center", end: "flex-end" }[labelAlign],
          padding: isHorizontal ? "8% 0" : "0 8%",
        };

  return { labelContent, outerLabelStyle };
}

// ─── Public types ───────────────────────────────────────────────────

export interface FunnelGradientStop {
  offset: string | number;
  color: string;
}

export interface FunnelStage {
  label: string;
  value: number;
  displayValue?: string;
  /** Override the chart-level color for this segment */
  color?: string;
  /**
   * Apply a linear gradient to this segment.
   * Provide an array of color stops, e.g. `[{ offset: "0%", color: "#8B5CF6" }, { offset: "100%", color: "#3B82F6" }]`.
   * When set, this takes priority over the segment and chart-level `color` for the innermost ring.
   * Outer halo rings use the first stop color as their solid color.
   */
  gradient?: FunnelGradientStop[];
}

export interface FunnelChartProps {
  data: FunnelStage[];
  orientation?: "horizontal" | "vertical";
  color?: string;
  layers?: number;
  className?: string;
  style?: CSSProperties;
  showPercentage?: boolean;
  showValues?: boolean;
  showLabels?: boolean;
  /** Controlled hover state — index of the hovered segment */
  hoveredIndex?: number | null;
  /** Callback when hover state changes */
  onHoverChange?: (index: number | null) => void;
  formatPercentage?: (pct: number) => string;
  formatValue?: (value: number) => string;
  /** Stagger delay between segments in seconds. Default 0.12 */
  staggerDelay?: number;
  /** Transition for segment enter animation */
  enterTransition?: FunnelEnterTransition;
  /** Gap between segments in pixels. Default 4 */
  gap?: number;
  /**
   * Render a visx pattern definition. Receives a unique `id` string per segment
   * and the resolved `color`. Return a `<PatternLines>` (or any visx pattern)
   * inside an SVG `<defs>`. The component will use `fill="url(#id)"` on the
   * innermost ring while keeping outer halo rings as solid color.
   */
  renderPattern?: (id: string, color: string) => ReactNode;
  /** Edge style for the funnel segments. Default "curved" */
  edges?: "curved" | "straight";
  /**
   * Controls how segment labels (value, percentage, stage name) are arranged.
   * - "spread": Value/percentage/label are spread apart (top/center/bottom for horizontal,
   *   left/center/right for vertical). This is the default.
   * - "grouped": All label items stack together in a tight group.
   *
   * When "grouped", use `labelOrientation` and `labelAlign` for full control.
   */
  labelLayout?: "spread" | "grouped";
  /**
   * Stack direction of the label group. Only applies when `labelLayout="grouped"`.
   * - "vertical": Items stack top-to-bottom. Default for horizontal funnels.
   * - "horizontal": Items stack left-to-right. Default for vertical funnels.
   */
  labelOrientation?: "vertical" | "horizontal";
  /**
   * Where the label group sits within the segment cell.
   * - "center" (default), "start", "end"
   * For horizontal funnel: start=top, end=bottom.
   * For vertical funnel: start=left, end=right.
   */
  labelAlign?: "center" | "start" | "end";
  /** Grid configuration. Pass `true` for default bands + lines, or an object for fine control. */
  grid?:
    | boolean
    | {
        /** Show alternating background bands behind each segment. Default true */
        bands?: boolean;
        /** Color of the background bands. Default "var(--color-muted)" */
        bandColor?: string;
        /** Show grid lines at each gap between segments. Default true */
        lines?: boolean;
        /** Color of the grid lines. Default "var(--chart-grid)" */
        lineColor?: string;
        /** Opacity of the grid lines. Default 1 */
        lineOpacity?: number;
        /** Width of the grid lines in pixels. Default 1 */
        lineWidth?: number;
      };
}

// ─── Defaults ───────────────────────────────────────────────────────

const fmtPct = (p: number) => `${Math.round(p)}%`;
const fmtVal = intFmt;

// ─── Segment (ring graphic + label overlay, both orientations) ──────

interface FunnelSegmentProps {
  index: number;
  stage: FunnelStage;
  box: FunnelSegBox;
  normStart: number;
  normEnd: number;
  /** Along-stage-axis length: segW (horizontal) / segH (vertical). */
  segDim: number;
  /** Cross-axis length: fullH (horizontal) / fullW (vertical). */
  crossDim: number;
  color: string;
  layers: number;
  staggerDelay: number;
  enterTransition?: FunnelEnterTransition;
  renderPattern?: (id: string, color: string) => ReactNode;
  straight: boolean;
  gradientStops?: FunnelGradientStop[];
  coordinator: FunnelHoverCoordinator;
  pct: number;
  showValues: boolean;
  showPercentage: boolean;
  showLabels: boolean;
  formatPercentage: (p: number) => string;
  formatValue: (v: number) => string;
  labelLayout: "spread" | "grouped";
  labelOrientation?: "vertical" | "horizontal";
  labelAlign: "center" | "start" | "end";
}

function FunnelSegment(props: FunnelSegmentProps) {
  const isHorizontal = useContext(FunnelOrientationContext);

  const {
    index,
    stage,
    box,
    normStart,
    normEnd,
    segDim,
    crossDim,
    color,
    layers,
    staggerDelay,
    enterTransition,
    renderPattern,
    straight,
    gradientStops,
    coordinator,
    pct,
    showValues,
    showPercentage,
    showLabels,
    formatPercentage,
    formatValue,
    labelLayout,
    labelOrientation,
    labelAlign,
  } = props;

  const patternId = `funnel-${isHorizontal ? "h" : "v"}-pattern-${index}`;
  const gradientId = `funnel-${isHorizontal ? "h" : "v"}-grad-${index}`;

  const graphicRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const labelInnerRef = useRef<HTMLDivElement | null>(null);
  const ringRefs = useRef<(SVGPathElement | null)[]>([]);
  const runtimeRef = useRef<ReturnType<typeof createFunnelSegmentHoverRuntime> | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = createFunnelSegmentHoverRuntime();
  }

  const rings = computeFunnelRings(layers, (layerScale) =>
    isHorizontal
      ? hSegmentPath(normStart, normEnd, segDim, crossDim, layerScale, straight)
      : vSegmentPath(normStart, normEnd, segDim, crossDim, layerScale, straight),
  );

  // --- Hover chrome: refresh live config + repaint on every render, plus
  // subscribe to the shared coordinator for pointer-driven hover changes
  // (pie-chart.tsx's `PieSlice` precedent). ---
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const ringEls = ringRefs.current.filter((el): el is SVGPathElement => el !== null);
    runtime.update({
      index,
      isHorizontal,
      ringEls,
      graphicEl: graphicRef.current,
      labelEl: labelRef.current,
    });
    runtime.paint(coordinator.getHovered());
    return coordinator.subscribe(() => runtime.paint(coordinator.getHovered()));
  }, [coordinator, index, isHorizontal, rings.length]);

  useEffect(() => {
    return () => {
      runtimeRef.current?.stop();
    };
  }, []);

  // --- Reveal: per-segment scale-in (bklit `HSegment`/`VSegment`'s
  // `useMountProgress`-driven scaleX/scaleY), fires ONCE per mount — see
  // file header "Reveal architecture" for why this component's own React
  // lifetime already reproduces bklit's replay-vs-snap semantics exactly.
  const enterTransitionRef = useRef(enterTransition);
  enterTransitionRef.current = enterTransition;
  useEffect(() => {
    const el = graphicRef.current;
    if (!el) return;
    const resolved = resolveEnterTransition(enterTransitionRef.current, FUNNEL_TWEEN_FALLBACK);
    const timing = revealTiming(resolved);
    const delayMs = index * staggerDelay * 1000;
    el.style.transformOrigin = isHorizontal ? "left center" : "center top";
    const keyframes = buildProgressKeyframes(timing, (p) => ({ transform: `scale(${p})` }));
    const anim = el.animate(keyframes, {
      duration: timing.durationMs,
      delay: delayMs,
      easing: timing.easing,
      fill: "backwards",
    });
    return () => anim.cancel();
    // enterTransition read via enterTransitionRef, matching bklit's own
    // transitionRef pattern (use-mount-progress.ts) — deliberately not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, staggerDelay, isHorizontal]);

  // --- Label fade-in reveal: bklit `SegmentLabel`'s own FIXED tween (NOT
  // driven by `enterTransition` — verified against source: its `motion.div`
  // uses a hardcoded `{delay: index*staggerDelay+0.25, duration:0.35,
  // ease:"easeOut"}`, independent of the caller's `enterTransition`, which
  // only reaches `HSegment`/`VSegment`). ---
  useEffect(() => {
    const el = labelInnerRef.current;
    if (!el) return;
    const delayMs = (index * staggerDelay + 0.25) * 1000;
    const anim = el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 350,
      delay: delayMs,
      easing: "ease-out",
      fill: "backwards",
    });
    return () => anim.cancel();
  }, [index, staggerDelay]);

  const handlePointerEnter = useCallback(() => coordinator.requestHover(index), [coordinator, index]);
  const handlePointerLeave = useCallback(() => coordinator.requestUnhover(), [coordinator]);

  const viewBoxW = isHorizontal ? segDim : crossDim;
  const viewBoxH = isHorizontal ? crossDim : segDim;

  // ── Label content (typography via hand-authored CSS, see file header) ──
  const display = stage.displayValue ?? formatValue(stage.value);
  const valueEl = showValues && <span className="ts-bkm-funnel-value">{display}</span>;
  const pctEl = showPercentage && <span className="ts-bkm-funnel-pct">{formatPercentage(pct)}</span>;
  const labelEl = showLabels && <span className="ts-bkm-funnel-label">{stage.label}</span>;

  const { labelContent, outerLabelStyle } = computeFunnelLabelLayout({
    labelLayout,
    isHorizontal,
    labelOrientation,
    labelAlign,
    valueEl,
    pctEl,
    labelEl,
  });

  return (
    <>
      <div
        ref={graphicRef}
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <svg
          aria-hidden="true"
          preserveAspectRatio="none"
          role="presentation"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
          viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        >
          <defs>
            {gradientStops && (
              <linearGradient
                id={gradientId}
                x1={isHorizontal ? "0" : "0"}
                x2={isHorizontal ? "1" : "0"}
                y1="0"
                y2={isHorizontal ? "0" : "1"}
              >
                {gradientStops.map((stop) => (
                  <stop
                    key={`${stop.offset}-${stop.color}`}
                    offset={typeof stop.offset === "number" ? `${stop.offset * 100}%` : stop.offset}
                    stopColor={stop.color}
                  />
                ))}
              </linearGradient>
            )}
            {renderPattern?.(patternId, color)}
          </defs>
          {rings.map((r) => {
            const isInnermost = r.ringIndex === rings.length - 1;
            let ringFill: string | undefined;
            if (isInnermost && renderPattern) {
              ringFill = `url(#${patternId})`;
            } else if (isInnermost && gradientStops) {
              ringFill = `url(#${gradientId})`;
            }
            return (
              <path
                d={r.d}
                fill={ringFill ?? color}
                key={`ring-${r.ringIndex}`}
                opacity={r.opacity}
                ref={(el) => {
                  ringRefs.current[r.ringIndex] = el;
                }}
                style={{ transformOrigin: "50% 50%" }}
              />
            );
          })}
        </svg>
      </div>

      {/* `cursor-pointer` is bklit's own literal rendered class on this
          overlay (`className="absolute cursor-pointer"`) — kept as a real
          class (not just the inline style) because qa/screenshot.mjs's
          funnel hover-zone snapping discovers hover cells impl-agnostically
          via `#chart-root .cursor-pointer`. */}
      <div
        className="cursor-pointer"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        ref={labelRef}
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          cursor: "pointer",
          zIndex: 20,
        }}
      >
        <div ref={labelInnerRef} style={outerLabelStyle}>
          {labelContent}
        </div>
      </div>
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function FunnelChart({
  data,
  orientation = "horizontal",
  color = "var(--chart-1)",
  layers = 3,
  className,
  style,
  showPercentage = true,
  showValues = true,
  showLabels = true,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  formatPercentage = fmtPct,
  formatValue = fmtVal,
  staggerDelay = 0.12,
  enterTransition,
  gap = 4,
  renderPattern,
  edges = "curved",
  labelLayout = "spread",
  labelOrientation,
  labelAlign = "center",
  grid: gridProp = false,
}: FunnelChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSz((prev) =>
          Math.abs(prev.w - rect.width) > 0.5 || Math.abs(prev.h - rect.height) > 0.5
            ? { w: rect.width, h: rect.height }
            : prev,
        );
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Hover coordinator (imperative, D10 — no React state/framer-motion in
  // the pointer path). Controlled/uncontrolled split ported exactly from
  // bklit's `FunnelChart.setHoveredIndex`
  // (`isControlled ? onHoverChange?.(index) : setInternalHoveredIndex(index)`)
  // — same contract as pie-chart.tsx/ring-chart.tsx. ---
  const isControlledRef = useRef(hoveredIndexProp !== undefined);
  isControlledRef.current = hoveredIndexProp !== undefined;
  const onHoverChangeRef = useRef(onHoverChange);
  onHoverChangeRef.current = onHoverChange;

  const coordinatorRef = useRef<FunnelHoverCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createFunnelHoverCoordinator(
      (index) => onHoverChangeRef.current?.(index),
      () => isControlledRef.current,
    );
  }
  const coordinator = coordinatorRef.current;

  useEffect(() => {
    if (hoveredIndexProp !== undefined) {
      coordinator.setHovered(hoveredIndexProp);
    }
  }, [hoveredIndexProp, coordinator]);

  const hoverInputsRef = useRef<{
    data: typeof data;
    horiz: boolean;
    n: number;
    norms: number[];
    max: number;
    segW: number;
    segH: number;
    gap: number;
    W: number;
    H: number;
    formatValue: typeof formatValue;
    formatPercentage: typeof formatPercentage;
  }>(null!);
  hoverInputsRef.current = {
    data,
    horiz: orientation === "horizontal",
    n: data.length,
    norms: data.map((d) => d.value / (data[0]?.value ?? 1)),
    max: data[0]?.value ?? 0,
    segW: 0,
    segH: 0,
    gap,
    W: sz.w,
    H: sz.h,
    formatValue,
    formatPercentage,
  };

  if (!data.length) {
    return null;
  }
  const first = data[0];
  if (!first) {
    return null;
  }
  // docs/LOG.md D30: percentage/height basis is `data[0].value`, NOT the max
  // of the whole series — verbatim from bklit's own `const max = first.value`.
  const max = first.value;
  const n = data.length;
  const norms = data.map((d) => d.value / max);
  const horiz = orientation === "horizontal";
  const { w: W, h: H } = sz;

  const totalGap = gap * (n - 1);
  const segW = (W - (horiz ? totalGap : 0)) / n;
  const segH = (H - (horiz ? 0 : totalGap)) / n;

  const gridCfg = resolveFunnelGrid(gridProp);

  return (
    <FunnelOrientationContext.Provider value={horiz}>
      <div
      className={className}
      data-bkm-chart="funnel"
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        userSelect: "none",
        overflow: "visible",
        aspectRatio: horiz ? "2.2 / 1" : "1 / 1.8",
        ...style,
      }}
    >
      {W > 0 && H > 0 && (
        <>
          {gridCfg.enabled && (
            <svg
              aria-hidden="true"
              preserveAspectRatio="none"
              role="presentation"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              viewBox={`0 0 ${W} ${H}`}
            >
              {gridCfg.showBands &&
                data.map((stage, i) => {
                  if (i % 2 !== 0) return null;
                  return horiz ? (
                    <rect fill={gridCfg.bandColor} height={H} key={`band-${stage.label}`} width={segW} x={(segW + gap) * i} y={0} />
                  ) : (
                    <rect fill={gridCfg.bandColor} height={segH} key={`band-${stage.label}`} width={W} x={0} y={(segH + gap) * i} />
                  );
                })}
            </svg>
          )}

          {data.map((stage, i) => {
            const normStart = norms[i] ?? 0;
            const normEnd = norms[Math.min(i + 1, n - 1)] ?? 0;
            const firstStop = stage.gradient?.[0];
            const segColor = firstStop ? firstStop.color : (stage.color ?? color);
            const box = funnelSegBox(i, horiz, segW, segH, gap, W, H);
            const pct = (stage.value / max) * 100;
            return (
              <FunnelSegment
                box={box}
                color={segColor}
                coordinator={coordinator}
                crossDim={horiz ? H : W}
                enterTransition={enterTransition}
                formatPercentage={formatPercentage}
                formatValue={formatValue}
                gradientStops={stage.gradient}
                index={i}
                key={stage.label}
                labelAlign={labelAlign}
                labelLayout={labelLayout}
                labelOrientation={labelOrientation}
                layers={layers}
                normEnd={normEnd}
                normStart={normStart}
                pct={pct}
                renderPattern={renderPattern}
                segDim={horiz ? segW : segH}
                showLabels={showLabels}
                showPercentage={showPercentage}
                showValues={showValues}
                stage={stage}
                staggerDelay={staggerDelay}
                straight={edges === "straight"}
              />
            );
          })}

          {gridCfg.enabled && gridCfg.showGridLines && (
            <svg
              aria-hidden="true"
              preserveAspectRatio="none"
              role="presentation"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              viewBox={`0 0 ${W} ${H}`}
            >
              {Array.from({ length: n - 1 }, (_, i) => {
                const idx = i + 1;
                const gridKey = `grid-${idx}`;
                if (horiz) {
                  const x = segW * idx + gap * i + gap / 2;
                  return (
                    <line
                      key={gridKey}
                      stroke={gridCfg.gridLineColor}
                      strokeOpacity={gridCfg.gridLineOpacity}
                      strokeWidth={gridCfg.gridLineWidth}
                      x1={x}
                      x2={x}
                      y1={0}
                      y2={H}
                    />
                  );
                }
                const y = segH * idx + gap * i + gap / 2;
                return (
                  <line
                    key={gridKey}
                    stroke={gridCfg.gridLineColor}
                    strokeOpacity={gridCfg.gridLineOpacity}
                    strokeWidth={gridCfg.gridLineWidth}
                    x1={0}
                    x2={W}
                    y1={y}
                    y2={y}
                  />
                );
              })}
            </svg>
          )}
        </>
      )}
    </div>
    </FunnelOrientationContext.Provider>
  );
}
