// Bklit RingChart on TanStack Charts (radialArc track+progress per ring; children are carriers).
// Track entrance stays a WAAPI scale-pop (no native arc primitive); hover scale is reactive geometry.
import { Children, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { defineChart } from "@tanstack/charts/scene";
import { polar, radialArc } from "@tanstack/charts/polar";
import { pieArcPath } from "./internal/pie-geometry";
import { RingCenter } from "./internal/ring-center";
import { RingHoverCoordinatorContext, RingStableContext } from "./internal/ring-context";
import type { RingData, RingStableValue, ScrubRingLayer } from "./internal/ring-context";
import { createRingHoverCoordinator, ringHoverScale } from './internal/ring-hover-chrome';
import type { RingHoverCoordinator } from './internal/ring-hover-chrome';
import { HOVER_SPRING, motionEasingFromCss } from "./internal/pie-hover-chrome";
import { buildProgressKeyframes, RING_TWEEN_FALLBACK, resolveEnterTransition, revealTiming } from './internal/enter-transition';
import type { ResolvedTiming, RevealTiming, RingEnterTransition } from './internal/enter-transition';
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { nativeStaggerDelayMs } from "./internal/native-stagger";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { hitTestPolarBands, pointerToCenterOffset } from "./internal/polar-hit";
import { useDebouncedContainerSize } from "./internal/use-container-size";
import "./styles.css";

const RING_BACKGROUND = "var(--border)";
const MS_PER_SECOND = 1000;
const RING_END_ANGLE_FACTOR = 3;
const RING_PROGRESS_EPSILON = 0.01;
const RING_LOAD_DELAY_MS = 100;
const RING_PROGRESS_STAGGER_EACH_S = 0.1;
const RING_PROGRESS_STAGGER_OFFSET_S = 0.6;
const RING_MIN_PROGRESS = 0.001;
const RING_TRACK_STAGGER_EACH_S = 0.08;
const RING_MIN_RENDER_SIZE = 10;

// Selector for the TanStack marks group rendered inside the chart container.
const MARKS_GROUP_SELECTOR = ".ts-chart__marks";

// Static subtree styles; hoisted so no object is allocated per render.
const SCRUB_SVG_STYLE = { contain: "layout style paint" } as const;
const RING_CENTER_OVERLAY_STYLE = { alignItems: "center", display: "flex", inset: 0, justifyContent: "center", pointerEvents: "none", position: "absolute" } as const;

const defaultRingColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type RingLineCap = "round" | "butt";


// Boundary predicates: React child types arrive as string-or-constructor unions; narrow once here.
const isFunctionType = <Value,>(value: Value): value is Value & ((...args: readonly never[]) => void) => typeof value === "function";
const isString = <Text,>(text: Text): text is Text & string => typeof text === "string";

const componentDisplayName = (child: Readonly<ReactNode>): string | undefined => {
  if (!isValidElement(child) || !isFunctionType(child.type)) {return undefined;}
  const componentType = child.type;
  return "displayName" in componentType && isString(componentType.displayName)
    ? componentType.displayName
    : undefined;
};

const isRingElement = (child: Readonly<ReactNode>): boolean => componentDisplayName(child) === "Ring"

const isRingCenterElement = (child: Readonly<ReactNode>): boolean => {
  if (isValidElement(child) && child.type === RingCenter) {return true;}
  return componentDisplayName(child) === "RingCenter";
}

interface RingChildConfig {
  readonly index: number;
  readonly color?: string;
  readonly animate: boolean;
  // ShowGlow extracted for prop parity only; glow rendering was dead code and is unread.
  readonly showGlow: boolean;
  readonly lineCap: RingLineCap;
}

interface ClassifiedChildren {
  readonly centerChildren: readonly ReactNode[];
  readonly ringConfigs: readonly RingChildConfig[];
}

const classifyChildren = (children: Readonly<ReactNode>, geometryScrubbing: boolean): ClassifiedChildren => {
  const centerChildren: ReactNode[] = [];
  const ringConfigs: RingChildConfig[] = [];

  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) {continue;}
    if (isRingCenterElement(child)) {
      centerChildren.push(child);
    } else if (isRingElement(child) && isValidElement<RingProps>(child) && !geometryScrubbing) {
      const { props } = child;
      ringConfigs.push({
        animate: props.animate !== false,
        color: props.color,
        index: props.index,
        lineCap: props.lineCap ?? "round",
        showGlow: props.showGlow !== false,
      });
    } else {
      // Non-ring children and scrubbed rings carry no reveal geometry: only live rings populate the spec.
    }
  }

  return { centerChildren, ringConfigs };
}


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

