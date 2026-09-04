// Bklit FunnelChart as plain SVG (no TanStack funnel primitive; geometry is pure pixel arithmetic).
// One FunnelSegment per stage owns graphic + label overlay; keyed by stage.label (replay-vs-snap free).
import { createContext, useCallback, useContext, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode, Ref, RefObject } from 'react';
import { intFmt } from "./internal/formatters";
import { usePositiveChartSize } from "./internal/use-container-size";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { computeFunnelRings, funnelSegBox, hSegmentPath, resolveFunnelGrid, vSegmentPath } from './internal/funnel-geometry';
import type { FunnelRingGeometry, FunnelSegBox } from './internal/funnel-geometry';
import { createFunnelHoverCoordinator, createFunnelSegmentHoverRuntime } from './internal/funnel-hover-chrome';
import type { FunnelHoverCoordinator } from './internal/funnel-hover-chrome';
import { buildProgressKeyframes, FUNNEL_TWEEN_FALLBACK, resolveEnterTransition, revealTiming } from './internal/enter-transition';
import type { FunnelEnterTransition } from './internal/enter-transition';
import "./styles.css";

const FunnelOrientationContext = createContext<boolean>(false);

// Seconds-to-milliseconds scale for WAAPI reveal/label delays (staggerDelay is in seconds).
const MS_PER_SECOND = 1000;
// Extra label-fade lag after the segment reveal starts (seconds, bklit fixed tween).
const FUNNEL_LABEL_FADE_DELAY_OFFSET_S = 0.25;
// Fraction-to-percent scale (gradient offsets, stage share labels).
const FUNNEL_PERCENT_SCALE = 100;
// Edge-block share of a spread label cell (value/label bands vs the center pct band).
const FUNNEL_SPREAD_EDGE_SIZE = "16%";
// Shared flex-alignment keywords reused across spread/grouped label styles.
const FLEX_START = "flex-start";
const FLEX_END = "flex-end";
// Default ring-layer count when the layers prop is omitted (bklit parity).
const FUNNEL_DEFAULT_LAYERS = 3;
// Default reveal stagger between stages in seconds (bklit parity).
const FUNNEL_DEFAULT_STAGGER_DELAY_S = 0.12;
// Default gap between stages in pixels (bklit parity).
const FUNNEL_DEFAULT_GAP = 4;

type FunnelLabelOrientation = "vertical" | "horizontal";
type FunnelLabelAlign = "center" | "start" | "end";


// Grouped-label flex alignment lookup by labelAlign.
const FUNNEL_GROUPED_ALIGN_MAP = { center: "center", end: FLEX_END, start: FLEX_START } as const;

// Static spread-label cell styles (hoisted so every render reuses one identity).
const SPREAD_HORIZONTAL_VALUE_STYLE: CSSProperties = { alignItems: FLEX_END, display: "flex", height: FUNNEL_SPREAD_EDGE_SIZE, justifyContent: "center", paddingBottom: 4 };
const SPREAD_PCT_STYLE: CSSProperties = { alignItems: "center", display: "flex", flex: 1, justifyContent: "center" };
const SPREAD_HORIZONTAL_LABEL_STYLE: CSSProperties = { alignItems: FLEX_START, display: "flex", height: FUNNEL_SPREAD_EDGE_SIZE, justifyContent: "center", paddingTop: 4 };
const SPREAD_VERTICAL_VALUE_STYLE: CSSProperties = { alignItems: "center", display: "flex", justifyContent: FLEX_END, paddingRight: 8, width: FUNNEL_SPREAD_EDGE_SIZE };
const SPREAD_VERTICAL_LABEL_STYLE: CSSProperties = { alignItems: "center", display: "flex", justifyContent: FLEX_START, paddingLeft: 8, width: FUNNEL_SPREAD_EDGE_SIZE };
// Static svg/ring styles shared by every segment and grid layer.
const FUNNEL_SEGMENT_SVG_STYLE: CSSProperties = { height: "100%", inset: 0, overflow: "visible", position: "absolute", width: "100%" };
const FUNNEL_GRID_SVG_STYLE: CSSProperties = { height: "100%", inset: 0, pointerEvents: "none", position: "absolute", width: "100%" };
const FUNNEL_RING_STYLE: CSSProperties = { transformOrigin: "50% 50%" };

// Grouped-label container style as a function of its two computed inputs.
const buildGroupedLabelStyle = (groupedVertical: boolean, groupedAlign: FunnelLabelAlign): CSSProperties => ({
  alignItems: groupedVertical ? FUNNEL_GROUPED_ALIGN_MAP[groupedAlign] : FUNNEL_GROUPED_ALIGN_MAP.center,
  display: "flex",
  flexDirection: groupedVertical ? "column" : "row",
  gap: 6,
});

// Segment graphic/overlay frame styles as a function of the segment box.
const buildSegmentGraphicStyle = (box: Readonly<FunnelSegBox>): CSSProperties => ({
  height: box.height,
  left: box.left,
  overflow: "visible",
  pointerEvents: "none",
  position: "absolute",
  top: box.top,
  width: box.width,
  zIndex: 1,
});
const buildSegmentOverlayStyle = (box: Readonly<FunnelSegBox>): CSSProperties => ({
  cursor: "pointer",
  height: box.height,
  left: box.left,
  position: "absolute",
  top: box.top,
  width: box.width,
  zIndex: 20,
});

