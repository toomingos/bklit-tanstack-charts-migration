// Bklit SankeyChart on TanStack Charts (native sankeyDiagram + WAAPI reveal, reactive hover dim).
import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { RendererChart } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import type {
  ChartInteractionController,
  ChartPoint,
  ChartRendererRenderContext,
  ChartScene,
} from "@tanstack/charts";
import type { SankeyLink as NativeSankeyLink } from "@tanstack/charts/network/sankey";
import type {
  LaidOutNode,
} from "./internal/sankey-layout";
import { createSankeyMark, SANKEY_LINK_MARK_ID, SANKEY_NODE_POINT_MARK_ID } from './internal/sankey-mark';
import type { LaidOutLink, SankeyGradientDatum } from './internal/sankey-mark';
import { injectGradientDefs, runSankeyReveal, stampSankeyLinkPathLength } from './internal/sankey-animation';
import type { SankeyEnterTransition, SankeyRevealHandle } from './internal/sankey-animation';
import "./styles.css";
import { findHoveredSankeyTarget } from "./internal/sankey-hover-chrome";
import type { SankeyHitTarget } from "./internal/sankey-hover-chrome";
import { intFmt } from "./internal/formatters";
import { CHART_CATEGORY_PALETTE_WITH_FALLBACK } from "./internal/design-tokens";
import type { SankeyLinkProps } from "./internal/sankey-link";
import type { SankeyNodeProps } from "./internal/sankey-node";
import type { SankeyTooltipProps } from "./internal/sankey-tooltip";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { chartMotionRenderer } from "./internal/motion-renderer";

interface SankeyNodeDatum {
  name: string;
  category?: "source" | "landing" | "outcome";
  [key: string]: unknown;
}

interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
  [key: string]: unknown;
}

