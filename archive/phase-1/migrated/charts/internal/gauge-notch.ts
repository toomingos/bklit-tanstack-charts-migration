// Verbatim port of repos/bklit-ui/packages/ui/src/charts/notch-gauge-shared.ts
// (bespoke notch geometry/fill primitives shared by BOTH Gauge orientations —
// docs/LOG.md D28: "createNotchPath is bklit's own bespoke straight-chord +
// quadratic-Bézier-fillet routine, zero d3-arc involved") plus two new
// `computeArcNotches`/`computeLinearNotches` functions that lift the
// per-orientation notch-array `useMemo` bodies out of
// repos/bklit-ui/packages/ui/src/charts/gauge.tsx's `GaugeArcInner` (lines
// 301-384) and `GaugeLinearInner` (lines 487-572) so both the TanStack
// custom-mark (arc) and plain-SVG (linear) render paths can share the exact
// same geometry computation this migration ports from those two components.
//
// Every point returned by `computeArcNotches` is in the SAME absolute pixel
// space bklit itself uses (`centerX = width/2`, `centerY = height/2`,
// un-shifted) — the arc path now uses stock `radialArc` (gauge.tsx computes
// flat rows with per-notch angles directly, D82 REDO) rather than a custom
// PolarMark. The polar container handles coordinate centering via
// `resolvePolarLayout`; `radiusRatio: 1` gives radius = min(w,h)/2.
import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

export const DEFAULT_ACTIVE_GRADIENT: readonly [string, string] = [
  "#bef264",
  "#10b981",
];

export const DEFAULT_ACTIVE_FILL_OPACITY = 1;
export const DEFAULT_INACTIVE_FILL_OPACITY = 0.8;
export const DEFAULT_LINEAR_GAUGE_HEIGHT = 24;

export interface NotchPoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  x4: number;
  y4: number;
}

export interface ComputedNotch {
  index: number;
  points: NotchPoint;
  isActive: boolean;
  gradientColor: string;
  xCenter: number;
  yCenter: number;
}

function isDefsComponent(child: ReactElement): boolean {
  const typeLabel =
    (child.type as { displayName?: string })?.displayName ||
    (child.type as { name?: string })?.name ||
    "";
  return (
    typeLabel.includes("Gradient") ||
    typeLabel.includes("Pattern") ||
    typeLabel === "LinearGradient" ||
    typeLabel === "RadialGradient" ||
    typeLabel === "Lines" ||
    typeLabel === "PatternLines" ||
    typeLabel === "Circles" ||
    typeLabel === "Hexagons" ||
    typeLabel === "Waves"
  );
}

/** bklit's children-as-defs-collector (D28: Gauge's ONLY use of `children` —
    no children-as-render-config surface otherwise). Ported verbatim. */
export function collectGaugeDefsElements(nodes: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    if (child.type === Fragment) {
      out.push(
        ...collectGaugeDefsElements(
          (child.props as { children?: ReactNode }).children,
        ),
      );
      return;
    }
    if (isDefsComponent(child)) {
      out.push(child);
    }
  });
  return out;
}

