import type { ChartPoint, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";

const GLASS_TIP_OPACITY = 0.2;

const sideFacePoints = (bandX: number, bandWidth: number, depth: number, perspectiveRise: number, isRightOfCenter: boolean, topEdge: number, bottomEdge: number): [number, number][] => {
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

const lidFacePoints = (bandX: number, bandWidth: number, depth: number, perspectiveRise: number, isRightOfCenter: boolean, topY: number): [number, number][] => {
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
}

const pushBackBarNodes = (params: Readonly<PushBackBarNodesParams>): void => {
  const { bandWidth, bandX, bottomY, depth, fill, glassPosId, id, index, isRightOfCenter, nodes, opacity, perspectiveRise, sideShadeId, topShadeId, topY } = params;
  const side = sideFacePoints(bandX, bandWidth, depth, perspectiveRise, isRightOfCenter, topY, bottomY);
  const lid = lidFacePoints(bandX, bandWidth, depth, perspectiveRise, isRightOfCenter, topY);
  const sideKey = `${id}:side:${index}`;
  const lidKey = `${id}:lid:${index}`;
  nodes.push({
    key: sideKey,
    kind: "area",
    points: side,
    style: { fill, opacity },
  }, {
    key: `${sideKey}:shade`,
    kind: "area",
    points: side,
    style: { fill: `url(#${sideShadeId})`, opacity },
  }, {
    key: `${sideKey}:glass`,
    kind: "area",
    points: side,
    style: { fill: `url(#${glassPosId})`, opacity },
  }, {
    key: lidKey,
    kind: "area",
    points: lid,
    style: { fill, opacity },
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
