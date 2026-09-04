// Highlight-band marks split out of hover-geometry; 2-3-point hover window at full brightness.
import { createMark } from "@tanstack/charts";
import type {
  ChartCurve,
  ChartMark,
  ChartValue,
  SceneNode,
} from "@tanstack/charts";
import { lineY } from "@tanstack/charts/line";
import { HIGHLIGHT_SPRING } from "./design-tokens";
import type { ChartDatum } from "./types";

const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

interface HighlightBandSeries {
  readonly dataKey: string;
  readonly color: string;
  readonly strokeWidth: number;
  readonly showHighlight: boolean;
// Area only: band needs showHighlight && showLine; dim needs showHighlight alone.
  readonly showLine?: boolean;
  readonly curve?: ChartCurve;
}

// Display-only recursion: strips interaction so the re-sliced band can't re-resolve focus
// And feed back into setHoveredIndex (infinite update loop).
const stripInteraction = (node: SceneNode): SceneNode => {
  if (node.kind === "group") {
    return { ...node, children: node.children.map(stripInteraction) };
  }
  if ("interaction" in node && node.interaction) {
    const { interaction: _interaction, ...rest } = node;
    return _interaction ? rest : node;
  }
  return node;
};

// Display-only wrapper: strips interaction so the re-sliced band can't re-resolve focus
// And feed back into setHoveredIndex (infinite update loop).
const withoutInteraction = <TDatum, TXValue extends ChartValue, TYValue extends ChartValue>(mark: ChartMark<TDatum, TXValue, TYValue>): ChartMark<TDatum, TXValue, TYValue> => createMark((ctx) => {
  const inner = mark.initialize(ctx);
  return {
    ...inner,
    render: (renderCtx) => {
      const scene = inner.render(renderCtx);
      return { ...scene, nodes: scene.nodes.map(stripInteraction) };
    },
  };
}, mark.motion, mark.renderer);

interface HighlightLineMarkArgs {
  readonly slice: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly hoverSeries: Readonly<HighlightBandSeries>;
  readonly discrete: boolean | undefined;
}

// One re-sliced highlight line; hoisted so buildHighlightBandMarks stays short.
const buildHighlightLineMark = (markArgs: Readonly<HighlightLineMarkArgs>): ChartMark<ChartDatum, Date, number> =>
  withoutInteraction(
    lineY(markArgs.slice, {
      curve: markArgs.hoverSeries.curve,
      id: `${markArgs.hoverSeries.dataKey}__highlight`,
      motion: markArgs.discrete === true
        ? false
        : {
            path: "morph",
            transition: { damping: HIGHLIGHT_SPRING.damping, stiffness: HIGHLIGHT_SPRING.stiffness, type: "spring" },
          },
      stroke: markArgs.hoverSeries.color,
      strokeWidth: markArgs.hoverSeries.strokeWidth,
      x: (datum: Readonly<ChartDatum>) => {
        const raw: unknown = datum[markArgs.xDataKey];
        return raw instanceof Date ? raw : undefined;
      },
      y: (datum: Readonly<ChartDatum>) => {
        const raw: unknown = datum[markArgs.hoverSeries.dataKey];
        return isNumber(raw) ? raw : undefined;
      },
    }),
  );

// 2-3-point hover window; undefined when there is nothing to highlight.
const sliceHighlightWindow = (renderData: readonly Readonly<ChartDatum>[], hoveredIndex: number | null): readonly Readonly<ChartDatum>[] | undefined => {
  if (hoveredIndex === null || renderData.length === 0) {return undefined;}
  const lo = Math.max(0, hoveredIndex - 1);
  const hi = Math.min(renderData.length - 1, hoveredIndex + 1);
  if (hi < lo) {return undefined;}
  const slice = renderData.slice(lo, hi + 1);
  if (slice.length === 0) {return undefined;}
  return slice;
};

interface HighlightBandOptions {
  readonly discrete?: boolean;
}

interface BuildHighlightBandMarksParams {
  readonly hoveredIndex: number | null;
  readonly options?: Readonly<HighlightBandOptions>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly series: readonly Readonly<HighlightBandSeries>[];
  readonly xDataKey: string;
}

// 2-3-point slice at full brightness; path morph approximates the old clip sweep,
// Exact for adjacent-index moves only.
const buildHighlightBandMarks = (params: Readonly<BuildHighlightBandMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const { hoveredIndex, renderData, series, xDataKey } = params;
  const discrete = params.options?.discrete;
  const slice = sliceHighlightWindow(renderData, hoveredIndex);
  if (slice === undefined) {return [];}
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const hoverSeries of series) {
    if (hoverSeries.showHighlight && hoverSeries.showLine !== false) {
      marks.push(buildHighlightLineMark({ discrete, hoverSeries, slice, xDataKey }));
    }
  }
  return marks;
};

export {
  buildHighlightBandMarks,
};

export type {
  HighlightBandSeries,
};
