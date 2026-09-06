import type { ChartPoint, SceneNode } from "@tanstack/charts";
import type { BarDepthSegment } from "./bar-depth-geometry";
import type { ChartDatum } from "./types";

const GLASS_TIP_OPACITY = 0.2;

interface SideFacePointsOptions {
  readonly bandWidth: number;
  readonly bandX: number;
  readonly bottomEdge: number;
  readonly depth: number;
  readonly isRightOfCenter: boolean;
  readonly perspectiveRise: number;
  readonly topEdge: number;
}

const sideFacePoints = (options: Readonly<SideFacePointsOptions>): [number, number][] => {
  const { bandWidth, bandX, bottomEdge, depth, isRightOfCenter, perspectiveRise, topEdge } = options;
  if (isRightOfCenter) {
    const x = bandX;
    return [
      [x, topEdge],
      [x - depth, topEdge - perspectiveRise],
      [x - depth, bottomEdge - perspectiveRise],
      [x, bottomEdge],
    ];
  }
  const x = bandX + bandWidth;
  return [
    [x, topEdge],
    [x + depth, topEdge - perspectiveRise],
    [x + depth, bottomEdge - perspectiveRise],
    [x, bottomEdge],
  ];
}

interface LidFacePointsOptions {
  readonly bandWidth: number;
  readonly bandX: number;
  readonly depth: number;
  readonly isRightOfCenter: boolean;
  readonly perspectiveRise: number;
  readonly topY: number;
}

const lidFacePoints = (options: Readonly<LidFacePointsOptions>): [number, number][] => {
  const { bandWidth, bandX, depth, isRightOfCenter, perspectiveRise, topY } = options;
  const left = bandX;
  const right = bandX + bandWidth;
  if (isRightOfCenter) {
    return [
      [left, topY],
      [right, topY],
      [right - depth, topY - perspectiveRise],
      [left - depth, topY - perspectiveRise],
    ];
  }
  return [
    [left, topY],
    [right, topY],
    [right + depth, topY - perspectiveRise],
    [left + depth, topY - perspectiveRise],
  ];
}

interface PushBackBarPointsParams {
  readonly bandWidth: number;
  readonly bandX: number;
  readonly bottomY: number;
  readonly datum: ChartDatum;
  readonly fill: string;
  readonly id: string;
  readonly index: number;
  readonly points: ChartPoint<ChartDatum, string, number>[];
  readonly topY: number;
  readonly xValue: string;
  readonly yValue: number;
}

const pushBackBarPoints = (params: Readonly<PushBackBarPointsParams>): void => {
  const { bandWidth, bandX, bottomY, datum, fill, id, index, points, topY, xValue, yValue } = params;
  // Point keys are `:`-boundary prefixes of face sub-node keys for prefix-based point ownership.
  const sideKey = `${id}:side:${index}`;
  const lidKey = `${id}:lid:${index}`;
  points.push({
    color: fill,
    datum,
    datumIndex: index,
    group: id,
    groupLabel: id,
    key: sideKey,
    markId: id,
    x: bandX + bandWidth / 2,
    xValue,
    y: (topY + bottomY) / 2,
    yValue,
  }, {
    color: fill,
    datum,
    datumIndex: index,
    group: id,
    groupLabel: id,
    key: lidKey,
    markId: id,
    x: bandX + bandWidth / 2,
    xValue,
    y: topY,
    yValue,
  });
}

interface PushBackBarNodesParams {
  readonly bandWidth: number;
  readonly bandX: number;
  readonly bottomY: number;
  readonly depth: number;
  readonly fill: string;
  readonly glassPosId: string;
  readonly id: string;
  readonly index: number;
  readonly isRightOfCenter: boolean;
  readonly nodes: SceneNode[];
  readonly opacity: number | undefined;
  readonly perspectiveRise: number;
  readonly sideShadeId: string;
  readonly topShadeId: string;
  readonly topY: number;
  readonly naturalHeight: number;
  readonly topYTrim: number;
  readonly segments?: readonly BarDepthSegment[] | null;
}

interface SidePieceGeometry {
  readonly bandWidth: number;
  readonly bandX: number;
  readonly bottomY: number;
  readonly depth: number;
  readonly isRightOfCenter: boolean;
  readonly perspectiveRise: number;
}

