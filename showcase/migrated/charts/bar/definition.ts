// Native `defineChart` definition for BarChart: band x, linear y, grouped `barY` marks, crosshair hover (dim is scoped
// CSS, see hover.ts) and per-datum `motion` for bklit's staggered grow-from-baseline entrance.
import { barX, barY, defineChart, group, stack } from "@tanstack/charts";
import type { ChartDefinition, ChartMark, ChartMotionContext, ResolvedScale } from "@tanstack/charts";
import { bklitTooltip } from "../kit/tooltip/bklit-tooltip";
import { tooltipBoxMotion } from "../kit/tooltip/box-motion";
import type { TooltipBoxMotionProps } from "../kit/tooltip/box-motion";
import { mergeTooltipCarriers } from "../kit/tooltip/tooltip-carriers";
import { sizedTooltipPlacement } from "../kit/tooltip/sized-tooltip-placement";
import { scaleBand, scaleLinear } from "d3-scale";
import type { ScaleBand } from "d3-scale";
import { erase } from "../kit/erased-types";
import { bklitYDomain } from "../kit/cartesian/definition";
import { propsFor } from "../kit/read-children";
import { isString } from "../kit/guards";
import { pillLayout } from "../kit/cartesian/date-pill";
import type { HoverOverlayModel } from "../kit/cartesian/hover-overlay";
import { userGradients } from "../kit/gradients";
import type { ChildTable } from "../kit/read-children";
import { gridHostAttrs, gridLineStyle, gridRowGuides } from "../kit/cartesian/grid-guides";
import type { GridGuideProps as GridProps } from "../kit/cartesian/grid-guides";
import { bklitTheme, BKLIT_TOOLTIP_PLACEMENT } from "../kit/theme";
import type { ChartMargin } from "../kit/theme";
import { REVEAL_EASING } from "../kit/motion/easing";
import { STAGGER_SPREAD } from "./easing";
import { enterOrResume } from "./enter-timing";
import type { EnterTiming } from "./enter-timing";
import { buildBarData, DEFAULT_GROUP_GAP, FADED_OPACITY } from "./model";
import type { BarDatum, BarSeries, Row } from "./model";
import type { BarDepthProviderProps, BarXAxisProps, BarYAxisProps } from "./carriers";
import { barEndValues, barOverlayDots, buildExtraMarks, memoBand } from "./marks";
import type { RingDots } from "./marks";
import { barFocusStrategy } from "./focus";
import type { PlotRect } from "./focus";
import { depthBarFor, depthMarksFor, hasDepth } from "./depth-feature";
import { cssAttr } from "./hover";
import type { HoverTarget } from "./hover";
import { keyEnds, keyStarts } from "../kit/renderer-dom";

export interface BarInput {
  readonly data: readonly Row[];
  readonly xKey: string;
  readonly table: ChildTable;
  readonly series: readonly BarSeries[];
  readonly margin: ChartMargin;
  readonly barGap: number;
  readonly animationDuration: number;
  readonly uid: string;
  readonly horizontal: boolean;
  readonly stacked: boolean;
  readonly stackGap: number;
  /** First paint of an entrance: custom marks collapsed, no bars; the build after it runs the reveal. */
  readonly seed: boolean;
  /** Entrance clock shared by the custom marks across the seed and full builds. */
  readonly clock: { at: number | null };
  /** The data changed after the first paint: bklit snaps the guides too (ticks and grid lines neither fade in nor out). */
  readonly updated?: boolean;
  /** bklit `status="loading"` (bar-chart.tsx:654-665): grid and axes stay, bars / squares / depth / tooltip guides are not drawn (the skeleton replaces them). */
  readonly loading?: boolean;
  /** Plot rect read lazily at pointer time (gates hover to the plot and sets bklit's column hit zones). */
  readonly plot?: () => PlotRect;
}

const GUIDE_ROLES: ReadonlySet<string> = new Set(["axis", "axis-label", "grid", "tick", "tick-label"]);
const CROSSHAIR_COLOR = "var(--chart-crosshair)";

