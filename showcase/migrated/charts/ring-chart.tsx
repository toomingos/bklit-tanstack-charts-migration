// Bklit RingChart on TanStack Charts (radialArc track+progress per ring; children are carriers).
// Track entrance stays a WAAPI scale-pop (no native arc primitive); hover scale is reactive geometry.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { defineChart } from "@tanstack/charts/scene";
import { polar, radialArc } from "@tanstack/charts/polar";
import { pieArcPath } from "./internal/pie-geometry";
import { RingHoverCoordinatorContext, RingStableContext, defaultRingColors } from "./internal/ring-context";
import type { RingData, RingStableValue, ScrubRingLayer } from "./internal/ring-context";
import { ringHoverScale } from './internal/ring-hover-chrome';
import { HOVER_SPRING, motionEasingFromCss } from "./internal/pie-hover-chrome";
import { RING_TWEEN_FALLBACK, resolveEnterTransition } from './internal/enter-transition';
import type { ResolvedTiming, RingEnterTransition } from './internal/enter-transition';
import { nativeStaggerDelayMs } from "./internal/native-stagger";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { useDebouncedContainerSize } from "./internal/use-container-size";
import { MARKS_GROUP_SELECTOR, classifyChildren, useRingHoverState, useRingPointer, useRingReveal } from "./internal/ring-chart-model";
import type { RingChildConfig, RingProps } from "./internal/ring-chart-model";
import "./styles.css";

const RING_BACKGROUND = "var(--border)";
const MS_PER_SECOND = 1000;
const RING_END_ANGLE_FACTOR = 3;
const RING_PROGRESS_EPSILON = 0.01;
const RING_LOAD_DELAY_MS = 100;
const RING_PROGRESS_STAGGER_EACH_S = 0.1;
const RING_PROGRESS_STAGGER_OFFSET_S = 0.6;
const RING_MIN_PROGRESS = 0.001;
const RING_MIN_RENDER_SIZE = 10;

// Static subtree styles; hoisted so no object is allocated per render.
const SCRUB_SVG_STYLE = { contain: "layout style paint" } as const;
const RING_CENTER_OVERLAY_STYLE = { alignItems: "center", display: "flex", inset: 0, justifyContent: "center", pointerEvents: "none", position: "absolute" } as const;

interface RingArcGeometry {
  readonly innerRatio: number;
  readonly outerRatio: number;
  readonly cornerRatio: number;
  readonly hoverScale: number;
}

interface RingMarkPairInput {
  readonly arcMarks: AnyRadialArcMark[];
  readonly index: number;
  readonly ringData: Readonly<RingData>;
  readonly config: Readonly<RingChildConfig> | undefined;
  readonly getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };
  readonly getColor: (index: number) => string;
  readonly availableRadius: number;
  readonly liveHoveredIndex: number | null;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly arcRange: number;
  readonly progressStaggerEachMs: number;
  readonly progressStaggerOffsetMs: number;
  readonly enterTransition: RingEnterTransition | undefined;
  readonly enterStaggerScale: number;
}

// Hover scale multiplies radii (1.03 hovered / 1.02 pushed-out / 1 rest — bklit parity).
const resolveRingArcGeometry = (params: Readonly<{ availableRadius: number; config: Readonly<RingChildConfig> | undefined; index: number; innerRadius: number; outerRadius: number; liveHoveredIndex: number | null }>): RingArcGeometry => {
  const cornerPx = params.config?.lineCap === "round" ? (params.outerRadius - params.innerRadius) / 2 : 0;
  const isHovered = params.liveHoveredIndex === params.index;
  const isPushedOut = params.liveHoveredIndex !== null && params.liveHoveredIndex < params.index;
  return {
    cornerRatio: cornerPx / params.availableRadius,
    hoverScale: ringHoverScale(isHovered, isPushedOut),
    innerRatio: params.innerRadius / params.availableRadius,
    outerRatio: params.outerRadius / params.availableRadius,
  };
};

