import type { ChartMark } from "@tanstack/charts";
import { normalizeProfitLossConfig } from "./profit-loss-config";
import type { ProfitLossLineConfig } from "./profit-loss-config";
import { profitLossLineMarks } from "./profit-loss-line-mark";
import { projectionLineMark } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import type { OverlayTimeExtent } from "./line-marker-anchors";
import type { ChartDatum } from "./types";

// ProfitLossLine children always carry dataKey; normalizeProfitLossConfig returns null only when dataKey is missing.
interface ProfitLossSource {
  readonly dataKey: string;
}

interface ProfitLossSectionParams {
  readonly focusedIndex: number | null;
  readonly gradientBaseId: string;
  readonly isLoading: boolean;
  readonly profitLossLines: readonly Readonly<ProfitLossSource>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
  readonly xDataKey: string;
}

interface SingleProfitLossParams {
  readonly focusedIndex: number | null;
  readonly gradientBaseId: string;
  readonly itemIndex: number;
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
    xDataKey: params.xDataKey,
  });
};

const buildProfitLossMarks = (params: Readonly<ProfitLossSectionParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (params.profitLossLines.length === 0) {return [];}
  if (params.width <= 0 || params.isLoading) {return [];}
  if (!params.timeExtent || !params.timeExtentRaw) {return [];}
  const out: ChartMark<ChartDatum, Date, number>[] = [];
  for (let index = 0; index < params.profitLossLines.length; index += 1) {
    out.push(...buildSingleProfitLossMarks(params.profitLossLines[index], {
      focusedIndex: params.focusedIndex,
      gradientBaseId: params.gradientBaseId,
      itemIndex: index,
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

interface ProjectionSectionParams {
  readonly fallbackStroke: string;
  readonly gradientBaseId: string;
  readonly isLoading: boolean;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionDefaultClassName: string;
  readonly projectionDefaultEndpointRadius: number;
  readonly projectionLines: readonly Readonly<ProjectionLineSource>[];
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
}

interface SingleProjectionParams {
  readonly fallbackStroke: string;
  readonly gradientBaseId: string;
  readonly isLoading: boolean;
  readonly itemIndex: number;
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
    showEndMarker: properties.showEndMarker ?? properties.showEndpoints ?? true,
    stroke,
    strokeDasharray: properties.strokeDasharray ?? "6,4",
    strokeOpacity: properties.strokeOpacity ?? 1,
    strokeStyle: properties.strokeStyle ?? "solid",
    strokeVisible: !params.isLoading,
    strokeWidth: properties.strokeWidth ?? 2,
    yAxisId: config.yAxisId,
  });
};

const buildProjectionLineMarks = (params: Readonly<ProjectionSectionParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (params.projectionConfigs.length === 0 || params.width <= 0 || !params.timeExtent || !params.timeExtentRaw) {
    return [];
  }
  const out: ChartMark<ChartDatum, Date, number>[] = [];
  for (let index = 0; index < params.projectionConfigs.length; index += 1) {
    const mark = buildSingleProjectionMark(params.projectionConfigs[index], params.projectionLines[index], {
      fallbackStroke: params.fallbackStroke,
      gradientBaseId: params.gradientBaseId,
      isLoading: params.isLoading,
      itemIndex: index,
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