interface SankeyData {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface SankeyChartProps {
  data: SankeyData;
  margin?: Partial<Margin>;
  animationDuration?: number;
  enterTransition?: SankeyEnterTransition;
  revealSignature?: string;
  aspectRatio?: string;
  nodeWidth?: number;
  nodePadding?: number;
  className?: string;
  children: ReactNode;
  hoveredNodeIndex?: number | null;
  onNodeHoverChange?: (index: number | null) => void;
}

const DEFAULT_MARGIN: Margin = { bottom: 40, left: 180, right: 180, top: 40 };
const DEFAULT_ANIMATION_DURATION = 1100;
const DEFAULT_NODE_WIDTH = 16;
const DEFAULT_NODE_PADDING = 24;
// Dimmed opacities applied to non-hovered sankey elements during hover focus.
const DEFAULT_FADED_LINK_OPACITY = 0.1;
const DEFAULT_FADED_NODE_OPACITY = 0.4;
// Node dot radius fallback (prop keeps bklit's `lineCap` name for API parity).
const DEFAULT_NODE_LINE_CAP = 4;
// Base link stroke opacity.
const DEFAULT_LINK_STROKE_OPACITY = 0.5;
// Charts narrower than this skip the WAAPI reveal (no room to animate).
const MIN_SANKEY_RENDER_WIDTH_PX = 10;

const DEFAULT_COLORS: readonly string[] = CHART_CATEGORY_PALETTE_WITH_FALLBACK;

const defaultNodeColor = (index: number): string => DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? DEFAULT_COLORS[0]

const isString = <Value,>(value: Value): value is Value & string => typeof value === "string";

const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";

const isFunctionValue = <Value,>(value: Value): value is Value & ((...args: readonly unknown[]) => void) =>
  typeof value === "function";

const isObjectValue = <Value,>(value: Value): value is Value & object => typeof value === "object";

// Narrow tooltip views over the laid-out rows the marks emit.
// Node points carry the laid-out node; link points carry the native link context.
interface SankeyTooltipNodeDatum {
  readonly name: string;
  readonly value?: number;
}

interface SankeyTooltipLinkEndpoint {
  readonly data: SankeyTooltipNodeDatum;
}

interface SankeyTooltipLinkDatum {
  readonly sourceNode: SankeyTooltipLinkEndpoint;
  readonly targetNode: SankeyTooltipLinkEndpoint;
  readonly sourceIndex: number;
  readonly targetIndex: number;
  readonly value: number;
}

type SankeyTooltipDatum = SankeyTooltipNodeDatum | SankeyTooltipLinkDatum;

// Datum flowing through this chart's renderer, definition, and render callbacks.
type SankeyRenderDatum = LaidOutNode | NativeSankeyLink<SankeyNodeDatum, SankeyLinkDatum, number>;

const isSankeyTooltipDatum = <Value,>(value: Value): value is Value & SankeyTooltipDatum => isObjectValue(value);

interface SankeyLinkEndName {
  readonly name?: string;
}

interface SankeyLinkEnd {
  readonly data?: SankeyLinkEndName;
}

interface SankeyHoverHandlers {
  readonly onLinkEnter: (index: number) => void;
  readonly onLinkLeave: () => void;
  readonly onNodeEnter: (index: number) => void;
  readonly onNodeLeave: () => void;
}

const hasDisplayName = (type: ReactElement["type"], name: string): boolean => {
  if (isString(type)) {return false;}
  if (!isFunctionValue(type) && !isObjectValue(type)) {return false;}
  return "displayName" in type && type.displayName === name;
}

const extractChildByDisplayName = <P,>(children: ReactNode, name: string): ReactElement<P> | undefined => {
  const matches = Children.toArray(children).filter(
    (child): child is ReactElement<P> =>
      isValidElement(child) && hasDisplayName(child.type, name),
  );
  return matches.at(-1);
}

const extractSankeyLinkConfig = (children: ReactNode): SankeyLinkProps => {
  const child = extractChildByDisplayName<SankeyLinkProps>(children, "SankeyLink");
  return child?.props ?? {};
}

const extractSankeyNodeConfig = (children: ReactNode): SankeyNodeProps => {
  const child = extractChildByDisplayName<SankeyNodeProps>(children, "SankeyNode");
  return child?.props ?? {};
}

const extractSankeyTooltipConfig = (children: ReactNode): SankeyTooltipProps => {
  const child = extractChildByDisplayName<SankeyTooltipProps>(children, "SankeyTooltip");
  return child?.props ?? {};
}

const sankeyNodeName = (node: { readonly name?: string }, index: number): string =>
  node.name ?? `Node ${index}`;

const sankeyLinkEndName = (end: { readonly data?: { readonly name?: string } } | undefined, index: number): string =>
  end?.data?.name ?? `Node ${index}`;

const sankeyLinkValue = (value: number | undefined): number => value ?? 0;

const datumName = (datum: SankeyTooltipDatum): string | undefined => {
  if (!("name" in datum)) {return undefined;}
  const name: unknown = datum.name;
  return isString(name) ? name : undefined;
}

const datumValue = (datum: SankeyTooltipDatum): number | undefined => {
  if (!("value" in datum)) {return undefined;}
  const value: unknown = datum.value;
  return isNumber(value) ? value : undefined;
}

const linkEndDataOf = (data: SankeyTooltipNodeDatum | undefined): SankeyLinkEndName => {
  const name: unknown = data?.name;
  if (!isString(name)) {return {};}
  return { name };
}

const linkEndOf = (end: SankeyTooltipLinkEndpoint | undefined): SankeyLinkEnd | undefined => {
  if (end === undefined || !("data" in end)) {return undefined;}
  return { data: linkEndDataOf(end.data) };
}

const readLinkIndexValue = (datum: object, key: "sourceIndex" | "targetIndex"): number | undefined => {
  if (key === "sourceIndex") {
    const raw: unknown = "sourceIndex" in datum ? datum.sourceIndex : undefined;
    return isNumber(raw) ? raw : undefined;
  }
  const raw: unknown = "targetIndex" in datum ? datum.targetIndex : undefined;
  return isNumber(raw) ? raw : undefined;
};

const linkIndexOf = (datum: SankeyTooltipDatum, key: "sourceIndex" | "targetIndex"): number =>
  readLinkIndexValue(datum, key) ?? 0;

const sankeyLinkTitle = (datum: SankeyTooltipDatum): string => {
  const sourceNode = "sourceNode" in datum ? linkEndOf(datum.sourceNode) : undefined;
  const targetNode = "targetNode" in datum ? linkEndOf(datum.targetNode) : undefined;
  const sourceName = sankeyLinkEndName(sourceNode, linkIndexOf(datum, "sourceIndex"));
  const targetName = sankeyLinkEndName(targetNode, linkIndexOf(datum, "targetIndex"));
  return `${sourceName} → ${targetName}`;
};

const renderSankeyTooltipRow = (isNode: boolean, formatValue: (value: number) => string, datum: SankeyTooltipDatum): ReactElement => (
  <div style={{ alignItems: "center", display: "flex", gap: 16, justifyContent: "space-between" }}>
    <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
      <span style={{ backgroundColor: isNode ? "var(--chart-line-primary)" : "var(--chart-foreground-muted)", borderRadius: "50%", display: "inline-block", flexShrink: 0, height: 10, width: 10 }} />
      <span style={{ color: "var(--chart-tooltip-muted, var(--muted-foreground))", fontSize: 14, lineHeight: "20px" }}>
        {isNode ? "Sessions" : "Flow"}
      </span>
    </div>
    <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", fontWeight: 500, lineHeight: "20px" }}>
      {formatValue(sankeyLinkValue(datumValue(datum)))}
    </span>
  </div>
);

const renderSankeyTooltipBody = (point: ChartPoint | undefined, formatValue: (value: number) => string, className?: string): ReactNode => {
  if (!point) {return undefined;}

  const isNode = point.markId === SANKEY_NODE_POINT_MARK_ID;
  const rawDatum: unknown = point.datum;
  const datum: SankeyTooltipDatum | undefined = isSankeyTooltipDatum(rawDatum) ? rawDatum : undefined;
  if (datum === undefined) {return undefined;}
  const title: string = isNode
    ? sankeyNodeName({ name: datumName(datum) }, point.datumIndex)
    : sankeyLinkTitle(datum);

  return (
    <div className={className !== undefined && className !== "" ? `bkm-tooltip-panel ${className}` : "bkm-tooltip-panel"}>
    <div style={{ padding: "10px 12px" }}>
      <div style={{ fontSize: 12, fontWeight: 500, lineHeight: "16px", marginBottom: 8, textAlign: "left" }}>
        {title}
      </div>
      {renderSankeyTooltipRow(isNode, formatValue, datum)}
    </div>
    </div>
  );
}

const createHoverHandlers = (hoveredNodeIndexRef: { current: number | null }, hoveredLinkIndexRef: { current: number | null }, focusPointerPoint: (predicate: ((point: ChartPoint) => boolean) | null) => void): SankeyHoverHandlers => ({
    onLinkEnter: (i: number): void => {
      hoveredLinkIndexRef.current = i;
      hoveredNodeIndexRef.current = null;
      focusPointerPoint((point) => point.markId === SANKEY_LINK_MARK_ID && point.datumIndex === i);
    },
    onLinkLeave: (): void => {
      hoveredLinkIndexRef.current = null;
      focusPointerPoint(null);
    },
    onNodeEnter: (i: number): void => {
      hoveredNodeIndexRef.current = i;
      hoveredLinkIndexRef.current = null;
      focusPointerPoint((point) => point.markId === SANKEY_NODE_POINT_MARK_ID && point.datumIndex === i);
    },
    onNodeLeave: (): void => {
      hoveredNodeIndexRef.current = null;
      focusPointerPoint(null);
    },
  })

interface SankeyRevealReset {
  readonly revealHandleRef: RefObject<SankeyRevealHandle | null>;
  readonly seenRef: RefObject<RevealKey | null>;
  readonly signature: string;
  readonly duration: number;
}

const resetSankeyReveal = (params: Readonly<SankeyRevealReset>): void => {
  const { revealHandleRef, seenRef, signature, duration } = params;
  revealHandleRef.current?.cancel();
  revealHandleRef.current = null;
  seenRef.current = { duration, signature };
}

interface SankeyRevealStart extends SankeyRevealReset {
  readonly animationDuration: number;
  readonly enterTransition: SankeyEnterTransition | undefined;
  readonly svg: SVGSVGElement;
}

const startSankeyReveal = (params: Readonly<SankeyRevealStart>): void => {
  const { revealHandleRef, seenRef, signature, duration, animationDuration, enterTransition, svg } = params;
  seenRef.current = { duration, signature };
  revealHandleRef.current?.cancel();
  revealHandleRef.current = runSankeyReveal({
    animationDuration,
    enterTransition,
    svg,
  });
}

interface SankeyRevealUpdate {
  readonly revealSignature: string;
  readonly animationDuration: number;
  readonly enterTransition: SankeyEnterTransition | undefined;
  readonly prefersReducedMotion: boolean;
  readonly seenRef: RefObject<RevealKey | null>;
  readonly revealHandleRef: RefObject<SankeyRevealHandle | null>;
}

const updateSankeyReveal = (svg: SVGSVGElement, params: Readonly<SankeyRevealUpdate>): void => {
  const { revealSignature, animationDuration, enterTransition, prefersReducedMotion, seenRef, revealHandleRef } = params;
  const seen = seenRef.current;
  if (seen?.signature === revealSignature && seen.duration === animationDuration) { return; }
  if (prefersReducedMotion || animationDuration <= 0) {
    resetSankeyReveal({ duration: animationDuration, revealHandleRef, seenRef, signature: revealSignature });
    return;
  }
  if (svg.getBoundingClientRect().width < MIN_SANKEY_RENDER_WIDTH_PX) { return; }
  startSankeyReveal({ animationDuration, duration: animationDuration, enterTransition, revealHandleRef, seenRef, signature: revealSignature, svg });
}

interface SankeyHoverHitParams {
  readonly clientX: number;
  readonly clientY: number;
  readonly laidOutLinks: LaidOutLink[];
  readonly laidOutNodes: LaidOutNode[];
}

const findSankeyHoverHit = (
  interaction: ChartInteractionController<SankeyRenderDatum>,
  params: Readonly<SankeyHoverHitParams>,
): SankeyHitTarget | undefined => {
  const { clientX, clientY, laidOutLinks, laidOutNodes } = params;
  const point = interaction.clientToScene(clientX, clientY);
  if (!point) { return undefined; }
  const hit = findHoveredSankeyTarget(point, laidOutNodes, laidOutLinks);
  if (!hit) { return undefined; }
  return hit;
}

interface SankeyHoverRefs {
  current: number | null;
}

const buildSankeyClearHover = (
  hoveredNodeIndexRef: SankeyHoverRefs,
  hoveredLinkIndexRef: SankeyHoverRefs,
  focusPointerPoint: (predicate: ((point: ChartPoint) => boolean) | null) => void,
): (() => void) => (): void => {
  let cleared = false;
  if (hoveredNodeIndexRef.current !== null) {
    hoveredNodeIndexRef.current = null;
    cleared = true;
  }
  if (hoveredLinkIndexRef.current !== null) {
    hoveredLinkIndexRef.current = null;
    cleared = true;
  }
  if (cleared) {focusPointerPoint(null);}
}

// The reveal's replay key: a new reveal runs when any of these change.
interface RevealKey {
  signature: string;
  duration: number;
}

const SankeyChart = ({
  data,
  margin: marginProp,
  animationDuration = DEFAULT_ANIMATION_DURATION,
  enterTransition,
  revealSignature = "",
  aspectRatio = "2 / 1",
  nodeWidth = DEFAULT_NODE_WIDTH,
  nodePadding = DEFAULT_NODE_PADDING,
  className = "",
  children,
  hoveredNodeIndex: hoveredNodeIndexProp,
  onNodeHoverChange,
}: SankeyChartProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gradientDataRef = useRef<SankeyGradientDatum[] | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Replay triggers are signature+duration only; same-signature new data must not replay.
  const seenRevealKeyRef = useRef<RevealKey | null>(null);
  const revealHandleRef = useRef<SankeyRevealHandle | null>(null);

  const laidOutNodesRef = useRef<LaidOutNode[] | null>(null);
  const laidOutLinksRef = useRef<LaidOutLink[] | null>(null);

  useEffect(() => 
    (): void => {
      revealHandleRef.current?.cancel();
      revealHandleRef.current = null;
      seenRevealKeyRef.current = null;
    }
  , []);

  const linkConfig: SankeyLinkProps = useMemo(() => ({ useGradient: true, ...extractSankeyLinkConfig(children) }), [children]);
  const nodeConfig = useMemo(() => extractSankeyNodeConfig(children), [children]);
  const tooltipConfig = useMemo(() => extractSankeyTooltipConfig(children), [children]);

  const getNodeColorFn = useCallback(
    (node: LaidOutNode, index: number) => {
      if (nodeConfig.fill !== undefined && nodeConfig.fill !== "") {return nodeConfig.fill;}
      if (nodeConfig.getNodeColor) {return nodeConfig.getNodeColor(node, index);}
      return defaultNodeColor(index);
    },
    [nodeConfig],
  );

  // Hover lives in React state (dim rebuilds the definition); a ref mirror serves synchronous readers.
  const [hoveredLinkIndex, setHoveredLinkIndex] = useState<number | null>(null);
  const hoveredLinkIndexLiveRef = useRef<number | null>(null);
  hoveredLinkIndexLiveRef.current = hoveredLinkIndex;
  const hoveredLinkIndexRef = {
    get current(): number | null {
      return hoveredLinkIndexLiveRef.current;
    },
    set current(next: number | null) {
      setHoveredLinkIndex(next);
    },
  };
  // Inject source:'pointer' — programmatic would wrongly satisfy the legend-dim predicate.
  const sceneRef = useRef<ChartScene<SankeyRenderDatum> | null>(null);
  const interactionRef = useRef<ChartInteractionController<SankeyRenderDatum> | null>(null);
  const focusPointerPoint = useCallback(
    (predicate: ((point: ChartPoint) => boolean) | null) => {
      const interaction = interactionRef.current;
      if (!interaction) {return;}
      if (!predicate) {
        interaction.setControlledFocus(null, { source: "pointer" });
        return;
      }
      const point = sceneRef.current?.points.find(predicate) ?? null;
      interaction.setControlledFocus(point, { source: "pointer" });
    },
    [],
  );

  const isNodeHoverControlledRef = useRef(hoveredNodeIndexProp !== undefined);
  isNodeHoverControlledRef.current = hoveredNodeIndexProp !== undefined;
  const controlledNodeIndexRef = useRef<number | null>(hoveredNodeIndexProp ?? null);
  controlledNodeIndexRef.current = hoveredNodeIndexProp ?? null;
  const [internalHoveredNodeIndex, setInternalHoveredNodeIndex] = useState<number | null>(null);
  const internalHoveredNodeIndexRef = useRef<number | null>(null);
  internalHoveredNodeIndexRef.current = internalHoveredNodeIndex;
  const onNodeHoverChangeRef = useRef(onNodeHoverChange);
  onNodeHoverChangeRef.current = onNodeHoverChange;
  const hoveredNodeIndexRef = {
    get current(): number | null {
      return isNodeHoverControlledRef.current
        ? controlledNodeIndexRef.current
        : internalHoveredNodeIndexRef.current;
    },
    set current(next: number | null) {
      if (isNodeHoverControlledRef.current) {
        onNodeHoverChangeRef.current?.(next);
      } else {
        setInternalHoveredNodeIndex(next);
      }
    },
  };
  const effectiveHoveredNodeIndex = isNodeHoverControlledRef.current
    ? (hoveredNodeIndexProp ?? null)
    : internalHoveredNodeIndex;

  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);

