import { useMemo } from 'react';
import { useSunburstStable } from "./sunburst-context";
import { nodeId } from "./sunburst-rows";
import type { SunburstNode } from "./sunburst-types";

interface SunburstBreadcrumbItem {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
}

type ReadonlySunburstBreadcrumbNode = Readonly<Omit<SunburstNode, "children">> & {
  readonly children?: readonly ReadonlySunburstBreadcrumbNode[];
};

interface SunburstCrumb {
  readonly id: string;
  readonly label: string;
}

// Depth-first crumb trail; separator-containing names keep stable ids.
const findSunburstCrumbTrail = (
  data: ReadonlySunburstBreadcrumbNode,
  focusId: string,
): SunburstCrumb[] | null => {
  const rootId = data.name;
  const trail: SunburstCrumb[] = [{ id: rootId, label: data.name }];
  if (focusId === rootId) {
    return trail;
  }
  const walk = (node: ReadonlySunburstBreadcrumbNode, id: string): boolean => {
    for (const child of node.children ?? []) {
      const childId = nodeId(id, child.name);
      trail.push({ id: childId, label: child.name });
      if (childId === focusId || walk(child, childId)) {
        return true;
      }
      trail.pop();
    }
    return false;
  };
  return walk(data, rootId) ? trail : null;
}

// Root crumb labels from data.name; unknown focus ids fall back to root alone.
const buildSunburstBreadcrumbItems = (data: ReadonlySunburstBreadcrumbNode, focusId?: string): SunburstBreadcrumbItem[] => {
  const rootId = data.name;
  const resolvedId = focusId !== undefined && focusId !== "" ? focusId : rootId;
  const trail = findSunburstCrumbTrail(data, resolvedId) ?? [{ id: rootId, label: data.name }];
  return trail.map((crumb, index) => ({
    id: crumb.id,
    isCurrent: index === trail.length - 1,
    label: crumb.id === rootId ? data.name : crumb.label,
  }));
}

interface SunburstBreadcrumbItems {
  readonly items: SunburstBreadcrumbItem[];
  readonly zoomTo: (nextId: string) => void;
}

// Legacy hook (sunburst-breadcrumb.tsx:13): context-fed, returns the trail plus the chart's zoomTo.
const useSunburstBreadcrumbItems = (): SunburstBreadcrumbItems => {
  const { data, focus, zoomTo } = useSunburstStable();
  const items = useMemo(() => buildSunburstBreadcrumbItems(data, focus.id), [data, focus.id]);
  return { items, zoomTo };
};

export { buildSunburstBreadcrumbItems, useSunburstBreadcrumbItems };
export type { SunburstBreadcrumbItem };
