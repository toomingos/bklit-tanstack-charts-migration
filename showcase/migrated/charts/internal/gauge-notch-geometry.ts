// Arc/linear notch layout shared by both Gauge orientations:
// `computeArcNotches`/`computeLinearNotches` let both the TanStack
// Custom-mark (arc) and plain-SVG (linear) render paths share the same
// Geometry computation.
//
// Every point returned by `computeArcNotches` is in absolute pixel space
// (`centerX = width/2`, `centerY = height/2`, un-shifted); the arc path uses
// Stock `radialArc`, whose polar container handles coordinate centering via
// `resolvePolarLayout` (`radiusRatio: 1` gives radius = min(w,h)/2).
import type { ComputedNotch } from "./gauge-notch";

// Hex color channel slice offsets (`#rrggbb` minus the `#` prefix) and radix.
const HEX_RED_CHANNEL_END = 3;
const HEX_GREEN_CHANNEL_END = 5;
const HEX_BLUE_CHANNEL_END = 7;
const HEX_RADIX = 16;

// Arc gauge radii as fractions of `size` (min(width, height)).
const GAUGE_OUTER_RADIUS_RATIO = 0.42;
const GAUGE_INNER_RADIUS_BASE_RATIO = 0.28;
// Linear notch taper (inner vs outer half-width); kept as its own integer
// Ratio — `28 / 42` is not bit-identical to `0.28 / 0.42` in floating point,
// So it must not reuse the radius ratios above.
const LINEAR_TAPER_INNER = 28;
const LINEAR_TAPER_OUTER = 42;

// Percent normalization (`Math.min(PERCENT_SCALE, …) / PERCENT_SCALE` maps a
// 0–PERCENT_SCALE percent into a 0–1 factor) and percent clamp floors.
const PERCENT_SCALE = 100;
const MIN_NOTCH_LENGTH_PERCENT = 5;
const MIN_NOTCH_WIDTH_PERCENT = 10;

// Angle conversion and the arc notch angular width as a fraction of its slot.
const DEGREES_IN_HALF_CIRCLE = 180;
const ARC_NOTCH_WIDTH_FACTOR = 0.8;

// Fallback fill used wherever a gradient-resolved color is unavailable.
const NOTCH_FALLBACK_FILL = "var(--chart-1)";

const parseHexByte = (hexChars: string): number => Number.parseInt(hexChars, HEX_RADIX);

const parseGaugeChannels = (color: string): readonly [number, number, number] => {
  const channelR = parseHexByte(color.slice(1, HEX_RED_CHANNEL_END));
  const channelG = parseHexByte(color.slice(HEX_RED_CHANNEL_END, HEX_GREEN_CHANNEL_END));
  const channelB = parseHexByte(color.slice(HEX_GREEN_CHANNEL_END, HEX_BLUE_CHANNEL_END));
  return [channelR, channelG, channelB];
}

const interpolateGaugeHex = (color1: string, color2: string, factor: number): string => {
  const [channelR1, channelG1, channelB1] = parseGaugeChannels(color1);
  const [channelR2, channelG2, channelB2] = parseGaugeChannels(color2);

  const channelR = Math.round(channelR1 + (channelR2 - channelR1) * factor);
  const channelG = Math.round(channelG1 + (channelG2 - channelG1) * factor);
  const channelB = Math.round(channelB1 + (channelB2 - channelB1) * factor);

  return `#${channelR.toString(HEX_RADIX).padStart(2, "0")}${channelG.toString(HEX_RADIX).padStart(2, "0")}${channelB.toString(HEX_RADIX).padStart(2, "0")}`;
}

interface ArcNotchRadii {
  readonly size: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly notchLength: number;
}

const resolveArcNotchRadii = (width: number, height: number, notchLengthPercent: number): ArcNotchRadii => {
  const size = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = size * GAUGE_OUTER_RADIUS_RATIO;
  const defaultRadialDepth = outerRadius - size * GAUGE_INNER_RADIUS_BASE_RATIO;
  const depthFactor = Math.min(PERCENT_SCALE, Math.max(MIN_NOTCH_LENGTH_PERCENT, notchLengthPercent)) / PERCENT_SCALE;
  const notchLength = defaultRadialDepth * depthFactor;
  const innerRadius = outerRadius - notchLength;
  return { centerX, centerY, innerRadius, notchLength, outerRadius, size };
}

interface ArcNotchAnglesInput {
  readonly totalNotches: number;
  readonly spacing: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly value: number;
}

interface ArcNotchAngles {
  readonly activeNotches: number;
  readonly notchAngle: number;
  readonly gapAngle: number;
}

const resolveArcNotchAngles = (options: Readonly<ArcNotchAnglesInput>): ArcNotchAngles => {
  const { totalNotches, spacing, startAngle, endAngle, value } = options;
  const activeNotches = Math.round((value / PERCENT_SCALE) * totalNotches);
  const totalAngle = endAngle - startAngle;
  const availableAngle = totalAngle * (1 - spacing / PERCENT_SCALE);
  const notchAngle = totalNotches > 0 ? availableAngle / totalNotches : 0;
  const gapDen = totalNotches - 1 > 0 ? totalNotches - 1 : 1;
  const gapAngle = (totalAngle * (spacing / PERCENT_SCALE)) / gapDen;
  return { activeNotches, gapAngle, notchAngle };
}

