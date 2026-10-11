import { useCallback, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import type { ChartBounds, ChartPoint } from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { intFmt } from "../kit/format";
import { TooltipBox, TooltipContent } from "../kit/tooltip/tooltip-primitives";
import type { TooltipRow } from "../kit/tooltip/tooltip-primitives";
import type { GeoGeometry, ProjectionHolder } from "./focus";
import { centroidOf } from "./focus";
import { FEATURES_ID } from "./projection";
import type { ChoroplethFeature, ChoroplethTooltipProps } from "./types";

interface ScreenPoint {
  x: number;
  y: number;
}

const TOOLTIP_CLAMP = 60;

const clamp = (value: number, min: number, size: number): number => Math.max(min + TOOLTIP_CLAMP, Math.min(min + size - TOOLTIP_CLAMP, value));

// bklit's tooltip point: the projected geographic centroid (path.centroid skews toward Alaska/Russia), clamped to the unzoomed map so edge
// features keep their tooltip inside it, in base (unzoomed) space; bklit applies the zoom transform to it afterwards.
export const baseTooltipPoint = (holder: Readonly<ProjectionHolder>, feature: ChoroplethFeature): ScreenPoint | undefined => {
  const { chart, projection } = holder;
  const [lon, lat] = centroidOf(feature);
  const base = projection?.([lon, lat]);
  if (!chart || !base || !Number.isFinite(base[0]) || !Number.isFinite(base[1])) {return undefined;}
  return { x: clamp(base[0], chart.x, chart.width), y: clamp(base[1], chart.y, chart.height) };
};

// Hover anchors where bklit does (the zoomed base point). A keyboard stop is any feature with a visible piece, whose centroid can sit
// off screen while zoomed: then the anchor is the centre of the feature's largest visible piece, so the tooltip is next to what is drawn.
export const tooltipAnchor = (holder: Readonly<ProjectionHolder>, geometry: GeoGeometry) =>
  (points: readonly ChartPoint<ChoroplethFeature>[], context: { focus: { source: string }; plot: ChartBounds }): ScreenPoint | undefined => {
    const first = points.at(0);
    if (first === undefined) {return undefined;}
    const { k, x: tx, y: ty } = holder.transform;
    const zoomed = (point: Readonly<ScreenPoint>): ScreenPoint => ({ x: point.x * k + tx, y: point.y * k + ty });
    const base = baseTooltipPoint(holder, first.datum);
    const anchor = base ? zoomed(base) : { x: first.x * k + tx, y: first.y * k + ty };
    if (context.focus.source !== "keyboard") {return anchor;}
    const { plot } = context;
    if (anchor.x >= plot.x && anchor.x <= plot.x + plot.width && anchor.y >= plot.y && anchor.y <= plot.y + plot.height) {return anchor;}
    const piece = geometry.visibleCenter(first.datum);
    return piece ? zoomed({ x: piece[0], y: piece[1] }) : anchor;
  };

interface TooltipCardConfig {
  readonly props: Readonly<ChoroplethTooltipProps>;
  readonly formatValue: (value: number) => string;
  readonly valueLabel: string;
}

const TooltipCard = ({ cfg, feature, index }: { readonly cfg: TooltipCardConfig; readonly feature: ChoroplethFeature; readonly index: number }): ReactElement => {
  const { props } = cfg;
  const { backgroundColor, className, content, getFeatureName, getFeatureValue, panelStyle } = props;
  const name = getFeatureName ? getFeatureName(feature, index) : (feature.properties?.name ?? `Feature ${index}`);
  const value = getFeatureValue?.(feature, index);
  const { formatValue, valueLabel } = cfg;
  const rows = useMemo((): TooltipRow[] => (value === undefined ? [] : [{ color: "var(--chart-1)", label: valueLabel, value: formatValue(value) }]), [value, valueLabel, formatValue]);
  if (content) {
    return <TooltipBox backgroundColor={backgroundColor} className={className} panelStyle={panelStyle}>{content({ feature, index })}</TooltipBox>;
  }
  return (
    <TooltipBox backgroundColor={backgroundColor} className={className} panelStyle={panelStyle}>
      <TooltipContent rows={rows} title={name} />
    </TooltipBox>
  );
};

/** Tooltip body (bklit panel markup inside the native tooltip shell). */
export const useTooltipBody = (tooltipConfig: ChoroplethTooltipProps | undefined): ((ctx: ChartTooltipBodyRenderContext<ChoroplethFeature>) => ReactNode) => {
  const cardConfig = useMemo((): TooltipCardConfig | undefined => tooltipConfig && {
    formatValue: tooltipConfig.formatValue ?? intFmt,
    props: tooltipConfig,
    valueLabel: tooltipConfig.valueLabel ?? "Value",
  }, [tooltipConfig]);
  return useCallback((ctx: ChartTooltipBodyRenderContext<ChoroplethFeature>): ReactNode => {
    const first = ctx.points.at(0);
    if (!cardConfig || first === undefined || first.markId !== FEATURES_ID) {return ctx.defaultBody;}
    return <TooltipCard cfg={cardConfig} feature={first.datum} index={first.datumIndex} />;
  }, [cardConfig]);
};
