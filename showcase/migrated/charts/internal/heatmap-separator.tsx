import { createPortal } from "react-dom";
import { useId, type ReactElement } from "react";
import { useHeatmap } from "./heatmap-context";
import {
  buildHeatmapSeparatorGradientStops,
  getHeatmapSeparatorLineY,
  getHeatmapSeparatorX,
  resolveHeatmapSeparatorStrokeDasharray,
  type HeatmapSeparatorGradient,
  type HeatmapSeparatorGradientStop,
  type HeatmapSeparatorGroup,
  type HeatmapSeparatorGroupBy,
  type HeatmapSeparatorLayout,
  type HeatmapSeparatorStrokeStyle,
} from "./heatmap-utils";

// Shared class for the HTML axis/separator label layers portalled over the chart.
const HEATMAP_AXIS_LAYER_CLASS = "ts-bkm-heatmap-axis-layer";

interface HeatmapSeparatorProps {
  readonly every?: number;
  readonly groupBy?: HeatmapSeparatorGroupBy;
  readonly className?: string;
  readonly spacing?: number;
  readonly paddingX?: number;
  readonly paddingY?: number;
  readonly startOffset?: number;
  readonly labelOffset?: number;
  readonly showLabels?: boolean;
  readonly labelFormat?: (quarter: number, startDate: Readonly<Date>) => string;
  readonly labelClassName?: string;
  readonly strokeStyle?: HeatmapSeparatorStrokeStyle;
  readonly strokeDasharray?: string;
  readonly stroke?: string;
  readonly gradient?: Readonly<HeatmapSeparatorGradient>;
  readonly strokeWidth?: number;
  readonly strokeOpacity?: number;
}

// Default quarter label for heatmap separators (`Q1`-`Q4`).
const defaultHeatmapSeparatorLabelFormat = (quarter: number): string => `Q${quarter}`;

interface SeparatorLabelPortalParams {
  readonly className: string | undefined;
  readonly labelClassName: string | undefined;
  readonly labelFormat: (quarter: number, startDate: Readonly<Date>) => string;
  readonly labelGroups: readonly HeatmapSeparatorGroup[];
  readonly labelTop: number;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly innerWidth: number;
  readonly htmlLayerEl: HTMLDivElement | null;
  readonly showLabels: boolean;
  readonly xScale: (columnIndex: number) => number;
}

const buildSeparatorLabelPortal = ({
  className,
  labelClassName,
  labelFormat,
  labelGroups,
  labelTop,
  marginLeft,
  marginTop,
  innerWidth,
  htmlLayerEl,
  showLabels,
  xScale,
}: Readonly<SeparatorLabelPortalParams>): ReturnType<typeof createPortal> | undefined => {
  if (!showLabels || labelGroups.length === 0 || !htmlLayerEl) {return undefined;}
  return createPortal(
    <div
      className={className ? `${HEATMAP_AXIS_LAYER_CLASS} ${className}` : HEATMAP_AXIS_LAYER_CLASS}
      style={{ height: marginTop, left: marginLeft, pointerEvents: "none", position: "absolute", top: labelTop, width: innerWidth }}
    >
      {labelGroups.map((group) => (
        <span
          key={group.startColumnIndex}
          className={labelClassName ? `ts-bkm-heatmap-separator-label ${labelClassName}` : "ts-bkm-heatmap-separator-label"}
          style={{ left: xScale(group.startColumnIndex), position: "absolute" }}
        >
          {labelFormat(group.quarter, group.startDate)}
        </span>
      ))}
    </div>,
    htmlLayerEl,
  );
};

interface SeparatorGradientDefParams {
  readonly gradientId: string;
  readonly y1: number;
  readonly y2: number;
  readonly gradientStops: readonly Readonly<HeatmapSeparatorGradientStop>[];
}

const renderSeparatorGradientDef = ({
  gradientId,
  y1,
  y2,
  gradientStops,
}: Readonly<SeparatorGradientDefParams>): ReactElement => (
  <defs>
    <linearGradient id={gradientId} x1="0" y1={y1} x2="0" y2={y2} gradientUnits="userSpaceOnUse">
      {gradientStops.map((stop) => (
        <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
      ))}
    </linearGradient>
  </defs>
);

interface SeparatorColumnParams {
  readonly columnIndex: number;
  readonly className: string | undefined;
  readonly paddingX: number;
  readonly y1: number;
  readonly y2: number;
  readonly x: number;
  readonly dasharray: string | undefined;
  readonly gradientId: string;
  readonly gradientStops: readonly Readonly<HeatmapSeparatorGradientStop>[] | undefined;
  readonly stroke: string;
  readonly strokeOpacity: number;
  readonly strokeWidth: number;
}

