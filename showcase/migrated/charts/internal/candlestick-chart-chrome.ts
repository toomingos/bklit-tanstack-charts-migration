// Candlestick chrome: reveal cycle, date-pill/label-fade sync, tooltip model, and the chart-chrome hooks.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { resolveEnterTransition, TWEEN_FALLBACK } from "./enter-transition";
import type { CandlestickEnterTransition } from "./enter-transition";
import { buildPill } from "./date-pill";
import type { PillBuild } from "./date-pill";
import { DISCRETE_INTERACTION_THRESHOLD } from "./design-tokens";
import { useSanitizedId } from "./use-sanitized-id";
import { shortDateFmt } from "./formatters";
import { extractSegmentComponents, useChartSelection } from "./chart-selection";
import type { ChartSelection, SegmentComponent } from "./chart-selection";
import { findCandleTimeExtent, findCandleYExtremes } from "./candlestick-chart-scales";
import type { CandleTimeExtent } from "./candlestick-chart-scales";
import { parseAspectRatio } from "./parse-aspect-ratio";
import type { FocusInjection } from "./focus-injection";
import type { ChartConfigValue } from "./chart-config-context";
import type { PatternPresetId } from "./pattern-preset";
import type { CandlestickConfig, ChartDatum, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./types";
import {
  COLLAPSED_GEOMETRY_PX,
  DEFAULT_ENTER_DURATION_SEC,
  EMPTY_CONTAINER_PX,
  EMPTY_COUNT,
  FLAT_EXTENT_FALLBACK_PX,
  MIN_ENTER_DURATION_MS,
  MIN_GEOMETRY_EXTENT_PX,
  MIN_ROW_COUNT,
  MS_PER_SECOND,
  NO_ANIMATION_DURATION_MS,
  isNumber,
  isString,
} from "./candlestick-chart-shared";
import type { CandlePatternRef } from "./candlestick-chart-shared";

const SOLID_POSITIVE = "var(--color-emerald-500)";
const SOLID_NEGATIVE = "var(--color-red-500)";
// Bklit parity default for the faded-candle opacity.
const DEFAULT_FADED_OPACITY = 0.3;
// Opacity fade dropped: collapsed geometry already hides pre-reveal candles; one timing track only.
const PATTERN_FALLBACK_POSITIVE = SOLID_POSITIVE;
const PATTERN_FALLBACK_NEGATIVE = SOLID_NEGATIVE;
// Known pattern presets; anything else renders only when it is a legacy url(#id) string.
const CANDLE_PATTERN_PRESETS: ReadonlySet<string> = new Set(["diagonal", "horizontal", "vertical", "cross", "dots", "circles", "accent"]);
// Reveal settle grace after the longest of enter/animation durations.
const REVEAL_SETTLE_GRACE_MS = 300;
const NO_INSIDE_STROKE_PX = 0;
const EMPTY_TIME_BOUND_MS = 0;
const FULL_SLOT_RATIO = 1;
const FIRST_POINT_INDEX = 0;
const INITIAL_REVEAL_EPOCH = 0;
const REVEAL_FLIP_DELAY_MS = 0;
const FALLBACK_Y_DOMAIN_MIN = 0;
const FALLBACK_Y_DOMAIN_MAX = 1;
// Bklit parity: y-domain pads low/high min/max by 5% (or flat 1); nice() comes from the scale.
const Y_DOMAIN_PAD_FRACTION = 0.05;

interface CandlestickChromeState {
  tooltip: ChartTooltipConfig | undefined;
  readonly dateLabels: string[];
}

// Legacy pattern names are an open string at the prop boundary; only known presets render.
const isCandlePatternPreset = (value: string): value is PatternPresetId =>
  CANDLE_PATTERN_PRESETS.has(value);

interface CandleRevealCycleParams {
  readonly animationDuration: number;
  readonly revealEpochRef: RefObject<number>;
  readonly canInteractRef: RefObject<boolean>;
  readonly revealDeadlineTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | undefined>;
  readonly setRevealed: (revealed: boolean) => void;
  /** Re-arm signal (bklit [animationDuration, revealSignature] deps). Changing it re-runs the reveal effect; the cycle itself needs no value from it, so it stays unread. */
  readonly signature: unknown;
}

/**
 * Clears a pending reveal-deadline timer (reveal-effect time).
 *
 * @param {{ current: ReturnType<typeof globalThis.setTimeout> | undefined }} timerRef - Mutable ref holding the deadline timer handle.
 * @returns {void} Nothing.
 */
const clearCandleRevealDeadline = (timerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | undefined>): void => {
  if (timerRef.current !== undefined) {
    globalThis.clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }
};

/**
 * Creates the reveal-effect cleanup clearing both timers (reveal-effect time).
 *
 * @param {number} flipTimer - Handle of the collapsed-to-target flip timer.
 * @param {{ current: ReturnType<typeof globalThis.setTimeout> | undefined }} revealDeadlineTimerRef - Mutable ref holding the deadline timer handle.
 * @returns {() => void} Cleanup clearing both timers.
 */
const createCandleRevealCleanup = (flipTimer: Readonly<ReturnType<typeof globalThis.setTimeout>>, revealDeadlineTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | undefined>): (() => void) => (): void => {
  globalThis.clearTimeout(flipTimer);
  clearCandleRevealDeadline(revealDeadlineTimerRef);
};

interface CandleRevealTimersParams {
  readonly epoch: number;
  readonly animationDuration: number;
  readonly revealEpochRef: RefObject<number>;
  readonly canInteractRef: RefObject<boolean>;
  readonly revealDeadlineTimerRef: RefObject<ReturnType<typeof globalThis.setTimeout> | undefined>;
  readonly setRevealed: (revealed: boolean) => void;
}

/**
 * Arms the reveal flip and interaction-deadline timers (reveal-effect time).
 *
 * @param {Readonly<CandleRevealTimersParams>} params - Epoch, refs, durations, and state setter.
 * @returns {() => void} Cleanup clearing both timers.
 */
const armCandleRevealTimers = (params: Readonly<CandleRevealTimersParams>): (() => void) => {
  const { epoch, animationDuration, revealEpochRef, canInteractRef, revealDeadlineTimerRef, setRevealed } = params;
  setRevealed(false);
  const flipTimer = globalThis.setTimeout(() => {
    if (revealEpochRef.current === epoch) {setRevealed(true);}
  }, REVEAL_FLIP_DELAY_MS);
  revealDeadlineTimerRef.current = globalThis.setTimeout(() => {
    if (revealEpochRef.current === epoch) {canInteractRef.current = true;}
  }, animationDuration);
  return createCandleRevealCleanup(flipTimer, revealDeadlineTimerRef);
};

/**
 * Runs one reveal cycle: resets interaction state, then arms timers unless animation is off.
 *
 * @param {Readonly<CandleRevealCycleParams>} params - Durations, epoch/interaction refs, and state setter.
 * @returns {(() => void) | undefined} Effect cleanup, or undefined when animation is disabled.
 */
const runCandleRevealCycle = (params: Readonly<CandleRevealCycleParams>): ((() => void) | undefined) => {
  const { animationDuration, revealEpochRef, canInteractRef, revealDeadlineTimerRef, setRevealed } = params;
  revealEpochRef.current += 1;
  const epoch = revealEpochRef.current;
  canInteractRef.current = false;
  clearCandleRevealDeadline(revealDeadlineTimerRef);
  if (animationDuration <= NO_ANIMATION_DURATION_MS) {
    canInteractRef.current = true;
    return undefined;
  }
  return armCandleRevealTimers({ animationDuration, canInteractRef, epoch, revealDeadlineTimerRef, revealEpochRef, setRevealed });
};

interface CandlePillContentParams {
  readonly centerX: number;
  readonly dateLabels: readonly string[] | undefined;
  readonly discrete: boolean;
  readonly formattedDate: string;
  readonly showing: boolean;
  readonly tickerIndex: number;
}

/**
 * Shows the date pill: layer visibility, ticker-or-formatted label, then jump-or-spring position.
 * First pill show jumps; later moves spring (mirrors legacy showing flag).
 *
 * @param {PillBuild} pillBuild - Live pill build (non-null when chrome is mounted).
 * @param {Readonly<CandlePillContentParams>} content - Label and positioning inputs.
 * @returns {void} Nothing.
 */
const displayCandlePill = (pillBuild: PillBuild, content: Readonly<CandlePillContentParams>): void => {
  const { centerX, dateLabels, discrete, formattedDate, showing, tickerIndex } = content;
  pillBuild.layer.style.display = "";
  if (pillBuild.ticker && dateLabels !== undefined && dateLabels.length > EMPTY_COUNT) {
    pillBuild.ticker.update(tickerIndex, discrete);
  } else {
    pillBuild.label.textContent = formattedDate;
  }
  if (showing || discrete) {pillBuild.spring.jump(centerX);}
  else {pillBuild.spring.set(centerX);}
};

interface CandlePillParams {
  readonly centerX: number;
  readonly dateLabels: readonly string[] | undefined;
  readonly formattedDate: string;
  readonly pillBuild: PillBuild | null;
  readonly pillVisibleRef: RefObject<boolean>;
  readonly rowCount: number;
  readonly showDatePill: boolean;
  readonly tickerIndex: number;
}

/**
 * Updates pill chrome for a focus change; hides it when the pill is disabled or unmounted.
 *
 * @param {Readonly<CandlePillParams>} params - Pill refs, visibility flags, and label inputs.
 * @returns {void} Nothing.
 */
const updateCandlePill = (params: Readonly<CandlePillParams>): void => {
  const { centerX, dateLabels, formattedDate, pillBuild, pillVisibleRef, rowCount, showDatePill, tickerIndex } = params;
  // Dense data snaps instead of springing (same threshold as every other chart).
  const discrete = rowCount > DISCRETE_INTERACTION_THRESHOLD;
  const showing = !pillVisibleRef.current;
  pillVisibleRef.current = true;
  if (pillBuild === null) {return;}
  if (!showDatePill) {
    pillBuild.layer.style.display = "none";
    return;
  }
  displayCandlePill(pillBuild, { centerX, dateLabels, discrete, formattedDate, showing, tickerIndex });
};

interface CandleLabelFadeState {
  readonly primaryX: number;
  readonly hoveredLabel: string | null;
}

interface CandleLabelFadeParams {
  readonly centerX: number;
  readonly hoveredLabel: string;
  readonly setLabelFade: Dispatch<SetStateAction<CandleLabelFadeState | null>>;
}

/**
 * Syncs the faded-axis label state to the hovered candle (hoveredLabel must match tick format).
 *
 * @param {Readonly<CandleLabelFadeParams>} params - Hover position, label, and state setter.
 * @returns {void} Nothing.
 */
const updateCandleLabelFade = (params: Readonly<CandleLabelFadeParams>): void => {
  const { centerX, hoveredLabel, setLabelFade } = params;
  // Returning prev when unchanged keeps React from scheduling a no-op render.
  setLabelFade((prev: Readonly<CandleLabelFadeState> | null) => (prev?.primaryX === centerX && prev.hoveredLabel === hoveredLabel ? prev : { hoveredLabel, primaryX: centerX }));
};

interface CandleTooltipModel {
  readonly tt: ChartTooltipConfig | undefined;
  readonly date: Date;
  readonly close: string | number;
  readonly pointRec: ChartTooltipPoint;
}

/**
 * Resolves the tooltip close value, preserving the legacy string fallback.
 *
 * @param {Readonly<ChartDatum>} datum - Raw candle row backing the hovered point.
 * @returns {string | number} Numeric close when number-typed, the raw string, or empty.
 */
const resolveCandleTooltipClose = (datum: Readonly<ChartDatum>): string | number => {
  const closeRaw = datum.close;
  if (isNumber(closeRaw)) {return closeRaw;}
  if (isString(closeRaw)) {return closeRaw;}
  return "";
};

/**
 * Resolves the tooltip model for a hovered candle (tooltip-render time).
 *
 * @param {ChartTooltipBodyRenderContext<ChartDatum, Date, number>} ctx - Tooltip render context with focus points.
 * @param {CandlestickChromeState | null} chromeState - Latest chrome snapshot (tooltip config plus date labels).
 * @returns {CandleTooltipModel | undefined} Model for panel building, or undefined with no points.
 */
const resolveCandleTooltipModel = (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>, chromeState: CandlestickChromeState | null): CandleTooltipModel | undefined => {
  if (ctx.points.length === EMPTY_COUNT) {return undefined;}
  const tt = chromeState?.tooltip ?? undefined;
  const bodyPoint = ctx.points.find((point) => point.markId === "bodies") ?? ctx.points[FIRST_POINT_INDEX];
  const { datum } = bodyPoint;
  const date = bodyPoint.xValue;
  const close = resolveCandleTooltipClose(datum);
  const pointRec = { close, date };
  return { close, date, pointRec, tt };
};

interface CandleTooltipPanel {
  readonly className: string;
  readonly style: CSSProperties | undefined;
}

/**
 * Builds the default close row for a hovered candle (no custom rows configured).
 *
 * @param {string | number} close - Resolved close value for the default row.
 * @returns {TooltipRow[]} The single default close row.
 */
const buildDefaultCandleCloseRow = (close: string | number): TooltipRow[] =>
  [{ color: "var(--chart-line-primary)", label: "close", value: close }];

/**
 * Resolves the tooltip panel class and style from the tooltip config (tooltip-render time).
 *
 * @param {ChartTooltipConfig | undefined} tt - Tooltip config snapshot, if the tooltip is enabled.
 * @returns {CandleTooltipPanel} Panel class name and optional overriding style.
 */
const resolveCandleTooltipPanel = (tt: ChartTooltipConfig | undefined): CandleTooltipPanel => {
  const panelClassName = tt?.className !== undefined && tt.className !== "" ? `bkm-tooltip-panel ${tt.className}` : "bkm-tooltip-panel";
  const backgroundOverride = tt?.backgroundColor !== undefined && tt.backgroundColor !== "" ? { backgroundColor: tt.backgroundColor } : undefined;
  const panelStyle: CSSProperties | undefined =
    tt !== undefined && (tt.panelStyle !== undefined || backgroundOverride !== undefined)
      ? { ...tt.panelStyle, ...backgroundOverride }
      : undefined;
  return { className: panelClassName, style: panelStyle };
};

interface CandleResolvedCandlestick {
  readonly animate: boolean;
  readonly bodyPatternNegative: string | undefined;
  readonly bodyPatternPositive: string | undefined;
  readonly fadedOpacity: number;
  readonly insideStrokeWidth: number;
  readonly showHoverFade: boolean;
}

interface CandlePatternSelection {
  readonly candlePatternDefsId: string;
  readonly negativePattern: CandlePatternRef;
  readonly positivePattern: CandlePatternRef;
  readonly resolvedCandlestick: CandleResolvedCandlestick;
  readonly solidFillFor: (isPositive: boolean, hasOwnPattern: boolean) => string;
}

interface CandlePatternsParams {
  readonly candlestick: CandlestickConfig | null;
}

/**
 * Resolves the candlestick child config plus the pattern refs and solid-fill rule.
 *
 * @param {Readonly<CandlePatternsParams>} params - The extracted candlestick child config.
 * @returns {CandlePatternSelection} Resolved config, pattern refs, and the solid-fill rule.
 */
const useCandlePatterns = (params: Readonly<CandlePatternsParams>): CandlePatternSelection => {
  const { candlestick } = params;
  const resolvedPositiveFill = candlestick?.positiveFill ?? SOLID_POSITIVE;
  const resolvedNegativeFill = candlestick?.negativeFill ?? SOLID_NEGATIVE;

  const resolvedCandlestick = useMemo(() => ({
    animate: candlestick?.animate ?? true,
    bodyPatternNegative: candlestick?.bodyPatternNegative,
    bodyPatternPositive: candlestick?.bodyPatternPositive,
    fadedOpacity: candlestick?.fadedOpacity ?? DEFAULT_FADED_OPACITY,
    insideStrokeWidth: candlestick?.insideStrokeWidth ?? NO_INSIDE_STROKE_PX,
    showHoverFade: candlestick?.showHoverFade ?? true,
  }), [candlestick]);

  // Legacy url(#id) strings pass through; other names render as pattern presets in this chart's defs.
  const candlePatternDefsId = useSanitizedId();
  const resolveCandlePattern = useCallback(
    (value: string | undefined, defsId: string): CandlePatternRef => {
      if (value === undefined || value === "" || value === "none") {return { href: "", preset: undefined };}
      const trimmed = value.trim();
      const urlMatch = /^url\(#[^)]+\)$/u.exec(trimmed);
      if (urlMatch) {return { href: trimmed, preset: undefined };}
      if (isCandlePatternPreset(trimmed)) {return { href: `url(#${defsId})`, preset: trimmed };}
      return { href: "", preset: undefined };
    },
    [],
  );
  const positivePattern = useMemo(
    () => resolveCandlePattern(
      resolvedCandlestick.bodyPatternPositive,
      `${candlePatternDefsId}-candle-pattern-pos`,
    ),
    [resolvedCandlestick.bodyPatternPositive, candlePatternDefsId, resolveCandlePattern],
  );
  const negativePattern = useMemo(
    () => resolveCandlePattern(
      resolvedCandlestick.bodyPatternNegative,
      `${candlePatternDefsId}-candle-pattern-neg`,
    ),
    [resolvedCandlestick.bodyPatternNegative, candlePatternDefsId, resolveCandlePattern],
  );
  // Pattern-overlay candles render wick+body in solid tokens, ignoring caller fill (bklit).
  const solidFillFor = useCallback((isPositive: boolean, hasOwnPattern: boolean) => {
    if (hasOwnPattern) {return isPositive ? PATTERN_FALLBACK_POSITIVE : PATTERN_FALLBACK_NEGATIVE;}
    return isPositive ? resolvedPositiveFill : resolvedNegativeFill;
  }, [resolvedPositiveFill, resolvedNegativeFill]);
  return { candlePatternDefsId, negativePattern, positivePattern, resolvedCandlestick, solidFillFor };
};

interface CandleRevealParams {
  readonly animationDuration: number;
  readonly animate: boolean;
  readonly enterTransition: CandlestickEnterTransition | undefined;
  /** Changing it re-arms the reveal (bklit [animationDuration, revealSignature] deps). */
  readonly revealSignature: unknown;
}

interface CandleRevealState {
  readonly canInteractRef: RefObject<boolean>;
  readonly revealed: boolean;
  readonly revealSettledRef: RefObject<boolean>;
}

/**
 * Owns the reveal epoch/interaction refs, the settled flag, and both reveal effects.
 *
 * @param {Readonly<CandleRevealParams>} params - Durations, animate flag, enter transition, and re-arm signal.
 * @returns {CandleRevealState} Interaction ref, revealed flag, and settle ref.
 */
const useCandleReveal = (params: Readonly<CandleRevealParams>): CandleRevealState => {
  const { animationDuration, animate, enterTransition, revealSignature } = params;
  const canInteractRef = useRef(false);
  const revealEpochRef = useRef(INITIAL_REVEAL_EPOCH);
  const revealDeadlineTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);

  // Mounts collapsed (center-anchored, height 0); a later revealed flip drives the animated update diff.
  const [revealed, setRevealed] = useState(
    () => animationDuration <= NO_ANIMATION_DURATION_MS || !animate,
  );
  const revealSettledRef = useRef(revealed);
  const revealSpanMs = useMemo(() => {
    const enterMs =
      enterTransition?.type === "tween"
        ? ((): number => {
            const resolved = resolveEnterTransition(enterTransition, TWEEN_FALLBACK);
            return resolved.kind === "tween" ? resolved.durationMs : NO_ANIMATION_DURATION_MS;
          })()
        : Math.max(MIN_ENTER_DURATION_MS, (enterTransition?.duration ?? DEFAULT_ENTER_DURATION_SEC) * MS_PER_SECOND);
    return Math.max(enterMs, animationDuration) + REVEAL_SETTLE_GRACE_MS;
  }, [enterTransition, animationDuration]);
  useEffect((): (() => void) | undefined => {
    if (!revealed) {
      revealSettledRef.current = false;
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      revealSettledRef.current = true;
    }, revealSpanMs);
    return (): void =>{  globalThis.clearTimeout(timer); };
  }, [revealed, revealSpanMs]);

  // Reveal deps are exactly [animationDuration, revealSignature] — data-only updates never replay.
  useEffect(() => runCandleRevealCycle({ animationDuration, canInteractRef, revealDeadlineTimerRef, revealEpochRef, setRevealed, signature: revealSignature }), [animationDuration, revealSignature]);

  return { canInteractRef, revealSettledRef, revealed };
};

