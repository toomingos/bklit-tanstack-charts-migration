"use client";

// Native TanStack Charts gauge (notch marks in gauge/definition.ts); value changes morph natively. Only the centre/label
// stat reuses the bklit number-flow helpers (TanStack has no number-tween text mark).
import { useMemo, useRef } from "react";
import { useHydratingAttrs } from "./kit/use-hydrating";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { defaultGaugeStatFormat, GaugeCenter, GaugeLabelLayout } from "./gauge/label";
import type { GaugeLabelAlign, GaugeLabelPlacement, GaugeStatFormat } from "./gauge/label";
import { ARC_ASPECT, buildGaugeDefinition, gaugeMotion } from "./gauge/definition";
import { clampStagger, DEFAULT_ACTIVE_FILL_OPACITY, DEFAULT_INACTIVE_FILL_OPACITY, DEFAULT_LINEAR_HEIGHT } from "./gauge/notches";
import { joinClasses } from "./kit/cn";
import { ResourceHost } from "./kit/resource-host";
import { useSanitizedId } from "./kit/use-sanitized-id";
import { useRenderStart } from "./kit/entrance/entrance-align";
import { buildEnterCss } from "./gauge/enter-css";
import { EntranceLag } from "./gauge/entrance-lag";
import { prefersReducedMotion } from "./kit/loading/reduced-motion";
import { toNotchEnter } from "./gauge/transition";
import type { GaugeEnterTransition, NotchEnter } from "./gauge/transition";

/** Gauge layout: `"arc"` around an arc, `"linear"` along a horizontal track. */
export type GaugeOrientation = "arc" | "linear";
export type { GaugeLabelAlign, GaugeLabelPlacement } from "./gauge/label";

/** Props for `Gauge`. */
export interface GaugeProps {
  /**
   * `"arc"` draws the notches around an arc; `"linear"` lays them out along a horizontal track.
   * @default "arc"
   */
  orientation?: GaugeOrientation;
  /** Fill level from 0 to 100: the share of notches drawn in the active colour. */
  value: number;
  /**
   * Number of notches.
   * @default 40
   */
  totalNotches?: number;
  /**
   * Share of the track, in percent, reserved for the gaps between notches.
   * @default 25
   */
  spacing?: number;
  /**
   * Radius in pixels used to round the corners of each notch. `0` keeps them sharp; large values are limited by the notch size and approach a capsule shape.
   * @default 0
   */
  notchCornerRadius?: number;
  /**
   * `true` draws notches with parallel sides; `false` tapers them toward the centre (arc) or midline (linear). Defaults to `false` for arc gauges and `true` for linear gauges.
   */
  uniformWidth?: boolean;
  /**
   * Angle where the arc starts, in degrees. Arc gauges only.
   * @default 135
   */
  startAngle?: number;
  /**
   * Angle where the arc ends, in degrees. Arc gauges only.
   * @default 405
   */
  endAngle?: number;
  /**
   * Colour the notches along a gradient instead of one solid colour.
   * @default false
   */
  useGradient?: boolean;
  /**
   * `[from, to]` colours for the active notches, interpolated along the notch index. Used when `useGradient` is on; defaults to `--chart-1` to `--chart-5`.
   */
  activeGradient?: readonly [string, string];
  /** `[from, to]` colours for the inactive notches. Used when `useGradient` is on; defaults to `activeGradient`. */
  inactiveGradient?: readonly [string, string];
  /**
   * Number shown in the label, which is drawn only when this is set. It is independent of `value`, so it can show a related figure such as revenue.
   */
  centerValue?: number;
  /**
   * Caption shown under (arc) or next to (linear) the `centerValue`.
   * @default "Total"
   */
  defaultLabel?: string;
  /** Text shown before the `centerValue`, for example `"$"`. */
  prefix?: string;
  /** Text shown after the `centerValue`, for example `"%"`. */
  suffix?: string;
  /**
   * Number format for the `centerValue`, in `Intl.NumberFormat` terms (notation, currency, fraction digits and so on).
   * @default { maximumFractionDigits: 0, notation: "standard" }
   */
  formatOptions?: GaugeStatFormat;
  /**
   * Where the label sits relative to a linear track. Arc gauges always draw the label in the centre.
   * @default "top"
   */
  labelPlacement?: GaugeLabelPlacement;
  /**
   * Alignment of the label across the linear track: `"start"`, `"center"` or `"end"`.
   * @default "start"
   */
  labelAlign?: GaugeLabelAlign;
  /** Colour of the inactive notches. Defaults to the `--border` colour. */
  inactiveFill?: string;
  /** Colour of the active notches. Takes precedence over the gradient options. Defaults to `--chart-1`. */
  activeFill?: string;
  /**
   * Fill opacity of the inactive notches, from 0 to 1.
   * @default 0.8
   */
  inactiveFillOpacity?: number;
  /**
   * Fill opacity of the active notches, from 0 to 1.
   * @default 1
   */
  activeFillOpacity?: number;
  /**
   * Accepted for bklit-ui compatibility; ignored. Custom SVG definitions such as patterns cannot be referenced by `activeFill` or `inactiveFill`.
   */
  children?: ReactNode;
  /** Extra class name for the root element. */
  className?: string;
  /**
   * Fixed width in pixels. Omit to fill the parent. An arc gauge is fixed-size only when both `width` and `height` are set.
   */
  width?: number;
  /**
   * Fixed height in pixels. For a linear gauge this is the track thickness; when omitted the thickness is `linearHeight`.
   */
  height?: number;
  /**
   * Minimum width in pixels when the gauge fills its parent.
   * @default 300 for arc gauges, 200 for linear gauges
   */
  minWidth?: number;
  /**
   * Length of the notches as a percentage of their full length, clamped to 5 to 100.
   * @default 100
   */
  notchLengthPercent?: number;
  /**
   * Width of each notch as a percentage of its slot, along the track. Linear gauges only.
   * @default 80
   */
  notchWidthPercent?: number;
  /**
   * Track thickness in pixels when `height` is not set. Linear gauges only.
   * @default 24
   */
  linearHeight?: number;
  /**
   * Transition for each notch's entrance, in the shape used by the `motion` library (`type`, `duration` in seconds, `ease`, and spring values).
   */
  enterTransition?: GaugeEnterTransition;
  /**
   * Multiplier for the delay between notch entrances (limited to 0.25 to 2.5).
   * @default 1
   */
  enterStaggerScale?: number;
  /** Accepted for bklit-ui compatibility; ignored. */
  geometryScrubbing?: boolean;
}

