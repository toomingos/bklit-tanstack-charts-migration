// Bklit RingChart on native radialArc marks (track + progress per ring) inside polar(); the entrance is a CSS track expand plus a progress sweep on its own layer (ring/progress-layer.ts).
// Custom: a per-ring arc generator (ring/arc.ts) and the NumberFlow center island; focus is the native annulus strategy via onFocusChange.
import { useCallback, useMemo, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import { Chart } from "@tanstack/react-charts/core";
import { defineChart } from "@tanstack/charts/scene";
import { measureNoText } from "./kit/polar/measure-no-text";
import { motion } from "@tanstack/charts/motion";
import { polar, radialArc } from "@tanstack/charts/polar";
import type { ChartRendererRenderContext, DomChartDefinition } from "@tanstack/charts";
import { useSanitizedId } from "./kit/use-sanitized-id";
import { CHART_PALETTE } from "./kit/palette";
import { createAnnularFocus, useHostHoverAttr, usePolarHover } from "./kit/polar/polar-hover";
import type { AnnulusTarget, HoverSource } from "./kit/polar/polar-hover";
import { ringArcGenerator } from "./ring/arc";
import type { RingArcRow } from "./ring/arc";
import { RingHoverCoordinatorContext, RingStableContext, classifyRingChildren, defaultRingColors } from "./ring/model";
import type { RingChildConfig, RingData, RingEnterTransition, RingStableValue } from "./ring/model";
import { MAX_INDEX } from "./kit/polar/polar-dim";
import { liveRingScale, springRings } from "./ring/ring-springs";
import { ringEntranceVars } from "./ring/entrance-css";
import { createProgressLayer } from "./ring/progress-layer";
import type { ProgressLayerOptions } from "./ring/progress-layer";
import { EntranceAlign, useRenderStart } from "./kit/entrance/entrance-align";
import type { EntranceOrigin } from "./kit/entrance/entrance-origin";
import { useKeyboardFocusHold } from "./kit/cartesian/keyboard-hold";
import { INITIAL_WIDTH_PX, useFluidWidth } from "./kit/size/use-fluid-width";
import { useIsClient } from "./kit/size/use-is-client";
import { useTapFocus } from "./kit/cartesian/touch-focus";
import "./styles.css";
import "./polar.css";

// The track scale is a CSS animation; bklit's is a JS-driven motion value, so it takes motion's `motion` origin (kit/entrance/entrance-origin.ts).
const RING_ENTRANCE_ORIGINS = { "bkm-ring-in": "motion" } as const satisfies Readonly<Record<string, EntranceOrigin>>;

const ringIndexOf = (datum: Readonly<RingArcRow>): number => datum.ringIndex;
const RING_BACKGROUND = "var(--border)";
const RING_INSET_PX = 8;
const MIN_RING_SIZE_PX = 10;
const HIT_SLACK_PX = 0;
const MIN_PROGRESS = 0.001;
const ringRenderer = motion({ initial: "always", respectReducedMotion: true });
// Mark-level `motion` (staggered entrance) is only consulted on a client mount; an SSR-adopted
// chart replays with the renderer default. Mount the chart after hydration so the stagger applies.

const CENTER_OVERLAY_STYLE: CSSProperties = {
  alignItems: "center", display: "flex", inset: 0, justifyContent: "center", pointerEvents: "none", position: "absolute",
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

interface BuildRingDefinitionOptions {
  readonly rows: readonly RingArcRow[];
  readonly fit: number;
  readonly size: number;
  /** Read at pointer time only (never rebuilds the definition): the hovered ring and the rings pushed out scale, so their hit areas do too. */
  readonly hoverSource: Pick<HoverSource, "getHovered">;
  readonly hostRef: RefObject<HTMLElement | null>;
  readonly sweep: Omit<ProgressLayerOptions, "arc" | "rows">;
}

const buildRingDefinition = (options: Readonly<BuildRingDefinitionOptions>): DomChartDefinition<RingArcRow, number, number> => {
  const { rows, fit, size, hoverSource, hostRef, sweep } = options;
  const generator = ringArcGenerator(fit);
  const progressLayer = createProgressLayer({ ...sweep, arc: (row) => generator()(row), rows });
  // One mark per ring layer, tracks first so they share the host's layer: tracks scale in through CSS, progress arcs sweep on their own layer renderer.
  const arcs = [...rows.filter((row) => row.kind === "track"), ...rows.filter((row) => row.kind === "progress")].map((row) => radialArc<RingArcRow>([row], {
    // radialArc `className` (reference/marks/polar.md); hover/entrance CSS keys on it.
    className: `bkm-rg-arc bkm-rg-${row.ringIndex} bkm-rg-${row.kind}`,
    fill: (datum: Readonly<RingArcRow>) => datum.fill,
    generator,
    id: `ring:${row.key}`,
    key: (datum) => `ring:${datum.key}`,
    // No native mark motion: the progress layer redraws the arc path itself (ring/progress-layer.ts), so the leading cap stays rounded.
    motion: false,
    renderer: row.kind === "progress" ? progressLayer : undefined,
  }));
  // bklit hit-tests the painted ring paths exactly (scan: hits end at the painted outer radius), so the targets are the static annuli.
  const targets = rows.flatMap((row): AnnulusTarget[] => row.kind === "track" ? [{
    endAngle: row.endAngle, index: row.ringIndex, innerRadius: row.innerRadius * fit - HIT_SLACK_PX,
    outerRadius: row.outerRadius * fit + HIT_SLACK_PX, startAngle: row.startAngle,
  }] : []);
  return defineChart({
    focus: createAnnularFocus<RingArcRow>({
      center: size / 2,
      focusable: (point) => point.markId.startsWith("ring:ring-"),
      hovered: hoverSource.getHovered,
      indexOf: ringIndexOf,
      navigable: (point) => point.markId.endsWith("-track"),
      // bklit hit-tests its live motion-scaled paths, so the hit annulus follows the painted spring value, not the target.
      scaleOf: (index, hovered) => liveRingScale(hostRef.current, index, hovered),
      targets,
    }),
    focusRing: false,
    guides: false,
    marks: [polar({ id: "ring", inset: RING_INSET_PX, marks: arcs, radiusRatio: 1, scales: { angle: null, radius: null } })],
    scales: { x: null, y: null },
    theme: { palette: CHART_PALETTE },
    tooltip: false,
  });
};

const RingChart = ({
  data,
  size: fixedSize,
  strokeWidth = 12,
  ringGap = 6,
  baseInnerRadius = 60,
  className,
  style,
  hoveredIndex,
  onHoverChange,
  startAngle = -Math.PI / 2,
  endAngle = (3 * Math.PI) / 2,
  enterTransition,
  enterStaggerScale = 1,
  geometryScrubbing = false,
  children,
  ariaLabel = "Ring chart",
  ariaDescription,
}: Readonly<RingChartProps>): ReactElement => {
  const renderStart = useRenderStart();
  const isClient = useIsClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idPrefix = useSanitizedId();
  const fixed = fixedSize !== undefined && fixedSize !== 0;
  // Fluid mode: measured before <Chart> mounts (it starts at its real width) and followed by the host's own observer (kit/size/use-fluid-width.ts).
  const { ready: hostReady, width: measuredWidth } = useFluidWidth(containerRef, { enabled: !fixed, epsilon: 0.5, initialWidth: INITIAL_WIDTH_PX, collapseBelow: MIN_RING_SIZE_PX });
  const size = fixed ? fixedSize : measuredWidth;
  const interactionRef = useRef<ChartRendererRenderContext<RingArcRow, number, number>["interaction"] | null>(null);
  useTapFocus(containerRef, () => interactionRef.current, { mode: "tap" });
  const handleRender = useCallback((context: Readonly<ChartRendererRenderContext<RingArcRow, number, number>>): void => {
    interactionRef.current = context.interaction;
  }, []);

  const hover = usePolarHover<RingArcRow>({ hoveredIndex, indexOf: ringIndexOf, onHoverChange });
  const holdFocus = useKeyboardFocusHold(containerRef, () => interactionRef.current);
  const reportFocus = hover.handleFocusChange;
  const handleFocusChange = useCallback((point: Parameters<typeof reportFocus>[0]): void => { holdFocus(point); reportFocus(point); }, [holdFocus, reportFocus]);

  const ringCount = data.length;
  const designOuter = baseInnerRadius + ringCount * strokeWidth + Math.max(0, ringCount - 1) * ringGap;
  const availableRadius = size / 2 - RING_INSET_PX;
  const fit = designOuter > 0 ? Math.min(1, availableRadius / designOuter) : 1;

  const totalValue = useMemo(() => data.reduce((sum, ring: Readonly<RingData>) => sum + ring.value, 0), [data]);
  const getColor = useCallback((index: number): string => {
    const custom = data[index]?.color;
    return custom !== undefined && custom !== "" ? custom : defaultRingColors[index % defaultRingColors.length];
  }, [data]);

  const { centerChildren, ringConfigs } = useMemo(() => classifyRingChildren(children, geometryScrubbing), [children, geometryScrubbing]);
  const configByIndex = useMemo(
    () => new Map(ringConfigs.map((config: Readonly<RingChildConfig>) => [config.index, config])),
    [ringConfigs],
  );

  const rows = useMemo((): readonly RingArcRow[] => {
    const sweep = endAngle - startAngle;
    return data.flatMap((ring: Readonly<RingData>, index: number): RingArcRow[] => {
      const config = configByIndex.get(index);
      const innerRadius = baseInnerRadius + index * (strokeWidth + ringGap);
      const cornerRadius = config?.lineCap === "butt" ? 0 : strokeWidth / 2;
      const animate = config?.animate ?? true;
      const ratio = ring.value / ring.maxValue;
      const progress = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
      const color = config?.color !== undefined && config.color !== "" ? config.color : getColor(index);
      const common = { animate, cornerRadius, innerRadius, outerRadius: innerRadius + strokeWidth, ringIndex: index, startAngle };
      const track: RingArcRow = { ...common, endAngle, fill: RING_BACKGROUND, key: `ring-${index}-track`, kind: "track" };
      if (progress <= MIN_PROGRESS ) { return [track]; }
      return [track, { ...common, endAngle: startAngle + sweep * progress, fill: color, key: `ring-${index}-progress`, kind: "progress" }];
    });
  }, [data, configByIndex, baseInnerRadius, strokeWidth, ringGap, startAngle, endAngle, getColor]);

  useHostHoverAttr(hover.source, containerRef, !geometryScrubbing, size < MIN_RING_SIZE_PX, MAX_INDEX, springRings);
  // The first definition's progress layer owns the entrance sweep; a rebuilt definition (resize, data) snaps.
  const sweepClaim = useRef<object | null>(null);
  const definition = useMemo(
    () => buildRingDefinition({ fit, hostRef: containerRef, hoverSource: hover.source, rows, size, sweep: { claim: sweepClaim, enterStaggerScale, enterTransition, renderStart } }),
    [rows, fit, size, hover.source, enterStaggerScale, enterTransition, renderStart, sweepClaim],
  );

  const getRingRadii = useCallback((index: number) => {
    const inner = baseInnerRadius * fit + index * (strokeWidth + ringGap) * fit;
    return { innerRadius: inner, outerRadius: inner + strokeWidth * fit };
  }, [baseInnerRadius, strokeWidth, ringGap, fit]);

  const stable: RingStableValue = useMemo(() => ({
    animationKey: 0, baseInnerRadius: baseInnerRadius * fit, center: size / 2, containerRef, data, endAngle,
    enterStaggerScale, enterTransition, geometryScrubbing, getColor, getRingRadii, isLoaded: true,
    ringGap: ringGap * fit, scrubRingLayers: null, size, startAngle, strokeWidth: strokeWidth * fit, totalValue,
  }), [baseInnerRadius, fit, size, data, endAngle, enterStaggerScale, enterTransition, geometryScrubbing, getColor, getRingRadii, ringGap, startAngle, strokeWidth, totalValue]);

  const entranceVars = useMemo(
    () => ringEntranceVars({ animate: Array.from({ length: data.length }, (_unused, index) => configByIndex.get(index)?.animate ?? true), enterStaggerScale, enterTransition }),
    [data.length, configByIndex, enterStaggerScale, enterTransition],
  );
  // bklit's `showGlow` (ring.tsx:174) is a drop-shadow in a motion.g style framer-motion never writes to the DOM, so no glow shows; the prop is accepted and ignored.
  const boxStyle = useMemo((): CSSProperties => ({
    ...entranceVars,
    ...(fixed ? { height: fixedSize, width: fixedSize } : { aspectRatio: "1 / 1", width: "100%" }),
    ...style,
  }), [entranceVars, fixed, fixedSize, style]);
  const hostStyle = useMemo((): CSSProperties => ({ alignItems: "center", display: "flex", justifyContent: "center", position: "relative", ...boxStyle }), [boxStyle]);

  if (size < MIN_RING_SIZE_PX) {
    return <div className={className} data-bkm-chart="ring" data-slot="chart" ref={containerRef} style={boxStyle} />;
  }

  return (
    <div
      className={className}
      data-bkm-chart="ring"
      data-slot="chart"
      ref={containerRef}
      style={hostStyle}
    >
      <RingStableContext.Provider value={stable}>
        <RingHoverCoordinatorContext.Provider value={hover.source}>
          {isClient && hostReady ? <EntranceAlign hostRef={containerRef} origins={RING_ENTRANCE_ORIGINS} renderStart={renderStart} /> : null}
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
            renderer={ringRenderer}
            width={size}
          /> : null}
          {centerChildren.length === 0 ? null : <div style={CENTER_OVERLAY_STYLE}>{centerChildren}</div>}
        </RingHoverCoordinatorContext.Provider>
      </RingStableContext.Provider>
    </div>
  );
};

RingChart.displayName = "RingChart";

export { Ring } from "./ring/model";
export { RingChart };
export type { RingChartProps };
export type { RingContextValue, RingData, RingLineCap, RingProps } from "./ring/model";
