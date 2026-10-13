"use client";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Focus } from "./arcs";
import { useSunburstStable } from "./context";

/** One crumb of the drill-down trail. */
export interface SunburstBreadcrumbItem {
  /** Node id to pass to `zoomTo`. */
  id: string;
  /** Display name of the node (the root uses the name of `data`). */
  label: string;
  /** `true` for the node currently focused, which is the last crumb. */
  isCurrent: boolean;
}

/** Props of `SunburstBreadcrumb`. */
export interface SunburstBreadcrumbProps {
  /** Class name of the wrapping `nav` element. */
  className?: string;
  /** Breadcrumb UI, usually built from `useSunburstBreadcrumbItems`. */
  children: ReactNode;
}

/** Slot above the chart for drill-down navigation. Render your own trail inside it using `useSunburstBreadcrumbItems`. */
export const SunburstBreadcrumb = ({ className, children }: Readonly<SunburstBreadcrumbProps>): ReactNode => (
  <nav aria-label="Drill-down path" className={className ?? "bk-sb-crumbs"}>
    {children}
  </nav>
);
SunburstBreadcrumb.displayName = "SunburstBreadcrumb";

interface SunburstBreadcrumbItems {
  items: SunburstBreadcrumbItem[];
  zoomTo: (id: string) => void;
}

/** Returns the drill-down trail (`items`, root first) and `zoomTo` to jump to a node by id. Call it inside `SunburstChart`; it throws otherwise. */
export const useSunburstBreadcrumbItems = (): SunburstBreadcrumbItems => {
  const { data, focus, focusById, rootId, zoomTo } = useSunburstStable();
  const { name: rootName } = data;
  const items = useMemo((): SunburstBreadcrumbItem[] => {
    const crumbs: Focus[] = [];
    let cur: Focus | undefined = focus;
    while (cur) {
      crumbs.unshift(cur);
      cur = cur.parentId === null ? undefined : focusById.get(cur.parentId);
    }
    return crumbs.map((crumb, index) => ({
      id: crumb.id,
      isCurrent: index === crumbs.length - 1,
      label: crumb.id === rootId ? rootName : crumb.name,
    }));
  }, [rootName, focus, focusById, rootId]);
  return { items, zoomTo };
};
