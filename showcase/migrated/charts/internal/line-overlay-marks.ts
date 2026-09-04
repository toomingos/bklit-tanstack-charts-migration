import type { ChartMark } from "@tanstack/charts";
import { normalizeProfitLossConfig } from "./profit-loss-config";
import type { ProfitLossLineConfig } from "./profit-loss-config";
import { profitLossLineMarks } from "./profit-loss-line-mark";
import { projectionLineMark } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import { resolveOverlayScales } from "./line-marker-anchors";
import type { OverlayScales, OverlayTimeExtent } from "./line-marker-anchors";
import type { ChartDatum } from "./types";

// ProfitLossLine children always carry dataKey; normalizeProfitLossConfig returns null only when dataKey is missing.
interface ProfitLossSource {
  readonly dataKey: string;
}

interface ProfitLossFrame {
  readonly extentMaxTime: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly rawMinTime: number;
}

interface ProfitLossSectionParams {
  readonly focusedIndex: number | null;
  readonly gradientBaseId: string;
  readonly heightPx: number;
  readonly isLoading: boolean;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly profitLossLines: readonly Readonly<ProfitLossSource>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
  readonly xDataKey: string;
  readonly yDomainFinal: readonly [number, number];
}

const resolveProfitLossFrame = (params: Readonly<ProfitLossSectionParams>): ProfitLossFrame | undefined => {
  if (params.profitLossLines.length === 0 || params.width <= 0 || params.isLoading) {
    return undefined;
  }
  const innerWidth = Math.max(0, params.width - params.marginLeft - params.marginRight);
  const innerHeight = Math.max(0, params.heightPx - params.marginTop - params.marginBottom);
  if (innerWidth <= 0 || innerHeight <= 0) {
    return undefined;
  }
  if (!params.timeExtent || !params.timeExtentRaw) {
    return undefined;
  }
  return { extentMaxTime: params.timeExtent.maxTime, innerHeight, innerWidth, rawMinTime: params.timeExtentRaw.minTime };
};

