// Migrated bklit-ui Gauge — same public API
// (repos/bklit-ui/packages/ui/src/charts/gauge.tsx,
// notch-gauge-shared.ts, gauge-label-layout.tsx, pie-center-shell.tsx),
// covering BOTH orientations (docs/LOG.md D28/D29 rulings, binding):
//
// Gauge is a segmented NOTCH meter — no needle, no pointer interaction of
// any kind (D28). `activeNotches = round(value/100 * totalNotches)`; two
// structurally disjoint render paths dispatch on `orientation`:
//
//  - Arc: stock `@tanstack/charts/polar` `radialArc` (D82 REDO —
//    replaces the custom PolarMark from D28/D79). Two `radialArc` marks:
//    one for the background/track (ALL notches at inactive fill opacity)
//    and one for the active overlay (ONLY active notches at active fill
//    opacity). Notch angles are pre-computed from bklit's own
//    notchAngle/gapAngle math, converted to radians, and passed as
//    per-datum `startAngle`/`endAngle` channels. `polar()` uses
//    `radiusRatio: 1`; inner/outer radii are functions of the layout
//    radius matching bklit's 0.28/0.42 × size ratios. The focus engine
//    is disabled (`FOCUS_DISABLED`, radar-chart.tsx precedent — Gauge
//    has zero hover/tooltip). Smooth pie-slice arcs replace bklit's
//    bespoke trapezoid geometry (notch corner fillets are approximated
//    via `radialArc`'s `cornerRadius`; at normal viewing distances
//    the notch shape is not distinguishable from bklit's quadrilateral
//    paths — see QA gates for pixel-diff verification).
//  - Linear: plain hand-rolled `<svg>` (NO `@tanstack/charts` container at
//    all) — same fallback precedent already established by
//    ring-chart.tsx/pie-chart.tsx (grep-verified: ring-chart.tsx uses zero
//    TanStack `<Chart>`/mark usage). A horizontal notch strip has no
//    natural cartesian x/y domain to hand to `defineChart` (each notch's
//    slot position is `i*(slotWidth+gapWidth)`, not a data-driven x/y
//    value pair), and unlike arc there is no polar container whose
//    angle/radius machinery a custom mark can piggyback on and then
//    bypass — a `cartesian()` custom mark would gain nothing over plain
//    SVG here (no data-driven scale, no axis, no guide reuse) while adding
//    an extra abstraction layer for zero benefit. FLAGGED for Fable
//    review per this deliverable's own instruction, same as the ring/pie
//    precedent it follows.
//
// Reveal/update animation — WAAPI only, mount reveal AND the D28 value-
// update idiom (increase = spring-pop only NEWLY-active notches; decrease
// = instant vanish, no exit animation) are both produced by ONE generic
// key-diffing reconciler (`internal/gauge-reveal.ts`'s
// `reconcileGaugeReveal`), not radar/candlestick's epoch-replay machinery —
// see that file's header for the full "why no separate mount-vs-update
// phase is needed here" derivation (bklit's own notch keys, `bg-i`/
// `active-i`, are permanent identities, not array-position keys, so
// framer's `initial` prop only ever fires once per key regardless of what
// else changes around it). This is a genuine, disclosed simplification
// versus every other migrated family.
//
// Gradient `<defs>` for the arc path's theme-palette gradient
// (`useGradient && activeGradient === undefined`) use `defineChart`'s own
// `gradients: ChartLinearGradient[]` option, rendered via
// `renderSvg={renderChartSvgWithResources}` (`@tanstack/charts/svg/
// resources`, confirmed by reading `Chart.tsx`: `renderSvg` defaults to
// the plain `renderChartSvg`, which does NOT know about `scene.gradients`
// at all) — a sanctioned, first-party mechanism for exactly this need, not
// a sibling-`<svg>` hack. DISCLOSED LIMITATION: bklit's `children`-as-defs
// escape hatch (`collectGaugeDefsElements` — arbitrary caller-supplied
// `<linearGradient>`/`<pattern>` JSX passed as `<Gauge>` children) is only
// honored on the LINEAR path (plain SVG we render ourselves, so those
// elements drop straight into a real `<defs>`); the ARC path has no
// extension point for arbitrary caller-authored SVG markup inside
// TanStack's own generated `<defs>` (`defineChart`'s `gradients` option
// only accepts a structured linear-gradient stop list, not arbitrary
// JSX/pattern elements) — `children` remains a type-compatible prop on
// arc, it is simply a no-op there. This is a real, narrow prop-compat gap
// on a rarely-used power-user escape hatch, flagged here for Fable.
//
// Center readout reuses internal/center-stat.tsx's `CenterStat` UNMODIFIED
// (per this deliverable's own instruction) via internal/gauge-center.tsx's
// `GaugeCenterOverlay` (arc — PieCenterShell's 0->centerValue double-rAF
// mount-entrance trick, ported 1:1) and `GaugeLabelStat` + `GaugeLabelLayout`
// (linear — direct pass-through, NO entrance trick, matching bklit's own
// real orientation divergence — see gauge-center.tsx's header for the
// source citations).
//
// Reduced motion: framer's `useReducedMotion()` has no direct migrated
// equivalent yet, so this file adds a small local
// `usePrefersReducedMotion` (`useSyncExternalStore` over
// `matchMedia("(prefers-reduced-motion: reduce)")`) reproducing the same
// contract bklit relies on (`notchTransition = prefersReducedMotion ?
// {duration:0} : ...`) — reproduced here as `durationMs: 0` timing fed
// through the SAME reveal path, not a separate "skip animation" branch,
// so the reveal engine's key-bookkeeping stays identical either way.
//
// Disclosed addition (pie/ring precedent): a `style?: CSSProperties` prop
// forwarded onto the outermost wrapper div — not part of bklit's own
// `GaugeProps`.
//
// Disclosed, NOT fixed, quirk preserved verbatim: bklit's linear
// `ParentSize` measures the OUTER sizing wrapper's width BEFORE
// `GaugeLabelLayout` composes a `labelPlacement="left"|"right"` flex row
// alongside the notch track — meaning the track is asked to render at the
// FULL measured width even when a left/right label's own footprint (plus
// its `gap-4`) would need to share that space, since the two are
// siblings-in-a-flex-row nested INSIDE the same already-measured wrapper.
// This can visually overflow/crowd the container edge for left/right
// placements in bklit itself; this port reproduces the exact same nesting
// order (measure, then compose the label layout inside that measurement)
// rather than "fixing" a behavior this migration's mandate is to match,
// not improve. `labelPlacement="top"|"bottom"` (the only placements the
// frozen bench scenario and docs-mdx pattern actually use) never
// exhibits this, since a column stack never competes for width.
import * as React from "react";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { polar, radialArc } from "@tanstack/charts/polar";
import { renderChartSvgWithResources } from "@tanstack/charts/svg/resources";
import {
  collectGaugeDefsElements,
  computeLinearNotches,
  createNotchPath,
  DEFAULT_ACTIVE_FILL_OPACITY,
  DEFAULT_ACTIVE_GRADIENT,
  DEFAULT_INACTIVE_FILL_OPACITY,
  DEFAULT_LINEAR_GAUGE_HEIGHT,
  interpolateGaugeHex,
  resolveGaugeActiveFill,
  resolveGaugeBgFill,
  type ComputedNotch,
} from "./internal/gauge-notch";
import {
  GAUGE_SPRING_FALLBACK,
  reconcileGaugeReveal,
  resolveEnterTransition,
  revealTiming,
  type GaugeEnterTransition,
  type GaugeRevealTarget,
  type GaugeRevealTiming,
} from "./internal/gauge-reveal";
import {
  GaugeCenterOverlay,
  GaugeLabelLayout,
  GaugeLabelStat,
  type GaugeLabelAlign,
  type GaugeLabelPlacement,
} from "./internal/gauge-center";
import { onPostPaint } from "./internal/deferred-reveal";
import { FOCUS_DISABLED } from "./internal/focus-disabled";
import { defaultCenterStatFormat, type CenterStatFormat } from "./internal/center-stat";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import "./styles.css";

