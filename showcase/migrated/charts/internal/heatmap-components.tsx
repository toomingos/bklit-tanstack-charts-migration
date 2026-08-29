import {
  createPortal,
} from "react-dom";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { Chart } from "@tanstack/react-charts/tooltip";
import { defineChart, cell } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import type {
  ChartPoint,
  ChartRenderContext,
} from "@tanstack/charts";
import { scaleBand, scaleOrdinal } from "d3-scale";
import type { ScaleBand, ScaleOrdinal } from "d3-scale";
import { useHeatmap, type HeatmapMargin } from "./heatmap-context";
import {
  computeHeatmapEnterFadeDelayMs,
  HEATMAP_DEFAULT_ENTER_EASE,
  resolveHeatmapEnterFadeDurationSec,
} from "./heatmap-animation";
import { isRevealed, runDeferredReveal, type RevealHandle } from "./deferred-reveal";
import { useHeatmapCoordinatorOptional } from "./heatmap-interaction";
import {
  HEATMAP_INACTIVE_OPACITY,
  HEATMAP_INACTIVE_TRANSITION_CSS,
  type HeatmapHoverCoordinator,
} from "./heatmap-hover-chrome";
import {
  buildHeatmapSeparatorGradientStops,
  formatHeatmapContributionLabel,
  formatHeatmapMonthShort,
  formatHeatmapTooltipDate,
  formatHeatmapTooltipWeekday,
  formatHeatmapYAxisLabel,
  getHeatmapColumnMonthAnchor,
  getHeatmapContributionLevel,
  getHeatmapDayLabels,
  getHeatmapSeparatorLineY,
  getHeatmapSeparatorX,
  isHeatmapGhostBin,
  isHeatmapHoverEffectEnabled,
  resolveHeatmapDisplayRange,
  resolveHeatmapHoverStyle,
  resolveHeatmapRowOpacity,
  resolveHeatmapSeparatorStrokeDasharray,
  shouldShowHeatmapYAxisTick,
  type HeatmapBin,
  type HeatmapDisplayRange,
  type HeatmapSeparatorGradient,
  type HeatmapSeparatorGroupBy,
  type HeatmapSeparatorStrokeStyle,
  type HeatmapYAxisLabelFormat,
  type HeatmapYAxisTickFilter,
} from "./heatmap-utils";
import {
  heatmapLevelPatternId,
  heatmapLevelPatternRenderOptions,
  heatmapLevelCellFillOpacity,
  isHeatmapLevelPattern,
  type HeatmapLevelStyles,
} from "./heatmap-colors";
import { renderPatternPreset } from "./pattern-preset";

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

// bklit `positionBox`/`HeatmapTooltipPanel` parity: 16px stand-off between
// the hovered cell and the tooltip edge, shared by the native tooltip's
// `offset` option (below) and by legacy-offset call sites elsewhere.
const HEATMAP_TOOLTIP_DEFAULT_OFFSET = 16;

// Module-scoped pub/sub bridging `HeatmapTooltip` (config-carrier sibling,
// renders null) to `HeatmapCells` (owns the `<Chart>` definition). The two
// are React siblings under an ancestor (`HeatmapInteractionProvider`) that
// is out of scope to edit, so they can't share config via props/context —
// instead both already receive the same stable `HeatmapHoverCoordinator`
// object from that ancestor, and this WeakMap keyed on that identity
// carries the tooltip config across without touching the provider.
interface HeatmapTooltipConfig {
  formatLabel: (count: number, date: Date) => string;
  className: string;
  panelStyle?: CSSProperties;
  backgroundColor?: string;
  showDelayMs: number;
  hideDelayMs: number;
}

const heatmapTooltipConfigs = new WeakMap<HeatmapHoverCoordinator, HeatmapTooltipConfig>();
const heatmapTooltipListeners = new WeakMap<HeatmapHoverCoordinator, Set<() => void>>();

