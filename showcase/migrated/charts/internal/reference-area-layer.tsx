"use client";

import * as React from "react";
import type { PatternPresetId } from './pattern-preset';
import type { ReferenceAreaIfOverflow } from './reference-area-geometry';
import type { ChartMargin } from "./use-chart-margin";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { applyReferenceAreaVisibility, isReferenceAreaVisiblePhase, useReferenceAreaGeometry } from "./reference-area-scale";
import { buildReferenceAreaFigure, resolveReferenceAreaPattern, resolveReferenceAreaStyle } from "./reference-area-figure";

const ReferenceAreaLayer = (props: ReferenceAreaLayerProps): React.ReactNode => {
  const style = resolveReferenceAreaStyle(props);
  const spatial = useReferenceAreaGeometry(props);
  const patternNode = React.useMemo(() => resolveReferenceAreaPattern(style, spatial.patternId), [style.pattern, style.patternColor, style.patternScale, style.patternStrokeWidth, style.patternRadius, style.patternComplement, style.patternFill, style.patternDotFill, style.patternTileBackground, spatial.patternId]);
  const visible = isReferenceAreaVisiblePhase(props.phase);
  const prefersReducedMotion = usePrefersReducedMotion();
  const gRef = React.useRef<SVGGElement | null>(null);
  React.useLayoutEffect(() => {
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

const ReferenceAreaLayers = ({
  configs,
  geom,
}: {
  configs: ReferenceAreaConfig[];
  geom: ReferenceAreaLayersGeom;
}): React.ReactNode => {
  if (configs.length === 0) {return undefined;}
  return (
    <>
      {configs.map((config: Readonly<ReferenceAreaConfig>) => (
        // SAFETY: Each config is the props object of a <ReferenceArea> child element.
        // Only elements whose role is "referenceArea" are collected (see extractReferenceAreaProps).
        // React types those props as ReferenceAreaProps at the JSX creation site.
        // Every field read below therefore already has its asserted type.
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
          y1={config.y1 as number | undefined}
          y2={config.y2 as number | undefined}
          x1={config.x1 as Date | number | undefined}
          x2={config.x2 as Date | number | undefined}
          yAxisId={config.yAxisId as string | number | undefined}
          fill={config.fill as string | undefined}
          fillOpacity={config.fillOpacity as number | undefined}
          pattern={config.pattern as PatternPresetId | undefined}
          patternColor={config.patternColor as string | undefined}
          patternScale={config.patternScale as number | undefined}
          patternStrokeWidth={config.patternStrokeWidth as number | undefined}
          patternRadius={config.patternRadius as number | undefined}
          patternComplement={config.patternComplement as boolean | undefined}
          patternFill={config.patternFill as string | undefined}
          patternDotFill={config.patternDotFill as boolean | undefined}
          patternTileBackground={config.patternTileBackground as string | undefined}
          stroke={config.stroke as string | undefined}
          strokeWidth={config.strokeWidth as number | undefined}
          strokeStyle={config.strokeStyle as "solid" | "dashed" | undefined}
          strokeDasharray={config.strokeDasharray as string | undefined}
          fadeEdges={config.fadeEdges as boolean | undefined}
          fadeEdgesLength={config.fadeEdgesLength as number | undefined}
          showMarkers={config.showMarkers as boolean | undefined}
          markerColor={config.markerColor as string | undefined}
          markerSize={config.markerSize as number | undefined}
          ifOverflow={config.ifOverflow as ReferenceAreaIfOverflow | undefined}
          className={config.className as string | undefined}
        />
      ))}
    </>
  );
};

export { ReferenceAreaLayer, ReferenceAreaLayers };
export type { ReferenceAreaLayerProps, ReferenceAreaLayersGeom };
