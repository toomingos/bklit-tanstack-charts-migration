import {
  createPortal,
} from "react-dom";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Chart } from "@tanstack/react-charts";
import { defineChart, cell } from "@tanstack/charts";
import { scaleBand, scaleOrdinal } from "d3-scale";
import type { ScaleBand, ScaleOrdinal } from "d3-scale";
import { createSpring } from "./spring";
import { useHeatmap, type HeatmapMargin } from "./heatmap-context";
import {
  computeHeatmapEnterFadeDelayMs,
  HEATMAP_DEFAULT_ENTER_EASE,
  resolveHeatmapEnterFadeDurationSec,
} from "./heatmap-animation";
import { onPostPaint, setRevealDeadline } from "./deferred-reveal";
import { useHeatmapCoordinatorOptional } from "./heatmap-interaction";
import {
  HEATMAP_INACTIVE_OPACITY,
  HEATMAP_INACTIVE_TRANSITION_CSS,
  type HeatmapHoverCoordinator,
  type HeatmapTooltipData,
} from "./heatmap-hover-chrome";
import {
  buildHeatmapLegendGradient,
  buildHeatmapSeparatorGradientStops,
  formatHeatmapContributionLabel,
  formatHeatmapMonthShort,
  formatHeatmapTooltipDate,
  formatHeatmapTooltipWeekday,
  formatHeatmapYAxisLabel,
  getHeatmapColumnMonthAnchor,
  getHeatmapContributionLevel,
  getHeatmapDayLabels,
  getHeatmapPlotInnerWidth,
  getHeatmapSeparatorCount,
  getHeatmapSeparatorLineY,
  getHeatmapSeparatorX,
  getHeatmapTimeExtent,
  isHeatmapGhostBin,
  isHeatmapHoverEffectEnabled,
  resolveHeatmapDisplayRange,
  resolveHeatmapHoverStyle,
  resolveHeatmapRowOpacity,
  resolveHeatmapSeparatorStrokeDasharray,
  shouldShowHeatmapYAxisTick,
  type HeatmapBin,
  type HeatmapColumnSeparatorsConfig,
  type HeatmapDisplayRange,
  type HeatmapSeparatorGradient,
  type HeatmapSeparatorGroupBy,
  type HeatmapSeparatorLayout,
  type HeatmapSeparatorStrokeStyle,
  type HeatmapWeekStartDay,
  type HeatmapYAxisLabelFormat,
  type HeatmapYAxisTickFilter,
} from "./heatmap-utils";
import type {
  HeatmapLevelStyle,
  HeatmapLevelStyles,
} from "./heatmap-colors";

interface CellDatum {
  colKey: string;
  rowKey: string;
  column: number;
  row: number;
  count: number;
  level: number;
  date: Date;
  bin: number;
  isGhost: boolean;
}

function buildCellData(
  columns: { bins: HeatmapBin[] }[],
  dayLabels: readonly string[],
  displayRange: HeatmapDisplayRange | null,
  hideGhost: boolean,
): CellDatum[] {
  const data: CellDatum[] = [];
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx];
    if (!col) continue;
    for (let rowIdx = 0; rowIdx < col.bins.length; rowIdx++) {
      const bin = col.bins[rowIdx];
      if (!bin) continue;
      const isGhost = hideGhost && displayRange !== null && isHeatmapGhostBin(bin, displayRange);
      data.push({
        colKey: String(colIdx),
        rowKey: dayLabels[rowIdx] ?? `${rowIdx}`,
        column: colIdx,
        row: rowIdx,
        count: bin.count,
        level: isGhost ? -1 : getHeatmapContributionLevel(bin.count),
        date: bin.date,
        bin: bin.bin,
        isGhost,
      });
    }
  }
  return data;
}

function buildHoverCellGeometry(
  columnIndex: number,
  rowIndex: number,
  ctx: { xScale: (columnIndex: number) => number; yScale: (rowIndex: number) => number; binWidth: number; binHeight: number; gap: number },
) {
  return {
    x: ctx.xScale(columnIndex),
    y: ctx.yScale(rowIndex) + ctx.gap,
    width: Math.max(ctx.binWidth - ctx.gap, 0),
    height: Math.max(ctx.binHeight - ctx.gap, 0),
  };
}

