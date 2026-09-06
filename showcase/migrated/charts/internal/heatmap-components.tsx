import { Fragment, memo, useCallback, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, NamedExoticComponent, ReactElement, ReactNode } from "react";
import { ChartHost, HOST_INITIAL_WIDTH } from "./chart-host";
import { useSanitizedId } from "./use-sanitized-id";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import { chartMotionRenderer } from "./motion-renderer";
import { HEATMAP_INACTIVE_OPACITY, useHeatmap, useHeatmapCoordinatorOptional } from "./heatmap-context";
import { getHeatmapTooltipConfig, subscribeHeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import type { HeatmapTooltipConfig } from "./heatmap-tooltip-registry";
import { useHeatmapPointerBridge } from "./heatmap-focus-bridge";
import { hasPatternLevelStyles, useHeatmapChartDefinition } from "./heatmap-definition";
import { heatmapLevelPatternId, heatmapLevelPatternRenderOptions, isHeatmapLevelPattern } from "./heatmap-colors";
import type { HeatmapLevelStyle, HeatmapLevelStyles } from "./heatmap-colors";
import { renderPatternPreset } from "./pattern-preset-render";
import { buildCellData } from "./heatmap-cell-data";
import type { CellDatum } from "./heatmap-cell-data";
import { formatHeatmapTooltipDate, formatHeatmapTooltipWeekday, getHeatmapDayLabels, resolveHeatmapDisplayRange } from "./heatmap-utils";
import type { HeatmapYAxisLabelFormat, HeatmapYAxisTickFilter } from "./heatmap-utils";

// Static element styles hoisted so `HeatmapCells` passes stable identities.
const HEATMAP_CELLS_CONTAINER_STYLE = { position: "relative", zIndex: 1 } as const;
const HEATMAP_CELLS_INNER_STYLE = { position: "relative" } as const;
const HEATMAP_RENDERER_STYLE = { overflow: "visible" } as const;

// TanStack bakes margins into rect coordinates while bklit translates a group.
// Each base pattern wraps in a phase-shifting pattern to land the tile grid on phase.
const renderHeatmapCellPatternNodes = ({
  levelStyles,
  patternIdPrefix,
  phaseX,
  phaseY,
}: Readonly<{
  levelStyles: HeatmapLevelStyles;
  patternIdPrefix: string | undefined;
  phaseX: number;
  phaseY: number;
}>): ReactNode => {
  const nodes = levelStyles.flatMap((style: Readonly<HeatmapLevelStyle>, level) => {
    if (!isHeatmapLevelPattern(style) || !style.pattern) {
      return [];
    }
    const id = heatmapLevelPatternId(level);
    const scopedId = patternIdPrefix !== undefined && patternIdPrefix !== "" ? `${patternIdPrefix}-${id}` : id;
    const node = renderPatternPreset(
      style.pattern,
      `${scopedId}-base`,
      heatmapLevelPatternRenderOptions(style),
    );
    if (node === undefined || node === null) {return [];}
    return [
      <Fragment key={scopedId}>
        {node}
        <pattern
          id={scopedId}
          href={`#${scopedId}-base`}
          xlinkHref={`#${scopedId}-base`}
          patternTransform={`translate(${phaseX} ${phaseY})`}
        />
      </Fragment>,
    ];
  });
  return nodes;
};

const renderHeatmapTooltipContent = (datum: Readonly<CellDatum>, config: Readonly<HeatmapTooltipConfig>): ReactElement => (
  <div className="bkm-tooltip-content">
    <div className="ts-bkm-heatmap-tooltip-date">{formatHeatmapTooltipDate(datum.date)}</div>
    <div className="ts-bkm-heatmap-tooltip-weekday">{formatHeatmapTooltipWeekday(datum.date)}</div>
    <div className="ts-bkm-heatmap-tooltip-divider" />
    <div className="ts-bkm-heatmap-tooltip-value">{config.formatLabel(datum.count, datum.date)}</div>
  </div>
);

interface HeatmapCellsTooltip {
  readonly tooltipConfig: HeatmapTooltipConfig | null;
  readonly tooltipPanelStyle: CSSProperties | undefined;
}

const useHeatmapCellsTooltip = (
  coordinator: Parameters<typeof subscribeHeatmapTooltipConfig>[0],
): HeatmapCellsTooltip => {
  const subscribeTooltipConfig = useCallback(
    (listener: () => void) => subscribeHeatmapTooltipConfig(coordinator, listener),
    [coordinator],
  );
  const tooltipConfig = useSyncExternalStore(
    subscribeTooltipConfig,
    () => getHeatmapTooltipConfig(coordinator),
    () => null,
  );
  const tooltipPanelStyle = useMemo(
    () => ({ backgroundColor: tooltipConfig?.backgroundColor, ...tooltipConfig?.panelStyle }),
    [tooltipConfig],
  );
  return { tooltipConfig, tooltipPanelStyle };
};

type HeatmapTooltipBodyFn = (bodyCtx: Readonly<{ points: readonly { readonly datum: Readonly<CellDatum> }[] }>) => ReactElement | undefined;

const useHeatmapCellsTooltipBody = ({
  tooltipConfig,
  tooltipPanelStyle,
}: Readonly<{ tooltipConfig: HeatmapTooltipConfig | null; tooltipPanelStyle: CSSProperties | undefined }>): HeatmapTooltipBodyFn => {
  const renderTooltipBody = useCallback((bodyCtx: Readonly<{ points: readonly { readonly datum: Readonly<CellDatum> }[] }>): ReactElement | undefined => {
    const point = bodyCtx.points.at(0);
    const cfg = tooltipConfig;
    if (point === undefined || !cfg) {return undefined;}
    const { datum } = point;
    return (
      <div
        className={cfg.className ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel"}
        style={tooltipPanelStyle}
      >
        {renderHeatmapTooltipContent(datum, cfg)}
      </div>
    );
  }, [tooltipConfig, tooltipPanelStyle]);
  return renderTooltipBody;
};

interface HeatmapCellsProps {
  readonly cornerRadius?: number;
  readonly colorScale?: (count: number | null | undefined) => string;
  readonly inactiveOpacity?: number;
  readonly inactiveScale?: number;
  readonly activeScale?: number;
  readonly rowOpacity?: number | readonly number[];
  readonly interactive?: boolean;
  readonly hideGhostCells?: boolean;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const RenderHeatmapCells = ({
  cornerRadius = 2,
  colorScale: _colorScaleProp,
  inactiveOpacity = HEATMAP_INACTIVE_OPACITY,
  inactiveScale = 1,
  activeScale = 1,
  rowOpacity,
  interactive = true,
  hideGhostCells = true,
  ariaLabel,
  ariaDescription,
}: Readonly<HeatmapCellsProps>): ReactElement => {
  const ctx = useHeatmap();
  const coordinator = useHeatmapCoordinatorOptional();
  const { tooltipConfig, tooltipPanelStyle } = useHeatmapCellsTooltip(coordinator);
  const dayLabels = useMemo(() => getHeatmapDayLabels(ctx.weekStartDay), [ctx.weekStartDay]);
  const displayRange = useMemo(
    () => (hideGhostCells ? resolveHeatmapDisplayRange(ctx.data) : undefined),
    [ctx.data, hideGhostCells],
  );
  const cellData = useMemo(
    () => buildCellData({ columns: ctx.data, dayLabels, displayRange, hideGhost: hideGhostCells }),
    [ctx.data, dayLabels, displayRange, hideGhostCells],
  );
  // One prefix per mount scopes renderer ids and seam ids alike.
  const idPrefix = useSanitizedId();
  const patternIdPrefix = useMemo(
    () => (hasPatternLevelStyles(ctx.levelStyles) ? `${idPrefix}-hm` : undefined),
    [idPrefix, ctx.levelStyles],
  );
  const bandwidthHint = Math.max(ctx.binWidth, 1);
  const definition = useHeatmapChartDefinition({
    activeScale,
    animateCells: ctx.animateCells,
    animationDuration: ctx.animationDuration,
    bandwidthHint,
    cellData,
    chartStatus: ctx.chartStatus,
    columns: ctx.data,
    cornerRadius,
    enterStaggerScale: ctx.enterStaggerScale,
    enterTransition: ctx.enterTransition,
    inactiveOpacity,
    inactiveScale,
    margin: { bottom: ctx.margin.bottom, left: ctx.margin.left, right: ctx.margin.right, top: ctx.margin.top },
    patternIdPrefix,
    resolvedLevelStyles: ctx.levelStyles,
    revealEpoch: ctx.revealEpoch,
    rowOpacity,
    tooltipEnabled: tooltipConfig !== null,
    weekStartDay: ctx.weekStartDay,
    yLabelFormat: ctx.yLabelFormat ?? "full",
    yRowOpacity: ctx.yRowOpacity,
    yTickFilter: ctx.yTickFilter ?? "odd",
  });
  const { containerRef, handleFocusChange, handleRender } = useHeatmapPointerBridge({
    coordinator,
    ctx,
    interactive,
    tooltipConfig,
  });
  const renderTooltipBody = useHeatmapCellsTooltipBody({ tooltipConfig, tooltipPanelStyle });
  // Seam resources carry the mount prefix; the definition references the scoped ids.
  const patternResources = renderHeatmapCellPatternNodes({
    levelStyles: ctx.levelStyles,
    patternIdPrefix,
    phaseX: ctx.margin.left,
    phaseY: ctx.margin.top,
  });
  const handleRenderWithWidth = useCallback((renderCtx: ChartRendererRenderContext<CellDatum, string, string>): void => {
    handleRender(renderCtx);
    ctx.reportWidth?.(renderCtx.scene.width);
  }, [handleRender, ctx]);
  return (
    <div ref={containerRef} style={HEATMAP_CELLS_CONTAINER_STYLE}>
      <div style={HEATMAP_CELLS_INNER_STYLE}>
        <ChartHost
          renderer={chartMotionRenderer<CellDatum, string, string>()}
          className="ts-bkm-heatmap-svg"
          ariaLabel={ariaLabel ?? ctx.ariaLabel ?? "Heatmap chart"}
          ariaDescription={ariaDescription ?? ctx.ariaDescription}
          definition={definition}
          idPrefix={idPrefix}
          initialWidth={HOST_INITIAL_WIDTH}
          height={ctx.height}
          resources={patternResources}
          style={HEATMAP_RENDERER_STYLE}
          onFocusChange={handleFocusChange}
          onRender={handleRenderWithWidth}
          renderTooltipBody={renderTooltipBody}
        />
      </div>
    </div>
  );
};

const HeatmapCells: NamedExoticComponent<Readonly<HeatmapCellsProps>> = memo(RenderHeatmapCells);

HeatmapCells.displayName = "HeatmapCells";

interface HeatmapXAxisProps {
  readonly className?: string;
}

// Package axes render the month labels from the band scales; this carrier
// Keeps the legacy slot working while rendering nothing itself.
const RenderHeatmapXAxis = (_props: Readonly<HeatmapXAxisProps>): ReactElement | null => null;

const HeatmapXAxis: NamedExoticComponent<Readonly<HeatmapXAxisProps>> = memo(RenderHeatmapXAxis);

HeatmapXAxis.displayName = "HeatmapXAxis";

interface HeatmapYAxisProps {
  readonly className?: string;
  readonly tickFilter?: HeatmapYAxisTickFilter;
  readonly labelFormat?: HeatmapYAxisLabelFormat;
  readonly rowOpacity?: number | readonly number[];
}

// Package y axis renders day labels from `ticks.values`/`ticks.format`; the
// Parent reads these props when building the definition.
const RenderHeatmapYAxis = (_props: Readonly<HeatmapYAxisProps>): ReactElement | null => null;

const HeatmapYAxis: NamedExoticComponent<Readonly<HeatmapYAxisProps>> = memo(RenderHeatmapYAxis);

HeatmapYAxis.displayName = "HeatmapYAxis";

export { HeatmapSeparator } from "./heatmap-separator";
export type { HeatmapSeparatorProps } from "./heatmap-separator";
export { HeatmapTooltip } from "./heatmap-tooltip-registry";
export type { HeatmapTooltipProps } from "./heatmap-tooltip-registry";
export { HeatmapCells, HeatmapXAxis, HeatmapYAxis };
export type { HeatmapCellsProps, HeatmapXAxisProps, HeatmapYAxisProps };
