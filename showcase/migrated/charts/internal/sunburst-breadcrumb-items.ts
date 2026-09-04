import { useMemo } from 'react';
import { buildArcs } from "./sunburst-geometry";
import type { Focus, SunburstNode } from "./sunburst-types";

interface SunburstBreadcrumbItem {
  id: string;
  label: string;
  isCurrent: boolean;
}

type ReadonlySunburstBreadcrumbNode = Readonly<Omit<SunburstNode, "children">> & {
  readonly children?: readonly ReadonlySunburstBreadcrumbNode[];
};

/*
 * Breadcrumb helpers only read the tree, but SunburstNode keeps mutable children for imperative builders.
 * So this file composes its readonly view locally like sunburst-geometry.ts does.
 */
const collectSunburstCrumbTrail = (focus: Readonly<Focus>, focusById: Readonly<ReadonlyMap<string, Readonly<Focus>>>): Focus[] => {
  const crumbs: Focus[] = [];
  let cur: Focus | undefined = focus;
  while (cur) {
    crumbs.unshift(cur);
    cur = cur.parentId !== null && cur.parentId !== "" ? focusById.get(cur.parentId) : undefined;
  }
  return crumbs;
}

// Root crumb labels from data.name; the trail walks focus->root, then reverses.
const buildSunburstBreadcrumbItems = (data: ReadonlySunburstBreadcrumbNode, focusId?: string): SunburstBreadcrumbItem[] => {
  const { focusById, rootId } = buildArcs(data);
  const rootFocus = focusById.get(rootId);
  const focus = (focusId !== undefined && focusId !== "" ? focusById.get(focusId) : undefined) ?? rootFocus;
  if (!focus) {return [];}
  const crumbs = collectSunburstCrumbTrail(focus, focusById);
  return crumbs.map((crumb: Readonly<Focus>, index) => ({
    id: crumb.id,
    isCurrent: index === crumbs.length - 1,
    label: crumb.id === rootId ? data.name : crumb.name,
  }));
}

const useSunburstBreadcrumbItems = (data: ReadonlySunburstBreadcrumbNode, focusId?: string): SunburstBreadcrumbItem[] => useMemo(() => buildSunburstBreadcrumbItems(data, focusId), [data, focusId]);

export { buildSunburstBreadcrumbItems, useSunburstBreadcrumbItems };
export type { SunburstBreadcrumbItem };
