// Bklit PieChart on native radialArc slices inside polar(): motion() staggered entrance, native focus via onFocusChange.
// Custom: a painted-geometry arc generator (pie/arc.ts; states cannot move or scale an arc) and the NumberFlow center overlay.
import { pie as d3Pie } from "d3-shape";
import { isValidElement, useCallback, useMemo, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Chart } from "@tanstack/react-charts/core";
import { defineChart } from "@tanstack/charts/scene";
import { measureNoText } from "./kit/polar/measure-no-text";
import { motion } from "@tanstack/charts/motion";
import { polar, radialArc } from "@tanstack/charts/polar";
import type { ChartMotionTransition, ChartRendererRenderContext, DomChartDefinition } from "@tanstack/charts";
import { ResourceHost, scopePaintUrl, scopeResourceIds } from "./kit/resource-host";
import { useSanitizedId } from "./kit/use-sanitized-id";
import { FADE_OPACITY } from "./kit/design-tokens";
import { CHART_PALETTE } from "./kit/palette";
import { pieArcGenerator, pieArcPath } from "./pie/arc";
import type { PieArcRow } from "./pie/arc";
import { PieHoverCoordinatorContext, PieStableContext, defaultPieColors } from "./pie/model";
import type { PieArcData, PieData, PieEnterTransition, PieSliceHoverEffect, PieSliceProps, PieStableValue } from "./pie/model";
import { classifyPolarChildren, createAnnularFocus, useHostHoverAttr, usePolarHover } from "./kit/polar/polar-hover";
import type { AnnulusTarget } from "./kit/polar/polar-hover";
import { displayNameOf } from "./kit/read-children";
import { toEaseFn, toMotionTransition } from "./kit/motion/enter-transition";
import { buildPieCss, createPieHoverSprings, MAX_INDEX, pieHoverVars } from "./kit/polar/polar-dim";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { INITIAL_WIDTH_PX, useFluidWidth } from "./kit/size/use-fluid-width";
import { useIsClient } from "./kit/size/use-is-client";
import { useTapFocus } from "./kit/touch-focus";
import "./styles.css";
import "./polar.css";

const DEFAULT_HOVER_OFFSET = 10;
const FULL_SWEEP_END_ANGLE = (3 * Math.PI) / 2;
const STAGGER_EACH_MS = 80;
const STAGGER_OFFSET_MS = 100;
const pieIndexOf = (datum: Readonly<PieArcRow>): number => datum.sliceIndex;
const MIN_PIE_SIZE_PX = 10;
// bklit draws no path until the swept angle exceeds 0.01 rad; a clip wedge thinner than that anti-aliases into a visible hairline.
const MIN_SWEEP_RAD = 0.01;

// One module-level renderer: the entrance replays on mount, reduced motion is honoured.
const pieRenderer = motion({ initial: "always", respectReducedMotion: true });

// Mark-level `motion` (staggered entrance) is only consulted on a client mount; an SSR-adopted
// chart replays with the renderer default. Mount the chart after hydration so the stagger applies.

const CENTER_OVERLAY_STYLE: CSSProperties = {
  alignItems: "center", display: "flex", inset: 0, justifyContent: "center", pointerEvents: "none", position: "absolute",
};

const isPieCenterElement = (child: Readonly<ReactNode>): boolean => isValidElement(child) && displayNameOf(child.type) === "PieCenter";
const isPieSliceElement = (child: Readonly<ReactNode>): child is ReactElement<PieSliceProps> => isValidElement(child) && displayNameOf(child.type) === "PieSlice";
const isDefsComponent = (child: Readonly<ReactElement>): boolean => {
  const name = displayNameOf(child.type) ?? "";
  return name.includes("Gradient") || name.includes("Pattern");
};

