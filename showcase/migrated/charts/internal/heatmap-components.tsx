import {
  createPortal,
} from "react-dom";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts/scene";
import { cell } from "@tanstack/charts/rect";
import { tooltip } from "@tanstack/charts/tooltip";
import type {
  ChartFocusMatch,
  ChartMarkState,
  ChartMotionDefinition,
  ChartPoint,
  ChartRectStateStyle,
  ChartRendererRenderContext,
} from "@tanstack/charts";
import { scaleBand, scaleOrdinal } from "d3-scale";
import type { ScaleBand, ScaleOrdinal } from "d3-scale";
import { useHeatmap, type HeatmapMargin } from "./heatmap-context";
import {
  computeHeatmapEnterFadeDelayMs,
  HEATMAP_DEFAULT_ENTER_EASE,
  resolveHeatmapEnterFadeDurationSec,
  type HeatmapEnterTransition,
} from "./heatmap-animation";
import { chartMotionRenderer } from "./motion-renderer";
import { useHeatmapCoordinatorOptional } from "./heatmap-interaction";
import {
  HEATMAP_INACTIVE_OPACITY,
  type HeatmapHoverCoordinator,
} from "./heatmap-hover-chrome";
import {
  formatHeatmapMonthShort,
  formatHeatmapTooltipDate,
  formatHeatmapTooltipWeekday,
  formatHeatmapYAxisLabel,
  getHeatmapColumnMonthAnchor,
  getHeatmapContributionLevel,
  getHeatmapDayLabels,
  isHeatmapGhostBin,
  resolveHeatmapDisplayRange,
  resolveHeatmapRowOpacity,
  shouldShowHeatmapYAxisTick,
  type HeatmapColumn,
  type HeatmapDisplayRange,
  type HeatmapYAxisLabelFormat,
  type HeatmapYAxisTickFilter,
} from "./heatmap-utils";
import {
  heatmapLevelPatternId,
  heatmapLevelPatternRenderOptions,
  heatmapLevelCellFillOpacity,
  isHeatmapLevelPattern,
  type HeatmapLevelStyle,
  type HeatmapLevelStyles,
} from "./heatmap-colors";
import { renderPatternPreset } from "./pattern-preset-render";
import { HEATMAP_AXIS_LAYER_CLASS } from "./heatmap-separator";
import {
  getHeatmapTooltipConfig,
  subscribeHeatmapTooltipConfig,
  type HeatmapTooltipConfig,
} from "./heatmap-tooltip-registry";

interface CellDatum {
  colKey: string;
  rowKey: string;
  column: number;
  row: number;
  count: number;
  level: number;
  date: Readonly<Date>;
  bin: number;
  isGhost: boolean;
}

// Bklit `positionBox`/`HeatmapTooltipPanel` parity: 16px stand-off between
// The hovered cell and the tooltip edge, shared by the native tooltip's
// `offset` option (below) and by legacy-offset call sites elsewhere.
const HEATMAP_TOOLTIP_DEFAULT_OFFSET = 16;

interface BuildCellDataParams {
  readonly columns: readonly HeatmapColumn[];
  readonly dayLabels: readonly string[];
  readonly displayRange: HeatmapDisplayRange | undefined;
  readonly hideGhost: boolean;
}

interface BuildColumnCellDataParams {
  readonly bins: readonly HeatmapColumn["bins"][number][];
  readonly columnIndex: number;
  readonly dayLabels: readonly string[];
  readonly displayRange: HeatmapDisplayRange | undefined;
  readonly hideGhost: boolean;
}

const buildColumnCellData = ({
  bins,
  columnIndex,
  dayLabels,
  displayRange,
  hideGhost,
}: Readonly<BuildColumnCellDataParams>): CellDatum[] => {
  const cells: CellDatum[] = [];
  for (let rowIdx = 0; rowIdx < bins.length; rowIdx += 1) {
    const bin = bins[rowIdx];
    if (bin) {
      const isGhost = hideGhost && displayRange !== undefined && isHeatmapGhostBin(bin, displayRange);
      cells.push({
        bin: bin.bin,
        colKey: String(columnIndex),
        column: columnIndex,
        count: bin.count,
        date: bin.date,
        isGhost,
        level: isGhost ? -1 : getHeatmapContributionLevel(bin.count),
        row: rowIdx,
        rowKey: dayLabels[rowIdx] ?? `${rowIdx}`,
      });
    }
  }
  return cells;
};

const buildCellData = ({
  columns,
  dayLabels,
  displayRange,
  hideGhost,
}: Readonly<BuildCellDataParams>): CellDatum[] => {
  const data: CellDatum[] = [];
  for (let colIdx = 0; colIdx < columns.length; colIdx += 1) {
    const col = columns[colIdx];
    if (col) {
      data.push(...buildColumnCellData({ bins: col.bins, columnIndex: colIdx, dayLabels, displayRange, hideGhost }));
    }
  }
  return data;
};

const buildHoverCellGeometry = (
  columnIndex: number,
  rowIndex: number,
  ctx: Readonly<{ xScale: (columnIndex: number) => number; yScale: (rowIndex: number) => number; binWidth: number; binHeight: number; gap: number }>,
) => ({
  height: Math.max(ctx.binHeight - ctx.gap, 0),
  width: Math.max(ctx.binWidth - ctx.gap, 0),
  x: ctx.xScale(columnIndex),
  y: ctx.yScale(rowIndex) + ctx.gap,
});

// C3: base cell inset (bklit's hover pop scales the cell's wrapper `motion.g`
// From a `transform-box: fill-box` / center origin — see `heatmapHoverInset`
// Below for the native-`inset` equivalent of that CSS `transform: scale()`).
const HEATMAP_CELL_INSET = 1;

// C3: native mark-state transition for the hover highlight/dim. Duration
// Matches `HEATMAP_INACTIVE_TRANSITION_CSS`'s 220ms exactly; `easing` is an
// APPROXIMATION — `ChartMotionTweenTransition.easing` only accepts the named
// Keywords `'linear'|'ease'|'ease-in'|'ease-out'|'ease-in-out'` or a custom
// `(progress:number)=>number` function (dist/types.d.ts `ChartAnimationOptions`),
// Never a raw `cubic-bezier()` string — so the legacy
// `cubic-bezier(0.4, 0, 0.2, 1)` (Material "standard" ease) cannot be
// Reproduced byte-for-byte. `"ease-in-out"` is used for consistency with
// Every other migrated chart's `ChartMarkState` transitions (e.g.
// The bar-chart.tsx `BAR_DIM_TRANSITION`/`BAR_TRACK_DIM_TRANSITION` pair), which all
// Use named keywords rather than a custom bezier evaluator.
const HEATMAP_HOVER_TRANSITION: NonNullable<ChartMarkState["transition"]> = {
  duration: 220,
  easing: "ease-in-out",
  type: "tween",
};