  const markConfig = useMemo(() => ({
    fadedLinkOpacity: linkConfig.fadedOpacity ?? DEFAULT_FADED_LINK_OPACITY,
    fadedNodeOpacity: nodeConfig.fadedOpacity ?? DEFAULT_FADED_NODE_OPACITY,
    hoveredLinkIndex,
    hoveredNodeIndex: effectiveHoveredNodeIndex,
    labelOrientation: nodeConfig.labelOrientation ?? "horizontal",
    lineCap: nodeConfig.lineCap ?? DEFAULT_NODE_LINE_CAP,
    nodeColorFn: getNodeColorFn,
    nodePadding,
    nodeWidth,
    showLabels: nodeConfig.showLabels ?? true,
    showValueLabels: nodeConfig.showValueLabels ?? true,
    strokeOpacity: linkConfig.strokeOpacity ?? DEFAULT_LINK_STROKE_OPACITY,
    strokeOverride: linkConfig.stroke,
    useGradient: linkConfig.useGradient ?? true,
  }), [
    linkConfig,
    getNodeColorFn,
    nodeConfig.lineCap,
    nodeWidth,
    nodePadding,
    nodeConfig.showLabels,
    nodeConfig.showValueLabels,
    nodeConfig.labelOrientation,
    nodeConfig.fadedOpacity,
    effectiveHoveredNodeIndex,
    hoveredLinkIndex,
  ]);

