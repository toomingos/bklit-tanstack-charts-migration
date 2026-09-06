"use client";
// RAF loop lerps y-domain per tick, commits to React at LIVE_FRAME_COMMIT_MS; samples carry true values.
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { bisector } from "d3-array";
import { curveMonotoneX } from 'd3-shape';
import type { CurveFactory } from 'd3-shape';
import type { ChartTooltipBodyRenderContext } from '@tanstack/react-charts/tooltip';
import { HOST_INITIAL_WIDTH, adoptHostWidth, useRegistryEntriesState } from "./internal/chart-host";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { defineChart } from "@tanstack/charts/scene";
import type {
  ChartKey,
  ChartMark,
  ChartMotionDefinition,
  ChartPositionScaleOptions,
  ChartRendererRenderContext,
  ChartTooltipInput,
} from "@tanstack/charts";
import { roleOf } from "./internal/children-extract";
import { referenceAreaPushProps } from "./internal/reference-area-config";
import type { ReferenceAreaPropValue } from "./internal/reference-area-config";
import type { ReferenceAreaLayersGeom } from "./internal/reference-area-layer";
import { detectMomentum } from "./internal/live-momentum";
import type { Momentum } from "./internal/live-momentum";
import { liveLineMark } from "./internal/live-line-mark";
import { useChartMargin } from "./internal/use-chart-margin";
import {
  buildCrosshairGradientDef,
  buildHoverDotMark,
  buildIndicatorMark,
  resolveHoverDotFill,
} from "./internal/focus-marks";
import { BOX_OFFSET, TOOLTIP_SPRING } from "./internal/design-tokens";
import { tooltip as packageTooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { renderSeriesTooltipBody } from "./internal/tooltip-components";
import { CARTESIAN_MAX_FOCUS_DISTANCE_PX } from "./internal/cartesian-focus-distance";
import type {
  ChartDatum,
  ChartTooltipConfig,
  LiveLineConfig,
  LiveXAxisConfig,
  LiveYAxisConfig,
} from "./internal/types";
import { LIVE_FRAME_COMMIT_MS, useLiveFrame } from "./internal/live-line-frame";
import type { LiveLinePoint } from "./internal/live-line-frame";
import { useLiveTicks } from "./internal/live-line-ticks";
import { useLiveLineScales } from "./internal/live-line-scales";
import {
  coerceDatumDate,
  defaultFormatTime,
  defaultFormatValue,
  hasText,
  isNumber,
  isString,
  renderLiveLineBody,
  useLiveCrosshair,
  useLiveFocusChange,
  useLiveRenderRegistry,
} from "./internal/live-line-overlay";
import type { RawDatumField, ReadonlyLiveLineConfig } from "./internal/live-line-overlay";
import "./styles.css";

interface Margin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const LERP_SPEED = 0.08;
const LIVE_LINE_DEFAULT_HEIGHT = 300;

// Height follows the sized container (consumer style wins, else the previous measured default).
const resolveLiveLineHeight = (style: CSSProperties | undefined): number => {
  const parsed = Number(style?.height ?? LIVE_LINE_DEFAULT_HEIGHT);
  return Number.isNaN(parsed) ? LIVE_LINE_DEFAULT_HEIGHT : parsed;
};

// Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
interface LiveLineHostSize {
  readonly adoptWidth: (sceneWidth: number | undefined) => void;
  readonly height: number;
  readonly width: number;
}

const useLiveLineHostSize = (style: CSSProperties | undefined): LiveLineHostSize => {
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const adoptWidth = useCallback((sceneWidth: number | undefined): void => {
    adoptHostWidth(setLiveWidth, sceneWidth);
  }, []);
  const height = useMemo(() => resolveLiveLineHeight(style), [style]);
  return { adoptWidth, height, width: liveWidth };
};
const DEFAULT_MARGIN: Margin = { bottom: 32, left: 16, right: 16, top: 24 };

interface LiveLineChartProps {
  readonly data: LiveLinePoint[];
  readonly value: number;
  readonly dataKey?: string;
  readonly window?: number;
  readonly numXTicks?: number;
  readonly nowOffsetUnits?: number;
  readonly exaggerate?: boolean;
  readonly lerpSpeed?: number;
  readonly margin?: Partial<Margin>;
  readonly paused?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const timeBisector = bisector<LiveLinePoint, number>((point: Readonly<LiveLinePoint>) => point.time);

const EDGE_FADE_PX = 28;
// Percent-stop to bbox-ratio scale for the crosshair spec gradient.
const GRADIENT_PERCENT_SCALE = 100;

const edgeOpacity = (yPos: number, chartHeight: number): number => {
  const fromEdge = Math.min(yPos, chartHeight - yPos);
  if (fromEdge >= EDGE_FADE_PX) {return 1;}
  if (fromEdge <= 0) {return 0;}
  return fromEdge / EDGE_FADE_PX;
};

interface ExtractedLiveLineChildren {
  readonly liveLines: LiveLineConfig[];
  liveXAxis: LiveXAxisConfig | undefined;
  liveYAxis: LiveYAxisConfig | undefined;
  tooltip: ChartTooltipConfig | undefined;
  readonly referenceAreas: Record<string, ReferenceAreaPropValue>[];
}

// Element props are consumed per-role after the roleOf dispatch below, so each branch only reads its own config's fields; pinning the combined shape here keeps every branch well-typed without per-branch assertions (all fields except LiveLineConfig.dataKey are optional, and the tooltip spread only copies fields present at runtime).
// Reference-area elements go through the shared push classifier so the sink keeps the owner prop-value contract.
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
  else if (role === "referenceArea") {
    const pushed = referenceAreaPushProps(child);
    if (pushed !== undefined) {out.referenceAreas.push(pushed);}
  }
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

// Tooltip cell text: numbers go through the series formatter, strings pass
// Through, and anything else renders empty instead of `[object Object]`.
const formatTooltipCellValue = (raw: RawDatumField, formatValue: (value: number) => string): string => {
  if (isNumber(raw)) {return formatValue(raw);}
  if (isString(raw)) {return raw;}
  return "";
};
/** Seconds-to-milliseconds factor for live time-window conversions. */
const MS_PER_SECOND = 1000;
/** Offset from the end of contextData to the live "now" point (the last entries are tip samples). */
const NOW_POINT_OFFSET_FROM_END = -2;
interface LiveTooltipOptionParams {
  readonly enabled: boolean;
}

// Panel top pins to the plot top; the x follows the primary focused point.
const buildLiveTooltipOption = ({ enabled }: Readonly<LiveTooltipOptionParams>): ChartTooltipInput<ChartDatum, Date, number, "dom"> | false => {
  if (!enabled) {return false;}
  return {
    anchor: (_points, context) => ({
      x: context.focus.primary.x,
      y: context.plot.y - BOX_OFFSET,
    }),
    className: "bkm-native-tooltip",
    motion: { damping: TOOLTIP_SPRING.damping, stiffness: TOOLTIP_SPRING.stiffness, type: "spring" as const },
    offset: BOX_OFFSET,
    placement: ["bottom-right", "bottom-left"] as const,
    portal,
    sticky: false,
    use: packageTooltip,
  };
};
/** X tick label downward nudge below the axis line. */
const X_TICK_LABEL_DY_OFFSET_PX = 26;
/** Y tick label horizontal nudge away from the axis. */
const Y_TICK_LABEL_DX_PX = 8;

interface LineStrokeResolution {
  readonly dotColor: string;
  readonly resolvedStroke: string;
}

const resolveLineStroke = (cfg: ReadonlyLiveLineConfig, momentum: Momentum): LineStrokeResolution => {
  const baseStroke = cfg.stroke ?? "var(--chart-line-primary)";
  const momentumColors = cfg.momentumColors ?? {
    down: "var(--chart-5)",
    flat: baseStroke,
    up: "var(--chart-1)",
  };
  const dotColor = momentumColors[momentum];
  const resolvedStroke = cfg.momentumColors ? cfg.momentumColors[momentum] : baseStroke;
  return { dotColor, resolvedStroke };
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
  ariaLabel,
  ariaDescription,
}: LiveLineChartProps): ReactElement => {
  // Fixed plot margins between commits: TanStack treats definition identity as its update boundary.
  const margin = useChartMargin(marginProp, DEFAULT_MARGIN);
  const uid = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { adoptWidth, height, width } = useLiveLineHostSize(style);
  // Registry union (V1.3 carriers): entries report up from inside the host.
  // Live-line extraction is scan-only; the guard keeps this a no-op.
  const [, handleRegistryEntries] = useRegistryEntriesState();

  const { liveLines, liveXAxis, liveYAxis, tooltip, referenceAreas: liveRefAreas } = useMemo(
    () => extractLiveLineChildren(children),
    [children],
  );

  const windowMs = windowSecs * MS_PER_SECOND;
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const xTickUnitMs = windowMs / Math.max(1, numXTicks - 1);
  const leadingMs = nowOffsetUnits * xTickUnitMs;

  const { frame } = useLiveFrame({ data, exaggerate, innerHeight, innerWidth, lerpSpeed, paused, value });

  // Every y domain reads the niced scale domain, never raw frame values (single shared extent).
  const domainEndMs = frame.now + leadingMs;
  const domainStartMs = domainEndMs - windowMs;
  const { xScaleFactory, yNicedDomain, yScaleFactory } = useLiveLineScales({
    domainEndMs,
    domainStartMs,
    yMax: frame.yMax,
    yMin: frame.yMin,
  });
  const tickDomainX = useMemo(() => ({ domain: (): Date[] => [new Date(domainStartMs), new Date(domainEndMs)] }), [domainStartMs, domainEndMs]);
  const tickDomainY = useMemo(() => ({ domain: (): number[] => [yNicedDomain[0], yNicedDomain[1]] }), [yNicedDomain]);

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
      const { dotColor, resolvedStroke } = resolveLineStroke(cfg, momentum);
      const nowPoint =
        contextData.length >= 2 ? contextData.at(NOW_POINT_OFFSET_FROM_END) : contextData.at(-1);
      const liveRaw: unknown = nowPoint?.[cfg.dataKey];
      const liveValue = isNumber(liveRaw) ? liveRaw : 0;
      // Tip pixels resolve in the host from host scales (V1.2/G6); only the date travels.
      const liveDate = nowPoint ? xAccessor(nowPoint) : undefined;
      return { cfg, dotColor, liveDate, liveValue, momentum, resolvedStroke };
    })
  , [liveLines, contextData, xAccessor]);

  const tooltipOn = tooltip !== undefined && tooltip.enabled !== false;
  // Explicit y1:0/y2:1 required: the library default gradient direction is the opposite.
  // The crosshair fade rides spec.gradients too (bbox 0→1 reproduces the plot span).
  const nativeLineGradients = useMemo(() => {
    const entries = lineVisuals.flatMap((visual: Readonly<(typeof lineVisuals)[number]>) => [
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
    ]);
    if (tooltip !== undefined && tooltipOn && (tooltip.showCrosshair ?? true)) {
      const crosshairColor = isString(tooltip.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
      const crosshairDef = buildCrosshairGradientDef(`bkm-live-crosshair-${uid}`, crosshairColor);
      entries.push({
        id: crosshairDef.id,
        stops: crosshairDef.stops.map((stop) => ({
          color: crosshairDef.color,
          // eslint-disable-next-line unicorn/prefer-number-coercion -- stops are percent strings ("10%"), Number() reads NaN.
          offset: Number.parseFloat(stop.offset) / GRADIENT_PERCENT_SCALE,
          opacity: stop.opacity,
        })),
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 1,
      });
    }
    return entries;
  },
    [lineVisuals, uid, tooltip, tooltipOn],
  );

  const liveGroupElsRef = useRef<Map<string, SVGGElement>>(new Map());
  const liveXAxisRef = useRef(liveXAxis);
  // Sync the latest axis config for tooltip callbacks without changing their identity.
  useEffect(() => {
    liveXAxisRef.current = liveXAxis;
  }, [liveXAxis]);

  const handleFocusChange = useLiveFocusChange({ liveGroupElsRef });

  const { getLiveGroups, handleRender: registryHandleRender } = useLiveRenderRegistry({ liveGroupElsRef });
  // Host-owned sizing: the host adopts the measured width through this render callback.
  const handleRender = useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>): void => {
    registryHandleRender(context);
    adoptWidth(context.scene.width);
  }, [registryHandleRender, adoptWidth]);

  const { crosshairGradientId } = useLiveCrosshair({ tooltip, tooltipOn, uid });

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

  const { xTickValues, yTickValues } = useLiveTicks({ innerHeight, liveXAxis, liveYAxis, numXTicks, xScale: tickDomainX, yScale: tickDomainY });

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
          y1: yNicedDomain[0],
        }),
      );
    }
    if (tooltip !== undefined && tooltipOn && (tooltip.showCrosshair ?? true)) {
      // The package crosshair x label shows the axis time text now.
      const formatTime = liveXAxis?.formatTime ?? defaultFormatTime;
      marks.push(
        buildIndicatorMark({
          color: isString(tooltip.indicatorColor) ? tooltip.indicatorColor : undefined,
          dasharray: tooltip.indicatorDasharray,
          gradientId: crosshairGradientId,
          width: tooltip.indicatorWidth,
          xLabelFormat: (labelValue) => (labelValue instanceof Date ? formatTime(labelValue.getTime()) : ""),
        }),
      );
    }
    if (tooltip !== undefined && tooltipOn && (tooltip.showDots ?? true)) {
      for (const visual of lineVisuals) {
        marks.push(
          buildHoverDotMark(
            {
              fill: resolveHoverDotFill(visual.dotColor, tooltip.dotColor),
              options: { size: tooltip.dotSize, strokeWidth: tooltip.dotStrokeWidth },
              renderData: contextData,
              series: { color: visual.resolvedStroke, dataKey: visual.cfg.dataKey },
              xDataKey: "date",
            },
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
      scale: xScaleFactory,
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
      scale: yScaleFactory,
      side: liveYAxis?.position === "right" ? "right" : "left",
    };
    return defineChart({
      clip: true,
      focus: "group-x" as const,
      focusRing: false,
      gradients: nativeLineGradients,
      margin,
      marks,
      maxFocusDistance: CARTESIAN_MAX_FOCUS_DISTANCE_PX,
      motion: rollingMotion,
      scales: {
        x: xScaleOptions,
        y: yScaleOptions,
      },
      svgAnimation: false as const,
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      tooltip: buildLiveTooltipOption({ enabled: tooltipOn }),
    });
  }, [
    width,
    innerWidth,
    innerHeight,
    contextData,
    lineVisuals,
    nativeLineGradients,
    xScaleFactory,
    yScaleFactory,
    yNicedDomain,
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

  const xDomainStart = useMemo(() => new Date(domainStartMs), [domainStartMs]);
  const xDomainEnd = useMemo(() => new Date(domainEndMs), [domainEndMs]);
  const [yDomainStart, yDomainEnd] = yNicedDomain;
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
      xDomain: [xDomainStart, xDomainEnd],
      yDomain: [yDomainStart, yDomainEnd],
    }),
    [xDomainStart, xDomainEnd, yDomainStart, yDomainEnd],
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
  const body = renderLiveLineBody({
    ariaDescription,
    ariaLabel,
    children,
    definition,
    fadeMaskId,
    fadeMaskStyle,
    getLiveGroups,
    handleFocusChange,
    handleRegistryEntries,
    handleRender,
    height,
    lineVisuals,
    liveRefAreas,
    referenceAreaGeom,
    renderTooltipBody,
    tooltipOn,
    uid,
  });

  return (
    <div
      ref={containerRef}
      className={className}
      data-bkm-chart="liveline"
      data-slot="chart"
      style={containerStyle}
    >
      {body}
    </div>
  );
};

export type { LiveLineChartProps };
export type { Momentum } from "./internal/live-momentum";
export type { LiveLinePoint } from "./internal/live-line-frame";
export { LiveLineChart };
