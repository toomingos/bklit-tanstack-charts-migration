import * as React from "react";
import { roleOf } from "../children";
import type { ProjectionPoint } from "./projection-utils";
import { projectionDateExtents, projectionValueExtents } from "./projection-utils";

export interface ProjectionLineConfig {
  yAxisId: string;
  data: ProjectionPoint[];
}

function normalizeYAxisId(id?: string | number): string {
  if (id == null || id === "") return "left";
  return String(id);
}

interface ProjectionLineConfigProps {
  data?: ProjectionPoint[];
  yAxisId?: string | number;
}

function normalizeProjectionData(data: ProjectionPoint[] | undefined): ProjectionPoint[] {
  if (!data?.length) {
    return [];
  }
  return data.map((point) => ({
    date: point.date instanceof Date ? point.date : new Date(point.date),
    value: point.value,
  }));
}

export function extractProjectionLineConfigs(children: React.ReactNode): ProjectionLineConfig[] {
  const configs: ProjectionLineConfig[] = [];
  const visit = (node: React.ReactNode) => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      const role = roleOf(child.type);
      if (role === "projectionLine") {
        const props = child.props as ProjectionLineConfigProps | undefined;
        const data = normalizeProjectionData(props?.data);
        if (data.length >= 2) {
          configs.push({
            yAxisId: normalizeYAxisId(props?.yAxisId),
            data,
          });
        }
        continue;
      }
      const cp = child.props as { children?: React.ReactNode } | undefined;
      if (cp?.children) visit(cp.children);
    }
  };
  visit(children);
  return configs;
}

export function mergeProjectionYDomain(domain: [number, number], configs: ProjectionLineConfig[], yAxisId: string): [number, number] {
  const paths = configs.filter((config) => config.yAxisId === yAxisId).map((config) => config.data);
  const extents = projectionValueExtents(paths);
  if (!extents) {
    return domain;
  }
  const [min, max] = domain;
  const nextMin = Math.min(min, extents.minValue);
  const nextMax = Math.max(max, extents.maxValue);
  if (nextMin >= 0 && min >= 0) {
    return [0, nextMax <= 0 ? 100 : nextMax * 1.1];
  }
  const padding = (nextMax - nextMin) * 0.05 || 1;
  return [nextMin - padding, nextMax + padding];
}

export function mergeProjectionXDomainMax(maxTime: number, configs: ProjectionLineConfig[]): number {
  const paths = configs.map((config) => config.data);
  const extents = projectionDateExtents(paths);
  if (!extents) {
    return maxTime;
  }
  return Math.max(maxTime, extents.maxTime);
}

export function resolveVisibleEndX(endX: number, innerWidth: number, endpointRadius: number, strokeWidth: number, showEndMarker: boolean): number {
  const edgePadding = (showEndMarker ? endpointRadius : 0) + strokeWidth * 0.5 + 1;
  return Math.min(endX, Math.max(0, innerWidth - edgePadding));
}