type Scales = Readonly<Record<string, ResolvedScale>>;

type BandRange = (r?: [number, number]) => [number, number] | ScaleBand<string>;
type BandDomain = (d?: string[]) => string[] | ScaleBand<string>;

/** d3 band whose group slots are `gap` apart with outer edges flush (bklit: `(W - gap*(n-1)) / n` wide bars). */
function gapBand(gap: number): () => ScaleBand<string> {
  const make = (domain: string[], initial: [number, number]): ScaleBand<string> => {
    const band = scaleBand().paddingOuter(0).align(0);
    const fit = (): void => {
      const n = Math.max(1, band.domain().length);
      const [a, b] = band.range();
      const w = (Math.abs(b - a) - gap * (n - 1)) / n;
      band.paddingInner(w > 0 ? gap / (w + gap) : 0);
    };
    // SAFETY: d3's overloaded getters/setters bind to their `range(r)` / `domain(d)` call signatures.
    const range0 = band.range.bind(band) as BandRange;
    // SAFETY: as above, for `domain`.
    const domain0 = band.domain.bind(band) as BandDomain;
    // d3 scales are plain objects; the wrappers refit the padding whenever the range or domain is set.
    const range: BandRange = (r) => {
      if (r === undefined) {
        return range0();
      }
      range0(r);
      fit();
      return band;
    };
    const domainFn: BandDomain = (d) => {
      if (d === undefined) {
        return domain0();
      }
      domain0(d);
      fit();
      return band;
    };
    Reflect.set(band, "range", range);
    Reflect.set(band, "domain", domainFn);
    Reflect.set(band, "copy", () => make(band.domain(), band.range()));
    domain0(domain);
    range0(initial);
    fit();
    return band;
  };
  return () => make([], [0, 1]);
}

export interface BarDefinition {
  readonly definition: ChartDefinition<BarDatum, string, number>;
  readonly tooltipEnabled: boolean;
  /** The hover indicator (null without a Tooltip), placed by the host's HoverOverlay. */
  readonly overlay: HoverOverlayModel | null;
  /** Resolved value-axis domain (y when vertical, x when horizontal). */
  readonly valueDomain: readonly [number, number];
  /** Hover dim targets, rendered as focus-keyed CSS by `barHoverCss`. */
  readonly hover: readonly HoverTarget[];
  /** Position of each category's tick label among the drawn labels (-1: not drawn). */
  readonly tickPositions: readonly number[];
  /** Host attributes for the static grid edge-fade rules (styles.css). */
  readonly gridAttrs: Record<string, string | undefined>;
}

// gap #36: native barY rects take no className, so hover selects them by key.
const barKeySelector = (index: number, key: string): string => keyEnds(`:${index}:${cssAttr(key)}`);

type BarMarkList = ChartMark<BarDatum, string, number>[];
type BarMode = Pick<BarInput, "horizontal" | "stacked" | "stackGap">;

// bklit rounds every bar when grouped; stacked rounds only the outer segment unless a stackGap separates them.
function barRadius(round: boolean, { stacked, stackGap }: BarMode): number | { end: () => number; stack: string } {
  if (!round) {
    return 0;
  }
  return stacked ? { end: (): number => 8, stack: stackGap > 0 ? "each" : "outer" } : 8;
}

// gap #36: native barY rects take no className or per-datum hover hook, so hover/legend select them by key (`bars:<index>:<series>`).
function barHoverTargets(barSeries: readonly BarSeries[], faded: number): HoverTarget[] {
  const perSeries = barSeries.map(
    (s): HoverTarget => ({ select: `${keyStarts("bars:")}${keyEnds(`:${cssAttr(s.key)}`)}:not(g)`, keep: null, dim: faded, seriesIndex: s.index, legendOnly: true }),
  );
  return [
    ...perSeries,
    {
      select: `${keyStarts("bars:")}:not(g)`,
      keep: (index) => `:is(${barSeries.map((s) => barKeySelector(index, s.key)).join(",")})`,
      dim: faded,
    },
  ];
}

