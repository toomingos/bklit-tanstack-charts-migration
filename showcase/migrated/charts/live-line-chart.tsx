"use client";
// RAF loop lerps y-domain per tick, commits to React at LIVE_FRAME_COMMIT_MS; samples carry true values.
import {
  Children,
  Fragment,
  isValidElement,
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { bisector } from "d3-array";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveMonotoneX } from 'd3-shape';
import type { CurveFactory } from 'd3-shape';
import { RendererChart } from '@tanstack/react-charts/tooltip';
import type { ChartTooltipBodyRenderContext } from '@tanstack/react-charts/tooltip';
import { d3Curve } from "@tanstack/charts/d3/shape";
import { defineChart } from "@tanstack/charts/scene";
import type {
  ChartInteractionController,
  ChartKey,
  ChartMark,
  ChartMotionDefinition,
  ChartPoint,
  ChartPositionScaleOptions,
  ChartRendererRenderContext,
} from "@tanstack/charts";
import { roleOf } from "./internal/children-extract";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import { hmsTimeFmt } from "./internal/formatters";
import { liveLineMark } from "./internal/live-line-mark";
import { useChartMargin } from "./internal/use-chart-margin";
import { useMeasuredRect } from "./internal/use-container-size";
import { chartMotionRenderer } from "./internal/motion-renderer";
import {
  buildCrosshairGradientDef,
  buildIndicatorMark,
  buildHoverDotMark,
  resolveHoverDotFill,
  useDatePillOverlay,
} from "./internal/hover-geometry";
import { TOOLTIP_SPRING } from "./internal/design-tokens";
import { useChartConfig } from "./internal/chart-config-context";
import { buildNativeTooltipExtension, renderSeriesTooltipBody } from "./internal/native-tooltip";
import type {
  ChartDatum,
  ChartTooltipConfig,
  LiveLineConfig,
  LiveXAxisConfig,
  LiveYAxisConfig,
  MomentumColors,
} from "./internal/types";
import "./styles.css";

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const LERP_SPEED = 0.08;
const DEFAULT_MARGIN: Margin = { bottom: 32, left: 16, right: 16, top: 24 };
/** React commit interval (~30fps); doubles as the rolling-path tween so commits hand off continuously. */
const LIVE_FRAME_COMMIT_MS = 32;
/** Skip commits under a quarter pixel of change: invisible, but rebuilds the whole definition. */
const PAUSED_FRAME_PIXEL_THRESHOLD = 0.25;
/** Y-domain padding around the live range; exaggerate mode hugs the line. */
const EXAGGERATED_RANGE_PADDING_FACTOR = 0.03;
const STANDARD_RANGE_PADDING_FACTOR = 0.15;
/** Fallback pad when the live range is flat (rawRange is 0). */
const EXAGGERATED_FLAT_RANGE_PAD = 0.04;
const STANDARD_FLAT_RANGE_PAD = 10;

interface LiveLinePoint {
  time: number;
  value: number;
}

// `Readonly<LiveLineConfig>` alone leaves the nested `momentumColors` object mutable, which typescript(prefer-readonly-parameter-types) still flags.
type ReadonlyLiveLineConfig = Readonly<Omit<LiveLineConfig, "momentumColors">> & {
  readonly momentumColors?: Readonly<MomentumColors>;
};

// ChartPoint carries TanStack-owned mutable fields (the datum record, the Date xValue, the ChartValue interval bounds); this spells them deeply readonly instead of dropping them.
type ReadonlyLivePoint = Readonly<
  Omit<ChartPoint<ChartDatum, Date, number>, "datum" | "xValue" | "x1Value" | "x2Value" | "y1Value" | "y2Value">
> & {
  readonly datum: Readonly<ChartDatum>;
  readonly xValue: Readonly<Date>;
  readonly x1Value?: number | string | Readonly<Date>;
  readonly x2Value?: number | string | Readonly<Date>;
  readonly y1Value?: number | string | Readonly<Date>;
  readonly y2Value?: number | string | Readonly<Date>;
};

interface LiveTipChromeProps {
  readonly cfg: ReadonlyLiveLineConfig;
  readonly dotColor: string;
  readonly liveValue: number;
  readonly liveDotX: number;
  readonly liveDotY: number;
  readonly resolvedStroke: string;
  readonly innerWidth: number;
  readonly registerLiveGroup: (el: SVGGElement | null) => void;
}

