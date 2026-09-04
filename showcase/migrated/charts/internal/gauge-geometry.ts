// Gauge notch-row geometry: arc rows, uniform quad rows, linear node builders,
// Radii/angles, mark factories, and the shared notch enter timing + theme fills.
import { radialArc } from '@tanstack/charts/polar';
import type { PolarMark } from '@tanstack/charts/polar';
import type { ChartLinearGradient, ChartMotionContext, ChartMotionPhase, ChartMotionTiming, SceneNode } from '@tanstack/charts';
import { computeArcNotches, createNotchPath, interpolateGaugeHex, resolveGaugeActiveFill, resolveGaugeBgFill } from './gauge-notch';
import type { ComputedNotch, NotchPoint } from './gauge-notch';
import { GAUGE_SPRING_FALLBACK, gaugeMotionTransition } from './gauge-reveal';
import type { GaugeEnterTransition } from './gauge-reveal';
import { resolveEnterTransition } from "./enter-transition";
import { nativeStaggerDelayMs } from "./native-stagger";

interface GaugeArcRow {
  readonly notchIndex: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly padAngle: number;
  readonly fill: string;
}

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
    idx: ctx.datumIndex,
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

interface UniformArcRowList {
  readonly active: readonly UniformArcRow[];
  readonly bg: readonly UniformArcRow[];
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

export {
  GAUGE_ACTIVE_GROUP_KEY,
  GAUGE_ACTIVE_GROUP_PREFIX,
  GAUGE_ACTIVE_SOLID_FILL,
  GAUGE_ARC_MARK_CLASS,
  GAUGE_ARC_TRACK_FILL,
  GAUGE_BG_GROUP_KEY,
  PERCENT_MULTIPLIER,
  buildArcRows,
  buildGaugeThemeGradients,
  buildLinearNotchNodes,
  buildTaperedArcMarks,
  buildUniformArcQuadMark,
  collectUniformArcRows,
  computeUniformArcGeometry,
  createArcNotchMotion,
  resolveArcAngles,
  resolveArcRadii,
  resolveGaugeNotchTiming,
};
export type {
  ArcAngles,
  ArcBgFillInput,
  ArcActiveFillInput,
  ArcRowList,
  ArcRowPair,
  ArcRowPairOptions,
  BuildArcRowsOptions,
  ComputeUniformArcRowsOptions,
  GaugeArcRow,
  GaugeNotchTimingOptions,
  LinearNotchNodesInput,
  ResolveArcAnglesOptions,
  TaperedArcMarksOptions,
  UniformArcGeometryOptions,
  UniformArcGroupNodesOptions,
  UniformArcNodeInput,
  UniformArcNodesInput,
  UniformArcQuadMarkOptions,
  UniformArcRow,
  UniformArcRowList,
  UniformArcRowPair,
  UniformArcRowPairOptions,
  ArcNotchMotionOptions,
  ArcRadii,
};
