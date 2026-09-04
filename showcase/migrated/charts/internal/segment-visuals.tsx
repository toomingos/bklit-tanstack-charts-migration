"use client";

import * as React from "react";
import type { ChartSelection, SegmentComponent } from "./chart-selection";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type SegmentLineVariant = "dashed" | "solid" | "gradient";

// Minimum drag width in px before the brush selection overlay becomes visible.
const SEGMENT_SELECTION_MIN_WIDTH_PX = 5;
const SEGMENT_LINE_DASH_PATTERN = "4,4";
const SEGMENT_LINE_FALLBACK_STROKE = "var(--chart-segment-line)";
const SEGMENT_BACKGROUND_FALLBACK_FILL = "var(--chart-segment-background)";
const SEGMENT_GRADIENT_FADE_START = "0%";
const SEGMENT_GRADIENT_FADE_END = "100%";
const SEGMENT_GRADIENT_SOLID_START = "10%";
const SEGMENT_GRADIENT_SOLID_END = "90%";
const SEGMENT_FADE_TRANSITION = "opacity 150ms ease-out";
const SEGMENT_BACKGROUND_HIDDEN_ANIMATED_STYLE: Readonly<React.CSSProperties> = {
  opacity: 0,
  transition: SEGMENT_FADE_TRANSITION,
};
const SEGMENT_BACKGROUND_HIDDEN_STYLE: Readonly<React.CSSProperties> = {
  opacity: 0,
};
const SEGMENT_BACKGROUND_VISIBLE_ANIMATED_STYLE: Readonly<React.CSSProperties> = {
  opacity: 1,
  transition: SEGMENT_FADE_TRANSITION,
};
const SEGMENT_BACKGROUND_VISIBLE_STYLE: Readonly<React.CSSProperties> = {
  opacity: 1,
};

const resolveSegmentBackgroundStyle = (vis: boolean, reducedMotion: boolean): Readonly<React.CSSProperties> => {
  if (reducedMotion) {
    return vis ? SEGMENT_BACKGROUND_VISIBLE_STYLE : SEGMENT_BACKGROUND_HIDDEN_STYLE;
  }
  return vis ? SEGMENT_BACKGROUND_VISIBLE_ANIMATED_STYLE : SEGMENT_BACKGROUND_HIDDEN_ANIMATED_STYLE;
};

interface SegmentLineStyle {
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly variant: SegmentLineVariant;
}

interface SegmentRenderParams {
  readonly component: Readonly<SegmentComponent>;
  readonly selection: Readonly<ChartSelection>;
  readonly innerHeight: number;
  readonly vis: boolean;
  readonly reducedMotion: boolean;
}

// Segment carrier props arrive as React children props (see extractSegmentComponents);
// Only these visual fields are read, each parsed at its use site below.
interface SegmentVisualProps {
  readonly fill?: unknown;
  readonly variant?: unknown;
  readonly stroke?: unknown;
  readonly strokeWidth?: unknown;
}

// Boundary predicates: React children props are honestly unknown; narrow once here.
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number";

const resolveSegmentFill = (props: Readonly<SegmentVisualProps>): string =>
  isString(props.fill) ? props.fill : SEGMENT_BACKGROUND_FALLBACK_FILL;

const resolveSegmentLineVariant = (props: Readonly<SegmentVisualProps>): SegmentLineVariant => {
  const variantProp: unknown = props.variant;
  return variantProp === "dashed" || variantProp === "solid" || variantProp === "gradient" ? variantProp : "dashed";
};

const resolveSegmentLineStyle = (props: Readonly<SegmentVisualProps>): SegmentLineStyle => ({
  stroke: isString(props.stroke) ? props.stroke : SEGMENT_LINE_FALLBACK_STROKE,
  strokeWidth: isNumber(props.strokeWidth) ? props.strokeWidth : 1,
  variant: resolveSegmentLineVariant(props),
});

