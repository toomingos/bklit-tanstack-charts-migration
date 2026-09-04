"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import type { PatternPresetId } from './pattern-preset';
import type { ReferenceAreaIfOverflow } from './reference-area-geometry';
import type { ChartMargin } from "./use-chart-margin";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { applyReferenceAreaVisibility, isReferenceAreaVisiblePhase, useReferenceAreaGeometry } from "./reference-area-scale";
import { buildReferenceAreaFigure, resolveReferenceAreaPattern, resolveReferenceAreaStyle } from "./reference-area-figure";

const ReferenceAreaLayer = (props: ReferenceAreaLayerProps): ReactNode => {
  const style = resolveReferenceAreaStyle(props);
  const spatial = useReferenceAreaGeometry(props);
  const patternNode = useMemo(() => resolveReferenceAreaPattern(style, spatial.patternId), [style, spatial.patternId]);
  const visible = isReferenceAreaVisiblePhase(props.phase);
  const prefersReducedMotion = usePrefersReducedMotion();
  const gRef = useRef<SVGGElement | null>(null);
  useLayoutEffect(() => {
    const group = gRef.current;
    if (!group) {return;}
    applyReferenceAreaVisibility(group, { isLoaded: props.isLoaded, prefersReducedMotion, visible });
  }, [visible, props.isLoaded, prefersReducedMotion]);
  return buildReferenceAreaFigure({ figureRef: gRef, patternNode, spatial, style });
}

interface ReferenceAreaLayerProps {
  y1?: number;
  y2?: number;
  x1?: Date | number;
  x2?: Date | number;
  yAxisId?: string | number;
  yDomainsByAxis?: Record<string, [number, number]>;
  fill?: string;
  fillOpacity?: number;
  pattern?: PatternPresetId;
  patternColor?: string;
  patternScale?: number;
  patternStrokeWidth?: number;
  patternRadius?: number;
  patternComplement?: boolean;
  patternFill?: string;
  patternDotFill?: boolean;
  patternTileBackground?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed";
  strokeDasharray?: string;
  fadeEdges?: boolean;
  fadeEdgesLength?: number;
  showMarkers?: boolean;
  markerColor?: string;
  markerSize?: number;
  ifOverflow?: ReferenceAreaIfOverflow;
  className?: string;
  width: number;
  height: number;
  margin: ChartMargin;
  yDomain: [number, number];
  xDomain?: [number, number] | [Date, Date];
  xDataKey?: string;
  isTimeScale?: boolean;
  barScale?: { (value: string): number | undefined; bandwidth: () => number; domain: () => string[] } | null;
  isBarChart?: boolean;
  bandWidth?: number;
  xRangePadding?: number;
  isCandlestickXScale?: boolean;
  phase?: string;
  isLoaded?: boolean;
}

interface ReferenceAreaLayersGeom {
  width: number;
  height: number;
  margin: ChartMargin;
  yDomain: [number, number];
  yDomainsByAxis?: Record<string, [number, number]>;
  xDomain?: [number, number] | [Date, Date];
  xDataKey?: string;
  isTimeScale?: boolean;
  barScale?: { (value: string): number | undefined; bandwidth: () => number; domain: () => string[] } | null;
  isBarChart?: boolean;
  xRangePadding?: number;
  isCandlestickXScale?: boolean;
  phase?: string;
  isLoaded?: boolean;
}

// Collected <ReferenceArea> child props: open-ended keys, owner-typed values.
// Mirrors the element type of extractReferenceAreaProps (see reference-area-config).
// Values stay open: the sole producer (live-line-chart extractLiveLineChildren) collects these
// From children typed as the combined child-props intersection, so any narrower value type would
// Need a type assertion at that push site. no-unsafe-dictionary-type is a documented residual here.
type ReferenceAreaConfig = Record<string, unknown>;

const isStringValue = <Value,>(value: Value): value is Value & string => typeof value === "string";

const isKeyScalar = <Value,>(value: Value): value is Value & (number | boolean | bigint) =>
  typeof value === "number" || typeof value === "boolean" || typeof value === "bigint";

const stringifyReferenceAreaKeyPart = (value: unknown): string => {
  if (isStringValue(value)) {return value;}
  if (isKeyScalar(value)) {return String(value);}
  if (value instanceof Date) {return String(value);}
  if (value === undefined || value === null) {return "";}
  return JSON.stringify(value);
};