export type { GaugeEnterTransition } from "./internal/gauge-reveal";
export type { GaugeLabelAlign, GaugeLabelPlacement } from "./internal/gauge-center";

// Gauge has zero pointer/tooltip interaction — see internal/focus-disabled.ts.

function deferredGaugeMountReveal(
  groupEl: HTMLElement | SVGGElement,
  collectTargets: () => [GaugeRevealTarget[], GaugeRevealTarget[]],
  timing: GaugeRevealTiming,
  seenBgRef: React.MutableRefObject<Set<string>>,
  seenActiveRef: React.MutableRefObject<Set<string>>,
  revealAnimationsRef: React.MutableRefObject<Animation[]>,
  renderGenRef: React.MutableRefObject<number>,
  myGen: number,
) {
  groupEl.classList.add("ts-chart__marks--revealing");
  onPostPaint(() => {
    if (renderGenRef.current !== myGen) {
      groupEl.classList.remove("ts-chart__marks--revealing");
      return;
    }
    const trackReveal = trackRevealFactory(revealAnimationsRef);
    const [bgTargets, activeTargets] = collectTargets();
    reconcileGaugeReveal(bgTargets, seenBgRef.current, timing, trackReveal);
    reconcileGaugeReveal(activeTargets, seenActiveRef.current, timing, trackReveal);
    groupEl.classList.remove("ts-chart__marks--revealing");
  });
}