interface BarMarksContext {
  readonly datums: readonly BarDatum[];
  readonly categories: readonly string[];
  readonly barSeries: readonly BarSeries[];
  readonly fillFor: (key: string) => string;
  readonly enter: (ctx: ChartMotionContext<BarDatum>) => EnterTiming | undefined;
  readonly depthOn: boolean;
  readonly round: boolean;
  readonly groupGap: number;
  readonly faded: number;
}

interface BarSeriesMarks {
  readonly marks: BarMarkList;
  readonly hover: HoverTarget[];
}

function barSeriesMarks(input: BarInput, ctx: BarMarksContext): BarSeriesMarks {
  const { datums, categories, barSeries, fillFor, depthOn } = ctx;
  const { table, series, animationDuration, horizontal, stacked, stackGap } = input;
  const keys = new Set(barSeries.map((s) => s.key));
  // bklit trims the front face by the perspective rise whenever depth is on (the lid sits above it): a custom mark draws it.
  if (depthOn) {
    const provider = propsFor<BarDepthProviderProps>(table, "barDepthProvider").at(0);
    const depthBar = depthBarFor({ datums, series, categories, minBar: provider?.minBarHeight ?? 0, animationDuration, seed: input.seed, clock: input.clock, fill: fillFor });
    return { marks: depthBar ? [depthBar] : [], hover: barHoverTargets(barSeries, ctx.faded) };
  }
  // The seeded first paint renders no bars so they ENTER on the next build.
  const barData = input.seed ? [] : datums.filter((d) => keys.has(d.series));
  const groupLayout = barSeries.length < 2 ? group({ padding: 0 }) : group({ scale: erase(gapBand(ctx.groupGap)) });
  const stackStroke = stacked && stackGap > 0 ? { stroke: "var(--chart-background)", strokeWidth: stackGap } : undefined;
  const options = {
    id: "bars",
    z: (d: BarDatum): string => d.series,
    color: (d: BarDatum): string => d.series,
    key: (d: BarDatum): string => `${d.index}:${d.series}`,
    fill: (d: BarDatum): string => fillFor(d.series),
    layout: stacked ? stack() : groupLayout,
    inset: 0,
    radius: barRadius(ctx.round, { stacked, stackGap, horizontal }),
    motion: ctx.enter,
    ...stackStroke,
  };
  const mark = horizontal
    ? barX(barData, erase({ ...options, x: (d: BarDatum): number => d.value, y: (d: BarDatum): string => d.category }))
    : barY(barData, erase({ ...options, x: (d: BarDatum): string => d.category, y: (d: BarDatum): number => d.value }));
  return { marks: [erase(mark)], hover: barHoverTargets(barSeries, ctx.faded) };
}

// bklit: vertical bars get a rolling date pill, a fade rule at the band centre and a dot on every bar end;
// horizontal bars only a fade rule at the end of the focused category's longest bar (no pill, no dots).
/** The ChartTooltip props the bar guides and panel read. */
interface BarTooltipProps extends TooltipBoxMotionProps {
  readonly dotVariant?: "dot" | "ring";
  readonly dotSize?: number;
  readonly dotScale?: number;
  readonly dotRadiusFraction?: number;
  readonly dotStrokeWidth?: number;
  readonly dotColor?: unknown;
  readonly showCrosshair?: boolean;
  readonly showDots?: boolean;
}

function ringOf(tip: BarTooltipProps | undefined, seriesCount: number, squareGroupGap: number | undefined): RingDots | undefined {
  if (tip?.dotVariant !== "ring") {
    return undefined;
  }
  const color = isString(tip.dotColor) ? tip.dotColor : undefined;
  return { fraction: tip.dotRadiusFraction ?? 0.25, scale: tip.dotScale ?? 1, size: tip.dotSize ?? 5, slotGap: squareGroupGap ?? (seriesCount > 1 ? 4 : 0), strokeWidth: tip.dotStrokeWidth ?? 2, color };
}

