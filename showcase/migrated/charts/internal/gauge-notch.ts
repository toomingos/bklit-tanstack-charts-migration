// Bespoke notch geometry/fill primitives shared by both Gauge orientations:
// `createNotchPath` is a straight-chord + quadratic-Bézier-fillet routine,
// Zero d3-arc involved.
import { Fragment, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { NOTCH_FALLBACK_FILL, interpolateGaugeHex } from "./gauge-notch-geometry";

const DEFAULT_ACTIVE_GRADIENT: readonly [string, string] = [
  "#bef264",
  "#10b981",
];

const DEFAULT_ACTIVE_FILL_OPACITY = 1;
const DEFAULT_INACTIVE_FILL_OPACITY = 0.8;
const DEFAULT_LINEAR_GAUGE_HEIGHT = 24;

// Quadratic-Bézier fillet clamps in `createNotchPath`: the corner radius is
// Capped just under half of every edge so control points never cross.
const NOTCH_CORNER_DEPTH_RATIO = 0.48;
const NOTCH_CORNER_EDGE_CLAMP_RATIO = 0.49;

interface NotchPoint {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly x3: number;
  readonly y3: number;
  readonly x4: number;
  readonly y4: number;
}

interface ComputedNotch {
  readonly index: number;
  readonly points: NotchPoint;
  readonly isActive: boolean;
  readonly gradientColor: string;
  readonly xCenter: number;
  readonly yCenter: number;
}

// Typeof checks live only in the predicates below; call sites use the guards.
const isFunctionType = <Value>(value: Value): value is Value & object => typeof value === "function";
const isStringType = <Value>(value: Value): value is Value & string => typeof value === "string";

const DEFS_EXACT_TYPE_LABELS: ReadonlySet<string> = new Set([
  "LinearGradient",
  "RadialGradient",
  "Lines",
  "PatternLines",
  "Circles",
  "Hexagons",
  "Waves",
]);

const isDefsComponent = (child: Readonly<ReactElement>): boolean => {
  const componentType: unknown = child.type;
  const displayName = isFunctionType(componentType) && "displayName" in componentType && isStringType(componentType.displayName)
    ? componentType.displayName
    : "";
  const typeName = isFunctionType(componentType) && "name" in componentType && isStringType(componentType.name) ? componentType.name : "";
  const typeLabel = displayName === "" ? typeName : displayName;
  if (typeLabel.includes("Gradient") || typeLabel.includes("Pattern")) {
    return true;
  }
  return DEFS_EXACT_TYPE_LABELS.has(typeLabel);
}

const isNodeArray = (nodes: ReactNode): nodes is readonly ReactNode[] => Array.isArray(nodes);

/** Gauge's only use of `children` — collects caller-supplied defs elements
    (gradients/patterns) out of the children tree.
 *
 * @param {ReactNode} nodes - Children tree to harvest defs elements from; non-element nodes and non-defs elements are skipped.
 * @returns {ReactElement[]} Collected defs elements in tree order, flattened through fragments.
 */
const collectGaugeDefsElements = (nodes: ReactNode): ReactElement[] => {
  if (isNodeArray(nodes)) {
    const collected: ReactElement[] = [];
    for (const child of nodes) {
      collected.push(...collectGaugeDefsElements(child));
    }
    return collected;
  }
  if (!isValidElement<{ children?: ReactNode }>(nodes)) {
    return [];
  }
  if (nodes.type === Fragment) {
    return collectGaugeDefsElements(nodes.props.children);
  }
  return isDefsComponent(nodes) ? [nodes] : [];
}

interface NotchDistanceOptions {
  readonly endX: number;
  readonly endY: number;
  readonly startX: number;
  readonly startY: number;
}

const lerpNotch = (fromValue: number, toValue: number, blend: number): number => fromValue + (toValue - fromValue) * blend;
// Euclidean distance between two notch corners; options wrap keeps the arity lint-clean.
const distNotch = (options: Readonly<NotchDistanceOptions>): number => Math.hypot(options.endX - options.startX, options.endY - options.startY);

interface NotchEdgeLengths {
  readonly d12: number;
  readonly d23: number;
  readonly d34: number;
  readonly d41: number;
}

const measureNotchEdges = (points: Readonly<NotchPoint>): NotchEdgeLengths => {
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = points;
  return {
    d12: distNotch({ endX: x2, endY: y2, startX: x1, startY: y1 }),
    d23: distNotch({ endX: x3, endY: y3, startX: x2, startY: y2 }),
    d34: distNotch({ endX: x4, endY: y4, startX: x3, startY: y3 }),
    d41: distNotch({ endX: x1, endY: y1, startX: x4, startY: y4 }),
  };
}

const resolveNotchFillet = (edges: Readonly<NotchEdgeLengths>, cornerRadiusPx: number, verticalDepth: number): number | undefined => {
  if (cornerRadiusPx <= 0) {return undefined;}
  const minEdge = Math.min(edges.d12, edges.d23, edges.d34, edges.d41);
  return Math.min(
    cornerRadiusPx,
    verticalDepth * NOTCH_CORNER_DEPTH_RATIO,
    edges.d12 * NOTCH_CORNER_EDGE_CLAMP_RATIO,
    edges.d23 * NOTCH_CORNER_EDGE_CLAMP_RATIO,
    edges.d34 * NOTCH_CORNER_EDGE_CLAMP_RATIO,
    edges.d41 * NOTCH_CORNER_EDGE_CLAMP_RATIO,
    minEdge * NOTCH_CORNER_EDGE_CLAMP_RATIO,
  );
}

interface NotchCorner {
  readonly pointX: number;
  readonly pointY: number;
}

interface NotchFilletCorners {
  readonly p1a: NotchCorner;
  readonly p1b: NotchCorner;
  readonly p2a: NotchCorner;
  readonly p2b: NotchCorner;
  readonly p3a: NotchCorner;
  readonly p3b: NotchCorner;
  readonly p4a: NotchCorner;
  readonly p4b: NotchCorner;
}

const computeNotchFilletPoints = (points: Readonly<NotchPoint>, fillet: number, edges: Readonly<NotchEdgeLengths>): NotchFilletCorners => {
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = points;
  const r1 = Math.min(fillet / edges.d12, NOTCH_CORNER_EDGE_CLAMP_RATIO);
  const r2 = Math.min(fillet / edges.d23, NOTCH_CORNER_EDGE_CLAMP_RATIO);
  const r3 = Math.min(fillet / edges.d34, NOTCH_CORNER_EDGE_CLAMP_RATIO);
  const r4 = Math.min(fillet / edges.d41, NOTCH_CORNER_EDGE_CLAMP_RATIO);
  return {
    p1a: { pointX: lerpNotch(x1, x4, r4), pointY: lerpNotch(y1, y4, r4) },
    p1b: { pointX: lerpNotch(x1, x2, r1), pointY: lerpNotch(y1, y2, r1) },
    p2a: { pointX: lerpNotch(x2, x1, r1), pointY: lerpNotch(y2, y1, r1) },
    p2b: { pointX: lerpNotch(x2, x3, r2), pointY: lerpNotch(y2, y3, r2) },
    p3a: { pointX: lerpNotch(x3, x2, r2), pointY: lerpNotch(y3, y2, r2) },
    p3b: { pointX: lerpNotch(x3, x4, r3), pointY: lerpNotch(y3, y4, r3) },
    p4a: { pointX: lerpNotch(x4, x3, r3), pointY: lerpNotch(y4, y3, r3) },
    p4b: { pointX: lerpNotch(x4, x1, r4), pointY: lerpNotch(y4, y1, r4) },
  };
}

const createNotchPath = (points: Readonly<NotchPoint>, cornerRadiusPx: number, verticalDepth: number): string => {
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = points;
  const edges = measureNotchEdges(points);
  const fillet = resolveNotchFillet(edges, cornerRadiusPx, verticalDepth);
  if (fillet === undefined) {
    return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
  }
  const { p1a, p1b, p2a, p2b, p3a, p3b, p4a, p4b } = computeNotchFilletPoints(points, fillet, edges);
  return `M ${p1a.pointX} ${p1a.pointY} Q ${x1} ${y1} ${p1b.pointX} ${p1b.pointY} L ${p2a.pointX} ${p2a.pointY} Q ${x2} ${y2} ${p2b.pointX} ${p2b.pointY} L ${p3a.pointX} ${p3a.pointY} Q ${x3} ${y3} ${p3b.pointX} ${p3b.pointY} L ${p4a.pointX} ${p4a.pointY} Q ${x4} ${y4} ${p4b.pointX} ${p4b.pointY} Z`;
}

const resolveGaugeBgFill = (options: {
  readonly notchIndex: number;
  readonly totalNotches: number;
  readonly hasCustomInactive: boolean;
  readonly inactiveFill?: string;
  readonly useThemePaletteGradient: boolean;
  readonly useGradient: boolean;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly arcTrackFill: string;
  readonly linearTrackFill: string;
  readonly linearMode: boolean;
}): string => {
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

  if (hasCustomInactive && inactiveFill !== undefined) {
    return inactiveFill;
  }
  if (useThemePaletteGradient) {
    return linearMode ? NOTCH_FALLBACK_FILL : arcTrackFill;
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

const resolveGaugeActiveFill = (options: {
  readonly notch: ComputedNotch;
  readonly hasCustomActive: boolean;
  readonly activeFill?: string;
  readonly useThemePaletteGradient: boolean;
  readonly themeActiveGradientId: string;
  readonly useGradient: boolean;
  readonly activeFillSolid: string;
}): string => {
  const {
    notch,
    hasCustomActive,
    activeFill,
    useThemePaletteGradient,
    themeActiveGradientId,
    useGradient,
    activeFillSolid,
  } = options;

  if (hasCustomActive && activeFill !== undefined) {
    return activeFill;
  }
  if (useThemePaletteGradient) {
    return `url(#${themeActiveGradientId})`;
  }
  if (useGradient) {
    return notch.gradientColor;
  }
  return activeFillSolid;
}

export { computeArcNotches, interpolateGaugeHex } from "./gauge-notch-geometry";
export { computeLinearNotches } from "./gauge-linear-geometry";
export type { ArcNotchGeometry, ArcNotchGeometryInput } from "./gauge-notch-geometry";
export type { LinearNotchGeometry, LinearNotchGeometryInput } from "./gauge-linear-geometry";
export {
  collectGaugeDefsElements,
  createNotchPath,
  resolveGaugeActiveFill,
  resolveGaugeBgFill,
  DEFAULT_ACTIVE_FILL_OPACITY,
  DEFAULT_ACTIVE_GRADIENT,
  DEFAULT_INACTIVE_FILL_OPACITY,
  DEFAULT_LINEAR_GAUGE_HEIGHT,
};
export type {
  ComputedNotch,
  NotchPoint,
};