interface CandleGeometryParams {
  readonly candleGap: number;
  readonly candleWidthProp: number | undefined;
  readonly margin: Readonly<{ readonly left: number; readonly right: number }>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly width: number;
  readonly xDataKey: string;
}

interface CandleGeometry {
  readonly bodyWidthPx: number;
  readonly innerWidth: number;
  readonly slotWidth: number;
  readonly timeExtent: CandleTimeExtent;
  readonly yDomain: [number, number];
}

/**
 * Owns the time extent, slot geometry, body width, and y domain.
 *
 * @param {Readonly<CandleGeometryParams>} params - Rows, width/margin, and candle sizing inputs.
 * @returns {CandleGeometry} Time extent, widths, and y domain.
 */
const useCandleGeometry = (params: Readonly<CandleGeometryParams>): CandleGeometry => {
  const { candleGap, candleWidthProp, margin, renderData, width, xDataKey } = params;
  const timeExtent = useMemo(() => findCandleTimeExtent(renderData, xDataKey) ?? { maxTime: EMPTY_TIME_BOUND_MS, minTime: EMPTY_TIME_BOUND_MS }, [renderData, xDataKey]);

  const innerWidth = Math.max(MIN_GEOMETRY_EXTENT_PX, width - margin.left - margin.right);

  const slotWidth = useMemo(
    () => innerWidth / Math.max(renderData.length, MIN_ROW_COUNT),
    [innerWidth, renderData.length],
  );

  // Bklit parity: candleWidth = min(override ?? slotWidth*(1-candleGap), slotWidth).
  const bodyWidthPx = useMemo(() => {
    const raw = candleWidthProp ?? slotWidth * (FULL_SLOT_RATIO - candleGap);
    return Math.min(raw, slotWidth);
  }, [candleWidthProp, slotWidth, candleGap]);



  // Bklit parity: y-domain pads low/high min/max by 5% (or flat 1); nice() comes from the scale.
  const yDomain = useMemo<[number, number]>(() => {
    const extremes = findCandleYExtremes(renderData);
    if (extremes === undefined) {return [FALLBACK_Y_DOMAIN_MIN, FALLBACK_Y_DOMAIN_MAX];}
    const pad = (extremes.max - extremes.min) * Y_DOMAIN_PAD_FRACTION || FLAT_EXTENT_FALLBACK_PX;
    return [extremes.min - pad, extremes.max + pad];
  }, [renderData]);

  return { bodyWidthPx, innerWidth, slotWidth, timeExtent, yDomain };
};

