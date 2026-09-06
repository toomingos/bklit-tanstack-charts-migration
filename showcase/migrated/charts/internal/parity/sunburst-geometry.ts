// Legacy sunburst partition: verbatim chart-path code, kept for parity.

interface SunburstNode {
  readonly name: string;
  readonly value?: number;
  readonly color?: string;
  readonly fill?: string;
  children?: SunburstNode[];
}

interface ArcDatum {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly value: number;
  readonly categoryIndex: number;
  readonly hasChildren: boolean;
  readonly trail: string[];
  readonly parentId: string | null;
  a0: number;
  a1: number;
  arcIndex: number;
  readonly color?: string;
  readonly fill?: string;
}

interface Focus {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly parentId: string | null;
  readonly categoryIndex: number;
  a0: number;
  a1: number;
}

interface ArcGeometry {
  a0: number;
  a1: number;
  readonly innerR: number;
  readonly outerR: number;
}

const TOP = -Math.PI / 2;
const TWO_PI = 2 * Math.PI;
const ID_SEP = " / ";

const nodeId = (parentId: string | null, name: string): string =>
  parentId !== null && parentId.length > 0 ? `${parentId}${ID_SEP}${name}` : name;

const sumValues = (node: SunburstNode): number => {
  if ((node.children?.length ?? 0) > 0) {
    return (node.children ?? []).reduce((sum, child) => sum + sumValues(child), 0);
  }
  return node.value ?? 0;
};

interface BuildContext {
  readonly arcs: ArcDatum[];
  readonly focusById: Map<string, Focus>;
  maxDepth: number;
  readonly rootId: string;
  arcIndex: number;
}

const toRadians = (normalized: number): number => TOP + normalized * TWO_PI;

interface LayoutFrame {
  readonly node: SunburstNode;
  readonly id: string;
  readonly depth: number;
  readonly a0: number;
  readonly a1: number;
  readonly parentId: string | null;
  readonly categoryIndex: number;
  readonly trail: readonly string[];
}

interface ChildrenPass {
  readonly frame: LayoutFrame;
  readonly value: number;
}

const layoutChildren = (
  pass: Readonly<ChildrenPass>,
  ctx: BuildContext,
  visit: (childFrame: LayoutFrame, childCtx: BuildContext) => void,
): void => {
  const { frame, value } = pass;
  const { node, id, depth, a0, a1, categoryIndex, trail } = frame;
  const span = a1 - a0;
  let cursor = a0;
  for (const [index, child] of (node.children ?? []).entries()) {
    const childValue = sumValues(child);
    const childSpan = value > 0 ? (childValue / value) * span : 0;
    visit(
      {
        a0: cursor,
        a1: cursor + childSpan,
        categoryIndex: depth === 0 ? index : categoryIndex,
        depth: depth + 1,
        id: nodeId(id, child.name),
        node: child,
        parentId: id,
        trail: depth === 0 ? [node.name] : trail,
      },
      ctx,
    );
    cursor += childSpan;
  }
};

const layoutNode = (frame: Readonly<LayoutFrame>, ctx: BuildContext): void => {
  const value = sumValues(frame.node);
  const hasChildren = Boolean(frame.node.children?.length);

  if (frame.depth > 0) {
    ctx.arcs.push({
      a0: frame.a0,
      a1: frame.a1,
      arcIndex: ctx.arcIndex,
      categoryIndex: frame.categoryIndex,
      color: frame.node.color,
      depth: frame.depth,
      fill: frame.node.fill,
      hasChildren,
      id: frame.id,
      name: frame.node.name,
      parentId: frame.parentId,
      trail: [...frame.trail, frame.node.name],
      value,
    });
    ctx.arcIndex += 1;
  }

  ctx.focusById.set(frame.id, {
    a0: frame.a0,
    a1: frame.a1,
    categoryIndex: frame.categoryIndex,
    depth: frame.depth,
    id: frame.id,
    name: frame.node.name,
    parentId: frame.parentId,
  });
  ctx.maxDepth = Math.max(ctx.maxDepth, frame.depth);

  if (!hasChildren) {
    return;
  }
  layoutChildren({ frame, value }, ctx, layoutNode);
};

interface SunburstLayout {
  readonly arcs: ArcDatum[];
  readonly focusById: Map<string, Focus>;
  maxDepth: number;
  readonly rootId: string;
  readonly total: number;
}

const buildArcs = (data: SunburstNode): SunburstLayout => {
  const rootId = data.name;
  const ctx: BuildContext = { arcIndex: 0, arcs: [], focusById: new Map(), maxDepth: 0, rootId };

  layoutNode(
    { a0: 0, a1: 1, categoryIndex: 0, depth: 0, id: rootId, node: data, parentId: null, trail: [] },
    ctx,
  );

  for (const arc of ctx.arcs) {
    arc.a0 = toRadians(arc.a0);
    arc.a1 = toRadians(arc.a1);
  }
  for (const focus of ctx.focusById.values()) {
    focus.a0 = toRadians(focus.a0);
    focus.a1 = toRadians(focus.a1);
  }

  return { arcs: ctx.arcs, focusById: ctx.focusById, maxDepth: ctx.maxDepth, rootId, total: sumValues(data) };
};