const resolveRingColor = (params: Readonly<{ config: Readonly<RingChildConfig> | undefined; getColor: (index: number) => string; index: number }>): string => {
  const configColor = params.config?.color;
  return configColor !== undefined && configColor !== "" ? configColor : params.getColor(params.index);
};

const resolveRingProgress = (ringData: Readonly<RingData>): number => {
  if (ringData.maxValue <= 0) {return 0;}
  return Math.min(1, Math.max(0, ringData.value / ringData.maxValue));
};

interface RingTrackMarkInput {
  readonly arcMarks: AnyRadialArcMark[];
  readonly index: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly geometry: Readonly<RingArcGeometry>;
}

const appendRingTrackMark = (params: Readonly<RingTrackMarkInput>): void => {
  const { arcMarks, index, startAngle, endAngle, geometry } = params;
  const trackRow: RingArcDatum = { endAngle, startAngle };
  // Track enter stays WAAPI: motion false suppresses native's clip sweep underneath it.
  arcMarks.push(
    radialArc<RingArcDatum>([trackRow], {
      cornerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * geometry.cornerRatio * geometry.hoverScale,
      fill: RING_BACKGROUND,
      id: `ring-${index}-track`,
      innerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * geometry.innerRatio * geometry.hoverScale,
      key: () => "track",
      motion: (ctx: Readonly<{ phase: string }>) => {
        if (ctx.phase === "enter") {return false;}
        return { transition: { damping: HOVER_SPRING.damping, stiffness: HOVER_SPRING.stiffness, type: "spring" } };
      },
      opacity: 1,
      outerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * geometry.outerRatio * geometry.hoverScale,
    }),
  );
};

interface RingProgressMarkInput {
  readonly arcMarks: AnyRadialArcMark[];
  readonly index: number;
  readonly color: string;
  readonly progress: number;
  readonly startAngle: number;
  readonly arcRange: number;
  readonly geometry: Readonly<RingArcGeometry>;
  readonly progressStaggerEachMs: number;
  readonly progressStaggerOffsetMs: number;
  readonly enterTransition: RingEnterTransition | undefined;
  readonly enterStaggerScale: number;
}

const appendRingProgressMark = (params: Readonly<RingProgressMarkInput>): void => {
  if (params.progress <= RING_MIN_PROGRESS) {return;}
  const progressEnterDelayMs = nativeStaggerDelayMs(params.progressStaggerEachMs, params.progressStaggerOffsetMs, params.index, "arc");
  const progressRow: RingArcDatum = {
    endAngle: params.startAngle + params.arcRange * params.progress,
    startAngle: params.startAngle,
  };
  params.arcMarks.push(
    radialArc<RingArcDatum>([progressRow], {
      cornerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * params.geometry.cornerRatio * params.geometry.hoverScale,
      fill: params.color,
      id: `ring-${params.index}-progress`,
      innerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * params.geometry.innerRatio * params.geometry.hoverScale,
      key: () => "progress",
      // Progress entrance is native's default arc sweep; only the delay (+ caller transition) is authored.
      motion: (ctx: Readonly<{ phase: string }>) => {
        if (ctx.phase === "enter") {
          if (!params.enterTransition) {return { delay: progressEnterDelayMs };}
          const resolved: ResolvedTiming = resolveEnterTransition(params.enterTransition, RING_TWEEN_FALLBACK);
          return {
            delay: progressEnterDelayMs,
            transition:
              resolved.kind === "spring"
                ? { damping: resolved.damping, mass: resolved.mass, stiffness: resolved.stiffness, type: "spring" }
                : { duration: resolved.durationMs, easing: motionEasingFromCss(resolved.easingCss), type: "tween" },
          };
        }
        return { transition: { damping: HOVER_SPRING.damping, stiffness: HOVER_SPRING.stiffness, type: "spring" } };
      },
      opacity: 1,
      outerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * params.geometry.outerRatio * params.geometry.hoverScale,
    }),
  );
};