// Chart container style as a function of the computed aspect ratio plus the style prop.
const buildFunnelContainerStyle = (aspectRatio: string, style?: Readonly<CSSProperties>): CSSProperties => ({
  aspectRatio,
  overflow: "visible",
  position: "relative",
  userSelect: "none",
  width: "100%",
  ...style,
});

// Ring ref handler factory so the JSX prop is a call result, not an inline closure.
const createFunnelRingRefHandler = (
  onRingRef: (ringIndex: number, el: SVGPathElement | null) => void,
  ringIndex: number,
): Ref<SVGPathElement> => (el) => {
  onRingRef(ringIndex, el);
};

interface FunnelLabelSlots {
  readonly valueEl: ReactNode;
  readonly pctEl: ReactNode;
  readonly labelEl: ReactNode;
}

interface GroupedLabelOptions extends FunnelLabelSlots {
  readonly isHorizontal: boolean;
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign: FunnelLabelAlign;
}

interface OuterLabelStyleOptions {
  readonly labelLayout: "spread" | "grouped";
  readonly isHorizontal: boolean;
  readonly labelAlign: FunnelLabelAlign;
}

const buildSpreadLabelContent = (isHorizontal: boolean, slots: Readonly<FunnelLabelSlots>): ReactElement => {
  const { valueEl, pctEl, labelEl } = slots;
  if (isHorizontal) {
    return (
      <>
        <div style={SPREAD_HORIZONTAL_VALUE_STYLE}>
          {valueEl}
        </div>
        <div style={SPREAD_PCT_STYLE}>{pctEl}</div>
        <div style={SPREAD_HORIZONTAL_LABEL_STYLE}>
          {labelEl}
        </div>
      </>
    );
  }
  return (
    <>
      <div style={SPREAD_VERTICAL_VALUE_STYLE}>
        {valueEl}
      </div>
      <div style={SPREAD_PCT_STYLE}>{pctEl}</div>
      <div style={SPREAD_VERTICAL_LABEL_STYLE}>
        {labelEl}
      </div>
    </>
  );
}

const buildGroupedLabelContent = (options: Readonly<GroupedLabelOptions>): ReactElement => {
  const { isHorizontal, labelOrientation, labelAlign, valueEl, pctEl, labelEl } = options;
  const groupedOrientation = labelOrientation ?? (isHorizontal ? "vertical" : "horizontal");
  const groupedVertical = groupedOrientation === "vertical";
  const groupedAlign = isHorizontal ? "center" : labelAlign;
  return (
    <div
      style={buildGroupedLabelStyle(groupedVertical, groupedAlign)}
    >
      {valueEl}
      {pctEl}
      {labelEl}
    </div>
  );
}

const buildOuterLabelStyle = (options: Readonly<OuterLabelStyleOptions>): CSSProperties => {
  const { labelLayout, isHorizontal, labelAlign } = options;
  if (labelLayout === "spread") {
    return {
      alignItems: "center",
      display: "flex",
      flexDirection: isHorizontal ? "column" : "row",
      inset: 0,
      position: "absolute",
    };
  }
  return {
    alignItems: "center",
    display: "flex",
    flexDirection: isHorizontal ? "column" : "row",
    inset: 0,
    justifyContent: { center: "center", end: FLEX_END, start: FLEX_START }[labelAlign],
    padding: isHorizontal ? "8% 0" : "0 8%",
    position: "absolute",
  };
}

interface FunnelLabelFrame {
  readonly labelContent: ReactNode;
  readonly outerLabelStyle: CSSProperties;
}

const computeFunnelLabelLayout = (params: {
  labelLayout: "spread" | "grouped";
  isHorizontal: boolean;
  labelOrientation?: FunnelLabelOrientation;
  labelAlign: FunnelLabelAlign;
  valueEl: ReactNode;
  pctEl: ReactNode;
  labelEl: ReactNode;
}): FunnelLabelFrame => {
  const { labelLayout, isHorizontal, labelOrientation, labelAlign, valueEl, pctEl, labelEl } = params;
  const slots: FunnelLabelSlots = { labelEl, pctEl, valueEl };
  const labelContent: ReactNode = labelLayout === "spread"
    ? buildSpreadLabelContent(isHorizontal, slots)
    : buildGroupedLabelContent({ isHorizontal, labelAlign, labelEl, labelOrientation, pctEl, valueEl });
  const outerLabelStyle = buildOuterLabelStyle({ isHorizontal, labelAlign, labelLayout });
  return { labelContent, outerLabelStyle };
}


interface FunnelGradientStop {
  readonly offset: string | number;
  readonly color: string;
}

interface FunnelStage {
  readonly label: string;
  readonly value: number;
  readonly displayValue?: string;
  readonly color?: string;
  /** Linear gradient stops for this segment (priority over color); halos use the first stop. */
  readonly gradient?: readonly FunnelGradientStop[];
}