const MIN_ARC_THICKNESS_PX = 0.5;
const MIN_ARC_ANGLE_RAD = 0.001;
const POINT_PIN_RADIUS_RATIO = 0.12;
const HOVER_GROW_RING_BUDGET = 0.28;
const HOVER_GROW_SEGMENT_CAP = 0.1;

interface ArcPoints {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const arcOuterPoints = (a0: number, a1: number, outer: number): ArcPoints => ({
  x0: Math.sin(a0) * outer,
  x1: Math.sin(a1) * outer,
  y0: -Math.cos(a0) * outer,
  y1: -Math.cos(a1) * outer,
});

const arcInnerPoints = (a0: number, a1: number, inner: number): ArcPoints => ({
  x0: Math.sin(a0) * inner,
  x1: Math.sin(a1) * inner,
  y0: -Math.cos(a0) * inner,
  y1: -Math.cos(a1) * inner,
});

const arcPathFromGeometry = (geometry: Readonly<ArcGeometry>): string | null => {
  const { a0, a1, innerR, outerR } = geometry;
  if (outerR - innerR < MIN_ARC_THICKNESS_PX || a1 - a0 < MIN_ARC_ANGLE_RAD) {
    return null;
  }

  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  const outer = arcOuterPoints(a0, a1, outerR);

  if (innerR < 1) {
    return `M 0 0 L ${outer.x0} ${outer.y0} A ${outerR} ${outerR} 0 ${largeArc} 1 ${outer.x1} ${outer.y1} Z`;
  }

  const inner = arcInnerPoints(a0, a1, innerR);
  return `M ${outer.x0} ${outer.y0} A ${outerR} ${outerR} 0 ${largeArc} 1 ${outer.x1} ${outer.y1} L ${inner.x1} ${inner.y1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${inner.x0} ${inner.y0} Z`;
};

const arcPath = (geometry: Readonly<ArcGeometry>, progress: number, radialProgress = progress): string | null => {
  if (progress <= 0 && radialProgress <= 0) {
    return null;
  }

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const clampedRadialProgress = Math.min(1, Math.max(0, radialProgress));
  const { a0, a1, innerR, outerR } = geometry;

  if (clampedProgress >= 1 && clampedRadialProgress >= 1) {
    return arcPathFromGeometry(geometry);
  }

  const span = a1 - a0;
  const currentGeometry: ArcGeometry = {
    a0,
    a1: a0 + span * clampedProgress,
    innerR: innerR < 1 ? 0 : innerR,
    outerR:
      innerR < 1 ? outerR * clampedRadialProgress : innerR + (outerR - innerR) * clampedRadialProgress,
  };

  return arcPathFromGeometry(currentGeometry);
};

const lerpAngle = (from: number, to: number, progress: number): number => {
  let delta = to - from;
  while (delta > Math.PI) {
    delta -= TWO_PI;
  }
  while (delta < -Math.PI) {
    delta += TWO_PI;
  }
  return from + delta * progress;
};

const lerpGeometry = (from: Readonly<ArcGeometry>, to: Readonly<ArcGeometry>, progress: number): ArcGeometry => {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const fromMid = (from.a0 + from.a1) / 2;
  const toMid = (to.a0 + to.a1) / 2;
  const fromHalf = (from.a1 - from.a0) / 2;
  const toHalf = (to.a1 - to.a0) / 2;
  const mid = lerpAngle(fromMid, toMid, clampedProgress);
  const half = fromHalf + (toHalf - fromHalf) * clampedProgress;

  return {
    a0: mid - half,
    a1: mid + half,
    innerR: from.innerR + (to.innerR - from.innerR) * clampedProgress,
    outerR: from.outerR + (to.outerR - from.outerR) * clampedProgress,
  };
};

const pointGeometry = (source: Readonly<ArcGeometry>): ArcGeometry => {
  const mid = (source.a0 + source.a1) / 2;
  const radius = (source.innerR + source.outerR) / 2;
  const pin = Math.max(0, Math.min(radius * POINT_PIN_RADIUS_RATIO, source.innerR));
  return { a0: mid, a1: mid, innerR: pin, outerR: pin };
};

const hoverGrowForPathSegment = (hoverPop: number, ringWidth: number, pathLength: number): number => {
  const maxTotalGrow = ringWidth * HOVER_GROW_RING_BUDGET;
  const budgetPerSegment = maxTotalGrow / pathLength;
  const perSegmentCap = ringWidth * HOVER_GROW_SEGMENT_CAP;
  return Math.min(hoverPop, perSegmentCap, budgetPerSegment);
};

const defaultSunburstGrowPadding = (maxDepth: number, size: number, hoverPop: number): number => {
  const fullRadius = size / 2;
  const rootRingWidth = fullRadius / Math.max(1, maxDepth);
  const pathLength = Math.max(1, maxDepth - 1);
  const segmentGrow = hoverGrowForPathSegment(hoverPop, rootRingWidth, pathLength);
  return Math.ceil(segmentGrow * pathLength + segmentGrow);
};

const DRILL_CENTER_SCALE = 0.65;
const DRILL_CENTER_DEPTH_SHRINK = 0.08;
const MIN_DRILL_CENTER_SCALE = 0.45;
const FOCUS_SPAN_EPSILON = 1e-9;
const ROOT_FOCUS_DEPTH = 0;
const FIRST_DRILL_DEPTH_OFFSET = 1;
const MIN_VISIBLE_RINGS = 1;
const RING_INDEX_BASE = 1;
const CENTROID_DIVISOR = 2;
const CLOCKWISE_ORIGIN = 0;


interface RingOptions {
  readonly centerR: number;
  readonly ringWidth: number;
}

const ringOptions = (focusDepth: number, maxDepth: number, radius: number): RingOptions => {
  const oneLevelCenterR = radius / maxDepth;
  if (focusDepth === ROOT_FOCUS_DEPTH) {
    return { centerR: 0, ringWidth: oneLevelCenterR };
  }
  const depthPastFirstDrill = Math.max(ROOT_FOCUS_DEPTH, focusDepth - FIRST_DRILL_DEPTH_OFFSET);
  const centerScale = Math.max(
    MIN_DRILL_CENTER_SCALE,
    DRILL_CENTER_SCALE - depthPastFirstDrill * DRILL_CENTER_DEPTH_SHRINK,
  );
  const centerR = oneLevelCenterR * centerScale;
  const visibleRings = Math.max(MIN_VISIBLE_RINGS, maxDepth - focusDepth);
  const ringWidth = (radius - centerR) / visibleRings;
  return { centerR, ringWidth };
};

const geometryFor = (
  arc: ArcDatum,
  focus: Focus,
  maxDepth: number,
  radius: number,
): ArcGeometry | null => {
  if (arc.depth <= focus.depth) {
    return null;
  }
  if (arc.id !== focus.id && !arc.id.startsWith(`${focus.id}${ID_SEP}`)) {
    return null;
  }

  const { centerR, ringWidth } = ringOptions(focus.depth, maxDepth, radius);
  const relativeDepth = arc.depth - focus.depth;
  const focusSpan = focus.a1 - focus.a0;
  const mapAngle = (angle: number): number => {
    if (focusSpan <= FOCUS_SPAN_EPSILON) {
      return TOP;
    }
    return TOP + ((angle - focus.a0) / focusSpan) * TWO_PI;
  };

  return {
    a0: mapAngle(arc.a0),
    a1: mapAngle(arc.a1),
    innerR: centerR + (relativeDepth - RING_INDEX_BASE) * ringWidth,
    outerR: centerR + relativeDepth * ringWidth,
  };
};

const geomCentroidAngle = (geometry: Readonly<ArcGeometry>): number => (geometry.a0 + geometry.a1) / CENTROID_DIVISOR;

const geomCentroidRadius = (geometry: Readonly<ArcGeometry>): number => (geometry.innerR + geometry.outerR) / CENTROID_DIVISOR;

const clockwiseFraction = (angle: number): number => {
  let normalized = angle - TOP;
  if (normalized < CLOCKWISE_ORIGIN) {
    normalized += TWO_PI;
  }
  return normalized / TWO_PI;
};

// Legacy positional signature (sunburst.ts:267): six parameters is the legacy call shape.
// eslint-disable-next-line max-params
const transitionGeometry = (
  arc: ArcDatum,
  fromFocus: Focus,
  toFocus: Focus,
  maxDepth: number,
  radius: number,
  progress: number,
): ArcGeometry | null => {
  const from = geometryFor(arc, fromFocus, maxDepth, radius);
  const to = geometryFor(arc, toFocus, maxDepth, radius);

  if (from === null) {
    return to === null ? null : lerpGeometry(pointGeometry(to), to, progress);
  }
  return to === null ? lerpGeometry(from, pointGeometry(from), progress) : lerpGeometry(from, to, progress);
};

export {
  ID_SEP,
  TOP,
  TWO_PI,
  arcPath,
  arcPathFromGeometry,
  buildArcs,
  clockwiseFraction,
  defaultSunburstGrowPadding,
  geomCentroidAngle,
  geomCentroidRadius,
  geometryFor,
  hoverGrowForPathSegment,
  lerpAngle,
  lerpGeometry,
  nodeId,
  pointGeometry,
  ringOptions,
  sumValues,
  toRadians,
  transitionGeometry,
};
export type { ArcDatum, ArcGeometry, Focus, SunburstLayout, SunburstNode };