// Native-`inset` emulation of bklit's `transform: scale(scale)` (center-
// Origin, `fill-box`) hover pop/dim. `dist/mark-state.js`'s rect branch
// Treats a state's `inset` as an ABSOLUTE target (not a delta): it shrinks/
// Grows the rect symmetrically about its existing center by
// `amount = nextInset - currentInset` on both x and y (no `insetAxis` is set
// For a plain `cell()`/`rect()` mark, so both axes move equally) — exactly
// Reproducing a centered CSS scale for the base inset's content box.
const heatmapHoverInset = (bandwidth: number, scale: number, baseInset: number): number => {
  if (scale === 1) {return baseInset;}
  const contentSize = Math.max(0, bandwidth - baseInset * 2);
  return Math.max(0, (bandwidth - contentSize * scale) / 2);
};

// Bklit `resolveHeatmapHoverStyle` parity, reimplemented as native mark
// `states` (dist/rect.d.ts: `states?: readonly ChartMarkState<TDatum,
// ChartRectStateStyle<TDatum>>[]`) instead of imperative DOM writes.
// `states` are entirely skipped by the engine when there is no active focus
// (dist/mark-state.js: `resolveMarkStateScene` -> `if (!focus ...) return
// {scene}`), so this needs no separate "is anything hovered" gate — it's a
// No-op exactly when nothing is focused, matching legacy's "no highlight
// Without a hovered cell" behavior for free. Each predicate also requires
// `focus.source === "pointer"` so this only reacts to the app's own
// `scheduleFocus` bridge (never keyboard/programmatic focus — legacy cell
// Styling was ONLY ever driven by pointer hover, never keyboard nav), and
// `!datum.isGhost` so ghost cells are never highlighted OR dimmed (bklit
// Parity — legacy `paintCellStyles` applied the same `!d.isGhost` guard to
// Both branches).
interface HeatmapHoverStatesParams {
  readonly bandwidth: number;
  readonly baseInset: number;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

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
      when: (context: Readonly<{ datum: Readonly<CellDatum>; focus: Readonly<{ source: string }>; matches: (match: ChartFocusMatch) => boolean }>) =>
        context.focus.source === "pointer" && !context.datum.isGhost && context.matches("primary"),
    });
  }
  if (inactiveOpacity !== 1 || inactiveScale !== 1) {
    const hoverInset = inactiveScale === 1 ? undefined : { inset: heatmapHoverInset(bandwidth, inactiveScale, baseInset) };
    states.push({
      style: {
        opacity: inactiveOpacity,
        ...hoverInset,
      },
      transition: HEATMAP_HOVER_TRANSITION,
      when: (context: Readonly<{ datum: Readonly<CellDatum>; focus: Readonly<{ source: string }>; matches: (match: ChartFocusMatch) => boolean }>) =>
        context.focus.source === "pointer" && !context.datum.isGhost && !context.matches("primary"),
    });
  }
  // Empty array -> `undefined` so the mark carries no `states` at all when
  // Hover styling is fully disabled (every prop === 1), matching legacy's
  // "nothing to dim/highlight, cells stay visually untouched" exactly and
  // Letting `sceneHasMarkStates` skip the mark entirely (dist/mark-state.js).
  return states.length > 0 ? states : undefined;
};

// D5: local cubic-bezier progress-function solver — `ChartAnimationOptions`'s
// `easing` field (dist/types.d.ts) only accepts the named keywords or a
// Custom `(progress:number)=>number`, never a raw `cubic-bezier()` string
// (same constraint already documented above HEATMAP_HOVER_TRANSITION), so
// `HeatmapEnterTransition.ease`'s 4-tuple control points (bklit parity, e.g.
// HEATMAP_DEFAULT_ENTER_EASE = [0.85, 0, 0.916, 0.282], heatmap-animation.ts:17)
// Need converting to a progress function for the native per-cell `motion`
// Transition below. Newton-Raphson on the bezier's x(t) (5 iterations is
// More than enough at this curve's slope) to find t for a given x=p, then
// Evaluates y(t).
const solveCubicBezierEasing = (points: readonly [number, number, number, number]): ((p: number) => number) => {
  const [x1, y1, x2, y2] = points;
  const bx = (t: number) => 3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
  const by = (t: number) => 3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;
  return (p: number) => {
    if (p <= 0 || p >= 1) {return p <= 0 ? 0 : 1;}
    let t = p;
    for (let i = 0; i < 6; i += 1) {
      const err = bx(t) - p;
      const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * t * (1 - t) * (x2 - x1) + 3 * t * t * (1 - x2);
      if (Math.abs(err) < 1e-5 || dx === 0) {break;}
      t -= err / dx;
    }
    return by(t);
  };
};

interface HeatmapColorScaleParams {
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly patternIdPrefix: string | undefined;
}