const queryRingTrackGroup = (root: ParentNode, index: number): SVGGElement | null =>
  root.querySelector<SVGGElement>(`[data-ts-key="ring-${index}-track"]`);

const findRingTrackGroup = (container: HTMLElement, marksGroup: SVGGElement, index: number): SVGGElement | null =>
  queryRingTrackGroup(marksGroup, index) ?? queryRingTrackGroup(container, index);

const isRingTrackRevealable = (container: HTMLElement, marksGroup: SVGGElement, index: number): boolean =>
  findRingTrackGroup(container, marksGroup, index) !== null;

interface RingRevealQuery {
  readonly container: HTMLElement;
  readonly marksGroup: SVGGElement;
  readonly currData: readonly Readonly<RingData>[];
  readonly currMap: ReadonlyMap<number, RingChildConfig>;
  readonly seen: Set<number>;
}

const considerRingReveal = (params: Readonly<RingRevealQuery & { readonly index: number; readonly toReveal: number[] }>): void => {
  const ringData = params.seen.has(params.index) ? undefined : params.currData[params.index];
  const cfg = ringData ? params.currMap.get(params.index) : undefined;
  if (!ringData || cfg?.animate !== true) {
    if (ringData) {params.seen.add(params.index);}
    return;
  }
  if (!isRingTrackRevealable(params.container, params.marksGroup, params.index)) {return;}
  params.seen.add(params.index);
  params.toReveal.push(params.index);
};

const collectRingsToReveal = (params: Readonly<RingRevealQuery>): number[] => {
  const toReveal: number[] = [];
  for (let i = 0; i < params.currData.length; i += 1) {
    considerRingReveal({ ...params, index: i, toReveal });
  }
  return toReveal;
};

const markRevealStarted = (container: HTMLElement, marksGroup: SVGGElement): void => {
  const svgForBkm = container.querySelector<SVGElement>("svg.ts-chart");
  if (svgForBkm && (svgForBkm.dataset.bkmRevealed ?? "") === "") {
    svgForBkm.dataset.bkmRevealed = "1";
  }
  marksGroup.classList.add("ts-chart__marks--revealing");
};

interface RingRevealRefs {
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly revealPostPaintCancelRef: RefObject<(() => void) | null>;
  readonly isMountedRef: RefObject<boolean>;
}

const armRingRevealDeadline = (params: Readonly<{ enterStaggerScale: number; revealAnimsRef: RefObject<Animation[]>; revealDeadlineTimerRef: RefObject<number | null>; timing: RevealTiming; toReveal: readonly number[] }>): void => {
  const maxDelayMs = Math.max(
    ...params.toReveal.map((i) => nativeStaggerDelayMs(RING_TRACK_STAGGER_EACH_S * params.enterStaggerScale * MS_PER_SECOND, 0, i, "arc")),
  );
  params.revealDeadlineTimerRef.current = setRevealDeadline(params.timing.durationMs + maxDelayMs, {
    animationsRef: params.revealAnimsRef,
    onDeadline: () => {
      // No deadline fallback: the animation finish handlers settle the reveal.
    },
  });
};

const resetRingTrackTransforms = (params: Readonly<{ container: HTMLElement; marksGroup: SVGGElement; toReveal: readonly number[] }>): void => {
  for (const i of params.toReveal) {
    const trackGroup = findRingTrackGroup(params.container, params.marksGroup, i);
    if (trackGroup) {trackGroup.style.transform = "";}
  }
};