interface FunnelChartProps {
  readonly data: readonly FunnelStage[];
  readonly orientation?: "horizontal" | "vertical";
  readonly color?: string;
  readonly layers?: number;
  readonly className?: string;
  style?: CSSProperties;
  readonly showPercentage?: boolean;
  readonly showValues?: boolean;
  readonly showLabels?: boolean;
  readonly hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly formatPercentage?: (pct: number) => string;
  readonly formatValue?: (value: number) => string;
  readonly staggerDelay?: number;
  readonly enterTransition?: FunnelEnterTransition;
  readonly gap?: number;
  /** Render-prop for visx pattern defs; innermost ring takes fill="url(#id)", halos stay solid. */
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly edges?: "curved" | "straight";
  /** Label arrangement: "spread" (default) or "grouped" (with labelOrientation/labelAlign). */
  readonly labelLayout?: "spread" | "grouped";
  /** Stack direction of a grouped label group (orientation-dependent default). */
  readonly labelOrientation?: FunnelLabelOrientation;
  /** Position of the label group within the cell (start/center/end). */
  readonly labelAlign?: FunnelLabelAlign;
  readonly grid?:
    | boolean
    | {
        readonly bands?: boolean;
        readonly bandColor?: string;
        readonly lines?: boolean;
        readonly lineColor?: string;
        readonly lineOpacity?: number;
        readonly lineWidth?: number;
      };
}


const fmtPct = (pctValue: number): string => `${Math.round(pctValue)}%`;
const fmtVal = intFmt;


interface FunnelSegmentProps {
  readonly index: number;
  readonly stage: FunnelStage;
  readonly box: Readonly<FunnelSegBox>;
  readonly normStart: number;
  readonly normEnd: number;
  readonly segDim: number;
  readonly crossDim: number;
  readonly color: string;
  readonly layers: number;
  readonly staggerDelay: number;
  readonly enterTransition?: FunnelEnterTransition;
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly straight: boolean;
  readonly gradientStops?: readonly FunnelGradientStop[];
  readonly coordinator: Readonly<FunnelHoverCoordinator>;
  readonly pct: number;
  readonly showValues: boolean;
  readonly showPercentage: boolean;
  readonly showLabels: boolean;
  readonly formatPercentage: (pctValue: number) => string;
  readonly formatValue: (stageValue: number) => string;
  readonly labelLayout: "spread" | "grouped";
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign: FunnelLabelAlign;
}

// Innermost-ring fill precedence: pattern url, then gradient url, then the stage color.
interface ResolveRingFillOptions {
  readonly isInnermost: boolean;
  readonly hasPattern: boolean;
  readonly hasGradient: boolean;
  readonly patternId: string;
  readonly gradientId: string;
  readonly fallback: string;
}

const resolveRingFill = (options: Readonly<ResolveRingFillOptions>): string => {
  const { isInnermost, hasPattern, hasGradient, patternId, gradientId, fallback } = options;
  if (isInnermost && hasPattern) {return `url(#${patternId})`;}
  if (isInnermost && hasGradient) {return `url(#${gradientId})`;}
  return fallback;
};

// Segment DOM handles shared by the hover-sync and motion hooks below.
interface FunnelSegmentRefs {
  readonly graphicRef: RefObject<HTMLDivElement | null>;
  readonly labelRef: RefObject<HTMLDivElement | null>;
  readonly labelInnerRef: RefObject<HTMLDivElement | null>;
  readonly ringRefs: RefObject<(SVGPathElement | null)[]>;
  readonly setRingRef: (ringIndex: number, el: SVGPathElement | null) => void;
}

const useFunnelSegmentRefs = (): FunnelSegmentRefs => {
  const graphicRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const labelInnerRef = useRef<HTMLDivElement | null>(null);
  const ringRefs = useRef<(SVGPathElement | null)[]>([]);
  // Ring-attach writer owned by the hook that constructs ringRefs.
  const setRingRef = useCallback((ringIndex: number, el: SVGPathElement | null): void => {
    ringRefs.current[ringIndex] = el;
  }, [ringRefs]);
  return { graphicRef, labelInnerRef, labelRef, ringRefs, setRingRef };
};

interface FunnelSegmentHoverOptions {
  readonly graphicRef: RefObject<HTMLDivElement | null>;
  readonly labelRef: RefObject<HTMLDivElement | null>;
  readonly ringRefs: RefObject<(SVGPathElement | null)[]>;
  readonly index: number;
  readonly isHorizontal: boolean;
  readonly coordinator: Readonly<FunnelHoverCoordinator>;
  readonly ringCount: number;
}

const useFunnelSegmentHover = (options: Readonly<FunnelSegmentHoverOptions>): void => {
  const { graphicRef, labelRef, ringRefs, index, isHorizontal, coordinator, ringCount } = options;
  const runtimeRef = useRef<ReturnType<typeof createFunnelSegmentHoverRuntime> | null>(null);
  runtimeRef.current ??= createFunnelSegmentHoverRuntime();
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return (): void => {
        // Runtime absent: no hover subscription to clean up.
      };
    }
    // Cap the ring list at the current generation so ringCount stays a genuine dependency.
    const ringEls = ringRefs.current.filter((el): el is SVGPathElement => el !== null).slice(0, ringCount);
    runtime.update({
      graphicEl: graphicRef.current,
      index,
      isHorizontal,
      labelEl: labelRef.current,
      ringEls,
    });
    runtime.paint(coordinator.getHovered());
    return coordinator.subscribe(() =>{  runtime.paint(coordinator.getHovered()); });
  }, [coordinator, graphicRef, index, isHorizontal, labelRef, ringCount, ringRefs, ringRefs.current]);
  useEffect(() =>
    (): void => {
      runtimeRef.current?.stop();
    }
  , []);
};

interface GraphicEnterOptions {
  readonly el: HTMLDivElement;
  readonly index: number;
  readonly staggerDelay: number;
  readonly isHorizontal: boolean;
  readonly enterTransition: FunnelEnterTransition | undefined;
  readonly prefersReducedMotion: boolean;
}