/** The hover indicator for the HoverOverlay the host owns (kit/cartesian/hover-overlay.ts): the rule, and for vertical bars the date pill and a dot on every bar end. Keys are category indexes. */
function tooltipOverlay(input: BarInput, datums: readonly BarDatum[], categories: readonly string[], groupGap: number, domain: readonly [number, number], tip: BarTooltipProps | undefined): HoverOverlayModel {
  const { horizontal, stacked, stackGap, series } = input;
  const crosshair = tip?.showCrosshair !== false ? { color: CROSSHAIR_COLOR, dash: undefined, width: 1 } : null;
  if (horizontal) {
    const ends = barEndValues(datums, stacked);
    return {
      crosshair,
      dots: [],
      indexOf: (index) => index,
      pill: null,
      xOf: (index, plot) => (((ends.get(categories[index] ?? "") ?? Number.NaN) - domain[0]) / (domain[1] - domain[0] || 1)) * plot.innerWidth,
    };
  }
  const squares = new Map(
    series.flatMap((s) =>
      s.squares ? [[s.key, { gap: s.squares.squareGap ?? 3, fit: s.squares.squareFit ?? false, groupGap: s.squares.groupGap ?? 4 }] as const] : [],
    ),
  );
  const bandFor = memoBand(categories, input.barGap);
  return {
    crosshair,
    dots: tip?.showDots !== false
      ? barOverlayDots({ datums, series, categories, barGap: input.barGap, groupGap, stacked, stackGap, squares, ring: ringOf(tip, series.length, [...squares.values()].at(0)?.groupGap) })
      : [],
    indexOf: (index) => index,
    pill: { labels: categories, layout: pillLayout(categories) },
    xOf: (index, plot) => bandFor(plot.innerWidth).centre(categories[index] ?? ""),
  };
}

// bklit bar-x-axis.tsx:91-93 / bar-y-axis.tsx:79-80: category labels thin to every ceil(n / maxLabels)-th unless showAllLabels.
function thinnedLabels(labelAxis: BarXAxisProps | BarYAxisProps | undefined, horizontal: boolean, categories: readonly string[]): string[] | undefined {
  const showAllLabels = labelAxis?.showAllLabels ?? horizontal;
  const maxLabels = labelAxis?.maxLabels ?? (horizontal ? 20 : 12);
  if (!labelAxis || showAllLabels || categories.length <= maxLabels) {
    return undefined;
  }
  return categories.filter((_, i) => i % Math.ceil(categories.length / maxLabels) === 0);
}

type BarFocus = ReturnType<typeof barFocusStrategy> | "group-x" | "group-y";

function barFocus(input: BarInput, categories: readonly string[]): BarFocus {
  const { horizontal, plot } = input;
  if (plot) {
    return barFocusStrategy({ categories, horizontal, plot });
  }
  return horizontal ? "group-y" : "group-x";
}

function yFormatter(yAxis: BarYAxisProps | undefined): (v: number) => string {
  const large = yAxis?.formatLargeNumbers !== false;
  return (v) => {
    if (yAxis?.formatValue) {
      return yAxis.formatValue(v);
    }
    return large && Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
  };
}

// Clock of the first bar entrance: a render forced mid-entrance (web-font swap after a hydrated mount) arrives as an "update".
function barEnter(input: BarInput): (ctx: ChartMotionContext<BarDatum>) => EnterTiming | undefined {
  const { animationDuration, series } = input;
  const seriesCount = Math.max(1, series.length);
  const stagger = (animationDuration * STAGGER_SPREAD) / Math.max(1, input.data.length);
  const enter = (ctx: ChartMotionContext<BarDatum>): EnterTiming | undefined => {
    const plan = { delay: Math.floor(ctx.datumIndex / seriesCount) * stagger, duration: animationDuration, easing: REVEAL_EASING };
    // Loading -> ready arrives as an update from collapsed bars, with the clock reset, so it grows them too (bklit revealEpoch, bar-chart.tsx:372-386).
    // Later data updates snap (clock spent); one forced inside the entrance window resumes the schedule.
    if (input.loading === true) { return false; }
    return ctx.phase === "exit" ? undefined : enterOrResume(input.clock, ctx.phase, plan);
  };
  return enter;
}

