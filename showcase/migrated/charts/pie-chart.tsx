// Bklit PieChart on TanStack Charts (single radialArc in polar); slices are carriers, detection app-owned.
import { pie as d3Pie } from "d3-shape";
import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { defineChart } from "@tanstack/charts/scene";
import { polar, radialArc } from "@tanstack/charts/polar";
import type { PolarMark } from "@tanstack/charts/polar";
import { stagger } from "@tanstack/charts/motion/definition";
import { pieArcPath, sliceMidOffset } from "./internal/pie-geometry";

import { createOffsetArc, createPieHoverCoordinator, FADE_OPACITY, HOVER_SPRING, motionEasingFromCss } from './internal/pie-hover-chrome';
import type { PieHoverCoordinator, PieSliceHoverEffect } from './internal/pie-hover-chrome';
import { chartMotionRenderer } from "./internal/motion-renderer";
import { hitTestPolarBands, pointerToCenterOffset } from "./internal/polar-hit";
import { resolveEnterTransition } from './internal/enter-transition';
import type { PieEnterTransition, ResolvedTiming } from './internal/enter-transition';
import { useDebouncedContainerSize } from "./internal/use-container-size";
import { PieStableContext, PieHoverCoordinatorContext } from './internal/pie-center-context';
import type { PieStableValue, PieData, PieArcData } from './internal/pie-center';
import { defaultPieColors } from "./internal/pie-default-colors";
import type { PieSliceProps } from "./internal/pie-slice";
import { CHART_CATEGORY_PALETTE } from "./internal/design-tokens";
import "./styles.css";

const DEFAULT_HOVER_OFFSET = 10;

// Fraction-to-percent scale (alpha fade, stagger offsets).
const PERCENT_SCALE = 100;
// Full-circle sweep from -π/2: endAngle = 3π/2.
const PIE_END_ANGLE_PI_NUMERATOR = 3;
// Slice enter stagger (scaled by enterStaggerScale).
const PIE_STAGGER_EACH_MS = 80;
const PIE_STAGGER_OFFSET_MS = 100;
// Charts smaller than this render the empty placeholder (no room for arcs).
const MIN_PIE_SIZE_PX = 10;

// RadialArc has no per-datum opacity; fade rides fill alpha via color-mix (same as sunburst).
const applyAlphaToColor = (color: string, alpha: number): string => {
  if (alpha >= 1) {return color;}
  return `color-mix(in srgb, ${color} ${Math.round(alpha * PERCENT_SCALE)}%, transparent)`;
}

// Boundary predicates: React child types arrive as string-or-constructor unions; narrow once here.
// Generic parameters (same shape as composed-data-math) keep `unknown` call sites compiling.
const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";
// Object() boxes primitives, so identity holds exactly for objects and functions (any realm, any prototype).
const isObjectOrFunction = <Value,>(value: Value): value is Value & object => value !== null && Object(value) === value;

const displayNameOfType = (componentType: ReactElement["type"]): string | undefined => {
  if (!isObjectOrFunction(componentType)) {return undefined;}
  if (!("displayName" in componentType)) {return undefined;}
  const displayName: unknown = componentType.displayName;
  return isString(displayName) ? displayName : undefined;
}

/*
 * Host types can never match: only object-or-function types carrying a string `displayName` qualify.
 * An `instanceof Function` guard would be realm-dependent, contradicting `isObjectOrFunction`.
 */
const isPieCenterElement = (child: Readonly<ReactNode>): boolean => isValidElement(child) && displayNameOfType(child.type) === "PieCenter"

const isPieSliceElement = (child: Readonly<ReactNode>): child is ReactElement<PieSliceProps> => isValidElement(child) && displayNameOfType(child.type) === "PieSlice"

const isDefsComponent = (child: Readonly<ReactElement>): boolean => {
  if (isString(child.type)) {return false;}
  const name = displayNameOfType(child.type) ?? "";
  return (
    name.includes("Gradient") ||
    name.includes("Pattern") ||
    name === "LinearGradient" ||
    name === "RadialGradient"
  );
}

