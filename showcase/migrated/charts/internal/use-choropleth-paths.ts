import { useCallback, useMemo } from "react";
import { geoPath } from "d3-geo";
import type { GeoPermissibleObjects, GeoProjection } from "d3-geo";

interface UseChoroplethPathsOptions {
  readonly projection: GeoProjection | undefined;
}

interface UseChoroplethPathsState {
  readonly pathGenerator: (feature: GeoPermissibleObjects) => string | undefined;
  readonly rawPathGenerator: (geo: GeoPermissibleObjects) => string | null;
  readonly projectPoint: (coords: [number, number]) => [number, number] | null;
  readonly unprojectPoint: (point: [number, number]) => [number, number] | null;
}

const useChoroplethPaths = (options: Readonly<UseChoroplethPathsOptions>): UseChoroplethPathsState => {
  const { projection } = options;

  const geoPathGenerator = useMemo(
    () => (projection ? geoPath(projection) : undefined),
    [projection],
  );
  const pathGenerator = useCallback(
    (feature: GeoPermissibleObjects) => geoPathGenerator?.(feature) ?? undefined,
    [geoPathGenerator],
  );
  const rawPathGenerator = useCallback(
    (geo: GeoPermissibleObjects) => geoPathGenerator?.(geo) ?? null,
    [geoPathGenerator],
  );
  const projectPoint = useCallback(
    (coords: [number, number]): [number, number] | null => {
      const projected = projection?.(coords);
      return projected && Number.isFinite(projected[0]) && Number.isFinite(projected[1]) ? [projected[0], projected[1]] : null;
    },
    [projection],
  );

  // Anchors arrive already zoomed (projection carries zoom); no forward matrix apply needed.
  const unprojectPoint = useCallback(
    (point: [number, number]): [number, number] | null => {
      const unprojected = projection?.invert?.(point);
      return unprojected && Number.isFinite(unprojected[0]) && Number.isFinite(unprojected[1]) ? [unprojected[0], unprojected[1]] : null;
    },
    [projection],
  );

  return { pathGenerator, projectPoint, rawPathGenerator, unprojectPoint };
};

export { useChoroplethPaths };
export type { UseChoroplethPathsOptions, UseChoroplethPathsState };
