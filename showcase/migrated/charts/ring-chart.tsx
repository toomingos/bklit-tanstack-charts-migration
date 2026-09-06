// Bklit RingChart on TanStack Charts (radialArc track+progress per ring; children are carriers).
// Track entrance stays a WAAPI scale-pop (no native arc primitive); hover scale is reactive geometry.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, NamedExoticComponent, ReactElement, ReactNode } from 'react';
import { ChartHost, HOST_INITIAL_WIDTH, adoptHostWidth } from "./internal/chart-host";
import { defineChart } from "@tanstack/charts/scene";
import type { ChartRendererRenderContext, DomChartDefinition } from "@tanstack/charts";
import { useFocusInjection } from "./internal/focus-injection";
import { focusGroupAngle, polar, radialArc } from "@tanstack/charts/polar";
import { pieArcPath } from "./internal/pie-geometry";
import { RingHoverCoordinatorContext, RingStableContext, defaultRingColors } from "./internal/ring-context";
import type { RingData, RingStableValue, ScrubRingLayer } from "./internal/ring-context";
import { HOVER_SPRING, motionEasingFromCss } from "./internal/hover-motion";
import { RING_TWEEN_FALLBACK, resolveEnterTransition } from './internal/enter-transition';
import type { ResolvedTiming, RingEnterTransition } from './internal/enter-transition';
import { nativeStaggerDelayMs } from "./internal/native-stagger";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { MARKS_GROUP_SELECTOR, classifyChildren, ringIndexFromMarkId, useRingHoverState, useRingReveal } from "./internal/ring-chart-model";
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
}

interface RingMarkPairInput {
  readonly arcMarks: AnyRadialArcMark[];
  readonly index: number;
  readonly ringData: Readonly<RingData>;
  readonly config: Readonly<RingChildConfig> | undefined;
  readonly getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };
  readonly getColor: (index: number) => string;
  readonly availableRadius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly arcRange: number;
  readonly progressStaggerEachMs: number;
  readonly progressStaggerOffsetMs: number;
  readonly enterTransition: RingEnterTransition | undefined;
  readonly enterStaggerScale: number;
}

// Hover-invariant ratios: the 1.03/1.02 radius scale is a 0.16.0 library gap.
// Hover keeps no geometric effect; the ring still resolves for center chrome.
const resolveRingArcGeometry = (params: Readonly<{ availableRadius: number; config: Readonly<RingChildConfig> | undefined; innerRadius: number; outerRadius: number }>): RingArcGeometry => {
  const cornerPx = params.config?.lineCap === "round" ? (params.outerRadius - params.innerRadius) / 2 : 0;
  return {
    cornerRatio: cornerPx / params.availableRadius,
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
      cornerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * geometry.cornerRatio,
      fill: RING_BACKGROUND,
      id: `ring-${index}-track`,
      innerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * geometry.innerRatio,
      key: () => "track",
      motion: (ctx: Readonly<{ phase: string }>) => {
        if (ctx.phase === "enter") {return false;}
        return { transition: { damping: HOVER_SPRING.damping, stiffness: HOVER_SPRING.stiffness, type: "spring" } };
      },
      opacity: 1,
      outerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * geometry.outerRatio,
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
      cornerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * params.geometry.cornerRatio,
      fill: params.color,
      id: `ring-${params.index}-progress`,
      innerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * params.geometry.innerRatio,
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
      outerRadius: ({ radius }: Readonly<{ radius: number }>) => radius * params.geometry.outerRatio,
    }),
  );
};

const appendRingArcMarks = (params: Readonly<RingMarkPairInput>): void => {
  const { arcMarks, index, ringData, config, getRingRadii, getColor, availableRadius } = params;
  const { innerRadius, outerRadius } = getRingRadii(index);
  const geometry = resolveRingArcGeometry({ availableRadius, config, innerRadius, outerRadius });
  const color = resolveRingColor({ config, getColor, index });
  const progress = resolveRingProgress(ringData);
  appendRingTrackMark({ arcMarks, endAngle: params.endAngle, geometry, index, startAngle: params.startAngle });
  appendRingProgressMark({ arcMarks, arcRange: params.arcRange, color, enterStaggerScale: params.enterStaggerScale, enterTransition: params.enterTransition, geometry, index, progress, progressStaggerEachMs: params.progressStaggerEachMs, progressStaggerOffsetMs: params.progressStaggerOffsetMs, startAngle: params.startAngle });
};

interface RingChartProps {
  readonly data: RingData[];
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

interface BuildRingDefinitionOptions {
  readonly data: readonly RingData[];
  readonly ringConfigMap: ReadonlyMap<number, RingChildConfig>;
  readonly getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };
  readonly getColor: (index: number) => string;
  readonly availableRadius: number;
  readonly padding: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly arcRange: number;
  readonly geometryScrubbing: boolean;
  readonly enterTransition: RingEnterTransition | undefined;
  readonly enterStaggerScale: number;
}