const startGraphicEnterAnimation = (options: Readonly<GraphicEnterOptions>): (() => void) | undefined => {
  const { el, index, staggerDelay, isHorizontal, enterTransition, prefersReducedMotion } = options;
  if (prefersReducedMotion) {
    el.style.transform = "scale(1)";
    return undefined;
  }
  const timing = revealTiming(resolveEnterTransition(enterTransition, FUNNEL_TWEEN_FALLBACK));
  el.style.transformOrigin = isHorizontal ? "left center" : "center top";
  const keyframes = buildProgressKeyframes(timing, (progress) => ({ transform: `scale(${progress})` }));
  const anim = el.animate(keyframes, {
    delay: index * staggerDelay * MS_PER_SECOND,
    duration: timing.durationMs,
    easing: timing.easing,
    fill: "backwards",
  });
  anim.onfinish = (): void => {
    anim.cancel();
    el.style.transform = "scale(1)";
  };
  return (): void =>{  anim.cancel(); };
};

interface LabelFadeOptions {
  readonly el: HTMLDivElement;
  readonly index: number;
  readonly staggerDelay: number;
  readonly prefersReducedMotion: boolean;
}

const startLabelFadeAnimation = (options: Readonly<LabelFadeOptions>): (() => void) | undefined => {
  const { el, index, staggerDelay, prefersReducedMotion } = options;
  if (prefersReducedMotion) {
    el.style.opacity = "1";
    return undefined;
  }
  // Label fade uses bklit's fixed tween (delay index*staggerDelay+0.25, 0.35s easeOut), not enterTransition.
  const delayMs = (index * staggerDelay + FUNNEL_LABEL_FADE_DELAY_OFFSET_S) * MS_PER_SECOND;
  const anim = el.animate([{ opacity: 0 }, { opacity: 1 }], {
    delay: delayMs,
    duration: 350,
    easing: "ease-out",
    fill: "backwards",
  });
  anim.onfinish = (): void => {
    anim.cancel();
    el.style.opacity = "1";
  };
  return (): void =>{  anim.cancel(); };
};

interface FunnelSegmentMotionOptions {
  readonly graphicRef: RefObject<HTMLDivElement | null>;
  readonly labelInnerRef: RefObject<HTMLDivElement | null>;
  readonly index: number;
  readonly staggerDelay: number;
  readonly isHorizontal: boolean;
  readonly enterTransition: FunnelEnterTransition | undefined;
}

const useFunnelSegmentMotion = (options: Readonly<FunnelSegmentMotionOptions>): void => {
  const { graphicRef, labelInnerRef, index, staggerDelay, isHorizontal, enterTransition } = options;
  const prefersReducedMotion = usePrefersReducedMotion();
  // Latest enterTransition for the enter animation without retriggering it.
  const readEnterTransition = useEffectEvent((): FunnelEnterTransition | undefined => enterTransition);
  useEffect(() => {
    const el = graphicRef.current;
    if (!el) {
      return (): void => {
        // Element absent: no enter animation to cancel.
      };
    }
    return startGraphicEnterAnimation({ el, enterTransition: readEnterTransition(), index, isHorizontal, prefersReducedMotion, staggerDelay });
  }, [graphicRef, index, staggerDelay, isHorizontal, prefersReducedMotion]);
  useEffect(() => {
    const el = labelInnerRef.current;
    if (!el) {
      return (): void => {
        // Label element absent: no fade animation to cancel.
      };
    }
    return startLabelFadeAnimation({ el, index, prefersReducedMotion, staggerDelay });
  }, [index, labelInnerRef, staggerDelay, prefersReducedMotion]);
};

interface SegmentFrameOptions {
  readonly index: number;
  readonly normStart: number;
  readonly normEnd: number;
  readonly segDim: number;
  readonly crossDim: number;
  readonly layers: number;
  readonly isHorizontal: boolean;
  readonly straight: boolean;
}

interface SegmentFrame {
  readonly patternId: string;
  readonly gradientId: string;
  readonly viewBoxW: number;
  readonly viewBoxH: number;
  readonly rings: readonly Readonly<FunnelRingGeometry>[];
}

const resolveSegmentFrame = (options: Readonly<SegmentFrameOptions>): SegmentFrame => {
  const { index, normStart, normEnd, segDim, crossDim, layers, isHorizontal, straight } = options;
  const patternId = `funnel-${isHorizontal ? "h" : "v"}-pattern-${index}`;
  const gradientId = `funnel-${isHorizontal ? "h" : "v"}-grad-${index}`;
  const rings = computeFunnelRings(layers, (layerScale) =>
    isHorizontal
      ? hSegmentPath({ height: crossDim, layerScale, normEnd, normStart, segW: segDim, straight })
      : vSegmentPath({ layerScale, normEnd, normStart, segH: segDim, straight, width: crossDim }),
  );
  return { gradientId, patternId, rings, viewBoxH: isHorizontal ? crossDim : segDim, viewBoxW: isHorizontal ? segDim : crossDim };
};

interface FunnelDefsOptions {
  readonly gradientStops?: readonly FunnelGradientStop[];
  readonly gradientId: string;
  readonly patternId: string;
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly isHorizontal: boolean;
  readonly color: string;
}

const isNumber = <Subject,>(value: Subject): value is Subject & number => typeof value === "number";