interface LiveLineChartProps {
  data: LiveLinePoint[];
  value: number;
  dataKey?: string;
  window?: number;
  numXTicks?: number;
  nowOffsetUnits?: number;
  exaggerate?: boolean;
  lerpSpeed?: number;
  margin?: Partial<Margin>;
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface AnimFrame {
  now: number;
  yMin: number;
  yMax: number;
  displayValue: number;
  /** True current value, never lerped; committed samples read this, not displayValue. */
  trueValue: number;
  /** Bumped per commit (not per tick); mints fresh keys for synthetic tip samples. */
  seq: number;
}

// Primitive `typeof` checks live in these predicates (anti-slop allows `typeof`
// Inside a type guard); call sites below branch on the guard instead.
const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";
const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";

// Named owner contract for the live y-domain target (replaces the inline
// Anonymous return type the widening rule rejects).
interface TargetRange {
  readonly yMax: number;
  readonly yMin: number;
}

const computeTargetRange = (
  data: readonly Readonly<LiveLinePoint>[],
  value: number,
  exaggerate: boolean,
): TargetRange => {
  if (data.length === 0) {
    return { yMax: 100, yMin: 0 };
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of data) {
    if (point.value < min) {min = point.value;}
    if (point.value > max) {max = point.value;}
  }
  if (value < min) {min = value;}
  if (value > max) {max = value;}
  const rawRange = max - min;
  const paddingFactor = exaggerate ? EXAGGERATED_RANGE_PADDING_FACTOR : STANDARD_RANGE_PADDING_FACTOR;
  const rangePad = rawRange * paddingFactor || (exaggerate ? EXAGGERATED_FLAT_RANGE_PAD : STANDARD_FLAT_RANGE_PAD);
  return { yMax: max + rangePad, yMin: min - rangePad };
};

const nextAnimFrame = (
  prev: Readonly<AnimFrame>,
  targetRange: { readonly yMin: number; readonly yMax: number },
  targetValue: number,
  speed: number,
  isPaused: boolean,
): Omit<AnimFrame, "seq"> => {
  const nextNow = isPaused ? prev.now : Date.now();
  const nextYMin =
    targetRange.yMin < prev.yMin
      ? targetRange.yMin
      : prev.yMin + (targetRange.yMin - prev.yMin) * speed;
  const nextYMax =
    targetRange.yMax > prev.yMax
      ? targetRange.yMax
      : prev.yMax + (targetRange.yMax - prev.yMax) * speed;
  const nextValue = prev.displayValue + (targetValue - prev.displayValue) * speed;
  return { displayValue: nextValue, now: nextNow, trueValue: targetValue, yMax: nextYMax, yMin: nextYMin };
};

const frameChangePixels = (prev: Readonly<AnimFrame>, next: Readonly<AnimFrame>, height: number): number => {
  const range = Math.max(Math.abs(prev.yMax - prev.yMin), Math.abs(next.yMax - next.yMin));
  if (range <= 0 || height <= 0) {return Number.POSITIVE_INFINITY;}
  const domainChange = Math.max(
    Math.abs(next.yMin - prev.yMin),
    Math.abs(next.yMax - prev.yMax),
  );
  const valueChange = Math.abs(next.displayValue - prev.displayValue);
  return (Math.max(domainChange, valueChange) / range) * height;
};

const timeBisector = bisector<LiveLinePoint, number>((point: Readonly<LiveLinePoint>) => point.time);

type Momentum = "up" | "down" | "flat";

/** Minimum samples before judging momentum; the tail window covers the same span. */
const MOMENTUM_MIN_SAMPLES = 5;
const MOMENTUM_TAIL_SAMPLES = 5;
/** Tail delta must exceed this fraction of the lookback range to count as up/down. */
const MOMENTUM_DELTA_THRESHOLD_FACTOR = 0.12;

const detectMomentum = (data: readonly Readonly<ChartDatum>[], dataKey: string, lookback = 20): Momentum => {
  if (data.length < MOMENTUM_MIN_SAMPLES) {return "flat";}
  const start = Math.max(0, data.length - lookback);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = start; index < data.length; index += 1) {
    const rawValue = data[index]?.[dataKey];
    if (isNumber(rawValue)) {
      if (rawValue < min) {min = rawValue;}
      if (rawValue > max) {max = rawValue;}
    }
  }
  const range = max - min;
  if (range === 0) {return "flat";}
  const tailStart = Math.max(start, data.length - MOMENTUM_TAIL_SAMPLES);
  const firstRaw: unknown = data[tailStart][dataKey];
  const lastRaw: unknown = data.at(-1)?.[dataKey];
  const first = isNumber(firstRaw) ? firstRaw : 0;
  const last = isNumber(lastRaw) ? lastRaw : 0;
  const delta = last - first;
  const threshold = range * MOMENTUM_DELTA_THRESHOLD_FACTOR;
  if (delta > threshold) {return "up";}
  if (delta < -threshold) {return "down";}
  return "flat";
};

// Hysteresis keeps prevInterval within [0.5x, 3x] of minGap to avoid tick flicker.
const TICK_HYSTERESIS_MIN_FACTOR = 0.5;
const TICK_HYSTERESIS_MAX_FACTOR = 3;
/** Odd divisor in the nice-tick divisor sets (ported verbatim from the legacy tick search). */
const NICE_DIVISOR_ODD = 2.5;
/** Decimal base for the nice-tick span search. */
const NICE_SPAN_BASE = 10;
/** Fallback y tick count when no nice span is found. */
const FALLBACK_Y_TICK_COUNT = 5;

const pickNiceInterval = (
  valRange: number,
  chartHeight: number,
  minGap: number,
  prevInterval: number,
): number => {
  if (valRange <= 0 || chartHeight <= 0) {return 1;}
  const pxPerUnit = chartHeight / valRange;
  if (prevInterval > 0) {
    const px = prevInterval * pxPerUnit;
    if (px >= minGap * TICK_HYSTERESIS_MIN_FACTOR && px <= minGap * TICK_HYSTERESIS_MAX_FACTOR) {return prevInterval;}
  }
  const divisorSets = [
    [2, NICE_DIVISOR_ODD, 2],
    [2, 2, NICE_DIVISOR_ODD],
    [NICE_DIVISOR_ODD, 2, 2],
  ];
  let best = Number.POSITIVE_INFINITY;
  for (const divs of divisorSets) {
    let span = NICE_SPAN_BASE ** Math.ceil(Math.log10(valRange));
    let divIndex = 0;
    let divisor = divs[divIndex % divs.length] ?? 2;
    while ((span / divisor) * pxPerUnit >= minGap) {
      span /= divisor;
      divIndex += 1;
      divisor = divs[divIndex % divs.length] ?? 2;
    }
    if (span < best) {best = span;}
  }
  return best === Number.POSITIVE_INFINITY ? valRange / FALLBACK_Y_TICK_COUNT : best;
};

