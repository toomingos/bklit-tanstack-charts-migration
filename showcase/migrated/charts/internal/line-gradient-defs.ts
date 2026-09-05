import { resolveProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionGradientDef, ProjectionGradientInputs } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import { normalizeProfitLossConfig } from "./profit-loss-config";
import type { ProfitLossLineConfig } from "./profit-loss-config";
import { resolveProfitLossGradientDefs } from "./profit-loss-line-mark";
import type { OverlayMappers } from "./line-marker-anchors";

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
  readonly defaultEndpointRadius: number;
  readonly fallbackStroke: string;
  readonly gradientBaseId: string;
  readonly itemIndex: number;
  readonly mappers: Readonly<OverlayMappers>;
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
  const gradientInput: Readonly<ProjectionGradientInputs> = {
    data: config.data,
    endpointRadius: properties.endpointRadius ?? context.defaultEndpointRadius,
    gradientEnd: properties.gradientEnd ?? "var(--chart-5)",
    gradientId: `${context.gradientBaseId}-proj-${context.itemIndex}`,
    gradientStart: properties.gradientStart ?? stroke,
    rightEdge: context.mappers.rightEdge,
    showEndMarker: properties.showEndMarker ?? properties.showEndpoints ?? true,
    strokeStyle: "gradient",
    strokeWidth: properties.strokeWidth ?? 2,
    xMap: context.mappers.xMap,
    yMap: context.mappers.yMap,
  };
  return resolveProjectionGradientDef(gradientInput);
};

interface ProjectionGradientDefsParams {
  readonly defaultEndpointRadius: number;
  readonly fallbackStroke: string;
  readonly gradientBaseId: string;
  readonly mappers: Readonly<OverlayMappers> | undefined;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionLines: readonly Readonly<ProjectionLineGradientSource>[];
}

const buildProjectionGradientDefs = (params: Readonly<ProjectionGradientDefsParams>): ProjectionGradientDef[] => {
  const { mappers } = params;
  if (params.projectionConfigs.length === 0 || mappers === undefined) {
    return [];
  }
  const defs: ProjectionGradientDef[] = [];
  for (let index = 0; index < params.projectionLines.length; index += 1) {
    const def = resolveProjectionGradientEntry(params.projectionLines[index], params.projectionConfigs[index], {
      defaultEndpointRadius: params.defaultEndpointRadius,
      fallbackStroke: params.fallbackStroke,
      gradientBaseId: params.gradientBaseId,
      itemIndex: index,
      mappers,
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
  readonly innerWidth: number;
  readonly profitLossLines: readonly Readonly<ProfitLossGradientSource>[];
}

const buildProfitLossGradientDefs = (params: Readonly<ProfitLossGradientDefsParams>): ReturnType<typeof resolveProfitLossGradientDefs> => {
  if (params.profitLossLines.length === 0 || params.innerWidth <= 0) {
    return [];
  }
  return resolveProfitLossGradientDefs(collectValidProfitLossConfigs(params.profitLossLines), params.innerWidth, params.gradientBaseId);
};

export { buildProfitLossGradientDefs, buildProjectionGradientDefs };
export type { ProfitLossGradientDefsParams, ProjectionGradientDefsParams };