const useHeatmapColorScale = ({
  resolvedLevelStyles,
  patternIdPrefix,
}: Readonly<HeatmapColorScaleParams>): ScaleOrdinal<number, string> =>
  useMemo<ScaleOrdinal<number, string>>(() => {
    // Bklit parity (buildHeatmapFillScale): pattern-mode levels fill with
    // `url(#<prefix>heatmap-level-N)`; the matching <pattern> defs are
    // Mounted in HeatmapCells' overlay svg under the same prefix (useId-
    // Scoped, so two chart instances don't collide — HM14/HM7 lesson).
    const rangeEntry = (level: number) => {
      const style = resolvedLevelStyles[level];
      if (!style || !isHeatmapLevelPattern(style)) {return style?.color ?? "currentColor";}
      const id = heatmapLevelPatternId(level);
      const scopedPatternId = patternIdPrefix ? `${patternIdPrefix}-${id}` : id;
      return `url(#${scopedPatternId})`;
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

interface HeatmapCellScalesParams {
  readonly columnCount: number;
  readonly dayLabels: readonly string[];
  readonly margin: Readonly<HeatmapMargin>;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

interface HeatmapCellScales {
  readonly xScale: ScaleBand<string>;
  readonly yScale: ScaleBand<string>;
}

const useHeatmapCellScales = ({
  columnCount,
  dayLabels,
  margin,
  innerWidth,
  innerHeight,
}: Readonly<HeatmapCellScalesParams>): HeatmapCellScales => {
  const columnKeys = useMemo(
    () => Array.from({ length: Math.max(columnCount, 1) }, (_, i) => String(i)),
    [columnCount],
  );
  const rowKeys = useMemo(() => [...dayLabels], [dayLabels]);

  const xScale = useMemo<ScaleBand<string>>(
    () =>
      scaleBand()
        .domain(columnKeys)
        .range([margin.left, margin.left + innerWidth])
        .paddingInner(0)
        .paddingOuter(0),
    [columnKeys, margin.left, innerWidth],
  );

  const yScale = useMemo<ScaleBand<string>>(
    () =>
      scaleBand()
        .domain(rowKeys)
        .range([margin.top + innerHeight, margin.top])
        .paddingInner(0)
        .paddingOuter(0),
    [rowKeys, margin.top, innerHeight],
  );

  return { xScale, yScale };
};

interface HeatmapCellMotionParams {
  readonly animateCells: boolean;
  readonly animationDuration: number;
  readonly enterTransition: Readonly<HeatmapEnterTransition> | undefined;
  readonly enterStaggerScale: number;
  readonly revealEpoch: number;
}

interface HeatmapCellMotionFnParams {
  readonly animationDuration: number;
  readonly durMs: number;
  readonly easingFn: (progress: number) => number;
  readonly enterStaggerScale: number;
  readonly fadeDurationSec: number;
  readonly revealEpoch: number;
}

const createHeatmapCellMotionFn = ({
  animationDuration,
  durMs,
  easingFn,
  enterStaggerScale,
  fadeDurationSec,
  revealEpoch,
}: Readonly<HeatmapCellMotionFnParams>): ChartMotionDefinition<CellDatum> =>
  (motionCtx: Readonly<{ phase: string; datum: Readonly<CellDatum> | undefined }>) => {
    if (motionCtx.phase !== "enter") {return false;}
    const d = motionCtx.datum;
    if (!d) {return undefined;}
    return {
      delay: computeHeatmapEnterFadeDelayMs({
        animationDurationMs: animationDuration,
        column: d.column,
        enterStaggerScale,
        fadeDurationSec,
        revealEpoch,
        row: d.row,
      }),
      transition: { duration: durMs, easing: easingFn, type: "tween" },
    };
  };

const useHeatmapCellMotion = ({
  animateCells,
  animationDuration,
  enterTransition,
  enterStaggerScale,
  revealEpoch,
}: Readonly<HeatmapCellMotionParams>): ChartMotionDefinition<CellDatum> | false =>
  // D5: per-cell enter-fade reveal, expressed via `cell()`'s native `motion`
  // Option (dist/types.d.ts:449, `ChartMarkMotionOptions`) instead of the old
  // Imperative WAAPI driver (deferred-reveal.ts, now unused here). The
  // Per-cell delay math is byte-for-byte the seeded-PRNG formula already
  // Ported verbatim in heatmap-animation.ts (`computeHeatmapEnterFadeDelayMs`,
  // :73-80 — `seed = heatmapCellSeed(column,row) + revealEpoch*524_287`) —
  // `revealEpoch` is captured by closure below exactly as that formula
  // Requires (coordinator correction 2). Only `opacity` is animated
  // (`motionAttributes` allowlist confirms opacity is in; legacy's reveal
  // Was itself opacity-only per prior confirmation), so this is a pure
  // 1:1 native substitution — no reach-in needed for T1-parity-tier heatmap.
  useMemo<ChartMotionDefinition<CellDatum> | false>(() => {
    if (!animateCells || animationDuration <= 0) {return false;}
    const fadeDurationSec = resolveHeatmapEnterFadeDurationSec(enterTransition, animationDuration);
    const durMs = fadeDurationSec * 1000;
    const easingFn = solveCubicBezierEasing(enterTransition?.ease ?? HEATMAP_DEFAULT_ENTER_EASE);
    return createHeatmapCellMotionFn({ animationDuration, durMs, easingFn, enterStaggerScale, fadeDurationSec, revealEpoch });
  }, [animateCells, animationDuration, enterTransition, enterStaggerScale, revealEpoch]);

type HeatmapHoverStateList = readonly Readonly<ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>>[] | undefined;

type HeatmapRowOpacity = number | readonly number[] | undefined;

interface HeatmapCellMarksParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly rowOpacity: HeatmapRowOpacity;
  readonly cornerRadius: number;
  readonly hoverStates: HeatmapHoverStateList;
  readonly cellMotion: ChartMotionDefinition<CellDatum> | false;
  readonly revealEpoch: number;
}

interface BucketHeatmapCellsParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly rowOpacity: HeatmapRowOpacity;
}

const bucketHeatmapCellsByOpacity = ({
  cellData,
  resolvedLevelStyles,
  rowOpacity,
}: Readonly<BucketHeatmapCellsParams>): Map<number, CellDatum[]> => {
  const buckets = new Map<number, CellDatum[]>();
  for (const d of cellData) {
    const fillOpacity =
      resolveHeatmapRowOpacity(d.row, rowOpacity) *
      heatmapLevelCellFillOpacity(resolvedLevelStyles[d.level] ?? resolvedLevelStyles[0]);
    let bucket = buckets.get(fillOpacity);
    if (!bucket) {
      bucket = [];
      buckets.set(fillOpacity, bucket);
    }
    bucket.push(d);
  }
  return buckets;
};

interface BuildHeatmapCellMarkParams {
  readonly fillOpacity: number;
  readonly data: readonly Readonly<CellDatum>[];
  readonly cornerRadius: number;
  readonly hoverStates: HeatmapHoverStateList;
  readonly cellMotion: ChartMotionDefinition<CellDatum> | false;
  readonly revealEpoch: number;
}

const buildHeatmapCellMark = ({
  fillOpacity,
  data,
  cornerRadius,
  hoverStates,
  cellMotion,
  revealEpoch,
}: Readonly<BuildHeatmapCellMarkParams>) =>
  cell(data, {
    fillOpacity,
    id: `heatmap-cell-fo-${fillOpacity}`,
    inset: HEATMAP_CELL_INSET,
    // D5: epoch-suffixed so a revealEpoch bump re-triggers the 'enter'
    // Motion phase (matching legacy's "reveal replays on refresh") — see
    // The mount-flash trade-off note on the cell-motion helper above.
    key: (d: Readonly<CellDatum>) => `${d.column}-${d.row}:${revealEpoch}`,
    motion: cellMotion,
    radius: cornerRadius,
    states: hoverStates,
    x: (d: Readonly<CellDatum>) => d.colKey,
    y: (d: Readonly<CellDatum>) => d.rowKey,
    z: (d: Readonly<CellDatum>) => d.level,
  });

const useHeatmapCellMarks = ({
  cellData,
  resolvedLevelStyles,
  rowOpacity,
  cornerRadius,
  hoverStates,
  cellMotion,
  revealEpoch,
}: Readonly<HeatmapCellMarksParams>) => {
  // Bklit `resolveHeatmapRowOpacity` x `heatmapLevelCellFillOpacity` parity:
  // Legacy applied this product as each cell rect's OWN (non-hover-driven)
  // `fillOpacity`, independent of and layered under the hover dim. Rect/cell
  // Marks only take a single SCALAR `fillOpacity` per mark instance (not a
  // Per-datum channel — dist/rect.d.ts), so cells are bucketed into one
  // `cell()` mark per distinct resolved value. Buckets are keyed by data
  // (row/level), never by hover, so membership — and therefore each cell's
  // Owning mark/DOM element identity — never changes on hover, preserving
  // Smooth `states` transitions (no remount/snap). In the common case
  // (uniform rowOpacity, solid levelStyles) this collapses to exactly one
  // Bucket, i.e. one mark, matching the pre-C3 shape.
  //
  // Trade-off (disclosed, no QA possible per rules): folding `revealEpoch`
  // Into `key()` forces every cell's mark identity (and DOM node) to change
  // On every epoch bump so the native motion engine re-runs the 'enter'
  // Phase — matching legacy's "reveal replays on refresh"
  // Behavior. `heatmap-lifecycle.ts`'s `revealEpoch` bumps both on
  // Loading->ready AND on a mount-time effect that fires on initial mount
  // Too, so mount already goes through key `...:0` -> (if the mount effect
  // Also bumps) `...:1`, i.e. an unmount/remount of every cell's mark within
  // The same paint pass this file cannot single-step through without a
  // Browser (no-QA rule) — flagged here rather than silently assumed benign.
  const cellMarks = useMemo(() => {
    const buckets = bucketHeatmapCellsByOpacity({ cellData, resolvedLevelStyles, rowOpacity });
    return [...buckets.entries()].map(([fillOpacity, data]: readonly [number, readonly Readonly<CellDatum>[]]) =>
      buildHeatmapCellMark({ cellMotion, cornerRadius, data, fillOpacity, hoverStates, revealEpoch }),
    );
  }, [cellData, resolvedLevelStyles, rowOpacity, cornerRadius, hoverStates, cellMotion, revealEpoch]);
  return cellMarks;
};

type HeatmapCellMark = ReturnType<typeof useHeatmapCellMarks>[number];

interface HeatmapDefinitionParams {
  readonly cellMarks: readonly Readonly<HeatmapCellMark>[];
  readonly xScale: ScaleBand<string>;
  readonly yScale: ScaleBand<string>;
  readonly colorScale: ScaleOrdinal<number, string>;
  readonly margin: Readonly<HeatmapMargin>;
  readonly chartStatus: ReturnType<typeof useHeatmap>["chartStatus"];
  readonly tooltipEnabled: boolean;
}

interface LoadingHeatmapDefinitionParams {
  readonly cellMarks: readonly Readonly<HeatmapCellMark>[];
  readonly colorScale: ScaleOrdinal<number, string>;
  readonly margin: Readonly<HeatmapMargin>;
  readonly xScale: ScaleBand<string>;
  readonly yScale: ScaleBand<string>;
}

const buildLoadingHeatmapDefinition = ({
  cellMarks,
  colorScale,
  margin,
  xScale,
  yScale,
}: Readonly<LoadingHeatmapDefinitionParams>) =>
  defineChart({
    // D1: typed off `cellMarks` (not the generic-erased `ReturnType<typeof
    // Cell>[]` this used pre-C5) so this branch's `TDatum` matches the
    // Loaded branch below exactly — `RendererChart`'s strict generic
    // Inference against the full `chartMotionRenderer<CellDatum, string, string>()`
    // Signature (unlike legacy `Chart`) requires both branches' marks
    // Arrays to share the same concrete `CellDatum` element type.
    color: { scale: colorScale },
    // C2: no marks to focus while loading; suppress the native focus
    // Ring for symmetry with the loaded branch below.
    focusRing: false,
    margin,
    marks: [] as typeof cellMarks,
    scales: {
      x: { axis: false, guide: false, scale: xScale },
      y: { axis: false, guide: false, scale: yScale },
    },
    // D1/D5: `svgAnimation` (dist/types.d.ts `ChartDefinitionOptions`) is
    // Only consumed by the static SVG renderer (dist/renderer.js:125,
    // `hasRendered ? resolveAnimation(options.definition.svgAnimation,
    // ...) : void 0`) — dead/inert once this chart is switched to
    // `chartMotionRenderer()` below. Left as `false` (harmless,
    // Unchanged) rather than removed, since it isn't in D5's edit scope.
    svgAnimation: false,
  });

const buildHeatmapTooltipOption = (
  tooltipEnabled: boolean,
): false | {
  className: string;
  motion: false;
  offset: number;
  placement: readonly ["right", "left"];
  sticky: boolean;
  use: typeof tooltip;
} => {
  if (!tooltipEnabled) {return false;}
  const placement: readonly ["right", "left"] = ["right", "left"];
  return {
    // Native tooltip's own default chrome is reset to nothing for
    // This class (styles.css, added alongside this change); the
    // Actual panel chrome is the nested `.bkm-tooltip-panel` div
    // Rendered by `renderTooltipBody` below (bklit parity).
    className: "bkm-native-tooltip",
    // Legacy bklit tooltip has no spring/entrance in the legacy panel's
    // "Instant" mode and C5 owns real motion wiring — snap for now.
    motion: false,
    // Reproduces `HeatmapTooltipPanel`'s flip-when-clipped +
    // Vertical-center placement (right of the cell, flipping left
    // Near the right edge) at the same 16px stand-off.
    offset: HEATMAP_TOOLTIP_DEFAULT_OFFSET,
    placement,
    sticky: false,
    use: tooltip,
  };
};

const useHeatmapDefinition = ({
  cellMarks,
  xScale,
  yScale,
  colorScale,
  margin,
  chartStatus,
  tooltipEnabled,
}: Readonly<HeatmapDefinitionParams>) => {
  const definition = useMemo(() => {
    if (chartStatus === "loading") {
      return buildLoadingHeatmapDefinition({ cellMarks, colorScale, margin, xScale, yScale });
    }
    return defineChart({
      color: { scale: colorScale },
      // C2: hover is driven by app-owned pointermove -> setControlledFocus
      // (Below), which now actually engages the native focus/tooltip
      // Engine. Suppress the default focus-ring mark — bklit's cell hover
      // Affordance is the scale/opacity/fillOpacity `states` styling above,
      // Not a ring — matching every other migrated chart's
      // `focusRing: false` convention (styles.css:271-280).
      focusRing: false,
      margin,
      marks: cellMarks,
      scales: {
        x: { axis: false, guide: false, scale: xScale },
        y: { axis: false, guide: false, scale: yScale },
      },
      svgAnimation: false,
      tooltip: buildHeatmapTooltipOption(tooltipEnabled),
    });
  }, [cellMarks, xScale, yScale, colorScale, margin, chartStatus, tooltipEnabled]);
  return definition;
};

interface HeatmapHoverStatesHookParams {
  readonly xScale: ScaleBand<string>;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

const useHeatmapHoverStates = ({
  xScale,
  inactiveOpacity,
  inactiveScale,
  activeScale,
}: Readonly<HeatmapHoverStatesHookParams>): HeatmapHoverStateList =>
  // C3: hover highlight/dim as native mark `states`, keyed on the engine's
  // OWN focus resolution (driven by `scheduleFocus` -> `setControlledFocus`
  // Below) rather than React state — the chart definition never needs to
  // Rebuild when the hovered cell changes, only when these style PROPS
  // Change (bandwidth/inactiveOpacity/inactiveScale/activeScale), which is
  // The "cheaper channel-level route" flagged in the mission's performance
  // Note: zero definition rebuilds per hovered cell.
  useMemo(
    () =>
      heatmapHoverStates({
        activeScale,
        bandwidth: xScale.bandwidth(),
        baseInset: HEATMAP_CELL_INSET,
        inactiveOpacity,
        inactiveScale,
      }),
    [xScale, inactiveOpacity, inactiveScale, activeScale],
  );

interface HeatmapChartDefinitionParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly columnCount: number;
  readonly dayLabels: readonly string[];
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly margin: Readonly<HeatmapMargin>;
  readonly cornerRadius: number;
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly patternIdPrefix: string | undefined;
  readonly tooltipEnabled: boolean;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
  readonly rowOpacity: HeatmapRowOpacity;
  readonly revealEpoch: number;
  readonly animationDuration: number;
  readonly enterTransition: Readonly<HeatmapEnterTransition> | undefined;
  readonly enterStaggerScale: number;
  readonly animateCells: boolean;
}

const useHeatmapChartDefinition = ({
  cellData,
  columnCount,
  dayLabels,
  innerWidth,
  innerHeight,
  margin,
  cornerRadius,
  resolvedLevelStyles,
  patternIdPrefix,
  tooltipEnabled,
  inactiveOpacity,
  inactiveScale,
  activeScale,
  rowOpacity,
  revealEpoch,
  animationDuration,
  enterTransition,
  enterStaggerScale,
  animateCells,
}: Readonly<HeatmapChartDefinitionParams>) => {
  const colorScale = useHeatmapColorScale({ patternIdPrefix, resolvedLevelStyles });

  const { xScale, yScale } = useHeatmapCellScales({ columnCount, dayLabels, innerHeight, innerWidth, margin });

  const hoverStates = useHeatmapHoverStates({ activeScale, inactiveOpacity, inactiveScale, xScale });

  const cellMotion = useHeatmapCellMotion({ animateCells, animationDuration, enterStaggerScale, enterTransition, revealEpoch });

  const cellMarks = useHeatmapCellMarks({ cellData, cellMotion, cornerRadius, hoverStates, resolvedLevelStyles, revealEpoch, rowOpacity });

  return useHeatmapDefinition({ cellMarks, chartStatus: useHeatmap().chartStatus, colorScale, margin, tooltipEnabled, xScale, yScale });
};

const hasPatternLevelStyles = (levelStyles: HeatmapLevelStyles): boolean =>
  levelStyles.some((style: Readonly<HeatmapLevelStyle>) => isHeatmapLevelPattern(style));

// Port of repos/bklit-ui/packages/ui/src/charts/heatmap/
// The heatmap-pattern-defs.tsx file renders the <pattern> defs backing pattern-mode
// Pattern-mode levelStyles (HM14): one deviation forced by the TanStack backend — bklit
// Paints cells inside `<g transform=translate(margin)>`, so its
// Tiles using userSpaceOnUse anchor at the plot origin; TanStack bakes margins into
// Rect coordinates, so each base pattern is wrapped in a phase-shifting
// Pattern (same trick as area-chart.tsx) to land the tile grid on the same
// Phase. Ids derive from bklit's `heatmap-level-N` names under a useId-
// Scoped prefix so multiple instances/legends on one page never collide.
const HeatmapPatternDefs = memo(({
  levelStyles,
  patternIdPrefix,
  phaseX,
  phaseY,
}: Readonly<{
  levelStyles: HeatmapLevelStyles;
  patternIdPrefix: string | undefined;
  phaseX: number;
  phaseY: number;
}>) => {
  const nodes = levelStyles.flatMap((style: Readonly<HeatmapLevelStyle>, level) => {
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
    if (!node) {return [];}
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
  if (nodes.length === 0) {return undefined;}
  return <defs>{nodes}</defs>;
});

HeatmapPatternDefs.displayName = "HeatmapPatternDefs";

interface HeatmapCellsProps {
  cornerRadius?: number;
  colorScale?: (count: number) => string;
  inactiveOpacity?: number;
  inactiveScale?: number;
  activeScale?: number;
  rowOpacity?: number | readonly number[];
  interactive?: boolean;
  hideGhostCells?: boolean;
}

const clearFocusTimer = (timerId: number | undefined): void => {
  if (timerId !== undefined) {
    globalThis.clearTimeout(timerId);
  }
};

const armFocusTimer = (delayMs: number, apply: () => void): number | undefined => {
  if (delayMs <= 0) {
    apply();
    return undefined;
  }
  return window.setTimeout(apply, delayMs);
};

interface ArmHeatmapFocusTimerParams {
  readonly interaction: HeatmapRenderSnapshot["interaction"];
  readonly point: ChartPoint<CellDatum, string, string> | null;
  readonly tooltipConfig: HeatmapTooltipConfig | null;
}

// Bklit spec: 120ms hide delay, debouncing the focus clear (not the
// Tooltip) — cancelled in `scheduleFocus` if the pointer re-enters a
// Cell first. `showDelayMs` applies when a cell is hovered.
const armHeatmapFocusTimer = ({
  interaction,
  point,
  tooltipConfig,
}: Readonly<ArmHeatmapFocusTimerParams>): number | undefined => {
  const delayMs = point ? (tooltipConfig?.showDelayMs ?? 0) : (tooltipConfig?.hideDelayMs ?? 0);
  return armFocusTimer(delayMs, () => { interaction.setControlledFocus(point, { source: "pointer" }); });
};

interface HeatmapPointerHitContext {
  readonly data: readonly HeatmapColumn[];
  readonly xScale: (columnIndex: number) => number;
  readonly binWidth: number;
  readonly binHeight: number;
  readonly margin: Readonly<HeatmapMargin>;
}

interface HeatmapCellHit {
  readonly column: number;
  readonly row: number;
  readonly datum: Readonly<CellDatum>;
  readonly bin: HeatmapColumn["bins"][number];
}

interface LocateHeatmapCellParams {
  readonly ctx: Readonly<HeatmapPointerHitContext>;
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly sceneX: number;
  readonly sceneY: number;
}

type HeatmapRenderSnapshot = Pick<ChartRendererRenderContext<CellDatum, string, string>, "interaction" | "scene">;

interface HeatmapCellHoverParams {
  readonly coordinator: HeatmapHoverCoordinator;
  readonly ctx: ReturnType<typeof useHeatmap>;
  readonly hit: Readonly<HeatmapCellHit>;
  readonly renderContext: HeatmapRenderSnapshot | undefined;
  readonly onFocus: (point: ChartPoint<CellDatum, string, string> | null, key: string) => void;
}

const handleHeatmapCellHover = ({
  coordinator,
  ctx,
  hit,
  renderContext,
  onFocus,
}: Readonly<HeatmapCellHoverParams>): void => {
  coordinator.setHoveredLegendLevel(null);
  coordinator.setHoveredCell({ column: hit.column, row: hit.row });
  const geo = buildHoverCellGeometry(hit.column, hit.row, ctx);
  coordinator.setTooltipData({
    column: hit.column,
    count: hit.bin.count,
    date: hit.bin.date,
    row: hit.row,
    x: ctx.margin.left + geo.x + geo.width / 2,
    y: ctx.margin.top + geo.y + geo.height / 2,
  });

  // C2: bridge the app-detected hover to the native tooltip/focus
  // Engine. `cell()`/`rect()` builds each ChartPoint's `datum` as the
  // Exact input array element (dist/rect.js), so reference equality
  // Against the hit datum reliably locates the matching scene point.
  const scenePoint = renderContext?.scene.points.find((p: Readonly<{ datum: Readonly<CellDatum> }>) => p.datum === hit.datum) ?? null;
  onFocus(scenePoint, `${hit.column}-${hit.row}`);
};

const findHeatmapColumnForSceneX = (
  ctx: Readonly<HeatmapPointerHitContext>,
  posX: number,
): number => {
  for (let i = 0; i < ctx.data.length; i += 1) {
    const colX = ctx.xScale(i);
    if (posX >= colX && posX < colX + ctx.binWidth) {
      return i;
    }
  }
  return -1;
};

interface HeatmapCellDatumLookupParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly ctx: Readonly<HeatmapPointerHitContext>;
  readonly column: number;
  readonly row: number;
}

const findHeatmapCellDatum = ({
  cellData,
  ctx,
  column,
  row,
}: Readonly<HeatmapCellDatumLookupParams>): HeatmapCellHit | undefined => {
  const datum = cellData.find((candidate) => candidate.column === column && candidate.row === row);
  if (!datum || datum.isGhost) {
    return undefined;
  }
  const bin = ctx.data[column]?.bins[row];
  if (!bin) {
    return undefined;
  }
  return { bin, column, datum, row };
};

const locateHoveredHeatmapCell = ({
  ctx,
  cellData,
  sceneX,
  sceneY,
}: Readonly<LocateHeatmapCellParams>): HeatmapCellHit | undefined => {
  const posX = sceneX - ctx.margin.left;
  const posY = sceneY - ctx.margin.top;

  const foundCol = findHeatmapColumnForSceneX(ctx, posX);
  const foundRow = Math.floor(posY / ctx.binHeight);

  if (foundCol < 0 || foundRow < 0 || foundRow >= (ctx.data[0]?.bins.length ?? 7)) {
    return undefined;
  }

  return findHeatmapCellDatum({ cellData, column: foundCol, ctx, row: foundRow });
};

const renderHeatmapTooltipContent = (datum: Readonly<CellDatum>, config: Readonly<HeatmapTooltipConfig>): ReactElement => (
  <div className="bkm-tooltip-content">
    <div className="ts-bkm-heatmap-tooltip-date">{formatHeatmapTooltipDate(datum.date)}</div>
    <div className="ts-bkm-heatmap-tooltip-weekday">{formatHeatmapTooltipWeekday(datum.date)}</div>
    <div className="ts-bkm-heatmap-tooltip-divider" />
    <div className="ts-bkm-heatmap-tooltip-value">{config.formatLabel(datum.count, datum.date)}</div>
  </div>
);

interface HeatmapSceneHitParams {
  readonly interaction: HeatmapRenderSnapshot["interaction"];
  readonly clientX: number;
  readonly clientY: number;
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly ctx: Readonly<HeatmapPointerHitContext>;
}

// C3: `clientToScene` (dist/dom-types.d.ts:33) is the documented
// Controller API for client->chart coordinate conversion, replacing a
// DOM `querySelector` + `getBoundingClientRect` reach-in into the
// Renderer's own SVG. It returns MARGIN-INCLUSIVE "scene" coordinates —
// The same space `xScale`/`yScale` operate in inside `defineChart`
// (dist/svg-coordinates.js's `svgClientToScene`, verified against
// `heatmap-context.ts`/`heatmap-chart.tsx`'s plot-local `xScale`/
// `yScale`, which are `column*binWidth + offset` from 0) — so the
// Existing plot-local column/row math in `locateHoveredHeatmapCell`
// Still needs the same `- margin.left` / `- margin.top` subtraction.
const resolveHeatmapSceneHit = ({
  interaction,
  clientX,
  clientY,
  cellData,
  ctx,
}: Readonly<HeatmapSceneHitParams>): HeatmapCellHit | undefined => {
  const scenePos = interaction.clientToScene(clientX, clientY);
  if (!scenePos) {return undefined;}
  return locateHoveredHeatmapCell({ cellData, ctx, sceneX: scenePos.x, sceneY: scenePos.y });
};

interface DispatchHeatmapPointerHitParams {
  readonly cellData: readonly Readonly<CellDatum>[];
  readonly clientX: number;
  readonly clientY: number;
  readonly coordinator: HeatmapHoverCoordinator;
  readonly ctx: ReturnType<typeof useHeatmap>;
  readonly interaction: HeatmapRenderSnapshot["interaction"];
  readonly onFocus: (point: ChartPoint<CellDatum, string, string> | null, key: string) => void;
  readonly onLeave: () => void;
  readonly renderContext: HeatmapRenderSnapshot | undefined;
}

// Pointer position -> hover/leave dispatch for the overlay svg listeners.
// Extracted from `handlePointerMove` so the handler stays under the
// Statement limit; the call graph is unchanged.
const dispatchHeatmapPointerHit = ({
  cellData,
  clientX,
  clientY,
  coordinator,
  ctx,
  interaction,
  onFocus,
  onLeave,
  renderContext,
}: Readonly<DispatchHeatmapPointerHitParams>): void => {
  const hit = resolveHeatmapSceneHit({ cellData, clientX, clientY, ctx, interaction });
  if (!hit) {
    onLeave();
    return;
  }
  handleHeatmapCellHover({ coordinator, ctx, hit, onFocus, renderContext });
};

const HeatmapCells = ({
  cornerRadius = 2,
  colorScale: _colorScaleProp,
  inactiveOpacity = HEATMAP_INACTIVE_OPACITY,
  inactiveScale = 1,
  activeScale = 1,
  rowOpacity,
  interactive = true,
  hideGhostCells = true,
}: Readonly<HeatmapCellsProps>) => {

  const ctx = useHeatmap();
  const coordinator = useHeatmapCoordinatorOptional();

  // C2: config published by a sibling <HeatmapTooltip/> (if any) via the
  // Module-scoped registry above — drives both the native tooltip's
  // Enablement and the debounced focus-injection delays below.
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
    () => (hideGhostCells ? resolveHeatmapDisplayRange(ctx.data) : undefined),
    [ctx.data, hideGhostCells],
  );

  const cellData = useMemo(
    () => buildCellData({ columns: ctx.data, dayLabels, displayRange, hideGhost: hideGhostCells }),
    [ctx.data, dayLabels, displayRange, hideGhostCells],
  );

  // Pattern defs live in the overlay svg; ids are useId-scoped so two chart
  // Instances (or a legend swatch) on one page never collide (HM14/HM7).
  const patternIdRaw = useId().replaceAll(":", "");
  const patternIdPrefix = useMemo(
    () => (hasPatternLevelStyles(ctx.levelStyles) ? `hm-${patternIdRaw}` : undefined),
    [patternIdRaw, ctx.levelStyles],
  );

  const definition = useHeatmapChartDefinition({
    activeScale,
    animateCells: ctx.animateCells,
    animationDuration: ctx.animationDuration,
    cellData,
    columnCount: ctx.data.length,
    cornerRadius,
    dayLabels,
    enterStaggerScale: ctx.enterStaggerScale,
    enterTransition: ctx.enterTransition,
    inactiveOpacity,
    inactiveScale,
    innerHeight: ctx.innerHeight,
    innerWidth: ctx.innerWidth,
    margin: { bottom: ctx.margin.bottom, left: ctx.margin.left, right: ctx.margin.right, top: ctx.margin.top },
    patternIdPrefix,
    resolvedLevelStyles: ctx.levelStyles,
    revealEpoch: ctx.revealEpoch,
    rowOpacity,
    tooltipEnabled: tooltipConfig !== null,
  });

  const isLoading = ctx.chartStatus === "loading";
  const cellsInteractive = useMemo(
    () => interactive && !isLoading,
    [interactive, isLoading],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  // C2: captured from the public `onRender` boundary (composed below into
  // `handleRender`) — the app-owned pointer-hover detection below uses this
  // To drive the native tooltip via `setControlledFocus`, mirroring the
  // Sanctioned capture pattern in `./focus-injection.ts` but with
  // `source: 'pointer'` (never 'programmatic', which would trigger C1's
  // Legend-dim mark states).
  const renderContextRef = useRef<Pick<ChartRendererRenderContext<CellDatum, string, string>, "scene" | "interaction"> | undefined>(undefined);
  const focusTimerRef = useRef<number | undefined>(undefined);
  const focusedKeyRef = useRef<string | undefined>(undefined);
  const inputsRef = useRef({ cellData, cellsInteractive, coordinator, ctx, tooltipConfig });
  inputsRef.current = { cellData, cellsInteractive, coordinator, ctx, tooltipConfig };

  // Debounced app -> chart focus bridge. `key` is `${column}-${row}` for a
  // Hovered cell or null for "no cell hovered"; repeated calls with the same
  // Key (e.g. every pointermove within one cell) are no-ops so the timers
  // Below are only (re)armed on an actual enter/leave transition.
  const scheduleFocus = useCallback((point: ChartPoint<CellDatum, string, string> | null, key?: string) => {
    if (focusedKeyRef.current === key) {return;}
    focusedKeyRef.current = key;
    clearFocusTimer(focusTimerRef.current);
    focusTimerRef.current = undefined;
    const interaction = renderContextRef.current?.interaction;
    if (!interaction) {return;}
    focusTimerRef.current = armHeatmapFocusTimer({ interaction, point, tooltipConfig: inputsRef.current.tooltipConfig });
  }, []);

  useEffect(
    () => () => {
      if (focusTimerRef.current !== undefined) {
        globalThis.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = undefined;
      }
    },
    [],
  );

  const handleCellLeave = useCallback(() => {
    coordinator?.setHoveredCell(null);
    coordinator?.setTooltipData(null);
    scheduleFocus(null);
  }, [coordinator, scheduleFocus]);

  // Pointer listeners below only invoke the latest leave — reading it through
  // An effect event keeps the listener subscription stable across
  // Leave-callback identity changes (latest coordinator still observed).
  const handleCellLeaveEvent = useEffectEvent((): void => {
    handleCellLeave();
  });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !cellsInteractive || !coordinator) {return undefined;}

    const handlePointerMove = (event: Readonly<{ clientX: number; clientY: number }>) => {
      const { ctx: c, cellData: cd, cellsInteractive: ci } = inputsRef.current;
      if (!ci) {return;}

      const interaction = renderContextRef.current?.interaction;
      if (!interaction) {return;}
      dispatchHeatmapPointerHit({
        cellData: cd,
        clientX: event.clientX,
        clientY: event.clientY,
        coordinator,
        ctx: c,
        interaction,
        onFocus: scheduleFocus,
        onLeave: handleCellLeaveEvent,
        renderContext: renderContextRef.current,
      });
    };

    const handlePointerLeave = () => {
      handleCellLeaveEvent();
    };

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [cellsInteractive, coordinator, scheduleFocus]);

  // D5: the reveal is now driven entirely by native `motion` on the cell
  // Marks (`cellMotion` above) — `handleRender` only needs to capture the
  // Scene/interaction controller for the pointer-hover -> native-tooltip
  // Bridge (C2). The old imperative WAAPI reveal driver (deferred-reveal.ts's
  // `runDeferredReveal`, the manual `rect[data-ts-key]` query + `.animate()`
  // Loop, and the double-rAF "wait for rects to land" fallback effect below
  // It) is deleted — native motion needs no post-paint retry mechanism.
  const handleRender = useCallback((renderCtx: ChartRendererRenderContext<CellDatum, string, string>) => {
    renderContextRef.current = { interaction: renderCtx.interaction, scene: renderCtx.scene };
  }, []);

  const renderTooltipBody = useCallback((bodyCtx: Readonly<{ points: readonly { readonly datum: Readonly<CellDatum> }[] }>) => {
    const [point] = bodyCtx.points;
    const cfg = tooltipConfig;
    if (!point || !cfg) {return undefined;}
    const d = point.datum as CellDatum;
    return (
      <div
        className={cfg.className ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel"}
        style={{ backgroundColor: cfg.backgroundColor, ...cfg.panelStyle }}
      >
        {renderHeatmapTooltipContent(d, cfg)}
      </div>
    );
  }, [tooltipConfig]);

  return (
    <div ref={containerRef} style={{ position: "relative", zIndex: 1 }}>
      <div style={{ position: "relative" }}>
        <RendererChart
          renderer={chartMotionRenderer<CellDatum, string, string>()}
          className="ts-bkm-heatmap-svg"
          ariaLabel="Heatmap chart"
          definition={definition}
          width={ctx.width}
          height={ctx.height}
          style={{ overflow: "visible" }}
          onRender={handleRender}
          renderTooltipBody={renderTooltipBody}
        />
      </div>
      <svg
        width={ctx.width}
        height={ctx.height}
        aria-hidden="true"
        className="ts-bkm-heatmap-hover-svg"
        style={{ inset: 0, position: "absolute" }}
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
};

interface HeatmapXAxisProps {
  className?: string;
}

// Build the x-axis month labels, one per month transition across columns.
const buildHeatmapXAxisLabels = (
  data: readonly HeatmapColumn[],
): { columnIndex: number; key: string; text: string }[] => {
  let lastMonthKey = "";
  const labels: { columnIndex: number; key: string; text: string }[] = [];
  for (const [columnIndex, column] of data.entries()) {
    const anchor = getHeatmapColumnMonthAnchor(column);
    if (anchor) {
      const monthKey = `${anchor.getFullYear()}-${anchor.getMonth()}`;
      if (monthKey !== lastMonthKey) {
        lastMonthKey = monthKey;
        labels.push({ columnIndex, key: monthKey, text: formatHeatmapMonthShort(anchor) });
      }
    }
  }
  return labels;
};

const HeatmapXAxis = memo(({ className }: Readonly<HeatmapXAxisProps>) => {
  const ctx = useHeatmap();
  if (!ctx.htmlLayerEl) {return undefined;}

  const labels = buildHeatmapXAxisLabels(ctx.data);

  return createPortal(
    <div
      className={className ? `${HEATMAP_AXIS_LAYER_CLASS} ${className}` : HEATMAP_AXIS_LAYER_CLASS}
      style={{ height: ctx.margin.top, left: ctx.margin.left, pointerEvents: "none", position: "absolute", top: 0, width: ctx.innerWidth }}
    >
      {labels.map((label: Readonly<{ columnIndex: number; key: string; text: string }>) => (
        <span
          key={label.key}
          className="ts-bkm-heatmap-axis-label"
          style={{ left: ctx.xScale(label.columnIndex), position: "absolute", top: 0 }}
        >
          {label.text}
        </span>
      ))}
    </div>,
    ctx.htmlLayerEl,
  );
});

HeatmapXAxis.displayName = "HeatmapXAxis";

interface HeatmapYAxisProps {
  className?: string;
  tickFilter?: HeatmapYAxisTickFilter;
  labelFormat?: HeatmapYAxisLabelFormat;
  rowOpacity?: number | readonly number[];
}

const HeatmapYAxis = memo(({
  className,
  tickFilter = "odd",
  labelFormat = "full",
  rowOpacity,
}: Readonly<HeatmapYAxisProps>) => {
  const ctx = useHeatmap();
  const dayLabels = useMemo(() => getHeatmapDayLabels(ctx.weekStartDay), [ctx.weekStartDay]);
  if (!ctx.htmlLayerEl) {return undefined;}

  return createPortal(
    <div
      className={className ? `${HEATMAP_AXIS_LAYER_CLASS} ${className}` : HEATMAP_AXIS_LAYER_CLASS}
      style={{ height: ctx.innerHeight, left: 0, pointerEvents: "none", position: "absolute", top: ctx.margin.top, width: ctx.margin.left }}
    >
      {dayLabels.map((label, row) =>
        shouldShowHeatmapYAxisTick(row, tickFilter) ? (
          <span
            key={label}
            className="ts-bkm-heatmap-axis-label ts-bkm-heatmap-axis-label--y"
            style={{
              opacity: resolveHeatmapRowOpacity(row, rowOpacity),
              position: "absolute",
              right: 4,
              top: ctx.yScale(row) + ctx.binHeight / 2,
            }}
          >
            {formatHeatmapYAxisLabel(label, labelFormat)}
          </span>
        ) : undefined,
      )}
    </div>,
    ctx.htmlLayerEl,
  );
});

HeatmapYAxis.displayName = "HeatmapYAxis";

export { HeatmapSeparator } from "./heatmap-separator";
export type { HeatmapSeparatorProps } from "./heatmap-separator";
export { HeatmapTooltip } from "./heatmap-tooltip-registry";
export type { HeatmapTooltipProps } from "./heatmap-tooltip-registry";
export { HeatmapCells, HeatmapXAxis, HeatmapYAxis };
export type { HeatmapCellsProps, HeatmapXAxisProps, HeatmapYAxisProps };
