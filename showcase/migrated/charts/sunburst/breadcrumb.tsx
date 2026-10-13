"use client";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Focus } from "./arcs";
import { useSunburstStable } from "./context";

export interface SunburstBreadcrumbItem {
  id: string;
  label: string;
  isCurrent: boolean;
}

export interface SunburstBreadcrumbProps {
  className?: string;
  children: ReactNode;
}

export const SunburstBreadcrumb = ({ className, children }: Readonly<SunburstBreadcrumbProps>): ReactNode => (
  <nav aria-label="Drill-down path" className={className ?? "mb-4"}>
    {children}
  </nav>
);
SunburstBreadcrumb.displayName = "SunburstBreadcrumb";

interface SunburstBreadcrumbItems {
  items: SunburstBreadcrumbItem[];
  zoomTo: (id: string) => void;
}

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
