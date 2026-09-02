// Phase 6.4 (H7) — shared native tooltip-extension config + panel-wrapper
// body builders, factored out of the seven near-identical inline copies in
// line-chart.tsx, area-chart.tsx, composed-chart.tsx, live-line-chart.tsx,
// bar-chart.tsx, candlestick-chart.tsx and scatter-chart.tsx.
import type { CSSProperties, ReactNode } from "react";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import type {
  ChartPoint,
  ChartTooltipAnchorContext,
  ChartTooltipOptions,
  ChartValue,
} from "@tanstack/charts";
// Same import all seven sites use (aliased `nativeTooltip` in five of them,
// `tooltipExtension` in bar-chart.tsx/candlestick-chart.tsx) — one value.
import { tooltip } from "@tanstack/charts/tooltip";
import { BOX_OFFSET } from "./design-tokens";
import { TooltipContent } from "./tooltip-components";
import type { ChartDatum, ChartTooltipConfig, TooltipRow } from "./types";

/**
 * (D-tooltip-geometry fix) x-source for the shared plot-top anchor below.
 * Mirrors the three named sources dist/tooltip.js's
 * `resolveTooltipAnchor`/`resolveTooltipCoordinate` support for an object
 * anchor's `x` field ('point', 'group-center', 'value'), replicated here
 * because a function anchor only receives `points`/`context` — not the
 * `point`/`points` args those builtins close over internally. A caller may
 * also pass its own function for cases the three named sources don't cover.
 */
export type NativeTooltipAnchorX<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> =
  | "point"
  | "group-center"
  | "value"
  | ((
      points: readonly ChartPoint<TDatum, TXValue, TYValue>[],
      context: ChartTooltipAnchorContext<TDatum, TXValue, TYValue>
    ) => number);

function resolveNativeAnchorX<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  source: NativeTooltipAnchorX<TDatum, TXValue, TYValue>,
  points: readonly ChartPoint<TDatum, TXValue, TYValue>[],
  context: ChartTooltipAnchorContext<TDatum, TXValue, TYValue>
): number {
  if (typeof source === "function") return source(points, context);
  const primary = context.focus.primary;
  if (source === "point") return primary.x;
  if (source === "group-center") {
    // dist/tooltip-model.js resolveChartTooltipAnchor's "group-center"
    // branch: min/max x across the full focused group, primary included.
    let x1 = primary.x;
    let x2 = primary.x;
    for (const candidate of points) {
      x1 = Math.min(x1, candidate.x);
      x2 = Math.max(x2, candidate.x);
    }
    return (x1 + x2) / 2;
  }
  // "value": dist/tooltip.js resolveTooltipCoordinate's "value" branch —
  // maps the primary point's semantic xValue through the live x scale
  // (viewport-aware), falling back to the point's own pixel x.
  const scale = context.scales.x;
  const position = (scale?.viewport?.map ?? scale?.map)?.(primary.xValue);
  return position !== undefined && Number.isFinite(position) ? position : primary.x;
}

/**
 * (H7a) `tooltip` extension config, parameterized over the four axes the
 * seven inline copies vary on:
 *  - line-chart.tsx:972-988 / area-chart.tsx:1215-1230 /
 *    composed-chart.tsx:1490-1506 — byte-identical: no `anchor`, `className`
 *    fixed to "bkm-native-tooltip", spring = TOOLTIP_BOX_SPRING, `discrete`
 *    gates the spring on `renderData.length > DISCRETE_INTERACTION_THRESHOLD`.
 *  - live-line-chart.tsx:762-770 — same shape minus the discrete gate (always
 *    springs); expressed here by the caller always passing `discrete: false`.
 *    Spring = TOOLTIP_SPRING (a different design-tokens constant).
 *  - bar-chart.tsx:1052-1065 / candlestick-chart.tsx:1109-1122 — adds
 *    `anchor: {x, y}`; otherwise identical to line/area/composed (className
 *    fixed, spring = TOOLTIP_BOX_SPRING, same discrete gate).
 *  - scatter-chart.tsx:1284-1298 — `anchor: "point"`, spring reads from the
 *    live `chartConfig.tooltipBoxSpring` (not a design-tokens constant), and
 *    `className` is `tooltip?.className` (may be undefined) rather than the
 *    fixed "bkm-native-tooltip" the other six hardcode — so `className` is a
 *    required, non-defaulted parameter here: passing `undefined` through
 *    must NOT fall back to "bkm-native-tooltip", unlike an omitted key would.
 */
