// R10 seam: remove when TanStack/charts I4/I5 ship
import { Children, createElement, isValidElement } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useChartStable } from "./chart-context";
import { generateEasedGradientStops } from "./skeleton-data";

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

// Sweep mask for loading placeholders (R10 seam; bklit loading-sweep.tsx).
// Explicit region per D559; travel is CSS, re-roll is animationiteration.
const LOADING_SWEEP_TILE_WIDTH = 3;
const LOADING_SWEEP_ANGLE_DEG = 25;

const loadingSweepMaskId = (idPrefix: string): string => `${idPrefix}-loading-sweep-mask`;
const loadingSweepPatternId = (idPrefix: string): string => `${idPrefix}-loading-sweep-pattern`;
const loadingSweepGradientId = (idPrefix: string): string => `${idPrefix}-loading-sweep-gradient`;

// Bare nodes for the seam; ResourceHost owns the defs.
// Region is the plot rect in the masked element's local px.
const LoadingSweepMask = ({
  idPrefix,
  x,
  y,
  width,
  height,
  onSweepIteration,
}: Readonly<{
  readonly idPrefix: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly onSweepIteration?: () => void;
}>): ReactElement => (
  <>
    <linearGradient id={loadingSweepGradientId(idPrefix)} x1="0" x2="1" y1="0" y2="0">
      {generateEasedGradientStops().map((stop) => (
        <stop key={stop.offset} offset={stop.offset} stopColor="white" stopOpacity={stop.opacity} />
      ))}
    </linearGradient>
    <pattern
      height="1"
      id={loadingSweepPatternId(idPrefix)}
      patternContentUnits="objectBoundingBox"
      patternTransform={`rotate(${LOADING_SWEEP_ANGLE_DEG})`}
      patternUnits="objectBoundingBox"
      width={LOADING_SWEEP_TILE_WIDTH}
      x="0"
      y="0"
    >
      <rect
        className="ts-bkm-loading-sweep-band"
        fill={`url(#${loadingSweepGradientId(idPrefix)})`}
        height="1"
        onAnimationIteration={onSweepIteration}
        width="1"
        x="0"
        y="0"
      />
    </pattern>
    <mask height={height} id={loadingSweepMaskId(idPrefix)} maskUnits="userSpaceOnUse" width={width} x={x} y={y}>
      <rect fill={`url(#${loadingSweepPatternId(idPrefix)})`} height={height} width={width} x={x} y={y} />
    </mask>
  </>
);

// Mask style for the div wrapping the placeholder chart.
// Per-mark mask has no native channel, so the seam mask applies here.
const loadingSweepMaskStyle = (idPrefix: string): CSSProperties => {
  const ref = `url(#${loadingSweepMaskId(idPrefix)})`;
  return { WebkitMaskImage: ref, maskImage: ref };
};

interface LoadingSweepResourcesProps {
  readonly idPrefix: string;
  readonly onSweepIteration?: () => void;
}

// Seam resources from the live plot rect; empty plots render no mask.
// An empty region would mask everything out.
const LoadingSweepResources = ({ idPrefix, onSweepIteration }: Readonly<LoadingSweepResourcesProps>): ReactElement | null => {
  const { chart } = useChartStable();
  if (chart === undefined || chart.width <= 0 || chart.height <= 0) {
    return null;
  }
  return (
    <LoadingSweepMask
      height={chart.height}
      idPrefix={idPrefix}
      onSweepIteration={onSweepIteration}
      width={chart.width}
      x={chart.x}
      y={chart.y}
    />
  );
};

// Pulse mask for the BarPulse wave (D590; bklit bar-depth.tsx clipPath).
// Explicit region per D559; the crop path is the bar silhouette, white = keep.
// Keyed by pulseId (the mark's dataKey) so N pulses on one chart get N distinct masks instead of sharing one singleton id.
const barPulseMaskId = (idPrefix: string, pulseId: string): string => `${idPrefix}-bar-pulse-mask-${pulseId}`;

// Bare nodes for the seam; ResourceHost owns the defs.
// Region is the plot rect in the masked element's local px.
const BarPulseMask = ({
  idPrefix,
  pulseId,
  clipD,
  x,
  y,
  width,
  height,
}: Readonly<{
  readonly idPrefix: string;
  readonly pulseId: string;
  readonly clipD: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}>): ReactElement => (
  <mask height={height} id={barPulseMaskId(idPrefix, pulseId)} maskUnits="userSpaceOnUse" width={width} x={x} y={y}>
    <path d={clipD} fill="white" />
  </mask>
);

export {
  ResourceHost,
  BarPulseMask,
  barPulseMaskId,
  LoadingSweepMask,
  LoadingSweepResources,
  loadingSweepGradientId,
  loadingSweepMaskId,
  loadingSweepMaskStyle,
  scopedResourceId,
  scopeResourceIds,
  scopePaintUrl,
};
export type { LoadingSweepResourcesProps, ResourceHostProps };
