// Bklit Gauge (arc + linear) on TanStack polar marks; linear notches bypass scales (no data domain).
// UniformWidth notches use custom quads: pie slices can't express the perpendicular inner edge.
import { useCallback, useId, useMemo, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { createMark } from '@tanstack/charts';
import type { SceneNode, ChartMotionContext, ChartMotionTiming, ChartMotionPhase, ChartLinearGradient, DomChartDefinition, MarkScene } from '@tanstack/charts';
import { defineChart } from "@tanstack/charts/scene";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { polar, radialArc } from '@tanstack/charts/polar';
import type { PolarMark } from '@tanstack/charts/polar';
import { collectGaugeDefsElements, computeArcNotches, computeLinearNotches, createNotchPath, DEFAULT_ACTIVE_FILL_OPACITY, DEFAULT_ACTIVE_GRADIENT, DEFAULT_INACTIVE_FILL_OPACITY, DEFAULT_LINEAR_GAUGE_HEIGHT, interpolateGaugeHex, resolveGaugeActiveFill, resolveGaugeBgFill } from './internal/gauge-notch';
import type { ComputedNotch, NotchPoint } from './internal/gauge-notch';
import { GAUGE_SPRING_FALLBACK, gaugeMotionTransition } from './internal/gauge-reveal';
import type { GaugeEnterTransition } from './internal/gauge-reveal';
import { resolveEnterTransition } from "./internal/enter-transition";
import { GaugeCenterOverlay, GaugeLabelLayout, GaugeLabelStat } from './internal/gauge-center';
import type { GaugeLabelAlign, GaugeLabelPlacement } from './internal/gauge-center';
import { nativeStaggerDelayMs } from "./internal/native-stagger";
import { defaultCenterStatFormat } from './internal/center-stat';
import type { CenterStatFormat } from './internal/center-stat';
import { chartMotionRenderer } from "./internal/motion-renderer";
import {
  useDebouncedContainerSize,
  useDebouncedContainerWidth,
} from "./internal/use-container-size";
import "./styles.css";

interface GaugeArcRow {
  readonly notchIndex: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly padAngle: number;
  readonly fill: string;
}

const ARC_ASPECT_WIDTH = 21;
const ARC_ASPECT_HEIGHT = 16;
const ARC_ASPECT_RATIO = ARC_ASPECT_WIDTH / ARC_ASPECT_HEIGHT;
const ARC_MAX_WIDTH = 560;
// Percent-scale factor: converts 0-100 percent inputs to 0-1 fractions.
const PERCENT_MULTIPLIER = 100;
// Seconds-to-milliseconds factor for stagger delays (nativeStaggerDelayMs takes ms).
const MS_PER_SECOND = 1000;
// Bklit 0deg = 3-o'clock/CCW maps to d3 0deg = 12-o'clock/CW: offset the origin by a quarter turn.
const POLAR_ZERO_OFFSET_DEGREES = 90;
const DEGREES_PER_HALF_TURN = 180;
// Clamp lower bound for the notchLengthPercent prop (percent).
const NOTCH_LENGTH_PERCENT_MIN = 5;
// Bklit outerRadius = size*0.42 with polarRadius = size/2, hence ratio 0.84;
// The innerRadiusRatio equals outer minus depthSpan times depthFactor (from bklit's radius formulas).
const GAUGE_OUTER_RADIUS_RATIO = 0.84;
const GAUGE_RADIUS_DEPTH_SPAN = 0.28;
// Fraction of each notch slot painted as the visible notch (remainder is gap).
const NOTCH_VISUAL_SPAN_FRACTION = 0.8;
// Enter-stagger scale clamp range.
const STAGGER_SCALE_MIN = 0.25;
const STAGGER_SCALE_MAX = 2.5;
// Per-notch stagger timing (seconds) for the active and background notch groups.
const GAUGE_ACTIVE_STAGGER_BASE_SEC = 0.02;
const GAUGE_ACTIVE_STAGGER_SPREAD_SEC = 0.3;
const GAUGE_BG_STAGGER_BASE_SEC = 0.015;
// Responsive-layout minimum-width fallbacks (px).
const GAUGE_ARC_MIN_WIDTH_PX = 300;
const GAUGE_LINEAR_MIN_WIDTH_PX = 200;
// Fraction of the gauge size used as top padding for the center overlay label.
const GAUGE_CENTER_TOP_PADDING_FRACTION = 0.08;
// Fallback track fill for inactive arc notches (matches the theme border token).
const GAUGE_ARC_TRACK_FILL = "var(--border)";
// Fallback solid fill for active arc notches (matches the primary chart token).
const GAUGE_ACTIVE_SOLID_FILL = "var(--chart-1)";
// Theme-palette gradient endpoints for the active notch group.
const GAUGE_THEME_GRADIENT_START = "var(--chart-1)";
const GAUGE_THEME_GRADIENT_END = "var(--chart-5)";
// Stroke value that hides notch outlines.
const GAUGE_HIDDEN_STROKE = "none";
// Shared class for arc notch groups.
const GAUGE_ARC_MARK_CLASS = "ts-chart__arc";
// Group keys for the background and active notch groups.
const GAUGE_BG_GROUP_KEY = "gauge-bg";
const GAUGE_ACTIVE_GROUP_KEY = "gauge-active";
const GAUGE_ACTIVE_GROUP_PREFIX = "gauge-active:";
// Zero-size overlay svg for custom defs: absolutely positioned so it never affects layout.
const GAUGE_DEFS_SVG_STYLE = { position: "absolute" } as const;
// Responsive arc sizer: fixed aspect-ratio box centered at a capped width.
const GAUGE_ARC_SIZER_STYLE = { aspectRatio: String(ARC_ASPECT_RATIO), margin: "0 auto", maxWidth: ARC_MAX_WIDTH, width: "100%" } as const;

interface ArcBgFillInput {
  readonly hasCustomInactive: boolean;
  readonly inactiveFill?: string;
  readonly useThemePaletteGradient: boolean;
  readonly useGradient: boolean;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly notchFraction: number;
}

const resolveArcBgFill = (input: Readonly<ArcBgFillInput>): string => {
  const { hasCustomInactive, inactiveFill, useThemePaletteGradient, useGradient, inactiveGrad0, inactiveGrad1, notchFraction } = input;
  if (hasCustomInactive) {
    return inactiveFill ?? GAUGE_ARC_TRACK_FILL;
  }
  if (useThemePaletteGradient) {
    return GAUGE_ARC_TRACK_FILL;
  }
  if (useGradient) {
    return interpolateGaugeHex(inactiveGrad0, inactiveGrad1, notchFraction);
  }
  return GAUGE_ARC_TRACK_FILL;
};

interface ArcActiveFillInput {
  readonly hasCustomActive: boolean;
  readonly activeFill?: string;
  readonly useThemePaletteGradient: boolean;
  readonly themeActiveGradientId: string;
  readonly useGradient: boolean;
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly notchFraction: number;
}

const resolveArcActiveFill = (input: Readonly<ArcActiveFillInput>): string => {
  const { hasCustomActive, activeFill, useThemePaletteGradient, themeActiveGradientId, useGradient, activeGrad0, activeGrad1, notchFraction } = input;
  if (hasCustomActive) {
    return activeFill ?? GAUGE_ACTIVE_SOLID_FILL;
  }
  if (useThemePaletteGradient) {
    return `url(#${themeActiveGradientId})`;
  }
  if (useGradient) {
    return interpolateGaugeHex(activeGrad0, activeGrad1, notchFraction);
  }
  return GAUGE_ACTIVE_SOLID_FILL;
};

const gaugeArcRowKey = (row: Readonly<GaugeArcRow>): string => String(row.notchIndex);

const buildGaugeThemeGradients = (themeActiveGradientId: string, useThemePaletteGradient: boolean): ChartLinearGradient[] => {
  if (!useThemePaletteGradient) {return [];}
  return [
    {
      id: themeActiveGradientId,
      stops: [
        { color: GAUGE_THEME_GRADIENT_START, offset: 0 },
        { color: GAUGE_THEME_GRADIENT_END, offset: 1 },
      ],
      x1: 0,
      x2: 1,
      y1: 0,
      y2: 0,
    },
  ];
};

interface GaugeNotchTimingOptions {
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly idx: number;
  readonly isActiveGroup: boolean;
  readonly phase: ChartMotionPhase;
}

// Shared enter/update/exit timing for arc and linear notch groups.
// Exit snaps; update retargets with the enter spring; enter staggers per notch index.
const resolveGaugeNotchTiming = (options: Readonly<GaugeNotchTimingOptions>): ChartMotionTiming => {
  const { enterStaggerScale, enterTransition, idx, isActiveGroup, phase } = options;
  if (phase === "exit") {
    return { transition: { duration: 0, type: "tween" as const } };
  }
  const resolved = resolveEnterTransition(enterTransition, GAUGE_SPRING_FALLBACK);
  if (phase === "update") {
    return { transition: gaugeMotionTransition(resolved) };
  }
  // Stagger scalar clamped to [0.25, 2.5].
  const stagger = Math.max(STAGGER_SCALE_MIN, Math.min(STAGGER_SCALE_MAX, enterStaggerScale));
  return {
    delay: isActiveGroup
      ? nativeStaggerDelayMs(GAUGE_ACTIVE_STAGGER_BASE_SEC * stagger * MS_PER_SECOND, GAUGE_ACTIVE_STAGGER_SPREAD_SEC * stagger * MS_PER_SECOND, idx, "arc")
      : nativeStaggerDelayMs(GAUGE_BG_STAGGER_BASE_SEC * stagger * MS_PER_SECOND, 0, idx, "arc"),
    transition: gaugeMotionTransition(resolved),
  };
};

interface UniformArcRow {
  readonly notchIndex: number;
  readonly points: Readonly<NotchPoint>;
  readonly fill: string;
}

interface UniformArcNodeInput {
  readonly centerX: number;
  readonly centerY: number;
  readonly notchCornerRadius: number;
  readonly notchLength: number;
  readonly row: Readonly<UniformArcRow>;
}

const uniformArcNodePath = (input: Readonly<UniformArcNodeInput>): string =>
  createNotchPath(
    {
      x1: input.row.points.x1 - input.centerX,
      x2: input.row.points.x2 - input.centerX,
      x3: input.row.points.x3 - input.centerX,
      x4: input.row.points.x4 - input.centerX,
      y1: input.row.points.y1 - input.centerY,
      y2: input.row.points.y2 - input.centerY,
      y3: input.row.points.y3 - input.centerY,
      y4: input.row.points.y4 - input.centerY,
    },
    input.notchCornerRadius,
    input.notchLength,
  );

interface UniformArcNodesInput {
  readonly rows: readonly UniformArcRow[];
  readonly keyPrefix: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly notchCornerRadius: number;
  readonly notchLength: number;
  readonly fillOpacity: number;
}

const buildUniformArcNodes = (input: Readonly<UniformArcNodesInput>): SceneNode[] => {
  const { rows, keyPrefix, centerX, centerY, notchCornerRadius, notchLength, fillOpacity } = input;
  return rows.map((row): SceneNode => ({
    key: `${keyPrefix}:${row.notchIndex}`,
    kind: "polyline",
    path: uniformArcNodePath({ centerX, centerY, notchCornerRadius, notchLength, row }),
    points: [],
    style: {
      fill: row.fill,
      fillOpacity,
      stroke: GAUGE_HIDDEN_STROKE,
    },
  }));
};

interface LinearNotchNodesInput {
  readonly notches: readonly ComputedNotch[];
  readonly keyPrefix: string;
  readonly resolveFill: (notch: ComputedNotch) => string;
  readonly notchCornerRadius: number;
  readonly cornerVerticalDepth: number;
  readonly fillOpacity: number;
}

const buildLinearNotchNodes = (input: Readonly<LinearNotchNodesInput>): SceneNode[] => {
  const { notches, keyPrefix, resolveFill, notchCornerRadius, cornerVerticalDepth, fillOpacity } = input;
  return notches.map((notch): SceneNode => ({
    key: `${keyPrefix}:${notch.index}`,
    kind: "polyline",
    path: createNotchPath(notch.points, notchCornerRadius, cornerVerticalDepth),
    points: [],
    style: {
      fill: resolveFill(notch),
      fillOpacity,
      stroke: GAUGE_HIDDEN_STROKE,
    },
  }));
};

type GaugeOrientation = "arc" | "linear";

interface GaugeProps {
  readonly orientation?: GaugeOrientation;
  readonly value: number;
  readonly totalNotches?: number;
  readonly spacing?: number;
  readonly notchCornerRadius?: number;
  /** `true` = rectangular notches; `false` = tapered toward center / midline */
  readonly uniformWidth?: boolean;
  readonly startAngle?: number;
  readonly endAngle?: number;
  readonly useGradient?: boolean;
  readonly activeGradient?: readonly [string, string];
  readonly inactiveGradient?: readonly [string, string];
  readonly centerValue?: number;
  readonly defaultLabel?: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly formatOptions?: CenterStatFormat;
  readonly labelPlacement?: GaugeLabelPlacement;
  readonly labelAlign?: GaugeLabelAlign;
  readonly inactiveFill?: string;
  readonly activeFill?: string;
  readonly inactiveFillOpacity?: number;
  readonly activeFillOpacity?: number;
  /** Custom gradient/pattern defs (children-as-defs escape hatch, both orientations). */
  readonly children?: ReactNode;
  readonly className?: string;
  readonly width?: number;
  readonly height?: number;
  readonly minWidth?: number;
  readonly notchLengthPercent?: number;
  readonly notchWidthPercent?: number;
  readonly linearHeight?: number;
  readonly enterTransition?: GaugeEnterTransition;
  readonly enterStaggerScale?: number;
  readonly geometryScrubbing?: boolean;
  /** Extra vs bklit: style, forwarded to the outer wrapper div. */
  readonly style?: Readonly<CSSProperties>;
}

interface GaugeFillStateInput {
  readonly useGradient?: boolean;
  readonly activeGradient?: readonly [string, string];
  readonly inactiveGradient?: readonly [string, string];
  readonly inactiveFill?: string;
  readonly activeFill?: string;
  readonly inactiveFillOpacity?: number;
  readonly activeFillOpacity?: number;
  readonly children?: ReactNode;
  readonly totalNotches?: number;
}

interface GaugeFillState {
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly defsChildren: readonly Readonly<ReactElement>[];
  readonly hasCustomActive: boolean;
  readonly hasCustomInactive: boolean;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly resolvedActiveFillOpacity: number;
  readonly resolvedInactiveFillOpacity: number;
  readonly themeActiveGradientId: string;
  readonly totalNotches: number;
  readonly useThemePaletteGradient: boolean;
}

interface GaugeGradientInputs {
  readonly activeGradient?: readonly [string, string];
  readonly inactiveGradient?: readonly [string, string];
  readonly useGradient: boolean;
}

interface ResolvedGaugeGradients {
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly useThemePaletteGradient: boolean;
}

const resolveGaugeGradients = (inputs: Readonly<GaugeGradientInputs>): ResolvedGaugeGradients => {
  const { activeGradient, inactiveGradient, useGradient } = inputs;
  const activeGrad0 = activeGradient?.[0] ?? DEFAULT_ACTIVE_GRADIENT[0];
  const activeGrad1 = activeGradient?.[1] ?? DEFAULT_ACTIVE_GRADIENT[1];
  return {
    activeGrad0,
    activeGrad1,
    inactiveGrad0: inactiveGradient?.[0] ?? activeGrad0,
    inactiveGrad1: inactiveGradient?.[1] ?? activeGrad1,
    useThemePaletteGradient: useGradient && activeGradient === undefined,
  };
};

const useGaugeFillState = (props: Readonly<GaugeFillStateInput>): GaugeFillState => {
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

  const themeActiveGradientId = `gauge-theme-active-${useId().replaceAll(':', "")}`;
  const defsChildren = useMemo(() => collectGaugeDefsElements(children), [children]);

  const hasCustomInactive = inactiveFill !== undefined && inactiveFill.length > 0;
  const hasCustomActive = activeFill !== undefined && activeFill.length > 0;

  const { activeGrad0, activeGrad1, inactiveGrad0, inactiveGrad1, useThemePaletteGradient } = resolveGaugeGradients({ activeGradient, inactiveGradient, useGradient });

  return {
    activeGrad0,
    activeGrad1,
    defsChildren,
    hasCustomActive,
    hasCustomInactive,
    inactiveGrad0,
    inactiveGrad1,
    resolvedActiveFillOpacity: activeFillOpacity ?? DEFAULT_ACTIVE_FILL_OPACITY,
    resolvedInactiveFillOpacity: inactiveFillOpacity ?? DEFAULT_INACTIVE_FILL_OPACITY,
    themeActiveGradientId,
    totalNotches,
    useThemePaletteGradient,
  };
}

// Both orientations forward the same nine fill props; collecting them here keeps the components short.
const collectGaugeFillStateInput = (props: Readonly<GaugeFillStateInput>): GaugeFillStateInput => {
  const { activeFill, activeFillOpacity, activeGradient, children, inactiveFill, inactiveFillOpacity, inactiveGradient, totalNotches, useGradient } = props;
  return { activeFill, activeFillOpacity, activeGradient, children, inactiveFill, inactiveFillOpacity, inactiveGradient, totalNotches, useGradient };
};

interface ArcRadii {
  readonly innerRadiusRatio: number;
  readonly outerRadiusRatio: number;
}

const resolveArcRadii = (notchLengthPercent: number): ArcRadii => {
  // Bklit outerRadius = size*0.42 with polarRadius = size/2, hence ratio 0.84.
  // InnerRadiusRatio = 0.84 - 0.28*depthFactor (from bklit's radius formulas).
  const depthFactor = Math.min(PERCENT_MULTIPLIER, Math.max(NOTCH_LENGTH_PERCENT_MIN, notchLengthPercent)) / PERCENT_MULTIPLIER;
  return {
    innerRadiusRatio: GAUGE_OUTER_RADIUS_RATIO - GAUGE_RADIUS_DEPTH_SPAN * depthFactor,
    outerRadiusRatio: GAUGE_OUTER_RADIUS_RATIO,
  };
};

interface ArcAngles {
  readonly gapAngleRad: number;
  readonly notchAngleRad: number;
  readonly notchVisualSpanRad: number;
  readonly slotWidthRad: number;
  readonly startAngleRad: number;
}

interface ResolveArcAnglesOptions {
  readonly endAngle: number;
  readonly spacing: number;
  readonly startAngle: number;
  readonly totalNotches: number;
}

const resolveArcAngles = (options: Readonly<ResolveArcAnglesOptions>): ArcAngles => {
  const { endAngle, spacing, startAngle, totalNotches } = options;
  // Bklit 0°=3-o'clock/CCW maps to d3 0°=12-o'clock/CW via radians = (degrees+90)*PI/180.
  const startAngleRad = ((startAngle + POLAR_ZERO_OFFSET_DEGREES) * Math.PI) / DEGREES_PER_HALF_TURN;
  const endAngleRad = ((endAngle + POLAR_ZERO_OFFSET_DEGREES) * Math.PI) / DEGREES_PER_HALF_TURN;
  const totalAngleRad = endAngleRad - startAngleRad;
  const spacingPct = Math.min(PERCENT_MULTIPLIER, Math.max(0, spacing)) / PERCENT_MULTIPLIER;
  const availableAngleRad = totalAngleRad * (1 - spacingPct);
  const notchAngleRad = totalNotches > 0 ? availableAngleRad / totalNotches : 0;
  const gapAngleRad = totalNotches > 1 ? (totalAngleRad * spacingPct) / (totalNotches - 1) : 0;
  return {
    gapAngleRad,
    notchAngleRad,
    notchVisualSpanRad: notchAngleRad * NOTCH_VISUAL_SPAN_FRACTION,
    slotWidthRad: notchAngleRad + gapAngleRad,
    startAngleRad,
  };
};

interface ArcRowPair {
  readonly active: GaugeArcRow | undefined;
  readonly bg: GaugeArcRow;
}

interface ArcRowPairOptions {
  readonly activeFill?: string;
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly activeNotches: number;
  readonly angles: Readonly<ArcAngles>;
  readonly denom: number;
  readonly hasCustomActive: boolean;
  readonly hasCustomInactive: boolean;
  readonly i: number;
  readonly inactiveFill?: string;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly themeActiveGradientId: string;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
}

const buildArcRowPair = (options: Readonly<ArcRowPairOptions>): ArcRowPair => {
  const { activeFill, activeGrad0, activeGrad1, activeNotches, angles, denom, hasCustomActive, hasCustomInactive, i, inactiveFill, inactiveGrad0, inactiveGrad1, themeActiveGradientId, useGradient, useThemePaletteGradient } = options;
  const slotCenterRad = angles.startAngleRad + i * angles.slotWidthRad + angles.notchAngleRad / 2;
  const bg: GaugeArcRow = {
    endAngle: slotCenterRad + angles.notchVisualSpanRad / 2,
    fill: resolveArcBgFill({
      hasCustomInactive,
      inactiveFill,
      inactiveGrad0,
      inactiveGrad1,
      notchFraction: i / denom,
      useGradient,
      useThemePaletteGradient,
    }),
    notchIndex: i,
    padAngle: 0,
    startAngle: slotCenterRad - angles.notchVisualSpanRad / 2,
  };
  if (i < activeNotches) {
    return {
      active: {
        endAngle: bg.endAngle,
        fill: resolveArcActiveFill({
          activeFill,
          activeGrad0,
          activeGrad1,
          hasCustomActive,
          notchFraction: i / denom,
          themeActiveGradientId,
          useGradient,
          useThemePaletteGradient,
        }),
        notchIndex: i,
        padAngle: 0,
        startAngle: bg.startAngle,
      },
      bg,
    };
  }
  return { active: undefined, bg };
};

interface ArcRowList {
  readonly activeRows: readonly GaugeArcRow[];
  readonly bgRows: readonly GaugeArcRow[];
}

interface BuildArcRowsOptions {
  readonly activeFill?: string;
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly activeNotches: number;
  readonly angles: Readonly<ArcAngles>;
  readonly denom: number;
  readonly hasCustomActive: boolean;
  readonly hasCustomInactive: boolean;
  readonly inactiveFill?: string;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly themeActiveGradientId: string;
  readonly totalNotches: number;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
}

const buildArcRows = (options: Readonly<BuildArcRowsOptions>): ArcRowList => {
  const { activeFill, activeGrad0, activeGrad1, activeNotches, angles, denom, hasCustomActive, hasCustomInactive, inactiveFill, inactiveGrad0, inactiveGrad1, themeActiveGradientId, totalNotches, useGradient, useThemePaletteGradient } = options;
  const bgRows: GaugeArcRow[] = [];
  const activeRows: GaugeArcRow[] = [];
  for (let i = 0; i < totalNotches; i += 1) {
    const pair = buildArcRowPair({
      activeFill, activeGrad0, activeGrad1, activeNotches, angles, denom, hasCustomActive, hasCustomInactive, i, inactiveFill, inactiveGrad0, inactiveGrad1, themeActiveGradientId, useGradient, useThemePaletteGradient,
    });
    bgRows.push(pair.bg);
    if (pair.active !== undefined) {activeRows.push(pair.active);}
  }
  return { activeRows, bgRows };
};

interface ComputeArcRowsOptions {
  readonly activeFill?: string;
  readonly endAngle: number;
  readonly fillState: Readonly<GaugeFillState>;
  readonly inactiveFill?: string;
  readonly notchLengthPercent: number;
  readonly spacing: number;
  readonly startAngle: number;
  readonly totalNotches: number;
  readonly useGradient: boolean;
  readonly value: number;
  readonly width: number;
  readonly height: number;
}

interface ArcRowsResult {
  readonly activeRows: readonly GaugeArcRow[];
  readonly bgRows: readonly GaugeArcRow[];
  readonly innerRadiusRatio: number;
  readonly outerRadiusRatio: number;
}

const computeArcRows = (options: Readonly<ComputeArcRowsOptions>): ArcRowsResult | undefined => {
  const { activeFill, endAngle, fillState, inactiveFill, notchLengthPercent, spacing, startAngle, totalNotches, useGradient, value, width, height } = options;
  if (width <= 0 || height <= 0) {return undefined;}
  const radii = resolveArcRadii(notchLengthPercent);
  const angles = resolveArcAngles({ endAngle, spacing, startAngle, totalNotches });
  const activeNotches = Math.round((value / PERCENT_MULTIPLIER) * totalNotches);
  const denom = totalNotches > 1 ? totalNotches - 1 : 1;
  const rows = buildArcRows({
    activeFill,
    activeGrad0: fillState.activeGrad0,
    activeGrad1: fillState.activeGrad1,
    activeNotches,
    angles,
    denom,
    hasCustomActive: fillState.hasCustomActive,
    hasCustomInactive: fillState.hasCustomInactive,
    inactiveFill,
    inactiveGrad0: fillState.inactiveGrad0,
    inactiveGrad1: fillState.inactiveGrad1,
    themeActiveGradientId: fillState.themeActiveGradientId,
    totalNotches,
    useGradient,
    useThemePaletteGradient: fillState.useThemePaletteGradient,
  });
  return { activeRows: rows.activeRows, bgRows: rows.bgRows, innerRadiusRatio: radii.innerRadiusRatio, outerRadiusRatio: radii.outerRadiusRatio };
};

interface UniformArcRowPair {
  readonly active: UniformArcRow | undefined;
  readonly bg: UniformArcRow;
}

interface UniformArcRowPairOptions {
  readonly activeFill?: string;
  readonly hasCustomActive: boolean;
  readonly hasCustomInactive: boolean;
  readonly inactiveFill?: string;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly notch: ComputedNotch;
  readonly themeActiveGradientId: string;
  readonly totalNotches: number;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
}

const buildUniformArcRowPair = (options: Readonly<UniformArcRowPairOptions>): UniformArcRowPair => {
  const { activeFill, hasCustomActive, hasCustomInactive, inactiveFill, inactiveGrad0, inactiveGrad1, notch, themeActiveGradientId, totalNotches, useGradient, useThemePaletteGradient } = options;
  const bg: UniformArcRow = {
    fill: resolveGaugeBgFill({
      arcTrackFill: GAUGE_ARC_TRACK_FILL,
      hasCustomInactive,
      inactiveFill,
      inactiveGrad0,
      inactiveGrad1,
      linearMode: false,
      linearTrackFill: "var(--chart-background)",
      notchIndex: notch.index,
      totalNotches,
      useGradient,
      useThemePaletteGradient,
    }),
    notchIndex: notch.index,
    points: notch.points,
  };
  if (!notch.isActive) {return { active: undefined, bg };}
  return {
    active: {
      fill: resolveGaugeActiveFill({
        activeFill,
        activeFillSolid: GAUGE_ACTIVE_SOLID_FILL,
        hasCustomActive,
        notch,
        themeActiveGradientId,
        useGradient,
        useThemePaletteGradient,
      }),
      notchIndex: notch.index,
      points: notch.points,
    },
    bg,
  };
};

interface ArcNotchMotionOptions {
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly isActiveGroup: boolean;
}

const createArcNotchMotion = (
  options: Readonly<ArcNotchMotionOptions>,
): ((ctx: ChartMotionContext<GaugeArcRow>) => ChartMotionTiming<GaugeArcRow>) => {
  const { enterStaggerScale, enterTransition, isActiveGroup } = options;
  return (ctx) => resolveGaugeNotchTiming({
    enterStaggerScale,
    enterTransition,
    idx: ctx.datumIndex ?? 0,
    isActiveGroup,
    phase: ctx.phase,
  });
};

interface UniformArcGroupNodesOptions {
  readonly active: readonly UniformArcRow[];
  readonly activeFillOpacity: number;
  readonly bg: readonly UniformArcRow[];
  readonly centerX: number;
  readonly centerY: number;
  readonly inactiveFillOpacity: number;
  readonly notchCornerRadius: number;
  readonly notchLength: number;
}

// Group keys opt out of motion; animating group+child opacity would compound.
const buildUniformArcGroupNodes = (options: Readonly<UniformArcGroupNodesOptions>): SceneNode[] => {
  const { active, activeFillOpacity, bg, centerX, centerY, inactiveFillOpacity, notchCornerRadius, notchLength } = options;
  const nodes: SceneNode[] = [];
  if (bg.length > 0) {
    nodes.push({
      ariaHidden: true,
      children: buildUniformArcNodes({
        centerX,
        centerY,
        fillOpacity: inactiveFillOpacity,
        keyPrefix: GAUGE_BG_GROUP_KEY,
        notchCornerRadius,
        notchLength,
        rows: bg,
      }),
      className: GAUGE_ARC_MARK_CLASS,
      key: GAUGE_BG_GROUP_KEY,
      kind: "group",
    });
  }
  if (active.length > 0) {
    nodes.push({
      ariaHidden: true,
      children: buildUniformArcNodes({
        centerX,
        centerY,
        fillOpacity: activeFillOpacity,
        keyPrefix: GAUGE_ACTIVE_GROUP_KEY,
        notchCornerRadius,
        notchLength,
        rows: active,
      }),
      className: GAUGE_ARC_MARK_CLASS,
      key: GAUGE_ACTIVE_GROUP_KEY,
      kind: "group",
    });
  }
  return nodes;
};

interface UniformArcQuadMarkOptions {
  readonly active: readonly UniformArcRow[];
  readonly activeFillOpacity: number;
  readonly bg: readonly UniformArcRow[];
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly inactiveFillOpacity: number;
  readonly notchCornerRadius: number;
  readonly notchLength: number;
}

// Node coords are polar-relative; absolute-pixel points shift by -(centerX, centerY) at render.
const buildUniformArcQuadMark = (options: Readonly<UniformArcQuadMarkOptions>): PolarMark => {
  const { active, activeFillOpacity, bg, enterStaggerScale, enterTransition, inactiveFillOpacity, notchCornerRadius, notchLength } = options;
  return {
    initialize: () => ({
      angleValues: [],
      colorValues: [],
      id: GAUGE_BG_GROUP_KEY,
      includeZeroRadius: false,
      radiusValues: [],
      render: ({ layout }) => ({
        nodes: buildUniformArcGroupNodes({
          active,
          activeFillOpacity,
          bg,
          centerX: layout.centerX,
          centerY: layout.centerY,
          inactiveFillOpacity,
          notchCornerRadius,
          notchLength,
        }),
      }),
      requiresAngleScale: false,
      requiresRadiusScale: false,
    }),
    motion: (ctx) => {
      const sep = ctx.key.indexOf(":");
      if (sep === -1) {return false;}
      return resolveGaugeNotchTiming({
        enterStaggerScale,
        enterTransition,
        idx: Number(ctx.key.slice(sep + 1)),
        isActiveGroup: ctx.key.startsWith(GAUGE_ACTIVE_GROUP_PREFIX),
        phase: ctx.phase,
      });
    },
  };
};

interface TaperedArcMarksOptions {
  readonly activeFillOpacity: number;
  readonly activeNotchMotion: (ctx: ChartMotionContext<GaugeArcRow>) => ChartMotionTiming<GaugeArcRow>;
  readonly activeRows: readonly GaugeArcRow[];
  readonly bgNotchMotion: (ctx: ChartMotionContext<GaugeArcRow>) => ChartMotionTiming<GaugeArcRow>;
  readonly bgRows: readonly GaugeArcRow[];
  readonly inactiveFillOpacity: number;
  readonly innerRadiusRatio: number;
  readonly notchCornerRadius: number;
  readonly outerRadiusRatio: number;
}

const buildTaperedArcMarks = (options: Readonly<TaperedArcMarksOptions>): PolarMark[] => {
  const { activeFillOpacity, activeNotchMotion, activeRows, bgNotchMotion, bgRows, inactiveFillOpacity, innerRadiusRatio, notchCornerRadius, outerRadiusRatio } = options;
  return [
    radialArc<GaugeArcRow>(bgRows, {
      cornerRadius: notchCornerRadius,
      endAngle: "endAngle",
      fill: (row) => row.fill,
      fillOpacity: inactiveFillOpacity,
      id: GAUGE_BG_GROUP_KEY,
      innerRadius: ({ radius }: { readonly radius: number }) => radius * innerRadiusRatio,
      key: gaugeArcRowKey,
      motion: bgNotchMotion,
      outerRadius: ({ radius }: { readonly radius: number }) => radius * outerRadiusRatio,
      padAngle: "padAngle",
      startAngle: "startAngle",
    }),
    radialArc<GaugeArcRow>(activeRows, {
      cornerRadius: notchCornerRadius,
      endAngle: "endAngle",
      fill: (row) => row.fill,
      fillOpacity: activeFillOpacity,
      id: GAUGE_ACTIVE_GROUP_KEY,
      innerRadius: ({ radius }: { readonly radius: number }) => radius * innerRadiusRatio,
      key: gaugeArcRowKey,
      motion: activeNotchMotion,
      outerRadius: ({ radius }: { readonly radius: number }) => radius * outerRadiusRatio,
      padAngle: "padAngle",
      startAngle: "startAngle",
    }),
  ];
};

interface UniformArcGeometryOptions {
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly endAngle: number;
  readonly height: number;
  readonly notchLengthPercent: number;
  readonly spacing: number;
  readonly startAngle: number;
  readonly totalNotches: number;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
  readonly value: number;
  readonly width: number;
}

const computeUniformArcGeometry = (
  options: Readonly<UniformArcGeometryOptions>,
): ReturnType<typeof computeArcNotches> | undefined => {
  const { activeGrad0, activeGrad1, endAngle, height, notchLengthPercent, spacing, startAngle, totalNotches, useGradient, useThemePaletteGradient, value, width } = options;
  if (width <= 0 || height <= 0) {return undefined;}
  return computeArcNotches({
    activeGrad0,
    activeGrad1,
    endAngle,
    height,
    notchLengthPercent,
    spacing,
    startAngle,
    totalNotches,
    uniformWidth: true,
    useGradient,
    useThemePaletteGradient,
    value,
    width,
  });
};

interface GaugeArcLayoutOptions {
  readonly heightProp?: number;
  readonly measuredH: number;
  readonly measuredW: number;
  readonly minWidth?: number;
  readonly widthProp?: number;
}

interface GaugeArcLayout {
  readonly fixedSize: boolean;
  readonly height: number;
  readonly resolvedMinWidth: number;
  readonly size: number;
  readonly width: number;
}

const resolveGaugeArcLayout = (options: Readonly<GaugeArcLayoutOptions>): GaugeArcLayout => {
  const { heightProp, measuredH, measuredW, minWidth, widthProp } = options;
  const width = widthProp ?? measuredW;
  const height = heightProp ?? measuredH;
  return {
    fixedSize: widthProp !== undefined && heightProp !== undefined,
    height,
    resolvedMinWidth: minWidth ?? GAUGE_ARC_MIN_WIDTH_PX,
    size: Math.min(width, height),
    width,
  };
};

const useArcRows = (
  props: Readonly<GaugeArcProps>,
  fillState: Readonly<GaugeFillState>,
  layout: Readonly<GaugeArcLayout>,
): ArcRowsResult | undefined => {
  const { activeFill, endAngle, inactiveFill, notchLengthPercent, spacing, startAngle, totalNotches, useGradient, value } = props;
  const { height, width } = layout;
  return useMemo(() => computeArcRows({
    activeFill,
    endAngle: endAngle ?? 405,
    fillState,
    height,
    inactiveFill,
    notchLengthPercent: notchLengthPercent ?? 100,
    spacing: spacing ?? 25,
    startAngle: startAngle ?? 135,
    totalNotches: totalNotches ?? 40,
    useGradient: useGradient ?? false,
    value,
    width,
  }), [
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
};

interface UniformArcRowList {
  readonly active: UniformArcRow[];
  readonly bg: UniformArcRow[];
}

interface ComputeUniformArcRowsOptions {
  readonly activeFill?: string;
  readonly geometry: { readonly notches: readonly ComputedNotch[]; readonly notchLength: number; readonly size: number; readonly centerX: number; readonly centerY: number };
  readonly hasCustomActive: boolean;
  readonly hasCustomInactive: boolean;
  readonly inactiveFill?: string;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly themeActiveGradientId: string;
  readonly totalNotches: number;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
}

const collectUniformArcRows = (options: Readonly<ComputeUniformArcRowsOptions>): UniformArcRowList => {
  const { activeFill, geometry, hasCustomActive, hasCustomInactive, inactiveFill, inactiveGrad0, inactiveGrad1, themeActiveGradientId, totalNotches, useGradient, useThemePaletteGradient } = options;
  const bg: UniformArcRow[] = [];
  const active: UniformArcRow[] = [];
  for (const notch of geometry.notches) {
    const pair = buildUniformArcRowPair({
      activeFill, hasCustomActive, hasCustomInactive, inactiveFill, inactiveGrad0, inactiveGrad1, notch, themeActiveGradientId, totalNotches, useGradient, useThemePaletteGradient,
    });
    bg.push(pair.bg);
    if (pair.active !== undefined) {active.push(pair.active);}
  }
  return { active, bg };
};

const computeUniformArcRows = (
  props: Readonly<GaugeArcProps>,
  fillState: Readonly<GaugeFillState>,
  layout: Readonly<GaugeArcLayout>,
): {
  readonly active: UniformArcRow[];
  readonly bg: UniformArcRow[];
  readonly notchLength: number;
} | undefined => {
  const geometry = computeUniformArcGeometry({
    activeGrad0: fillState.activeGrad0,
    activeGrad1: fillState.activeGrad1,
    endAngle: props.endAngle ?? 405,
    height: layout.height,
    notchLengthPercent: props.notchLengthPercent ?? 100,
    spacing: props.spacing ?? 25,
    startAngle: props.startAngle ?? 135,
    totalNotches: props.totalNotches ?? 40,
    useGradient: props.useGradient ?? false,
    useThemePaletteGradient: fillState.useThemePaletteGradient,
    value: props.value,
    width: layout.width,
  });
  if (geometry === undefined) {return undefined;}
  const rows = collectUniformArcRows({
    activeFill: props.activeFill,
    geometry,
    hasCustomActive: fillState.hasCustomActive,
    hasCustomInactive: fillState.hasCustomInactive,
    inactiveFill: props.inactiveFill,
    inactiveGrad0: fillState.inactiveGrad0,
    inactiveGrad1: fillState.inactiveGrad1,
    themeActiveGradientId: fillState.themeActiveGradientId,
    totalNotches: props.totalNotches ?? 40,
    useGradient: props.useGradient ?? false,
    useThemePaletteGradient: fillState.useThemePaletteGradient,
  });
  return { active: rows.active, bg: rows.bg, notchLength: geometry.notchLength };
};

const useUniformArcRows = (
  props: Readonly<GaugeArcProps>,
  fillState: Readonly<GaugeFillState>,
  layout: Readonly<GaugeArcLayout>,
): {
  readonly active: UniformArcRow[];
  readonly bg: UniformArcRow[];
  readonly notchLength: number;
} | undefined =>
  useMemo(() => computeUniformArcRows(props, fillState, layout), [
    props,
    fillState,
    layout,
  ]);

const defineArcChart = (
  marks: readonly PolarMark[],
  themeActiveGradientId: string,
  useThemePaletteGradient: boolean,
): DomChartDefinition =>
  defineChart({
    focus: focusDisabled,
    gradients: buildGaugeThemeGradients(themeActiveGradientId, useThemePaletteGradient),
    guides: false,
    marks: [
      polar({
        marks,
        radiusRatio: 1,
      }),
    ],
    scales: { x: null, y: null },
  });

interface BuildArcDefinitionOptions {
  readonly activeFillOpacity: number;
  readonly arcRows: Readonly<ArcRowsResult> | undefined;
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly inactiveFillOpacity: number;
  readonly notchCornerRadius: number;
  readonly themeActiveGradientId: string;
  readonly uniformRows: Readonly<{
    readonly active: readonly UniformArcRow[];
    readonly bg: readonly UniformArcRow[];
    readonly notchLength: number;
  }> | undefined;
  readonly uniformWidth: boolean;
  readonly useThemePaletteGradient: boolean;
}

const buildArcDefinition = (options: Readonly<BuildArcDefinitionOptions>): DomChartDefinition | undefined => {
  const { activeFillOpacity, arcRows, enterStaggerScale, enterTransition, inactiveFillOpacity, notchCornerRadius, themeActiveGradientId, uniformRows, uniformWidth, useThemePaletteGradient } = options;
  if (!arcRows || (uniformWidth && !uniformRows)) {return undefined;}
  const bgNotchMotion = createArcNotchMotion({ enterStaggerScale, enterTransition, isActiveGroup: false });
  const activeNotchMotion = createArcNotchMotion({ enterStaggerScale, enterTransition, isActiveGroup: true });
  if (uniformWidth && uniformRows) {
    const quadMark = buildUniformArcQuadMark({
      active: uniformRows.active,
      activeFillOpacity,
      bg: uniformRows.bg,
      enterStaggerScale,
      enterTransition,
      inactiveFillOpacity,
      notchCornerRadius,
      notchLength: uniformRows.notchLength,
    });
    return defineArcChart([quadMark], themeActiveGradientId, useThemePaletteGradient);
  }
  const marks = buildTaperedArcMarks({
    activeFillOpacity,
    activeNotchMotion,
    activeRows: arcRows.activeRows,
    bgNotchMotion,
    bgRows: arcRows.bgRows,
    inactiveFillOpacity,
    innerRadiusRatio: arcRows.innerRadiusRatio,
    notchCornerRadius,
    outerRadiusRatio: arcRows.outerRadiusRatio,
  });
  return defineArcChart(marks, themeActiveGradientId, useThemePaletteGradient);
};

interface UseArcDefinitionOptions {
  readonly arcRows: Readonly<ArcRowsResult> | undefined;
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly fillState: Readonly<GaugeFillState>;
  readonly notchCornerRadius: number;
  readonly uniformRows: Readonly<{
    readonly active: readonly UniformArcRow[];
    readonly bg: readonly UniformArcRow[];
    readonly notchLength: number;
  }> | undefined;
  readonly uniformWidth: boolean;
}

const useArcDefinition = (options: Readonly<UseArcDefinitionOptions>): DomChartDefinition | undefined => {
  const { arcRows, enterStaggerScale, enterTransition, fillState, notchCornerRadius, uniformRows, uniformWidth } = options;
  return useMemo(() => buildArcDefinition({
    activeFillOpacity: fillState.resolvedActiveFillOpacity,
    arcRows,
    enterStaggerScale,
    enterTransition,
    inactiveFillOpacity: fillState.resolvedInactiveFillOpacity,
    notchCornerRadius,
    themeActiveGradientId: fillState.themeActiveGradientId,
    uniformRows,
    uniformWidth,
    useThemePaletteGradient: fillState.useThemePaletteGradient,
  }), [
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
};

interface RenderGaugeArcInnerOptions {
  readonly centerOverlayStyle: CSSProperties;
  readonly centerValue?: number;
  readonly defaultLabel: string;
  readonly definition: DomChartDefinition | undefined;
  readonly fillState: Readonly<GaugeFillState>;
  readonly formatOptions: CenterStatFormat;
  readonly innerWrapStyle: CSSProperties;
  readonly layout: Readonly<GaugeArcLayout>;
  readonly prefix?: string;
  readonly suffix?: string;
}

const renderGaugeArcInner = (options: Readonly<RenderGaugeArcInnerOptions>): ReactNode => {
  const { centerOverlayStyle, centerValue, defaultLabel, definition, fillState, formatOptions, innerWrapStyle, layout, prefix, suffix } = options;
  return definition && layout.size > 0 ? (
    <div style={innerWrapStyle}>
      <RendererChart
        ariaLabel="Gauge chart"
        definition={definition}
        height={layout.height}
        renderer={chartMotionRenderer()}
        width={layout.width}
      />
      {fillState.defsChildren.length > 0 ? (
        // Overlay svg mounts after the chart: url(#id) resolves document-wide; chart svg stays first in DOM.
        <svg
          width={0}
          height={0}
          style={GAUGE_DEFS_SVG_STYLE}
          aria-hidden="true"
          focusable="false"
        >
          <defs>{fillState.defsChildren}</defs>
        </svg>
      ) : undefined}
      {centerValue === undefined ? undefined : (
        <div
          style={centerOverlayStyle}
        >
          <GaugeCenterOverlay
            centerValue={centerValue}
            contextSize={layout.size}
            defaultLabel={defaultLabel}
            formatOptions={formatOptions}
            prefix={prefix}
            suffix={suffix}
          />
        </div>
      )}
    </div>
  ) : undefined;
};

interface GaugeArcStyles {
  readonly centerOverlayStyle: CSSProperties;
  readonly innerWrapStyle: CSSProperties;
  readonly rootStyle: CSSProperties;
}

// Wrapper styles for the arc gauge, memoized so the host divs keep a stable style identity.
const useGaugeArcStyles = (style: Readonly<CSSProperties> | undefined, layout: Readonly<GaugeArcLayout>): GaugeArcStyles => {
  const { fixedSize, height, resolvedMinWidth, size, width } = layout;
  const innerWrapStyle = useMemo<CSSProperties>(() => ({ height, position: "relative", width }), [height, width]);
  const centerOverlayStyle = useMemo<CSSProperties>(() => ({
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    inset: 0,
    justifyContent: "center",
    paddingTop: size * GAUGE_CENTER_TOP_PADDING_FRACTION,
    pointerEvents: "none",
    position: "absolute",
  }), [size]);
  const rootStyle = useMemo<CSSProperties>(() => (fixedSize
    ? { display: "inline-flex", maxWidth: "100%", position: "relative", ...style }
    : { maxWidth: "100%", minWidth: resolvedMinWidth, position: "relative", width: "100%", ...style }), [fixedSize, resolvedMinWidth, style]);
  return { centerOverlayStyle, innerWrapStyle, rootStyle };
};

type GaugeArcProps = Omit<GaugeProps, "orientation" | "labelPlacement" | "labelAlign" | "notchWidthPercent" | "linearHeight" | "geometryScrubbing">;

interface GaugeArcSizeProps {
  readonly height?: number;
  readonly minWidth?: number;
  readonly width?: number;
}

// Merges the measured container size with the size props into the arc layout options.
const collectGaugeArcLayoutOptions = (props: Readonly<GaugeArcSizeProps>, measuredW: number, measuredH: number): GaugeArcLayoutOptions => ({
  heightProp: props.height,
  measuredH,
  measuredW,
  minWidth: props.minWidth,
  widthProp: props.width,
});

interface GaugeArcGeometryProps {
  readonly enterStaggerScale?: number;
  readonly enterTransition?: GaugeEnterTransition | undefined;
  readonly notchCornerRadius?: number;
  readonly uniformWidth?: boolean;
}

interface GaugeArcDefinitionInput {
  readonly arcRows: Readonly<ArcRowsResult> | undefined;
  readonly fillState: Readonly<GaugeFillState>;
  readonly props: Readonly<GaugeArcGeometryProps>;
  readonly uniformRows: Readonly<{
    readonly active: readonly UniformArcRow[];
    readonly bg: readonly UniformArcRow[];
    readonly notchLength: number;
  }> | undefined;
}

// Defaulted definition inputs: the stagger, transition, and geometry fallbacks live in one place.
const resolveArcDefinitionOptions = (options: Readonly<GaugeArcDefinitionInput>): UseArcDefinitionOptions => {
  const { arcRows, fillState, props, uniformRows } = options;
  return {
    arcRows,
    enterStaggerScale: props.enterStaggerScale ?? 1,
    enterTransition: props.enterTransition,
    fillState,
    notchCornerRadius: props.notchCornerRadius ?? 0,
    uniformRows,
    uniformWidth: props.uniformWidth ?? false,
  };
};

const GaugeArc = (props: Readonly<GaugeArcProps>): ReactElement => {
  const fillState = useGaugeFillState(collectGaugeFillStateInput(props));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width: measuredW, height: measuredH } = useDebouncedContainerSize(containerRef);

  const layout = resolveGaugeArcLayout(collectGaugeArcLayoutOptions(props, measuredW, measuredH));
  const arcRows = useArcRows(props, fillState, layout);
  const uniformRows = useUniformArcRows(props, fillState, layout);
  const definition = useArcDefinition(resolveArcDefinitionOptions({ arcRows, fillState, props, uniformRows }));
  const arcStyles = useGaugeArcStyles(props.style, layout);
  // Root JSX lives in this component rather than in a plain render helper.
  // The sizer ref attaches directly, so it never crosses a function during render.
  const arcInner = renderGaugeArcInner({
    centerOverlayStyle: arcStyles.centerOverlayStyle,
    centerValue: props.centerValue,
    defaultLabel: props.defaultLabel ?? "Total",
    definition,
    fillState,
    formatOptions: props.formatOptions ?? defaultCenterStatFormat,
    innerWrapStyle: arcStyles.innerWrapStyle,
    layout,
    prefix: props.prefix,
    suffix: props.suffix,
  });
  return layout.fixedSize ? (
    <div className={props.className} data-bkm-chart="gauge" style={arcStyles.rootStyle}>
      {arcInner}
    </div>
  ) : (
    <div
      className={props.className}
      data-bkm-chart="gauge"
      style={arcStyles.rootStyle}
    >
      <div
        ref={containerRef}
        style={GAUGE_ARC_SIZER_STYLE}
      >
        {arcInner}
      </div>
    </div>
  );
}

interface LinearGaugeLayoutOptions {
  readonly heightProp?: number;
  readonly linearHeight?: number;
  readonly measuredWidth: number;
  readonly minWidth?: number;
  readonly widthProp?: number;
}

interface LinearGaugeLayout {
  readonly fixedWidth: boolean;
  readonly height: number;
  readonly resolvedMinWidth: number;
  readonly width: number;
}

const resolveLinearGaugeLayout = (options: Readonly<LinearGaugeLayoutOptions>): LinearGaugeLayout => {
  const { heightProp, linearHeight, measuredWidth, minWidth, widthProp } = options;
  const resolvedLinearHeight = linearHeight ?? DEFAULT_LINEAR_GAUGE_HEIGHT;
  return {
    fixedWidth: widthProp !== undefined,
    height: heightProp ?? resolvedLinearHeight,
    resolvedMinWidth: minWidth ?? GAUGE_LINEAR_MIN_WIDTH_PX,
    width: widthProp ?? measuredWidth,
  };
};

const useLinearGaugeGeometry = (
  props: Readonly<GaugeLinearProps>,
  fillState: Readonly<GaugeFillState>,
  layout: Readonly<LinearGaugeLayout>,
): ReturnType<typeof computeLinearNotches> | undefined =>
  useMemo(() => {
    if (layout.width <= 0 || layout.height <= 0) {return undefined;}
    return computeLinearNotches({
      activeGrad0: fillState.activeGrad0,
      activeGrad1: fillState.activeGrad1,
      height: layout.height,
      notchLengthPercent: props.notchLengthPercent ?? 100,
      notchWidthPercent: props.notchWidthPercent ?? 80,
      spacing: props.spacing ?? 25,
      totalNotches: props.totalNotches ?? 40,
      uniformWidth: props.uniformWidth ?? true,
      useGradient: props.useGradient ?? false,
      useThemePaletteGradient: fillState.useThemePaletteGradient,
      value: props.value,
      width: layout.width,
    });
  }, [
    layout.width,
    layout.height,
    props.totalNotches,
    props.spacing,
    props.uniformWidth,
    props.notchLengthPercent,
    props.notchWidthPercent,
    props.value,
    props.useGradient,
    fillState.useThemePaletteGradient,
    fillState.activeGrad0,
    fillState.activeGrad1,
  ]);

interface LinearGaugeFills {
  readonly resolveActiveFill: (notch: ComputedNotch) => string;
  readonly resolveBgFill: (notchIndex: number) => string;
}

const useLinearGaugeFills = (
  props: Readonly<GaugeLinearProps>,
  fillState: Readonly<GaugeFillState>,
): LinearGaugeFills => {
  const resolveBgFill = useCallback(
    (notchIndex: number) =>
      resolveGaugeBgFill({
        arcTrackFill: GAUGE_ARC_TRACK_FILL,
        hasCustomInactive: fillState.hasCustomInactive,
        inactiveFill: props.inactiveFill,
        inactiveGrad0: fillState.inactiveGrad0,
        inactiveGrad1: fillState.inactiveGrad1,
        linearMode: true,
        linearTrackFill: "var(--chart-background)",
        notchIndex,
        totalNotches: props.totalNotches ?? 40,
        useGradient: props.useGradient ?? false,
        useThemePaletteGradient: fillState.useThemePaletteGradient,
      }),
    [
      props.totalNotches,
      fillState.hasCustomInactive,
      props.inactiveFill,
      fillState.useThemePaletteGradient,
      props.useGradient,
      fillState.inactiveGrad0,
      fillState.inactiveGrad1,
    ],
  );
  const resolveActiveFill = useCallback(
    (notch: ComputedNotch) =>
      resolveGaugeActiveFill({
        activeFill: props.activeFill,
        activeFillSolid: GAUGE_ACTIVE_SOLID_FILL,
        hasCustomActive: fillState.hasCustomActive,
        notch,
        themeActiveGradientId: fillState.themeActiveGradientId,
        useGradient: props.useGradient ?? false,
        useThemePaletteGradient: fillState.useThemePaletteGradient,
      }),
    [
      fillState.hasCustomActive,
      props.activeFill,
      fillState.useThemePaletteGradient,
      fillState.themeActiveGradientId,
      props.useGradient,
    ],
  );
  return { resolveActiveFill, resolveBgFill };
};

interface LinearGaugeNodesOptions {
  readonly activeFillOpacity: number;
  readonly activeNotches: readonly ComputedNotch[];
  readonly cornerVerticalDepth: number;
  readonly inactiveFillOpacity: number;
  readonly notchCornerRadius: number;
  readonly notches: readonly ComputedNotch[];
  readonly resolveActiveFill: (notch: ComputedNotch) => string;
  readonly resolveBgFillByNotch: (notch: ComputedNotch) => string;
}

const renderLinearGaugeNodes = (options: Readonly<LinearGaugeNodesOptions>): SceneNode[] => {
  const { activeFillOpacity, activeNotches, cornerVerticalDepth, inactiveFillOpacity, notchCornerRadius, notches, resolveActiveFill, resolveBgFillByNotch } = options;
  const nodes: SceneNode[] = [];
  if (notches.length > 0) {
    nodes.push({
      ariaHidden: true,
      children: buildLinearNotchNodes({
        cornerVerticalDepth,
        fillOpacity: inactiveFillOpacity,
        keyPrefix: GAUGE_BG_GROUP_KEY,
        notchCornerRadius,
        notches,
        resolveFill: resolveBgFillByNotch,
      }),
      className: GAUGE_ARC_MARK_CLASS,
      key: GAUGE_BG_GROUP_KEY,
      kind: "group",
    });
  }
  if (activeNotches.length > 0) {
    nodes.push({
      ariaHidden: true,
      children: buildLinearNotchNodes({
        cornerVerticalDepth,
        fillOpacity: activeFillOpacity,
        keyPrefix: GAUGE_ACTIVE_GROUP_KEY,
        notchCornerRadius,
        notches: activeNotches,
        resolveFill: resolveActiveFill,
      }),
      className: GAUGE_ARC_MARK_CLASS,
      key: GAUGE_ACTIVE_GROUP_KEY,
      kind: "group",
    });
  }
  return nodes;
};

interface BuildLinearQuadMarkOptions {
  readonly activeFillOpacity: number;
  readonly activeNotches: readonly ComputedNotch[];
  readonly cornerVerticalDepth: number;
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly geometryScrubbing: boolean;
  readonly inactiveFillOpacity: number;
  readonly notchCornerRadius: number;
  readonly notches: readonly ComputedNotch[];
  readonly resolveActiveFill: (notch: ComputedNotch) => string;
  readonly resolveBgFillByNotch: (notch: ComputedNotch) => string;
}

const buildLinearQuadMark = (options: Readonly<BuildLinearQuadMarkOptions>): ReturnType<typeof createMark> => {
  const { activeFillOpacity, activeNotches, cornerVerticalDepth, enterStaggerScale, enterTransition, geometryScrubbing, inactiveFillOpacity, notchCornerRadius, notches, resolveActiveFill, resolveBgFillByNotch } = options;
  return createMark(
    () => ({
      channels: {},
      id: "gauge-linear",
      render: (): MarkScene => ({
        nodes: renderLinearGaugeNodes({
          activeFillOpacity, activeNotches, cornerVerticalDepth, inactiveFillOpacity, notchCornerRadius, notches, resolveActiveFill, resolveBgFillByNotch,
        }),
      }),
    }),
    (ctx) => {
      if (geometryScrubbing) {return false;}
      const sep = ctx.key.indexOf(":");
      if (sep === -1) {return false;}
      return resolveGaugeNotchTiming({
        enterStaggerScale,
        enterTransition,
        idx: Number(ctx.key.slice(sep + 1)),
        isActiveGroup: ctx.key.startsWith(GAUGE_ACTIVE_GROUP_PREFIX),
        phase: ctx.phase,
      });
    },
  );
};

const buildLinearGaugeChart = (
  quadMark: Readonly<ReturnType<typeof createMark>>,
  themeActiveGradientId: string,
  useThemePaletteGradient: boolean,
): DomChartDefinition =>
  defineChart({
    focus: focusDisabled,
    gradients: buildGaugeThemeGradients(themeActiveGradientId, useThemePaletteGradient),
    guides: false,
    margin: { bottom: 0, left: 0, right: 0, top: 0 },
    marks: [quadMark],
    scales: { x: null, y: null },
  });

interface UseLinearGaugeDefinitionOptions {
  readonly fills: Readonly<LinearGaugeFills>;
  readonly fillState: Readonly<GaugeFillState>;
  readonly geometry: { readonly notches: readonly ComputedNotch[]; readonly notchDepth: number; readonly cornerVerticalDepth: number; readonly centerY: number } | undefined;
  readonly props: Readonly<GaugeLinearProps>;
}

const useLinearGaugeDefinition = (options: Readonly<UseLinearGaugeDefinitionOptions>): DomChartDefinition | undefined => {
  const { fills, fillState, geometry, props } = options;
  const { resolveActiveFill, resolveBgFill } = fills;
  const { resolvedActiveFillOpacity, resolvedInactiveFillOpacity, themeActiveGradientId, useThemePaletteGradient } = fillState;
  const { enterStaggerScale, enterTransition, geometryScrubbing, notchCornerRadius } = props;
  return useMemo(() => {
    if (!geometry) {return undefined;}
    const { cornerVerticalDepth, notches } = geometry;
    const activeNotches = notches.filter((notch) => notch.isActive);
    const resolveBgFillByNotch = (notch: ComputedNotch): string => resolveBgFill(notch.index);
    const quadMark = buildLinearQuadMark({
      activeFillOpacity: resolvedActiveFillOpacity,
      activeNotches,
      cornerVerticalDepth,
      enterStaggerScale: enterStaggerScale ?? 1,
      enterTransition,
      geometryScrubbing: geometryScrubbing ?? false,
      inactiveFillOpacity: resolvedInactiveFillOpacity,
      notchCornerRadius: notchCornerRadius ?? 0,
      notches,
      resolveActiveFill,
      resolveBgFillByNotch,
    });
    return buildLinearGaugeChart(quadMark, themeActiveGradientId, useThemePaletteGradient);
  }, [
    geometry,
    notchCornerRadius,
    resolveBgFill,
    resolveActiveFill,
    resolvedInactiveFillOpacity,
    resolvedActiveFillOpacity,
    useThemePaletteGradient,
    themeActiveGradientId,
    geometryScrubbing,
    enterTransition,
    enterStaggerScale,
  ]);
};

interface LinearGaugeStyles {
  readonly chartWrapStyle: CSSProperties;
  readonly containerStyle: CSSProperties;
  readonly innerWidthStyle: CSSProperties;
  readonly label: ReactNode;
  readonly rootStyle: CSSProperties;
  readonly trackStyle: CSSProperties;
}

// Wrapper styles and label element for the linear gauge.
// Host divs and the label layout keep stable prop identities across renders.
const useLinearGaugeStyles = (props: Readonly<GaugeLinearProps>, layout: Readonly<LinearGaugeLayout>): LinearGaugeStyles => {
  const { centerValue, defaultLabel, formatOptions, labelAlign, prefix, style, suffix, width: propWidth } = props;
  const { fixedWidth, height, resolvedMinWidth, width } = layout;
  const chartWrapStyle = useMemo<CSSProperties>(() => ({ height, position: "relative", width }), [height, width]);
  const trackStyle = useMemo<CSSProperties>(() => ({ height, position: "relative", width: "100%" }), [height]);
  const label = useMemo(() => (centerValue === undefined ? undefined : (
    <GaugeLabelStat
      align={labelAlign ?? "start"}
      centerValue={centerValue}
      defaultLabel={defaultLabel ?? "Total"}
      formatOptions={formatOptions ?? defaultCenterStatFormat}
      prefix={prefix}
      suffix={suffix}
    />
  )), [centerValue, defaultLabel, formatOptions, labelAlign, prefix, suffix]);
  const rootStyle = useMemo<CSSProperties>(() => (fixedWidth
    ? { maxWidth: "100%", position: "relative", width: "100%", ...style }
    : { maxWidth: "100%", minWidth: 0, position: "relative", width: "100%", ...style }), [fixedWidth, style]);
  const innerWidthStyle = useMemo<CSSProperties>(() => ({ width: propWidth }), [propWidth]);
  const containerStyle = useMemo<CSSProperties>(() => ({ minWidth: resolvedMinWidth, width: "100%" }), [resolvedMinWidth]);
  return { chartWrapStyle, containerStyle, innerWidthStyle, label, rootStyle, trackStyle };
};

interface RenderLinearGaugeBodyOptions {
  readonly chartWrapStyle: CSSProperties;
  readonly definition: DomChartDefinition | undefined;
  readonly defsChildren: readonly Readonly<ReactElement>[];
  readonly height: number;
  readonly label: ReactNode;
  readonly labelAlign: GaugeLabelAlign;
  readonly labelPlacement: GaugeLabelPlacement;
  readonly trackStyle: CSSProperties;
  readonly width: number;
}

const renderLinearGaugeBody = (options: Readonly<RenderLinearGaugeBodyOptions>): ReactElement => {
  const { chartWrapStyle, definition, defsChildren, height, label, labelAlign, labelPlacement, trackStyle, width } = options;
  const svg =
    definition && width > 0 ? (
      <div style={chartWrapStyle}>
        <RendererChart
          ariaLabel="Gauge chart"
          definition={definition}
          height={height}
          renderer={chartMotionRenderer()}
          width={width}
        />
        {defsChildren.length > 0 ? (
          <svg width={0} height={0} style={GAUGE_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
            <defs>{defsChildren}</defs>
          </svg>
        ) : undefined}
      </div>
    ) : undefined;
  const track = (
    <div style={trackStyle}>{svg}</div>
  );
  return (
    <GaugeLabelLayout align={labelAlign} label={label} placement={labelPlacement}>
      {track}
    </GaugeLabelLayout>
  );
};

type GaugeLinearProps = Omit<GaugeProps, "orientation" | "startAngle" | "endAngle">;

const GaugeLinear = (props: Readonly<GaugeLinearProps>): ReactElement => {
  const fillState = useGaugeFillState(collectGaugeFillStateInput(props));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const measuredWidth = useDebouncedContainerWidth(containerRef);

  const layout = resolveLinearGaugeLayout({
    heightProp: props.height,
    linearHeight: props.linearHeight,
    measuredWidth,
    minWidth: props.minWidth,
    widthProp: props.width,
  });
  const geometry = useLinearGaugeGeometry(props, fillState, layout);
  const fills = useLinearGaugeFills(props, fillState);
  const definition = useLinearGaugeDefinition({ fillState, fills, geometry, props });
  const linearStyles = useLinearGaugeStyles(props, layout);

  // Root JSX lives in this component rather than in a plain render helper.
  // The sizer ref attaches directly, so it never crosses a function during render.
  const linearBody = renderLinearGaugeBody({
    chartWrapStyle: linearStyles.chartWrapStyle,
    definition,
    defsChildren: fillState.defsChildren,
    height: layout.height,
    label: linearStyles.label,
    labelAlign: props.labelAlign ?? "start",
    labelPlacement: props.labelPlacement ?? "top",
    trackStyle: linearStyles.trackStyle,
    width: layout.width,
  });
  return layout.fixedWidth ? (
    <div className={props.className} data-bkm-chart="gauge" style={linearStyles.rootStyle}>
      <div style={linearStyles.innerWidthStyle}>{linearBody}</div>
    </div>
  ) : (
    <div
      className={props.className}
      data-bkm-chart="gauge"
      style={linearStyles.rootStyle}
    >
      <div ref={containerRef} style={linearStyles.containerStyle}>
        {layout.width > 0 ? linearBody : undefined}
      </div>
    </div>
  );
}

const Gauge = ({ orientation = "arc", ...rest }: Readonly<GaugeProps>): ReactElement => {
  if (orientation === "linear") {
    return <GaugeLinear {...rest} />;
  }
  return <GaugeArc {...rest} />;
};

Gauge.displayName = "Gauge";

export type { GaugeOrientation, GaugeProps };
export { Gauge };
export type { GaugeEnterTransition } from "./internal/enter-transition";
export type { GaugeLabelAlign, GaugeLabelPlacement } from "./internal/gauge-center";
