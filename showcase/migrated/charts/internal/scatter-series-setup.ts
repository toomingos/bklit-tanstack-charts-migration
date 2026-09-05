import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { extractChildren } from "./children-extract";
import { HOST_INITIAL_WIDTH, adoptHostWidth } from "./chart-host";
import { useSanitizedId } from "./use-sanitized-id";
import { isYGradientConfig } from "./scatter-datum-utils";
import type { ResolvedSeries } from "./scatter-marks";
import type { ExtractedChildren } from "./types";
import { CHART_CATEGORY_PALETTE } from "./design-tokens";

// Shared 5-entry categorical palette (not TanStack's native 6-entry theme).
const DEFAULT_SCATTER_COLORS: readonly string[] = CHART_CATEGORY_PALETTE;

// Default dim opacity for non-focused series (bklit inactiveOpacity).
const SCATTER_INACTIVE_OPACITY_DEFAULT = 0.5;
// Default dot radius when the series omits it.
const SCATTER_SERIES_RADIUS_DEFAULT = 5;
// X range padding with no series yet (bklit shell fallback).
const SCATTER_EMPTY_RANGE_PADDING_PX = 12;
// X range padding adds this to the largest series radius.
const SCATTER_RANGE_PADDING_EXTRA_PX = 10;

const DEFAULT_Y_GRADIENT_FROM = "var(--color-red-500)";
const DEFAULT_Y_GRADIENT_TO = "var(--color-emerald-500)";

const resolveScatterSeries = (
  scatters: ExtractedChildren["scatters"],
  gradientBaseId: string,
): ResolvedSeries[] =>
  scatters.map((series, index) => {
    const seriesColor =
      DEFAULT_SCATTER_COLORS[index % DEFAULT_SCATTER_COLORS.length];
    const rawFill = series.fill ?? series.stroke ?? seriesColor;
    const useYGradient = series.yGradient !== undefined && series.yGradient !== false;
    const yGradId = useYGradient ? `${gradientBaseId}-ygrad-${index}` : undefined;
    return {
      animate: series.animate ?? true,
      dataKey: series.dataKey,
      enterBlur: series.enterBlur ?? 2,
      fadeOnHover: series.fadeOnHover ?? true,
      fill: rawFill,
      inactiveBlur: series.inactiveBlur ?? 2,
      inactiveOpacity: series.inactiveOpacity ?? SCATTER_INACTIVE_OPACITY_DEFAULT,
      outlineColor: series.outlineColor,
      outlineWidth: series.outlineWidth ?? 0,
      radius: series.radius ?? SCATTER_SERIES_RADIUS_DEFAULT,
      ringGap: series.ringGap ?? 2,
      showActiveHighlight: series.showActiveHighlight ?? true,
      stroke: series.stroke ?? rawFill,
      strokeWidth: series.strokeWidth ?? 2,
      useYGradient,
      yAxisId: series.yAxisId,
      yGradFrom: isYGradientConfig(series.yGradient) ? series.yGradient.from ?? DEFAULT_Y_GRADIENT_FROM : DEFAULT_Y_GRADIENT_FROM,
      yGradId,
      yGradTo: isYGradientConfig(series.yGradient) ? series.yGradient.to ?? DEFAULT_Y_GRADIENT_TO : DEFAULT_Y_GRADIENT_TO,
    };
  });

interface UseScatterSeriesSetupParams {
  readonly children: ReactNode;
}

interface ScatterSeriesSetup {
  readonly adoptWidth: (sceneWidth: number | undefined) => void;
  readonly background: ExtractedChildren["background"];
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly crosshairGradientId: string;
  readonly grid: ExtractedChildren["grid"];
  readonly resolvedSeries: readonly ResolvedSeries[];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly width: number;
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xRangePadding: number;
}

const useScatterSeriesSetup = ({
  children,
}: Readonly<UseScatterSeriesSetupParams>): ScatterSeriesSetup => {
  const { scatters, grid, xAxis, background, tooltip } = useMemo(
    () => extractChildren(children),
    [children],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const adoptWidth = useCallback((sceneWidth: number | undefined): void => {
    adoptHostWidth(setLiveWidth, sceneWidth);
  }, []);
  const width = liveWidth;

  const gradientBaseId = useSanitizedId();
  const crosshairGradientId = `${gradientBaseId}-crosshair-fade`;

  const resolvedSeries = useMemo<ResolvedSeries[]>(
    () => resolveScatterSeries(scatters, gradientBaseId),
    [scatters, gradientBaseId],
  );

  // XRangePadding is max(radius) + 10, or flat 12px with no series yet (bklit shell).
  const xRangePadding = useMemo(() => {
    if (resolvedSeries.length === 0) {return SCATTER_EMPTY_RANGE_PADDING_PX;}
    return Math.max(...resolvedSeries.map((series) => series.radius)) + SCATTER_RANGE_PADDING_EXTRA_PX;
  }, [resolvedSeries]);

  return {
    adoptWidth,
    background,
    containerRef,
    crosshairGradientId,
    grid,
    resolvedSeries,
    tooltip,
    width,
    xAxis,
    xRangePadding,
  };
};

export { DEFAULT_SCATTER_COLORS, resolveScatterSeries, useScatterSeriesSetup };
export type { ScatterSeriesSetup, UseScatterSeriesSetupParams };