  const definition = useMemo(
    () =>
      defineChart({
        focusRing: false,
        guides: false,
        margin,
        marks: [createSankeyMark({ config: markConfig, data, gradientDataRef, laidOutLinksRef, laidOutNodesRef })],
        // App-owned hit-testing stays the sole hover source; native mousemove must not clear bridged focus.
        pointer: false,
        scales: { x: null, y: null },
        // Palette override has no pixel effect (colors resolve JS-side); keeps native surfaces agreeing.
        theme: { palette: CHART_CATEGORY_PALETTE_WITH_FALLBACK },
        tooltip: {
          anchor: "point",
          className: "bkm-native-tooltip",
          offset: 16,
          placement: ["right", "left"],
          sticky: false,
          use: tooltip,
        },
      }),
    [data, markConfig, margin],
  );

  const handleRender = useCallback((context: ChartRendererRenderContext<SankeyRenderDatum>) => {
    // Context datum matches the renderer prop below so RendererChart infers one datum type.
    sceneRef.current = context.scene;
    interactionRef.current = context.interaction;

    const surfaceEl = context.surface.element;
    if (!(surfaceEl instanceof SVGSVGElement)) {return;}

    const gradients = gradientDataRef.current;
    if (gradients && gradients.length > 0) {
      injectGradientDefs(surfaceEl, gradients);
    }
    stampSankeyLinkPathLength(surfaceEl);

    updateSankeyReveal(surfaceEl, {
      animationDuration,
      enterTransition,
      prefersReducedMotion,
      revealHandleRef,
      revealSignature,
      seenRef: seenRevealKeyRef,
    });
  }, [revealSignature, animationDuration, enterTransition, prefersReducedMotion]);

