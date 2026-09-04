import { resolveProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import { normalizeProfitLossConfig } from "./profit-loss-config";
import type { ProfitLossLineConfig } from "./profit-loss-config";
import { resolveProfitLossGradientDefs } from "./profit-loss-line-mark";
import { resolveOverlayScales } from "./line-marker-anchors";
import type { OverlayScales, OverlayTimeExtent } from "./line-marker-anchors";

interface ProjectionLineGradientSource {
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

interface ProjectionGradientItemContext {
  readonly defaultClassName: string;
  readonly defaultEndpointRadius: number;
  readonly fallbackStroke: string;
  readonly gradientBaseId: string;
  readonly isLoading: boolean;
  readonly itemIndex: number;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly scales: Readonly<OverlayScales>;
}

const resolveProjectionGradientEntry = (
  properties: Readonly<ProjectionLineGradientSource> | undefined,
  config: Readonly<ProjectionLineConfig> | undefined,
  context: Readonly<ProjectionGradientItemContext>,
): ProjectionGradientDef | undefined => {
  if (!properties || !config) {
    return undefined;
  }
  if (config.data.length < 2 || (properties.strokeStyle ?? "solid") !== "gradient") {
    return undefined;
  }
  const stroke = properties.stroke ?? context.fallbackStroke;
  return resolveProjectionGradientDef({
    className: properties.className ?? context.defaultClassName,
    curveKind: properties.curveKind ?? "linear",
    data: config.data,
    endpointRadius: properties.endpointRadius ?? context.defaultEndpointRadius,
    gradientEnd: properties.gradientEnd ?? "var(--chart-5)",
    gradientId: `${context.gradientBaseId}-proj-${context.itemIndex}`,
    gradientStart: properties.gradientStart ?? stroke,
    id: `projection-line-${context.itemIndex}`,
    innerWidth: context.scales.innerWidth,
    showEndMarker: properties.showEndMarker ?? properties.showEndpoints ?? true,
    stroke,
    strokeDasharray: properties.strokeDasharray ?? "6,4",
    strokeOpacity: properties.strokeOpacity ?? 1,
    strokeStyle: "gradient",
    strokeVisible: !context.isLoading,
    strokeWidth: properties.strokeWidth ?? 2,
    translateX: context.marginLeft,
    translateY: context.marginTop,
    xScale: context.scales.xScale,
    yAxisId: config.yAxisId,
    yScale: context.scales.yScale,
  });
};

interface GradientGeometryParams {
  readonly heightPx: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
  readonly yDomainFinal: readonly [number, number];
}

const resolveGradientScales = (params: Readonly<GradientGeometryParams>): OverlayScales | undefined => {
  const innerWidth = Math.max(0, params.width - params.marginLeft - params.marginRight);
  const innerHeight = Math.max(0, params.heightPx - params.marginTop - params.marginBottom);
  if (innerWidth <= 0 || innerHeight <= 0) {
    return undefined;
  }
  if (!params.timeExtent || !params.timeExtentRaw) {
    return undefined;
  }
  return resolveOverlayScales({
    extentMaxTime: params.timeExtent.maxTime,
    innerHeight,
    innerWidth,
    rawMinTime: params.timeExtentRaw.minTime,
    yDomainFinal: params.yDomainFinal,
  });
};

interface ProjectionGradientDefsParams {
  readonly defaultClassName: string;
  readonly defaultEndpointRadius: number;
  readonly fallbackStroke: string;
  readonly gradientBaseId: string;
  readonly heightPx: number;
  readonly isLoading: boolean;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionLines: readonly Readonly<ProjectionLineGradientSource>[];
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
  readonly yDomainFinal: readonly [number, number];
}

const buildProjectionGradientDefs = (params: Readonly<ProjectionGradientDefsParams>): ProjectionGradientDef[] => {
  const scales = params.projectionConfigs.length === 0 || params.width <= 0 ? undefined : resolveGradientScales(params);
  if (!scales) {
    return [];
  }
  const defs: ProjectionGradientDef[] = [];
  for (let index = 0; index < params.projectionLines.length; index += 1) {
    const def = resolveProjectionGradientEntry(params.projectionLines[index], params.projectionConfigs[index], {
      defaultClassName: params.defaultClassName,
      defaultEndpointRadius: params.defaultEndpointRadius,
      fallbackStroke: params.fallbackStroke,
      gradientBaseId: params.gradientBaseId,
      isLoading: params.isLoading,
      itemIndex: index,
      marginLeft: params.marginLeft,
      marginTop: params.marginTop,
      scales,
    });
    if (def) {
      defs.push(def);
    }
  }
  return defs;
};

// ProfitLossLine children always carry dataKey; normalizeProfitLossConfig returns null only when dataKey is missing.
interface ProfitLossGradientSource {
  readonly dataKey: string;
}

const collectValidProfitLossConfigs = (lines: readonly Readonly<ProfitLossGradientSource>[]): ProfitLossLineConfig[] => {
  const valid: ProfitLossLineConfig[] = [];
  for (const raw of lines) {
    const config = normalizeProfitLossConfig({ ...raw });
    if (config) {
      valid.push(config);
    }
  }
  return valid;
};

interface ProfitLossGradientDefsParams {
  readonly gradientBaseId: string;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly profitLossLines: readonly Readonly<ProfitLossGradientSource>[];
  readonly width: number;
}

const buildProfitLossGradientDefs = (params: Readonly<ProfitLossGradientDefsParams>): ReturnType<typeof resolveProfitLossGradientDefs> => {
  if (params.profitLossLines.length === 0 || params.width <= 0) {
    return [];
  }
  const innerWidth = Math.max(0, params.width - params.marginLeft - params.marginRight);
  if (innerWidth <= 0) {
    return [];
  }
  return resolveProfitLossGradientDefs(collectValidProfitLossConfigs(params.profitLossLines), innerWidth, params.gradientBaseId);
};

export { buildProfitLossGradientDefs, buildProjectionGradientDefs };
export type { ProfitLossGradientDefsParams, ProjectionGradientDefsParams };