const renderSeparatorColumn = ({
  columnIndex,
  className,
  paddingX,
  y1,
  y2,
  x,
  dasharray,
  gradientId,
  gradientStops,
  stroke,
  strokeOpacity,
  strokeWidth,
}: Readonly<SeparatorColumnParams>): ReactElement => (
  <g key={columnIndex} className={className} transform={`translate(${x}, 0)`}>
    {paddingX > 0 ? (
      <rect fill="transparent" x={-paddingX} y={y1} width={paddingX * 2} height={y2 - y1} />
    ) : undefined}
    <line
      x1={0}
      x2={0}
      y1={y1}
      y2={y2}
      stroke={gradientStops ? `url(#${gradientId})` : stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dasharray}
      strokeOpacity={gradientStops ? undefined : strokeOpacity}
    />
  </g>
);

interface SeparatorLinesParams {
  readonly atColumns: readonly number[];
  readonly className: string | undefined;
  readonly dasharray: string | undefined;
  readonly gap: number;
  readonly gradientId: string;
  readonly gradientStops: readonly Readonly<HeatmapSeparatorGradientStop>[] | undefined;
  readonly paddingX: number;
  readonly separator: Readonly<HeatmapSeparatorLayout>;
  readonly stroke: string;
  readonly strokeOpacity: number;
  readonly strokeWidth: number;
  readonly xScale: (columnIndex: number) => number;
  readonly y1: number;
  readonly y2: number;
}

const renderSeparatorLines = ({
  atColumns,
  className,
  dasharray,
  gap,
  gradientId,
  gradientStops,
  paddingX,
  separator,
  stroke,
  strokeOpacity,
  strokeWidth,
  xScale,
  y1,
  y2,
}: Readonly<SeparatorLinesParams>): ReactElement => (
  <g className="ts-bkm-heatmap-separators">
    {atColumns.map((columnIndex) => {
      const x = getHeatmapSeparatorX(columnIndex, gap, separator, xScale);
      return renderSeparatorColumn({ className, columnIndex, dasharray, gradientId, gradientStops, paddingX, stroke, strokeOpacity, strokeWidth, x, y1, y2 });
    })}
  </g>
);

const HeatmapSeparator = ({
  className,
  paddingX = 0,
  paddingY = 0,
  startOffset,
  labelOffset = 0,
  showLabels = false,
  labelFormat = defaultHeatmapSeparatorLabelFormat,
  labelClassName,
  strokeStyle = "solid",
  strokeDasharray,
  stroke = "var(--border)",
  gradient,
  strokeWidth = 1,
  strokeOpacity = 1,
}: Readonly<HeatmapSeparatorProps>) => {
  const ctx = useHeatmap();
  const layout = ctx.separatorLayout;
  // Scoped with useId so two heatmap instances on one page don't share one
  // Gradient def (HM7; bklit does the same via useId).
  const gradientId = `heatmap-separator-gradient-${useId().replaceAll(":", "")}`;
  const labelTop = (startOffset ?? ctx.margin.top) + labelOffset;
  const labelPortal = buildSeparatorLabelPortal({
    className,
    htmlLayerEl: ctx.htmlLayerEl,
    innerWidth: ctx.innerWidth,
    labelClassName,
    labelFormat,
    labelGroups: layout?.groups ?? [],
    labelTop,
    marginLeft: ctx.margin.left,
    marginTop: ctx.margin.top,
    showLabels,
    xScale: ctx.xScale,
  });
  if (!layout || layout.atColumns.length === 0) {return labelPortal;}
  const { y1, y2 } = getHeatmapSeparatorLineY({ innerHeight: ctx.innerHeight, marginTop: ctx.margin.top, paddingY, startOffset });
  const dasharray = resolveHeatmapSeparatorStrokeDasharray(strokeStyle, strokeDasharray);
  const gradientStops = gradient ? buildHeatmapSeparatorGradientStops(gradient, strokeOpacity) : undefined;
  return (
    <>
      {gradientStops ? renderSeparatorGradientDef({ gradientId, gradientStops, y1, y2 }) : undefined}
      {renderSeparatorLines({ atColumns: layout.atColumns, className, dasharray, gap: ctx.gap, gradientId, gradientStops, paddingX, separator: layout, stroke, strokeOpacity, strokeWidth, xScale: ctx.xScale, y1, y2 })}
      {labelPortal}
    </>
  );
};

export { HEATMAP_AXIS_LAYER_CLASS, HeatmapSeparator };
export type { HeatmapSeparatorProps };