  // Layout coords are margin-inclusive already, so no margin subtraction before hit-test.
  useEffect((): (() => void) | undefined => {
    const svg = containerRef.current?.querySelector<SVGSVGElement>("svg");
    if (!svg) {return undefined;}

    const handlers = createHoverHandlers(
      hoveredNodeIndexRef,
      hoveredLinkIndexRef,
      focusPointerPoint,
    );

    const clearHover = buildSankeyClearHover(hoveredNodeIndexRef, hoveredLinkIndexRef, focusPointerPoint);

    const handlePointerMove = (event: PointerEvent): void => {
      const interaction = interactionRef.current;
      if (!interaction) {return;}
      const hit = findSankeyHoverHit(interaction, {
        clientX: event.clientX,
        clientY: event.clientY,
        laidOutLinks: laidOutLinksRef.current ?? [],
        laidOutNodes: laidOutNodesRef.current ?? [],
      });
      if (!hit) {
        clearHover();
        return;
      }
      if (hit.type === "node") {
        handlers.onNodeEnter(hit.index);
      } else {
        handlers.onLinkEnter(hit.index);
      }
    };

    const handlePointerLeave = (): void =>{  clearHover(); };

    svg.addEventListener("pointermove", handlePointerMove);
    svg.addEventListener("pointerleave", handlePointerLeave);
    return (): void => {
      svg.removeEventListener("pointermove", handlePointerMove);
      svg.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [data, focusPointerPoint]);

  useEffect(() => {
    if (!isNodeHoverControlledRef.current) {return;}
    setHoveredLinkIndex(null);
  }, [hoveredNodeIndexProp]);

  const handleMouseLeave = useCallback(() => {
    hoveredNodeIndexRef.current = null;
    hoveredLinkIndexRef.current = null;
    focusPointerPoint(null);
  }, [focusPointerPoint]);

  const formatValue = tooltipConfig.formatValue ?? intFmt;

  const parsedAspectRatio = useMemo(() => {
    const parts = aspectRatio.split("/").map((part) => Number(part.trim()));
    const numerator = parts.at(0);
    const denominator = parts.at(1);
    if (parts.length !== 2 || numerator === undefined || denominator === undefined) {
      return 2;
    }
    if (!numerator || !denominator || Number.isNaN(numerator) || Number.isNaN(denominator)) {
      return 2;
    }
    return numerator / denominator;
  }, [aspectRatio]);

  return (
    <div
      className={className}
      data-bkm-chart="sankey"
      ref={containerRef}
      style={{ aspectRatio, position: "relative", userSelect: "none", width: "100%" }}
      onMouseLeave={handleMouseLeave}
    >
      <RendererChart
        renderer={chartMotionRenderer<LaidOutNode | NativeSankeyLink<SankeyNodeDatum, SankeyLinkDatum, number>>()}
        ariaLabel="Sankey chart"
        aspectRatio={parsedAspectRatio}
        definition={definition}
        onRender={handleRender}
        renderTooltipBody={(ctx) => renderSankeyTooltipBody(ctx.points[0], formatValue, tooltipConfig.className)}
      />
    </div>
  );
}

SankeyChart.displayName = "SankeyChart";

export { SankeyLink } from "./internal/sankey-link";
export { SankeyNode } from "./internal/sankey-node";
export { SankeyTooltip } from "./internal/sankey-tooltip";
export { SankeyChart };
export type { SankeyLinkProps } from "./internal/sankey-link";
export type { SankeyLabelOrientation, SankeyNodeProps } from "./internal/sankey-node";
export type { SankeyTooltipProps } from "./internal/sankey-tooltip";
export type {
  SankeyChartProps,
  SankeyData,
  SankeyLinkDatum,
  SankeyNodeDatum,
  Margin,
};
export default SankeyChart;