/** Flat row fed to `radialArc` — one datum per rendered arc path. */
interface GaugeArcRow {
  notchIndex: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
  fill: string;
}

const ARC_ASPECT_RATIO = 21 / 16;
const ARC_MAX_WIDTH = 560;

export type GaugeOrientation = "arc" | "linear";

export interface GaugeProps {
  /** Arc (default) or horizontal linear notch track */
  orientation?: GaugeOrientation;
  /** Fill level 0-100 */
  value: number;
  /** Number of notches */
  totalNotches?: number;
  /** Percentage of the track reserved for gaps between notches */
  spacing?: number;
  notchCornerRadius?: number;
  /** `true` = rectangular notches; `false` = tapered toward center / midline */
  uniformWidth?: boolean;
  startAngle?: number;
  endAngle?: number;
  useGradient?: boolean;
  activeGradient?: readonly [string, string];
  inactiveGradient?: readonly [string, string];
  /** Center statistic — omit to hide the label block */
  centerValue?: number;
  defaultLabel?: string;
  prefix?: string;
  suffix?: string;
  formatOptions?: CenterStatFormat;
  /** Label position for `orientation="linear"`. Arc gauges always overlay center. */
  labelPlacement?: GaugeLabelPlacement;
  /** Cross-axis alignment (start / center / end), same model as chart legend */
  labelAlign?: GaugeLabelAlign;
  inactiveFill?: string;
  activeFill?: string;
  inactiveFillOpacity?: number;
  activeFillOpacity?: number;
  /** Custom `<linearGradient>`/`<pattern>` defs — LINEAR orientation only, see file header. */
  children?: React.ReactNode;
  className?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  notchLengthPercent?: number;
  /** Linear only — notch width as % of each slot (default 80) */
  notchWidthPercent?: number;
  /** Linear only — bar thickness in px when responsive (default 24) */
  linearHeight?: number;
  enterTransition?: GaugeEnterTransition;
  enterStaggerScale?: number;
  /** Studio-only: static paths while scrubbing geometry controls */
  geometryScrubbing?: boolean;
  /** Disclosed addition (pie/ring precedent) — not part of bklit's own GaugeProps. */
  style?: React.CSSProperties;
}

function reducedMotionTiming(): GaugeRevealTiming {
  return { durationMs: 0, easing: "linear", sampledProgress: [0, 1] };
}

// --- Fill state — notch-gauge-shared.ts's `useGaugeFillState`, ported
// verbatim (gauge.tsx lines 223-267), shared by both orientations. ---
interface GaugeFillStateInput {
  useGradient?: boolean;
  activeGradient?: readonly [string, string];
  inactiveGradient?: readonly [string, string];
  inactiveFill?: string;
  activeFill?: string;
  inactiveFillOpacity?: number;
  activeFillOpacity?: number;
  children?: React.ReactNode;
  totalNotches?: number;
}

function useGaugeFillState(props: GaugeFillStateInput) {
  const {
    useGradient = false,
    activeGradient,
    inactiveGradient,
    inactiveFill,
    activeFill,
    inactiveFillOpacity,
    activeFillOpacity,
    children,
    totalNotches = 40,
  } = props;

  const themeActiveGradientId = `gauge-theme-active-${React.useId().replace(/:/g, "")}`;
  const defsChildren = React.useMemo(() => collectGaugeDefsElements(children), [children]);

  const hasCustomInactive = inactiveFill !== undefined && inactiveFill.length > 0;
  const hasCustomActive = activeFill !== undefined && activeFill.length > 0;

  const activeGrad0 = activeGradient?.[0] ?? DEFAULT_ACTIVE_GRADIENT[0];
  const activeGrad1 = activeGradient?.[1] ?? DEFAULT_ACTIVE_GRADIENT[1];
  const inactiveGrad0 = inactiveGradient?.[0] ?? activeGrad0;
  const inactiveGrad1 = inactiveGradient?.[1] ?? activeGrad1;
  const useThemePaletteGradient = useGradient && activeGradient === undefined;

  return {
    themeActiveGradientId,
    defsChildren,
    hasCustomInactive,
    hasCustomActive,
    activeGrad0,
    activeGrad1,
    inactiveGrad0,
    inactiveGrad1,
    useThemePaletteGradient,
    resolvedActiveFillOpacity: activeFillOpacity ?? DEFAULT_ACTIVE_FILL_OPACITY,
    resolvedInactiveFillOpacity: inactiveFillOpacity ?? DEFAULT_INACTIVE_FILL_OPACITY,
    totalNotches,
  };
}