interface PieSliceConfig {
  readonly index: number;
  readonly color?: string;
  readonly fill?: string;
  readonly animate: boolean;
  // ShowGlow extracted for prop parity only; glow rendering was dead code and is unread.
  readonly showGlow: boolean;
  readonly hoverEffect: PieSliceHoverEffect;
  readonly hoverOffset?: number;
}

interface ClassifiedChildren {
  readonly centerChildren: readonly ReactNode[];
  readonly defsChildren: readonly ReactElement[];
  readonly sliceConfigs: readonly PieSliceConfig[];
}

const classifyChildren = (children: Readonly<ReactNode>, geometryScrubbing: boolean): ClassifiedChildren => {
  const centerChildren: ReactNode[] = [];
  const defsChildren: ReactElement[] = [];
  const sliceConfigs: PieSliceConfig[] = [];

  Children.forEach(children, (child: Readonly<ReactNode>) => {
    if (!isValidElement(child)) {return;}
    if (isPieCenterElement(child)) {
      centerChildren.push(child);
    } else if (isDefsComponent(child)) {
      defsChildren.push(child);
    } else if (isPieSliceElement(child) && !geometryScrubbing) {
      const { props } = child;
      sliceConfigs.push({
        animate: props.animate !== false,
        color: props.color,
        fill: props.fill,
        hoverEffect: props.hoverEffect ?? "translate",
        hoverOffset: props.hoverOffset,
        index: props.index,
        showGlow: props.showGlow !== false,
      });
    } else {
      // Non-slice children and scrubbed geometry carry no slice config.
    }
  });

  return { centerChildren, defsChildren, sliceConfigs };
}

interface PieChartProps {
  readonly data: PieData[];
  readonly size?: number;
  readonly innerRadius?: number;
  readonly padAngle?: number;
  readonly cornerRadius?: number;
  readonly startAngle?: number;
  readonly endAngle?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly hoverOffset?: number;
  readonly children: ReactNode;
  readonly enterTransition?: PieEnterTransition;
  readonly enterStaggerScale?: number;
  readonly geometryScrubbing?: boolean;
}

interface PieRowDatum {
  readonly startAngle: number;
  readonly endAngle: number;
  readonly fill: string;
  readonly sliceIndex: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly cornerRadius: number;
  readonly dx: number;
  readonly dy: number;
  /** PieSlice's `animate` prop — false suppresses the enter motion via `ctx.datum.animate`. */
  readonly animate: boolean;
}

interface ResolvePieRowFillParams {
  readonly fadeHoveredIndex: number | null;
  readonly getFill: (index: number) => string;
  readonly index: number;
  readonly sliceConfig: PieSliceConfig | undefined;
}

const resolvePieRowFill = (params: Readonly<ResolvePieRowFillParams>): string => {
  const { fadeHoveredIndex, getFill, index, sliceConfig } = params;
  const customFill = sliceConfig?.fill;
  const baseFill = customFill !== undefined && customFill !== "" ? customFill : getFill(index);
  const isFaded = fadeHoveredIndex !== null && fadeHoveredIndex !== index;
  return isFaded ? applyAlphaToColor(baseFill, FADE_OPACITY) : baseFill;
}

interface BuildPieRowDatumParams {
  readonly arc: Readonly<PieArcData>;
  readonly availableRadius: number;
  readonly cornerRadius: number;
  readonly fadeHoveredIndex: number | null;
  readonly getFill: (index: number) => string;
  readonly hoverOffset: number;
  readonly innerRadius: number;
  readonly sliceConfig: PieSliceConfig | undefined;
}

