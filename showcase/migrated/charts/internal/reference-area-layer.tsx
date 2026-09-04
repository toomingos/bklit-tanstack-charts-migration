"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
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

const ReferenceAreaLayers = ({
  configs,
  geom,
}: {
  configs: ReferenceAreaConfig[];
  geom: ReferenceAreaLayersGeom;
}): ReactNode => {
  if (configs.length === 0) {return undefined;}
  return (
    <>
      {configs.map((config: Readonly<ReferenceAreaConfig>) => (
        // SAFETY: Each config is the props object of a <ReferenceArea> child element.
        // Only elements whose role is "referenceArea" are collected (see extractReferenceAreaProps).
        // React types those props as ReferenceAreaProps at the JSX creation site.
        // Every field read below is therefore narrowed to its prop type by the guards above.
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
          y1={isNumberValue(config.y1) ? config.y1 : undefined}
          y2={isNumberValue(config.y2) ? config.y2 : undefined}
          x1={isDateOrNumberValue(config.x1) ? config.x1 : undefined}
          x2={isDateOrNumberValue(config.x2) ? config.x2 : undefined}
          yAxisId={isStringOrNumberValue(config.yAxisId) ? config.yAxisId : undefined}
          fill={isStringValue(config.fill) ? config.fill : undefined}
          fillOpacity={isNumberValue(config.fillOpacity) ? config.fillOpacity : undefined}
          pattern={isPatternPresetValue(config.pattern) ? config.pattern : undefined}
          patternColor={isStringValue(config.patternColor) ? config.patternColor : undefined}
          patternScale={isNumberValue(config.patternScale) ? config.patternScale : undefined}
          patternStrokeWidth={isNumberValue(config.patternStrokeWidth) ? config.patternStrokeWidth : undefined}
          patternRadius={isNumberValue(config.patternRadius) ? config.patternRadius : undefined}
          patternComplement={isBooleanValue(config.patternComplement) ? config.patternComplement : undefined}
          patternFill={isStringValue(config.patternFill) ? config.patternFill : undefined}
          patternDotFill={isBooleanValue(config.patternDotFill) ? config.patternDotFill : undefined}
          patternTileBackground={isStringValue(config.patternTileBackground) ? config.patternTileBackground : undefined}
          stroke={isStringValue(config.stroke) ? config.stroke : undefined}
          strokeWidth={isNumberValue(config.strokeWidth) ? config.strokeWidth : undefined}
          strokeStyle={isStrokeStyleValue(config.strokeStyle) ? config.strokeStyle : undefined}
          strokeDasharray={isStringValue(config.strokeDasharray) ? config.strokeDasharray : undefined}
          fadeEdges={isBooleanValue(config.fadeEdges) ? config.fadeEdges : undefined}
          fadeEdgesLength={isNumberValue(config.fadeEdgesLength) ? config.fadeEdgesLength : undefined}
          showMarkers={isBooleanValue(config.showMarkers) ? config.showMarkers : undefined}
          markerColor={isStringValue(config.markerColor) ? config.markerColor : undefined}
          markerSize={isNumberValue(config.markerSize) ? config.markerSize : undefined}
          ifOverflow={isIfOverflowValue(config.ifOverflow) ? config.ifOverflow : undefined}
          className={isStringValue(config.className) ? config.className : undefined}
        />
      ))}
    </>
  );
};

export { ReferenceAreaLayer, ReferenceAreaLayers };
export type { ReferenceAreaLayerProps, ReferenceAreaLayersGeom };
