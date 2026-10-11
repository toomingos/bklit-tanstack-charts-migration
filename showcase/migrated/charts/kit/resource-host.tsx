// Hidden defs host beside the chart svg; url(#id) paints resolve document-wide.
import { Children, createElement, isValidElement } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { isString } from "./guards";

const RESOURCE_HOST_STYLE: CSSProperties = { height: 0, overflow: "hidden", position: "absolute", width: 0 };

interface ResourceHostProps {
  readonly idPrefix: string;
  readonly resources: ReactNode;
}

// Renders consumer defs (patterns, masks, gradients) once per mount.
export const ResourceHost = ({ idPrefix, resources }: Readonly<ResourceHostProps>): ReactElement | null => {
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

// Scopes one consumer resource id to the mount so two charts never share an id.
const scopedResourceId = (idPrefix: string, id: string): string =>
  id.startsWith(`${idPrefix}-`) ? id : `${idPrefix}-${id}`;

// Rewrites a local ref (#id) to the scoped id; absolute refs pass through.
const scopedResourceRef = (idPrefix: string, ref: string): string =>
  ref.startsWith("#") ? `#${scopedResourceId(idPrefix, ref.slice(1))}` : ref;

interface ScopableProps {
  readonly id?: unknown;
  readonly href?: unknown;
  readonly xlinkHref?: unknown;
  readonly children?: ReactNode;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

const isLocalRef = (value: unknown): value is string => isNonEmptyString(value) && value.startsWith("#");

// Scopes a resources tree to the mount; definitions reference the scoped ids.
export const scopeResourceIds = (nodes: ReactNode, idPrefix: string): ReactNode =>
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
export const scopePaintUrl = (paint: string, idPrefix: string): string =>
  paint.replaceAll(/url\(#([^)]+)\)/gu, (_match: string, id: string) => `url(#${scopedResourceId(idPrefix, id)})`);

interface PatternProps {
  readonly patternTransform?: unknown;
  readonly children?: ReactNode;
}

// Moves every <pattern> tile origin by (dx, dy) at render time, keeping the consumer's own patternTransform after the shift.
export const translatePatterns = (nodes: ReactNode, dx: number, dy: number): ReactNode =>
  Children.map(nodes, (node): ReactNode => {
    if (!isValidElement<PatternProps>(node)) {
      return node;
    }
    if (node.type === "pattern") {
      const own = isString(node.props.patternTransform) ? node.props.patternTransform : "";
      return createElement(node.type, { ...node.props, patternTransform: `translate(${dx} ${dy}) ${own}`.trim() });
    }
    const { children } = node.props;
    const shifted = translatePatterns(children, dx, dy);
    return shifted === children ? node : createElement(node.type, { ...node.props, key: node.key ?? undefined }, shifted);
  });