const buildPieRowDatum = (params: Readonly<BuildPieRowDatumParams>): PieRowDatum => {
  const { arc, availableRadius, cornerRadius, fadeHoveredIndex, getFill, hoverOffset, innerRadius, sliceConfig } = params;
  const isHovered = fadeHoveredIndex === arc.index;
  const fill = resolvePieRowFill({ fadeHoveredIndex, getFill, index: arc.index, sliceConfig });
  const effect = sliceConfig?.hoverEffect ?? "translate";
  const sliceHoverOffset = sliceConfig?.hoverOffset ?? hoverOffset;
  const growBy = isHovered && effect === "grow" ? sliceHoverOffset : 0;
  const translateDistance = isHovered && effect === "translate" ? sliceHoverOffset : 0;
  const { x: dx, y: dy } = sliceMidOffset(arc.startAngle, arc.endAngle, translateDistance);
  return {
    animate: sliceConfig?.animate ?? true,
    cornerRadius: availableRadius > 0 ? cornerRadius : 0,
    dx,
    dy,
    endAngle: arc.endAngle,
    fill,
    innerRadius,
    outerRadius: availableRadius + growBy,
    sliceIndex: arc.index,
    startAngle: arc.startAngle,
  };
}

interface CreatePieSliceMarkParams {
  readonly enterStaggerScale: number;
  readonly enterTransition: PieEnterTransition | undefined;
}

const createPieSliceMark = (pieRows: readonly PieRowDatum[], params: Readonly<CreatePieSliceMarkParams>): PolarMark<PieRowDatum, number, number> => {
  const { enterStaggerScale, enterTransition } = params;
  return radialArc<PieRowDatum>(pieRows, {
    fill: (datum: Readonly<PieRowDatum>) => datum.fill,
    generator: () => {
      const gen = createOffsetArc<PieRowDatum>((datum: Readonly<PieRowDatum>) => ({ dx: datum.dx, dy: datum.dy }));
      gen
        .startAngle((datum: Readonly<PieRowDatum>) => datum.startAngle)
        .endAngle((datum: Readonly<PieRowDatum>) => datum.endAngle)
        .innerRadius((datum: Readonly<PieRowDatum>) => datum.innerRadius)
        .outerRadius((datum: Readonly<PieRowDatum>) => datum.outerRadius)
        .cornerRadius((datum: Readonly<PieRowDatum>) => datum.cornerRadius);
      return gen;
    },
    id: "pie-slices",
    key: (datum) => String(datum.sliceIndex),
    // Enter replays legacy stagger unless overridden; other phases ride HOVER_SPRING (harmless for values).
    motion: (ctx: Readonly<{ datum?: Readonly<PieRowDatum>; phase: string }>) => {
      if (ctx.phase !== "enter") {
        return {
          transition: { damping: HOVER_SPRING.damping, stiffness: HOVER_SPRING.stiffness, type: "spring" },
        };
      }
      if (ctx.datum && !ctx.datum.animate) {return false;}
      if (enterTransition) {
        const resolved: ResolvedTiming = resolveEnterTransition(enterTransition);
        return {
          transition:
            resolved.kind === "spring"
              ? { damping: resolved.damping, mass: resolved.mass, stiffness: resolved.stiffness, type: "spring" }
              : {
                  duration: resolved.durationMs,
                  easing: motionEasingFromCss(resolved.easingCss),
                  type: "tween",
                },
        };
      }
      return stagger({ each: PIE_STAGGER_EACH_MS * enterStaggerScale, offset: PIE_STAGGER_OFFSET_MS * enterStaggerScale, phase: "enter" });
    },
    opacity: 1,
  });
}

// Hidden defs svg floats over the chart corner without intercepting pointer input.
const PIE_DEFS_SVG_STYLE: CSSProperties = { left: 0, pointerEvents: "none", position: "absolute", top: 0 };
// Scrub svg isolates paint so geometry probing never disturbs the live chart.
const PIE_SCRUB_SVG_STYLE: CSSProperties = { contain: "layout style paint" };
// Center overlay stacks PieCenter children while letting pointer input fall through.
const PIE_CENTER_OVERLAY_STYLE: CSSProperties = {
  alignItems: "center",
  display: "flex",
  inset: 0,
  justifyContent: "center",
  pointerEvents: "none",
  position: "absolute",
};

const renderPieDefsSvg = (defsChildren: readonly ReactElement[]): ReactElement | undefined => {
  if (defsChildren.length === 0) { return undefined; }
  return (
    <svg width={0} height={0} aria-hidden="true" style={PIE_DEFS_SVG_STYLE}>
      <defs>{defsChildren}</defs>
    </svg>
  );
}