export function interpolateGaugeHex(
  color1: string,
  color2: string,
  factor: number,
): string {
  const hex = (c: string) => Number.parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function createNotchPath(
  points: NotchPoint,
  cornerRadiusPx: number,
  verticalDepth: number,
): string {
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = points;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const dist = (ax: number, ay: number, bx: number, by: number) =>
    Math.hypot(bx - ax, by - ay);

  const d12 = dist(x1, y1, x2, y2);
  const d23 = dist(x2, y2, x3, y3);
  const d34 = dist(x3, y3, x4, y4);
  const d41 = dist(x4, y4, x1, y1);

  if (cornerRadiusPx <= 0) {
    return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
  }

  const minEdge = Math.min(d12, d23, d34, d41);
  const cr = Math.min(
    cornerRadiusPx,
    verticalDepth * 0.48,
    d12 * 0.49,
    d23 * 0.49,
    d34 * 0.49,
    d41 * 0.49,
    minEdge * 0.49,
  );

  const r1 = Math.min(cr / d12, 0.49);
  const r2 = Math.min(cr / d23, 0.49);
  const r3 = Math.min(cr / d34, 0.49);
  const r4 = Math.min(cr / d41, 0.49);

  const p1a = { x: lerp(x1, x4, r4), y: lerp(y1, y4, r4) };
  const p1b = { x: lerp(x1, x2, r1), y: lerp(y1, y2, r1) };
  const p2a = { x: lerp(x2, x1, r1), y: lerp(y2, y1, r1) };
  const p2b = { x: lerp(x2, x3, r2), y: lerp(y2, y3, r2) };
  const p3a = { x: lerp(x3, x2, r2), y: lerp(y3, y2, r2) };
  const p3b = { x: lerp(x3, x4, r3), y: lerp(y3, y4, r3) };
  const p4a = { x: lerp(x4, x3, r3), y: lerp(y4, y3, r3) };
  const p4b = { x: lerp(x4, x1, r4), y: lerp(y4, y1, r4) };

  return `M ${p1a.x} ${p1a.y} Q ${x1} ${y1} ${p1b.x} ${p1b.y} L ${p2a.x} ${p2a.y} Q ${x2} ${y2} ${p2b.x} ${p2b.y} L ${p3a.x} ${p3a.y} Q ${x3} ${y3} ${p3b.x} ${p3b.y} L ${p4a.x} ${p4a.y} Q ${x4} ${y4} ${p4b.x} ${p4b.y} Z`;
}

export function resolveGaugeBgFill(options: {
  notchIndex: number;
  totalNotches: number;
  hasCustomInactive: boolean;
  inactiveFill?: string;
  useThemePaletteGradient: boolean;
  useGradient: boolean;
  inactiveGrad0: string;
  inactiveGrad1: string;
  arcTrackFill: string;
  linearTrackFill: string;
  linearMode: boolean;
}): string {
  const {
    notchIndex,
    totalNotches,
    hasCustomInactive,
    inactiveFill,
    useThemePaletteGradient,
    useGradient,
    inactiveGrad0,
    inactiveGrad1,
    arcTrackFill,
    linearTrackFill,
    linearMode,
  } = options;

  if (hasCustomInactive) {
    return inactiveFill as string;
  }
  if (useThemePaletteGradient) {
    return linearMode ? "var(--chart-1)" : arcTrackFill;
  }
  if (useGradient) {
    const denom = totalNotches > 1 ? totalNotches - 1 : 1;
    return interpolateGaugeHex(
      inactiveGrad0,
      inactiveGrad1,
      notchIndex / denom,
    );
  }
  return linearMode ? linearTrackFill : arcTrackFill;
}

export function resolveGaugeActiveFill(options: {
  notch: ComputedNotch;
  hasCustomActive: boolean;
  activeFill?: string;
  useThemePaletteGradient: boolean;
  themeActiveGradientId: string;
  useGradient: boolean;
  activeFillSolid: string;
}): string {
  const {
    notch,
    hasCustomActive,
    activeFill,
    useThemePaletteGradient,
    themeActiveGradientId,
    useGradient,
    activeFillSolid,
  } = options;

  if (hasCustomActive) {
    return activeFill as string;
  }
  if (useThemePaletteGradient) {
    return `url(#${themeActiveGradientId})`;
  }
  if (useGradient) {
    return notch.gradientColor;
  }
  return activeFillSolid;
}

// --- Arc geometry (repos/.../gauge.tsx `GaugeArcInner`, lines 301-384) ----
export interface ArcNotchGeometryInput {
  width: number;
  height: number;
  totalNotches: number;
  spacing: number;
  uniformWidth: boolean;
  startAngle: number;
  endAngle: number;
  notchLengthPercent: number;
  value: number;
  useGradient: boolean;
  useThemePaletteGradient: boolean;
  activeGrad0: string;
  activeGrad1: string;
}

export interface ArcNotchGeometry {
  notches: ComputedNotch[];
  notchLength: number;
  size: number;
  centerX: number;
  centerY: number;
}

export function computeArcNotches(input: ArcNotchGeometryInput): ArcNotchGeometry {
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

  const size = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = size * 0.42;
  const innerRadiusBase = size * 0.28;
  const defaultRadialDepth = outerRadius - innerRadiusBase;
  const depthFactor = Math.min(100, Math.max(5, notchLengthPercent)) / 100;
  const notchLength = defaultRadialDepth * depthFactor;
  const innerRadius = outerRadius - notchLength;

  const activeNotches = Math.round((value / 100) * totalNotches);
  const totalAngle = endAngle - startAngle;
  const availableAngle = totalAngle * (1 - spacing / 100);
  const notchAngle = totalNotches > 0 ? availableAngle / totalNotches : 0;
  const gapDen = totalNotches - 1 > 0 ? totalNotches - 1 : 1;
  const gapAngle = (totalAngle * (spacing / 100)) / gapDen;

  const notches: ComputedNotch[] = Array.from({ length: totalNotches }, (_, i) => {
    const angle = startAngle + i * (notchAngle + gapAngle) + notchAngle / 2;
    const radians = (angle * Math.PI) / 180;
    const arcNotchWidth = notchAngle * 0.8;
    const halfWidth = (arcNotchWidth * Math.PI) / 180 / 2;

    const x1 = centerX + Math.cos(radians - halfWidth) * outerRadius;
    const y1 = centerY + Math.sin(radians - halfWidth) * outerRadius;
    const x2 = centerX + Math.cos(radians + halfWidth) * outerRadius;
    const y2 = centerY + Math.sin(radians + halfWidth) * outerRadius;

    let x3: number;
    let y3: number;
    let x4: number;
    let y4: number;

    if (uniformWidth) {
      const perpX = Math.cos(radians);
      const perpY = Math.sin(radians);
      x3 = x2 - perpX * notchLength;
      y3 = y2 - perpY * notchLength;
      x4 = x1 - perpX * notchLength;
      y4 = y1 - perpY * notchLength;
    } else {
      x3 = centerX + Math.cos(radians + halfWidth) * innerRadius;
      y3 = centerY + Math.sin(radians + halfWidth) * innerRadius;
      x4 = centerX + Math.cos(radians - halfWidth) * innerRadius;
      y4 = centerY + Math.sin(radians - halfWidth) * innerRadius;
    }

    const denom = totalNotches > 1 ? totalNotches - 1 : 1;
    const gradientColor =
      useGradient && !useThemePaletteGradient
        ? interpolateGaugeHex(activeGrad0, activeGrad1, i / denom)
        : "var(--chart-1)";

    return {
      index: i,
      points: { x1, y1, x2, y2, x3, y3, x4, y4 },
      isActive: i < activeNotches,
      gradientColor,
      xCenter: centerX,
      yCenter: centerY,
    };
  });

  return { notches, notchLength, size, centerX, centerY };
}

// --- Linear geometry (repos/.../gauge.tsx `GaugeLinearInner`, lines 487-572)
export interface LinearNotchGeometryInput {
  width: number;
  height: number;
  totalNotches: number;
  spacing: number;
  uniformWidth: boolean;
  notchLengthPercent: number;
  notchWidthPercent: number;
  value: number;
  useGradient: boolean;
  useThemePaletteGradient: boolean;
  activeGrad0: string;
  activeGrad1: string;
}

export interface LinearNotchGeometry {
  notches: ComputedNotch[];
  notchDepth: number;
  cornerVerticalDepth: number;
  centerY: number;
}

export function computeLinearNotches(
  input: LinearNotchGeometryInput,
): LinearNotchGeometry {
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

  const centerY = height / 2;
  const depthFactor = Math.min(100, Math.max(5, notchLengthPercent)) / 100;
  const outerOffset = (height / 2) * depthFactor;
  const taperRatio = 28 / 42;
  const innerOffset = uniformWidth ? outerOffset : outerOffset * taperRatio;
  const notchDepth = uniformWidth ? outerOffset * 2 : outerOffset - innerOffset;
  const cornerVerticalDepth = uniformWidth ? notchDepth : outerOffset * 2;
  const widthFactor = Math.min(100, Math.max(10, notchWidthPercent)) / 100;

  const activeNotches = Math.round((value / 100) * totalNotches);
  const availableWidth = width * (1 - spacing / 100);
  const slotWidth = totalNotches > 0 ? availableWidth / totalNotches : 0;
  const gapDen = totalNotches - 1 > 0 ? totalNotches - 1 : 1;
  const gapWidth = (width * (spacing / 100)) / gapDen;

  const notches: ComputedNotch[] = Array.from({ length: totalNotches }, (_, i) => {
    const xCenter = i * (slotWidth + gapWidth) + slotWidth / 2;
    const halfWidth = (slotWidth * widthFactor) / 2;

    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;
    let x3: number;
    let y3: number;
    let x4: number;
    let y4: number;

    if (uniformWidth) {
      const halfHeight = notchDepth / 2;
      x1 = xCenter - halfWidth;
      y1 = centerY - halfHeight;
      x2 = xCenter + halfWidth;
      y2 = centerY - halfHeight;
      x3 = xCenter + halfWidth;
      y3 = centerY + halfHeight;
      x4 = xCenter - halfWidth;
      y4 = centerY + halfHeight;
    } else {
      x1 = xCenter - halfWidth;
      y1 = centerY - outerOffset;
      x2 = xCenter + halfWidth;
      y2 = centerY - outerOffset;
      const innerHalfWidth = halfWidth * (innerOffset / outerOffset);
      x3 = xCenter + innerHalfWidth;
      y3 = centerY + outerOffset;
      x4 = xCenter - innerHalfWidth;
      y4 = centerY + outerOffset;
    }

    const denom = totalNotches > 1 ? totalNotches - 1 : 1;
    const gradientColor =
      useGradient && !useThemePaletteGradient
        ? interpolateGaugeHex(activeGrad0, activeGrad1, i / denom)
        : "var(--chart-1)";

    return {
      index: i,
      points: { x1, y1, x2, y2, x3, y3, x4, y4 },
      isActive: i < activeNotches,
      gradientColor,
      xCenter,
      yCenter: centerY,
    };
  });

  return { notches, notchDepth, cornerVerticalDepth, centerY };
}
