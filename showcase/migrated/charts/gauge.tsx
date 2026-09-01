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
//    replaces the custom PolarMark from D28/D79) for the DEFAULT tapered
//    notches (`uniformWidth=false`): TWO `radialArc` marks, one for the
//    background/track (ALL notches at inactive fill opacity) and one for the
//    active overlay (ONLY active notches at active fill opacity). Notch
//    angles are pre-computed from bklit's own notchAngle/gapAngle math,
//    converted to radians (`(degrees+90)*PI/180` — bit-identical at the
//    135/405 defaults, node-verified), and passed as per-datum
//    `startAngle`/`endAngle` channels. `polar()` uses `radiusRatio: 1`;
//    inner/outer radii are functions of the layout radius matching bklit's
//    0.28/0.42 × size ratios. The focus engine is disabled via the
//    native `focusDisabled` (`@tanstack/charts/focus/disabled`), the
//    same strategy pie/ring/sunburst/radar import directly; Gauge has
//    zero hover/tooltip. Smooth pie-slice arcs replace bklit's bespoke
//    trapezoid geometry (notch corner fillets are approximated via
//    `radialArc`'s `cornerRadius`; at normal viewing distances the notch
//    shape is not distinguishable from bklit's quadrilateral paths — see
//    QA gates for pixel-diff verification). `uniformWidth=true` instead
//    uses ONE custom `PolarMark<unknown>` emitting bklit's own
//    `createNotchPath` rectangular quads (inner edge perpendicular to the
//    radial centerline — pie slices cannot express it), computed by the
//    verbatim `computeArcNotches` port, in the SAME `gauge-bg`/
//    `gauge-active` group keys so the reveal reconciler is shared.
//  - Linear: ONE custom mark (`createMark`, T17) emitting bklit's own
//    `createNotchPath` rectangular quads directly — no cartesian() exists
//    (D30 justification funnel-chart.tsx's header cites), and a horizontal
//    notch strip has no natural cartesian x/y domain to hand to
//    `defineChart` (each notch's slot position is `i*(slotWidth+gapWidth)`,
//    not a data-driven x/y value pair) — so the mark bypasses scales
//    entirely, same as the arc `uniformWidth` custom PolarMark.
//
// --- C4 (native motion, Phase 6, D432) -------------------------------------
// Reveal/update animation is now fully native: every notch is an
// individually-keyed scene node (`radialArc`'s own `key`, or this file's
// explicit `gauge-bg:{i}`/`gauge-active:{i}` keys on the custom marks), so
// `@tanstack/charts`' own keyed diff drives entrance (new key), exit
// (removed key) and update (existing key, e.g. a geometry-affecting prop
// change) — see each mark's `motion` callback below for the authored
// per-phase delay/transition. This reproduces the exact bklit D28 idiom
// (value increase = spring-pop only the NEWLY-active notches; value
// decrease = instant vanish, no exit animation — native `exit` gets a
// `{type:"tween",duration:0}` transition to match) with NO bookkeeping code
// in this file: no `seen` sets, no epoch/generation counters, no
// `onRender`/`handleRender` at all. `internal/gauge-reveal.ts`'s header has
// the full derivation (including the one disclosed delta: native per-datum
// arc entrance animates opacity only, not the legacy scale(0)->scale(1)
// half of the pop — confirmed via direct `dist/motion.js` reading, no
// native per-datum scale primitive exists for arc-role marks).
//
// Gradient `<defs>` for the arc path's theme-palette gradient
// (`useGradient && activeGradient === undefined`) use `defineChart`'s own
// `gradients: ChartLinearGradient[]` option. Previously routed through
// `renderSvg={renderChartSvgWithResources}` on the old `<Chart>` — reading
// `dist/svg-resources.js` this session shows `renderChartSvgWithResources`
// is a bare re-export of `renderChartSvg` (`dist/svg.js`), i.e. `<Chart>`'s
// own DEFAULT renderer, which already renders `scene.gradients` into a
// `<defs>` block via `renderGradients()` unconditionally — so that prop was
// always redundant, not a special add-on. `<RendererChart>`'s adapter
// (`@tanstack/charts/adapter/renderer`) shares the same scene-rendering
// core, so gradients keep working with no `renderSvg` prop at all — nothing
// to replace it with. bklit's `children`-as-defs escape hatch
// (`collectGaugeDefsElements` — arbitrary caller-supplied
// `<linearGradient>`/`<pattern>` JSX passed as `<Gauge>` children) is
// unrelated to this and unaffected: it works on BOTH orientations exactly
// as before (linear drops the elements into its own real `<defs>`; arc
// mounts them on a 0×0 sibling overlay svg after the chart — SVG
// paint-server `url(#id)` references resolve document-wide, not just within
// the same `<svg>` subtree).
//
// Center readout reuses internal/center-stat.tsx's `CenterStat` UNMODIFIED
// (per this deliverable's own instruction) via internal/gauge-center.tsx's
// `GaugeCenterOverlay` (arc — PieCenterShell's 0->centerValue double-rAF
// mount-entrance trick, ported 1:1) and `GaugeLabelStat` + `GaugeLabelLayout`
// (linear — direct pass-through, NO entrance trick, matching bklit's own
// real orientation divergence — see gauge-center.tsx's header for the
// source citations).
//
// Reduced motion: no longer a local `usePrefersReducedMotion` branch here —
// the native motion renderer (`internal/motion-renderer.ts`'s
// `chartMotionRenderer()`) already respects `prefers-reduced-motion` by
// default (`respectReducedMotion: true`, confirmed against
// `dist/motion.js`'s `createSvgMotionRuntime` policy default), the same
// trust-the-renderer stance pie/ring's C2/C3 native motion paths take.
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
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { createMark, type SceneNode } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { polar, radialArc, type PolarMark } from "@tanstack/charts/polar";
import {
  collectGaugeDefsElements,
  computeArcNotches,
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
  type NotchPoint,
} from "./internal/gauge-notch";
import {
  GAUGE_SPRING_FALLBACK,
  gaugeMotionTransition,
  type GaugeEnterTransition,
} from "./internal/gauge-reveal";
import { resolveEnterTransition } from "./internal/enter-transition";
import {
  GaugeCenterOverlay,
  GaugeLabelLayout,
  GaugeLabelStat,
  type GaugeLabelAlign,
  type GaugeLabelPlacement,
} from "./internal/gauge-center";
import { nativeStaggerDelayMs } from "./internal/native-stagger";
import { defaultCenterStatFormat, type CenterStatFormat } from "./internal/center-stat";
import { chartMotionRenderer } from "./internal/motion-renderer";
import type { ChartMotionContext } from "@tanstack/charts";
import {
  useDebouncedContainerSize,
  useDebouncedContainerWidth,
} from "./internal";
import "./styles.css";