interface PieScrubSvgParams {
  readonly center: number;
  readonly data: readonly PieData[];
  readonly defsChildren: readonly ReactElement[];
  readonly getFill: (index: number) => string;
  readonly scrubSlicePaths: readonly string[] | null;
  readonly size: number;
}

const renderPieScrubSvg = (params: Readonly<PieScrubSvgParams>): ReactElement => {
  const { center, data, defsChildren, getFill, scrubSlicePaths, size } = params;
  return (
    <svg
      aria-hidden="true"
      height={size}
      style={PIE_SCRUB_SVG_STYLE}
      width={size}
    >
      {defsChildren.length > 0 && <defs>{defsChildren}</defs>}
      <g transform={`translate(${center}, ${center})`}>
        {scrubSlicePaths?.map((slicePath, index) =>
          slicePath ? (
            <path
              d={slicePath}
              fill={getFill(index)}
              key={data[index]?.label ?? index}
              pointerEvents="none"
            />
          ) : undefined,
        )}
      </g>
    </svg>
  );
}

const renderPieCenterOverlay = (centerChildren: readonly ReactNode[]): ReactElement | undefined => {
  if (centerChildren.length === 0) { return undefined; }
  return (
    <div
      style={PIE_CENTER_OVERLAY_STYLE}
    >
      {centerChildren}
    </div>
  );
}

interface PieInnerContentParams {
  readonly center: number;
  readonly centerChildren: readonly ReactNode[];
  readonly data: readonly PieData[];
  readonly defsChildren: readonly ReactElement[];
  readonly geometryScrubbing: boolean;
  readonly getFill: (index: number) => string;
  readonly renderChart: () => ReactElement;
  readonly scrubSlicePaths: readonly string[] | null;
  readonly size: number;
}

const renderPieInnerContent = (params: Readonly<PieInnerContentParams>): ReactElement => {
  const { center, centerChildren, data, defsChildren, geometryScrubbing, getFill, renderChart, scrubSlicePaths, size } = params;
  return (
    <>
      {/* Hidden defs svg: url(#id) refs resolve document-wide. */}
      {renderPieDefsSvg(defsChildren)}
      {geometryScrubbing
        ? renderPieScrubSvg({ center, data, defsChildren, getFill, scrubSlicePaths, size })
        : renderChart()}
      {renderPieCenterOverlay(centerChildren)}
    </>
  );
}