const renderFunnelDefs = (options: Readonly<FunnelDefsOptions>): ReactElement => {
  const { gradientStops, gradientId, patternId, renderPattern, isHorizontal, color } = options;
  return (
    <defs>
      {gradientStops && (
        <linearGradient
          id={gradientId}
          x1="0"
          x2={isHorizontal ? "1" : "0"}
          y1="0"
          y2={isHorizontal ? "0" : "1"}
        >
          {gradientStops.map((stop) => (
            <stop
              key={`${stop.offset}-${stop.color}`}
              offset={isNumber(stop.offset) ? `${stop.offset * FUNNEL_PERCENT_SCALE}%` : stop.offset}
              stopColor={stop.color}
            />
          ))}
        </linearGradient>
      )}
      {renderPattern?.(patternId, color)}
    </defs>
  );
};

interface FunnelRingsOptions {
  readonly rings: readonly Readonly<FunnelRingGeometry>[];
  readonly patternId: string;
  readonly gradientId: string;
  readonly hasPattern: boolean;
  readonly hasGradient: boolean;
  readonly color: string;
  readonly onRingRef: (ringIndex: number, el: SVGPathElement | null) => void;
}

const renderFunnelRings = (options: Readonly<FunnelRingsOptions>): ReactNode => {
  const { rings, patternId, gradientId, hasPattern, hasGradient, color, onRingRef } = options;
  return rings.map((ring: Readonly<FunnelRingGeometry>) => {
    const isInnermost = ring.ringIndex === rings.length - 1;
    const ringFill: string = resolveRingFill({ fallback: color, gradientId, hasGradient, hasPattern, isInnermost, patternId });
    return (
      <path
        d={ring.path}
        fill={ringFill}
        key={`ring-${ring.ringIndex}`}
        opacity={ring.opacity}
        ref={createFunnelRingRefHandler(onRingRef, ring.ringIndex)}
        style={FUNNEL_RING_STYLE}
      />
    );
  });
};

interface SegmentLabelOptions {
  readonly stage: FunnelStage;
  readonly pct: number;
  readonly showValues: boolean;
  readonly showPercentage: boolean;
  readonly showLabels: boolean;
  readonly formatValue: (stageValue: number) => string;
  readonly formatPercentage: (pctValue: number) => string;
  readonly labelLayout: "spread" | "grouped";
  readonly isHorizontal: boolean;
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign: FunnelLabelAlign;
}

const resolveSegmentLabels = (options: Readonly<SegmentLabelOptions>): FunnelLabelFrame => {
  const { stage, pct, showValues, showPercentage, showLabels, formatValue, formatPercentage, labelLayout, isHorizontal, labelOrientation, labelAlign } = options;
  const display = stage.displayValue ?? formatValue(stage.value);
  const valueEl = showValues && <span className="ts-bkm-funnel-value">{display}</span>;
  const pctEl = showPercentage && <span className="ts-bkm-funnel-pct">{formatPercentage(pct)}</span>;
  const labelEl = showLabels && <span className="ts-bkm-funnel-label">{stage.label}</span>;
  return computeFunnelLabelLayout({ isHorizontal, labelAlign, labelEl, labelLayout, labelOrientation, pctEl, valueEl });
};

interface SegmentGraphicOptions {
  readonly graphicRef: RefObject<HTMLDivElement | null>;
  readonly box: Readonly<FunnelSegBox>;
  readonly frame: Readonly<SegmentFrame>;
  readonly color: string;
  readonly gradientStops?: readonly FunnelGradientStop[];
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly isHorizontal: boolean;
  readonly onRingRef: (ringIndex: number, el: SVGPathElement | null) => void;
}

const renderSegmentGraphic = (options: Readonly<SegmentGraphicOptions>): ReactElement => {
  const { graphicRef, box, frame, color, gradientStops, renderPattern, isHorizontal, onRingRef } = options;
  return (
    <div
      ref={graphicRef}
      style={buildSegmentGraphicStyle(box)}
    >
      <svg
        aria-hidden="true"
        preserveAspectRatio="none"
        role="presentation"
        style={FUNNEL_SEGMENT_SVG_STYLE}
        viewBox={`0 0 ${frame.viewBoxW} ${frame.viewBoxH}`}
      >
        {renderFunnelDefs({ color, gradientId: frame.gradientId, gradientStops, isHorizontal, patternId: frame.patternId, renderPattern })}
        {renderFunnelRings({ color, gradientId: frame.gradientId, hasGradient: Boolean(gradientStops), hasPattern: Boolean(renderPattern), onRingRef, patternId: frame.patternId, rings: frame.rings })}
      </svg>
    </div>
  );
};

interface SegmentOverlayOptions {
  readonly labelRef: RefObject<HTMLDivElement | null>;
  readonly labelInnerRef: RefObject<HTMLDivElement | null>;
  readonly box: Readonly<FunnelSegBox>;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
  readonly outerLabelStyle: CSSProperties;
  readonly labelContent: ReactNode;
}

// Keep cursor-pointer: the QA harness discovers hover cells via #chart-root .cursor-pointer.
const renderSegmentOverlay = (options: Readonly<SegmentOverlayOptions>): ReactElement => {
  const { labelRef, labelInnerRef, box, onPointerEnter, onPointerLeave, outerLabelStyle, labelContent } = options;
  return (
    <div
      className="cursor-pointer"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      ref={labelRef}
      style={buildSegmentOverlayStyle(box)}
    >
      <div ref={labelInnerRef} style={outerLabelStyle}>
        {labelContent}
      </div>
    </div>
  );
};

interface FunnelPointerHandlers {
  readonly handlePointerEnter: () => void;
  readonly handlePointerLeave: () => void;
}

