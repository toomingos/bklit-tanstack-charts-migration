// R10 seam: remove when TanStack/charts I4/I5 ship
import { Children, createElement, isValidElement } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

// Hidden defs host beside the chart svg; url(#id) paints resolve document-wide.
const RESOURCE_HOST_STYLE: CSSProperties = { height: 0, overflow: "hidden", position: "absolute", width: 0 };

interface ResourceHostProps {
  readonly idPrefix: string;
  readonly resources: ReactNode;
}

// Sole renderer of pattern, radialGradient, mask and sweep defs; linear gradients stay in spec.gradients.
// Masks need explicit x/y/width/height: the 0×0 viewport makes the userSpaceOnUse default region empty (D559).
const ResourceHost = ({ idPrefix, resources }: Readonly<ResourceHostProps>): ReactElement | null => {
  if (Children.toArray(resources).length === 0) {
    return null;
  }
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={0}
      id={`${idPrefix}-resources`}
      style={RESOURCE_HOST_STYLE}
      width={0}
    >
      <defs>{resources}</defs>
    </svg>
  );
};

// Scopes one consumer resource id to the mount (D548 ruling 2).
// Definitions reference the scoped id; the seam rewrites the def id on entry.
const scopedResourceId = (idPrefix: string, id: string): string =>
  id.startsWith(`${idPrefix}-`) ? id : `${idPrefix}-${id}`;

// Rewrites a local ref (#id, url(#id)) to the scoped id; absolute refs pass through.
const scopedResourceRef = (idPrefix: string, ref: string): string =>
  ref.startsWith("#") ? `#${scopedResourceId(idPrefix, ref.slice(1))}` : ref;

interface ScopableProps {
  readonly id?: unknown;
  readonly href?: unknown;
  readonly xlinkHref?: unknown;
  readonly children?: ReactNode;
}

// Typeof narrowing lives in predicates (the established codebase pattern).
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isLocalRef = (value: unknown): value is string =>
  isNonEmptyString(value) && value.startsWith("#");

// Scopes a resources tree to the mount (D548 ruling 2); definitions reference the scoped ids.
const scopeResourceIds = (nodes: ReactNode, idPrefix: string): ReactNode =>
  Children.map(nodes, (node): ReactNode => {
    if (isValidElement<ScopableProps>(node)) {
      const { children, href, id, xlinkHref } = node.props;
      const scopedChildren = scopeResourceIds(children, idPrefix);
      const nextId = isNonEmptyString(id) ? scopedResourceId(idPrefix, id) : undefined;
      const nextHref = isLocalRef(href) ? scopedResourceRef(idPrefix, href) : undefined;
      const nextXlinkHref = isLocalRef(xlinkHref) ? scopedResourceRef(idPrefix, xlinkHref) : undefined;
      const unchanged = nextId === undefined && nextHref === undefined && nextXlinkHref === undefined && scopedChildren === children;
      if (unchanged) {return node;}
      return createElement(node.type, {
        ...node.props,
        ...(nextId === undefined ? undefined : { id: nextId }),
        ...(nextHref === undefined ? undefined : { href: nextHref }),
        ...(nextXlinkHref === undefined ? undefined : { xlinkHref: nextXlinkHref }),
        ...(scopedChildren === children ? undefined : { children: scopedChildren }),
        key: node.key ?? undefined,
      });
    }
    return node;
  });

// Rewrites url(#id) paints to the scoped id; solid paints pass through.
const scopePaintUrl = (paint: string, idPrefix: string): string =>
  paint.replaceAll(/url\(#([^)]+)\)/gu, (_match: string, id: string) => `url(#${scopedResourceId(idPrefix, id)})`);

export { ResourceHost, scopedResourceId, scopeResourceIds, scopePaintUrl };
export type { ResourceHostProps };