const PieChart = ({
  data,
  size: fixedSize,
  innerRadius = 0,
  padAngle = 0,
  cornerRadius = 0,
  startAngle = -Math.PI / 2,
  endAngle = (PIE_END_ANGLE_PI_NUMERATOR * Math.PI) / 2,
  className,
  style,
  hoveredIndex,
  onHoverChange,
  hoverOffset = DEFAULT_HOVER_OFFSET,
  enterTransition,
  enterStaggerScale = 1,
  geometryScrubbing = false,
  children,
}: Readonly<PieChartProps>): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // ResizeObserver mounts unconditionally; fixed-size mode never reads the measurement.
  const { width, height } = useDebouncedContainerSize(containerRef);
  const size = fixedSize ?? Math.min(width, height);

  // Latest-value refs: the coordinator persists across renders, so its callbacks read props
  // Through refs refreshed post-commit instead of closing over a single render.
  const isControlledRef = useRef(hoveredIndex !== undefined);
  const onHoverChangeRef = useRef(onHoverChange);
  useEffect(() => {
    isControlledRef.current = hoveredIndex !== undefined;
    onHoverChangeRef.current = onHoverChange;
  }, [hoveredIndex, onHoverChange]);
  // Stable callbacks (not recreated per render) so the coordinator is created exactly once.
  const notifyHoverChange = useCallback((index: number | null): void => {
    onHoverChangeRef.current?.(index);
  }, []);
  const readIsControlled = useCallback((): boolean => isControlledRef.current, []);

  // Created once via lazy state init (render-pure); the callbacks read latest props through refs.
  const [coordinator] = useState<PieHoverCoordinator>(() => createPieHoverCoordinator(notifyHoverChange, readIsControlled));

  useEffect(() => {
    if (hoveredIndex !== undefined) {
      coordinator.setHovered(hoveredIndex);
    }
  }, [hoveredIndex, coordinator]);

  const [fadeHoveredIndex, setFadeHoveredIndex] = useState<number | null>(() => coordinator.getHovered());
  useEffect(() => coordinator.subscribe(() =>{  setFadeHoveredIndex(coordinator.getHovered()); }), [coordinator]);

  const totalValue = useMemo(() => data.reduce((sum, datum: Readonly<PieData>) => sum + datum.value, 0), [data]);

  const getColor = useCallback(
    (index: number) => {
      const custom = data[index]?.color;
      return custom !== undefined && custom !== "" ? custom : (defaultPieColors[index % defaultPieColors.length]);
    },
    [data],
  );
  const getFill = useCallback(
    (index: number) => {
      const custom = data[index]?.fill;
      return custom !== undefined && custom !== "" ? custom : getColor(index);
    },
    [data, getColor],
  );

  const arcs = useMemo((): PieArcData[] => {
    const pieGenerator = d3Pie<PieData>()
      .value((datum: Readonly<PieData>) => datum.value)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .padAngle(padAngle)
      .sort(null);
    return pieGenerator(data).map((arc: Readonly<PieArcData>, index: number) => ({
      data: arc.data,
      endAngle: arc.endAngle,
      index,
      padAngle: arc.padAngle,
      startAngle: arc.startAngle,
      value: arc.value,
    }));
  }, [data, startAngle, endAngle, padAngle]);

  const center = size / 2;
  const outerRadius = center - hoverOffset;

  const scrubSlicePaths = useMemo((): readonly string[] | null => {
    if (!geometryScrubbing) {return null;}
    return arcs.map((arc: Readonly<PieArcData>) =>
      pieArcPath(innerRadius, outerRadius, arc.startAngle, arc.endAngle, cornerRadius, arc.padAngle),
    );
  }, [geometryScrubbing, arcs, innerRadius, outerRadius, cornerRadius]);

  const { centerChildren, defsChildren, sliceConfigs } = useMemo(
    () => classifyChildren(children, geometryScrubbing),
    [children, geometryScrubbing],
  );

  const sliceConfigMap = useMemo(
    () => new Map(sliceConfigs.map((config: Readonly<PieSliceConfig>) => [config.index, config])),
    [sliceConfigs],
  );

  const stable: PieStableValue = useMemo(
    () => ({
      arcs,
      center,
      cornerRadius,
      data,
      enterStaggerScale,
      enterTransition,
      geometryScrubbing,
      getColor,
      getFill,
      hoverOffset,
      innerRadius,
      outerRadius,
      padAngle,
      scrubSlicePaths,
      size,
      totalValue,
    }),
    [
      data, arcs, size, center, outerRadius, innerRadius, padAngle,
      cornerRadius, hoverOffset, enterTransition, enterStaggerScale,
      totalValue, getColor, getFill, geometryScrubbing, scrubSlicePaths,
    ],
  );

  // One multi-row mark, not N per-slice marks: validation cost is per-mark.
  const availableRadius = center - hoverOffset;

  const definition = useMemo(() => {
    if (geometryScrubbing) {
      return defineChart({
        guides: false,
        marks: [polar({ inset: hoverOffset, marks: [], radiusRatio: 1 })],
        scales: { x: null, y: null },
        theme: { palette: CHART_CATEGORY_PALETTE },
        tooltip: false,
      });
    }

    const pieRows: PieRowDatum[] = arcs.map((arc: Readonly<PieArcData>) =>
      buildPieRowDatum({
        arc,
        availableRadius,
        cornerRadius,
        fadeHoveredIndex,
        getFill,
        hoverOffset,
        innerRadius,
        sliceConfig: sliceConfigMap.get(arc.index),
      }),
    );

    const sliceMark = createPieSliceMark(pieRows, { enterStaggerScale, enterTransition });


    return defineChart({
      // Detection is app-owned: native focus re-resolved against in-flight points caused a hover loop.
      focusRing: false,
      guides: false,
      marks: [polar({ inset: hoverOffset, marks: [sliceMark], radiusRatio: 1 })],
      pointer: false,
      scales: { x: null, y: null },
      // Palette override has no pixel effect (rows carry explicit fill); keeps native surfaces agreeing.
      theme: { palette: CHART_CATEGORY_PALETTE },
      tooltip: false,
    });
  }, [
    arcs, sliceConfigMap, getFill, availableRadius, innerRadius, cornerRadius, hoverOffset,
    geometryScrubbing, fadeHoveredIndex, enterTransition, enterStaggerScale,
  ]);
  // Hit-test against static rest geometry so band growth never ejects a stationary cursor.
  const pieHitBands = useMemo(
    () => arcs.map((arc: Readonly<PieArcData>) => ({ endAngle: arc.endAngle, innerRadius, outerRadius: availableRadius, startAngle: arc.startAngle })),
    [arcs, innerRadius, availableRadius],
  );
  const lastHitRequestRef = useRef<number | null>(null);
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (geometryScrubbing) {return;}
      const { x, y } = pointerToCenterOffset(event.currentTarget, event.clientX, event.clientY);
      const hit = hitTestPolarBands(x, y, pieHitBands);
      if (hit === lastHitRequestRef.current) {return;}
      lastHitRequestRef.current = hit;
      if (hit === null) {coordinator.requestUnhover();}
      else {coordinator.requestHover(hit);}
    },
    [coordinator, geometryScrubbing, pieHitBands],
  );
  const handlePointerLeave = useCallback(() => {
    if (lastHitRequestRef.current === null) {return;}
    lastHitRequestRef.current = null;
    coordinator.requestUnhover();
  }, [coordinator]);

  const placeholderStyle = useMemo((): CSSProperties => ({
    ...(fixedSize !== undefined && fixedSize !== 0 ? { height: fixedSize, width: fixedSize } : { aspectRatio: "1 / 1", width: "100%" }),
    ...style,
  }), [fixedSize, style]);
  const containerStyle = useMemo((): CSSProperties => ({
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    position: "relative",
    ...(fixedSize !== undefined && fixedSize !== 0 ? { height: fixedSize, width: fixedSize } : { aspectRatio: "1 / 1", width: "100%" }),
    ...style,
  }), [fixedSize, style]);

  if (size < MIN_PIE_SIZE_PX) {
    return (
      <div
        className={className}
        data-bkm-chart="pie"
        ref={containerRef}
        style={placeholderStyle}
      />
    );
  }