// Hover request callbacks shared by the segment overlay; split so the model hook stays small.
const useFunnelPointerHandlers = (coordinator: Readonly<FunnelHoverCoordinator>, index: number): FunnelPointerHandlers => {
  const handlePointerEnter = useCallback(() =>{  coordinator.requestHover(index); }, [coordinator, index]);
  const handlePointerLeave = useCallback(() =>{  coordinator.requestUnhover(); }, [coordinator]);
  return { handlePointerEnter, handlePointerLeave };
};

interface FunnelSegmentContent {
  readonly handlePointerEnter: () => void;
  readonly handlePointerLeave: () => void;
  readonly segmentLabels: FunnelLabelFrame;
}

// Segment content: hover callbacks and label layout for one funnel stage.
// Refs, frame geometry, and motion wiring stay in FunnelSegment.
const useFunnelSegmentContent = (props: Readonly<FunnelSegmentProps>, isHorizontal: boolean): FunnelSegmentContent => {
  const { coordinator, index, stage, pct, showValues, showPercentage, showLabels, formatPercentage, formatValue, labelLayout, labelOrientation, labelAlign } = props;
  const { handlePointerEnter, handlePointerLeave } = useFunnelPointerHandlers(coordinator, index);
  const segmentLabels = resolveSegmentLabels({ formatPercentage, formatValue, isHorizontal, labelAlign, labelLayout, labelOrientation, pct, showLabels, showPercentage, showValues, stage });
  return { handlePointerEnter, handlePointerLeave, segmentLabels };
};

const FunnelSegment = (props: Readonly<FunnelSegmentProps>): ReactElement => {
  const { box, color, gradientStops, renderPattern } = props;
  const isHorizontal = useContext(FunnelOrientationContext);
  const { graphicRef, labelRef, labelInnerRef, ringRefs, setRingRef } = useFunnelSegmentRefs();
  const frame = resolveSegmentFrame({ crossDim: props.crossDim, index: props.index, isHorizontal, layers: props.layers, normEnd: props.normEnd, normStart: props.normStart, segDim: props.segDim, straight: props.straight });
  useFunnelSegmentHover({ coordinator: props.coordinator, graphicRef, index: props.index, isHorizontal, labelRef, ringCount: frame.rings.length, ringRefs });
  useFunnelSegmentMotion({ enterTransition: props.enterTransition, graphicRef, index: props.index, isHorizontal, labelInnerRef, staggerDelay: props.staggerDelay });
  const content = useFunnelSegmentContent(props, isHorizontal);
  return (
    <>
      {renderSegmentGraphic({ box, color, frame, gradientStops, graphicRef, isHorizontal, onRingRef: setRingRef, renderPattern })}
      {renderSegmentOverlay({ box, labelContent: content.segmentLabels.labelContent, labelInnerRef, labelRef, onPointerEnter: content.handlePointerEnter, onPointerLeave: content.handlePointerLeave, outerLabelStyle: content.segmentLabels.outerLabelStyle })}
    </>
  );
};


const useFunnelHoverCoordinator = (
  hoveredIndexProp: number | null | undefined,
  onHoverChange: ((index: number | null) => void) | undefined,
): FunnelHoverCoordinator => {
  // Controlled/uncontrolled hover split matches bklit FunnelChart.setHoveredIndex exactly.
  const isControlled = hoveredIndexProp !== undefined;
  const isControlledRef = useRef(isControlled);
  const onHoverChangeRef = useRef(onHoverChange);
  useEffect(() => {
    isControlledRef.current = isControlled;
    onHoverChangeRef.current = onHoverChange;
  }, [isControlled, onHoverChange]);

  // Created once via lazy state init (render-pure); the callbacks read latest props through refs.
  const [coordinator] = useState<FunnelHoverCoordinator>(() => createFunnelHoverCoordinator(
    (index) => onHoverChangeRef.current?.(index),
    () => isControlledRef.current,
  ));

  useEffect(() => {
    if (hoveredIndexProp !== undefined) {
      coordinator.setHovered(hoveredIndexProp);
    }
  }, [hoveredIndexProp, coordinator]);
  return coordinator;
};

interface FunnelLayoutOptions {
  readonly data: readonly FunnelStage[];
  readonly baseValue: number;
  readonly chartW: number;
  readonly chartH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly gridProp: FunnelChartProps["grid"];
}

interface FunnelChartFrame {
  readonly stageCount: number;
  readonly norms: readonly number[];
  readonly segW: number;
  readonly segH: number;
  readonly grid: ReturnType<typeof resolveFunnelGrid>;
  readonly hasChartArea: boolean;
  readonly showBandGrid: boolean;
  readonly showLineGrid: boolean;
  readonly isHorizontal: boolean;
  readonly aspectRatio: string;
}

const computeFunnelChartFrame = (options: Readonly<FunnelLayoutOptions>): FunnelChartFrame => {
  const { data, baseValue, chartW, chartH, gap, isHorizontal, gridProp } = options;
  const stageCount = data.length;
  const norms = data.map((stage) => stage.value / baseValue);
  const totalGap = gap * (stageCount - 1);
  const segW = (chartW - (isHorizontal ? totalGap : 0)) / stageCount;
  const segH = (chartH - (isHorizontal ? 0 : totalGap)) / stageCount;
  const grid = resolveFunnelGrid(gridProp);
  return {
    aspectRatio: isHorizontal ? "2.2 / 1" : "1 / 1.8",
    grid,
    hasChartArea: chartW > 0 && chartH > 0,
    isHorizontal,
    norms,
    segH,
    segW,
    showBandGrid: grid.enabled,
    showLineGrid: grid.enabled && grid.showGridLines,
    stageCount,
  };
};

