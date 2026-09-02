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
import { RendererChart } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts/scene";
import { cell } from "@tanstack/charts/rect";
import { tooltip } from "@tanstack/charts/tooltip";
import type {
  ChartMarkState,
  ChartMotionContext,
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
  resolveHeatmapDisplayRange,
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

// C3: base cell inset (bklit's hover pop scales the cell's wrapper `motion.g`
// from a `transform-box: fill-box` / center origin — see `heatmapHoverInset`
// below for the native-`inset` equivalent of that CSS `transform: scale()`).
const HEATMAP_CELL_INSET = 1;

// C3: native mark-state transition for the hover highlight/dim. Duration
// matches `HEATMAP_INACTIVE_TRANSITION_CSS`'s 220ms exactly; `easing` is an
// APPROXIMATION — `ChartMotionTweenTransition.easing` only accepts the named
// keywords `'linear'|'ease'|'ease-in'|'ease-out'|'ease-in-out'` or a custom
// `(progress:number)=>number` function (dist/types.d.ts `ChartAnimationOptions`),
// never a raw `cubic-bezier()` string — so the legacy
// `cubic-bezier(0.4, 0, 0.2, 1)` (Material "standard" ease) cannot be
// reproduced byte-for-byte. `"ease-in-out"` is used for consistency with
// every other migrated chart's `ChartMarkState` transitions (e.g.
// bar-chart.tsx's `BAR_DIM_TRANSITION`/`BAR_TRACK_DIM_TRANSITION`), which all
// use named keywords rather than a custom bezier evaluator.
const HEATMAP_HOVER_TRANSITION: NonNullable<ChartMarkState["transition"]> = {
  type: "tween",
  duration: 220,
  easing: "ease-in-out",
};

// Native-`inset` emulation of bklit's `transform: scale(scale)` (center-
// origin, `fill-box`) hover pop/dim. `dist/mark-state.js`'s rect branch
// treats a state's `inset` as an ABSOLUTE target (not a delta): it shrinks/
// grows the rect symmetrically about its existing center by
// `amount = nextInset - currentInset` on both x and y (no `insetAxis` is set
// for a plain `cell()`/`rect()` mark, so both axes move equally) — exactly
// reproducing a centered CSS scale for the base inset's content box.
function heatmapHoverInset(bandwidth: number, scale: number, baseInset: number): number {
  if (scale === 1) return baseInset;
  const contentSize = Math.max(0, bandwidth - baseInset * 2);
  return Math.max(0, (bandwidth - contentSize * scale) / 2);
}

// bklit `resolveHeatmapHoverStyle` parity, reimplemented as native mark
// `states` (dist/rect.d.ts: `states?: readonly ChartMarkState<TDatum,
// ChartRectStateStyle<TDatum>>[]`) instead of imperative DOM writes.
// `states` are entirely skipped by the engine when there is no active focus
// (dist/mark-state.js: `resolveMarkStateScene` -> `if (!focus ...) return
// {scene}`), so this needs no separate "is anything hovered" gate — it's a
// no-op exactly when nothing is focused, matching legacy's "no highlight
// without a hovered cell" behavior for free. Each predicate also requires
// `focus.source === "pointer"` so this only reacts to the app's own
// `scheduleFocus` bridge (never keyboard/programmatic focus — legacy cell
// styling was ONLY ever driven by pointer hover, never keyboard nav), and
// `!datum.isGhost` so ghost cells are never highlighted OR dimmed (bklit
// parity — legacy `paintCellStyles` applied the same `!d.isGhost` guard to
// both branches).
function heatmapHoverStates(
  bandwidth: number,
  baseInset: number,
  inactiveOpacity: number,
  inactiveScale: number,
  activeScale: number,
): ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] | undefined {
  const states: ChartMarkState<CellDatum, ChartRectStateStyle<CellDatum>>[] = [];
  if (activeScale !== 1) {
    states.push({
      when: (context) =>
        context.focus.source === "pointer" && !context.datum.isGhost && context.matches("primary"),
      style: { inset: heatmapHoverInset(bandwidth, activeScale, baseInset) },
      transition: HEATMAP_HOVER_TRANSITION,
    });
  }
  if (inactiveOpacity !== 1 || inactiveScale !== 1) {
    states.push({
      when: (context) =>
        context.focus.source === "pointer" && !context.datum.isGhost && !context.matches("primary"),
      style: {
        opacity: inactiveOpacity,
        ...(inactiveScale !== 1 ? { inset: heatmapHoverInset(bandwidth, inactiveScale, baseInset) } : {}),
      },
      transition: HEATMAP_HOVER_TRANSITION,
    });
  }
  // Empty array -> `undefined` so the mark carries no `states` at all when
  // hover styling is fully disabled (every prop === 1), matching legacy's
  // "nothing to dim/highlight, cells stay visually untouched" exactly and
  // letting `sceneHasMarkStates` skip the mark entirely (dist/mark-state.js).
  return states.length > 0 ? states : undefined;
}