/*
 * Element factory, not a component: the same element renders in the same slot, so reconciliation is unchanged.
 */
  const renderChart = (): ReactElement => (
    <RendererChart
      ariaLabel="Pie chart"
      width={size}
      height={size}
      definition={definition}
      renderer={chartMotionRenderer<PieRowDatum, number, number>()}
    />
  );

  return (
    <div
      className={className}
      data-bkm-chart="pie"
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={containerStyle}
    >
      <PieStableContext.Provider value={stable}>
        <PieHoverCoordinatorContext.Provider value={coordinator}>
          {renderPieInnerContent({
            center,
            centerChildren,
            data,
            defsChildren,
            geometryScrubbing,
            getFill,
            renderChart,
            scrubSlicePaths,
            size,
          })}
        </PieHoverCoordinatorContext.Provider>
      </PieStableContext.Provider>
    </div>
  );
}

PieChart.displayName = "PieChart";


export type { PieSliceHoverEffect } from './internal/pie-hover-chrome';
export type { PieEnterTransition } from './internal/enter-transition';
export { PieSlice } from "./internal/pie-slice";
export type { PieSliceProps } from "./internal/pie-slice";
export {
  DEFAULT_HOVER_OFFSET,
  PieChart,
};
export type {
  PieChartProps,
};
