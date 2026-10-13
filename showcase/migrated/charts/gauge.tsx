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

export type GaugeOrientation = "arc" | "linear";
export type { GaugeLabelAlign, GaugeLabelPlacement } from "./gauge/label";

export interface GaugeProps {
  orientation?: GaugeOrientation;
  value: number;
  totalNotches?: number;
  spacing?: number;
  notchCornerRadius?: number;
  uniformWidth?: boolean;
  startAngle?: number;
  endAngle?: number;
  useGradient?: boolean;
  activeGradient?: readonly [string, string];
  inactiveGradient?: readonly [string, string];
  centerValue?: number;
  defaultLabel?: string;
  prefix?: string;
  suffix?: string;
  formatOptions?: GaugeStatFormat;
  labelPlacement?: GaugeLabelPlacement;
  labelAlign?: GaugeLabelAlign;
  inactiveFill?: string;
  activeFill?: string;
  inactiveFillOpacity?: number;
  activeFillOpacity?: number;
  /** Accepted for API compatibility; custom SVG defs have no native equivalent. */
  children?: ReactNode;
  className?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  notchLengthPercent?: number;
  notchWidthPercent?: number;
  linearHeight?: number;
  enterTransition?: GaugeEnterTransition;
  enterStaggerScale?: number;
  /** Studio-only in bklit; accepted and ignored. */
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

const arcRootClass = (fixed: boolean, className: string | undefined): string => joinClasses("relative w-full max-w-full", fixed ? "inline-flex" : undefined, className);
const arcHostClass = (fixed: boolean): string => fixed ? "relative" : "relative mx-auto aspect-[21/16] w-full";

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
      <div className={joinClasses("relative w-full min-w-0 max-w-full", className)} data-bkm-chart="" {...hydratingAttrs} data-bkm-gn={enterAttr} style={enterVars}>
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

const Gauge = (props: GaugeProps): ReactElement => <GaugeView resolved={resolveProps(props)} />;

Gauge.displayName = "Gauge";

export { Gauge };