function useHeatmapChartDefinition(
  cellData: CellDatum[],
  columnCount: number,
  dayLabels: readonly string[],
  innerWidth: number,
  innerHeight: number,
  margin: HeatmapMargin,
  cornerRadius: number,
  resolvedLevelStyles: HeatmapLevelStyles,
) {
  const columnKeys = useMemo(
    () => Array.from({ length: Math.max(columnCount, 1) }, (_, i) => String(i)),
    [columnCount],
  );
  const rowKeys = useMemo(() => [...dayLabels], [dayLabels]);

  const colorScale = useMemo<ScaleOrdinal<number, string>>(
    () =>
      scaleOrdinal<number, string>()
        .domain([-1, 0, 1, 2, 3, 4])
        .range([
          "transparent",
          resolvedLevelStyles[0]?.color ?? "currentColor",
          resolvedLevelStyles[1]?.color ?? "currentColor",
          resolvedLevelStyles[2]?.color ?? "currentColor",
          resolvedLevelStyles[3]?.color ?? "currentColor",
          resolvedLevelStyles[4]?.color ?? "currentColor",
        ]),
    [resolvedLevelStyles],
  );

  const xScale = useMemo<ScaleBand<string>>(
    () =>
      scaleBand<string>()
        .domain(columnKeys)
        .range([margin.left, margin.left + innerWidth])
        .paddingInner(0)
        .paddingOuter(0),
    [columnKeys, margin.left, innerWidth],
  );

  const yScale = useMemo<ScaleBand<string>>(
    () =>
      scaleBand<string>()
        .domain(rowKeys)
        .range([margin.top + innerHeight, margin.top])
        .paddingInner(0)
        .paddingOuter(0),
    [rowKeys, margin.top, innerHeight],
  );

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          cell(cellData, {
            x: (d: CellDatum) => d.colKey,
            y: (d: CellDatum) => d.rowKey,
            z: (d: CellDatum) => d.level,
            key: (d: CellDatum) => `${d.column}-${d.row}`,
            inset: 1,
            radius: cornerRadius,
          }),
        ],
        x: { scale: xScale, guide: false },
        y: { scale: yScale, guide: false },
        color: { scale: colorScale },
        margin,
        animate: false,
      }),
    [cellData, xScale, yScale, colorScale, margin, cornerRadius],
  );

  return definition;
}

export interface HeatmapCellsProps {
  cornerRadius?: number;
  colorScale?: (count: number) => string;
  inactiveOpacity?: number;
  inactiveScale?: number;
  activeScale?: number;
  rowOpacity?: number | readonly number[];
  interactive?: boolean;
  hideGhostCells?: boolean;
}