function getHeatmapTooltipListenerSet(coordinator: HeatmapHoverCoordinator): Set<() => void> {
  let listeners = heatmapTooltipListeners.get(coordinator);
  if (!listeners) {
    listeners = new Set();
    heatmapTooltipListeners.set(coordinator, listeners);
  }
  return listeners;
}

function setHeatmapTooltipConfig(coordinator: HeatmapHoverCoordinator, config: HeatmapTooltipConfig | null) {
  if (config) heatmapTooltipConfigs.set(coordinator, config);
  else heatmapTooltipConfigs.delete(coordinator);
  for (const listener of getHeatmapTooltipListenerSet(coordinator)) listener();
}

function subscribeHeatmapTooltipConfig(coordinator: HeatmapHoverCoordinator | null, listener: () => void): () => void {
  if (!coordinator) return () => {};
  const listeners = getHeatmapTooltipListenerSet(coordinator);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getHeatmapTooltipConfig(coordinator: HeatmapHoverCoordinator | null): HeatmapTooltipConfig | null {
  if (!coordinator) return null;
  return heatmapTooltipConfigs.get(coordinator) ?? null;
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
  patternIdPrefix: string | null,
  tooltipEnabled: boolean,
) {
  const columnKeys = useMemo(
    () => Array.from({ length: Math.max(columnCount, 1) }, (_, i) => String(i)),
    [columnCount],
  );
  const rowKeys = useMemo(() => [...dayLabels], [dayLabels]);

  const colorScale = useMemo<ScaleOrdinal<number, string>>(() => {
    // bklit parity (buildHeatmapFillScale): pattern-mode levels fill with
    // `url(#<prefix>heatmap-level-N)`; the matching <pattern> defs are
    // mounted in HeatmapCells' overlay svg under the same prefix (useId-
    // scoped, so two chart instances don't collide — HM14/HM7 lesson).
    const rangeEntry = (level: number) => {
      const style = resolvedLevelStyles[level];
      if (!style || !isHeatmapLevelPattern(style)) return style?.color ?? "currentColor";
      const id = heatmapLevelPatternId(level);
      return `url(#${patternIdPrefix ? `${patternIdPrefix}-${id}` : id})`;
    };
    return (
      scaleOrdinal<number, string>()
        .domain([-1, 0, 1, 2, 3, 4])
        .range([
          "transparent",
          rangeEntry(0),
          rangeEntry(1),
          rangeEntry(2),
          rangeEntry(3),
          rangeEntry(4),
        ])
    );
  }, [resolvedLevelStyles, patternIdPrefix]);

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

  const ctxForDef = useHeatmap();
  const definition = useMemo(() => {
    if (ctxForDef.chartStatus === "loading") {
      return defineChart({
        marks: [] as unknown as ReturnType<typeof cell>[],
        scales: {
          x: { scale: xScale, guide: false },
          y: { scale: yScale, guide: false },
        },
        color: { scale: colorScale },
        margin,
        svgAnimation: false,
        // C2: no marks to focus while loading; suppress the native focus
        // ring for symmetry with the loaded branch below.
        focusRing: false,
      });
    }
    return defineChart({
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
      scales: {
        x: { scale: xScale, guide: false },
        y: { scale: yScale, guide: false },
      },
      color: { scale: colorScale },
      margin,
      svgAnimation: false,
      // C2: hover is driven by app-owned pointermove -> setControlledFocus
      // (below), which now actually engages the native focus/tooltip
      // engine. Suppress the default focus-ring mark — bklit's cell hover
      // affordance is the scale/opacity/fillOpacity styling in
      // `paintCellStyles`, not a ring — matching every other migrated
      // chart's `focusRing: false` convention (styles.css:271-280).
      focusRing: false,
      tooltip: tooltipEnabled
        ? {
            use: tooltip,
            // Native tooltip's own default chrome is reset to nothing for
            // this class (styles.css, added alongside this change); the
            // actual panel chrome is the nested `.bkm-tooltip-panel` div
            // rendered by `renderTooltipBody` below (bklit parity).
            className: "bkm-native-tooltip",
            sticky: false,
            // bklit tooltip has no spring/entrance in the legacy panel's
            // "instant" mode and C5 owns real motion wiring — snap for now.
            motion: false,
            // Reproduces `HeatmapTooltipPanel`'s flip-when-clipped +
            // vertical-center placement (right of the cell, flipping left
            // near the right edge) at the same 16px stand-off.
            placement: ["right", "left"],
            offset: HEATMAP_TOOLTIP_DEFAULT_OFFSET,
          }
        : false,
    });
  }, [cellData, xScale, yScale, colorScale, margin, cornerRadius, ctxForDef.chartStatus, tooltipEnabled]);

  return definition;
}

function hasPatternLevelStyles(levelStyles: HeatmapLevelStyles): boolean {
  return levelStyles.some((style) => isHeatmapLevelPattern(style));
}

// Port of repos/bklit-ui/packages/ui/src/charts/heatmap/
// heatmap-pattern-defs.tsx: renders the <pattern> defs backing pattern-mode
// levelStyles (HM14). One deviation forced by the TanStack backend: bklit
// paints cells inside `<g transform=translate(margin)>`, so its
// userSpaceOnUse tiles anchor at the plot origin; TanStack bakes margins into
// rect coordinates, so each base pattern is wrapped in a phase-shifting
// pattern (same trick as area-chart.tsx) to land the tile grid on the same
// phase. Ids derive from bklit's `heatmap-level-N` names under a useId-
// scoped prefix so multiple instances/legends on one page never collide.
const HeatmapPatternDefs = memo(function HeatmapPatternDefs({
  levelStyles,
  patternIdPrefix,
  phaseX,
  phaseY,
}: {
  levelStyles: HeatmapLevelStyles;
  patternIdPrefix: string | null;
  phaseX: number;
  phaseY: number;
}) {
  const nodes = levelStyles.flatMap((style, level) => {
    if (!isHeatmapLevelPattern(style) || !style.pattern) {
      return [];
    }
    const id = heatmapLevelPatternId(level);
    const scopedId = patternIdPrefix ? `${patternIdPrefix}-${id}` : id;
    const node = renderPatternPreset(
      style.pattern,
      `${scopedId}-base`,
      heatmapLevelPatternRenderOptions(style),
    );
    if (!node) return [];
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
  if (nodes.length === 0) return null;
  return <defs>{nodes}</defs>;
});

HeatmapPatternDefs.displayName = "HeatmapPatternDefs";

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

  // C2: config published by a sibling <HeatmapTooltip/> (if any) via the
  // module-scoped registry above — drives both the native tooltip's
  // enablement and the debounced focus-injection delays below.
  const subscribeTooltipConfig = useCallback(
    (listener: () => void) => subscribeHeatmapTooltipConfig(coordinator, listener),
    [coordinator],
  );
  const tooltipConfig = useSyncExternalStore(
    subscribeTooltipConfig,
    () => getHeatmapTooltipConfig(coordinator),
    () => null,
  );

  const dayLabels = useMemo(() => getHeatmapDayLabels(ctx.weekStartDay), [ctx.weekStartDay]);
  const displayRange = useMemo(
    () => (hideGhostCells ? resolveHeatmapDisplayRange(ctx.data) : null),
    [ctx.data, hideGhostCells],
  );

  const cellData = useMemo(
    () => buildCellData(ctx.data, dayLabels, displayRange, hideGhostCells),
    [ctx.data, dayLabels, displayRange, hideGhostCells],
  );

  // Pattern defs live in the overlay svg; ids are useId-scoped so two chart
  // instances (or a legend swatch) on one page never collide (HM14/HM7).
  const patternIdRaw = useId().replace(/:/g, "");
  const patternIdPrefix = useMemo(
    () => (hasPatternLevelStyles(ctx.levelStyles) ? `hm-${patternIdRaw}` : null),
    [patternIdRaw, ctx.levelStyles],
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
    patternIdPrefix,
    tooltipConfig !== null,
  );

  const isLoading = ctx.chartStatus === "loading";
  const cellsInteractive = useMemo(
    () => interactive && !isLoading,
    [interactive, isLoading],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const revealHandleRef = useRef<RevealHandle | null>(null);
  const seenRevealEpochRef = useRef<number | null>(null);
  // C2: captured from the public `onRender` boundary (composed below into
  // `handleRender`) — the app-owned pointer-hover detection below uses this
  // to drive the native tooltip via `setControlledFocus`, mirroring the
  // sanctioned capture pattern in `./focus-injection.ts` but with
  // `source: 'pointer'` (never 'programmatic', which would trigger C1's
  // legend-dim mark states).
  const renderContextRef = useRef<Pick<ChartRenderContext, "scene" | "interaction"> | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const focusedKeyRef = useRef<string | null>(null);
  const inputsRef = useRef({ ctx, coordinator, cellsInteractive, cellData, tooltipConfig });
  inputsRef.current = { ctx, coordinator, cellsInteractive, cellData, tooltipConfig };

  // Debounced app -> chart focus bridge. `key` is `${column}-${row}` for a
  // hovered cell or null for "no cell hovered"; repeated calls with the same
  // key (e.g. every pointermove within one cell) are no-ops so the timers
  // below are only (re)armed on an actual enter/leave transition.
  const scheduleFocus = useCallback((point: ChartPoint | null, key: string | null) => {
    if (focusedKeyRef.current === key) return;
    focusedKeyRef.current = key;
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    const interaction = renderContextRef.current?.interaction;
    if (!interaction) return;
    const { tooltipConfig: cfg } = inputsRef.current;
    if (point) {
      const delayMs = cfg?.showDelayMs ?? 0;
      const apply = () => interaction.setControlledFocus(point, { source: "pointer" });
      if (delayMs > 0) {
        focusTimerRef.current = window.setTimeout(() => {
          focusTimerRef.current = null;
          apply();
        }, delayMs);
      } else {
        apply();
      }
    } else {
      // bklit spec: 120ms hide delay, debouncing the FOCUS clear (not the
      // tooltip) — cancelled above if the pointer re-enters a cell first.
      const delayMs = cfg?.hideDelayMs ?? 0;
      const apply = () => interaction.setControlledFocus(null, { source: "pointer" });
      if (delayMs > 0) {
        focusTimerRef.current = window.setTimeout(() => {
          focusTimerRef.current = null;
          apply();
        }, delayMs);
      } else {
        apply();
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, []);

  const handleCellLeave = useCallback(() => {
    coordinator?.setHoveredCell(null);
    coordinator?.setTooltipData(null);
    scheduleFocus(null, null);
  }, [coordinator, scheduleFocus]);

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

      // C2: bridge the app-detected hover to the native tooltip/focus
      // engine. `cell()`/`rect()` builds each ChartPoint's `datum` as the
      // exact input array element (dist/rect.js), so reference equality
      // against `d` reliably locates the matching scene point.
      const scenePoint = renderContextRef.current?.scene.points.find((p) => p.datum === d) ?? null;
      scheduleFocus(scenePoint, `${d.column}-${d.row}`);
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
  }, [cellsInteractive, coordinator, handleCellLeave, scheduleFocus]);

  const hoveredCell = useSyncExternalStore(
    coordinator ? coordinator.subscribe : () => () => {},
    () => coordinator?.getHoveredCell() ?? null,
    () => null,
  );
  // bklit parity: `isHeatmapHoverEffectEnabled` gates ALL hover styling —
  // when every prop is 1 there is nothing to dim/highlight, so cells stay
  // visually untouched (tooltip tracking still runs via the coordinator).
  const hoverEffectEnabled = useMemo(
    () => isHeatmapHoverEffectEnabled({ inactiveOpacity, inactiveScale, activeScale }),
    [inactiveOpacity, inactiveScale, activeScale],
  );
  const hasHover = hoveredCell !== null && ctx.chartPhase === "ready" && hoverEffectEnabled;

  // bklit `inactiveScale`/`activeScale`/`rowOpacity` parity: bklit applies
  // `readyHoverStyle`'s scale on each cell's wrapper `motion.g` (origin =
  // cell center, `HEATMAP_INACTIVE_TRANSITION`), tweens the data rect's OWN
  // `opacity` for the hover dim (`style={{ opacity: dataOpacity }}`), and
  // multiplies the base cell fillOpacity by `resolveHeatmapRowOpacity`. The
  // migrated cell rects are TanStack-rendered (data-ts-key ends in
  // `${column}-${row}`), so all three are applied straight onto those rects:
  // per-cell scale with `transform-box: fill-box` (element-local origin ≡
  // bklit's px origin), own-opacity dim, and per-row fill-opacity. Ghost
  // cells (transparent fill) are skipped.
  const cellStyleRef = useRef({
    hoverEffectEnabled,
    hasHover,
    hoveredCell,
    inactiveOpacity,
    inactiveScale,
    activeScale,
    rowOpacity,
    cellData,
    levelStyles: ctx.levelStyles,
  });
  cellStyleRef.current = {
    hoverEffectEnabled,
    hasHover,
    hoveredCell,
    inactiveOpacity,
    inactiveScale,
    activeScale,
    rowOpacity,
    cellData,
    levelStyles: ctx.levelStyles,
  };

  const paintCellStyles = useCallback((host: HTMLElement) => {
    const {
      hasHover: hovering,
      hoveredCell: hovered,
      inactiveOpacity: iOpacity,
      inactiveScale: iScale,
      activeScale: aScale,
      rowOpacity: rOpacity,
      cellData: cd,
      levelStyles: ls,
    } = cellStyleRef.current;
    const cellByKey = new Map<string, CellDatum>();
    for (const d of cd) cellByKey.set(`${d.column}-${d.row}`, d);
    const rects = host.querySelectorAll<SVGRectElement>("rect[data-ts-key]");
    for (const rect of rects) {
      const k = rect.getAttribute("data-ts-key") ?? "";
      const key = k.slice(k.lastIndexOf(":") + 1);
      const d = cellByKey.get(key);
      if (!d) continue;
      const isHighlighted =
        hovering &&
        hovered !== null &&
        hovered.column === d.column &&
        hovered.row === d.row &&
        !d.isGhost;
      const isDimmed = hovering && !isHighlighted && !d.isGhost;
      const style = resolveHeatmapHoverStyle(isHighlighted, isDimmed, {
        inactiveOpacity: iOpacity,
        inactiveScale: iScale,
        activeScale: aScale,
      });
      rect.style.transformOrigin = "center";
      rect.style.transformBox = "fill-box";
      rect.style.transition = `transform ${HEATMAP_INACTIVE_TRANSITION_CSS}, opacity ${HEATMAP_INACTIVE_TRANSITION_CSS}`;
      rect.style.transform = style.scale !== 1 ? `scale(${style.scale})` : "";
      // bklit parity: the hover dim tweens the cell rect's OWN opacity
      // (legacy `style={{ opacity: dataOpacity }}` on the data motion.rect),
      // NOT a background overlay composited on top — the two are equivalent
      // over white except at antialiased cell edges, where an overlay paints
      // hollow-square halos (T-W1-9 HM16 residual).
      rect.style.opacity = String(style.opacity);
      rect.style.fillOpacity = String(
        resolveHeatmapRowOpacity(d.row, rOpacity) * heatmapLevelCellFillOpacity(ls[d.level] ?? ls[0]),
      );
    }
  }, []);

  useLayoutEffect(() => {
    const host = chartHostRef.current;
    if (host) paintCellStyles(host);
  }, [
    hoveredCell,
    hasHover,
    hoverEffectEnabled,
    inactiveOpacity,
    inactiveScale,
    activeScale,
    rowOpacity,
    cellData,
    ctx.levelStyles,
    ctx.chartPhase,
    paintCellStyles,
  ]);

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
    (renderCtx: { container: HTMLElement } & Partial<Pick<ChartRenderContext, "scene" | "interaction">>) => {
      // C2: capture the interaction controller + scene for the pointer-hover
      // -> native-tooltip bridge above. The reveal-animation re-invoke below
      // (deferred-reveal double-rAF fallback) only ever passes `container`,
      // so `scene`/`interaction` are optional here and only overwrite the
      // ref when the real onRender boundary supplies them.
      if (renderCtx.scene && renderCtx.interaction) {
        renderContextRef.current = { scene: renderCtx.scene, interaction: renderCtx.interaction };
      }
      const { container } = renderCtx;
      const { animateCells, revealEpoch, enterTransition, animationDuration, enterStaggerScale, cellData: cd } =
        revealInputsRef.current;
      if (!animateCells || animationDuration <= 0) return;

      // TanStack mounts/reconciles the mark DOM after React's layout effects;
      // paint prop-driven cell styles again at the public onRender boundary.
      paintCellStyles(container);

      const fadeDurationSec = resolveHeatmapEnterFadeDurationSec(enterTransition, animationDuration);
      const durMs = fadeDurationSec * 1000;
      const easing =
        enterTransition?.ease
          ? `cubic-bezier(${enterTransition.ease.join(",")})`
          : `cubic-bezier(${HEATMAP_DEFAULT_ENTER_EASE.join(",")})`;

      // Build the static element list + per-cell fade delay up front so the
      // reveal controller owns the guard/epoch/deadline/post-paint mechanics
      // (deferred-reveal.ts) — no duplicated `bkmRevealed` stamping here.
      // Cells whose rect hasn't landed yet are skipped; the double-rAF
      // fallback below re-invokes handleRender once the marks are present.
      const rectByKey = new Map<string, SVGRectElement>();
      for (const r of container.querySelectorAll<SVGRectElement>("rect[data-ts-key]")) {
        const k = r.getAttribute("data-ts-key") ?? "";
        const key = k.slice(k.lastIndexOf(":") + 1);
        if (key && !rectByKey.has(key)) rectByKey.set(key, r);
      }
      const entries: { element: SVGRectElement; delayMs: number }[] = [];
      for (const d of cd) {
        const key = `${d.column}-${d.row}`;
        const rect = rectByKey.get(key);
        if (!rect) continue;
        entries.push({
          element: rect,
          delayMs: computeHeatmapEnterFadeDelayMs({
            column: d.column,
            row: d.row,
            revealEpoch,
            animationDurationMs: animationDuration,
            enterStaggerScale,
            fadeDurationSec,
          }),
        });
      }
      if (entries.length === 0) return;

      revealHandleRef.current?.cancel();
      revealHandleRef.current = runDeferredReveal({
        container,
        animationDuration: durMs,
        revealEpoch,
        seenEpochRef: seenRevealEpochRef,
        staggerDelayMs: (index) => entries[index]?.delayMs ?? 0,
        animateElement: (element, index) => {
          const entry = entries[index];
          if (!entry) return null;
          const rect = element as SVGRectElement;
          if (rect.getAnimations().length > 0) return null;
          const anim = rect.animate([{ opacity: "0" }, { opacity: "1" }], {
            duration: durMs,
            delay: entry.delayMs,
            easing,
            fill: "backwards",
          });
          anim.onfinish = () => {
            try {
              anim.cancel();
            } catch { /* teardown race — already cancelled */ }
          };
          return anim;
        },
        elements: entries.map((e) => e.element),
      });
    },
    [paintCellStyles],
  );

  useEffect(() => {
    return () => {
      revealHandleRef.current?.cancel();
      revealHandleRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const { animateCells: ac, revealEpoch: re } = revealInputsRef.current;
    if (!ac) return;
    if (seenRevealEpochRef.current === re) return;
    const host = chartHostRef.current;
    if (!host) return;
    const marks = host.querySelector<HTMLElement>(".ts-chart__marks");
    if (!marks || isRevealed(marks)) return;
    if (host.querySelectorAll("rect[data-ts-key]").length === 0) return;
    if (host.getAnimations().length > 0) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const liveMarks = host.querySelector<HTMLElement>(".ts-chart__marks");
        if (seenRevealEpochRef.current === revealInputsRef.current.revealEpoch) return;
        if (!liveMarks || isRevealed(liveMarks)) return;
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
          renderTooltipBody={(bodyCtx) => {
            const point = bodyCtx.points[0];
            const cfg = tooltipConfig;
            if (!point || !cfg) return null;
            const d = point.datum as CellDatum;
            return (
              <div
                className={cfg.className ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel"}
                style={{ backgroundColor: cfg.backgroundColor, ...cfg.panelStyle }}
              >
                <div className="bkm-tooltip-content">
                  <div className="ts-bkm-heatmap-tooltip-date">{formatHeatmapTooltipDate(d.date)}</div>
                  <div className="ts-bkm-heatmap-tooltip-weekday">{formatHeatmapTooltipWeekday(d.date)}</div>
                  <div className="ts-bkm-heatmap-tooltip-divider" />
                  <div className="ts-bkm-heatmap-tooltip-value">{cfg.formatLabel(d.count, d.date)}</div>
                </div>
              </div>
            );
          }}
        />
      </div>
      <svg
        width={ctx.width}
        height={ctx.height}
        className="ts-bkm-heatmap-hover-svg"
        style={{ position: "absolute", inset: 0 }}
      >
        <HeatmapPatternDefs
          levelStyles={ctx.levelStyles}
          patternIdPrefix={patternIdPrefix}
          phaseX={ctx.margin.left}
          phaseY={ctx.margin.top}
        />
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

export interface HeatmapTooltipProps {
  formatLabel?: (count: number, date: Date) => string;
  className?: string;
  panelStyle?: CSSProperties;
  backgroundColor?: string;
  /**
   * @deprecated No-op since the C2 (phase 6) native-tooltip migration: the
   * native tooltip extension always renders with `motion: false` (matching
   * bklit's former `instant` fast path), so there is no longer a distinct
   * spring-entrance mode to opt out of. Kept only so existing call sites
   * keep compiling; passing it has no effect.
   */
  instant?: boolean;
  showDelay?: number;
  hideDelay?: number;
}

// C2 (phase 6): `HeatmapTooltip` no longer renders a bespoke portal panel —
// it publishes its config into the module-scoped registry above so the
// sibling `<HeatmapCells>` can enable TanStack's native `tooltip` extension
// and build the panel markup itself via `renderTooltipBody` (same content
// as the legacy `HeatmapTooltipPanel`, just positioned by the native
// placement engine instead of bespoke flip/clamp math). Rendering an
// `<HeatmapTooltip/>` remains opt-in: no sibling means no registered
// config, which keeps the native tooltip disabled (`tooltip: false`) on
// `<HeatmapCells>`'s definition, preserving prior "no tooltip unless
// explicitly requested" behavior.
export function HeatmapTooltip({
  formatLabel = formatHeatmapContributionLabel,
  className = "",
  panelStyle,
  backgroundColor,
  instant: _instant = false,
  showDelay = 0,
  hideDelay = 120,
}: HeatmapTooltipProps) {
  void _instant;
  const coordinator = useHeatmapCoordinatorOptional();

  useLayoutEffect(() => {
    if (!coordinator) return;
    setHeatmapTooltipConfig(coordinator, {
      formatLabel,
      className,
      panelStyle,
      backgroundColor,
      showDelayMs: Math.max(0, showDelay),
      hideDelayMs: Math.max(0, hideDelay),
    });
    return () => {
      setHeatmapTooltipConfig(coordinator, null);
    };
  }, [coordinator, formatLabel, className, panelStyle, backgroundColor, showDelay, hideDelay]);

  return null;
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
  stroke = "var(--border)",
  gradient,
  strokeWidth = 1,
  strokeOpacity = 1,
}: HeatmapSeparatorProps) {
  const ctx = useHeatmap();
  const layout = ctx.separatorLayout;

  // useId-scoped so two heatmap instances on one page don't share one
  // gradient def (HM7; bklit does the same via useId).
  const reactId = useId().replace(/:/g, "");
  const gradientId = `heatmap-separator-gradient-${reactId}`;
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