const ARC_MAX_WIDTH = 560;

// A gauge has no focusable data: `keyboard: false` makes the native host tabIndex -1 (no tab stop) while the svg stays one
// role="img" whose label carries the reading.
const gaugeAriaLabel = (value: number): string => `Gauge: ${Math.round(value)}%`;

/** The host's `--bkm-gn-*` entrance variables (gauge/enter-css.ts); absent when motion is reduced. */
const useEnterVars = (animate: boolean, enterTransition: GaugeEnterTransition | undefined, staggerScale: number): { readonly vars: CSSProperties | undefined; readonly enter: NotchEnter } => {
  const enter = useMemo(() => toNotchEnter(enterTransition), [enterTransition]);
  const stagger = clampStagger(staggerScale);
  return useMemo(() => ({
    enter,
    vars: animate ? Object.fromEntries<string | number>([["--bkm-gn-dur", `${enter.durationMs}ms`], ["--bkm-gn-s", stagger]]) : undefined,
  }), [animate, enter, stagger]);
};

// bklit paints each active notch with one `url(#gauge-theme-active)` gradient (objectBoundingBox, chart-1 -> chart-5) when `useGradient` has no `activeGradient`.
const ThemeGradient = ({ id }: { readonly id: string }): ReactElement => (
  <linearGradient id={id} x1="0%" x2="100%" y1="0%" y2="0%">
    <stop offset="0%" stopColor="var(--chart-1)" />
    <stop offset="100%" stopColor="var(--chart-5)" />
  </linearGradient>
);

type DefaultedProp = "orientation" | "totalNotches" | "spacing" | "notchCornerRadius" | "startAngle" | "endAngle" | "useGradient" | "defaultLabel" | "formatOptions" | "labelPlacement" | "labelAlign" | "inactiveFillOpacity" | "activeFillOpacity" | "notchLengthPercent" | "notchWidthPercent" | "linearHeight" | "enterStaggerScale";
type ResolvedGaugeProps = Omit<GaugeProps, DefaultedProp> & Required<Pick<GaugeProps, DefaultedProp>>;