interface ScaleSpec {
  readonly [key: string]: unknown;
}

function categoryScaleSpec(input: BarInput, categories: readonly string[], axis: BarXAxisProps | BarYAxisProps | undefined, tickValues: string[] | undefined): ScaleSpec {
  const { horizontal } = input;
  const padding = horizontal ? 8 : 14.4;
  // bklit bar-x-axis.tsx:91-107 only thins by maxLabels, never by collision: `thin: false` below keeps overlapping labels like bklit.
  const ticks = tickValues === undefined ? { size: 0, padding } : { values: tickValues, size: 0, padding };
  return {
    scale: scaleBand().domain(categories).padding(input.barGap),
    grid: false,
    axis: axis === undefined ? false : { line: false, ticks, tickLabels: { fontSize: 12, opacity: horizontal ? 0.7 : 1, thin: false } },
  };
}

function valueScaleSpec(input: BarInput, domain: readonly [number, number], grid: GridProps | undefined, yAxis: BarYAxisProps | undefined, rowGuides: ReturnType<typeof gridRowGuides> | undefined): ScaleSpec {
  const gridEnabled = grid !== undefined && (rowGuides ? rowGuides.native : grid.vertical !== false);
  const tickCount = rowGuides?.count ?? yAxis?.numTicks ?? grid?.numTicksRows ?? 5;
  return {
    scale: scaleLinear().domain(domain),
    grid: gridEnabled ? gridLineStyle(grid) : false,
    axis: input.horizontal ? false : {
      line: false,
      ticks: { count: tickCount, size: 0, format: yFormatter(yAxis) },
      // bklit y-axis.tsx:106-142 draws every scale tick, no collision test.
      tickLabels: yAxis === undefined ? false : { fontSize: 12, opacity: 1, thin: false },
    },
  };
}

// Horizontal: the native placement without the per-paint size read (gap #21, kit/tooltip/sized-tooltip-placement.ts).
function tooltipPlacement(horizontal: boolean): object {
  return horizontal ? { anchor: { x: "point", y: "point" }, placement: ["right", "left"], offset: 16, portal: sizedTooltipPlacement() } : BKLIT_TOOLTIP_PLACEMENT;
}

// bklit snaps every bar on a data change, and the guides too once the data has updated.
const snapsOnUpdate = (input: BarInput, context: ChartMotionContext<BarDatum>): boolean => context.phase === "update" || (input.updated === true && GUIDE_ROLES.has(context.role));