const playRingExpandAnimation = (params: Readonly<{ trackGroup: SVGGElement; timing: RevealTiming; expandDelayMs: number; revealAnimsRef: RefObject<Animation[]> }>): void => {
  const expandKeyframes = buildProgressKeyframes(params.timing, (progress) => ({ transform: `scale(${progress})` }));
  const expandAnim = params.trackGroup.animate(expandKeyframes, {
    delay: params.expandDelayMs,
    duration: params.timing.durationMs,
    easing: params.timing.easing,
    fill: "backwards",
  });
  params.revealAnimsRef.current.push(expandAnim);
  expandAnim.onfinish = (): void =>{  expandAnim.cancel(); };
};

interface RingExpandInput {
  readonly container: HTMLElement;
  readonly currData: readonly Readonly<RingData>[];
  readonly currMap: ReadonlyMap<number, RingChildConfig>;
  readonly enterStaggerScale: number;
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly timing: RevealTiming;
  readonly index: number;
}

const expandRingTrack = (params: Readonly<RingExpandInput>): void => {
  const ringData = params.currData.at(params.index);
  if (!ringData) {return;}
  const liveMarksGroup = params.container.querySelector<SVGGElement>(MARKS_GROUP_SELECTOR);
  const trackGroup = liveMarksGroup ? findRingTrackGroup(params.container, liveMarksGroup, params.index) : queryRingTrackGroup(params.container, params.index);
  const config = params.currMap.get(params.index);
  if (!config || !trackGroup) {return;}
  const expandDelayMs = nativeStaggerDelayMs(RING_TRACK_STAGGER_EACH_S * params.enterStaggerScale * MS_PER_SECOND, 0, params.index, "arc");
  playRingExpandAnimation({ expandDelayMs, revealAnimsRef: params.revealAnimsRef, timing: params.timing, trackGroup });
};

interface RingRevealRunInput {
  readonly container: HTMLElement;
  readonly currData: readonly Readonly<RingData>[];
  readonly currMap: ReadonlyMap<number, RingChildConfig>;
  readonly enterStaggerScale: number;
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly timing: RevealTiming;
  readonly toReveal: readonly number[];
}

const finishRingReveal = (params: Readonly<RingRevealRunInput>): void => {
  for (const i of params.toReveal) {
    expandRingTrack({ container: params.container, currData: params.currData, currMap: params.currMap, enterStaggerScale: params.enterStaggerScale, index: i, revealAnimsRef: params.revealAnimsRef, timing: params.timing });
  }
  params.container.querySelector<SVGGElement>(MARKS_GROUP_SELECTOR)?.classList.remove("ts-chart__marks--revealing");
};

interface RingRevealStarterInput {
  readonly container: HTMLElement;
  readonly currData: readonly Readonly<RingData>[];
  readonly currMap: ReadonlyMap<number, RingChildConfig>;
  readonly enterStaggerScale: number;
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly revealPostPaintCancelRef: RefObject<(() => void) | null>;
  readonly marksGroup: SVGGElement;
  readonly timing: RevealTiming;
  readonly toReveal: readonly number[];
}

const startRingRevealAnimations = (params: Readonly<RingRevealStarterInput>): void => {
  markRevealStarted(params.container, params.marksGroup);
  armRingRevealDeadline({ enterStaggerScale: params.enterStaggerScale, revealAnimsRef: params.revealAnimsRef, revealDeadlineTimerRef: params.revealDeadlineTimerRef, timing: params.timing, toReveal: params.toReveal });
  resetRingTrackTransforms({ container: params.container, marksGroup: params.marksGroup, toReveal: params.toReveal });
  params.revealPostPaintCancelRef.current = onPostPaint(() => {
    finishRingReveal(params);
  });
};

