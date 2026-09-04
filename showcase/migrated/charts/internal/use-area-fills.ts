// Area fills hook: owns the gradient-def and time-extent group.
// Hook call order matches area-chart.tsx lines 972-1020 exactly; logic moved verbatim.
import { useMemo } from "react";
import { useSanitizedId } from "./use-sanitized-id";
import { mergeProjectionXDomainMax } from "./projection-config";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartDatum } from "./types";
import {
  buildAreaGradientDefs,
  buildGradientIdMap,
  buildNativeAreaGradients,
  computeTimeExtentRaw,
} from "./area-chart-model";
import type {
  AreaGradientDef,
  NativeAreaGradient,
  ReadonlyResolvedArea,
  TimeExtentMs,
} from "./area-chart-model";

interface AreaFillsParams {
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly xDataKey: string;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
}

interface AreaFills {
  readonly gradientDefs: AreaGradientDef[];
  readonly gradientIdBySeries: Map<string, string>;
  readonly nativeAreaGradients: NativeAreaGradient[];
  readonly timeExtent: TimeExtentMs | undefined;
  readonly timeExtentRaw: TimeExtentMs | undefined;
}

const useAreaFills = (params: Readonly<AreaFillsParams>): AreaFills => {
  // Gradient stops carry fillOpacity (never double-applied); span clamps to [0.01, 1].
  const gradientBaseId = useSanitizedId();
  const gradientDefs = useMemo(
    () => buildAreaGradientDefs(params.resolvedAreas, gradientBaseId),
    [gradientBaseId, params.resolvedAreas],
  );
  const nativeAreaGradients = useMemo(
    () => buildNativeAreaGradients(gradientDefs),
    [gradientDefs],
  );
  const gradientIdBySeries = useMemo(() => buildGradientIdMap(gradientDefs), [gradientDefs]);

  const timeExtentRaw = useMemo(
    () => computeTimeExtentRaw(params.renderData, params.xDataKey, params.xDomain),
    [params.renderData, params.xDataKey, params.xDomain],
  );
  // Rendered x-domain extends the data extent by the projection tail; xDomain skips the merge.
  const timeExtent = useMemo(() => {
    if (timeExtentRaw === undefined) {return timeExtentRaw;}
    if (params.xDomain) {return timeExtentRaw;}
    if (params.projectionConfigs.length === 0) {return timeExtentRaw;}
    return { maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, params.projectionConfigs), minTime: timeExtentRaw.minTime } as const;
  }, [timeExtentRaw, params.projectionConfigs, params.xDomain]);

  return {
    gradientDefs,
    gradientIdBySeries,
    nativeAreaGradients,
    timeExtent,
    timeExtentRaw,
  };
};

export { useAreaFills };
export type { AreaFills, AreaFillsParams };