interface BandGridOptions {
  readonly data: readonly FunnelStage[];
  readonly segW: number;
  readonly segH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly grid: ReturnType<typeof resolveFunnelGrid>;
  readonly chartW: number;
  readonly chartH: number;
}

const renderBandGrid = (options: Readonly<BandGridOptions>): ReactElement => {
  const { data, segW, segH, gap, isHorizontal, grid, chartW, chartH } = options;
  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      role="presentation"
      style={FUNNEL_GRID_SVG_STYLE}
      viewBox={`0 0 ${chartW} ${chartH}`}
    >
      {grid.showBands &&
        data.map((stage, stageIndex) => {
          if (stageIndex % 2 !== 0) {return false;}
          return isHorizontal ? (
            <rect fill={grid.bandColor} height={chartH} key={`band-${stage.label}`} width={segW} x={(segW + gap) * stageIndex} y={0} />
          ) : (
            <rect fill={grid.bandColor} height={segH} key={`band-${stage.label}`} width={chartW} x={0} y={(segH + gap) * stageIndex} />
          );
        })}
    </svg>
  );
};

interface LineGridOptions {
  readonly stageCount: number;
  readonly segW: number;
  readonly segH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly grid: ReturnType<typeof resolveFunnelGrid>;
  readonly chartW: number;
  readonly chartH: number;
}

const renderLineGrid = (options: Readonly<LineGridOptions>): ReactElement => {
  const { stageCount, segW, segH, gap, isHorizontal, grid, chartW, chartH } = options;
  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      role="presentation"
      style={FUNNEL_GRID_SVG_STYLE}
      viewBox={`0 0 ${chartW} ${chartH}`}
    >
      {Array.from({ length: stageCount - 1 }, (_unused, stageIndex) => {
        const gridIndex = stageIndex + 1;
        const gridKey = `grid-${gridIndex}`;
        if (isHorizontal) {
          const gridX = segW * gridIndex + gap * stageIndex + gap / 2;
          return (
            <line
              key={gridKey}
              stroke={grid.gridLineColor}
              strokeOpacity={grid.gridLineOpacity}
              strokeWidth={grid.gridLineWidth}
              x1={gridX}
              x2={gridX}
              y1={0}
              y2={chartH}
            />
          );
        }
        const gridY = segH * gridIndex + gap * stageIndex + gap / 2;
        return (
          <line
            key={gridKey}
            stroke={grid.gridLineColor}
            strokeOpacity={grid.gridLineOpacity}
            strokeWidth={grid.gridLineWidth}
            x1={0}
            x2={chartW}
            y1={gridY}
            y2={gridY}
          />
        );
      })}
    </svg>
  );
};

interface FunnelStageNodeOptions {
  readonly stage: FunnelStage;
  readonly index: number;
  readonly frame: Readonly<FunnelChartFrame>;
  readonly baseValue: number;
  readonly chartW: number;
  readonly chartH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly color: string;
  readonly layers: number;
  readonly staggerDelay: number;
  readonly enterTransition?: FunnelEnterTransition;
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly edges: "curved" | "straight";
  readonly coordinator: Readonly<FunnelHoverCoordinator>;
  readonly showValues: boolean;
  readonly showPercentage: boolean;
  readonly showLabels: boolean;
  readonly formatPercentage: (pctValue: number) => string;
  readonly formatValue: (stageValue: number) => string;
  readonly labelLayout: "spread" | "grouped";
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign: FunnelLabelAlign;
}

const renderFunnelStage = (options: Readonly<FunnelStageNodeOptions>): ReactElement => {
  const { stage, index, frame, baseValue, chartW, chartH, gap, isHorizontal, edges } = options;
  const normStart = frame.norms[index] ?? 0;
  const normEnd = frame.norms[Math.min(index + 1, frame.stageCount - 1)] ?? 0;
  const firstStop = stage.gradient?.[0];
  const segColor = firstStop ? firstStop.color : (stage.color ?? options.color);
  const box = funnelSegBox({ boxHeight: chartH, boxWidth: chartW, gap, horiz: isHorizontal, segH: frame.segH, segIndex: index, segW: frame.segW });
  const pct = (stage.value / baseValue) * FUNNEL_PERCENT_SCALE;
  return (
    <FunnelSegment
      box={box}
      color={segColor}
      coordinator={options.coordinator}
      crossDim={isHorizontal ? chartH : chartW}
      enterTransition={options.enterTransition}
      formatPercentage={options.formatPercentage}
      formatValue={options.formatValue}
      gradientStops={stage.gradient}
      index={index}
      key={stage.label}
      labelAlign={options.labelAlign}
      labelLayout={options.labelLayout}
      labelOrientation={options.labelOrientation}
      layers={options.layers}
      normEnd={normEnd}
      normStart={normStart}
      pct={pct}
      renderPattern={options.renderPattern}
      segDim={isHorizontal ? frame.segW : frame.segH}
      showLabels={options.showLabels}
      showPercentage={options.showPercentage}
      showValues={options.showValues}
      stage={stage}
      staggerDelay={options.staggerDelay}
      straight={edges === "straight"}
    />
  );
};