const EDGE_FADE_PX = 28;

const edgeOpacity = (yPos: number, chartHeight: number): number => {
  const fromEdge = Math.min(yPos, chartHeight - yPos);
  if (fromEdge >= EDGE_FADE_PX) {return 1;}
  if (fromEdge <= 0) {return 0;}
  return fromEdge / EDGE_FADE_PX;
};

/**
 * Explicit non-empty-string test: `if (s)` is also false for `""`, which this file never wants to conflate.
 * @param {string | undefined} value Possibly-absent string to test.
 * @returns {boolean} True when value is a non-empty string.
 */
const hasText = (value: string | undefined): boolean => (value ?? "").length > 0;

/**
 * Datum dates are minted by contextData via `new Date(...)` but re-typed as
 * `unknown` by the ChartDatum record; like readDate in projection-utils, this
 * narrows instead of asserting. Always returns a Date (invalid when the value
 * is neither a Date nor a number/string timestamp); call sites below only ever
 * observe the Date branch.
 *
  * @param {unknown} rawDate - Raw datum date value; Date instances pass through, number/string timestamps are converted.
  * @returns {Date} The coerced date, or an invalid Date when the value is neither a Date nor a usable timestamp.
  */
const coerceDatumDate = (rawDate: unknown): Date => {
  if (rawDate instanceof Date) {return rawDate;}
  if (isNumber(rawDate) || isString(rawDate)) {return new Date(rawDate);}
  return new Date(Number.NaN);
};

interface ExtractedLiveLineChildren {
  liveLines: LiveLineConfig[];
  liveXAxis: LiveXAxisConfig | undefined;
  liveYAxis: LiveYAxisConfig | undefined;
  tooltip: ChartTooltipConfig | undefined;
  referenceAreas: ChartDatum[];
}

// Element props are consumed per-role after the roleOf dispatch below, so each branch only reads its own config's fields; pinning the combined shape here keeps every branch well-typed without per-branch assertions (all fields except LiveLineConfig.dataKey are optional, and the tooltip spread only copies fields present at runtime).
// Reference-area elements carry arbitrary pass-through config fields; they are pushed wholesale into referenceAreas (ChartDatum[]) below, so no open index signature is needed here.
type LiveLineChildProps = LiveLineConfig &
  LiveXAxisConfig &
  LiveYAxisConfig &
  ChartTooltipConfig & {
  children?: ReactNode;
  };

/**
 * Collects one non-fragment child element into the live-line extraction sink; unknown roles collect nothing.
 *
 * @param {Readonly<ReactElement<LiveLineChildProps>>} child - Child element whose role selects the sink slot.
 * @param {ExtractedLiveLineChildren} out - Sink receiving the extracted configs.
 * @returns {void} Nothing; writes into out.
 */
const collectLiveLineChild = (child: Readonly<ReactElement<LiveLineChildProps>>, out: ExtractedLiveLineChildren): void => {
  const role = roleOf(child.type);
  if (role === "liveLine") {out.liveLines.push(child.props);}
  else if (role === "liveXAxis") {out.liveXAxis = child.props;}
  else if (role === "liveYAxis") {out.liveYAxis = child.props;}
  else if (role === "referenceArea") {out.referenceAreas.push({ ...child.props });}
  else if (role === "tooltip") {out.tooltip = { enabled: true, ...child.props };}
  else {
    // Unknown roles carry no live-line state; nothing to extract.
  }
};

const extractLiveLineChildren = (children: ReactNode): ExtractedLiveLineChildren => {
  const out: ExtractedLiveLineChildren = {
    liveLines: [],
    liveXAxis: undefined,
    liveYAxis: undefined,
    referenceAreas: [],
    tooltip: undefined,
  };
  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) {
      if (isValidElement<LiveLineChildProps>(child)) {
        if (child.type === Fragment) {visit(child.props.children);}
        else {collectLiveLineChild(child, out);}
      }
    }
  };
  visit(children);
  return out;
};

const defaultFormatTime = (timeMs: number): string => hmsTimeFmt.format(new Date(timeMs));
const defaultFormatValue = (value: number): string => value.toFixed(2);

// Tooltip cell text: numbers go through the series formatter, strings pass
// Through, and anything else renders empty instead of `[object Object]`.
const formatTooltipCellValue = (raw: unknown, formatValue: (value: number) => string): string => {
  if (isNumber(raw)) {return formatValue(raw);}
  if (isString(raw)) {return raw;}
  return "";
};
/** Seconds-to-milliseconds factor for live time-window conversions. */
const MS_PER_SECOND = 1000;
/** Offset from the end of contextData to the live "now" point (the last entries are tip samples). */
const NOW_POINT_OFFSET_FROM_END = -2;
/** Pill date labels are padded up to this count so the ticker stays painted when data is sparse. */
const DATE_PILL_LABEL_FILL_MAX = 60;
/** Default minimum pixel gap between live y-axis ticks. */
const DEFAULT_Y_MIN_GAP_PX = 36;
/** Half-interval domain expansion when deriving live y tick values. */
const TICK_RANGE_EXPANSION_FACTOR = 0.5;
/** Decimal rounding factor for live y tick values. */
const TICK_ROUNDING_FACTOR = 1e10;
/** X tick label downward nudge below the axis line. */
const X_TICK_LABEL_DY_OFFSET_PX = 26;
/** Y tick label horizontal nudge away from the axis. */
const Y_TICK_LABEL_DX_PX = 8;
/** Scale factor for fade-gradient stop offsets expressed as percentages. */
const PERCENT_SCALE = 100;
/** Fade mask overhang above/below the plot so the live tip halo is not clipped. */
const FADE_MASK_TOP_OVERHANG_PX = 20;
const FADE_MASK_VERTICAL_OVERHANG_PX = 40;