// Guards an open-ended config value against the number prop type.
const isNumberValue = <Value,>(value: Value): value is Value & number => typeof value === "number";

// Guards an open-ended config value against the boolean prop type.
const isBooleanValue = <Value,>(value: Value): value is Value & boolean => typeof value === "boolean";

// Guards an open-ended config value against the date prop type.
const isDateValue = <Value,>(value: Value): value is Value & Date => value instanceof Date;

// Guards an open-ended config value against the string-or-number prop type.
const isStringOrNumberValue = <Value,>(value: Value): value is Value & (string | number) =>
  isStringValue(value) || isNumberValue(value);

// Guards an open-ended config value against the date-or-number prop type.
const isDateOrNumberValue = <Value,>(value: Value): value is Value & (Date | number) =>
  isDateValue(value) || isNumberValue(value);

// First four preset ids. Split from the full membership check below.
const isFirstPatternPreset = <Value,>(value: Value): value is Value & PatternPresetId =>
  value === "none" || value === "diagonal" || value === "horizontal" || value === "vertical";

// Last four preset ids. Split from the full membership check below.
const isSecondPatternPreset = <Value,>(value: Value): value is Value & PatternPresetId =>
  value === "cross" || value === "dots" || value === "circles" || value === "accent";

// Guards an open-ended config value against the pattern-preset prop type.
const isPatternPresetValue = <Value,>(value: Value): value is Value & PatternPresetId =>
  isFirstPatternPreset(value) || isSecondPatternPreset(value);

// Guards an open-ended config value against the stroke-style prop type.
const isStrokeStyleValue = <Value,>(value: Value): value is Value & ("solid" | "dashed") =>
  value === "solid" || value === "dashed";

// Guards an open-ended config value against the overflow prop type.
const isIfOverflowValue = <Value,>(value: Value): value is Value & ReferenceAreaIfOverflow =>
  value === "hidden" || value === "visible" || value === "discard";

// Zero configs means no layers to render.
const EMPTY_REFERENCE_AREA_CONFIG_COUNT = 0;

// Narrow converters for open-ended child-props values. One converter serves each prop
// Type so the element factory below holds no branches of its own.

// SAFETY: Each config is the props object of a <ReferenceArea> child element.
// Only elements whose role is "referenceArea" are collected (see extractReferenceAreaProps).
// React types those props as ReferenceAreaProps at the JSX creation site.
// Every field read below is therefore narrowed to its prop type by the guards above.

// Narrows an open-ended config value to the number prop type.
const narrowNumberProp = <Value,>(value: Value): (Value & number) | undefined => {
  if (isNumberValue(value)) {return value;}
  return undefined;
};

// Narrows an open-ended config value to the string prop type.
const narrowStringProp = <Value,>(value: Value): (Value & string) | undefined => {
  if (isStringValue(value)) {return value;}
  return undefined;
};

// Narrows an open-ended config value to the boolean prop type.
const narrowBooleanProp = <Value,>(value: Value): (Value & boolean) | undefined => {
  if (isBooleanValue(value)) {return value;}
  return undefined;
};

// Narrows an open-ended config value to the date-or-number prop type.
const narrowDateOrNumberProp = <Value,>(value: Value): (Value & (Date | number)) | undefined => {
  if (isDateOrNumberValue(value)) {return value;}
  return undefined;
};

// Narrows an open-ended config value to the string-or-number prop type.
const narrowStringOrNumberProp = <Value,>(value: Value): (Value & (string | number)) | undefined => {
  if (isStringOrNumberValue(value)) {return value;}
  return undefined;
};

// Narrows an open-ended config value to the pattern-preset prop type.
const narrowPatternPresetProp = <Value,>(value: Value): (Value & PatternPresetId) | undefined => {
  if (isPatternPresetValue(value)) {return value;}
  return undefined;
};

// Narrows an open-ended config value to the stroke-style prop type.
const narrowStrokeStyleProp = <Value,>(value: Value): (Value & ("solid" | "dashed")) | undefined => {
  if (isStrokeStyleValue(value)) {return value;}
  return undefined;
};