interface FunnelFrameInput {
  readonly data: readonly FunnelStage[];
  readonly chartW: number;
  readonly chartH: number;
  readonly gap: number;
  readonly gridProp: FunnelChartProps["grid"];
  readonly isHorizontal: boolean;
}

interface ResolvedFunnelFrame {
  readonly baseValue: number;
  readonly frame: FunnelChartFrame;
}

// Empty-data guard plus frame computation; undefined means the chart renders null.
// Percentage basis is data[0].value, not the series max (bklit parity).
const resolveFunnelChartFrame = (input: Readonly<FunnelFrameInput>): ResolvedFunnelFrame | undefined => {
  const { data, chartW, chartH, gap, gridProp, isHorizontal } = input;
  if (data.length === 0) {return undefined;}
  const first = data.at(0);
  if (first === undefined) {return undefined;}
  return { baseValue: first.value, frame: computeFunnelChartFrame({ baseValue: first.value, chartH, chartW, data, gap, gridProp, isHorizontal }) };
};

interface FunnelStagesOptions extends Omit<FunnelStageNodeOptions, "index" | "stage"> {
  readonly data: readonly FunnelStage[];
}

const renderFunnelStages = (options: Readonly<FunnelStagesOptions>): ReactNode => {
  const { data, ...stageOptions } = options;
  return data.map((stage, index) => renderFunnelStage({ ...stageOptions, index, stage }));
};

interface FunnelChartBodyOptions {
  readonly baseValue: number;
  readonly chartH: number;
  readonly chartW: number;
  readonly color: string;
  readonly coordinator: Readonly<FunnelHoverCoordinator>;
  readonly data: readonly FunnelStage[];
  readonly edges: "curved" | "straight";
  readonly enterTransition?: Readonly<FunnelEnterTransition>;
  readonly formatPercentage: (pctValue: number) => string;
  readonly formatValue: (stageValue: number) => string;
  readonly frame: Readonly<FunnelChartFrame>;
  readonly gap: number;
  readonly labelAlign: FunnelLabelAlign;
  readonly labelLayout: "spread" | "grouped";
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly layers: number;
  readonly renderPattern?: (id: string, color: string) => ReactNode;
  readonly showLabels: boolean;
  readonly showPercentage: boolean;
  readonly showValues: boolean;
  readonly staggerDelay: number;
}

// Chart-area content: band grid, stage segments, and line grid.
const renderFunnelChartBody = (options: Readonly<FunnelChartBodyOptions>): ReactElement => {
  const { baseValue, chartH, chartW, frame, gap } = options;
  return (
    <>
      {frame.showBandGrid && renderBandGrid({ chartH, chartW, data: options.data, gap, grid: frame.grid, isHorizontal: frame.isHorizontal, segH: frame.segH, segW: frame.segW })}
      {renderFunnelStages({ baseValue, chartH, chartW, color: options.color, coordinator: options.coordinator, data: options.data, edges: options.edges, enterTransition: options.enterTransition, formatPercentage: options.formatPercentage, formatValue: options.formatValue, frame, gap, isHorizontal: frame.isHorizontal, labelAlign: options.labelAlign, labelLayout: options.labelLayout, labelOrientation: options.labelOrientation, layers: options.layers, renderPattern: options.renderPattern, showLabels: options.showLabels, showPercentage: options.showPercentage, showValues: options.showValues, staggerDelay: options.staggerDelay })}
      {frame.showLineGrid && renderLineGrid({ chartH, chartW, gap, grid: frame.grid, isHorizontal: frame.isHorizontal, segH: frame.segH, segW: frame.segW, stageCount: frame.stageCount })}
    </>
  );
};


const FunnelChart = ({
  data,
  orientation = "horizontal",
  color = "var(--chart-1)",
  layers = FUNNEL_DEFAULT_LAYERS,
  className,
  style,
  showPercentage = true,
  showValues = true,
  showLabels = true,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  formatPercentage = fmtPct,
  formatValue = fmtVal,
  staggerDelay = FUNNEL_DEFAULT_STAGGER_DELAY_S,
  enterTransition,
  gap = FUNNEL_DEFAULT_GAP,
  renderPattern,
  edges = "curved",
  labelLayout = "spread",
  labelOrientation,
  labelAlign = "center",
  grid: gridProp = false,
}: Readonly<FunnelChartProps>): ReactElement | null => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sz = usePositiveChartSize(containerRef);
  const coordinator = useFunnelHoverCoordinator(hoveredIndexProp, onHoverChange);
  const resolved = resolveFunnelChartFrame({ chartH: sz.height, chartW: sz.width, data, gap, gridProp, isHorizontal: orientation === "horizontal" });
  if (resolved === undefined) {
    return null;
  }
  const { baseValue, frame } = resolved;

  return (
    <FunnelOrientationContext.Provider value={frame.isHorizontal}>
      <div
      className={className}
      data-bkm-chart="funnel"
      ref={containerRef}
      style={buildFunnelContainerStyle(frame.aspectRatio, style)}
    >
      {frame.hasChartArea && renderFunnelChartBody({ baseValue, chartH: sz.height, chartW: sz.width, color, coordinator, data, edges, enterTransition, formatPercentage, formatValue, frame, gap, labelAlign, labelLayout, labelOrientation, layers, renderPattern, showLabels, showPercentage, showValues, staggerDelay })}
    </div>
    </FunnelOrientationContext.Provider>
  );
};

export type { FunnelGradientStop, FunnelStage, FunnelChartProps };
export { FunnelChart };
export type { FunnelEnterTransition } from "./internal/enter-transition";