const renderSegmentGradientDefs = (gid: string, stroke: string): React.ReactElement => (
  <defs>
    <linearGradient id={gid} x1="0%" x2="0%" y1="0%" y2="100%">
      <stop offset={SEGMENT_GRADIENT_FADE_START} stopColor={stroke} stopOpacity={0} />
      <stop offset={SEGMENT_GRADIENT_SOLID_START} stopColor={stroke} stopOpacity={1} />
      <stop offset={SEGMENT_GRADIENT_SOLID_END} stopColor={stroke} stopOpacity={1} />
      <stop offset={SEGMENT_GRADIENT_FADE_END} stopColor={stroke} stopOpacity={0} />
    </linearGradient>
  </defs>
);

const renderSegmentBackground = (params: Readonly<SegmentRenderParams>): React.ReactElement => {
  const { component, selection, innerHeight, vis, reducedMotion } = params;
  return (
    <rect
      key={component.key}
      fill={resolveSegmentFill(component.props)}
      x={Math.min(selection.startX, selection.endX)}
      y={0}
      width={Math.abs(selection.endX - selection.startX)}
      height={innerHeight}
      style={resolveSegmentBackgroundStyle(vis, reducedMotion)}
    />
  );
};

interface SegmentEdgeLineParams {
  readonly lineKey: string;
  readonly gradientId: string;
  readonly x: number;
  readonly innerHeight: number;
  readonly style: Readonly<SegmentLineStyle>;
}

const renderSegmentEdgeLine = (params: Readonly<SegmentEdgeLineParams>): React.ReactElement => {
  const { lineKey, gradientId, x, innerHeight, style } = params;
  if (style.variant === "gradient") {
    return (
      <g key={lineKey}>
        {renderSegmentGradientDefs(gradientId, style.stroke)}
        <line stroke={`url(#${gradientId})`} strokeWidth={style.strokeWidth} x1={x} x2={x} y1={0} y2={innerHeight} />
      </g>
    );
  }
  return (
    <line
      key={lineKey}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      strokeDasharray={style.variant === "dashed" ? SEGMENT_LINE_DASH_PATTERN : undefined}
      x1={x}
      x2={x}
      y1={0}
      y2={innerHeight}
    />
  );
};

const renderSegmentComponent = (params: Readonly<SegmentRenderParams>): React.ReactElement | undefined => {
  const { component, selection, vis } = params;
  if (component.type === "segmentBackground") {
    return renderSegmentBackground(params);
  }
  if (component.type === "segmentLineFrom" || component.type === "segmentLineTo") {
    if (!vis) {
      return undefined;
    }
    const isFrom = component.type === "segmentLineFrom";
    return renderSegmentEdgeLine({
      gradientId: `bkm-seg-${isFrom ? "from" : "to"}-${component.key}`,
      innerHeight: params.innerHeight,
      lineKey: component.key,
      style: resolveSegmentLineStyle(component.props),
      x: isFrom ? selection.startX : selection.endX,
    });
  }
  return undefined;
};

const SegmentOverlay = ({
  selection,
  innerWidth,
  innerHeight,
  marginLeft,
  marginTop,
  components,
}: Readonly<{
  selection: Readonly<ChartSelection> | null;
  innerWidth: number;
  innerHeight: number;
  marginLeft: number;
  marginTop: number;
  components: readonly Readonly<SegmentComponent>[];
}>): React.ReactElement | null => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const overlayStyle = React.useMemo((): React.CSSProperties => ({
    left: marginLeft,
    overflow: "visible",
    pointerEvents: "none",
    position: "absolute",
    top: marginTop,
  }), [marginLeft, marginTop]);
  if (!selection || components.length === 0) {return null;}
  const vis = selection.active && Math.abs(selection.endX - selection.startX) > SEGMENT_SELECTION_MIN_WIDTH_PX;
  const shared: Readonly<Omit<SegmentRenderParams, "component">> = {
    innerHeight,
    reducedMotion: prefersReducedMotion,
    selection,
    vis,
  };
  return (
    <svg
      width={innerWidth}
      height={innerHeight}
      style={overlayStyle}
      aria-hidden="true"
    >
      {components.map((component) => renderSegmentComponent({ ...shared, component }))}
    </svg>
  );
};

export { SegmentOverlay };
export type { SegmentLineVariant };
export type { SegmentComponent } from "./chart-selection";