// Static overlay styles hoisted so host elements reuse stable identities.
const LIVE_TIP_GROUP_STYLE = { transition: "opacity 300ms ease-in-out" } as const;
const CHART_OVERLAY_STYLE = { inset: 0, pointerEvents: "none", position: "absolute" } as const;
const LIVE_SVG_OVERLAY_STYLE = { inset: 0, overflow: "visible", pointerEvents: "none", position: "absolute" } as const;

// Five chrome elements render at the throttled frame rate; scrub-dim applies imperatively.
const DEFAULT_LIVE_DOT_SIZE_PX = 4;
/** Pulse halo peak radius as a multiple of the live dot size. */
const LIVE_DOT_PULSE_RADIUS_FACTOR = 3.5;
/** Badge horizontal offset from the live dot. */
const LIVE_BADGE_OFFSET_X_PX = 12;
/** Badge width: measured label characters plus horizontal padding. */
const LIVE_BADGE_CHAR_WIDTH_PX = 7.5;
const LIVE_BADGE_HORIZONTAL_PADDING_PX = 16;

const LiveTipChrome = ({
  cfg,
  dotColor,
  liveValue,
  liveDotX,
  liveDotY,
  resolvedStroke,
  innerWidth,
  registerLiveGroup,
}: Readonly<LiveTipChromeProps>): ReactElement => {
  const pulse = cfg.pulse ?? true;
  const dotSize = cfg.dotSize ?? DEFAULT_LIVE_DOT_SIZE_PX;
  const badge = cfg.badge ?? true;
  const formatValue = cfg.formatValue ?? defaultFormatValue;

  return (
    <>
      <line
        opacity={0.25}
        stroke={resolvedStroke}
        strokeDasharray="4,4"
        strokeWidth={1}
        x1={0}
        x2={innerWidth}
        y1={liveDotY}
        y2={liveDotY}
      />
      <g ref={registerLiveGroup} style={LIVE_TIP_GROUP_STYLE}>
        <g>
          {pulse && (
            <circle
              cx={liveDotX}
              cy={liveDotY}
              fill="none"
              opacity={0.4}
              r={dotSize * 2}
              stroke={dotColor}
              strokeWidth={1.5}
            >
              <animate
                attributeName="r"
                dur="1.5s"
                from={String(dotSize)}
                repeatCount="indefinite"
                to={String(dotSize * LIVE_DOT_PULSE_RADIUS_FACTOR)}
              />
              <animate attributeName="opacity" dur="1.5s" from="0.5" repeatCount="indefinite" to="0" />
            </circle>
          )}
          <circle cx={liveDotX} cy={liveDotY} fill={dotColor} opacity={0.1} r={dotSize + 2} />
          <circle
            cx={liveDotX}
            cy={liveDotY}
            fill={dotColor}
            r={dotSize}
            stroke="var(--chart-background)"
            strokeWidth={2}
          />
        </g>
        {badge && (
          <g transform={`translate(${liveDotX + LIVE_BADGE_OFFSET_X_PX},${liveDotY})`}>
            <rect
              fill="var(--popover)"
              height={24}
              opacity={0.95}
              rx={6}
              width={formatValue(liveValue).length * LIVE_BADGE_CHAR_WIDTH_PX + LIVE_BADGE_HORIZONTAL_PADDING_PX}
              x={0}
              y={-12}
            />
            <text
              fill="var(--popover-foreground)"
              fontFamily="SF Mono, Menlo, Monaco, monospace"
              fontSize={11}
              fontWeight={500}
              x={8}
              y={4}
            >
              {formatValue(liveValue)}
            </text>
          </g>
        )}
      </g>
    </>
  );
};