// Per-segment side faces (legacy `buildSidePieces`): scaled heights, topmost sheds `topYTrim`.
// Undefined for null/empty/degenerate segments — caller keeps the single-face path.
const resolveSidePieces = (
  geometry: Readonly<SidePieceGeometry>,
  naturalHeight: number,
  topYTrim: number,
  segments: readonly BarDepthSegment[] | null | undefined,
): [number, number][][] | undefined => {
  if (!segments || segments.length === 0) {return undefined;}
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {return undefined;}
  const pieces: [number, number][][] = [];
  let cursorY = geometry.bottomY;
  for (let pieceIndex = 0; pieceIndex < segments.length; pieceIndex += 1) {
    const segment = segments.at(pieceIndex);
    if (segment !== undefined) {
      const isTopmost = pieceIndex === segments.length - 1;
      const scaledHeight = (segment.value / total) * naturalHeight;
      const height = isTopmost ? Math.max(0, scaledHeight - topYTrim) : scaledHeight;
      const segBottomY = cursorY;
      const segTopY = cursorY - height;
      cursorY = segTopY;
      pieces.push(sideFacePoints({ ...geometry, bottomEdge: segBottomY, topEdge: segTopY }));
    }
  }
  return pieces.length > 0 ? pieces : undefined;
}

const pushBackBarNodes = (params: Readonly<PushBackBarNodesParams>): void => {
  const { bandWidth, bandX, bottomY, depth, fill, glassPosId, id, index, isRightOfCenter, nodes, opacity, perspectiveRise, sideShadeId, topShadeId, topY, naturalHeight, topYTrim, segments } = params;
  const sideKey = `${id}:side:${index}`;
  const lid = lidFacePoints({ bandWidth, bandX, depth, isRightOfCenter, perspectiveRise, topY });
  const lidKey = `${id}:lid:${index}`;
  // Per-segment solids; one full-side shade + glass keeps gradients continuous.
  // Lid takes the topmost segment colour; without segments this is the single-face path.
  const sidePieces = resolveSidePieces({ bandWidth, bandX, bottomY, depth, isRightOfCenter, perspectiveRise }, naturalHeight, topYTrim, segments);
  if (sidePieces) {
    for (let pieceIndex = 0; pieceIndex < sidePieces.length; pieceIndex += 1) {
      const piece = sidePieces.at(pieceIndex);
      const segment = segments?.at(pieceIndex);
      if (piece !== undefined && segment !== undefined) {
        nodes.push({
          key: `${sideKey}:seg:${pieceIndex}`,
          kind: "area",
          points: piece,
          style: { fill: segment.color, opacity },
        });
      }
    }
  } else {
    const side = sideFacePoints({ bandWidth, bandX, bottomEdge: bottomY, depth, isRightOfCenter, perspectiveRise, topEdge: topY });
    nodes.push({
      key: sideKey,
      kind: "area",
      points: side,
      style: { fill, opacity },
    });
  }
  const fullSide = sideFacePoints({ bandWidth, bandX, bottomEdge: bottomY, depth, isRightOfCenter, perspectiveRise, topEdge: topY });
  const topmost = sidePieces && segments?.at(-1);
  const lidFill = topmost?.color ?? fill;
  nodes.push({
    key: `${sideKey}:shade`,
    kind: "area",
    points: fullSide,
    style: { fill: `url(#${sideShadeId})`, opacity },
  }, {
    key: `${sideKey}:glass`,
    kind: "area",
    points: fullSide,
    style: { fill: `url(#${glassPosId})`, opacity },
  }, {
    key: lidKey,
    kind: "area",
    points: lid,
    style: { fill: lidFill, opacity },
  }, {
    key: `${lidKey}:tip`,
    kind: "area",
    points: lid,
    style: { fill: "white", fillOpacity: GLASS_TIP_OPACITY, opacity },
  }, {
    key: `${lidKey}:shade`,
    kind: "area",
    points: lid,
    style: { fill: `url(#${topShadeId})`, opacity },
  });
}

export {
  GLASS_TIP_OPACITY,
  pushBackBarNodes,
  pushBackBarPoints,
};
export type {
  PushBackBarNodesParams,
  PushBackBarPointsParams,
};