interface CandlePillChromeParams {
  readonly chartConfig: ChartConfigValue;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tooltip: ChartTooltipConfig | null | undefined;
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly xDataKey: string;
}

interface CandlePillChrome {
  readonly chromeStateRef: RefObject<CandlestickChromeState | null>;
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly overlayHostRef: RefObject<HTMLDivElement | null>;
  readonly pillRef: RefObject<PillBuild | null>;
  readonly pillVisibleRef: RefObject<boolean>;
}

/**
 * Owns the chrome snapshot, drag-suppression ref, and the date-pill overlay mount.
 *
 * @param {Readonly<CandlePillChromeParams>} params - Rows, tooltip inputs, width, and chart config.
 * @returns {CandlePillChrome} Chrome/drag refs plus the pill overlay refs.
 */
const useCandlePillChrome = (params: Readonly<CandlePillChromeParams>): CandlePillChrome => {
  const { chartConfig, renderData, tooltip, tooltipEnabled, width, xDataKey } = params;
  const chromeStateRef = useRef<CandlestickChromeState | null>(null);
  // Drag selection suppresses pill/label-fade chrome (native marks keep reacting).
  const dragSelectionActiveRef = useRef(false);
  const dateLabelsForPill = useMemo(() => renderData.map((datum: Readonly<ChartDatum>) => {
    const value = datum[xDataKey];
    if (value instanceof Date) {return shortDateFmt.format(value);}
    if (isString(value)) {return value;}
    if (isNumber(value) || value === true || value === false) {return String(value);}
    return "";
  }), [renderData, xDataKey]);
  // Latest-chrome sync runs post-commit so the render body stays pure.
  useEffect(() => {
    chromeStateRef.current = {
      dateLabels: dateLabelsForPill,
      tooltip: tooltip ?? undefined,
    };
  }, [dateLabelsForPill, tooltip]);

  const overlayHostRef = useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > EMPTY_CONTAINER_PX;

  const pillRef = useRef<PillBuild | null>(null);
  // First pill show jumps; later moves spring (mirrors legacy showing flag).
  const pillVisibleRef = useRef(false);

  useLayoutEffect((): (() => void) | undefined => {
    const el = overlayHostRef.current;
    // The overlay host mounts only under the chart definition (width > 0).
    if (!hasDefinition || !el || !tooltipEnabled) {return undefined;}
    const doc = el.ownerDocument;
    const pillBuild = buildPill(doc, chartConfig.tooltipSpring, () => chromeStateRef.current?.dateLabels ?? []);
    el.append(pillBuild.layer);
    pillRef.current = pillBuild;
    return (): void => {
      pillRef.current = null;
      pillVisibleRef.current = false;
      pillBuild.spring.stop();
      pillBuild.ticker?.detach();
      pillBuild.layer.remove();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig]);

  return { chromeStateRef, dragSelectionActiveRef, overlayHostRef, pillRef, pillVisibleRef };
};

interface CandleSelectionParams {
  readonly aspectRatio: string;
  readonly children: ReactNode;
  readonly clientToScene: FocusInjection<ChartDatum, Date, number>["clientToScene"];
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly hidePill: () => void;
  readonly innerWidth: number;
  readonly marginLeft: number;
  readonly renderData: ChartDatum[];
  readonly sceneRef: FocusInjection<ChartDatum, Date, number>["sceneRef"];
  readonly width: number;
  readonly xDataKey: string;
}

interface CandleSelectionState {
  readonly candleSelection: ChartSelection | null;
  readonly heightPxCandle: number;
  readonly segChildrenCandle: SegmentComponent[];
}

/**
 * Owns the reference-area children, drag selection, and segment children.
 *
 * @param {Readonly<CandleSelectionParams>} params - Rows, layout, scene refs, and drag callbacks.
 * @returns {CandleSelectionState} Selection, plot height, and segment children.
 */
const useCandleSelection = (params: Readonly<CandleSelectionParams>): CandleSelectionState => {
  const { aspectRatio, children, clientToScene, containerRef, dragSelectionActiveRef, hidePill, innerWidth, marginLeft, renderData, sceneRef, width, xDataKey } = params;
  const segChildrenCandle = useMemo(() => extractSegmentComponents(children), [children]);
  const heightPxCandle = width > EMPTY_CONTAINER_PX ? width / parseAspectRatio(aspectRatio) : COLLAPSED_GEOMETRY_PX;
  // Selection resolves through the host's live interaction/scene refs, not a duplicate scale.
  const invertSceneXCandle = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? undefined,
    [sceneRef],
  );
  const { selection: candleSelection } = useChartSelection({
    containerRef,
    data: renderData,
    enabled: true,
    innerWidth,
    invertSceneX: invertSceneXCandle,
    marginLeft,
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      hidePill();
    },
    resolveScenePos: clientToScene,
    xDataKey,
  });

  return { candleSelection, heightPxCandle, segChildrenCandle };
};

export type { CandleLabelFadeState };
export {
  buildDefaultCandleCloseRow,
  resolveCandleTooltipModel,
  resolveCandleTooltipPanel,
  updateCandleLabelFade,
  updateCandlePill,
  useCandleGeometry,
  useCandlePatterns,
  useCandlePillChrome,
  useCandleReveal,
  useCandleSelection,
};