interface SingleProfitLossParams {
  readonly focusedIndex: number | null;
  readonly frame: Readonly<OverlayScales>;
  readonly gradientBaseId: string;
  readonly itemIndex: number;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

const buildSingleProfitLossMarks = (
  raw: Readonly<ProfitLossSource> | undefined,
  params: Readonly<SingleProfitLossParams>,
): ChartMark<ChartDatum, Date, number>[] => {
  const config: ProfitLossLineConfig | null = normalizeProfitLossConfig(raw === undefined ? undefined : { ...raw });
  if (!config) {
    return [];
  }
  return profitLossLineMarks({
    config,
    data: params.renderData,
    focusedIndex: params.focusedIndex,
    id: `${params.gradientBaseId}-${params.itemIndex}`,
    innerWidth: params.frame.innerWidth,
    translateX: params.marginLeft,
    translateY: params.marginTop,
    xDataKey: params.xDataKey,
    xScale: params.frame.xScale,
    yScale: params.frame.yScale,
  });
};

const buildProfitLossMarks = (params: Readonly<ProfitLossSectionParams>): ChartMark<ChartDatum, Date, number>[] => {
  const frame = resolveProfitLossFrame(params);
  if (!frame) {
    return [];
  }
  const scales = resolveOverlayScales({ extentMaxTime: frame.extentMaxTime, innerHeight: frame.innerHeight, innerWidth: frame.innerWidth, rawMinTime: frame.rawMinTime, yDomainFinal: params.yDomainFinal });
  const out: ChartMark<ChartDatum, Date, number>[] = [];
  for (let index = 0; index < params.profitLossLines.length; index += 1) {
    out.push(...buildSingleProfitLossMarks(params.profitLossLines[index], {
      focusedIndex: params.focusedIndex,
      frame: scales,
      gradientBaseId: params.gradientBaseId,
      itemIndex: index,
      marginLeft: params.marginLeft,
      marginTop: params.marginTop,
      renderData: params.renderData,
      xDataKey: params.xDataKey,
    }));
  }
  return out;
};

interface ProjectionLineSource {
  readonly className?: string;
  readonly curveKind?: "linear" | "bezier";
  readonly endpointRadius?: number;
  readonly gradientEnd?: string;
  readonly gradientStart?: string;
  readonly showEndMarker?: boolean;
  readonly showEndpoints?: boolean;
  readonly stroke?: string;
  readonly strokeDasharray?: string;
  readonly strokeOpacity?: number;
  readonly strokeStyle?: "solid" | "gradient";
  readonly strokeWidth?: number;
}

interface ProjectionFrame {
  readonly extentMaxTime: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly rawMinTime: number;
}

interface ProjectionSectionParams {
  readonly fallbackStroke: string;
  readonly gradientBaseId: string;
  readonly heightPx: number;
  readonly isLoading: boolean;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionDefaultClassName: string;
  readonly projectionDefaultEndpointRadius: number;
  readonly projectionLines: readonly Readonly<ProjectionLineSource>[];
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
  readonly yDomainFinal: readonly [number, number];
}

const resolveProjectionFrame = (params: Readonly<ProjectionSectionParams>): ProjectionFrame | undefined => {
  if (params.projectionConfigs.length === 0 || params.width <= 0) {
    return undefined;
  }
  const innerWidth = Math.max(0, params.width - params.marginLeft - params.marginRight);
  const innerHeight = Math.max(0, params.heightPx - params.marginTop - params.marginBottom);
  if (innerWidth <= 0 || innerHeight <= 0) {
    return undefined;
  }
  if (!params.timeExtent || !params.timeExtentRaw) {
    return undefined;
  }
  return { extentMaxTime: params.timeExtent.maxTime, innerHeight, innerWidth, rawMinTime: params.timeExtentRaw.minTime };
};

interface SingleProjectionParams {
  readonly fallbackStroke: string;
  readonly frame: Readonly<OverlayScales>;
  readonly gradientBaseId: string;
  readonly isLoading: boolean;
  readonly itemIndex: number;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly projectionDefaultClassName: string;
  readonly projectionDefaultEndpointRadius: number;
}

const buildSingleProjectionMark = (
  config: Readonly<ProjectionLineConfig> | undefined,
  properties: Readonly<ProjectionLineSource> | undefined,
  params: Readonly<SingleProjectionParams>,
): ChartMark<ChartDatum, Date, number> | undefined => {
  if (!properties || !config || config.data.length < 2) {
    return undefined;
  }
  const stroke = properties.stroke ?? params.fallbackStroke;
  return projectionLineMark({
    className: properties.className ?? params.projectionDefaultClassName,
    curveKind: properties.curveKind ?? "linear",
    data: config.data,
    endpointRadius: properties.endpointRadius ?? params.projectionDefaultEndpointRadius,
    gradientEnd: properties.gradientEnd ?? "var(--chart-5)",
    gradientId: `${params.gradientBaseId}-proj-${params.itemIndex}`,
    gradientStart: properties.gradientStart ?? stroke,
    id: `projection-line-${params.itemIndex}`,
    innerWidth: params.frame.innerWidth,
    showEndMarker: properties.showEndMarker ?? properties.showEndpoints ?? true,
    stroke,
    strokeDasharray: properties.strokeDasharray ?? "6,4",
    strokeOpacity: properties.strokeOpacity ?? 1,
    strokeStyle: properties.strokeStyle ?? "solid",
    strokeVisible: !params.isLoading,
    strokeWidth: properties.strokeWidth ?? 2,
    translateX: params.marginLeft,
    translateY: params.marginTop,
    xScale: params.frame.xScale,
    yAxisId: config.yAxisId,
    yScale: params.frame.yScale,
  });
};

const buildProjectionLineMarks = (params: Readonly<ProjectionSectionParams>): ChartMark<ChartDatum, Date, number>[] => {
  const frame = resolveProjectionFrame(params);
  if (!frame) {
    return [];
  }
  const scales = resolveOverlayScales({ extentMaxTime: frame.extentMaxTime, innerHeight: frame.innerHeight, innerWidth: frame.innerWidth, rawMinTime: frame.rawMinTime, yDomainFinal: params.yDomainFinal });
  const out: ChartMark<ChartDatum, Date, number>[] = [];
  for (let index = 0; index < params.projectionConfigs.length; index += 1) {
    const mark = buildSingleProjectionMark(params.projectionConfigs[index], params.projectionLines[index], {
      fallbackStroke: params.fallbackStroke,
      frame: scales,
      gradientBaseId: params.gradientBaseId,
      isLoading: params.isLoading,
      itemIndex: index,
      marginLeft: params.marginLeft,
      marginTop: params.marginTop,
      projectionDefaultClassName: params.projectionDefaultClassName,
      projectionDefaultEndpointRadius: params.projectionDefaultEndpointRadius,
    });
    if (mark) {
      out.push(mark);
    }
  }
  return out;
};

export {
  buildProfitLossMarks,
  buildProjectionLineMarks,
};
export type {
  ProfitLossSectionParams,
  ProjectionSectionParams,
};