interface RingRevealBeginInput {
  readonly container: HTMLElement;
  readonly currData: readonly Readonly<RingData>[];
  readonly currMap: ReadonlyMap<number, RingChildConfig>;
  readonly enterStaggerScale: number;
  readonly revealAnimsRef: RefObject<Animation[]>;
  readonly revealDeadlineTimerRef: RefObject<number | null>;
  readonly revealPostPaintCancelRef: RefObject<(() => void) | null>;
  readonly marksGroup: SVGGElement;
  readonly enterTransition: RingEnterTransition | undefined;
  readonly toReveal: readonly number[];
}

// Timing resolution plus reveal start, split out so the onRender callback stays small.
const beginRingReveal = (params: Readonly<RingRevealBeginInput>): void => {
  const timing = revealTiming(resolveEnterTransition(params.enterTransition, RING_TWEEN_FALLBACK));
  startRingRevealAnimations({ container: params.container, currData: params.currData, currMap: params.currMap, enterStaggerScale: params.enterStaggerScale, marksGroup: params.marksGroup, revealAnimsRef: params.revealAnimsRef, revealDeadlineTimerRef: params.revealDeadlineTimerRef, revealPostPaintCancelRef: params.revealPostPaintCancelRef, timing, toReveal: params.toReveal });
};

const cancelRevealAnimations = (revealAnims: readonly Animation[]): void => {
  for (const anim of revealAnims) {
    try { anim.cancel(); } catch {
      // Cancelling a finished animation throws: the teardown already settled it.
    }
  }
};

const flushRingRevealTeardown = (params: Readonly<RingRevealRefs & { readonly revealAnims: Animation[] }>): void => {
  if (params.isMountedRef.current) {return;}
  if (params.revealDeadlineTimerRef.current !== null) {
    globalThis.clearTimeout(params.revealDeadlineTimerRef.current);
    params.revealDeadlineTimerRef.current = null;
  }
  params.revealPostPaintCancelRef.current?.();
  params.revealPostPaintCancelRef.current = null;
  cancelRevealAnimations(params.revealAnims);
  params.revealAnimsRef.current = [];
};

