// P5.5 SB8 — sunburst drill-down breadcrumb.
//
// bklit ships this as `sunburst-breadcrumb.tsx`: a presentational `<nav>`
// wrapper plus a `useSunburstBreadcrumbItems()` hook that pulls `data`,
// `focus`, `focusById`, `rootId` and `zoomTo` off a sunburst context. Migrated
// has no such context and is not getting one (lead ruling D323) — so the
// wrapper is ported verbatim (it never needed the context anyway) and the
// hook's computation becomes a PURE function over the two things a caller
// already holds: the `data` it passed in, and the `focusId` it is already
// controlling through the public `focusId` / `onFocusChange` pair.
//
// Navigation therefore needs no `zoomTo` from a provider either: a caller
// drills in or out by calling `onFocusChange(item.id)` — the same channel the
// chart itself uses. (This refines D323's original sketch, which proposed a
// `SunburstBreadcrumb` taking `items` + `onNavigate`. That shape would have
// CHANGED the public API: bklit's component takes `children` and renders the
// crumbs the caller builds, so taking `items` would have broken the seamless
// swap the migration exists to preserve.)

import { memo, useMemo, type ReactNode } from "react";
import { buildArcs } from "./sunburst-geometry";
import type { Focus, SunburstNode } from "./sunburst-types";

/** bklit `sunburst-breadcrumb.tsx:7-11`. */
export interface SunburstBreadcrumbItem {
  id: string;
  label: string;
  isCurrent: boolean;
}

/**
 * Root-to-focus crumb trail. Pure port of bklit's
 * `useSunburstBreadcrumbItems` body (`sunburst-breadcrumb.tsx:17-29`),
 * including its two details worth keeping straight:
 *   - the walk goes focus -> root via `parentId` and is `unshift`ed, so the
 *     result reads root-first;
 *   - the root crumb is labelled from `data.name`, not from the focus node's
 *     own `name`.
 *
 * `focusId` may be omitted or unknown (a caller between renders, or an id from
 * stale data) — the trail then starts at the root, matching the chart's own
 * `focusById.get(focusId) ?? rootFocus` fallback.
 */
export function buildSunburstBreadcrumbItems(
  data: SunburstNode,
  focusId?: string,
): SunburstBreadcrumbItem[] {
  const { focusById, rootId } = buildArcs(data);
  const rootFocus = focusById.get(rootId);
  const focus = (focusId ? focusById.get(focusId) : undefined) ?? rootFocus;
  if (!focus) return [];

  const crumbs: Focus[] = [];
  let cur: Focus | undefined = focus;
  while (cur) {
    crumbs.unshift(cur);
    cur = cur.parentId ? focusById.get(cur.parentId) : undefined;
  }

  return crumbs.map((c, index) => ({
    id: c.id,
    label: c.id === rootId ? data.name : c.name,
    isCurrent: index === crumbs.length - 1,
  }));
}

/** Memoised wrapper for the common `data` + controlled `focusId` case.
    `buildArcs` walks the whole tree, so this keeps a breadcrumb from
    re-deriving it on every unrelated render. */
export function useSunburstBreadcrumbItems(
  data: SunburstNode,
  focusId?: string,
): SunburstBreadcrumbItem[] {
  return useMemo(() => buildSunburstBreadcrumbItems(data, focusId), [data, focusId]);
}

export interface SunburstBreadcrumbProps {
  className?: string;
  children: ReactNode;
}

/** bklit `sunburst-breadcrumb.tsx:38-47`, verbatim apart from the default
    className: bklit's `"mb-4"` is a tailwind utility that does not exist in
    migrated's tailwind-free build, so the same 1rem bottom margin is applied
    inline when no className is supplied. */
export const SunburstBreadcrumb = memo(function SunburstBreadcrumb({
  className,
  children,
}: SunburstBreadcrumbProps) {
  return (
    <nav
      aria-label="Drill-down path"
      className={className}
      style={className ? undefined : { marginBottom: 16 }}
    >
      {children}
    </nav>
  );
});

SunburstBreadcrumb.displayName = "SunburstBreadcrumb";