const appendRingArcMarks = (params: Readonly<RingMarkPairInput>): void => {
  const { arcMarks, index, ringData, config, getRingRadii, getColor, availableRadius, liveHoveredIndex } = params;
  const { innerRadius, outerRadius } = getRingRadii(index);
  const geometry = resolveRingArcGeometry({ availableRadius, config, index, innerRadius, liveHoveredIndex, outerRadius });
  const color = resolveRingColor({ config, getColor, index });
  const progress = resolveRingProgress(ringData);
  appendRingTrackMark({ arcMarks, endAngle: params.endAngle, geometry, index, startAngle: params.startAngle });
  appendRingProgressMark({ arcMarks, arcRange: params.arcRange, color, enterStaggerScale: params.enterStaggerScale, enterTransition: params.enterTransition, geometry, index, progress, progressStaggerEachMs: params.progressStaggerEachMs, progressStaggerOffsetMs: params.progressStaggerOffsetMs, startAngle: params.startAngle });
};

interface RingChartProps {
  readonly data: readonly RingData[];
  readonly size?: number;
  strokeWidth?: number;
  readonly ringGap?: number;
  readonly baseInnerRadius?: number;
  readonly animationDuration?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly startAngle?: number;
  readonly endAngle?: number;
  readonly enterTransition?: RingEnterTransition;
  readonly enterStaggerScale?: number;
  readonly geometryScrubbing?: boolean;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

interface RingArcDatum {
  readonly startAngle: number;
  readonly endAngle: number;
}

type AnyRadialArcMark = ReturnType<typeof radialArc<RingArcDatum>>;

const RingChart = ({
  data,
  size: fixedSize,
  strokeWidth: strokeWidthProp = 12,
  ringGap: ringGapProp = 6,
  baseInnerRadius: baseInnerRadiusProp = 60,
  className,
  style,
  hoveredIndex,
  onHoverChange,
  startAngle = -Math.PI / 2,
  endAngle = (RING_END_ANGLE_FACTOR * Math.PI) / 2,
  enterTransition,
  enterStaggerScale = 1,
  geometryScrubbing = false,
  children,
  ariaLabel = "Ring chart",
  ariaDescription,
}: Readonly<RingChartProps>): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useDebouncedContainerSize(containerRef);
  const size = fixedSize ?? Math.min(width, height);

  const { coordinator, liveHoveredIndex } = useRingHoverState({ hoveredIndex, onHoverChange });

  const center = size / 2;
  const ringCount = data.length;
  const padding = 8;
  const availableRadius = center - padding;

  const designOuterRadius = baseInnerRadiusProp + (ringCount - 1) * (strokeWidthProp + ringGapProp) + strokeWidthProp;
  const renderScale = Math.min(1, availableRadius / designOuterRadius);

  const strokeWidth = strokeWidthProp * renderScale;
  const ringGap = ringGapProp * renderScale;
  const baseInnerRadius = baseInnerRadiusProp * renderScale;

  const totalValue = useMemo(() => data.reduce((total, ring: Readonly<RingData>) => total + ring.value, 0), [data]);

  const getColor = useCallback(
    (index: number) => {
      const override = data[index]?.color;
      return override !== undefined && override !== "" ? override : (defaultRingColors[index % defaultRingColors.length]);
    },
    [data],
  );

  const getRingRadii = useCallback(
    (index: number) => {
      const inner = baseInnerRadius + index * (strokeWidth + ringGap);
      return { innerRadius: inner, outerRadius: inner + strokeWidth };
    },
    [baseInnerRadius, strokeWidth, ringGap],
  );

  const arcRange = endAngle - startAngle;

  const rawClassified = useMemo(
    () => classifyChildren(children, geometryScrubbing),
    [children, geometryScrubbing],
  );
  const {centerChildren} = rawClassified;

  const ringConfigMap = useMemo(
    () => new Map(rawClassified.ringConfigs.map((config: Readonly<RingChildConfig>) => [config.index, config])),
    [rawClassified.ringConfigs],
  );