export function HeatmapCells({
  cornerRadius = 2,
  colorScale: _colorScaleProp,
  inactiveOpacity = HEATMAP_INACTIVE_OPACITY,
  inactiveScale = 1,
  activeScale = 1,
  rowOpacity,
  interactive = true,
  hideGhostCells = true,
}: HeatmapCellsProps) {
  void _colorScaleProp;

  const ctx = useHeatmap();
  const coordinator = useHeatmapCoordinatorOptional();

  const dayLabels = useMemo(() => getHeatmapDayLabels(ctx.weekStartDay), [ctx.weekStartDay]);
  const displayRange = useMemo(
    () => (hideGhostCells ? resolveHeatmapDisplayRange(ctx.data) : null),
    [ctx.data, hideGhostCells],
  );

  const cellData = useMemo(
    () => buildCellData(ctx.data, dayLabels, displayRange, hideGhostCells),
    [ctx.data, dayLabels, displayRange, hideGhostCells],
  );

  const definition = useHeatmapChartDefinition(
    cellData,
    ctx.data.length,
    dayLabels,
    ctx.innerWidth,
    ctx.innerHeight,
    { top: ctx.margin.top, right: ctx.margin.right, bottom: ctx.margin.bottom, left: ctx.margin.left },
    cornerRadius,
    ctx.levelStyles,
  );

  const cellsInteractive = useMemo(
    () => interactive && ctx.chartStatus !== "loading",
    [interactive, ctx.chartStatus],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const revealAnimsRef = useRef<Animation[]>([]);
  const seenRevealEpochRef = useRef<number | null>(null);
  const inputsRef = useRef({ ctx, coordinator, cellsInteractive, cellData });
  inputsRef.current = { ctx, coordinator, cellsInteractive, cellData };

  const handleCellEnter = useCallback(
    (column: number, row: number) => {
      const { ctx: c } = inputsRef.current;
      const bin = c.data[column]?.bins[row];
      if (!bin) return;
      coordinator?.setHoveredLegendLevel(null);
      coordinator?.setHoveredCell({ column, row });
      const geo = buildHoverCellGeometry(column, row, c);
      coordinator?.setTooltipData({
        column,
        row,
        count: bin.count,
        date: bin.date,
        x: c.margin.left + geo.x + geo.width / 2,
        y: c.margin.top + geo.y + geo.height / 2,
      });
    },
    [coordinator],
  );

  const handleCellLeave = useCallback(() => {
    coordinator?.setHoveredCell(null);
    coordinator?.setTooltipData(null);
  }, [coordinator]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !cellsInteractive || !coordinator) return;

    const handlePointerMove = (event: PointerEvent) => {
      const { ctx: c, cellData: cd, cellsInteractive: ci } = inputsRef.current;
      if (!ci) return;

      const svg = el.querySelector<SVGSVGElement>(".ts-bkm-heatmap-svg svg, svg.ts-bkm-heatmap-svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const posX = event.clientX - rect.left - c.margin.left;
      const posY = event.clientY - rect.top - c.margin.top;

      let foundCol = -1;
      for (let i = 0; i < c.data.length; i++) {
        const colX = c.xScale(i);
        if (posX >= colX && posX < colX + c.binWidth) {
          foundCol = i;
          break;
        }
      }
      const foundRow = Math.floor(posY / c.binHeight);

      if (foundCol < 0 || foundRow < 0 || foundRow >= (c.data[0]?.bins.length ?? 7)) {
        handleCellLeave();
        return;
      }

      const d = cd.find((d2) => d2.column === foundCol && d2.row === foundRow);
      if (!d || d.isGhost) {
        handleCellLeave();
        return;
      }

      const bin = c.data[foundCol]?.bins[foundRow];
      if (!bin) {
        handleCellLeave();
        return;
      }

      coordinator.setHoveredLegendLevel(null);
      coordinator.setHoveredCell({ column: foundCol, row: foundRow });
      const geo = buildHoverCellGeometry(foundCol, foundRow, c);
      coordinator.setTooltipData({
        column: foundCol,
        row: foundRow,
        count: bin.count,
        date: bin.date,
        x: c.margin.left + geo.x + geo.width / 2,
        y: c.margin.top + geo.y + geo.height / 2,
      });
    };

    const handlePointerLeave = () => {
      handleCellLeave();
    };

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [cellsInteractive, coordinator, handleCellEnter, handleCellLeave]);

  const hoveredCell = useSyncExternalStore(
    coordinator ? coordinator.subscribe : () => () => {},
    () => coordinator?.getHoveredCell() ?? null,
    () => null,
  );
  const hasHover = hoveredCell !== null && ctx.chartPhase === "ready";
  const hoverDimOpacity = useMemo(
    () => (inactiveOpacity < 1 ? 1 - inactiveOpacity : 0),
    [inactiveOpacity],
  );

  const revealInputsRef = useRef({
    animateCells: ctx.animateCells,
    revealEpoch: ctx.revealEpoch,
    enterTransition: ctx.enterTransition,
    animationDuration: ctx.animationDuration,
    enterStaggerScale: ctx.enterStaggerScale,
    cellData,
  });
  revealInputsRef.current = {
    animateCells: ctx.animateCells,
    revealEpoch: ctx.revealEpoch,
    enterTransition: ctx.enterTransition,
    animationDuration: ctx.animationDuration,
    enterStaggerScale: ctx.enterStaggerScale,
    cellData,
  };

  const handleRender = useCallback(
    ({ container }: { container: HTMLElement }) => {
      const { animateCells, revealEpoch, enterTransition, animationDuration, enterStaggerScale, cellData: cd } =
        revealInputsRef.current;
      const epochAtCall = revealEpoch;
      if (!animateCells) return;
      if (animationDuration <= 0) return;
      if (seenRevealEpochRef.current === epochAtCall) return;
      if (container.querySelector<HTMLElement>(".ts-chart__marks")?.dataset.bkmRevealed === "1") return;
      seenRevealEpochRef.current = epochAtCall;
      for (const a of revealAnimsRef.current) {
        try {
          a.cancel();
        } catch {}
      }
      revealAnimsRef.current = [];
      const marksGroup = container.querySelector<HTMLElement>(".ts-chart__marks");
      if (!marksGroup) return;
      marksGroup.dataset.bkmRevealed = "1";
      marksGroup.classList.add("ts-chart__marks--revealing");
      const fadeDurationSec = resolveHeatmapEnterFadeDurationSec(enterTransition, animationDuration);
      const delayByKey = new Map<string, number>();
      let maxDelayMs = 0;
      for (const d of cd) {
        const delayMs = computeHeatmapEnterFadeDelayMs({
          column: d.column,
          row: d.row,
          revealEpoch: epochAtCall,
          animationDurationMs: animationDuration,
          enterStaggerScale,
          fadeDurationSec,
        });
        const key = `${d.column}-${d.row}`;
        delayByKey.set(key, delayMs);
        if (delayMs > maxDelayMs) maxDelayMs = delayMs;
      }
      const animatedKeys = new Set<string>();
      setRevealDeadline(fadeDurationSec * 1000 + maxDelayMs, {
        animationsRef: revealAnimsRef,
        onDeadline: () => {},
      });
      onPostPaint(() => {
        const liveGroup = container.querySelector<HTMLElement>(".ts-chart__marks");
        const liveRects =
          liveGroup?.querySelectorAll<SVGRectElement>("rect[data-ts-key]") ??
          container.querySelectorAll<SVGRectElement>("rect[data-ts-key]");
        const liveByKey = new Map<string, SVGRectElement>();
        for (const r of liveRects) {
          const k = r.getAttribute("data-ts-key") ?? "";
          const key = k.slice(k.lastIndexOf(":") + 1);
          if (key && !liveByKey.has(key)) liveByKey.set(key, r);
        }
        const easing =
          enterTransition?.ease
            ? `cubic-bezier(${enterTransition.ease.join(",")})`
            : `cubic-bezier(${HEATMAP_DEFAULT_ENTER_EASE.join(",")})`;
        const durMs = fadeDurationSec * 1000;
        for (const d of cd) {
          const key = `${d.column}-${d.row}`;
          if (animatedKeys.has(key)) continue;
          const rect = liveByKey.get(key);
          if (!rect) continue;
          if (rect.getAnimations().length > 0) continue;
          const delayMs = delayByKey.get(key) ?? 0;
          animatedKeys.add(key);
          const anim = rect.animate([{ opacity: "0" }, { opacity: "1" }], {
            duration: durMs,
            delay: delayMs,
            easing,
            fill: "backwards",
          });
          revealAnimsRef.current.push(anim);
          anim.onfinish = () => {
            try {
              anim.cancel();
            } catch {}
          };
        }
        if (liveGroup) liveGroup.classList.remove("ts-chart__marks--revealing");
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      for (const a of revealAnimsRef.current) {
        try {
          a.cancel();
        } catch {}
      }
      revealAnimsRef.current = [];
    };
  }, []);

  useLayoutEffect(() => {
    const { animateCells: ac, revealEpoch: re } = revealInputsRef.current;
    if (!ac) return;
    if (seenRevealEpochRef.current === re) return;
    const host = chartHostRef.current;
    if (!host) return;
    const marks = host.querySelector<HTMLElement>(".ts-chart__marks");
    if (!marks || marks.dataset.bkmRevealed === "1") return;
    if (host.querySelectorAll("rect[data-ts-key]").length === 0) return;
    if (host.getAnimations().length > 0) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const liveMarks = host.querySelector<HTMLElement>(".ts-chart__marks");
        if (seenRevealEpochRef.current === revealInputsRef.current.revealEpoch) return;
        if (!liveMarks || liveMarks.dataset.bkmRevealed === "1") return;
        if (host.getAnimations().length > 0) return;
        handleRender({ container: host });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [ctx.animateCells, ctx.revealEpoch, handleRender]);

  return (
    <div ref={containerRef} style={{ position: "relative", zIndex: 1 }}>
      <div ref={chartHostRef} style={{ position: "relative" }}>
        <Chart
          className="ts-bkm-heatmap-svg"
          ariaLabel="Heatmap chart"
          definition={definition}
          width={ctx.width}
          height={ctx.height}
          style={{ overflow: "visible" }}
          onRender={handleRender}
        />
      </div>
      <svg
        width={ctx.width}
        height={ctx.height}
        className="ts-bkm-heatmap-hover-svg"
        style={{ position: "absolute", inset: 0 }}
      >
        <g transform={`translate(${ctx.margin.left}, ${ctx.margin.top})`}>
          {cellData.map((d) => {
            const isDimmed = hasHover && hoveredCell.column === d.column && hoveredCell.row === d.row ? false : !d.isGhost;
            const geo = buildHoverCellGeometry(d.column, d.row, ctx);
            return (
              <rect
                key={`dim-${d.column}-${d.row}`}
                x={geo.x}
                y={geo.y}
                width={geo.width}
                height={geo.height}
                rx={cornerRadius}
                fill="var(--color-background, white)"
                fillOpacity={hasHover && isDimmed ? hoverDimOpacity : 0}
                style={{ transition: `opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}` }}
                pointerEvents="none"
              />
            );
          })}
          {(() => {
            const d = hasHover
              ? cellData.find(
                  (c) => c.column === hoveredCell.column && c.row === hoveredCell.row,
                )
              : undefined;
            const isHighlighted = hasHover && d != null && !d.isGhost;
            const geo = d
              ? buildHoverCellGeometry(d.column, d.row, ctx)
              : { x: 0, y: 0, width: 0, height: 0 };
            return (
              <rect
                key="highlight"
                x={geo.x - 1}
                y={geo.y - 1}
                width={geo.width + 2}
                height={geo.height + 2}
                rx={cornerRadius + 1}
                fill="none"
                stroke="var(--color-foreground, currentColor)"
                strokeWidth={1.5}
                strokeOpacity={isHighlighted ? 0.5 : 0}
                style={{ transition: `stroke-opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}` }}
                pointerEvents="none"
              />
            );
          })()}
        </g>
      </svg>
    </div>
  );
}

export interface HeatmapXAxisProps {
  className?: string;
}

export const HeatmapXAxis = memo(function HeatmapXAxis({ className }: HeatmapXAxisProps) {
  const ctx = useHeatmap();
  if (!ctx.htmlLayerEl) return null;

  let lastMonthKey = "";
  const labels: { columnIndex: number; key: string; text: string }[] = [];
  ctx.data.forEach((column, columnIndex) => {
    const anchor = getHeatmapColumnMonthAnchor(column);
    if (!anchor) return;
    const monthKey = `${anchor.getFullYear()}-${anchor.getMonth()}`;
    if (monthKey === lastMonthKey) return;
    lastMonthKey = monthKey;
    labels.push({ columnIndex, key: monthKey, text: formatHeatmapMonthShort(anchor) });
  });

  return createPortal(
    <div
      className={className ? `ts-bkm-heatmap-axis-layer ${className}` : "ts-bkm-heatmap-axis-layer"}
      style={{ position: "absolute", left: ctx.margin.left, top: 0, width: ctx.innerWidth, height: ctx.margin.top, pointerEvents: "none" }}
    >
      {labels.map((label) => (
        <span
          key={label.key}
          className="ts-bkm-heatmap-axis-label"
          style={{ position: "absolute", left: ctx.xScale(label.columnIndex), top: 0 }}
        >
          {label.text}
        </span>
      ))}
    </div>,
    ctx.htmlLayerEl,
  );
});

export interface HeatmapYAxisProps {
  className?: string;
  tickFilter?: HeatmapYAxisTickFilter;
  labelFormat?: HeatmapYAxisLabelFormat;
  rowOpacity?: number | readonly number[];
}

export const HeatmapYAxis = memo(function HeatmapYAxis({
  className,
  tickFilter = "odd",
  labelFormat = "full",
  rowOpacity,
}: HeatmapYAxisProps) {
  const ctx = useHeatmap();
  const dayLabels = useMemo(() => getHeatmapDayLabels(ctx.weekStartDay), [ctx.weekStartDay]);
  if (!ctx.htmlLayerEl) return null;

  return createPortal(
    <div
      className={className ? `ts-bkm-heatmap-axis-layer ${className}` : "ts-bkm-heatmap-axis-layer"}
      style={{ position: "absolute", left: 0, top: ctx.margin.top, width: ctx.margin.left, height: ctx.innerHeight, pointerEvents: "none" }}
    >
      {dayLabels.map((label, row) =>
        shouldShowHeatmapYAxisTick(row, tickFilter) ? (
          <span
            key={label}
            className="ts-bkm-heatmap-axis-label ts-bkm-heatmap-axis-label--y"
            style={{
              position: "absolute",
              top: ctx.yScale(row) + ctx.binHeight / 2,
              right: 4,
              opacity: resolveHeatmapRowOpacity(row, rowOpacity),
            }}
          >
            {formatHeatmapYAxisLabel(label, labelFormat)}
          </span>
        ) : null,
      )}
    </div>,
    ctx.htmlLayerEl,
  );
});

const HEATMAP_TOOLTIP_DEFAULT_OFFSET = 16;

function useDelayedHeatmapTooltipData(
  data: HeatmapTooltipData | null,
  showDelayMs: number,
  hideDelayMs: number,
): HeatmapTooltipData | null {
  const [delayed, setDelayed] = useState<HeatmapTooltipData | null>(null);
  const isShowingRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    if (data) {
      clearTimers();
      if (isShowingRef.current) {
        setDelayed(data);
        return;
      }
      if (showDelayMs <= 0) {
        isShowingRef.current = true;
        setDelayed(data);
      } else {
        showTimerRef.current = setTimeout(() => {
          isShowingRef.current = true;
          setDelayed(data);
        }, showDelayMs);
      }
      return;
    }

    clearTimers();
    if (hideDelayMs <= 0) {
      isShowingRef.current = false;
      setDelayed(null);
    } else {
      hideTimerRef.current = setTimeout(() => {
        isShowingRef.current = false;
        setDelayed(null);
      }, hideDelayMs);
    }
  }, [data, showDelayMs, hideDelayMs]);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return delayed;
}

function HeatmapTooltipSpringPanel({
  children,
  isFlipped,
  className,
  panelStyle,
  backgroundColor,
}: {
  children: ReactNode;
  isFlipped: boolean;
  className?: string;
  panelStyle?: CSSProperties;
  backgroundColor?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const startX = isFlipped ? 20 : -20;
    el.style.opacity = "0";
    el.style.transform = `scale(0.85) translateX(${startX}px)`;
    const spring = createSpring(0, 300, 25, (value) => {
      const opacity = value;
      const scale = 0.85 + 0.15 * value;
      const translateX = startX * (1 - value);
      el.style.opacity = String(opacity);
      el.style.transform = `scale(${scale}) translateX(${translateX}px)`;
    });
    spring.set(1);
    return () => spring.stop();
  }, [isFlipped]);

  return (
    <div
      ref={panelRef}
      className={className ? `bkm-tooltip-panel ${className}` : "bkm-tooltip-panel"}
      style={{
        transformOrigin: isFlipped ? "right top" : "left top",
        backgroundColor,
        ...panelStyle,
      }}
    >
      {children}
    </div>
  );
}