// D5: local cubic-bezier progress-function solver — `ChartAnimationOptions`'s
// `easing` field (dist/types.d.ts) only accepts the named keywords or a
// custom `(progress:number)=>number`, never a raw `cubic-bezier()` string
// (same constraint already documented above HEATMAP_HOVER_TRANSITION), so
// `HeatmapEnterTransition.ease`'s 4-tuple control points (bklit parity, e.g.
// HEATMAP_DEFAULT_ENTER_EASE = [0.85, 0, 0.916, 0.282], heatmap-animation.ts:17)
// need converting to a progress function for the native per-cell `motion`
// transition below. Newton-Raphson on the bezier's x(t) (5 iterations is
// more than enough at this curve's slope) to find t for a given x=p, then
// evaluates y(t).
function solveCubicBezierEasing(points: readonly [number, number, number, number]): (p: number) => number {
  const [x1, y1, x2, y2] = points;
  const bx = (t: number) => 3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
  const by = (t: number) => 3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 6; i++) {
      const err = bx(t) - p;
      if (Math.abs(err) < 1e-5) break;
      const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * t * (1 - t) * (x2 - x1) + 3 * t * t * (1 - x2);
      if (dx === 0) break;
      t -= err / dx;
    }
    return by(t);
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
  inactiveOpacity: number,
  inactiveScale: number,
  activeScale: number,
  rowOpacity: number | readonly number[] | undefined,
  revealEpoch: number,
  animationDuration: number,
  enterTransition: HeatmapEnterTransition | undefined,
  enterStaggerScale: number,
  animateCells: boolean,
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

  // C3: hover highlight/dim as native mark `states`, keyed on the engine's
  // OWN focus resolution (driven by `scheduleFocus` -> `setControlledFocus`
  // below) rather than React state — the chart definition never needs to
  // rebuild when the hovered cell changes, only when these style PROPS
  // change (bandwidth/inactiveOpacity/inactiveScale/activeScale), which is
  // the "cheaper channel-level route" flagged in the mission's performance
  // note: zero definition rebuilds per hovered cell.
  const hoverStates = useMemo(
    () => heatmapHoverStates(xScale.bandwidth(), HEATMAP_CELL_INSET, inactiveOpacity, inactiveScale, activeScale),
    [xScale, inactiveOpacity, inactiveScale, activeScale],
  );

  // bklit `resolveHeatmapRowOpacity` x `heatmapLevelCellFillOpacity` parity:
  // legacy applied this product as each cell rect's OWN (non-hover-driven)
  // `fillOpacity`, independent of and layered under the hover dim. Rect/cell
  // marks only take a single SCALAR `fillOpacity` per mark instance (not a
  // per-datum channel — dist/rect.d.ts), so cells are bucketed into one
  // `cell()` mark per distinct resolved value. Buckets are keyed by data
  // (row/level), never by hover, so membership — and therefore each cell's
  // owning mark/DOM element identity — never changes on hover, preserving
  // smooth `states` transitions (no remount/snap). In the common case
  // (uniform rowOpacity, solid levelStyles) this collapses to exactly one
  // bucket, i.e. one mark, matching the pre-C3 shape.
  // D5: per-cell enter-fade reveal, expressed via `cell()`'s native `motion`
  // option (dist/types.d.ts:449, `ChartMarkMotionOptions`) instead of the old
  // imperative WAAPI driver (deferred-reveal.ts, now unused here). The
  // per-cell delay math is byte-for-byte the seeded-PRNG formula already
  // ported verbatim in heatmap-animation.ts (`computeHeatmapEnterFadeDelayMs`,
  // :73-80 — `seed = heatmapCellSeed(column,row) + revealEpoch*524_287`) —
  // `revealEpoch` is captured by closure below exactly as that formula
  // requires (coordinator correction 2). Only `opacity` is animated
  // (`motionAttributes` allowlist confirms opacity is in; legacy's reveal
  // was itself opacity-only per prior confirmation), so this is a pure
  // 1:1 native substitution — no reach-in needed for T1-parity-tier heatmap.
  //
  // Trade-off (disclosed, no QA possible per rules): folding `revealEpoch`
  // into `key()` forces every cell's mark identity (and DOM node) to change
  // on every epoch bump so the native motion engine re-runs the 'enter'
  // phase — matching legacy's "re-run the whole reveal on data refresh"
  // behavior. `heatmap-lifecycle.ts`'s `revealEpoch` bumps both on
  // loading->ready AND on a mount-time effect that fires on initial mount
  // too, so mount already goes through key `...:0` -> (if the mount effect
  // also bumps) `...:1`, i.e. an unmount/remount of every cell's mark within
  // the same paint pass this file cannot single-step through without a
  // browser (no-QA rule) — flagged here rather than silently assumed benign.
  const cellMotion = useMemo<ChartMotionDefinition<CellDatum> | false>(() => {
    if (!animateCells || animationDuration <= 0) return false;
    const fadeDurationSec = resolveHeatmapEnterFadeDurationSec(enterTransition, animationDuration);
    const durMs = fadeDurationSec * 1000;
    const easingFn = solveCubicBezierEasing(enterTransition?.ease ?? HEATMAP_DEFAULT_ENTER_EASE);
    return (motionCtx: ChartMotionContext<CellDatum>) => {
      if (motionCtx.phase !== "enter") return false;
      const d = motionCtx.datum;
      if (!d) return undefined;
      return {
        delay: computeHeatmapEnterFadeDelayMs({
          column: d.column,
          row: d.row,
          revealEpoch,
          animationDurationMs: animationDuration,
          enterStaggerScale,
          fadeDurationSec,
        }),
        transition: { type: "tween", duration: durMs, easing: easingFn },
      };
    };
  }, [animateCells, animationDuration, enterTransition, enterStaggerScale, revealEpoch]);

  const cellMarks = useMemo(() => {
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
    return Array.from(buckets.entries()).map(([fillOpacity, data]) =>
      cell(data, {
        id: `heatmap-cell-fo-${fillOpacity}`,
        x: (d: CellDatum) => d.colKey,
        y: (d: CellDatum) => d.rowKey,
        z: (d: CellDatum) => d.level,
        // D5: epoch-suffixed so a revealEpoch bump re-triggers the 'enter'
        // motion phase (matching legacy's "reveal replays on refresh") — see
        // the mount-flash trade-off note on `cellMotion` above.
        key: (d: CellDatum) => `${d.column}-${d.row}:${revealEpoch}`,
        inset: HEATMAP_CELL_INSET,
        radius: cornerRadius,
        fillOpacity,
        states: hoverStates,
        motion: cellMotion,
      }),
    );
  }, [cellData, resolvedLevelStyles, rowOpacity, cornerRadius, hoverStates, cellMotion, revealEpoch]);

  const ctxForDef = useHeatmap();
  const definition = useMemo(() => {
    if (ctxForDef.chartStatus === "loading") {
      return defineChart({
        // D1: typed off `cellMarks` (not the generic-erased `ReturnType<typeof
        // cell>[]` this used pre-C5) so this branch's `TDatum` matches the
        // loaded branch below exactly — `RendererChart`'s strict generic
        // inference against `chartMotionRenderer<CellDatum, string,
        // string>()` (unlike legacy `Chart`) requires both branches' marks
        // arrays to share the same concrete `CellDatum` element type.
        marks: [] as unknown as typeof cellMarks,
        scales: {
          x: { scale: xScale, guide: false, axis: false },
          y: { scale: yScale, guide: false, axis: false },
        },
        color: { scale: colorScale },
        margin,
        // D1/D5: `svgAnimation` (dist/types.d.ts `ChartDefinitionOptions`) is
        // only consumed by the static SVG renderer (dist/renderer.js:125,
        // `hasRendered ? resolveAnimation(options.definition.svgAnimation,
        // ...) : void 0`) — dead/inert once this chart is switched to
        // `chartMotionRenderer()` below. Left as `false` (harmless,
        // unchanged) rather than removed, since it isn't in D5's edit scope.
        svgAnimation: false,
        // C2: no marks to focus while loading; suppress the native focus
        // ring for symmetry with the loaded branch below.
        focusRing: false,
      });
    }
    return defineChart({
      marks: cellMarks,
      scales: {
        x: { scale: xScale, guide: false, axis: false },
        y: { scale: yScale, guide: false, axis: false },
      },
      color: { scale: colorScale },
      margin,
      svgAnimation: false,
      // C2: hover is driven by app-owned pointermove -> setControlledFocus
      // (below), which now actually engages the native focus/tooltip
      // engine. Suppress the default focus-ring mark — bklit's cell hover
      // affordance is the scale/opacity/fillOpacity `states` styling above,
      // not a ring — matching every other migrated chart's
      // `focusRing: false` convention (styles.css:271-280).
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
  }, [cellMarks, xScale, yScale, colorScale, margin, ctxForDef.chartStatus, tooltipEnabled]);

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
    inactiveOpacity,
    inactiveScale,
    activeScale,
    rowOpacity,
    ctx.revealEpoch,
    ctx.animationDuration,
    ctx.enterTransition,
    ctx.enterStaggerScale,
    ctx.animateCells,
  );

  const isLoading = ctx.chartStatus === "loading";
  const cellsInteractive = useMemo(
    () => interactive && !isLoading,
    [interactive, isLoading],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  // C2: captured from the public `onRender` boundary (composed below into
  // `handleRender`) — the app-owned pointer-hover detection below uses this
  // to drive the native tooltip via `setControlledFocus`, mirroring the
  // sanctioned capture pattern in `./focus-injection.ts` but with
  // `source: 'pointer'` (never 'programmatic', which would trigger C1's
  // legend-dim mark states).
  const renderContextRef = useRef<Pick<ChartRendererRenderContext<CellDatum, string, string>, "scene" | "interaction"> | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const focusedKeyRef = useRef<string | null>(null);
  const inputsRef = useRef({ ctx, coordinator, cellsInteractive, cellData, tooltipConfig });
  inputsRef.current = { ctx, coordinator, cellsInteractive, cellData, tooltipConfig };

  // Debounced app -> chart focus bridge. `key` is `${column}-${row}` for a
  // hovered cell or null for "no cell hovered"; repeated calls with the same
  // key (e.g. every pointermove within one cell) are no-ops so the timers
  // below are only (re)armed on an actual enter/leave transition.
  const scheduleFocus = useCallback((point: ChartPoint<CellDatum, string, string> | null, key: string | null) => {
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

      // C3: `clientToScene` (dist/dom-types.d.ts:33) is the documented
      // controller API for client->chart coordinate conversion, replacing a
      // DOM `querySelector` + `getBoundingClientRect` reach-in into the
      // renderer's own SVG. It returns MARGIN-INCLUSIVE "scene" coordinates —
      // the same space `xScale`/`yScale` operate in inside `defineChart`
      // (dist/svg-coordinates.js's `svgClientToScene`, verified against
      // `heatmap-context.ts`/`heatmap-chart.tsx`'s plot-local `xScale`/
      // `yScale`, which are `column*binWidth + offset` from 0) — so the
      // existing plot-local column/row math below still needs the same
      // `- c.margin.left` / `- c.margin.top` subtraction as before.
      const interaction = renderContextRef.current?.interaction;
      if (!interaction) return;
      const scenePos = interaction.clientToScene(event.clientX, event.clientY);
      if (!scenePos) {
        handleCellLeave();
        return;
      }
      const posX = scenePos.x - c.margin.left;
      const posY = scenePos.y - c.margin.top;

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

  // D5: the reveal is now driven entirely by native `motion` on the cell
  // marks (`cellMotion` above) — `handleRender` only needs to capture the
  // scene/interaction controller for the pointer-hover -> native-tooltip
  // bridge (C2). The old imperative WAAPI reveal driver (deferred-reveal.ts's
  // `runDeferredReveal`, the manual `rect[data-ts-key]` query + `.animate()`
  // loop, and the double-rAF "wait for rects to land" fallback effect below
  // it) is deleted — native motion needs no post-paint retry mechanism.
  const handleRender = useCallback((renderCtx: ChartRendererRenderContext<CellDatum, string, string>) => {
    renderContextRef.current = { scene: renderCtx.scene, interaction: renderCtx.interaction };
  }, []);

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