const LiveLineChart = ({
  data,
  value,
  dataKey = "value",
  window: windowSecs = 30,
  numXTicks = 5,
  nowOffsetUnits = 0,
  exaggerate = false,
  lerpSpeed = LERP_SPEED,
  margin: marginProp,
  paused = false,
  children,
  className,
  style,
}: LiveLineChartProps): ReactElement => {
  // Fixed plot margins between commits: TanStack treats definition identity as its update boundary.
  const margin = useChartMargin(marginProp, DEFAULT_MARGIN);
  const uid = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useMeasuredRect(containerRef);

  const { liveLines, liveXAxis, liveYAxis, tooltip, referenceAreas: liveRefAreas } = useMemo(
    () => extractLiveLineChildren(children),
    [children],
  );

  const windowMs = windowSecs * MS_PER_SECOND;
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const xTickUnitMs = windowMs / Math.max(1, numXTicks - 1);
  const leadingMs = nowOffsetUnits * xTickUnitMs;

  const initialFrame: AnimFrame = { displayValue: value, now: Date.now(), seq: 0, trueValue: value, yMax: 100, yMin: 0 };
  const animRef = useRef<AnimFrame>(initialFrame);
  const [frame, setFrame] = useState<AnimFrame>(initialFrame);
  const committedFrameRef = useRef(initialFrame);
  const seqRef = useRef(0);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const valueRef = useRef(value);
  valueRef.current = value;
  const lerpSpeedRef = useRef(lerpSpeed);
  lerpSpeedRef.current = lerpSpeed;

  const targetRange = useMemo(
    () => computeTargetRange(data, value, exaggerate),
    [data, value, exaggerate],
  );
  const targetRangeRef = useRef(targetRange);
  targetRangeRef.current = targetRange;

  useEffect(() => {
    if (innerWidth <= 0 || innerHeight <= 0) {return undefined;}
    let raf = 0;
    let lastFrameCommit = 0;
    const tick = (): void => {
      raf = 0;
      const next = nextAnimFrame(
        animRef.current,
        targetRangeRef.current,
        valueRef.current,
        lerpSpeedRef.current,
        pausedRef.current,
      );
      animRef.current = { ...next, seq: animRef.current.seq };

      const now = performance.now();
      const pixelChange = frameChangePixels(committedFrameRef.current, animRef.current, innerHeight);
      const shouldWake = !pausedRef.current || pixelChange >= PAUSED_FRAME_PIXEL_THRESHOLD;
      if (shouldWake && now - lastFrameCommit >= LIVE_FRAME_COMMIT_MS) {
        lastFrameCommit = now;
        seqRef.current += 1;
        const committed: AnimFrame = { ...next, seq: seqRef.current };
        committedFrameRef.current = committed;
        animRef.current = committed;
        startTransition(() =>{  setFrame(committed); });
      }
      if (!shouldWake) {return;}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return (): void => {
      if (raf !== 0) {cancelAnimationFrame(raf);}
    };
  }, [innerWidth, innerHeight]);

  // Every y domain reads the niced scale domain, never raw frame values (single shared extent).
  const domainEndMs = frame.now + leadingMs;
  const xScale = useMemo(
    () =>
      scaleUtc()
        .domain([new Date(domainEndMs - windowMs), new Date(domainEndMs)])
        .range([0, innerWidth]),
    [domainEndMs, windowMs, innerWidth],
  );
  const yScale = useMemo(
    () => scaleLinear().domain([frame.yMin, frame.yMax]).nice().range([innerHeight, 0]),
    [frame.yMin, frame.yMax, innerHeight],
  );

  const xAccessor = useCallback((datum: Readonly<ChartDatum>): Date => coerceDatumDate(datum.date), []);
  const keyAccessor = useCallback((datum: Readonly<ChartDatum>): ChartKey => {
    const rawKey: unknown = datum.liveKey;
    return isString(rawKey) || isNumber(rawKey) ? rawKey : "";
  }, []);

  const contextData = useMemo<ChartDatum[]>(() => {
    const windowStart = domainEndMs - windowMs;
    let startIdx = timeBisector.left(data, windowStart / MS_PER_SECOND, 0);
    if (startIdx > 0) {startIdx -= 1;}
    const sliced = data.slice(startIdx);
    const records: ChartDatum[] = sliced.map((point: Readonly<LiveLinePoint>) => ({
      date: new Date(point.time * MS_PER_SECOND),
      // Retained keys stay stable across commits (timestamp-keyed); tip samples rotate per commit.
      liveKey: point.time,
      [dataKey]: point.value,
    }));
    // Tip samples take a fresh key every commit: their x and y both legitimately change each frame.
    records.push({ date: new Date(frame.now), liveKey: `__tipA:${frame.seq}`, [dataKey]: frame.trueValue }, { date: new Date(frame.now + xTickUnitMs), liveKey: `__tipB:${frame.seq}`, [dataKey]: frame.trueValue });
    return records;
  }, [data, frame.now, frame.trueValue, frame.seq, domainEndMs, windowMs, dataKey, xTickUnitMs]);

  const lineVisuals = useMemo(() => 
    liveLines.map((cfg: ReadonlyLiveLineConfig) => {
      const momentum = detectMomentum(contextData, cfg.dataKey);
      const baseStroke = cfg.stroke ?? "var(--chart-line-primary)";
      const defaultMomentumColors: MomentumColors = {
        down: "var(--chart-5)",
        flat: baseStroke,
        up: "var(--chart-1)",
      };
      const dotMomentumColors = cfg.momentumColors ?? defaultMomentumColors;
      const dotColor = dotMomentumColors[momentum];
      const resolvedStroke = cfg.momentumColors ? cfg.momentumColors[momentum] : baseStroke;
      const nowPoint =
        contextData.length >= 2 ? contextData.at(NOW_POINT_OFFSET_FROM_END) : contextData.at(-1);
      const liveRaw: unknown = nowPoint?.[cfg.dataKey];
      const liveValue = isNumber(liveRaw) ? liveRaw : 0;
      const liveDotX = nowPoint ? (xScale(xAccessor(nowPoint)) ?? 0) : innerWidth;
      const liveDotY = yScale(liveValue) ?? 0;
      return { baseStroke, cfg, dotColor, liveDotX, liveDotY, liveValue, momentum, resolvedStroke };
    })
  , [liveLines, contextData, xScale, yScale, xAccessor, innerWidth]);

  // Explicit y1:0/y2:1 required: the library default gradient direction is the opposite.
  const nativeLineGradients = useMemo(
    () =>
      lineVisuals.flatMap((visual: Readonly<(typeof lineVisuals)[number]>) => [
        {
          id: `bkm-live-stroke-${uid}-${visual.cfg.dataKey}`,
          stops: [
            { color: visual.resolvedStroke, offset: 0, opacity: 1 },
            { color: visual.resolvedStroke, offset: 1, opacity: 0.6 },
          ],
          x1: 0,
          x2: 0,
          y1: 0,
          y2: 1,
        },
        {
          id: `bkm-live-area-${uid}-${visual.cfg.dataKey}`,
          stops: [
            { color: visual.resolvedStroke, offset: 0, opacity: 0.1 },
            { color: visual.resolvedStroke, offset: 1, opacity: 0 },
          ],
          x1: 0,
          x2: 0,
          y1: 0,
          y2: 1,
        },
      ]),
    [lineVisuals, uid],
  );

  const tooltipOn = tooltip !== undefined && tooltip.enabled !== false;
  const chartConfig = useChartConfig();
  const liveGroupElsRef = useRef<Map<string, SVGGElement>>(new Map());
  // Pill labels come from real per-datum formatted times; empty arrays leave the ticker unpainted.
  const dateLabelsForPill = useMemo(() => {
    const formatTime = liveXAxis?.formatTime ?? defaultFormatTime;
    const labels = contextData.map((datum: Readonly<ChartDatum>) => {
      const dateVal = coerceDatumDate(datum.date);
      return formatTime(dateVal.getTime());
    });
    while (labels.length > 0 && labels.length <= DATE_PILL_LABEL_FILL_MAX) {
      const lastLabel = labels.at(-1);
      if (lastLabel === undefined) {break;}
      labels.push(lastLabel);
    }
    return labels;
  }, [contextData, liveXAxis]);
  // Pill gates on axis presence + tooltipOn, not showDatePill (legacy live axis has no such flag).
  const datePill = useDatePillOverlay({
    dateLabels: dateLabelsForPill,
    enabled: tooltipOn && liveXAxis !== undefined,
    tooltipSpring: chartConfig.tooltipSpring,
  });
  const wasVisibleRef = useRef(false);
  const liveXAxisRef = useRef(liveXAxis);
  liveXAxisRef.current = liveXAxis;

  const handleFocusChange = useCallback(
    (points: readonly ReadonlyLivePoint[]) => {
      const [primary] = points;
      const dim = primary !== undefined;
      for (const el of liveGroupElsRef.current.values()) {
        el.style.opacity = dim ? "0.25" : "1";
      }
      if (!tooltipOn) {return;}
      const axisCfg = liveXAxisRef.current;
      if (primary && axisCfg) {
        const { datum } = primary;
        const dateVal = coerceDatumDate(datum.date);
        const formatTime = axisCfg.formatTime ?? defaultFormatTime;
        const label = formatTime(dateVal.getTime());
        const jump = !wasVisibleRef.current;
        wasVisibleRef.current = true;
        datePill.show(primary.x, { discrete: false, index: primary.datumIndex, jump, label });
      } else {
        wasVisibleRef.current = false;
        datePill.hide();
      }
    },
    [tooltipOn, datePill],
  );

  const interactionRef = useRef<ChartInteractionController<ChartDatum, Date, number> | null>(null);
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => {
    interactionRef.current = context.interaction;
  }, []);

  const crosshairGradientId = `bkm-live-crosshair-${uid}`;
  const crosshairGradientDef = useMemo(() => {
    if (!(tooltipOn && (tooltip?.showCrosshair ?? true))) {return undefined;}
    const color = isString(tooltip?.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipOn, tooltip, crosshairGradientId]);

  const renderTooltipBody = useCallback(
    (ctx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, Date, number>>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (datum: Readonly<ChartDatum>) =>
          lineVisuals.map((visual: Readonly<(typeof lineVisuals)[number]>) => {
            const raw = datum[visual.cfg.dataKey];
            const formatValue = visual.cfg.formatValue ?? defaultFormatValue;
            return {
              color: visual.resolvedStroke,
              label: visual.cfg.dataKey,
              value: formatTooltipCellValue(raw, formatValue),
            };
          }),
        resolveTitle: (datum) => {
          const dateVal = coerceDatumDate(datum.date);
          const formatTime = liveXAxisRef.current?.formatTime ?? defaultFormatTime;
          return formatTime(dateVal.getTime());
        },
        tooltip,
      }),
    [tooltip, lineVisuals],
  );

  const xTickValues = useMemo<Date[]>(() => {
    if (!liveXAxis) {return [];}
    const tickCount = liveXAxis.numTicks ?? numXTicks;
    const [start, end] = xScale.domain();
    const startMs = start.getTime();
    const endMs = end.getTime();
    const step = (endMs - startMs) / Math.max(1, tickCount - 1);
    return Array.from({ length: tickCount }, (_slot, index) => new Date(startMs + index * step));
  }, [liveXAxis, xScale, numXTicks]);

  const yIntervalRef = useRef(0);
  const yTickValues = useMemo<number[]>(() => {
    if (!liveYAxis) {return [];}
    // Read the niced scale domain directly for tick sizing (legacy builds its yScale with nice:true).
    const [minVal, maxVal] = yScale.domain();
    const valRange = maxVal - minVal;
    const minGap = liveYAxis.minGap ?? DEFAULT_Y_MIN_GAP_PX;
    const interval = pickNiceInterval(valRange, innerHeight, minGap, yIntervalRef.current);
    yIntervalRef.current = interval;
    if (interval <= 0 || valRange <= 0) {return [];}
    const allowDecimals = liveYAxis.allowDecimals ?? true;
    const expandedMin = minVal - interval * TICK_RANGE_EXPANSION_FACTOR;
    const expandedMax = maxVal + interval * TICK_RANGE_EXPANSION_FACTOR;
    const first = Math.ceil(expandedMin / interval) * interval;
    const values: number[] = [];
    for (let tickValue = first; tickValue <= expandedMax; tickValue += interval) {
      const rounded = Math.round(tickValue * TICK_ROUNDING_FACTOR) / TICK_ROUNDING_FACTOR;
      if (Number.isInteger(rounded) || allowDecimals) {values.push(rounded);}
    }
    return values;
  }, [liveYAxis, yScale, innerHeight]);

  const definition = useMemo(() => {
    if (width <= 0 || innerWidth <= 0 || innerHeight <= 0 || contextData.length < 2) {return undefined;}
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    for (const visual of lineVisuals) {
      const {cfg} = visual;
      const curve: CurveFactory = cfg.curve ?? curveMonotoneX;
      const strokeGradId = `bkm-live-stroke-${uid}-${cfg.dataKey}`;
      const areaGradId = `bkm-live-area-${uid}-${cfg.dataKey}`;
      marks.push(
        ...liveLineMark(contextData, {
          curve: d3Curve(curve),
          fill: `url(#${areaGradId})`,
          id: cfg.dataKey,
          key: keyAccessor,
          stroke: `url(#${strokeGradId})`,
          strokeWidth: cfg.strokeWidth ?? 2,
          withFill: cfg.fill !== false,
          x: xAccessor,
          y: (datum: Readonly<ChartDatum>) => {
            const rawValue: unknown = datum[cfg.dataKey];
            return isNumber(rawValue) ? rawValue : undefined;
          },
          // Area baseline is domain-space (niced domain min), not a pixel constant.
          y1: yScale.domain()[0],
        }),
      );
    }
    if (tooltipOn && (tooltip?.showCrosshair ?? true)) {
      marks.push(
        buildIndicatorMark({
          color: isString(tooltip?.indicatorColor) ? tooltip.indicatorColor : undefined,
          dasharray: tooltip?.indicatorDasharray,
          gradientId: crosshairGradientId,
          width: tooltip?.indicatorWidth,
        }),
      );
    }
    if (tooltipOn && (tooltip?.showDots ?? true)) {
      for (const visual of lineVisuals) {
        marks.push(
          buildHoverDotMark(
            contextData,
            "date",
            { color: visual.resolvedStroke, dataKey: visual.cfg.dataKey },
            resolveHoverDotFill(visual.dotColor, tooltip?.dotColor),
            { size: tooltip?.dotSize, strokeWidth: tooltip?.dotStrokeWidth },
          ),
        );
      }
    }
    const rollingMotion: ChartMotionDefinition<ChartDatum> = {
      path: { fallback: "snap", update: "rolling", x: "shift", y: "reproject" },
      transition: { duration: LIVE_FRAME_COMMIT_MS, easing: "linear", type: "tween" },
    };
    const xScaleOptions: ChartPositionScaleOptions<Date> = {
      axis: liveXAxis
        ? {
            line: false,
            tickLabels: { dy: margin.bottom - X_TICK_LABEL_DY_OFFSET_PX, fontSize: 12, opacity: 1, thin: false },
            ticks: {
              format: (tickDate: Readonly<Date>) =>
                (liveXAxis.formatTime ?? defaultFormatTime)(tickDate.getTime()),
              padding: 0,
              size: 0,
              values: xTickValues,
            },
          }
        : false,
      scale: xScale,
    };
    const yScaleOptions: ChartPositionScaleOptions<number> = {
      axis: liveYAxis
        ? {
            line: false,
            tickLabels: {
              dx: liveYAxis.position === "right" ? Y_TICK_LABEL_DX_PX : -Y_TICK_LABEL_DX_PX,
              // Y labels nudge +4px (dy=14): native middle-baseline centering sits above legacy's mono spans.
              dy: 14,
              fontSize: 12,
              opacity: (ctx: Readonly<{ value: unknown; position: number }>) =>
                edgeOpacity(ctx.position - margin.top, innerHeight),
              thin: false,
            },
            ticks: {
              format: (tickValue: number) => (liveYAxis.formatValue ?? defaultFormatValue)(tickValue),
              padding: 0,
              size: 0,
              values: yTickValues,
            },
          }
        : false,
      scale: yScale,
      side: liveYAxis?.position === "right" ? "right" : "left",
    };
    return defineChart({
      clip: true,
      focus: "group-x" as const,
      focusRing: false,
      gradients: nativeLineGradients,
      margin,
      marks,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      motion: rollingMotion,
      scales: {
        x: xScaleOptions,
        y: yScaleOptions,
      },
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: buildNativeTooltipExtension<ChartDatum, Date, number>({
        anchorX: "point",
        className: "bkm-native-tooltip",
        discrete: false,
        enabled: tooltipOn,
        spring: TOOLTIP_SPRING,
      }),
    });
  }, [
    width,
    innerWidth,
    innerHeight,
    contextData,
    lineVisuals,
    nativeLineGradients,
    xScale,
    yScale,
    margin,
    uid,
    xAccessor,
    keyAccessor,
    tooltipOn,
    tooltip,
    crosshairGradientId,
    liveXAxis,
    liveYAxis,
    xTickValues,
    yTickValues,
  ]);

  const [xDomainStart, xDomainEnd] = xScale.domain();
  const [yDomainStart, yDomainEnd] = yScale.domain();
  const fadeMaskId = lineVisuals.length > 0 ? `bkm-live-fade-mask-${uid}` : undefined;

  // Stable identities for the object props below; each array names every value its body reads.
  const containerStyle = useMemo<CSSProperties>(
    () => ({
      height: 300,
      isolation: "isolate",
      position: "relative",
      touchAction: "none",
      width: "100%",
      ...style,
    }),
    [style],
  );
  const referenceAreaGeom = useMemo<ReferenceAreaLayersGeom>(
    () => ({
      height,
      isTimeScale: true,
      margin,
      width,
      xDomain: [xDomainStart, xDomainEnd],
      yDomain: [yDomainStart, yDomainEnd],
    }),
    [height, margin, width, xDomainStart, xDomainEnd, yDomainStart, yDomainEnd],
  );
  const fadeMaskStyle = useMemo(
    () =>
      hasText(fadeMaskId)
        ? {
            WebkitMaskImage: `url(#${fadeMaskId})`,
            maskImage: `url(#${fadeMaskId})`,
          }
        : undefined,
    [fadeMaskId],
  );

  return (
    <div
      ref={containerRef}
      className={className}
      data-bkm-chart="liveline"
      style={containerStyle}
    >
      {liveRefAreas.length > 0 && width > 0 && height > 0 && (
        <ReferenceAreaLayers
          configs={liveRefAreas}
          geom={referenceAreaGeom}
        />
      )}
      {definition ? (
        <>
          <div
            style={fadeMaskStyle}
          >
            <RendererChart
              ariaLabel="Live line chart"
              renderer={chartMotionRenderer<ChartDatum, Date, number>()}
              definition={definition}
              width={width}
              height={height}
              onFocusGroupChange={handleFocusChange}
              onRender={handleRender}
              renderTooltipBody={tooltipOn ? renderTooltipBody : undefined}
            />
          </div>
          <svg
            aria-hidden="true"
            width={width}
            height={height}
            style={LIVE_SVG_OVERLAY_STYLE}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              <defs>
                {lineVisuals.map((visual: Readonly<(typeof lineVisuals)[number]>) => {
                  const fadeId = `bkm-live-fade-${uid}-${visual.cfg.dataKey}`;
                  return (
                    <Fragment key={visual.cfg.dataKey}>
                      <linearGradient id={fadeId} x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="white" stopOpacity={0} />
                        <stop offset="4%" stopColor="white" stopOpacity={1} />
                        {visual.liveDotX < innerWidth - 1 ? (
                          <>
                            <stop
                              offset={`${(visual.liveDotX / Math.max(1, innerWidth)) * PERCENT_SCALE}%`}
                              stopColor="white"
                              stopOpacity={1}
                            />
                            <stop offset="100%" stopColor="white" stopOpacity={0} />
                          </>
                        ) : (
                          <stop offset="100%" stopColor="white" stopOpacity={1} />
                        )}
                      </linearGradient>
                      {hasText(fadeMaskId) && visual === lineVisuals[0] ? (
                        // Mask covers the whole container (not just the plot): per-mark mask/clipPath has no native channel.
                        <mask id={fadeMaskId} maskUnits="userSpaceOnUse">
                          <rect
                            fill={`url(#${fadeId})`}
                            x={margin.left}
                            y={margin.top - FADE_MASK_TOP_OVERHANG_PX}
                            width={innerWidth}
                            height={innerHeight + FADE_MASK_VERTICAL_OVERHANG_PX}
                          />
                          <rect fill="white" x={0} y={0} width={margin.left} height={height} />
                          <rect
                            fill="white"
                            x={0}
                            y={height - margin.bottom}
                            width={width}
                            height={margin.bottom}
                          />
                        </mask>
                      ) : undefined}
                    </Fragment>
                  );
                })}
                {crosshairGradientDef ? (
                  <linearGradient
                    id={crosshairGradientDef.id}
                    gradientUnits="userSpaceOnUse"
                    x1={0}
                    x2={0}
                    y1={margin.top}
                    y2={margin.top + innerHeight}
                  >
                    {crosshairGradientDef.stops.map((stop: Readonly<{ offset: string; opacity: number }>) => (
                      <stop key={stop.offset} offset={stop.offset} stopColor={crosshairGradientDef.color} stopOpacity={stop.opacity} />
                    ))}
                  </linearGradient>
                ) : undefined}
              </defs>

              {lineVisuals.map((visual: Readonly<(typeof lineVisuals)[number]>) => (
                <LiveTipChrome
                  key={visual.cfg.dataKey}
                  cfg={visual.cfg}
                  dotColor={visual.dotColor}
                  liveValue={visual.liveValue}
                  liveDotX={visual.liveDotX}
                  liveDotY={visual.liveDotY}
                  resolvedStroke={visual.resolvedStroke}
                  innerWidth={innerWidth}
                  registerLiveGroup={(el) => {
                    const groups = liveGroupElsRef.current;
                    if (el) {groups.set(visual.cfg.dataKey, el);}
                    else {groups.delete(visual.cfg.dataKey);}
                  }}
                />
              ))}
            </g>
          </svg>
        </>
      ) : undefined}
      {tooltipOn && liveXAxis ? (
        <div ref={datePill.overlayHostRef} style={CHART_OVERLAY_STYLE} />
      ) : undefined}
    </div>
  );
};

export type { LiveLinePoint, LiveLineChartProps, Momentum };
export { detectMomentum, LiveLineChart };
