// Series model shared by LineChart / AreaChart (and reusable by composed/bar):
// turns parsed Line / Area / PatternArea children into plain resolved series.
import type { CurveFactory } from "d3-shape";
import { curveLinear, curveMonotoneX, curveNatural } from "d3-shape";
import { propsFor } from "../read-children";
import type { ChildTable } from "../read-children";
import { DEFAULT_LINE_STROKE } from "../theme";
import type { LineLoadingPulseMode, LoadingStyle } from "../motion/phase";
import type { SeriesMarkersProps, SeriesPointMarkerStyle } from "../types";

type MarkerStyleInput = Readonly<SeriesPointMarkerStyle>;

type FadeEdges = boolean | "left" | "right";

export type Row = Record<string, unknown>;

/** A row's x value as a Date: the chart data contract is a Date, an ISO string or epoch milliseconds (bklit `new Date(row[xKey])`). */
export function toDate(value: unknown): Date {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion, anti-slop/require-safety-comment-for-type-assertion -- Date | string | number is the documented x contract
  return value instanceof Date ? value : new Date(value as string | number);
}

/** bklit SeriesPointMarkerStyle with SeriesMarkers' defaults (series-markers.tsx:55-72); `fill` / `stroke` default to the series stroke. */
interface ResolvedMarker {
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly ringGap: number;
  readonly outlineWidth: number;
  readonly outlineColor: string;
  readonly radius: number;
  readonly fadeOnHover: boolean;
  readonly inactiveOpacity: number;
  readonly inactiveBlur: number;
  readonly enterBlur: number;
  readonly showActiveHighlight: boolean;
  readonly animate: boolean;
}

function resolveMarker(style: MarkerStyleInput | undefined, seriesStroke: string, animate = true): ResolvedMarker {
  const fill = style?.fill ?? seriesStroke;
  const stroke = style?.stroke ?? fill;
  return {
    fill,
    stroke,
    strokeWidth: style?.strokeWidth ?? 2,
    ringGap: style?.ringGap ?? 2,
    outlineWidth: style?.outlineWidth ?? 0,
    outlineColor: style?.outlineColor ?? stroke,
    radius: style?.radius ?? 5,
    fadeOnHover: style?.fadeOnHover ?? true,
    inactiveOpacity: style?.inactiveOpacity ?? 0.5,
    inactiveBlur: style?.inactiveBlur ?? 2,
    enterBlur: style?.enterBlur ?? 2,
    showActiveHighlight: style?.showActiveHighlight ?? true,
    animate,
  };
}

interface SeriesBase {
  readonly kind: "line" | "area" | "pattern";
  /** Mark id, also the lookup key for tooltip rows (`markId.split(":")[0]`). */
  readonly id: string;
  readonly dataKey: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly curve: CurveFactory;
  readonly yAxisId: string;
  readonly fadeEdges: FadeEdges;
  readonly dashFromIndex: number | undefined;
  readonly dashArray: string;
  readonly showMarkers: boolean;
  readonly marker: ResolvedMarker;
  readonly showHighlight: boolean;
  readonly index: number;
  /** Loading pulse overlay (bklit `loading` / `loadingPulseMode`); absent when the series does not pulse. */
  readonly loading: SeriesLoading | undefined;
  /** ProfitLossLine: one path, two colours split at zero. */
  readonly profitLoss?: { readonly positive: string; readonly negative: string };
}

interface SeriesLoading {
  readonly mode: LineLoadingPulseMode;
  readonly style: LoadingStyle;
  readonly stroke: string;
  readonly strokeOpacity: number;
}

export interface AreaSeries extends SeriesBase {
  readonly fill: string;
  readonly fillOpacity: number;
  readonly gradientToOpacity: number;
  readonly showLine: boolean;
  readonly pattern?: { readonly preset: string; readonly color: string };
}

export type ResolvedSeries = SeriesBase & Partial<Omit<AreaSeries, keyof SeriesBase>>;

interface LineProps {
  dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  curve?: CurveFactory;
  yAxisId?: string | number;
  fadeEdges?: FadeEdges;
  showHighlight?: boolean;
  showMarkers?: boolean;
  markers?: MarkerStyleInput;
  animate?: boolean;
  dashFromIndex?: number;
  dashArray?: string;
  loading?: boolean;
  loadingStroke?: string;
  loadingStrokeOpacity?: number;
  loadingPulseMode?: LineLoadingPulseMode;
  loadingStyle?: LoadingStyle;
}

interface ProfitLossProps {
  dataKey: string;
  strokeWidth?: number;
  positiveColor?: string;
  negativeColor?: string;
  curve?: CurveFactory;
  fadeEdges?: FadeEdges;
}

interface AreaProps extends LineProps {
  fill?: string;
  fillOpacity?: number;
  showLine?: boolean;
  gradientToOpacity?: number;
}

interface PatternProps {
  dataKey: string;
  patternPreset?: string;
  patternColor?: string;
  fill?: string;
  curve?: CurveFactory;
}