export type { GaugeEnterTransition } from "./internal/enter-transition";
export type { GaugeLabelAlign, GaugeLabelPlacement } from "./internal/gauge-center";

// Gauge has zero pointer/tooltip interaction — see the native `focusDisabled`
// import above (`@tanstack/charts/focus/disabled`).

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
  /** Custom `<linearGradient>`/`<pattern>` defs (children-as-defs escape
      hatch, honored on both orientations). */
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
  // G5 (bklit ParentSize debounceTime={10}): responsive arc measurement goes
  // through the debounced width+height hook. The ref is only ever attached on
  // the responsive render path (the fixed-size wrapper never mounts it), so
  // the hook observes nothing in fixed mode — same net effect as legacy not
  // rendering ParentSize in that branch.
  const { width: measuredW, height: measuredH } = useDebouncedContainerSize(containerRef);

  const width = widthProp ?? measuredW;
  const height = heightProp ?? measuredH;
  const size = Math.min(width, height);

  // --- Compute arc rows (flat datums for radialArc, one per notch) ---
  const arcRows = React.useMemo((): { bgRows: GaugeArcRow[]; activeRows: GaugeArcRow[]; innerRadiusRatio: number; outerRadiusRatio: number } | null => {
    if (width <= 0 || height <= 0) return null;

    // Radius ratios: bklit outerRadius = size * 0.42 → polarRadius = size/2 → ratio = 0.84
    const outerRadiusRatio = 0.84;
    const depthFactor = Math.min(100, Math.max(5, notchLengthPercent)) / 100;
    // bklit innerRadius = outerRadius - (outerRadius - size*0.28) * depthFactor
    //   = size * 0.42 - size * 0.14 * depthFactor
    // innerRadiusRatio = (size*0.42 - size*0.14*depthFactor) / (size/2) = 0.84 - 0.28*depthFactor
    const innerRadiusRatio = 0.84 - 0.28 * depthFactor;

    // Degrees → TanStack/d3 arc radians: bklit's 135/405 angle convention (0°
    // = 3 o'clock, CCW positive, from notch-gauge-shared's `cos/sin` math)
    // maps onto d3's arc convention (0 = 12 o'clock, CW positive) via
    // `radians = (degrees + 90) * PI/180` — verified bit-identical at the
    // defaults: 135 → −3π/4, 405 → 3π/4.
    const startAngleRad = ((startAngle + 90) * Math.PI) / 180;
    const endAngleRad = ((endAngle + 90) * Math.PI) / 180;
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
    startAngle,
    endAngle,
    notchLengthPercent,
    value,
    useGradient,
    fillState,
    inactiveFill,
    activeFill,
  ]);

  // `uniformWidth` — bklit's rectangular quads (gauge.tsx `GaugeNotchSvg`,
  // `createNotchPath` with `cornerDepth = notchLength`): the notch's inner
  // edge is PERPENDICULAR to its radial centerline instead of sitting on the
  // inner-radius circle, so `radialArc` pie slices cannot express it. All
  // geometry comes from `computeArcNotches` (the verbatim port of bklit's
  // own arc notch math, absolute pixel space) + bklit's own fill resolvers;
  // fills are precomputed here so the custom PolarMark's render closure only
  // re-emits paths when this memo's inputs change.
  interface UniformArcRow {
    notchIndex: number;
    points: NotchPoint;
    fill: string;
  }
  const uniformRows = React.useMemo<{
    bg: UniformArcRow[];
    active: UniformArcRow[];
    notchLength: number;
  } | null>(() => {
    if (width <= 0 || height <= 0) return null;
    const geometry = computeArcNotches({
      width,
      height,
      totalNotches,
      spacing,
      uniformWidth: true,
      startAngle,
      endAngle,
      notchLengthPercent,
      value,
      useGradient,
      useThemePaletteGradient: fillState.useThemePaletteGradient,
      activeGrad0: fillState.activeGrad0,
      activeGrad1: fillState.activeGrad1,
    });
    const bg: UniformArcRow[] = [];
    const active: UniformArcRow[] = [];
    for (const notch of geometry.notches) {
      bg.push({
        notchIndex: notch.index,
        points: notch.points,
        fill: resolveGaugeBgFill({
          notchIndex: notch.index,
          totalNotches,
          hasCustomInactive: fillState.hasCustomInactive,
          inactiveFill,
          useThemePaletteGradient: fillState.useThemePaletteGradient,
          useGradient,
          inactiveGrad0: fillState.inactiveGrad0,
          inactiveGrad1: fillState.inactiveGrad1,
          arcTrackFill: "var(--border)",
          linearTrackFill: "var(--chart-background)",
          linearMode: false,
        }),
      });
      if (notch.isActive) {
        active.push({
          notchIndex: notch.index,
          points: notch.points,
          fill: resolveGaugeActiveFill({
            notch,
            hasCustomActive: fillState.hasCustomActive,
            activeFill,
            useThemePaletteGradient: fillState.useThemePaletteGradient,
            themeActiveGradientId: fillState.themeActiveGradientId,
            useGradient,
            activeFillSolid: "var(--chart-1)",
          }),
        });
      }
    }
    return { bg, active, notchLength: geometry.notchLength };
  }, [
    width,
    height,
    totalNotches,
    spacing,
    startAngle,
    endAngle,
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
  // `uniformWidth` switch: false → stock `radialArc` pie slices (banked
  // approximation of bklit's tapered quads, D82); true → ONE custom
  // PolarMark that emits bklit's own `createNotchPath` rectangular quads in
  // two scene groups keyed exactly "gauge-bg"/"gauge-active" so the shared
  // reveal machinery (`collectTargets` → `[data-ts-key=...]` groups → path
  // children) keeps working unchanged. Node coordinates are polar-relative
  // (TanStack translates the polar container by layout.centerX/Y), so the
  // absolute-pixel points from `computeArcNotches` are shifted by
  // `-(layout.centerX, layout.centerY)` at render time.
  const definition = React.useMemo(() => {
    if (!arcRows || (uniformWidth && !uniformRows)) return null;

    // T-D3: bklit's own stagger scalar, clamped exactly as the pre-C4
    // `handleRender` clamped it — app-level config, unaffected by the
    // enter/exit/update mechanism switching to native.
    const stagger = Math.max(0.25, Math.min(2.5, enterStaggerScale));

    // C4 (native motion, D432): shared per-notch enter/exit/update — new
    // key (activeNotches grew, or first mount) pops in with the legacy
    // bg/active stagger delay; removed key (activeNotches shrank) vanishes
    // instantly (`{type:"tween",duration:0}`, matching bklit's D28 "value
    // decrease = no exit animation" idiom); an existing, still-present key
    // whose `d`/fill changed (e.g. a geometry prop change) morphs on the
    // SAME resolved enterTransition timing — native's own keyed diff
    // (`reconcileMotionElement`, dist/motion.js) replaces the old
    // `reconcileGaugeReveal` bookkeeping entirely (gauge-reveal.ts header).
    const notchMotion = (isActiveGroup: boolean) =>
      (ctx: ChartMotionContext<GaugeArcRow>) => {
        if (ctx.phase === "exit") {
          return { transition: { type: "tween" as const, duration: 0 } };
        }
        const resolved = resolveEnterTransition(enterTransition, GAUGE_SPRING_FALLBACK);
        if (ctx.phase === "update") {
          return { transition: gaugeMotionTransition(resolved) };
        }
        const idx = ctx.datumIndex ?? 0;
        return {
          delay: isActiveGroup
            ? nativeStaggerDelayMs(0.02 * stagger * 1000, 0.3 * stagger * 1000, idx, "arc")
            : nativeStaggerDelayMs(0.015 * stagger * 1000, 0, idx, "arc"),
          transition: gaugeMotionTransition(resolved),
        };
      };

    if (uniformWidth && uniformRows) {
      const { bg, active, notchLength } = uniformRows;
      // The custom quad mark's own scene tree nests per-notch children
      // (`gauge-bg:{i}`/`gauge-active:{i}`) inside two GROUP nodes
      // (`gauge-bg`/`gauge-active`, keyed without a `:`). Only the
      // per-notch children carry semantic identity — giving the group
      // its OWN opacity fade on top of each child's fade would compound
      // multiplicatively (nested SVG group/child opacity stacks), so the
      // group-level keys opt out (`return false`) and only children
      // animate, same net contract as the stock `radialArc` marks below
      // (whose own per-datum keys have no such wrapper ambiguity).
      const quadMark: PolarMark<unknown> = {
        motion: (ctx) => {
          const sep = ctx.key.indexOf(":");
          if (sep === -1) return false;
          const isActiveGroup = ctx.key.startsWith("gauge-active:");
          if (ctx.phase === "exit") {
            return { transition: { type: "tween", duration: 0 } };
          }
          const resolved = resolveEnterTransition(enterTransition, GAUGE_SPRING_FALLBACK);
          if (ctx.phase === "update") {
            return { transition: gaugeMotionTransition(resolved) };
          }
          const idx = Number(ctx.key.slice(sep + 1));
          return {
            delay: isActiveGroup
              ? nativeStaggerDelayMs(0.02 * stagger * 1000, 0.3 * stagger * 1000, idx, "arc")
              : nativeStaggerDelayMs(0.015 * stagger * 1000, 0, idx, "arc"),
            transition: gaugeMotionTransition(resolved),
          };
        },
        initialize: () => ({
          id: "gauge-bg",
          colorValues: [],
          angleValues: [],
          radiusValues: [],
          includeZeroRadius: false,
          requiresAngleScale: false,
          requiresRadiusScale: false,
          render: ({ layout }) => {
            const tx = layout.centerX;
            const ty = layout.centerY;
            const pathFor = (row: UniformArcRow): string =>
              createNotchPath(
                {
                  x1: row.points.x1 - tx,
                  y1: row.points.y1 - ty,
                  x2: row.points.x2 - tx,
                  y2: row.points.y2 - ty,
                  x3: row.points.x3 - tx,
                  y3: row.points.y3 - ty,
                  x4: row.points.x4 - tx,
                  y4: row.points.y4 - ty,
                },
                notchCornerRadius,
                notchLength,
              );
            const nodes: SceneNode[] = [];
            if (bg.length > 0) {
              nodes.push({
                kind: "group",
                key: "gauge-bg",
                className: "ts-chart__arc",
                ariaHidden: true,
                children: bg.map(
                  (row): SceneNode => ({
                    kind: "polyline",
                    key: `gauge-bg:${row.notchIndex}`,
                    points: [],
                    path: pathFor(row),
                    style: {
                      fill: row.fill,
                      fillOpacity: fillState.resolvedInactiveFillOpacity,
                      stroke: "none",
                    },
                  }),
                ),
              });
            }
            if (active.length > 0) {
              nodes.push({
                kind: "group",
                key: "gauge-active",
                className: "ts-chart__arc",
                ariaHidden: true,
                children: active.map(
                  (row): SceneNode => ({
                    kind: "polyline",
                    key: `gauge-active:${row.notchIndex}`,
                    points: [],
                    path: pathFor(row),
                    style: {
                      fill: row.fill,
                      fillOpacity: fillState.resolvedActiveFillOpacity,
                      stroke: "none",
                    },
                  }),
                ),
              });
            }
            return { nodes };
          },
        }),
      };

      return defineChart({
        marks: [
          polar({
            radiusRatio: 1,
            marks: [quadMark],
          }),
        ],
        scales: { x: null, y: null },
        guides: false,
        focus: focusDisabled,
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
    }

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
              motion: notchMotion(false),
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
              motion: notchMotion(true),
            }),
          ],
        }),
      ],
      scales: { x: null, y: null },
      guides: false,
      focus: focusDisabled,
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
    uniformWidth,
    uniformRows,
    notchCornerRadius,
    fillState.resolvedInactiveFillOpacity,
    fillState.resolvedActiveFillOpacity,
    fillState.useThemePaletteGradient,
    fillState.themeActiveGradientId,
    enterTransition,
    enterStaggerScale,
  ]);

  const resolvedMinWidth = minWidth ?? 300;

  const inner =
    definition && size > 0 ? (
      <div style={{ position: "relative", width, height }}>
        <RendererChart
          ariaLabel="Gauge chart"
          definition={definition}
          height={height}
          renderer={chartMotionRenderer()}
          width={width}
        />
        {fillState.defsChildren.length > 0 ? (
          // G2 (parity fix): bklit's children-as-defs escape hatch
          // (collectGaugeDefsElements — arbitrary caller `<linearGradient>`/
          // `<pattern>` JSX) previously dropped on the arc path. Mounted on a
          // 0×0 overlay svg AFTER <Chart>: SVG paint-server url(#id) refs
          // resolve document-wide (same verified mechanism as scatter's
          // sibling defs svg), and the after-<Chart> position keeps the real
          // chart SVG as the first svg in the QA harness's DOM-order lookup.
          <svg
            width={0}
            height={0}
            style={{ position: "absolute" }}
            aria-hidden="true"
            focusable="false"
          >
            <defs>{fillState.defsChildren}</defs>
          </svg>
        ) : null}
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
  // G5 (bklit ParentSize debounceTime={10}): same debounce as the arc path —
  // the ref is only attached on the responsive render path.
  const measuredWidth = useDebouncedContainerWidth(containerRef);

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

  // --- TanStack definition (T17): ONE custom mark (`createMark`, placed
  // directly in `defineChart`'s flat `marks` array — no cartesian() exists,
  // same D30 justification funnel-chart.tsx's header cites) emitting bklit's
  // own `createNotchPath` rectangular quads into the SAME "gauge-bg"/
  // "gauge-active" scene-group keys the arc `uniformWidth` custom PolarMark
  // uses above, so `handleRender` below can reuse that mark's exact
  // `data-ts-key` query pattern. UNLIKE the arc mark, this mark's nodes need
  // ZERO translation: `computeLinearNotches`' `.points` are already absolute
  // pixel coordinates in the svg's own 0..width/0..height space (arc's
  // points are polar-relative, hence its `-(centerX, centerY)` shift) —
  // `margin: {top:0,right:0,bottom:0,left:0}` pins `chart.x/y` at 0 so
  // nothing WOULD offset them even if this mark's `render` consulted
  // `chart`/`layout` (it doesn't), and `notch.points` is passed into
  // `createNotchPath` completely unchanged, byte-identical to the pre-port
  // `<path d={createNotchPath(notch.points, ...)}>` calls this replaces.
  const definition = React.useMemo(() => {
    if (!geometry) return null;
    const notches = geometry.notches;
    const cornerVerticalDepth = geometry.cornerVerticalDepth;
    const activeNotches = notches.filter((notch) => notch.isActive);

    // T-D3: same clamped stagger scalar as arc's own memo.
    const stagger = Math.max(0.25, Math.min(2.5, enterStaggerScale));

    // C4 (native motion, D432): same per-notch enter/exit/update contract
    // as GaugeArc's `notchMotion` (this memo's own sibling helper couldn't
    // be shared directly — GaugeLinear's mark has no `ChartMotionContext`
    // datum binding since it bypasses scales entirely, same reason its
    // `render` reads closured `notches`/`activeNotches` instead of channels
    // — so notch index comes from parsing `ctx.key`, exactly like arc's
    // `uniformWidth` custom PolarMark). `geometryScrubbing` additionally
    // suppresses ALL motion while a caller is actively dragging the value
    // (only GaugeLinear exposes that prop) — matches the pre-C4
    // `handleRender`'s own `if (geometryScrubbing || !geometry) return;`
    // early-out, which skipped scheduling reveal animations outright.
    const quadMark = createMark(
      () => ({
        id: "gauge-linear",
        channels: {},
        render: () => {
          const nodes: SceneNode[] = [];
          if (notches.length > 0) {
            nodes.push({
              kind: "group",
              key: "gauge-bg",
              className: "ts-chart__arc",
              ariaHidden: true,
              children: notches.map(
                (notch): SceneNode => ({
                  kind: "polyline",
                  key: `gauge-bg:${notch.index}`,
                  points: [],
                  path: createNotchPath(notch.points, notchCornerRadius, cornerVerticalDepth),
                  style: {
                    fill: resolveBgFill(notch.index),
                    fillOpacity: fillState.resolvedInactiveFillOpacity,
                    stroke: "none",
                  },
                }),
              ),
            });
          }
          if (activeNotches.length > 0) {
            nodes.push({
              kind: "group",
              key: "gauge-active",
              className: "ts-chart__arc",
              ariaHidden: true,
              children: activeNotches.map(
                (notch): SceneNode => ({
                  kind: "polyline",
                  key: `gauge-active:${notch.index}`,
                  points: [],
                  path: createNotchPath(notch.points, notchCornerRadius, cornerVerticalDepth),
                  style: {
                    fill: resolveActiveFill(notch),
                    fillOpacity: fillState.resolvedActiveFillOpacity,
                    stroke: "none",
                  },
                }),
              ),
            });
          }
          return { nodes };
        },
      }),
      (ctx) => {
        if (geometryScrubbing) return false;
        const sep = ctx.key.indexOf(":");
        if (sep === -1) return false;
        const isActiveGroup = ctx.key.startsWith("gauge-active:");
        if (ctx.phase === "exit") {
          return { transition: { type: "tween", duration: 0 } };
        }
        const resolved = resolveEnterTransition(enterTransition, GAUGE_SPRING_FALLBACK);
        if (ctx.phase === "update") {
          return { transition: gaugeMotionTransition(resolved) };
        }
        const idx = Number(ctx.key.slice(sep + 1));
        return {
          delay: isActiveGroup
            ? nativeStaggerDelayMs(0.02 * stagger * 1000, 0.3 * stagger * 1000, idx, "arc")
            : nativeStaggerDelayMs(0.015 * stagger * 1000, 0, idx, "arc"),
          transition: gaugeMotionTransition(resolved),
        };
      },
    );

    return defineChart({
      marks: [quadMark],
      scales: { x: null, y: null },
      guides: false,
      focus: focusDisabled,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
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
    geometry,
    notchCornerRadius,
    resolveBgFill,
    resolveActiveFill,
    fillState.resolvedInactiveFillOpacity,
    fillState.resolvedActiveFillOpacity,
    fillState.useThemePaletteGradient,
    fillState.themeActiveGradientId,
    geometryScrubbing,
    enterTransition,
    enterStaggerScale,
  ]);

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

  // T17/C4: raw `<svg>` → TanStack `<RendererChart>` (mirrors GaugeArc's G2
  // pattern exactly). Literal-px `width`/`height` (not `width:"100%"`) on
  // this host div, matching arc's own `{position:"relative", width,
  // height}` — `width` here is already the exact measured container pixel
  // width fed into `computeLinearNotches`/the viewBox math, so this is
  // deterministic rather than relying on a second, independent `%`-based
  // resolution to coincide with it. See the T17 report for the one place
  // this literal-px choice changes behavior versus the pre-port
  // `width:"100%"` svg: the disclosed, pre-existing
  // `labelPlacement="left"|"right"` overflow quirk (this file's header) now
  // overflows its flex sibling instead of visually squishing — neither the
  // frozen bench scenario nor docs-mdx pattern hits that branch.
  const svg =
    definition && width > 0 ? (
      <div style={{ position: "relative", width, height }}>
        <RendererChart
          ariaLabel="Gauge chart"
          definition={definition}
          height={height}
          renderer={chartMotionRenderer()}
          width={width}
        />
        {fillState.defsChildren.length > 0 ? (
          // G2 (parity fix, mirrored verbatim from GaugeArc): bklit's
          // children-as-defs escape hatch can no longer drop into this
          // component's own <defs> since it no longer owns a hand-rolled
          // <svg>. Mounted on a 0×0 overlay svg AFTER <RendererChart>: SVG
          // paint-server url(#id) refs resolve document-wide (same verified
          // mechanism as arc's/scatter's sibling defs svg), and the
          // after-chart position keeps the real chart svg first in DOM
          // order for the QA harness's svg lookup. (The theme palette
          // gradient itself does NOT need this treatment — it's declared via
          // `defineChart`'s own `gradients` option above and rendered
          // in-document by the renderer's own default scene rendering, same
          // as arc — see this file's header for the `renderChartSvgWithResources`
          // redundancy finding.)
          <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
            <defs>{fillState.defsChildren}</defs>
          </svg>
        ) : null}
      </div>
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