// A finished `fill:"backwards"` animation has no further effect — release
// its tracking ref the moment it finishes (docs/LOG.md D48; radar-chart.tsx/
// ring-chart.tsx precedent) so a computed backstop only ever cancels
// genuinely never-finished animations.
function trackRevealFactory(store: React.RefObject<Animation[]>) {
  return (anim: Animation) => {
    store.current.push(anim);
    anim.onfinish = () => {
      const arr = store.current;
      const i = arr.indexOf(anim);
      if (i !== -1) arr.splice(i, 1);
    };
  };
}

// ============================================================================
// Arc
// ============================================================================
type GaugeArcProps = Omit<GaugeProps, "orientation" | "labelPlacement" | "labelAlign" | "notchWidthPercent" | "linearHeight" | "geometryScrubbing">;

function GaugeArc(props: GaugeArcProps) {
  const {
    width: widthProp,
    height: heightProp,
    className,
    minWidth,
    style,
    value,
    totalNotches = 40,
    spacing = 25,
    notchCornerRadius = 0,
    uniformWidth = false,
    startAngle = 135,
    endAngle = 405,
    useGradient = false,
    activeGradient,
    inactiveGradient,
    centerValue,
    defaultLabel = "Total",
    prefix,
    suffix,
    formatOptions = defaultCenterStatFormat,
    inactiveFill,
    activeFill,
    inactiveFillOpacity,
    activeFillOpacity,
    children,
    notchLengthPercent = 100,
    enterTransition,
    enterStaggerScale = 1,
  } = props;

  const prefersReducedMotion = usePrefersReducedMotion();
  const fillState = useGaugeFillState({
    useGradient,
    activeGradient,
    inactiveGradient,
    inactiveFill,
    activeFill,
    inactiveFillOpacity,
    activeFillOpacity,
    children,
    totalNotches,
  });

  const fixedSize = widthProp != null && heightProp != null;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
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

  const width = widthProp ?? measured.width;
  const height = heightProp ?? measured.height;
  const size = Math.min(width, height);

  // --- Compute arc rows (flat datums for radialArc, one per notch) ---
  const arcRows = React.useMemo((): { bgRows: GaugeArcRow[]; activeRows: GaugeArcRow[]; innerRadiusRatio: number; outerRadiusRatio: number } | null => {
    if (width <= 0 || height <= 0) return null;
    const size = Math.min(width, height);

    // Radius ratios: bklit outerRadius = size * 0.42 → polarRadius = size/2 → ratio = 0.84
    const outerRadiusRatio = 0.84;
    const depthFactor = Math.min(100, Math.max(5, notchLengthPercent)) / 100;
    // bklit innerRadius = outerRadius - (outerRadius - size*0.28) * depthFactor
    //   = size * 0.42 - size * 0.14 * depthFactor
    // innerRadiusRatio = (size*0.42 - size*0.14*depthFactor) / (size/2) = 0.84 - 0.28*depthFactor
    const innerRadiusRatio = 0.84 - 0.28 * depthFactor;

    // Convert degrees → radians: bklit 135→405 ≡ TanStack −3π/4→3π/4
    const startAngleRad = -Math.PI * 3 / 4;
    const endAngleRad = Math.PI * 3 / 4;
    const totalAngleRad = endAngleRad - startAngleRad;
    const spacingPct = Math.min(100, Math.max(0, spacing)) / 100;
    const availableAngleRad = totalAngleRad * (1 - spacingPct);
    const notchAngleRad = totalNotches > 0 ? availableAngleRad / totalNotches : 0;
    const gapAngleRad = totalNotches > 1
      ? (totalAngleRad * spacingPct) / (totalNotches - 1)
      : 0;
    const notchVisualSpanRad = notchAngleRad * 0.8;
    const slotWidthRad = notchAngleRad + gapAngleRad;

    const activeNotches = Math.round((value / 100) * totalNotches);
    const denom = totalNotches > 1 ? totalNotches - 1 : 1;

    const {
      hasCustomInactive,
      hasCustomActive,
      useThemePaletteGradient: useTPG,
      inactiveGrad0,
      inactiveGrad1,
      activeGrad0,
      activeGrad1,
      themeActiveGradientId,
    } = fillState;

    const bgRows: GaugeArcRow[] = [];
    const activeRows: GaugeArcRow[] = [];

    for (let i = 0; i < totalNotches; i++) {
      const slotCenterRad = startAngleRad + i * slotWidthRad + notchAngleRad / 2;
      const row: GaugeArcRow = {
        notchIndex: i,
        startAngle: slotCenterRad - notchVisualSpanRad / 2,
        endAngle: slotCenterRad + notchVisualSpanRad / 2,
        padAngle: 0,
        fill: hasCustomInactive
          ? (inactiveFill ?? "var(--border)")
          : useTPG
            ? "var(--border)"
            : useGradient
              ? interpolateGaugeHex(inactiveGrad0, inactiveGrad1, i / denom)
              : "var(--border)",
      };
      bgRows.push(row);

      if (i < activeNotches) {
        activeRows.push({
          notchIndex: i,
          startAngle: row.startAngle,
          endAngle: row.endAngle,
          padAngle: 0,
          fill: hasCustomActive
            ? (activeFill ?? "var(--chart-1)")
            : useTPG
              ? `url(#${themeActiveGradientId})`
              : useGradient
                ? interpolateGaugeHex(activeGrad0, activeGrad1, i / denom)
                : "var(--chart-1)",
        });
      }
    }

    return { bgRows, activeRows, innerRadiusRatio, outerRadiusRatio };
  }, [
    width,
    height,
    totalNotches,
    spacing,
    notchLengthPercent,
    value,
    useGradient,
    fillState.useThemePaletteGradient,
    fillState.hasCustomInactive,
    fillState.hasCustomActive,
    fillState.inactiveGrad0,
    fillState.inactiveGrad1,
    fillState.activeGrad0,
    fillState.activeGrad1,
    fillState.themeActiveGradientId,
    inactiveFill,
    activeFill,
  ]);

  // --- TanStack definition: TWO radialArc marks (bg track + active overlay) ---
  const definition = React.useMemo(() => {
    if (!arcRows) return null;
    const { bgRows, activeRows, innerRadiusRatio, outerRadiusRatio } = arcRows;

    return defineChart({
      marks: [
        polar({
          radiusRatio: 1,
          marks: [
            // Background/track — EVERY notch rendered once
            radialArc<GaugeArcRow>(bgRows, {
              id: "gauge-bg",
              startAngle: "startAngle",
              endAngle: "endAngle",
              padAngle: "padAngle",
              innerRadius: ({ radius }: { radius: number }) => radius * innerRadiusRatio,
              outerRadius: ({ radius }: { radius: number }) => radius * outerRadiusRatio,
              key: (d) => String(d.notchIndex),
              fill: (d) => d.fill,
              fillOpacity: fillState.resolvedInactiveFillOpacity,
              cornerRadius: notchCornerRadius,
            }),
            // Active overlay — ONLY active notches overlaid with active fill
            radialArc<GaugeArcRow>(activeRows, {
              id: "gauge-active",
              startAngle: "startAngle",
              endAngle: "endAngle",
              padAngle: "padAngle",
              innerRadius: ({ radius }: { radius: number }) => radius * innerRadiusRatio,
              outerRadius: ({ radius }: { radius: number }) => radius * outerRadiusRatio,
              key: (d) => String(d.notchIndex),
              fill: (d) => d.fill,
              fillOpacity: fillState.resolvedActiveFillOpacity,
              cornerRadius: notchCornerRadius,
            }),
          ],
        }),
      ],
      x: null,
      y: null,
      guides: false,
      focus: FOCUS_DISABLED,
      gradients: fillState.useThemePaletteGradient
        ? [
            {
              id: fillState.themeActiveGradientId,
              x1: 0,
              y1: 0,
              x2: 1,
              y2: 0,
              stops: [
                { offset: 0, color: "var(--chart-1)" },
                { offset: 1, color: "var(--chart-5)" },
              ],
            },
          ]
        : [],
    });
  }, [
    arcRows,
    notchCornerRadius,
    fillState.resolvedInactiveFillOpacity,
    fillState.resolvedActiveFillOpacity,
    fillState.useThemePaletteGradient,
    fillState.themeActiveGradientId,
  ]);

  const seenBgRef = React.useRef<Set<string>>(new Set());
  const seenActiveRef = React.useRef<Set<string>>(new Set());
  const revealAnimationsRef = React.useRef<Animation[]>([]);
  const renderGenRef = React.useRef(0);

  React.useEffect(() => {
    return () => {
      for (const anim of revealAnimationsRef.current) anim.cancel();
      revealAnimationsRef.current = [];
    };
  }, []);

  const handleRender = React.useCallback(() => {
    const marksGroup = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup) return;

    renderGenRef.current += 1;
    const myGen = renderGenRef.current;
    const stagger = Math.max(0.25, Math.min(2.5, enterStaggerScale));
    const timing = prefersReducedMotion
      ? reducedMotionTiming()
      : revealTiming(resolveEnterTransition(enterTransition, GAUGE_SPRING_FALLBACK));

    const collectTargets = (): [GaugeRevealTarget[], GaugeRevealTarget[]] => {
      const radialArcGroups = marksGroup.querySelectorAll<SVGGElement>(".ts-chart__radial-arc");
      const bgGroup = radialArcGroups[0];
      const activeGroup = radialArcGroups[1];

      const bgTargets: GaugeRevealTarget[] = bgGroup
        ? Array.from(bgGroup.querySelectorAll<SVGPathElement>("path")).map((el, idx) => ({
            key: `bg-${idx}`,
            el,
            delayMs: idx * 0.015 * stagger * 1000,
          }))
        : [];

      const activeTargets: GaugeRevealTarget[] = activeGroup
        ? Array.from(activeGroup.querySelectorAll<SVGPathElement>("path")).map((el, idx) => ({
            key: `active-${idx}`,
            el,
            delayMs: (0.3 + idx * 0.02) * stagger * 1000,
          }))
        : [];

      return [bgTargets, activeTargets];
    };

      const firstReveal = seenBgRef.current.size === 0 && seenActiveRef.current.size === 0;
    if (!firstReveal) {
      const trackReveal = trackRevealFactory(revealAnimationsRef);
      const [bgTargets, activeTargets] = collectTargets();
      reconcileGaugeReveal(bgTargets, seenBgRef.current, timing, trackReveal);
      reconcileGaugeReveal(activeTargets, seenActiveRef.current, timing, trackReveal);
      return;
    }

    deferredGaugeMountReveal(marksGroup, collectTargets, timing, seenBgRef, seenActiveRef, revealAnimationsRef, renderGenRef, myGen);
  }, [enterTransition, enterStaggerScale, prefersReducedMotion]);

  const resolvedMinWidth = minWidth ?? 300;

  const inner =
    definition && size > 0 ? (
      <div style={{ position: "relative", width, height }}>
        <Chart
          ariaLabel="Gauge chart"
          definition={definition}
          height={height}
          onRender={handleRender}
          renderSvg={renderChartSvgWithResources}
          width={width}
        />
        {centerValue != null ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              paddingTop: size * 0.08,
            }}
          >
            <GaugeCenterOverlay
              centerValue={centerValue}
              contextSize={size}
              defaultLabel={defaultLabel}
              formatOptions={formatOptions}
              prefix={prefix}
              suffix={suffix}
            />
          </div>
        ) : null}
      </div>
    ) : null;

  if (fixedSize) {
    return (
      <div className={className} data-bkm-chart="gauge" style={{ position: "relative", display: "inline-flex", maxWidth: "100%", ...style }}>
        {inner}
      </div>
    );
  }

  return (
    <div
      className={className}
      data-bkm-chart="gauge"
      style={{ position: "relative", width: "100%", maxWidth: "100%", minWidth: resolvedMinWidth, ...style }}
    >
      <div
        ref={containerRef}
        style={{
          margin: "0 auto",
          width: "100%",
          maxWidth: ARC_MAX_WIDTH,
          aspectRatio: String(ARC_ASPECT_RATIO),
        }}
      >
        {inner}
      </div>
    </div>
  );
}