interface HeatmapTooltipPanelProps {
  data: HeatmapTooltipData;
  containerWidth: number;
  containerHeight: number;
  offset?: number;
  formatLabel: (count: number, date: Date) => string;
  className?: string;
  panelStyle?: CSSProperties;
  backgroundColor?: string;
}

function HeatmapTooltipPanel({
  data,
  containerWidth,
  containerHeight,
  offset = HEATMAP_TOOLTIP_DEFAULT_OFFSET,
  formatLabel,
  className,
  panelStyle,
  backgroundColor,
}: HeatmapTooltipPanelProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(180);
  const heightRef = useRef(80);
  const [position, setPosition] = useState(() => {
    const shouldFlipX = data.x + widthRef.current + offset > containerWidth;
    const left = shouldFlipX ? data.x - offset - widthRef.current : data.x + offset;
    const top = Math.max(offset, Math.min(data.y - heightRef.current / 2, containerHeight - heightRef.current - offset));
    return { left, top, isFlipped: shouldFlipX };
  });
  const [flipKey, setFlipKey] = useState(0);
  const prevFlipRef = useRef(position.isFlipped);

  useLayoutEffect(() => {
    const el = layerRef.current;
    if (el) {
      widthRef.current = el.offsetWidth || widthRef.current;
      heightRef.current = el.offsetHeight || heightRef.current;
    }
    const tw = widthRef.current;
    const th = heightRef.current;
    const shouldFlipX = data.x + tw + offset > containerWidth;
    const left = shouldFlipX ? data.x - offset - tw : data.x + offset;
    const top = Math.max(offset, Math.min(data.y - th / 2, containerHeight - th - offset));
    setPosition({ left, top, isFlipped: shouldFlipX });
    if (prevFlipRef.current !== shouldFlipX) {
      prevFlipRef.current = shouldFlipX;
      setFlipKey((k) => k + 1);
    }
  }, [data.x, data.y, containerWidth, containerHeight, offset]);

  return (
    <div
      ref={layerRef}
      className="bkm-tooltip-layer"
      style={{ left: position.left, top: position.top, pointerEvents: "none" }}
    >
      <HeatmapTooltipSpringPanel
        key={flipKey}
        isFlipped={position.isFlipped}
        className={className}
        panelStyle={panelStyle}
        backgroundColor={backgroundColor}
      >
        <div className="bkm-tooltip-content">
          <div className="ts-bkm-heatmap-tooltip-date">{formatHeatmapTooltipDate(data.date)}</div>
          <div className="ts-bkm-heatmap-tooltip-weekday">{formatHeatmapTooltipWeekday(data.date)}</div>
          <div className="ts-bkm-heatmap-tooltip-divider" />
          <div className="ts-bkm-heatmap-tooltip-value">{formatLabel(data.count, data.date)}</div>
        </div>
      </HeatmapTooltipSpringPanel>
    </div>
  );
}