interface PieSliceConfig {
  readonly index: number;
  readonly color?: string;
  readonly fill?: string;
  readonly animate: boolean;
  readonly hoverEffect: PieSliceHoverEffect;
  readonly hoverOffset?: number;
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
  readonly hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly hoverOffset?: number;
  readonly children: ReactNode;
  readonly enterTransition?: PieEnterTransition;
  readonly enterStaggerScale?: number;
  readonly geometryScrubbing?: boolean;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

interface BuildDefinitionOptions {
  readonly rows: readonly PieArcRow[];
  readonly innerRadius: number;
  readonly cornerRadius: number;
  readonly hoverOffset: number;
  readonly enterTransition: PieEnterTransition | undefined;
  readonly enterStaggerScale: number;
  readonly size: number;
}

/** Entrance tween whose first sliver (under bklit's 0.01 rad threshold) stays invisible. */
const sliceEnterMotion = (row: Readonly<PieArcRow>, enterTransition: PieEnterTransition | undefined): ChartMotionTransition => {
  const base = toMotionTransition(enterTransition);
  const sweep = row.endAngle - row.startAngle;
  if (base.type !== "tween" || sweep <= 0) { return base; }
  const ease = toEaseFn(enterTransition?.ease);
  return { ...base, easing: (progress: number): number => { const eased = ease(progress); return eased * sweep <= MIN_SWEEP_RAD ? 0 : eased; } };
};

const buildPieDefinition = (options: Readonly<BuildDefinitionOptions>): DomChartDefinition<PieArcRow, number, number> => {
  const { rows, innerRadius, cornerRadius, hoverOffset, enterTransition, enterStaggerScale, size } = options;
  const generator = pieArcGenerator({ cornerRadius, innerRadius });
  // One mark per slice: the native entrance sweeps a whole mark through its own angle, so
  // per-slice marks give each slice bklit's own staggered sweep (a single mark sweeps as one).
  const slices = rows.map((row) => radialArc<PieArcRow>([row], {
    // radialArc `className` (reference/marks/polar.md); the hover CSS selects `bkm-pie-arc`.
    className: `bkm-pie-arc bkm-pie-s${row.sliceIndex}`,
    fill: (datum: Readonly<PieArcRow>) => datum.fill,
    generator,
    id: `pie:slice-${row.sliceIndex}`,
    key: (datum) => `pie:slice-${datum.sliceIndex}`,
    motion: (ctx) => {
      // bklit snaps the slices on a data change; hover pop-out is host-attribute CSS and never reaches the definition.
      if (ctx.phase !== "enter") { return false; }
      if (!row.animate) { return false; }
      return { delay: (STAGGER_OFFSET_MS + row.sliceIndex * STAGGER_EACH_MS) * enterStaggerScale, transition: sliceEnterMotion(row, enterTransition) };
    },
  }));
  // Hit-test the static painted sectors (bklit's invisible hitbox is the base path, outer radius size/2 - hoverOffset), so pointer
  // focus never depends on the animated geometry.
  const targets: AnnulusTarget[] = rows.map((row) => ({
    endAngle: row.endAngle, index: row.sliceIndex, innerRadius, outerRadius: size / 2 - hoverOffset, startAngle: row.startAngle,
  }));
  return defineChart({
    focus: createAnnularFocus<PieArcRow>({
      center: size / 2,
      focusable: (point) => point.markId.startsWith("pie:slice-"),
      indexOf: pieIndexOf,
      navigable: (point) => point.markId.startsWith("pie:slice-"),
      targets,
    }),
    focusRing: false,
    guides: false,
    marks: [polar({ id: "pie", inset: hoverOffset, marks: slices, radiusRatio: 1, scales: { angle: null, radius: null } })],
    scales: { x: null, y: null },
    theme: { palette: CHART_PALETTE },
    tooltip: false,
  });
};

const PieChart = ({
  data,
  size: fixedSize,
  innerRadius = 0,
  padAngle = 0,
  cornerRadius = 0,
  startAngle = -Math.PI / 2,
  endAngle = FULL_SWEEP_END_ANGLE,
  className,
  style,
  hoveredIndex,
  onHoverChange,
  hoverOffset = DEFAULT_HOVER_OFFSET,
  enterTransition,
  enterStaggerScale = 1,
  geometryScrubbing = false,
  children,
  ariaLabel = "Pie chart",
  ariaDescription,
}: Readonly<PieChartProps>): ReactElement => {
  const isClient = useIsClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idPrefix = useSanitizedId();
  const fixed = fixedSize !== undefined && fixedSize !== 0;
  // Fluid mode: <Chart> mounts at the width ParentSize's chain delivers (observer, then one frame; bklit pie-chart.tsx:500), then the host's own observer follows (kit/size/use-fluid-width.ts).
  // The definition's annular hit targets and the grow outlines are pixel geometry, so TanStack's host cannot size this chart (TanStack-native host sizing only brings a first-layout paint).
  const { ready: hostReady, width: measuredWidth } = useFluidWidth(containerRef, { enabled: !fixed, epsilon: 0.5, initialWidth: INITIAL_WIDTH_PX, collapseBelow: MIN_PIE_SIZE_PX });
  const size = fixed ? fixedSize : measuredWidth;
  const interactionRef = useRef<ChartRendererRenderContext<PieArcRow, number, number>["interaction"] | null>(null);
  useTapFocus(containerRef, () => interactionRef.current, { mode: "tap" });
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<PieArcRow, number, number>>): void => {
    interactionRef.current = context.interaction;
  }, []);

  const { source, handleFocusChange: reportFocus } = usePolarHover<PieArcRow>({ hoveredIndex, indexOf: pieIndexOf, onHoverChange });
  const holdFocus = useKeyboardFocusHold(containerRef, () => interactionRef.current);
  const handleFocusChange = useCallback((point: Parameters<typeof reportFocus>[0]): void => { holdFocus(point); reportFocus(point); }, [holdFocus, reportFocus]);

  const totalValue = useMemo(() => data.reduce((sum, datum: Readonly<PieData>) => sum + datum.value, 0), [data]);
  const getColor = useCallback((index: number): string => {
    const custom = data[index]?.color;
    return custom !== undefined && custom !== "" ? custom : defaultPieColors[index % defaultPieColors.length];
  }, [data]);
  const getFill = useCallback((index: number): string => {
    const custom = data[index]?.fill;
    return custom !== undefined && custom !== "" ? scopePaintUrl(custom, idPrefix) : getColor(index);
  }, [data, getColor, idPrefix]);

  const arcs = useMemo((): PieArcData[] => d3Pie<PieData>()
    .value((datum: Readonly<PieData>) => datum.value)
    .startAngle(startAngle).endAngle(endAngle).padAngle(padAngle).sort(null)(data)
    .map((arc, index) => ({ data: arc.data, endAngle: arc.endAngle, index, padAngle: arc.padAngle, startAngle: arc.startAngle, value: arc.value })),
  [data, startAngle, endAngle, padAngle]);

  const { centerChildren, defsChildren, configs } = useMemo(() => classifyPolarChildren<PieSliceConfig>(children, {
    configOf: (child): PieSliceConfig | undefined => {
      if (!isPieSliceElement(child) || geometryScrubbing) { return undefined; }
      const { props } = child;
      return {
        animate: props.animate !== false,
        color: props.color,
        fill: props.fill === undefined ? undefined : scopePaintUrl(props.fill, idPrefix),
        hoverEffect: props.hoverEffect ?? "translate",
        hoverOffset: props.hoverOffset,
        index: props.index,
      };
    },
    isCenter: isPieCenterElement,
    isDefs: isDefsComponent,
  }), [children, geometryScrubbing, idPrefix]);
  const configByIndex = useMemo(() => new Map(configs.map((config) => [config.index, config])), [configs]);

  const rows = useMemo((): readonly PieArcRow[] => arcs.map((arc) => {
    const config = configByIndex.get(arc.index);
    const effect = config?.hoverEffect ?? "translate";
    return {
      animate: config?.animate ?? true,
      effect,
      endAngle: arc.endAngle,
      fill: config?.fill !== undefined && config.fill !== "" ? config.fill : getFill(arc.index),
      offset: effect === "none" ? 0 : (config?.hoverOffset ?? hoverOffset),
      padAngle: arc.padAngle,
      sliceIndex: arc.index,
      startAngle: arc.startAngle,
    };
  }), [arcs, configByIndex, getFill, hoverOffset]);

  // Hover is host attribute + fixed CSS for every effect, so no hover state reaches the definition. Grow is a uniform scale on a pie and a
  // precomputed grown outline on a donut (geometry vars set once on the host).
  const growGeometry = useMemo(() => ({
    isDonut: innerRadius >= 1,
    outerRadius: size / 2 - hoverOffset,
    pathAt: (row: Readonly<PieArcRow>, radius: number): string => pieArcPath({ cornerRadius, innerRadius }, radius, row),
  }), [cornerRadius, hoverOffset, innerRadius, size]);
  // bklit's `showGlow` (pie-slice.tsx:183) is a drop-shadow in a motion.path style framer-motion never writes to the DOM, so no glow shows. Measured in Chrome: a slice hovered after the entrance has style.filter none in bklit (light and dark); the filter is read once when the element mounts, so only a slice hovered exactly at the entrance's end keeps a stuck glow. The prop is accepted and ignored, which matches bklit's look.
  const dimCss = useMemo(() => buildPieCss(FADE_OPACITY, arcs.length), [arcs.length]);
  const hoverGeometry = useMemo(() => pieHoverVars(rows, growGeometry), [rows, growGeometry]);
  const hoverSprings = useMemo(() => createPieHoverSprings(rows, growGeometry), [rows, growGeometry]);
  useHostHoverAttr(source, containerRef, !geometryScrubbing, size < MIN_PIE_SIZE_PX, MAX_INDEX, hoverSprings);
  const definition = useMemo(() => buildPieDefinition({
    cornerRadius, enterStaggerScale, enterTransition, hoverOffset,
    innerRadius, rows, size,
  }), [rows, innerRadius, cornerRadius, hoverOffset, enterTransition, enterStaggerScale, size]);

  const center = size / 2;
  const stable: PieStableValue = useMemo(() => ({
    animationKey: 0, arcs, center, containerRef, cornerRadius, data, enterStaggerScale, enterTransition, geometryScrubbing,
    getColor, getFill, hoverOffset, innerRadius, outerRadius: center - hoverOffset, padAngle,
    isLoaded: isClient && hostReady, scrubSlicePaths: null, size, totalValue,
  }), [isClient, hostReady, arcs, center, cornerRadius, data, enterStaggerScale, enterTransition, geometryScrubbing, getColor, getFill, hoverOffset, innerRadius, padAngle, size, totalValue]);

  const boxStyle = useMemo((): CSSProperties => ({
    ...(fixed ? { height: fixedSize, width: fixedSize } : { aspectRatio: "1 / 1", width: "100%" }),
    ...style,
  }), [fixed, fixedSize, style]);
  const hostStyle = useMemo((): CSSProperties => ({ alignItems: "center", display: "flex", justifyContent: "center", position: "relative", ...hoverGeometry.vars, ...boxStyle }), [hoverGeometry.vars, boxStyle]);

  if (size < MIN_PIE_SIZE_PX) {
    return <div className={className} data-bkm-chart="pie" data-slot="chart" ref={containerRef} style={boxStyle} />;
  }

  return (
    <div
      className={className}
      data-bkm-chart="pie"
      data-bkm-grow={hoverGeometry.grow === "" ? undefined : hoverGeometry.grow}
      data-slot="chart"
      ref={containerRef}
      style={hostStyle}
    >
      <style>{dimCss}</style>
      <PieStableContext.Provider value={stable}>
        <PieHoverCoordinatorContext.Provider value={source}>
          {isClient && hostReady ? <Chart
            ariaDescription={ariaDescription}
            ariaLabel={ariaLabel}
            definition={definition}
            height={size}
            idPrefix={idPrefix}
            initialWidth={fixed ? fixedSize : size}
            measureText={measureNoText}
            onFocusChange={handleFocusChange}
            onRender={handleRender}
            renderer={pieRenderer}
            width={size}
          /> : null}
          <ResourceHost idPrefix={idPrefix} resources={scopeResourceIds(defsChildren, idPrefix)} />
          {centerChildren.length === 0 ? null : <div style={CENTER_OVERLAY_STYLE}>{centerChildren}</div>}
        </PieHoverCoordinatorContext.Provider>
      </PieStableContext.Provider>
    </div>
  );
};

PieChart.displayName = "PieChart";

export type { PieSliceHoverEffect } from "./pie/model";
export { DEFAULT_HOVER_OFFSET, PieChart };
export type { PieChartProps };