// ============================================================================
// Linear
// ============================================================================
type GaugeLinearProps = Omit<GaugeProps, "orientation" | "startAngle" | "endAngle">;

function GaugeLinear(props: GaugeLinearProps) {
  const {
    width: widthProp,
    height: heightProp,
    className,
    minWidth,
    style,
    value,
    totalNotches = 40,
    spacing = 25,
    notchCornerRadius = 0,
    uniformWidth = true,
    useGradient = false,
    activeGradient,
    inactiveGradient,
    centerValue,
    defaultLabel = "Total",
    prefix,
    suffix,
    formatOptions = defaultCenterStatFormat,
    labelPlacement = "top",
    labelAlign = "start",
    inactiveFill,
    activeFill,
    inactiveFillOpacity,
    activeFillOpacity,
    children,
    notchLengthPercent = 100,
    notchWidthPercent = 80,
    linearHeight,
    enterTransition,
    enterStaggerScale = 1,
    geometryScrubbing = false,
  } = props;

  const prefersReducedMotion = usePrefersReducedMotion();
  const fillState = useGaugeFillState({
    useGradient,
    activeGradient,
    inactiveGradient,
    inactiveFill,
    activeFill,
    inactiveFillOpacity,
    activeFillOpacity,
    children,
    totalNotches,
  });

  const resolvedLinearHeight = linearHeight ?? DEFAULT_LINEAR_GAUGE_HEIGHT;
  const resolvedMinWidth = minWidth ?? 200;
  const fixedWidth = widthProp != null;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    if (fixedWidth) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setMeasuredWidth((prev) => (Math.abs(prev - rect.width) > 0.5 ? rect.width : prev));
    });
    ro.observe(el);
    setMeasuredWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [fixedWidth]);

  const width = widthProp ?? measuredWidth;
  const height = heightProp ?? resolvedLinearHeight;

  const geometry = React.useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    return computeLinearNotches({
      width,
      height,
      totalNotches,
      spacing,
      uniformWidth,
      notchLengthPercent,
      notchWidthPercent,
      value,
      useGradient,
      useThemePaletteGradient: fillState.useThemePaletteGradient,
      activeGrad0: fillState.activeGrad0,
      activeGrad1: fillState.activeGrad1,
    });
  }, [
    width,
    height,
    totalNotches,
    spacing,
    uniformWidth,
    notchLengthPercent,
    notchWidthPercent,
    value,
    useGradient,
    fillState.useThemePaletteGradient,
    fillState.activeGrad0,
    fillState.activeGrad1,
  ]);

  const resolveBgFill = React.useCallback(
    (notchIndex: number) =>
      resolveGaugeBgFill({
        notchIndex,
        totalNotches,
        hasCustomInactive: fillState.hasCustomInactive,
        inactiveFill,
        useThemePaletteGradient: fillState.useThemePaletteGradient,
        useGradient,
        inactiveGrad0: fillState.inactiveGrad0,
        inactiveGrad1: fillState.inactiveGrad1,
        arcTrackFill: "var(--border)",
        linearTrackFill: "var(--chart-background)",
        linearMode: true,
      }),
    [
      totalNotches,
      fillState.hasCustomInactive,
      inactiveFill,
      fillState.useThemePaletteGradient,
      useGradient,
      fillState.inactiveGrad0,
      fillState.inactiveGrad1,
    ],
  );

  const resolveActiveFill = React.useCallback(
    (notch: ComputedNotch) =>
      resolveGaugeActiveFill({
        notch,
        hasCustomActive: fillState.hasCustomActive,
        activeFill,
        useThemePaletteGradient: fillState.useThemePaletteGradient,
        themeActiveGradientId: fillState.themeActiveGradientId,
        useGradient,
        activeFillSolid: "var(--chart-1)",
      }),
    [
      fillState.hasCustomActive,
      activeFill,
      fillState.useThemePaletteGradient,
      fillState.themeActiveGradientId,
      useGradient,
    ],
  );

  const seenBgRef = React.useRef<Set<string>>(new Set());
  const seenActiveRef = React.useRef<Set<string>>(new Set());
  const revealAnimationsRef = React.useRef<Animation[]>([]);
  const renderGenRef = React.useRef(0);
  const groupRef = React.useRef<SVGGElement | null>(null);

  // useLayoutEffect, not useEffect: this must run PRE-PAINT so (a) the mount
  // path's group-hide is in place before the browser ever paints the fully-
  // revealed rest state (the first draft's plain useEffect ran post-paint —
  // a one-frame flash of the final gauge before the reveal started, which
  // bklit's pre-commit framer `initial` can never show), and (b) update-path
  // pop-ins are armed before the new notches' first paint (Fable review
  // fix, docs/LOG.md D52 — same fix as the arc path's handleRender).
  React.useLayoutEffect(() => {
    const groupEl = groupRef.current;
    if (!groupEl || !geometry || geometryScrubbing) return;

    renderGenRef.current += 1;
    const myGen = renderGenRef.current;
    const stagger = Math.max(0.25, Math.min(2.5, enterStaggerScale));
    const timing = prefersReducedMotion
      ? reducedMotionTiming()
      : revealTiming(resolveEnterTransition(enterTransition, GAUGE_SPRING_FALLBACK));
    const notches = geometry.notches;

    const collectTargets = (): [GaugeRevealTarget[], GaugeRevealTarget[]] => {
      const bgTargets: GaugeRevealTarget[] = Array.from(
        groupEl.querySelectorAll<SVGPathElement>('[data-bkm-key^="bg-"]'),
      ).map((el) => {
        const key = el.getAttribute("data-bkm-key") ?? "";
        const idx = Number(key.slice(3));
        const notch = notches[idx];
        if (notch) el.style.transformOrigin = `${notch.xCenter}px ${notch.yCenter}px`;
        return { key, el, delayMs: idx * 0.015 * stagger * 1000 };
      });
      const activeTargets: GaugeRevealTarget[] = Array.from(
        groupEl.querySelectorAll<SVGPathElement>('[data-bkm-key^="active-"]'),
      ).map((el) => {
        const key = el.getAttribute("data-bkm-key") ?? "";
        const idx = Number(key.slice(7));
        const notch = notches[idx];
        if (notch) el.style.transformOrigin = `${notch.xCenter}px ${notch.yCenter}px`;
        return { key, el, delayMs: (0.3 + idx * 0.02) * stagger * 1000 };
      });
      return [bgTargets, activeTargets];
    };

    const firstReveal = seenBgRef.current.size === 0 && seenActiveRef.current.size === 0;
    if (!firstReveal) {
      const trackReveal = trackRevealFactory(revealAnimationsRef);
      const [bgTargets, activeTargets] = collectTargets();
      reconcileGaugeReveal(bgTargets, seenBgRef.current, timing, trackReveal);
      reconcileGaugeReveal(activeTargets, seenActiveRef.current, timing, trackReveal);
      return;
    }

    deferredGaugeMountReveal(groupEl, collectTargets, timing, seenBgRef, seenActiveRef, revealAnimationsRef, renderGenRef, myGen);
  });

  React.useEffect(() => {
    return () => {
      for (const anim of revealAnimationsRef.current) anim.cancel();
      revealAnimationsRef.current = [];
    };
  }, []);

  const label =
    centerValue == null ? null : (
      <GaugeLabelStat
        align={labelAlign}
        centerValue={centerValue}
        defaultLabel={defaultLabel}
        formatOptions={formatOptions}
        prefix={prefix}
        suffix={suffix}
      />
    );

  const svg =
    geometry && width > 0 ? (
      <svg
        aria-hidden="true"
        height={height}
        style={{ display: "block", width: "100%", overflow: "visible" }}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        {fillState.defsChildren.length > 0 || fillState.useThemePaletteGradient ? (
          <defs>
            {fillState.useThemePaletteGradient ? (
              <linearGradient id={fillState.themeActiveGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="var(--chart-1)" />
                <stop offset="100%" stopColor="var(--chart-5)" />
              </linearGradient>
            ) : null}
            {fillState.defsChildren}
          </defs>
        ) : null}
        <g ref={groupRef}>
          {geometry.notches.map((notch) => (
            <path
              d={createNotchPath(notch.points, notchCornerRadius, geometry.cornerVerticalDepth)}
              data-bkm-key={`bg-${notch.index}`}
              fill={resolveBgFill(notch.index)}
              fillOpacity={fillState.resolvedInactiveFillOpacity}
              key={`bg-${notch.index}`}
            />
          ))}
          {geometry.notches
            .filter((notch) => notch.isActive)
            .map((notch) => (
              <path
                d={createNotchPath(notch.points, notchCornerRadius, geometry.cornerVerticalDepth)}
                data-bkm-key={`active-${notch.index}`}
                fill={resolveActiveFill(notch)}
                fillOpacity={fillState.resolvedActiveFillOpacity}
                key={`active-${notch.index}`}
              />
            ))}
        </g>
      </svg>
    ) : null;

  const track = (
    <div style={{ position: "relative", width: "100%", height }}>{svg}</div>
  );

  const body = (
    <GaugeLabelLayout align={labelAlign} label={label} placement={labelPlacement}>
      {track}
    </GaugeLabelLayout>
  );

  if (fixedWidth) {
    return (
      <div className={className} data-bkm-chart="gauge" style={{ position: "relative", width: "100%", maxWidth: "100%", ...style }}>
        <div style={{ width: widthProp }}>{body}</div>
      </div>
    );
  }

  return (
    <div
      className={className}
      data-bkm-chart="gauge"
      style={{ position: "relative", width: "100%", minWidth: 0, maxWidth: "100%", ...style }}
    >
      <div ref={containerRef} style={{ width: "100%", minWidth: resolvedMinWidth }}>
        {width > 0 ? body : null}
      </div>
    </div>
  );
}

// ============================================================================
// Public dispatcher
// ============================================================================
export function Gauge({ orientation = "arc", ...rest }: GaugeProps) {
  if (orientation === "linear") {
    return <GaugeLinear {...rest} />;
  }
  return <GaugeArc {...rest} />;
}

Gauge.displayName = "Gauge";