export function buildBarDefinition(input: BarInput): BarDefinition {
  const { data, xKey, table, series, horizontal, stacked } = input;
  const loading = input.loading === true;
  const tooltipProps = mergeTooltipCarriers(propsFor<BarTooltipProps>(table, "tooltip").at(0), table);
  const tooltipEnabled = !loading && tooltipProps !== undefined;
  const boxMotion = tooltipBoxMotion(tooltipProps);
  const showRule = tooltipEnabled && tooltipProps.showCrosshair !== false;
  const grid = propsFor<GridProps>(table, "grid").at(0);
  const xAxis = propsFor<BarXAxisProps>(table, "barXAxis").at(0);
  const yAxis = propsFor<BarYAxisProps>(table, "barYAxis").at(0);

  const categories = data.map((row) => String(row[xKey]));
  const datums = buildBarData(data, xKey, series);
  const barSeries = series.filter((s) => s.kind === "bar");
  const fillOf = new Map(series.map((s) => [s.key, s.fill] as const));
  const groupGap = barSeries[0]?.bar?.groupGap ?? DEFAULT_GROUP_GAP;
  const faded = barSeries[0]?.bar?.fadedOpacity ?? FADED_OPACITY;
  const depthOn = hasDepth(table) && !horizontal && !stacked;
  const round = !depthOn && barSeries.every((s) => s.bar?.lineCap !== "butt");
  const fillFor = (key: string): string => fillOf.get(key) ?? "var(--chart-line-primary)";

  // UPSTREAM-GAPS #12 (addendum): a group joining on an update only fades, so the bars stay present at value 0 while loading.
  // Loading keeps the bar marks collapsed to zero (grid, axes and scales stay) so the flip to ready is an update that grows them.
  const own = barSeries.length > 0 ? barSeriesMarks(input, { datums: loading ? datums.map((d) => ({ ...d, value: 0 })) : datums, categories, barSeries, fillFor, enter: barEnter(input), depthOn, round, groupGap, faded }) : { marks: [], hover: [] };
  const extra = horizontal || loading ? undefined : buildExtraMarks({ datums, series, table, categories, animationDuration: input.animationDuration, faded, uid: input.uid, seed: input.seed, clock: input.clock });
  const depth = horizontal || loading ? undefined : depthMarksFor({ table, datums, series, categories, animationDuration: input.animationDuration, groupGap, uid: input.uid, faded, seed: input.seed, clock: input.clock });
  const marks: BarMarkList = [...own.marks, ...(extra?.marks ?? []), ...(depth?.marks ?? [])];
  // bklit dims every bar outside the hovered category (see hover.ts: scoped CSS, not native states).
  const hover: HoverTarget[] = [...own.hover, ...(extra?.hover ?? []), ...(depth?.hover ?? [])];

  const yValues = stacked
    ? categories.map((c) => datums.filter((d) => d.category === c && Number.isFinite(d.value)).reduce((sum, d) => sum + d.value, 0))
    : datums.map((d) => d.value);
  const domain = bklitYDomain(yValues);
  // Vertical bars: bklit's Grid rows (own tick set, edge lines, highlight rows) sit under the bars; the value scale is y.
  const rowGuides = horizontal ? undefined : gridRowGuides(grid, scaleLinear().domain(domain), yAxis !== undefined, yAxis?.numTicks);
  if (rowGuides) {
    marks.unshift(...rowGuides.marks);
  }
  const overlay = tooltipEnabled ? tooltipOverlay(input, datums, categories, groupGap, domain, tooltipProps) : null;

  const categoryAxis = horizontal ? yAxis : xAxis;
  const tickValues = thinnedLabels(categoryAxis, horizontal, categories);

  const categoryScale = categoryScaleSpec(input, categories, categoryAxis, tickValues);
  const valueScale = valueScaleSpec(input, domain, grid, yAxis, rowGuides);
  const spec = erase({
    marks,
    scales: { [horizontal ? "y" : "x"]: categoryScale, [horizontal ? "x" : "y"]: valueScale },
    margin: input.margin,
    gradients: [...(depth?.gradients ?? []), ...userGradients(table)],
    // Loading swaps instantly both ways (bklit renders the skeleton in place of the bars, no exit); the grow reveal plays on the flip back.
    motion: (context: ChartMotionContext<BarDatum>) => (loading || snapsOnUpdate(input, context) ? false : undefined),
    theme: bklitTheme,
    focus: tooltipEnabled ? barFocus(input, categories) : undefined,
    maxFocusDistance: Number.POSITIVE_INFINITY,
    focusRing: false,
    // Horizontal: the native placement without the per-paint size read (gap #21, kit/tooltip/sized-tooltip-placement.ts).
    tooltip: tooltipEnabled ? { use: bklitTooltip, ...tooltipPlacement(horizontal), sticky: false, motion: boxMotion } : false,
  });
  const definition: ChartDefinition<BarDatum, string, number> = erase(defineChart(spec));

  const tickPositions = categories.map((c, i) => (tickValues === undefined ? i : tickValues.indexOf(c)));
  return { definition, tooltipEnabled, overlay, valueDomain: domain, hover, tickPositions, gridAttrs: gridHostAttrs(grid) };
}
