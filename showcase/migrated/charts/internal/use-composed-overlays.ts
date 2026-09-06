import { useMemo } from "react";
import { findTimeBounds } from "./composed-data-math";
import type { TimeBounds } from "./composed-data-math";
import { NOTHING } from "./composed-series";
import { mergeProjectionXDomainMax } from "./projection-config";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartDatum } from "./types";

interface UseComposedOverlayAnchorsParams {
  readonly projectionConfigs: ProjectionLineConfig[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

interface UseComposedOverlayAnchorsResult {
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly timeExtentRaw: Readonly<TimeBounds> | undefined;
}

const useComposedOverlayAnchors = (params: Readonly<UseComposedOverlayAnchorsParams>): UseComposedOverlayAnchorsResult => {
  const { projectionConfigs, renderData, xDataKey } = params;
  // All x-domain consumers read the projection-extended extent.
  const timeExtentRaw = useMemo(() => findTimeBounds(renderData, xDataKey), [renderData, xDataKey]);
  const timeExtent = useMemo(() => {
    if (!timeExtentRaw) {return NOTHING;}
    if (projectionConfigs.length === 0) {return timeExtentRaw;}
    return {
      maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, projectionConfigs),
      minTime: timeExtentRaw.minTime,
    } as const;
  }, [timeExtentRaw, projectionConfigs]);

  return { timeExtent, timeExtentRaw };
};

export { useComposedOverlayAnchors };
export type { UseComposedOverlayAnchorsParams, UseComposedOverlayAnchorsResult };
