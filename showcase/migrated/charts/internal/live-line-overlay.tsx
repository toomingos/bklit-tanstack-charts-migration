// Live-line overlay chrome: edge-fade defs, focus/hover callbacks, crosshair
// State, and the chart body subtree rendered as a plain helper (same tree).
import { useCallback, useMemo, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import type { ChartTooltipBodyRenderContext } from '@tanstack/react-charts/tooltip';
import { ChartHost, ChartRegistryBridge, HOST_INITIAL_WIDTH } from "./chart-host";
import { ResourceHost } from "./resource-host";
import type { ChartChildRegistration } from "./chart-child-registry";
import { useChartStable } from "./chart-context";
import type {
  ChartInteractionController,
  ChartPoint,
  ChartRendererRenderContext,
  DomChartDefinition,
} from "@tanstack/charts";
import { hmsTimeFmt } from "./formatters";
import { chartMotionRenderer } from "./motion-renderer";
import { ReferenceAreaLayers } from "./reference-area-layer";
import type { ReferenceAreaLayersGeom } from "./reference-area-layer";
import { LiveTipChrome } from "./live-tip-chrome";
import { buildCrosshairGradientDef } from "./focus-marks";
import type { ReferenceAreaPropValue } from "./reference-area-config";
import type { Momentum } from "./live-momentum";
import type {
  ChartDatum,
  ChartTooltipConfig,
  LiveLineConfig,
  MomentumColors,
} from "./types";

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

// Primitive `typeof` checks live in these predicates (anti-slop allows `typeof`
// Inside a type guard); call sites below branch on the guard instead.
const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";
const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";

// Raw ChartDatum record field at the TanStack I/O boundary; call sites narrow
// It with the isNumber/isString guards instead of asserting a shape.
type RawDatumField = ChartDatum[string];

/**
 * Explicit non-empty-string test: `if (s)` is also false for `""`, which this file never wants to conflate.
 * @param {string | undefined} value Possibly-absent string to test.
 * @returns {boolean} True when value is a non-empty string.
 */
const hasText = (value: string | undefined): boolean => (value ?? "").length > 0;

const defaultFormatTime = (timeMs: number): string => hmsTimeFmt.format(new Date(timeMs));
const defaultFormatValue = (value: number): string => value.toFixed(2);

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
const coerceDatumDate = (rawDate: RawDatumField): Date => {
  if (rawDate instanceof Date) {return rawDate;}
  if (isNumber(rawDate) || isString(rawDate)) {return new Date(rawDate);}
  return new Date(Number.NaN);
};

/** Scale factor for fade-gradient stop offsets expressed as percentages. */
const PERCENT_SCALE = 100;
/** Fade mask overhang above/below the plot so the live tip halo is not clipped. */
const FADE_MASK_TOP_OVERHANG_PX = 20;
const FADE_MASK_VERTICAL_OVERHANG_PX = 40;

// Static overlay styles hoisted so host elements reuse stable identities.
const LIVE_SVG_OVERLAY_STYLE = { inset: 0, overflow: "visible", pointerEvents: "none", position: "absolute" } as const;

interface LineVisualSnapshot {
  readonly cfg: ReadonlyLiveLineConfig;
  readonly dotColor: string;
  readonly liveDate: Date | undefined;
  readonly liveValue: number;
  readonly momentum: Momentum;
  readonly resolvedStroke: string;
}

// Tip dot with host-resolved pixels (V1.2/G6); computed inside the host.
interface LiveDotSnapshot {
  readonly cfg: ReadonlyLiveLineConfig;
  readonly dotColor: string;
  readonly dotX: number;
  readonly dotY: number;
  readonly liveValue: number;
  readonly momentum: Momentum;
  readonly resolvedStroke: string;
}

interface FadeGradientOptions {
  readonly innerWidth: number;
  readonly uid: string;
  readonly visual: Readonly<LiveDotSnapshot>;
}

// Per-series edge-fade gradient tracking the live dot; the trailing stop pins full opacity.
const renderFadeGradient = (options: Readonly<FadeGradientOptions>): ReactElement => {
  const { visual } = options;
  const fadeId = `bkm-live-fade-${options.uid}-${visual.cfg.dataKey}`;
  const tracksDot = visual.dotX < options.innerWidth - 1;
  return (
    <linearGradient key={visual.cfg.dataKey} id={fadeId} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stopColor="white" stopOpacity={0} />
      <stop offset="4%" stopColor="white" stopOpacity={1} />
      {tracksDot && (
        <stop
          offset={`${(visual.dotX / Math.max(1, options.innerWidth)) * PERCENT_SCALE}%`}
          stopColor="white"
          stopOpacity={1}
        />
      )}
      {tracksDot ? (
        <stop offset="100%" stopColor="white" stopOpacity={0} />
      ) : (
        <stop offset="100%" stopColor="white" stopOpacity={1} />
      )}
    </linearGradient>
  );
};

interface FadeMaskOptions {
  readonly fadeMaskId: string | undefined;
  readonly height: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly isFirst: boolean;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly uid: string;
  readonly visual: Readonly<LiveDotSnapshot>;
  readonly width: number;
}

// Mask covers the whole container (not just the plot): per-mark mask/clipPath has no native channel.
const renderFadeMask = (options: Readonly<FadeMaskOptions>): ReactNode =>
  hasText(options.fadeMaskId) && options.isFirst && (
    // Explicit region: the seam host is 0×0, so the userSpaceOnUse default region would be empty (D559).
    <mask key={`${options.visual.cfg.dataKey}-mask`} id={options.fadeMaskId} maskUnits="userSpaceOnUse" x={0} y={0} width={options.width} height={options.height}>
      <rect
        fill={`url(#bkm-live-fade-${options.uid}-${options.visual.cfg.dataKey})`}
        x={options.marginLeft}
        y={options.marginTop - FADE_MASK_TOP_OVERHANG_PX}
        width={options.innerWidth}
        height={options.innerHeight + FADE_MASK_VERTICAL_OVERHANG_PX}
      />
      <rect fill="white" x={0} y={0} width={options.marginLeft} height={options.height} />
      <rect
        fill="white"
        x={0}
        y={options.height - options.marginBottom}
        width={options.width}
        height={options.marginBottom}
      />
    </mask>
  );

interface CrosshairDefView {
  readonly color: string;
  readonly id: string;
  readonly stops: readonly Readonly<{ offset: string; opacity: number }>[];
}

interface FadeDefsOptions {
  readonly fadeMaskId: string | undefined;
  readonly height: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly uid: string;
  readonly visuals: readonly LiveDotSnapshot[];
  readonly width: number;
}

// Edge-fade gradients plus the plot mask for the seam (D548 ruling 1).
// The crosshair gradient rides spec.gradients instead (bbox reproduces the span).
const renderFadeDefs = (options: Readonly<FadeDefsOptions>): ReactNode => (
  <>
    {options.visuals.map((visual: Readonly<LiveDotSnapshot>): ReactNode =>
      renderFadeGradient({ innerWidth: options.innerWidth, uid: options.uid, visual }),
    )}
    {options.visuals.map((visual: Readonly<LiveDotSnapshot>): ReactNode =>
      renderFadeMask({
        fadeMaskId: options.fadeMaskId,
        height: options.height,
        innerHeight: options.innerHeight,
        innerWidth: options.innerWidth,
        isFirst: visual === options.visuals[0],
        marginBottom: options.marginBottom,
        marginLeft: options.marginLeft,
        marginTop: options.marginTop,
        uid: options.uid,
        visual,
        width: options.width,
      }),
    )}
  </>
);

const applyFocusDim = (groups: Readonly<Map<string, SVGGElement>>, dimmed: boolean): void => {
  for (const element of groups.values()) {
    element.style.opacity = dimmed ? "0.25" : "1";
  }
};

interface UseLiveFocusChangeOptions {
  readonly liveGroupElsRef: RefObject<Map<string, SVGGElement>>;
}

const useLiveFocusChange = (options: Readonly<UseLiveFocusChangeOptions>): ((points: readonly ReadonlyLivePoint[]) => void) => {
  const { liveGroupElsRef } = options;
  return useCallback(
    (points: readonly ReadonlyLivePoint[]) => {
      const primary = points.at(0);
      applyFocusDim(liveGroupElsRef.current, primary !== undefined);
    },
    [liveGroupElsRef],
  );
};

interface UseLiveRenderRegistryOptions {
  readonly liveGroupElsRef: RefObject<Map<string, SVGGElement>>;
}

interface LiveRenderRegistry {
  readonly getLiveGroups: () => Map<string, SVGGElement>;
  readonly handleRender: (context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => void;
}

const useLiveRenderRegistry = (options: Readonly<UseLiveRenderRegistryOptions>): LiveRenderRegistry => {
  const { liveGroupElsRef } = options;
  const interactionRef = useRef<ChartInteractionController<ChartDatum, Date, number> | null>(null);
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => {
    interactionRef.current = context.interaction;
  }, []);

  // Stable reader for the focus-dim registry; the tip chrome resolves it at ref time.
  const getLiveGroups = useCallback((): Map<string, SVGGElement> => liveGroupElsRef.current, [liveGroupElsRef]);
  return { getLiveGroups, handleRender };
};

interface UseLiveCrosshairOptions {
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly tooltipOn: boolean;
  readonly uid: string;
}

interface LiveCrosshairState {
  readonly crosshairGradientId: string;
  readonly crosshairView: Readonly<CrosshairDefView> | undefined;
}

const useLiveCrosshair = (options: Readonly<UseLiveCrosshairOptions>): LiveCrosshairState => {
  const { tooltip, tooltipOn, uid } = options;
  const crosshairGradientId = `bkm-live-crosshair-${uid}`;
  const crosshairGradientDef = useMemo(() => {
    if (tooltip === undefined || !(tooltipOn && (tooltip.showCrosshair ?? true))) {return undefined;}
    const color = isString(tooltip.indicatorColor) ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipOn, tooltip, crosshairGradientId]);
  const crosshairView = useMemo<Readonly<CrosshairDefView> | undefined>(
    () =>
      crosshairGradientDef
        ? { color: crosshairGradientDef.color, id: crosshairGradientDef.id, stops: crosshairGradientDef.stops }
        : undefined,
    [crosshairGradientDef],
  );
  return { crosshairGradientId, crosshairView };
};

interface RenderLiveLineBodyOptions {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly definition: DomChartDefinition<ChartDatum, Date, number> | undefined;
  readonly fadeMaskId: string | undefined;
  readonly fadeMaskStyle: CSSProperties | undefined;
  readonly getLiveGroups: () => Map<string, SVGGElement>;
  readonly handleFocusChange: (points: readonly ReadonlyLivePoint[]) => void;
  readonly handleRender: (context: Readonly<ChartRendererRenderContext<ChartDatum, Date, number>>) => void;
  readonly height: number;
  readonly lineVisuals: readonly LineVisualSnapshot[];
  readonly liveRefAreas: Record<string, ReferenceAreaPropValue>[];
  readonly referenceAreaGeom: ReferenceAreaLayersGeom;
  readonly renderTooltipBody: (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>) => ReactNode;
  readonly handleRegistryEntries: (entries: readonly ChartChildRegistration[]) => void;
  readonly tooltipOn: boolean;
  readonly uid: string;
}

// Tip dots and fade chrome resolve through host scales (V1.2/G6).
const LiveOverlayChrome = (properties: Readonly<{
  readonly fadeMaskId: string | undefined;
  readonly getLiveGroups: () => Map<string, SVGGElement>;
  readonly uid: string;
  readonly visuals: readonly LineVisualSnapshot[];
}>): ReactNode => {
  const { chart, margin, xScale, yScale } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  const { fadeMaskId, getLiveGroups, uid, visuals } = properties;
  const dots: readonly LiveDotSnapshot[] = useMemo(
    () => visuals.map((visual) => ({
      cfg: visual.cfg,
      dotColor: visual.dotColor,
      dotX: visual.liveDate === undefined ? plot.width : xScale(visual.liveDate),
      dotY: yScale(visual.liveValue),
      liveValue: visual.liveValue,
      momentum: visual.momentum,
      resolvedStroke: visual.resolvedStroke,
    })),
    [visuals, plot.width, xScale, yScale],
  );
  const fullWidth = margin.left + plot.width + margin.right;
  const fullHeight = margin.top + plot.height + margin.bottom;
  // Fade gradients and mask ride the R10 seam (D548 ruling 1); the overlay svg keeps only tip dots.
  return (
    <>
      <ResourceHost
        idPrefix={uid}
        resources={renderFadeDefs({
          fadeMaskId,
          height: fullHeight,
          innerHeight: plot.height,
          innerWidth: plot.width,
          marginBottom: margin.bottom,
          marginLeft: margin.left,
          marginTop: margin.top,
          uid,
          visuals: dots,
          width: fullWidth,
        })}
      />
      <svg
        aria-hidden="true"
        width={fullWidth}
        height={fullHeight}
        style={LIVE_SVG_OVERLAY_STYLE}
      >
        {dots.map((dot: Readonly<LiveDotSnapshot>) => (
          <LiveTipChrome
            key={dot.cfg.dataKey}
            cfg={dot.cfg}
            dotColor={dot.dotColor}
            getLiveGroups={getLiveGroups}
            groupKey={dot.cfg.dataKey}
            liveValue={dot.liveValue}
            liveDotX={dot.dotX}
            liveDotY={dot.dotY}
            resolvedStroke={dot.resolvedStroke}
            innerWidth={plot.width}
          />
        ))}
      </svg>
    </>
  );
};

// Chart body subtree as a plain render helper (not a component): inlined into
// The same element tree, so reconciliation and animations are unchanged.
const renderLiveLineBody = (options: Readonly<RenderLiveLineBodyOptions>): ReactNode => {
  const { ariaDescription, ariaLabel = "Live line chart", children, definition, fadeMaskId, fadeMaskStyle, getLiveGroups, handleFocusChange, handleRegistryEntries, handleRender, height, lineVisuals, liveRefAreas, referenceAreaGeom, renderTooltipBody, tooltipOn, uid } = options;
  return definition ? (
          <div
            style={fadeMaskStyle}
          >
            <ChartHost
              ariaLabel={ariaLabel}
              ariaDescription={ariaDescription}
              renderer={chartMotionRenderer<ChartDatum, Date, number>()}
              definition={definition}
              idPrefix={uid}
              initialWidth={HOST_INITIAL_WIDTH}
              height={height}
              onFocusGroupChange={handleFocusChange}
              onRender={handleRender}
              renderTooltipBody={tooltipOn ? renderTooltipBody : undefined}
            >
              {children}
              <ChartRegistryBridge onEntries={handleRegistryEntries} />
              {liveRefAreas.length > 0 && (
                <ReferenceAreaLayers
                  configs={liveRefAreas}
                  geom={referenceAreaGeom}
                />
              )}
              <LiveOverlayChrome
                fadeMaskId={fadeMaskId}
                getLiveGroups={getLiveGroups}
                uid={uid}
                visuals={lineVisuals}
              />
            </ChartHost>
          </div>
  ) : undefined;
};

export {
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
};
export type {
  CrosshairDefView,
  LineVisualSnapshot,
  LiveCrosshairState,
  LiveRenderRegistry,
  RawDatumField,
  ReadonlyLiveLineConfig,
  ReadonlyLivePoint,
  RenderLiveLineBodyOptions,
  UseLiveCrosshairOptions,
  UseLiveFocusChangeOptions,
  UseLiveRenderRegistryOptions,
};