// Hover-invariant: no option derives from hovered/focused state.
// Pointer focus never rebuilds the definition (the error-185 loop).
const buildRingDefinition = (options: Readonly<BuildRingDefinitionOptions>): DomChartDefinition<RingArcDatum, number, number> => {
  const { data, ringConfigMap, getRingRadii, getColor, availableRadius, padding, startAngle, endAngle, arcRange, geometryScrubbing, enterTransition, enterStaggerScale } = options;
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
    appendRingArcMarks({ arcMarks, arcRange, availableRadius, config: ringConfigMap.get(i), endAngle, enterStaggerScale, enterTransition, getColor, getRingRadii, index: i, progressStaggerEachMs, progressStaggerOffsetMs, ringData, startAngle });
  }

  return defineChart({
    // Package owns pointer and focus (angular-ray grouping).
    // Hover radius scale is dropped: no arc geometry in mark states.
    focus: focusGroupAngle,
    focusRing: false,
    guides: false,
    marks: [polar({ inset: padding, marks: arcMarks, radiusRatio: 1, scales: { angle: null, radius: null } })],
    scales: { x: null, y: null },
    tooltip: false,
  });
};

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
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const size = fixedSize ?? liveWidth;
  const isFixedSize = fixedSize !== undefined && fixedSize !== 0;

  const { hoverSource } = useRingHoverState({ hoveredIndex, onHoverChange });
  const { captureRenderContext, clearFocus, focusPoint } = useFocusInjection<RingArcDatum, number, number>();

  // Controlled hover paints through package focus, never a definition rebuild.
  const isControlled = hoveredIndex !== undefined;
  useEffect(() => {
    if (!isControlled) {return;}
    if (hoveredIndex === null) { clearFocus(); return; }
    const target = hoveredIndex;
    focusPoint((point) => ringIndexFromMarkId(point.markId) === target);
  }, [isControlled, hoveredIndex, focusPoint, clearFocus]);

  // Package-owned hover: the focused mark id resolves the ring; controlled mode only notifies.
  const handleFocusChange = useCallback((point: { readonly markId: string } | null): void => {
    const candidate = point ? ringIndexFromMarkId(point.markId) : null;
    const next = candidate !== null && candidate < data.length ? candidate : null;
    if (hoveredIndex !== undefined) {
      onHoverChange?.(next);
      return;
    }
    hoverSource.setHovered(next);
  }, [data.length, hoveredIndex, hoverSource, onHoverChange]);

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

  const definition = useMemo(() => buildRingDefinition({
    arcRange,
    availableRadius,
    data,
    endAngle,
    enterStaggerScale,
    enterTransition,
    geometryScrubbing,
    getColor,
    getRingRadii,
    padding,
    ringConfigMap,
    startAngle,
  }), [data, ringConfigMap, getRingRadii, getColor, availableRadius, padding, startAngle, endAngle, arcRange, geometryScrubbing, enterTransition, enterStaggerScale]);

  const { handleRender: revealHandleRender, hasRevealedRings } = useRingReveal({ data, enterStaggerScale, enterTransition, geometryScrubbing, ringConfigMap });
  // Host-owned sizing: the host adopts the measured width through this render callback.
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<RingArcDatum, number, number>>): void => {
    captureRenderContext(context);
    revealHandleRender(context);
    adoptHostWidth(setLiveWidth, context.scene.width);
  }, [captureRenderContext, revealHandleRender]);

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
        revealHandleRender({ container });
      });
    });
    return (): void =>{  cancelAnimationFrame(raf); };
  }, [data.length, geometryScrubbing, revealHandleRender, hasRevealedRings, containerRef]);

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
    <ChartHost
      ariaLabel={ariaLabel}
      ariaDescription={ariaDescription}
      width={isFixedSize ? size : undefined}
      height={isFixedSize ? size : undefined}
      aspectRatio={isFixedSize ? undefined : 1}
      initialWidth={isFixedSize ? size : HOST_INITIAL_WIDTH}
      definition={definition}
      onRender={handleRender}
      onFocusChange={handleFocusChange}
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
      style={containerStyle}
    >
      {renderContent && (
        <RingStableContext.Provider value={stable}>
          <RingHoverCoordinatorContext.Provider value={hoverSource}>
            {chartNode}

            {centerOverlayNode}
          </RingHoverCoordinatorContext.Provider>
        </RingStableContext.Provider>
      )}
    </div>
  );
}

const RenderRing = (_props: Readonly<RingProps>): ReactElement | null => null;

const Ring: NamedExoticComponent<Readonly<RingProps>> = memo(RenderRing);

Ring.displayName = "Ring";

export {
  Ring,
  RingChart,
  buildRingDefinition,
};
export type {
  RingChartProps,
};
export type { RingLineCap, RingProps } from "./internal/ring-chart-model";
export type { RingContextValue, RingData, RingHoverValue, RingStableValue, ScrubRingLayer } from "./internal/ring-context";
export type { RingEnterTransition } from './internal/enter-transition';
