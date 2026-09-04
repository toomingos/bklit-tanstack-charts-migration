import { memo, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
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

// Deep-readonly view of SunburstNode: the breadcrumb helpers only read the input
// Tree, but SunburstNode (sunburst-types.ts) keeps a mutable `children` array for
// Callers that build trees imperatively — same reason sunburst-geometry.ts composes
// Its readonly view locally rather than upstream, so this file does the same.
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


interface SunburstBreadcrumbProps {
  readonly className?: string;
  readonly children: ReactNode;
}

const renderSunburstBreadcrumb = ({ className, children }: Readonly<SunburstBreadcrumbProps>): ReactElement => (
    <nav
      aria-label="Drill-down path"
      className={className}
      style={className !== undefined && className !== "" ? undefined : { marginBottom: 16 }}
    >
      {children}
    </nav>
  );

const SunburstBreadcrumb = memo(renderSunburstBreadcrumb);

SunburstBreadcrumb.displayName = "SunburstBreadcrumb";

export {
  buildSunburstBreadcrumbItems,
  SunburstBreadcrumb,
  useSunburstBreadcrumbItems,
};
export type { SunburstBreadcrumbItem, SunburstBreadcrumbProps };