const resolveProps = (p: GaugeProps): ResolvedGaugeProps => ({
  ...p,
  activeFillOpacity: p.activeFillOpacity ?? DEFAULT_ACTIVE_FILL_OPACITY,
  defaultLabel: p.defaultLabel ?? "Total",
  endAngle: p.endAngle ?? 405,
  enterStaggerScale: p.enterStaggerScale ?? 1,
  formatOptions: p.formatOptions ?? defaultGaugeStatFormat,
  inactiveFillOpacity: p.inactiveFillOpacity ?? DEFAULT_INACTIVE_FILL_OPACITY,
  labelAlign: p.labelAlign ?? "start",
  labelPlacement: p.labelPlacement ?? "top",
  linearHeight: p.linearHeight ?? DEFAULT_LINEAR_HEIGHT,
  notchCornerRadius: p.notchCornerRadius ?? 0,
  notchLengthPercent: p.notchLengthPercent ?? 100,
  notchWidthPercent: p.notchWidthPercent ?? 80,
  orientation: p.orientation ?? "arc",
  spacing: p.spacing ?? 25,
  startAngle: p.startAngle ?? 135,
  totalNotches: p.totalNotches ?? 40,
  useGradient: p.useGradient ?? false,
});

type GradientPair = readonly [string, string];

/** Callers pass fresh gradient tuples each render; keep one identity per colour pair so the definition only rebuilds on a real change. */
const useGradientPair = (gradient: GradientPair | undefined): GradientPair | undefined => {
  const first = gradient?.[0];
  const second = gradient?.[1];
  return useMemo(() => first === undefined || second === undefined ? undefined : [first, second] as const, [first, second]);
};

interface GaugeStyleInput {
  readonly trackHeight: number;
  readonly minWidth: number | undefined;
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly fixed: boolean;
  readonly enterVars: CSSProperties | undefined;
}

const useGaugeStyles = ({ trackHeight, minWidth, width, height, fixed, enterVars }: GaugeStyleInput): Record<"track" | "arcRoot" | "arcHost", CSSProperties> => {
  const track = useMemo((): CSSProperties => ({ height: trackHeight, minWidth: minWidth ?? 200, width: width ?? "100%" }), [trackHeight, minWidth, width]);
  const arcRoot = useMemo((): CSSProperties => ({ ...enterVars, minWidth: fixed ? undefined : (minWidth ?? 300) }), [enterVars, fixed, minWidth]);
  const arcHost = useMemo((): CSSProperties => ({ containerType: "size", ...(fixed ? { height, width } : { maxWidth: ARC_MAX_WIDTH }) }), [fixed, height, width]);
  return { arcHost, arcRoot, track };
};

const arcRootClass = (fixed: boolean, className: string | undefined): string => joinClasses("bk-gauge", fixed ? "bk-gauge-fixed" : undefined, className);
const arcHostClass = (fixed: boolean): string => fixed ? "bk-gauge-host" : "bk-gauge-host bk-gauge-host-fluid";

interface EntranceGateProps {
  readonly active: boolean;
  readonly hostRef: RefObject<HTMLDivElement | null>;
  readonly renderStart: ReturnType<typeof useRenderStart>;
}

const EntranceGate = ({ active, hostRef, renderStart }: EntranceGateProps): ReactElement | null =>
  active ? <EntranceLag hostRef={hostRef} renderStart={renderStart} /> : null;

interface GaugeDefsProps {
  readonly idPrefix: string;
  readonly themeGradientId: string;
  readonly enabled: boolean;
}

const GaugeDefs = ({ idPrefix, themeGradientId, enabled }: GaugeDefsProps): ReactElement => {
  const resources = useMemo(() => enabled ? <ThemeGradient id={themeGradientId} /> : null, [enabled, themeGradientId]);
  return <ResourceHost idPrefix={idPrefix} resources={resources} />;
};