  const scrubRingLayers = useMemo((): readonly ScrubRingLayer[] | null => {
    if (!geometryScrubbing) {return null;}
    return data.map((ringData: Readonly<RingData>, index: number) => {
      const { innerRadius, outerRadius } = getRingRadii(index);
      const cornerRadius = (outerRadius - innerRadius) / 2;
      const progress = ringData.value / ringData.maxValue;
      const progressEndAngle = startAngle + arcRange * progress;
      return {
        bgPath: pieArcPath({
          cornerRadius,
          endAngle,
          innerRadius,
          outerRadius,
          padAngle: 0,
          startAngle,
        }),
        color: getColor(index),
        progressPath:
          progressEndAngle <= startAngle + RING_PROGRESS_EPSILON
            ? ""
            : pieArcPath({
              cornerRadius,
              endAngle: progressEndAngle,
              innerRadius,
              outerRadius,
              padAngle: 0,
              startAngle,
            }),
      };
    });
  }, [geometryScrubbing, data, getRingRadii, getColor, startAngle, endAngle, arcRange]);

  const ANIMATION_KEY = 0;
  const [isLoaded, setIsLoaded] = useState(false);
  // Reset the load gate when scrubbing toggles (render-time adjustment: the timeout below only
  // Ever sets true, so the false reset lives here; matches the prev-state pattern in area/line).
  const [prevGeometryScrubbing, setPrevGeometryScrubbing] = useState(geometryScrubbing);
  if (prevGeometryScrubbing !== geometryScrubbing) {
    setPrevGeometryScrubbing(geometryScrubbing);
    setIsLoaded(false);
  }
  useEffect(() => {
    if (geometryScrubbing || isLoaded) {return undefined;}
    const timer = setTimeout((): void =>{  setIsLoaded(true); }, RING_LOAD_DELAY_MS);
    return (): void =>{  clearTimeout(timer); };
  }, [geometryScrubbing, isLoaded]);
  const effectiveIsLoaded = geometryScrubbing || isLoaded;

  const stable: RingStableValue = useMemo(
    () => ({
      animationKey: ANIMATION_KEY,
      baseInnerRadius,
      center,
      containerRef,
      data,
      endAngle,
      enterStaggerScale,
      enterTransition,
      geometryScrubbing,
      getColor,
      getRingRadii,
      isLoaded: effectiveIsLoaded,
      ringGap,
      scrubRingLayers,
      size,
      startAngle,
      strokeWidth,
      totalValue,
    }),
    [
      data, size, center, strokeWidth, ringGap, baseInnerRadius,
      effectiveIsLoaded, containerRef,
      enterTransition, enterStaggerScale, totalValue,
      getColor, getRingRadii, startAngle, endAngle,
      geometryScrubbing, scrubRingLayers,
    ],
  );