const cancelPendingRingReveal = (params: Readonly<RingRevealRefs & { readonly revealAnims: Animation[] }>): void => {
  const { isMountedRef } = params;
  isMountedRef.current = false;
  globalThis.setTimeout(() => {
    flushRingRevealTeardown(params);
  }, 0);
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
}: Readonly<RingChartProps>): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useDebouncedContainerSize(containerRef);
  const size = fixedSize ?? Math.min(width, height);

  /*
   * Coordinator reads latest props at pointer time so its identity survives prop churn; an Effect Event cannot be stored in a long-lived coordinator.
   */
  const onHoverChangeRef = useRef(onHoverChange);
  const isControlledRef = useRef(hoveredIndex !== undefined);
  useEffect(() => {
    onHoverChangeRef.current = onHoverChange;
    isControlledRef.current = hoveredIndex !== undefined;
  });

  // Created once: the callbacks above always read the latest props, so the
  // Coordinator identity (and its in-flight hover state) survives re-renders.
  const [coordinator] = useState((): RingHoverCoordinator => createRingHoverCoordinator(
    (index: number | null): void => { onHoverChangeRef.current?.(index); },
    (): boolean => isControlledRef.current,
  ));

  useEffect(() => {
    if (hoveredIndex !== undefined) {
      coordinator.setHovered(hoveredIndex);
    }
  }, [hoveredIndex, coordinator]);

  const liveHoveredIndex = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getHovered,
    coordinator.getHovered,
  );

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
        bgPath: pieArcPath(innerRadius, outerRadius, startAngle, endAngle, cornerRadius, 0),
        color: getColor(index),
        progressPath:
          progressEndAngle <= startAngle + RING_PROGRESS_EPSILON
            ? ""
            : pieArcPath(innerRadius, outerRadius, startAngle, progressEndAngle, cornerRadius, 0),
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
        marks: [polar({ inset: padding, marks: [], radiusRatio: 1 })],
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
      marks: [polar({ inset: padding, marks: arcMarks, radiusRatio: 1 })],
      pointer: false,
      scales: { x: null, y: null },
      tooltip: false,
    });
  }, [data, ringConfigMap, getRingRadii, getColor, availableRadius, padding, startAngle, endAngle, arcRange, geometryScrubbing, liveHoveredIndex, enterTransition, enterStaggerScale]);

  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);

  const seenRingRevealedRef = useRef<Set<number>>(new Set());

  /*
   * Stable onRender identity is load-bearing for benchmarked render performance, so inputs arrive via ref read at paint time; an Effect Event cannot be handed to the renderer.
   */
  const revealInputsRef = useRef({ data, enterStaggerScale, enterTransition, geometryScrubbing, ringConfigMap });
  useEffect(() => {
    revealInputsRef.current = { data, enterStaggerScale, enterTransition, geometryScrubbing, ringConfigMap };
  });

  const handleRender = useCallback(({ container }: { container: HTMLElement }): void => {
    const { data: currData, enterStaggerScale: currStagger, enterTransition: currTransition, geometryScrubbing: currScrubbing, ringConfigMap: currMap } = revealInputsRef.current;
    if (currScrubbing) {return;}
    const marksGroup = container.querySelector<SVGGElement>(MARKS_GROUP_SELECTOR);
    if (!marksGroup) {return;}

    const toReveal = collectRingsToReveal({ container, currData, currMap, marksGroup, seen: seenRingRevealedRef.current });
    if (toReveal.length === 0) {return;}

    beginRingReveal({ container, currData, currMap, enterStaggerScale: currStagger, enterTransition: currTransition, marksGroup, revealAnimsRef, revealDeadlineTimerRef, revealPostPaintCancelRef, toReveal });
  }, []);

  const ringHitBands = useMemo(
    () => data.map((_ring: Readonly<RingData>, i: number) => ({ ...getRingRadii(i), endAngle, startAngle })),
    [data, getRingRadii, startAngle, endAngle],
  );
  const lastHitRequestRef = useRef<number | null>(null);
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (geometryScrubbing) {return;}
      const { x, y } = pointerToCenterOffset(event.currentTarget, event.clientX, event.clientY);
      const hit = hitTestPolarBands(x, y, ringHitBands);
      if (hit === lastHitRequestRef.current) {return;}
      lastHitRequestRef.current = hit;
      if (hit === null) {coordinator.requestUnhover();}
      else {coordinator.requestHover(hit);}
    },
    [coordinator, geometryScrubbing, ringHitBands],
  );
  const handlePointerLeave = useCallback(() => {
    if (lastHitRequestRef.current === null) {return;}
    lastHitRequestRef.current = null;
    coordinator.requestUnhover();
  }, [coordinator]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    const revealAnims = revealAnimsRef.current;
    isMountedRef.current = true;
    return (): void => {
      cancelPendingRingReveal({ isMountedRef, revealAnims, revealAnimsRef, revealDeadlineTimerRef, revealPostPaintCancelRef });
    };
  }, []);

  useLayoutEffect(() => {
    if (geometryScrubbing) {return undefined;}
    if (seenRingRevealedRef.current.size > 0) {return undefined;}
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
  }, [data.length, geometryScrubbing, handleRender, containerRef]);

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
      ariaLabel="Ring chart"
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
      onPointerMove={handlePointerMove}
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


interface RingProps {
  readonly index: number;
  readonly color?: string;
  readonly animate?: boolean;
  readonly showGlow?: boolean;
  readonly lineCap?: RingLineCap;
}

const Ring = (_props: Readonly<RingProps>): undefined => undefined;

Ring.displayName = "Ring";

export {
  defaultRingColors,
  Ring,
  RingChart,
};
export type {
  RingChartProps,
  RingLineCap,
  RingProps,
};
export { useRing, useRingHover, useRingHoverCoordinator, useRingStable } from "./internal/ring-context";
export type { RingContextValue, RingData, RingHoverValue, RingStableValue, ScrubRingLayer } from "./internal/ring-context";
export type { RingEnterTransition } from './internal/enter-transition';