// Narrows an open-ended config value to the overflow prop type.
const narrowIfOverflowProp = <Value,>(value: Value): (Value & ReferenceAreaIfOverflow) | undefined => {
  if (isIfOverflowValue(value)) {return value;}
  return undefined;
};

// Readonly view of the geometry passthrough for the element factory below.
type ReferenceAreaLayersGeomView = Pick<ReferenceAreaLayersGeom, "barScale" | "height" | "isBarChart" | "isCandlestickXScale" | "isLoaded" | "isTimeScale" | "margin" | "phase" | "width" | "xDataKey" | "xDomain" | "xRangePadding" | "yDomain" | "yDomainsByAxis">;

// Builds one reference-area element from an open-ended child-props config.
const buildReferenceAreaLayerElement = (config: Readonly<ReferenceAreaConfig>, geom: Readonly<ReferenceAreaLayersGeomView>): ReactElement => (
  <ReferenceAreaLayer
    key={`ref-${stringifyReferenceAreaKeyPart(config.y1)}-${stringifyReferenceAreaKeyPart(config.y2)}-${stringifyReferenceAreaKeyPart(config.x1)}-${stringifyReferenceAreaKeyPart(config.x2)}-${stringifyReferenceAreaKeyPart(config.yAxisId)}`}
    width={geom.width}
    height={geom.height}
    margin={geom.margin}
    yDomain={geom.yDomain}
    yDomainsByAxis={geom.yDomainsByAxis}
    xDomain={geom.xDomain}
    xDataKey={geom.xDataKey}
    isTimeScale={geom.isTimeScale}
    barScale={geom.barScale}
    isBarChart={geom.isBarChart}
    xRangePadding={geom.xRangePadding}
    isCandlestickXScale={geom.isCandlestickXScale}
    phase={geom.phase}
    isLoaded={geom.isLoaded}
    y1={narrowNumberProp(config.y1)}
    y2={narrowNumberProp(config.y2)}
    x1={narrowDateOrNumberProp(config.x1)}
    x2={narrowDateOrNumberProp(config.x2)}
    yAxisId={narrowStringOrNumberProp(config.yAxisId)}
    fill={narrowStringProp(config.fill)}
    fillOpacity={narrowNumberProp(config.fillOpacity)}
    pattern={narrowPatternPresetProp(config.pattern)}
    patternColor={narrowStringProp(config.patternColor)}
    patternScale={narrowNumberProp(config.patternScale)}
    patternStrokeWidth={narrowNumberProp(config.patternStrokeWidth)}
    patternRadius={narrowNumberProp(config.patternRadius)}
    patternComplement={narrowBooleanProp(config.patternComplement)}
    patternFill={narrowStringProp(config.patternFill)}
    patternDotFill={narrowBooleanProp(config.patternDotFill)}
    patternTileBackground={narrowStringProp(config.patternTileBackground)}
    stroke={narrowStringProp(config.stroke)}
    strokeWidth={narrowNumberProp(config.strokeWidth)}
    strokeStyle={narrowStrokeStyleProp(config.strokeStyle)}
    strokeDasharray={narrowStringProp(config.strokeDasharray)}
    fadeEdges={narrowBooleanProp(config.fadeEdges)}
    fadeEdgesLength={narrowNumberProp(config.fadeEdgesLength)}
    showMarkers={narrowBooleanProp(config.showMarkers)}
    markerColor={narrowStringProp(config.markerColor)}
    markerSize={narrowNumberProp(config.markerSize)}
    ifOverflow={narrowIfOverflowProp(config.ifOverflow)}
    className={narrowStringProp(config.className)}
  />
);

const ReferenceAreaLayers = ({
  configs,
  geom,
}: {
  readonly configs: ReferenceAreaConfig[];
  readonly geom: ReferenceAreaLayersGeom;
}): ReactNode => {
  if (configs.length === EMPTY_REFERENCE_AREA_CONFIG_COUNT) {return undefined;}
  return (
    <>
      {configs.map((config: Readonly<ReferenceAreaConfig>) => buildReferenceAreaLayerElement(config, geom))}
    </>
  );
};

export { ReferenceAreaLayer, ReferenceAreaLayers };
export type { ReferenceAreaLayerProps, ReferenceAreaLayersGeom };