  const [centerVisible, setCenterVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout((): void =>{  setCenterVisible(true); }, 0);
    return (): void =>{  clearTimeout(id); };
  }, []);

  const definition = useMemo(() => {
    if (geometryScrubbing) {
      return defineChart({
        guides: false,
        marks: [polar({ inset: padding, marks: [], radiusRatio: 1, scales: { angle: null, radius: null } })],
        scales: { x: null, y: null },
        tooltip: false,
      });
    }

    const arcMarks: AnyRadialArcMark[] = [];

    // Per-ring enter delay uses the legacy formula directly (no shared stagger() sequence across marks).
    const progressStaggerEachMs = RING_PROGRESS_STAGGER_EACH_S * enterStaggerScale * MS_PER_SECOND;
    const progressStaggerOffsetMs = RING_PROGRESS_STAGGER_OFFSET_S * enterStaggerScale * MS_PER_SECOND;

    for (let i = 0; i < data.length; i += 1) {
      const ringData = data[i];
      appendRingArcMarks({ arcMarks, arcRange, availableRadius, config: ringConfigMap.get(i), endAngle, enterStaggerScale, enterTransition, getColor, getRingRadii, index: i, liveHoveredIndex, progressStaggerEachMs, progressStaggerOffsetMs, ringData, startAngle });
    }

    return defineChart({
      // Pointer:false + app-owned hit-test: native focus re-resolved against in-flight points caused a hover loop.
      focusRing: false,
      guides: false,
      marks: [polar({ inset: padding, marks: arcMarks, radiusRatio: 1, scales: { angle: null, radius: null } })],
      pointer: false,
      scales: { x: null, y: null },
      tooltip: false,
    });
  }, [data, ringConfigMap, getRingRadii, getColor, availableRadius, padding, startAngle, endAngle, arcRange, geometryScrubbing, liveHoveredIndex, enterTransition, enterStaggerScale]);

  const { handleRender, hasRevealedRings } = useRingReveal({ data, enterStaggerScale, enterTransition, geometryScrubbing, ringConfigMap });

  const { handlePointerLeave, handlePointerOut, handlePointerOver } = useRingPointer({ coordinator, data, geometryScrubbing });

  useLayoutEffect(() => {
    if (geometryScrubbing) {return undefined;}
    if (hasRevealedRings()) {return undefined;}
    const container = containerRef.current;
    if (!container) {return undefined;}
    const hasAnims = (): boolean => {
      for (let i = 0; i < data.length; i += 1) {
        const el = container.querySelector<SVGGElement>(`[data-ts-key="ring-${i}-track"]`);
        if (el && el.getAnimations().length > 0) {return true;}
      }
      return false;
    };
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (hasAnims()) {return;}
        if (!container.querySelector(MARKS_GROUP_SELECTOR)) {return;}
        handleRender({ container });
      });
    });
    return (): void =>{  cancelAnimationFrame(raf); };
  }, [data.length, geometryScrubbing, handleRender, hasRevealedRings, containerRef]);

  const renderContent = size >= RING_MIN_RENDER_SIZE;

  const containerStyle = useMemo((): CSSProperties => ({
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    position: "relative",
    ...(fixedSize !== undefined && fixedSize !== 0 ? { height: fixedSize, width: fixedSize } : { aspectRatio: "1 / 1", width: "100%" }),
    ...style,
  }), [fixedSize, style]);

  // Subtrees as variables (not components): inlined into the same element tree.
  // Reconciliation and enter animations are unchanged as a result.
  const scrubLayersNode = (
    <g transform={`translate(${center}, ${center})`}>
      {scrubRingLayers?.map((layer: Readonly<ScrubRingLayer>, index: number) => (
        <g key={data[index]?.label ?? index}>
          <path d={layer.bgPath} fill={RING_BACKGROUND} />
          {layer.progressPath && <path d={layer.progressPath} fill={layer.color} />}
        </g>
      ))}
    </g>
  );
  const scrubSvgNode = (
    <svg
      aria-hidden="true"
      height={size}
      style={SCRUB_SVG_STYLE}
      width={size}
    >
      {scrubLayersNode}
    </svg>
  );
  const chartNode = geometryScrubbing ? scrubSvgNode : (
    <RendererChart
      ariaLabel={ariaLabel}
      ariaDescription={ariaDescription}
      width={size}
      height={size}
      definition={definition}
      onRender={handleRender}
      renderer={chartMotionRenderer<RingArcDatum, number, number>()}
    />
  );
  const centerOverlayNode = centerChildren.length > 0 && centerVisible && (
    <div
      style={RING_CENTER_OVERLAY_STYLE}
    >
      {centerChildren}
    </div>
  );

  return (
    <div
      className={className}
      data-bkm-chart="ring"
      ref={containerRef}
      onPointerOut={handlePointerOut}
      onPointerOver={handlePointerOver}
      onPointerLeave={handlePointerLeave}
      style={containerStyle}
    >
      {renderContent && (
        <RingStableContext.Provider value={stable}>
          <RingHoverCoordinatorContext.Provider value={coordinator}>
            {chartNode}

            {centerOverlayNode}
          </RingHoverCoordinatorContext.Provider>
        </RingStableContext.Provider>
      )}
    </div>
  );
}

RingChart.displayName = "RingChart";


const Ring = (_props: Readonly<RingProps>): undefined => undefined;

Ring.displayName = "Ring";

export {
  Ring,
  RingChart,
};
export type {
  RingChartProps,
};
export type { RingLineCap, RingProps } from "./internal/ring-chart-model";
export type { RingContextValue, RingData, RingHoverValue, RingStableValue, ScrubRingLayer } from "./internal/ring-context";
export type { RingEnterTransition } from './internal/enter-transition';
