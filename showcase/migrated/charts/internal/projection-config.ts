import * as React from "react";
import { roleOf } from "./children-extract";
import type { ProjectionPoint } from "./projection-utils";
import { projectionDateExtents, projectionValueExtents } from "./projection-utils";
import { normalizeYAxisId } from "./y-axis-id";

interface ProjectionLineConfig {
  readonly yAxisId: string;
  readonly data: readonly Readonly<ProjectionPoint>[];
}

interface ProjectionLineConfigProps {
  data?: readonly Readonly<ProjectionPoint>[];
  yAxisId?: string | number;
}

// Baseline ceiling when a non-negative domain collapses to zero; headroom and
// Padding fractions for folding projection paths into the visible domain.
const PROJECTION_FALLBACK_DOMAIN_MAX = 100;
const PROJECTION_HEADROOM_FACTOR = 1.1;
const PROJECTION_DOMAIN_PADDING_FRACTION = 0.05;
const VISIBLE_END_STROKE_HALF_FACTOR = 0.5;

const normalizeProjectionData = (data: readonly Readonly<ProjectionPoint>[] | undefined): ProjectionPoint[] => {
  if (data === undefined || data.length === 0) {
    return [];
  }
  return data.map((point: Readonly<ProjectionPoint>) => ({
    date: point.date instanceof Date ? point.date : new Date(point.date),
    value: point.value,
  }));
}

const pushProjectionLineConfig = (props: Readonly<ProjectionLineConfigProps>, configs: ProjectionLineConfig[]): void => {
  const data = normalizeProjectionData(props.data);
  if (data.length >= 2) {
    configs.push({
      data,
      yAxisId: normalizeYAxisId(props.yAxisId),
    });
  }
};

type ProjectionChildElement = React.ReactElement<{ children?: React.ReactNode }>;

type ProjectionVisit = (node: React.ReactNode) => void;

const tryPushProjectionLineConfig = (child: ProjectionChildElement, configs: ProjectionLineConfig[]): boolean => {
  const role = roleOf(child.type);
  // The role check establishes the component contract at runtime.
  // A "projectionLine" element always carries ProjectionLineConfigProps,
  // So re-narrowing the valid element pins that shape with no `as`.
  if (role === "projectionLine" && React.isValidElement<ProjectionLineConfigProps>(child)) {
    pushProjectionLineConfig(child.props, configs);
    return true;
  }
  return false;
};

const visitProjectionChild = (child: ProjectionChildElement, configs: ProjectionLineConfig[], visit: ProjectionVisit): void => {
  if (child.type === React.Fragment) {
    visit(child.props.children);
    return;
  }
  if (tryPushProjectionLineConfig(child, configs)) {return;}
  const nestedChildren = child.props.children;
  if (nestedChildren !== undefined && nestedChildren !== null) {visit(nestedChildren);}
};

const extractProjectionLineConfigs = (children: React.ReactNode): ProjectionLineConfig[] => {
  const configs: ProjectionLineConfig[] = [];
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      // Pin the props generic at the validity check, not via `as`.
      // Every valid element carries a props object, so reading
      // `children` needs no assertion.
      if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
        visitProjectionChild(child, configs, visit);
      }
    }
  };
  visit(children);
  return configs;
}

const collapseNonNegativeYDomain = (nextMax: number): [number, number] => [
  0,
  nextMax <= 0 ? PROJECTION_FALLBACK_DOMAIN_MAX : nextMax * PROJECTION_HEADROOM_FACTOR,
];

interface ProjectionValueExtents {
  readonly minValue: number;
  readonly maxValue: number;
}

const foldProjectionExtents = (min: number, max: number, extents: Readonly<ProjectionValueExtents>): [number, number] => {
  const nextMin = Math.min(min, extents.minValue);
  const nextMax = Math.max(max, extents.maxValue);
  if (nextMin >= 0 && min >= 0) {
    return collapseNonNegativeYDomain(nextMax);
  }
  const padding = (nextMax - nextMin) * PROJECTION_DOMAIN_PADDING_FRACTION || 1;
  return [nextMin - padding, nextMax + padding];
};

const mergeProjectionYDomain = (domain: [number, number], configs: readonly ProjectionLineConfig[], yAxisId: string): [number, number] => {
  const paths: (readonly Readonly<ProjectionPoint>[])[] = [];
  for (const config of configs) {
    if (config.yAxisId === yAxisId) {paths.push(config.data);}
  }
  const extents = projectionValueExtents(paths);
  if (!extents) {
    return domain;
  }
  const [min, max] = domain;
  return foldProjectionExtents(min, max, extents);
}

const mergeProjectionXDomainMax = (maxTime: number, configs: readonly ProjectionLineConfig[]): number => {
  const paths = configs.map((config: ProjectionLineConfig) => config.data);
  const extents = projectionDateExtents(paths);
  if (!extents) {
    return maxTime;
  }
  return Math.max(maxTime, extents.maxTime);
}

interface VisibleEndXParams {
  readonly endX: number;
  readonly innerWidth: number;
  readonly endpointRadius: number;
  readonly strokeWidth: number;
  readonly showEndMarker: boolean;
}

const resolveVisibleEndX = (params: Readonly<VisibleEndXParams>): number => {
  const { endX, innerWidth, endpointRadius, strokeWidth, showEndMarker } = params;
  const edgePadding = (showEndMarker ? endpointRadius : 0) + strokeWidth * VISIBLE_END_STROKE_HALF_FACTOR + 1;
  return Math.min(endX, Math.max(0, innerWidth - edgePadding));
}

export { extractProjectionLineConfigs, mergeProjectionYDomain, mergeProjectionXDomainMax, resolveVisibleEndX };
export type { ProjectionLineConfig, VisibleEndXParams };
