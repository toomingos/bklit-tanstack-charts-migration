import type {
  ChartMarkState,
  ChartMarkStateContext,
  ChartRectStateStyle,
} from "@tanstack/charts";
import type { HeatmapColumn, HeatmapDisplayRange } from './heatmap-utils';
import { getHeatmapContributionLevel, isHeatmapGhostBin } from './heatmap-utils';
import type { HeatmapLevelStyles } from './heatmap-colors';
import { isHeatmapLevelPattern } from './heatmap-colors';

interface CellDatum {
  readonly colKey: string;
  readonly rowKey: string;
  readonly column: number;
  readonly row: number;
  readonly count: number;
  readonly level: number;
  readonly date: Readonly<Date>;
  readonly bin: number;
  readonly isGhost: boolean;
}

interface BuildCellDataParams {
  readonly columns: readonly HeatmapColumn[];
  readonly dayLabels: readonly string[];
  readonly displayRange: HeatmapDisplayRange | undefined;
  readonly hideGhost: boolean;
}

const buildCellData = ({ columns, dayLabels, displayRange, hideGhost }: BuildCellDataParams): CellDatum[] => {
  const data: CellDatum[] = [];
  for (const [colIdx, col] of columns.entries()) {
    for (const [rowIdx, bin] of col.bins.entries()) {
      const isGhost = hideGhost && displayRange !== undefined && isHeatmapGhostBin(bin, displayRange);
      data.push({
        bin: bin.bin,
        colKey: String(colIdx),
        column: colIdx,
        count: bin.count,
        date: bin.date,
        isGhost,
        level: isGhost ? -1 : getHeatmapContributionLevel(bin.count),
        row: rowIdx,
        rowKey: dayLabels[rowIdx] ?? `${rowIdx}`,
      });
    }
  }
  return data;
}

interface HoverCellGeometryContext {
  readonly xScale: (columnIndex: number) => number;
  readonly yScale: (rowIndex: number) => number;
  readonly binWidth: number;
  readonly binHeight: number;
  readonly gap: number;
}

interface HoverCellGeometry {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

const buildHoverCellGeometry = (
  columnIndex: number,
  rowIndex: number,
  ctx: Readonly<HoverCellGeometryContext>,
): HoverCellGeometry => ({
  height: Math.max(ctx.binHeight - ctx.gap, 0),
  width: Math.max(ctx.binWidth - ctx.gap, 0),
  x: ctx.xScale(columnIndex),
  y: ctx.yScale(rowIndex) + ctx.gap,
});

const HEATMAP_CELL_INSET = 1;

// Matches legacy 220ms; easing approximated (mark transitions take no cubic-bezier).
const HEATMAP_HOVER_TRANSITION_DURATION_MS = 220;
const HEATMAP_HOVER_TRANSITION: NonNullable<ChartMarkState["transition"]> = {
  duration: HEATMAP_HOVER_TRANSITION_DURATION_MS,
  easing: "ease-in-out",
  type: "tween",
};

// Mark-state inset is absolute, not a delta: reproduces a centered scale().
const HEATMAP_HOVER_INSET_HALVING = 2;
const heatmapHoverInset = (bandwidth: number, scale: number, baseInset: number): number => {
  if (scale === 1) {return baseInset;}
  const contentSize = Math.max(0, bandwidth - baseInset * HEATMAP_HOVER_INSET_HALVING);
  return Math.max(0, (bandwidth - contentSize * scale) / HEATMAP_HOVER_INSET_HALVING);
}

interface HeatmapHoverStatesParams {
  readonly bandwidth: number;
  readonly baseInset: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

// Engine skips states entirely when nothing is focused.
const heatmapHoverStates = ({
  bandwidth,
  baseInset,
  inactiveOpacity,
  inactiveScale,
  activeScale,
}: Readonly<HeatmapHoverStatesParams>): ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] | undefined => {
  const states: ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] = [];
  if (activeScale !== 1) {
    states.push({
      style: { inset: heatmapHoverInset(bandwidth, activeScale, baseInset) },
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<ChartMarkStateContext<CellDatum>>): boolean =>
        context.focus.source === "pointer" && !context.datum.isGhost && context.matches("primary"),
    });
  }
  if (inactiveOpacity !== 1 || inactiveScale !== 1) {
    const inactiveStyle: ChartRectStateStyle<CellDatum> = { opacity: inactiveOpacity };
    if (inactiveScale !== 1) {
      inactiveStyle.inset = heatmapHoverInset(bandwidth, inactiveScale, baseInset);
    }
    states.push({
      style: inactiveStyle,
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<ChartMarkStateContext<CellDatum>>): boolean =>
        context.focus.source === "pointer" && !context.datum.isGhost && !context.matches("primary"),
    });
  }
// Undefined (not []) lets the engine skip states entirely.
  return states.length > 0 ? states : undefined;
}

const BEZIER_CUBIC_TERM_COEFFICIENT = 3;
const BEZIER_DERIVATIVE_MID_COEFFICIENT = 6;
const BEZIER_NEWTON_RAPHSON_ITERATIONS = 6;
const BEZIER_CONVERGENCE_EPSILON = 1e-5;

const cubicBezierCoord = (paramT: number, p1: number, p2: number): number =>
  BEZIER_CUBIC_TERM_COEFFICIENT * paramT * (1 - paramT) * (1 - paramT) * p1 +
  BEZIER_CUBIC_TERM_COEFFICIENT * paramT * paramT * (1 - paramT) * p2 +
  paramT * paramT * paramT;

const refineCubicBezierParam = (x1: number, x2: number, progress: number): number => {
  let paramT = progress;
  for (let i = 0; i < BEZIER_NEWTON_RAPHSON_ITERATIONS; i += 1) {
    const err = cubicBezierCoord(paramT, x1, x2) - progress;
    const dx = BEZIER_CUBIC_TERM_COEFFICIENT * (1 - paramT) * (1 - paramT) * x1 +
      BEZIER_DERIVATIVE_MID_COEFFICIENT * paramT * (1 - paramT) * (x2 - x1) +
      BEZIER_CUBIC_TERM_COEFFICIENT * paramT * paramT * (1 - x2);
    if (Math.abs(err) < BEZIER_CONVERGENCE_EPSILON || dx === 0) {break;}
    paramT -= err / dx;
  }
  return paramT;
}

const solveCubicBezierEasing = (points: readonly [number, number, number, number]): ((progress: number) => number) => {
  const [x1, y1, x2, y2] = points;
  return (progress: number): number => {
    if (progress <= 0) {return 0;}
    if (progress >= 1) {return 1;}
    const paramT = refineCubicBezierParam(x1, x2, progress);
    return cubicBezierCoord(paramT, y1, y2);
  };
}

const hasPatternLevelStyles = (levelStyles: Readonly<HeatmapLevelStyles>): boolean =>
  levelStyles.some((style) => isHeatmapLevelPattern(style));

export {
  buildCellData,
  buildHoverCellGeometry,
  HEATMAP_CELL_INSET,
  HEATMAP_HOVER_TRANSITION,
  heatmapHoverInset,
  heatmapHoverStates,
  solveCubicBezierEasing,
  hasPatternLevelStyles,
};
export type { CellDatum };
