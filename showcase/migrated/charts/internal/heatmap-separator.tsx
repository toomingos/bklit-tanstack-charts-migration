import { memo, useId, useMemo } from "react";
import type { CSSProperties, NamedExoticComponent, ReactElement } from "react";
import { useHeatmap } from "./heatmap-context";
import {
  buildHeatmapSeparatorGradientStops,
  resolveHeatmapSeparatorStrokeDasharray,
} from "./heatmap-utils";
import type {
  HeatmapSeparatorGradient,
  HeatmapSeparatorGradientStop,
  HeatmapSeparatorGroup,
  HeatmapSeparatorGroupBy,
  HeatmapSeparatorLayout,
  HeatmapSeparatorStrokeStyle,
} from "./heatmap-utils";

// Shared class for the HTML axis/separator label layers (package axes render
// Their own labels; separator quarter labels render as SVG text below).
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

// Gutter offset before a column (derived from layout; no scale object).
const separatorOffsetBefore = (
  column: number,
  separator: Readonly<Pick<HeatmapSeparatorLayout, "spacing" | "atColumns">> | null,
): number => {
  if (!separator || separator.spacing <= 0 || column <= 0) {return 0;}
  let count = 0;
  for (const atColumn of separator.atColumns) {
    if (atColumn <= column) {count += 1;}
  }
  return count * separator.spacing;
};

interface SeparatorLabelPresentation {
  readonly labelGroups: readonly HeatmapSeparatorGroup[];
  readonly labelX: readonly number[];
}

// Quarter-label x positions from the cell grid (no portal; rendered as SVG text).
const useSeparatorLabelPresentation = (
  cellSize: number,
  separator: HeatmapSeparatorLayout | null,
): SeparatorLabelPresentation => useMemo(() => {
  const groups = separator?.groups ?? [];
  return {
    labelGroups: groups,
    labelX: groups.map((group) => group.startColumnIndex * cellSize + separatorOffsetBefore(group.startColumnIndex, separator)),
  };
}, [cellSize, separator]);

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
  // Bare element (no <defs>): the R10 seam owns the one <defs>; this gradient spans
  // The plot in pixel space, so it stays co-located with the separator lines it paints.
  <linearGradient id={gradientId} x1="0" y1={y1} x2="0" y2={y2} gradientUnits="userSpaceOnUse">
    {gradientStops.map((stop) => (
      <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
    ))}
  </linearGradient>
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
  readonly cellSize: number;
  readonly stroke: string;
  readonly strokeOpacity: number;
  readonly strokeWidth: number;
  readonly y1: number;
  readonly y2: number;
}

const separatorLineX = (
  columnIndex: number,
  gap: number,
  separator: Readonly<Pick<HeatmapSeparatorLayout, "spacing" | "atColumns">>,
  cellSize: number,
): number => {
  const base = columnIndex * cellSize + separatorOffsetBefore(columnIndex, separator);
  if (separator.spacing > 0) {return base - separator.spacing / 2;}
  return base - gap / 2;
};

const renderSeparatorLines = ({
  atColumns,
  className,
  dasharray,
  gap,
  gradientId,
  gradientStops,
  paddingX,
  separator,
  cellSize,
  stroke,
  strokeOpacity,
  strokeWidth,
  y1,
  y2,
}: Readonly<SeparatorLinesParams>): ReactElement => (
  <g className="ts-bkm-heatmap-separators">
    {atColumns.map((columnIndex) => {
      const x = separatorLineX(columnIndex, gap, separator, cellSize);
      return renderSeparatorColumn({ className, columnIndex, dasharray, gradientId, gradientStops, paddingX, stroke, strokeOpacity, strokeWidth, x, y1, y2 });
    })}
  </g>
);

const LABEL_TEXT_STYLE: CSSProperties = { fontSize: 12 };
const LABEL_ABOVE_PLOT_DY = -8;

const RenderHeatmapSeparator = ({
  className,
  paddingX = 0,
  paddingY = 0,
  startOffset: _startOffset,
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
}: Readonly<HeatmapSeparatorProps>): ReactElement | null => {
  void _startOffset;
  const ctx = useHeatmap();
  const layout = ctx.separatorLayout;
  // Scoped with useId so two heatmap instances on one page don't share one gradient def.
  const gradientId = `heatmap-separator-gradient-${useId().replaceAll(":", "")}`;
  const cellSize = ctx.binWidth;
  const presentation = useSeparatorLabelPresentation(cellSize, layout);
  const dasharray = resolveHeatmapSeparatorStrokeDasharray(strokeStyle, strokeDasharray);
  const gradientStops = gradient ? buildHeatmapSeparatorGradientStops(gradient, strokeOpacity) : undefined;
  // The surface <g> is already translated to the plot origin, so the span is plot-local.
  const y1 = paddingY;
  const y2 = Math.max(ctx.innerHeight - paddingY, y1);
  if (!layout || layout.atColumns.length === 0) {
    if (!showLabels || presentation.labelGroups.length === 0) {return null;}
    return (
      <g className="ts-bkm-heatmap-separator-labels">
        {presentation.labelGroups.map((group, groupIndex) => (
          <text
            key={group.startColumnIndex}
            className={labelClassName !== undefined && labelClassName !== "" ? `ts-bkm-heatmap-separator-label ${labelClassName}` : "ts-bkm-heatmap-separator-label"}
            x={presentation.labelX[groupIndex]}
            y={LABEL_ABOVE_PLOT_DY + labelOffset}
            style={LABEL_TEXT_STYLE}
          >
            {labelFormat(group.quarter, group.startDate)}
          </text>
        ))}
      </g>
    );
  }
  return (
    <>
      {gradientStops ? renderSeparatorGradientDef({ gradientId, gradientStops, y1, y2 }) : undefined}
      {renderSeparatorLines({ atColumns: layout.atColumns, cellSize, className, dasharray, gap: ctx.gap, gradientId, gradientStops, paddingX, separator: layout, stroke, strokeOpacity, strokeWidth, y1, y2 })}
      {showLabels && presentation.labelGroups.length > 0 ? (
        <g className="ts-bkm-heatmap-separator-labels">
          {presentation.labelGroups.map((group, groupIndex) => (
            <text
              key={group.startColumnIndex}
              className={labelClassName !== undefined && labelClassName !== "" ? `ts-bkm-heatmap-separator-label ${labelClassName}` : "ts-bkm-heatmap-separator-label"}
              x={presentation.labelX[groupIndex]}
              y={LABEL_ABOVE_PLOT_DY + labelOffset}
              style={LABEL_TEXT_STYLE}
            >
              {labelFormat(group.quarter, group.startDate)}
            </text>
          ))}
        </g>
      ) : undefined}
    </>
  );
};

const HeatmapSeparator: NamedExoticComponent<Readonly<HeatmapSeparatorProps>> = memo(RenderHeatmapSeparator);

HeatmapSeparator.displayName = "HeatmapSeparator";

export { HEATMAP_AXIS_LAYER_CLASS, HeatmapSeparator };
export type { HeatmapSeparatorProps };