export interface HeatmapTooltipProps {
  formatLabel?: (count: number, date: Date) => string;
  className?: string;
  panelStyle?: CSSProperties;
  backgroundColor?: string;
  instant?: boolean;
  showDelay?: number;
  hideDelay?: number;
}

export function HeatmapTooltip({
  formatLabel = formatHeatmapContributionLabel,
  className = "",
  panelStyle,
  backgroundColor,
  instant = false,
  showDelay = 0,
  hideDelay = 120,
}: HeatmapTooltipProps) {
  const ctx = useHeatmap();
  const coordinator = useHeatmapCoordinatorOptional();
  const tooltipData = useSyncExternalStore(
    coordinator ? coordinator.subscribe : () => () => {},
    () => coordinator?.getTooltipData() ?? null,
    () => null,
  );
  const delayed = useDelayedHeatmapTooltipData(tooltipData, showDelay, hideDelay);

  if (!ctx.htmlLayerEl || !delayed) return null;

  if (instant) {
    return createPortal(
      <div
        className="bkm-tooltip-layer"
        style={{
          left: Math.max(HEATMAP_TOOLTIP_DEFAULT_OFFSET, Math.min(delayed.x, ctx.width - 180)),
          top: Math.max(HEATMAP_TOOLTIP_DEFAULT_OFFSET, Math.min(delayed.y, ctx.height - 80)),
          pointerEvents: "none",
        }}
      >
        <div
          className={className ? `bkm-tooltip-panel ${className}` : "bkm-tooltip-panel"}
          style={{ backgroundColor, ...panelStyle }}
        >
          <div className="bkm-tooltip-content">
            <div className="ts-bkm-heatmap-tooltip-date">{formatHeatmapTooltipDate(delayed.date)}</div>
            <div className="ts-bkm-heatmap-tooltip-weekday">{formatHeatmapTooltipWeekday(delayed.date)}</div>
            <div className="ts-bkm-heatmap-tooltip-divider" />
            <div className="ts-bkm-heatmap-tooltip-value">{formatLabel(delayed.count, delayed.date)}</div>
          </div>
        </div>
      </div>,
      ctx.htmlLayerEl,
    );
  }

  return createPortal(
    <HeatmapTooltipPanel
      data={delayed}
      containerWidth={ctx.width}
      containerHeight={ctx.height}
      formatLabel={formatLabel}
      className={className}
      panelStyle={panelStyle}
      backgroundColor={backgroundColor}
    />,
    ctx.htmlLayerEl,
  );
}