export const DEFAULT_Y_AXIS_ID = "left";

// bklit line.tsx / area.tsx: `loading === false` disables, an explicit mode or `loading` enables (mode defaults to "loop"),
// and an unset `loading` follows the chart's loading phase (line.tsx:259-264).
const loadingOf = (props: LineProps, chartLoading: boolean): SeriesLoading | undefined => {
  if (props.loading === false || (props.loading !== true && props.loadingPulseMode === undefined && !chartLoading)) {
    return undefined;
  }
  return {
    mode: props.loadingPulseMode ?? "loop",
    style: props.loadingStyle ?? "pulse",
    stroke: props.loadingStroke ?? "var(--chart-foreground)",
    strokeOpacity: props.loadingStrokeOpacity ?? 0.5,
  };
};

export const axisId = (value: string | number | undefined): string =>
  value === undefined ? DEFAULT_Y_AXIS_ID : String(value);

/** `chartLoading` is the chart's `status="loading"`: series follow bklit's loading phase (pulse overlay only; base stroke, fill, highlight and markers hidden, line.tsx:309-311). */
export function resolveSeries(table: ChildTable, chartLoading = false): ResolvedSeries[] {
  const out: ResolvedSeries[] = [];
  // Legend / hover indices count within each role (bklit extracts lines and areas separately).
  const counts = { line: 0, area: 0, pattern: 0 };
  const base = (
    kind: SeriesBase["kind"],
    props: LineProps & { fill?: string; curve?: CurveFactory },
    fallbackCurve: CurveFactory,
  ): SeriesBase => {
    const stroke = chartLoading ? "transparent" : (props.stroke ?? props.fill ?? DEFAULT_LINE_STROKE);
    const index = counts[kind];
    counts[kind] = index + 1;
    return {
      kind,
      id: `${kind}:${props.dataKey}`,
      dataKey: props.dataKey,
      stroke,
      strokeWidth: props.strokeWidth ?? (kind === "line" ? 2.5 : 2),
      curve: props.curve ?? fallbackCurve,
      yAxisId: axisId(props.yAxisId),
      fadeEdges: props.fadeEdges ?? (kind === "line"),
      dashFromIndex: props.dashFromIndex,
      dashArray: props.dashArray ?? "6,4",
      showMarkers: !chartLoading && (props.showMarkers ?? false),
      marker: resolveMarker(props.markers, stroke, props.animate),
      showHighlight: !chartLoading && (props.showHighlight ?? true),
      index,
      loading: loadingOf(props, chartLoading),
    };
  };
  // Children render in document order: bklit paints patterns, then areas, then lines.
  for (const p of propsFor<PatternProps>(table, "patternArea")) {
    const preset = p.patternPreset ?? "diagonal";
    out.push({
      ...base("pattern", { dataKey: p.dataKey, stroke: p.patternColor ?? p.fill, curve: p.curve }, curveMonotoneX),
      id: `pattern-${preset}:${p.dataKey}`,
      fill: p.fill ?? p.patternColor ?? DEFAULT_LINE_STROKE,
      fillOpacity: 1,
      showLine: false,
      pattern: { preset: p.patternPreset ?? "diagonal", color: p.patternColor ?? p.fill ?? DEFAULT_LINE_STROKE },
    });
  }
  for (const a of propsFor<AreaProps>(table, "area")) {
    const stroke = a.stroke ?? a.fill ?? DEFAULT_LINE_STROKE;
    out.push({
      ...base("area", a, curveMonotoneX),
      fill: chartLoading ? "transparent" : (a.fill ?? stroke),
      fillOpacity: chartLoading ? 0 : (a.fillOpacity ?? 0.4),
      gradientToOpacity: a.gradientToOpacity ?? 0,
      showLine: a.showLine ?? true,
    });
  }
  for (const l of propsFor<LineProps>(table, "line")) {
    out.push(base("line", l, curveNatural));
  }
  for (const p of propsFor<ProfitLossProps>(table, "profitLossLine")) {
    const positive = p.positiveColor ?? "var(--color-emerald-500)";
    const negative = p.negativeColor ?? "var(--color-red-500)";
    out.push({
      ...base("line", { dataKey: p.dataKey, stroke: positive, strokeWidth: p.strokeWidth, curve: p.curve, fadeEdges: false, showHighlight: false }, curveLinear),
      profitLoss: { positive, negative },
    });
  }
  // bklit SeriesMarkers as a child: the same point markers as `showMarkers` + `markers` on the series with that dataKey.
  for (const m of propsFor<SeriesMarkersProps>(table, "seriesMarkers")) {
    const at = out.findIndex((s) => s.dataKey === m.dataKey && s.kind !== "pattern");
    const target = at === -1 ? undefined : out[at];
    if (target) {
      out[at] = { ...target, showMarkers: true, marker: resolveMarker(m, target.stroke, m.animate) };
    }
  }
  return out;
}