interface ArcOuterCorners {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

interface ArcOuterFrame {
  readonly radians: number;
  readonly halfWidth: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly outerRadius: number;
}

const computeArcNotchOuterCorners = (frame: Readonly<ArcOuterFrame>): ArcOuterCorners => {
  const { radians, halfWidth, centerX, centerY, outerRadius } = frame;
  const x1 = centerX + Math.cos(radians - halfWidth) * outerRadius;
  const y1 = centerY + Math.sin(radians - halfWidth) * outerRadius;
  const x2 = centerX + Math.cos(radians + halfWidth) * outerRadius;
  const y2 = centerY + Math.sin(radians + halfWidth) * outerRadius;
  return { x1, x2, y1, y2 };
}

interface ArcInnerCorners {
  readonly x3: number;
  readonly y3: number;
  readonly x4: number;
  readonly y4: number;
}

interface ArcInnerFrame {
  readonly radians: number;
  readonly halfWidth: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly innerRadius: number;
  readonly notchLength: number;
  readonly uniformWidth: boolean;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const computeArcNotchInnerCorners = (frame: Readonly<ArcInnerFrame>): ArcInnerCorners => {
  const { radians, halfWidth, centerX, centerY, innerRadius, notchLength, uniformWidth, x1, y1, x2, y2 } = frame;
  const perpX = Math.cos(radians);
  const perpY = Math.sin(radians);
  const x3 = uniformWidth ? x2 - perpX * notchLength : centerX + Math.cos(radians + halfWidth) * innerRadius;
  const y3 = uniformWidth ? y2 - perpY * notchLength : centerY + Math.sin(radians + halfWidth) * innerRadius;
  const x4 = uniformWidth ? x1 - perpX * notchLength : centerX + Math.cos(radians - halfWidth) * innerRadius;
  const y4 = uniformWidth ? y1 - perpY * notchLength : centerY + Math.sin(radians - halfWidth) * innerRadius;
  return { x3, x4, y3, y4 };
}

interface BuildArcNotchOptions {
  readonly notchIndex: number;
  readonly radii: Readonly<ArcNotchRadii>;
  readonly angles: Readonly<ArcNotchAngles>;
  readonly startAngle: number;
  readonly uniformWidth: boolean;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly totalNotches: number;
}

const buildArcNotch = (options: Readonly<BuildArcNotchOptions>): ComputedNotch => {
  const { notchIndex, radii, angles, startAngle, uniformWidth, useGradient, useThemePaletteGradient, activeGrad0, activeGrad1, totalNotches } = options;
  const angle = startAngle + notchIndex * (angles.notchAngle + angles.gapAngle) + angles.notchAngle / 2;
  const radians = (angle * Math.PI) / DEGREES_IN_HALF_CIRCLE;
  const halfWidth = ((angles.notchAngle * ARC_NOTCH_WIDTH_FACTOR * Math.PI) / DEGREES_IN_HALF_CIRCLE) / 2;
  const outer = computeArcNotchOuterCorners({ centerX: radii.centerX, centerY: radii.centerY, halfWidth, outerRadius: radii.outerRadius, radians });
  const inner = computeArcNotchInnerCorners({ centerX: radii.centerX, centerY: radii.centerY, halfWidth, innerRadius: radii.innerRadius, notchLength: radii.notchLength, radians, uniformWidth, x1: outer.x1, x2: outer.x2, y1: outer.y1, y2: outer.y2 });
  const denom = totalNotches > 1 ? totalNotches - 1 : 1;
  const gradientColor = useGradient && !useThemePaletteGradient ? interpolateGaugeHex(activeGrad0, activeGrad1, notchIndex / denom) : NOTCH_FALLBACK_FILL;
  return {
    gradientColor,
    index: notchIndex,
    isActive: notchIndex < angles.activeNotches,
    points: { x1: outer.x1, x2: outer.x2, x3: inner.x3, x4: inner.x4, y1: outer.y1, y2: outer.y2, y3: inner.y3, y4: inner.y4 },
    xCenter: radii.centerX,
    yCenter: radii.centerY,
  };
}

interface ArcNotchGeometryInput {
  readonly width: number;
  readonly height: number;
  readonly totalNotches: number;
  readonly spacing: number;
  readonly uniformWidth: boolean;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly notchLengthPercent: number;
  readonly value: number;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
  readonly activeGrad0: string;
  readonly activeGrad1: string;
}

interface ArcNotchGeometry {
  notches: ComputedNotch[];
  notchLength: number;
  size: number;
  centerX: number;
  centerY: number;
}

const computeArcNotches = (input: ArcNotchGeometryInput): ArcNotchGeometry => {
  const {
    width,
    height,
    totalNotches,
    spacing,
    uniformWidth,
    startAngle,
    endAngle,
    notchLengthPercent,
    value,
    useGradient,
    useThemePaletteGradient,
    activeGrad0,
    activeGrad1,
  } = input;

  const radii = resolveArcNotchRadii(width, height, notchLengthPercent);
  const angles = resolveArcNotchAngles({ endAngle, spacing, startAngle, totalNotches, value });

  const notches: ComputedNotch[] = Array.from({ length: totalNotches }, (_unused, notchIndex) => buildArcNotch({
    activeGrad0, activeGrad1, angles, notchIndex, radii, startAngle, totalNotches, uniformWidth, useGradient, useThemePaletteGradient,
  }));

  return { centerX: radii.centerX, centerY: radii.centerY, notchLength: radii.notchLength, notches, size: radii.size };
}

export type { ArcNotchGeometry, ArcNotchGeometryInput };
export { LINEAR_TAPER_INNER, LINEAR_TAPER_OUTER, MIN_NOTCH_LENGTH_PERCENT, MIN_NOTCH_WIDTH_PERCENT, NOTCH_FALLBACK_FILL, PERCENT_SCALE, computeArcNotches, interpolateGaugeHex };