export interface HeatmapSeparatorProps {
  every?: number;
  groupBy?: HeatmapSeparatorGroupBy;
  className?: string;
  spacing?: number;
  paddingX?: number;
  paddingY?: number;
  startOffset?: number;
  labelOffset?: number;
  showLabels?: boolean;
  labelFormat?: (quarter: number, startDate: Date) => string;
  labelClassName?: string;
  strokeStyle?: HeatmapSeparatorStrokeStyle;
  strokeDasharray?: string;
  stroke?: string;
  gradient?: HeatmapSeparatorGradient;
  strokeWidth?: number;
  strokeOpacity?: number;
}

export function HeatmapSeparator({
  className,
  paddingX = 0,
  paddingY = 0,
  startOffset,
  labelOffset = 0,
  showLabels = false,
  labelFormat = (quarter: number) => `Q${quarter}`,
  labelClassName,
  strokeStyle = "solid",
  strokeDasharray,
  stroke = "var(--chart-grid-line, currentColor)",
  gradient,
  strokeWidth = 1,
  strokeOpacity = 1,
}: HeatmapSeparatorProps) {
  const ctx = useHeatmap();
  const layout = ctx.separatorLayout;

  const gradientId = "heatmap-separator-gradient";
  const separatorTop = startOffset ?? ctx.margin.top;
  const labelTop = separatorTop + labelOffset;
  const labelPortal =
    showLabels && layout && layout.groups.length > 0 && ctx.htmlLayerEl
      ? createPortal(
          <div
            className={className ? `ts-bkm-heatmap-axis-layer ${className}` : "ts-bkm-heatmap-axis-layer"}
            style={{ position: "absolute", left: ctx.margin.left, top: labelTop, width: ctx.innerWidth, height: ctx.margin.top, pointerEvents: "none" }}
          >
            {layout.groups.map((group) => (
              <span
                key={group.startColumnIndex}
                className={labelClassName ? `ts-bkm-heatmap-separator-label ${labelClassName}` : "ts-bkm-heatmap-separator-label"}
                style={{ position: "absolute", left: ctx.xScale(group.startColumnIndex) }}
              >
                {labelFormat(group.quarter, group.startDate)}
              </span>
            ))}
          </div>,
          ctx.htmlLayerEl,
        )
      : null;

  if (!layout || layout.atColumns.length === 0) return labelPortal;

  const { y1, y2 } = getHeatmapSeparatorLineY({ innerHeight: ctx.innerHeight, marginTop: ctx.margin.top, startOffset, paddingY });
  const dasharray = resolveHeatmapSeparatorStrokeDasharray(strokeStyle, strokeDasharray);
  const gradientStops = gradient ? buildHeatmapSeparatorGradientStops(gradient, strokeOpacity) : null;

  return (
    <>
      {gradientStops ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1={y1} x2="0" y2={y2} gradientUnits="userSpaceOnUse">
            {gradientStops.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      <g className="ts-bkm-heatmap-separators">
        {layout.atColumns.map((columnIndex) => {
          const x = getHeatmapSeparatorX(columnIndex, ctx.gap, layout, ctx.xScale);
          return (
            <g key={columnIndex} className={className} transform={`translate(${x}, 0)`}>
              {paddingX > 0 ? (
                <rect fill="transparent" x={-paddingX} y={y1} width={paddingX * 2} height={y2 - y1} />
              ) : null}
              <line
                x1={0}
                x2={0}
                y1={y1}
                y2={y2}
                stroke={gradientStops ? `url(#${gradientId})` : stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dasharray}
                strokeOpacity={gradient ? undefined : strokeOpacity}
              />
            </g>
          );
        })}
      </g>
      {labelPortal}
    </>
  );
}
