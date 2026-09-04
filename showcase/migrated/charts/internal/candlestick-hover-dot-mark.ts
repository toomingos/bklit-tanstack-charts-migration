// Candlestick hover-dot mark: spring-animated dot (or ring) tracking the hovered close.
// Plain-dot radius/stroke are hardcoded (only ring reads dotSize/scale/strokeWidth); ring stays a circle.
import type {
  ChartMark,
  ChartMotionDefinition,
  ChartPoint,
  MarkRenderContext,
  SceneNode,
} from "@tanstack/charts";
import { allFinite, HOVER_DOT_ID, PLAIN_DOT_RADIUS, PLAIN_DOT_STROKE_WIDTH, readDateField, readFiniteNumberField, RING_STROKE_WIDTH_FALLBACK } from "./candlestick-fields";
import type { SpringConfig } from "./chart-config-context";
import type { DotConfig } from "./tooltip-mappers";
import type { ChartDatum } from "./types";

// DotConfig color is string | fn | undefined; this names the fn branch for narrowing.
type CandleDotColorFn = Exclude<DotConfig["color"], string | undefined>;
const isCandleDotColorFn = (value: DotConfig["color"]): value is CandleDotColorFn => typeof value === "function";

// DotColor precedence (incl. function branch) evaluates once at mark-build time, not per hover.
const resolveCandleDotColor = (color: DotConfig["color"], date: Readonly<Date>, close: number): string => {
  if (color === undefined || color === "") {return "var(--chart-line-primary)";}
  if (isCandleDotColorFn(color)) {
    // SAFETY: the `function` branch of DotConfig["color"] is checked immediately above.
    return color({ close, date }, { dataKey: "close" });
  }
  return color;
};

interface HoverDotGeometry {
  readonly isRing: boolean;
  readonly size: number;
  readonly strokeWidth: number;
}

const resolveHoverDotGeometry = (dotCfg: Readonly<DotConfig>): HoverDotGeometry => {
  const isRing = (dotCfg.variant ?? "dot") === "ring";
  if (!isRing) {return { isRing, size: PLAIN_DOT_RADIUS, strokeWidth: PLAIN_DOT_STROKE_WIDTH };}
  return {
    isRing,
    size: (dotCfg.size ?? PLAIN_DOT_RADIUS) * (dotCfg.scale ?? 1),
    strokeWidth: dotCfg.strokeWidth ?? RING_STROKE_WIDTH_FALLBACK,
  };
};

interface CandleHoverDotMarkParams {
  source: readonly Readonly<ChartDatum>[];
  xDataKey: string;
  dotCfg: Readonly<DotConfig>;
  tooltipSpring: Readonly<SpringConfig>;
}

interface HoverDotNodeOptions {
  readonly index: number;
  readonly isRing: boolean;
  readonly point: ChartPoint<ChartDatum, Date, number>;
  readonly size: number;
  readonly strokeWidth: number;
  readonly x: number;
  readonly y: number;
}

const buildHoverDotNode = (options: Readonly<HoverDotNodeOptions>): SceneNode => {
  const { index, isRing, point, size, strokeWidth, x, y } = options;
  return {
    key: `${HOVER_DOT_ID}:${index}`,
    kind: "dot",
    pointOwner: point,
    radius: size,
    style: isRing
      ? { fill: "transparent", stroke: point.color, strokeWidth }
      : { fill: point.color, stroke: "var(--chart-background)", strokeWidth },
    x,
    y,
  };
};

interface HoverDotDatumOptions {
  readonly close: number | undefined;
  readonly date: Date | undefined;
  readonly datum: Readonly<ChartDatum>;
  readonly dotCfg: Readonly<DotConfig>;
  readonly index: number;
  readonly isRing: boolean;
  readonly scales: MarkRenderContext["scales"];
  readonly size: number;
  readonly strokeWidth: number;
}

interface HoverDotEntry {
  readonly node: SceneNode;
  readonly point: ChartPoint<ChartDatum, Date, number>;
}

const buildHoverDotEntry = (options: Readonly<HoverDotDatumOptions>): HoverDotEntry | undefined => {
  const { close, date, datum, dotCfg, index, isRing, scales, size, strokeWidth } = options;
  if (date === undefined || close === undefined) {return undefined;}
  const [x, y] = [scales.x.map(date), scales.y.map(close)];
  if (!allFinite([x, y])) {return undefined;}
  const point: ChartPoint<ChartDatum, Date, number> = {
    color: resolveCandleDotColor(dotCfg.color, date, close),
    datum,
    datumIndex: index,
    // SAFETY: ChartPoint.group is `ChartKey | null` (no `undefined` variant) —
    // This mark has no group concept, so `null` is the only valid "none" value.
    group: null,
    groupLabel: HOVER_DOT_ID,
    key: `${HOVER_DOT_ID}:${index}`,
    markId: HOVER_DOT_ID,
    x,
    xValue: date,
    y,
    yValue: close,
  };
  const node: SceneNode = buildHoverDotNode({ index, isRing, point, size, strokeWidth, x, y });
  return { node, point };
};

/**
 * Plain-dot radius/stroke are hardcoded (only ring reads dotSize/scale/strokeWidth); ring stays a circle.
 *
 * @param {Readonly<CandleHoverDotMarkParams>} params - Row data plus the resolved dot config and tooltip spring to animate with.
 * @returns {ChartMark<ChartDatum, Date, number>} The hover-dot mark, keyed by row index.
 */
const createCandlestickHoverDotMark = (
  params: Readonly<CandleHoverDotMarkParams>,
): ChartMark<ChartDatum, Date, number> => {
  const { source, xDataKey, dotCfg, tooltipSpring } = params;
  const { isRing, size, strokeWidth } = resolveHoverDotGeometry(dotCfg);
  // Bklit parity: dots always spring; ChartTooltip never gates them on discrete.
  const motion: ChartMotionDefinition<ChartDatum> = {
    transition: { damping: tooltipSpring.damping, stiffness: tooltipSpring.stiffness, type: "spring" },
  };
  return {
    initialize: () => {
      const dateValues = source.map((datum) => readDateField(datum, xDataKey));
      const closeValues = source.map((datum) => readFiniteNumberField(datum, "close"));
      return {
        channels: {
          x: { scale: "x", values: dateValues },
          y: { scale: "y", values: closeValues },
        },
        id: HOVER_DOT_ID,
        motion,
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, Date, number>[] = [];
          for (const [index, datum] of source.entries()) {
            const entry = buildHoverDotEntry({
              close: closeValues[index],
              date: dateValues[index],
              datum,
              dotCfg,
              index,
              isRing,
              scales,
              size,
              strokeWidth,
            });
            if (entry !== undefined) {
              nodes.push(entry.node);
              points.push(entry.point);
            }
          }
          return {
            nodes: [
              { ariaHidden: true, children: nodes, className: "bkm-chart__hover-dot", key: HOVER_DOT_ID, kind: "group" },
            ],
            points,
          };
        },
      };
    },
  };
};

export type {
  CandleHoverDotMarkParams,
};
export {
  createCandlestickHoverDotMark,
};