const GaugeView = ({ resolved }: { readonly resolved: ResolvedGaugeProps }): ReactElement => {
  const {
    orientation, value, totalNotches, spacing, notchCornerRadius, uniformWidth, startAngle, endAngle,
    useGradient, activeGradient, inactiveGradient, centerValue, defaultLabel, prefix, suffix,
    formatOptions, labelPlacement, labelAlign, inactiveFill, activeFill, inactiveFillOpacity, activeFillOpacity,
    className, width, height, minWidth, notchLengthPercent, notchWidthPercent, linearHeight, enterTransition, enterStaggerScale,
  } = resolved;
  const renderStart = useRenderStart();
  const linear = orientation === "linear";
  const hostRef = useRef<HTMLDivElement>(null);
  const trackHeight = height ?? linearHeight;

  const animate = !prefersReducedMotion();
  const { vars: enterVars, enter: notchEnter } = useEnterVars(animate, enterTransition, enterStaggerScale);
  const activePair = useGradientPair(activeGradient);
  const inactivePair = useGradientPair(inactiveGradient);
  const idPrefix = useSanitizedId();
  const hydratingAttrs = useHydratingAttrs();
  const themeGradientId = `${idPrefix}-gauge-theme-active`;
  const needsThemeGradient = useGradient && activeGradient === undefined && (activeFill ?? "") === "";

  // Linear notches are rects unless tapered (`uniformWidth` false); arc notches are always straight-sided polygons, as in bklit
  // (chord inner edge by default, parallel sides when `uniformWidth`).
  const polygon = !linear || uniformWidth === false || notchCornerRadius > 0;
  const fixed = width !== undefined && height !== undefined;

  const definition = useMemo(() => buildGaugeDefinition({
    activeFillOpacity, animate, endAngle, fixedArc: fixed ? { height, width } : undefined,
    fill: { activeFill, activeGradient: activePair, inactiveFill, inactiveGradient: inactivePair, themeGradientPaint: `url(#${themeGradientId})`, total: totalNotches, useGradient },
    inactiveFillOpacity, linear, notchCornerRadius, notchLengthPercent, notchWidthPercent, polygon, spacing, startAngle, trackHeight, uniformWidth, value,
  }), [activeFill, activeFillOpacity, activePair, animate, endAngle, fixed, height, inactiveFill, inactiveFillOpacity, inactivePair, linear, notchCornerRadius, notchLengthPercent, notchWidthPercent, polygon, spacing, startAngle, themeGradientId, totalNotches, trackHeight, uniformWidth, useGradient, value, width]);

  const styles = useGaugeStyles({ enterVars, fixed, height, minWidth, trackHeight, width });

  const enterAttr = animate ? "" : undefined;
  const enterCss = animate ? <style>{buildEnterCss(notchEnter)}</style> : null;

  if (linear) {
    const track = (
      <div ref={hostRef} style={styles.track}>
        <EntranceGate active={animate} hostRef={hostRef} renderStart={renderStart} />
        <RendererChart ariaLabel={gaugeAriaLabel(value)} definition={definition} height={trackHeight} renderer={gaugeMotion} width={width} />
        <GaugeDefs enabled={needsThemeGradient} idPrefix={idPrefix} themeGradientId={themeGradientId} />
      </div>
    );
    return (
      <div className={joinClasses("bk-gauge-flow", className)} data-bkm-chart="" {...hydratingAttrs} data-bkm-gn={enterAttr} style={enterVars}>
        {enterCss}
        <GaugeLabelLayout align={labelAlign} format={formatOptions} label={defaultLabel} placement={labelPlacement} prefix={prefix} suffix={suffix} value={centerValue}>{track}</GaugeLabelLayout>
      </div>
    );
  }

  // Entrance starts on the first draw, without bklit's ParentSize frames (gauge.tsx:685), at the user's direction (no frame waits); the curve is unchanged.
  return (
    <div className={arcRootClass(fixed, className)} data-bkm-chart="" {...hydratingAttrs} data-bkm-gn={enterAttr} style={styles.arcRoot}>
      {enterCss}
      <div className={arcHostClass(fixed)} ref={hostRef} style={styles.arcHost}>
        <EntranceGate active={animate} hostRef={hostRef} renderStart={renderStart} />
        <RendererChart ariaLabel={gaugeAriaLabel(value)} aspectRatio={fixed ? undefined : ARC_ASPECT} definition={definition} height={fixed ? height : undefined} renderer={gaugeMotion} width={fixed ? width : undefined} />
        <GaugeDefs enabled={needsThemeGradient} idPrefix={idPrefix} themeGradientId={themeGradientId} />
        {centerValue !== undefined ? <GaugeCenter format={formatOptions} label={defaultLabel} prefix={prefix} suffix={suffix} value={centerValue} /> : null}
      </div>
    </div>
  );
};

/**
 * Notch gauge that shows a 0 to 100 `value`, as an arc (default) or a horizontal track (`orientation="linear"`). Set `centerValue` to add a label with an animated number.
 * Omit `width` and `height` to fill the parent. The gauge is server-rendered and plays its entrance after hydration.
 */
const Gauge = (props: GaugeProps): ReactElement => <GaugeView resolved={resolveProps(props)} />;

Gauge.displayName = "Gauge";

export { Gauge };