export interface NativeTooltipExtensionOptions<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> {
  /** Mirrors each site's `tooltip?.enabled ?? false` (or scatter's `tooltip?.enabled ?? false` early-return) gate. */
  enabled: boolean;
  /** Box-follow spring constants — TOOLTIP_BOX_SPRING, TOOLTIP_SPRING, or scatter's `chartConfig.tooltipBoxSpring`, per caller. */
  spring: { stiffness: number; damping: number };
  /** Past this, motion snaps (`false`) instead of springing. live-line-chart.tsx passes `false` unconditionally (it never gates). */
  discrete: boolean;
  /** No internal default — six sites pass the literal "bkm-native-tooltip"; scatter passes `tooltip?.className` (possibly undefined) through as-is. */
  className: string | undefined;
  offset?: number;
  /**
   * (D-tooltip-geometry fix) x-source for the panel anchor — replaces the
   * old `anchor: {x, y: "plot-top"}` / bare `"point"` forms every call site
   * used to pass. Panel top is now ALWAYS pinned to the plot's top edge
   * (`ctx.plot.y`, same value as `margin.top`) via a function anchor +
   * `placement: ["bottom-right","bottom-left"]` (see below) — only the
   * x-coordinate varies per chart, so that's all callers configure now.
   */
  anchorX: NativeTooltipAnchorX<TDatum, TXValue, TYValue>;
}

export type NativeTooltipExtension<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> = false | ({ use: typeof tooltip } & ChartTooltipOptions<TDatum, TXValue, TYValue>);

export function buildNativeTooltipExtension<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  options: NativeTooltipExtensionOptions<TDatum, TXValue, TYValue>
): NativeTooltipExtension<TDatum, TXValue, TYValue> {
  const { enabled, spring, discrete, className, offset = BOX_OFFSET, anchorX } = options;
  if (!enabled) return false;
  return {
    use: tooltip,
    className,
    sticky: false,
    offset,
    // (D-tooltip-geometry fix) legacy chart-tooltip.tsx/tooltip-box.tsx rule:
    // panel top = plot top edge (margin.top); panel left = anchorX + 16,
    // flipped to anchorX - 16 - width on right-edge overflow. A function
    // anchor pinned to `plot.y - offset` plus placement
    // ["bottom-right","bottom-left"] reproduces exactly that: dist/
    // tooltip-placement.js's tooltipPlacement() gives "bottom-right" ->
    // top = anchorY + gap = (plot.y - offset) + offset = plot.y,
    // left = anchorX + gap; "bottom-left" (chosen by the overflow scan when
    // "bottom-right" would clip the right edge) -> left = anchorX - gap - w,
    // same top. `gap` there is this same `offset` value (dist's `offset`
    // param), so the two stay in sync regardless of override.
    placement: ["bottom-right", "bottom-left"] as const,
    anchor: (points, context) => ({
      x: resolveNativeAnchorX(anchorX, points, context),
      y: context.plot.y - offset,
    }),
    motion: discrete
      ? (false as const)
      : { type: "spring" as const, stiffness: spring.stiffness, damping: spring.damping },
  };
}

/**
 * (H7b) Panel-wrapper tooltip body, parameterized over the two axes
 * line-chart.tsx:1007-1044, area-chart.tsx:1250-1287, composed-chart.tsx:
 * 1579-1616 and live-line-chart.tsx:574-612 vary on — the default row list
 * (`lines`/`resolvedAreas`/`composedSeries`/`lineVisuals`, each mapped
 * through its own color-fallback / value-formatting logic, so left to the
 * caller as `buildRows`) and the title (`weekdayDateFmt` off `datum[xDataKey]`
 * for the first three vs. `liveXAxisRef`'s live clock formatter off
 * `datum.date` for live-line-chart, left to the caller as `resolveTitle`).
 * Everything else — primary-point extraction, the `cfg` null-check,
 * `panelClassName`/`panelStyle` derivation, the `cfg.content` short-circuit,
 * the `cfg.rows` override check, and the `TooltipContent` wrapping — is
 * byte-identical across all four and lives here.
 *
 * bar-chart.tsx, candlestick-chart.tsx and scatter-chart.tsx's tooltip
 * bodies are structurally different (not a `<TooltipContent>`-wrapped row
 * list keyed the same way) and are intentionally left alone.
 */
export interface RenderSeriesTooltipBodyOptions<
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> {
  tooltip: ChartTooltipConfig | null | undefined;
  buildRows: (
    datum: ChartDatum,
    ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>
  ) => TooltipRow[];
  resolveTitle: (
    datum: ChartDatum,
    ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>
  ) => string | undefined;
}

export function renderSeriesTooltipBody<
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>,
  options: RenderSeriesTooltipBodyOptions<TXValue, TYValue>
): ReactNode {
  const primary = ctx.points[0];
  if (!primary) return null;
  const datum = primary.datum;
  const cfg = options.tooltip ?? null;
  const panelClassName = cfg?.className ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel";
  const panelStyle: CSSProperties | undefined =
    cfg?.panelStyle || cfg?.backgroundColor
      ? { ...cfg?.panelStyle, ...(cfg?.backgroundColor ? { backgroundColor: cfg.backgroundColor } : null) }
      : undefined;
  if (cfg?.content) {
    return (
      <div className={panelClassName} style={panelStyle}>
        {cfg.content({ point: datum, index: primary.datumIndex })}
      </div>
    );
  }
  const title = options.resolveTitle(datum, ctx);
  const rows: TooltipRow[] = cfg?.rows ? cfg.rows(datum) : options.buildRows(datum, ctx);
  return (
    <div className={panelClassName} style={panelStyle}>
      <TooltipContent title={title} rows={rows}>
        {cfg?.children}
      </TooltipContent>
    </div>
  );
}
