// Linear notch layout for the plain-SVG Gauge path: slot/gap metrics plus per-notch tapered-quad assembly.
// Shared gradient/fallback primitives come from the arc-geometry module so both orientations resolve identical fills.
import { LINEAR_TAPER_INNER, LINEAR_TAPER_OUTER, MIN_NOTCH_LENGTH_PERCENT, MIN_NOTCH_WIDTH_PERCENT, NOTCH_FALLBACK_FILL, PERCENT_SCALE, interpolateGaugeHex } from "./gauge-notch-geometry";
import type { ComputedNotch, NotchPoint } from "./gauge-notch";

interface LinearNotchVertical {
  readonly centerY: number;
  readonly outerOffset: number;
  readonly innerOffset: number;
  readonly notchDepth: number;
  readonly cornerVerticalDepth: number;
  readonly topY: number;
  readonly bottomY: number;
}

const resolveLinearNotchVertical = (options: Readonly<{ height: number; uniformWidth: boolean; notchLengthPercent: number }>): LinearNotchVertical => {
  const { height, uniformWidth, notchLengthPercent } = options;
  const centerY = height / 2;
  const outerOffset = (height / 2) * (Math.min(PERCENT_SCALE, Math.max(MIN_NOTCH_LENGTH_PERCENT, notchLengthPercent)) / PERCENT_SCALE);
  const innerOffset = uniformWidth ? outerOffset : outerOffset * (LINEAR_TAPER_INNER / LINEAR_TAPER_OUTER);
  const notchDepth = uniformWidth ? outerOffset * 2 : outerOffset - innerOffset;
  const cornerVerticalDepth = uniformWidth ? notchDepth : outerOffset * 2;
  const topY = uniformWidth ? centerY - notchDepth / 2 : centerY - outerOffset;
  const bottomY = uniformWidth ? centerY + notchDepth / 2 : centerY + outerOffset;
  return { bottomY, centerY, cornerVerticalDepth, innerOffset, notchDepth, outerOffset, topY };
}

interface LinearNotchHorizontal {
  readonly widthFactor: number;
  readonly activeNotches: number;
  readonly slotWidth: number;
  readonly gapWidth: number;
}

const resolveLinearNotchHorizontal = (options: Readonly<{ width: number; totalNotches: number; spacing: number; notchWidthPercent: number; value: number }>): LinearNotchHorizontal => {
  const { width, totalNotches, spacing, notchWidthPercent, value } = options;
  const widthFactor = Math.min(PERCENT_SCALE, Math.max(MIN_NOTCH_WIDTH_PERCENT, notchWidthPercent)) / PERCENT_SCALE;
  const activeNotches = Math.round((value / PERCENT_SCALE) * totalNotches);
  const availableWidth = width * (1 - spacing / PERCENT_SCALE);
  const slotWidth = totalNotches > 0 ? availableWidth / totalNotches : 0;
  const gapDen = totalNotches - 1 > 0 ? totalNotches - 1 : 1;
  const gapWidth = (width * (spacing / PERCENT_SCALE)) / gapDen;
  return { activeNotches, gapWidth, slotWidth, widthFactor };
}

interface LinearNotchFrame {
  readonly xCenter: number;
  readonly halfWidth: number;
  readonly bottomHalfWidth: number;
  readonly topY: number;
  readonly bottomY: number;
}

const computeLinearNotchPoints = (frame: Readonly<LinearNotchFrame>): NotchPoint => {
  const { xCenter, halfWidth, bottomHalfWidth, topY, bottomY } = frame;
  const x1 = xCenter - halfWidth;
  const x2 = xCenter + halfWidth;
  const x3 = xCenter + bottomHalfWidth;
  const x4 = xCenter - bottomHalfWidth;
  return { x1, x2, x3, x4, y1: topY, y2: topY, y3: bottomY, y4: bottomY };
}

interface BuildLinearNotchOptions {
  readonly notchIndex: number;
  readonly vertical: Readonly<LinearNotchVertical>;
  readonly horizontal: Readonly<LinearNotchHorizontal>;
  readonly uniformWidth: boolean;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly totalNotches: number;
}

const buildLinearNotch = (options: Readonly<BuildLinearNotchOptions>): ComputedNotch => {
  const { notchIndex, vertical, horizontal, uniformWidth, useGradient, useThemePaletteGradient, activeGrad0, activeGrad1, totalNotches } = options;
  const xCenter = notchIndex * (horizontal.slotWidth + horizontal.gapWidth) + horizontal.slotWidth / 2;
  const halfWidth = (horizontal.slotWidth * horizontal.widthFactor) / 2;
  const bottomHalfWidth = uniformWidth ? halfWidth : halfWidth * (vertical.innerOffset / vertical.outerOffset);
  const points = computeLinearNotchPoints({ bottomHalfWidth, bottomY: vertical.bottomY, halfWidth, topY: vertical.topY, xCenter });
  const denom = totalNotches > 1 ? totalNotches - 1 : 1;
  const gradientColor = useGradient && !useThemePaletteGradient ? interpolateGaugeHex(activeGrad0, activeGrad1, notchIndex / denom) : NOTCH_FALLBACK_FILL;
  return {
    gradientColor,
    index: notchIndex,
    isActive: notchIndex < horizontal.activeNotches,
    points,
    xCenter,
    yCenter: vertical.centerY,
  };
}

interface LinearNotchGeometryInput {
  readonly width: number;
  readonly height: number;
  readonly totalNotches: number;
  readonly spacing: number;
  readonly uniformWidth: boolean;
  readonly notchLengthPercent: number;
  readonly notchWidthPercent: number;
  readonly value: number;
  readonly useGradient: boolean;
  readonly useThemePaletteGradient: boolean;
  readonly activeGrad0: string;
  readonly activeGrad1: string;
}

interface LinearNotchGeometry {
  readonly notches: readonly ComputedNotch[];
  readonly notchDepth: number;
  readonly cornerVerticalDepth: number;
  readonly centerY: number;
}

const computeLinearNotches = (input: LinearNotchGeometryInput): LinearNotchGeometry => {
  const {
    width,
    height,
    totalNotches,
    spacing,
    uniformWidth,
    notchLengthPercent,
    notchWidthPercent,
    value,
    useGradient,
    useThemePaletteGradient,
    activeGrad0,
    activeGrad1,
  } = input;

  const vertical = resolveLinearNotchVertical({ height, notchLengthPercent, uniformWidth });
  const horizontal = resolveLinearNotchHorizontal({ notchWidthPercent, spacing, totalNotches, value, width });

  const notches: ComputedNotch[] = Array.from({ length: totalNotches }, (_unused, notchIndex) => buildLinearNotch({
    activeGrad0, activeGrad1, horizontal, notchIndex, totalNotches, uniformWidth, useGradient, useThemePaletteGradient, vertical,
  }));

  return { centerY: vertical.centerY, cornerVerticalDepth: vertical.cornerVerticalDepth, notchDepth: vertical.notchDepth, notches };
}

export type { LinearNotchGeometry, LinearNotchGeometryInput };
export { computeLinearNotches };
