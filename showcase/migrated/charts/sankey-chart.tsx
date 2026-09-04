// Bklit SankeyChart on TanStack Charts (native sankeyDiagram + WAAPI reveal, reactive hover dim).
import { isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
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
  readonly name: string;
  readonly category?: "source" | "landing" | "outcome";
  readonly [key: string]: unknown;
}

interface SankeyLinkDatum {
  readonly source: number;
  target: number;
  readonly value: number;
  readonly [key: string]: unknown;
}

interface SankeyData {
  readonly nodes: readonly SankeyNodeDatum[];
  readonly links: readonly SankeyLinkDatum[];
}

interface Margin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

interface SankeyChartProps {
  readonly data: SankeyData;
  readonly margin?: Partial<Margin>;
  readonly animationDuration?: number;
  readonly enterTransition?: SankeyEnterTransition;
  readonly revealSignature?: string;
  readonly aspectRatio?: string;
  readonly nodeWidth?: number;
  readonly nodePadding?: number;
  readonly className?: string;
  readonly children: ReactNode;
  readonly hoveredNodeIndex?: number | null;
  readonly onNodeHoverChange?: (index: number | null) => void;
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
// Numeric fallback for the "W / H" aspectRatio prop when it fails to parse.
const DEFAULT_SANKEY_ASPECT_RATIO = 2;
// Palette index for the node-color fallback when the computed slot is empty.
const FIRST_PALETTE_INDEX = 0;
// Last-match wins when several config children share a displayName.
const LAST_CONFIG_MATCH_INDEX = -1;
// Link value fallback when the probed datum carries no numeric value.
const FALLBACK_LINK_VALUE = 0;
// Endpoint index fallback when the probed datum carries no numeric index.
const FALLBACK_LINK_ENDPOINT_INDEX = 0;
// Non-positive durations skip the WAAPI reveal entirely.
const MIN_ANIMATION_DURATION = 0;
// Gradient definitions are injected only when the layout emitted at least one.
const EMPTY_GRADIENT_COUNT = 0;
// The tooltip renders the first focused point only.
const FIRST_TOOLTIP_POINT_INDEX = 0;
// Positions within a "W / H" aspect-ratio pair.
const ASPECT_NUMERATOR_INDEX = 0;
const ASPECT_DENOMINATOR_INDEX = 1;
const ASPECT_PART_COUNT = 2;

const DEFAULT_COLORS: readonly string[] = CHART_CATEGORY_PALETTE_WITH_FALLBACK;

// Tooltip panel row layout for sankey tooltips.
const SANKEY_TOOLTIP_ROW_STYLE = { alignItems: "center", display: "flex", gap: 16, justifyContent: "space-between" } as const;
// Tooltip row inner layout for the sankey tooltip dot and label.
const SANKEY_TOOLTIP_ROW_INNER_STYLE = { alignItems: "center", display: "flex", gap: 8 } as const;
// Tooltip dot for node rows in the sankey tooltip.
const SANKEY_TOOLTIP_DOT_NODE_STYLE = { backgroundColor: "var(--chart-line-primary)", borderRadius: "50%", display: "inline-block", flexShrink: 0, height: 10, width: 10 } as const;
// Tooltip dot for flow rows in the sankey tooltip.
const SANKEY_TOOLTIP_DOT_FLOW_STYLE = { backgroundColor: "var(--chart-foreground-muted)", borderRadius: "50%", display: "inline-block", flexShrink: 0, height: 10, width: 10 } as const;
// Tooltip label text for sankey tooltip rows.
const SANKEY_TOOLTIP_LABEL_STYLE = { color: "var(--chart-tooltip-muted, var(--muted-foreground))", fontSize: 14, lineHeight: "20px" } as const;
// Tooltip value text for sankey tooltip rows.
const SANKEY_TOOLTIP_VALUE_STYLE = { fontSize: 14, fontVariantNumeric: "tabular-nums", fontWeight: 500, lineHeight: "20px" } as const;
// Tooltip body padding for the sankey tooltip panel.
const SANKEY_TOOLTIP_BODY_STYLE = { padding: "10px 12px" } as const;
// Tooltip title text for the sankey tooltip panel.
const SANKEY_TOOLTIP_TITLE_STYLE = { fontSize: 12, fontWeight: 500, lineHeight: "16px", marginBottom: 8, textAlign: "left" } as const;

const defaultNodeColor = (index: number): string => DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? DEFAULT_COLORS[FIRST_PALETTE_INDEX]

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

const extractChildByDisplayName = <Props,>(children: ReactNode, name: string): ReactElement<Props> | undefined => {
  const childList: readonly ReactNode[] = Array.isArray(children) ? children : [children];
  const matches = childList.filter(
    (child): child is ReactElement<Props> =>
      isValidElement(child) && hasDisplayName(child.type, name),
  );
  return matches.at(LAST_CONFIG_MATCH_INDEX);
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

const sankeyLinkValue = (value: number | undefined): number => value ?? FALLBACK_LINK_VALUE;

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

const readLinkIndexValue = (datum: SankeyTooltipDatum, key: "sourceIndex" | "targetIndex"): number | undefined => {
  if (key === "sourceIndex") {
    const raw: unknown = "sourceIndex" in datum ? datum.sourceIndex : undefined;
    return isNumber(raw) ? raw : undefined;
  }
  const raw: unknown = "targetIndex" in datum ? datum.targetIndex : undefined;
  return isNumber(raw) ? raw : undefined;
};

const linkIndexOf = (datum: SankeyTooltipDatum, key: "sourceIndex" | "targetIndex"): number =>
  readLinkIndexValue(datum, key) ?? FALLBACK_LINK_ENDPOINT_INDEX;

const sankeyLinkTitle = (datum: SankeyTooltipDatum): string => {
  const sourceNode = "sourceNode" in datum ? linkEndOf(datum.sourceNode) : undefined;
  const targetNode = "targetNode" in datum ? linkEndOf(datum.targetNode) : undefined;
  const sourceName = sankeyLinkEndName(sourceNode, linkIndexOf(datum, "sourceIndex"));
  const targetName = sankeyLinkEndName(targetNode, linkIndexOf(datum, "targetIndex"));
  return `${sourceName} → ${targetName}`;
};

const renderSankeyTooltipRow = (isNode: boolean, formatValue: (value: number) => string, datum: SankeyTooltipDatum): ReactElement => (
  <div style={SANKEY_TOOLTIP_ROW_STYLE}>
    <div style={SANKEY_TOOLTIP_ROW_INNER_STYLE}>
      <span style={isNode ? SANKEY_TOOLTIP_DOT_NODE_STYLE : SANKEY_TOOLTIP_DOT_FLOW_STYLE} />
      <span style={SANKEY_TOOLTIP_LABEL_STYLE}>
        {isNode ? "Sessions" : "Flow"}
      </span>
    </div>
    <span style={SANKEY_TOOLTIP_VALUE_STYLE}>
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
    <div style={SANKEY_TOOLTIP_BODY_STYLE}>
      <div style={SANKEY_TOOLTIP_TITLE_STYLE}>
        {title}
      </div>
      {renderSankeyTooltipRow(isNode, formatValue, datum)}
    </div>
    </div>
  );
}

const createHoverHandlers = (hoveredNodeIndexRef: RefObject<number | null>, hoveredLinkIndexRef: RefObject<number | null>, focusPointerPoint: (predicate?: (point: ChartPoint) => boolean) => void): SankeyHoverHandlers => ({
    onLinkEnter: (linkIndex: number): void => {
      hoveredLinkIndexRef.current = linkIndex;
      hoveredNodeIndexRef.current = null;
      focusPointerPoint((point) => point.markId === SANKEY_LINK_MARK_ID && point.datumIndex === linkIndex);
    },
    onLinkLeave: (): void => {
      hoveredLinkIndexRef.current = null;
      focusPointerPoint();
    },
    onNodeEnter: (nodeIndex: number): void => {
      hoveredNodeIndexRef.current = nodeIndex;
      hoveredLinkIndexRef.current = null;
      focusPointerPoint((point) => point.markId === SANKEY_NODE_POINT_MARK_ID && point.datumIndex === nodeIndex);
    },
    onNodeLeave: (): void => {
      hoveredNodeIndexRef.current = null;
      focusPointerPoint();
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
  if (prefersReducedMotion || animationDuration <= MIN_ANIMATION_DURATION) {
    resetSankeyReveal({ duration: animationDuration, revealHandleRef, seenRef, signature: revealSignature });
    return;
  }
  if (svg.getBoundingClientRect().width < MIN_SANKEY_RENDER_WIDTH_PX) { return; }
  startSankeyReveal({ animationDuration, duration: animationDuration, enterTransition, revealHandleRef, seenRef, signature: revealSignature, svg });
}

interface SankeyHoverHitParams {
  readonly clientX: number;
  readonly clientY: number;
  readonly laidOutLinks: readonly LaidOutLink[];
  readonly laidOutNodes: readonly LaidOutNode[];
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
  focusPointerPoint: (predicate?: (point: ChartPoint) => boolean) => void,
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
  if (cleared) {focusPointerPoint();}
}

// The reveal's replay key: a new reveal runs when any of these change.
interface RevealKey {
  readonly signature: string;
  readonly duration: number;
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
  useEffect(() => {
    hoveredLinkIndexLiveRef.current = hoveredLinkIndex;
  }, [hoveredLinkIndex]);
  const hoveredLinkIndexRef = useMemo(
    (): SankeyHoverRefs => ({
      get current(): number | null {
        return hoveredLinkIndexLiveRef.current;
      },
      set current(next: number | null) {
        setHoveredLinkIndex(next);
      },
    }),
    [],
  );
  // Inject source:'pointer' — programmatic would wrongly satisfy the legend-dim predicate.
  const sceneRef = useRef<ChartScene<SankeyRenderDatum> | null>(null);
  const interactionRef = useRef<ChartInteractionController<SankeyRenderDatum> | null>(null);
  const focusPointerPoint = useCallback(
    (predicate?: (point: ChartPoint) => boolean) => {
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
  const controlledNodeIndexRef = useRef<number | null>(hoveredNodeIndexProp ?? null);
  const [internalHoveredNodeIndex, setInternalHoveredNodeIndex] = useState<number | null>(null);
  const internalHoveredNodeIndexRef = useRef<number | null>(null);
  const onNodeHoverChangeRef = useRef(onNodeHoverChange);
  useEffect(() => {
    isNodeHoverControlledRef.current = hoveredNodeIndexProp !== undefined;
    controlledNodeIndexRef.current = hoveredNodeIndexProp ?? null;
  }, [hoveredNodeIndexProp]);
  useEffect(() => {
    internalHoveredNodeIndexRef.current = internalHoveredNodeIndex;
  }, [internalHoveredNodeIndex]);
  useEffect(() => {
    onNodeHoverChangeRef.current = onNodeHoverChange;
  }, [onNodeHoverChange]);
  const hoveredNodeIndexRef = useMemo(
    (): SankeyHoverRefs => ({
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
    }),
    [],
  );
  const isNodeHoverControlled = hoveredNodeIndexProp !== undefined;
  const effectiveHoveredNodeIndex = isNodeHoverControlled
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
    [data, gradientDataRef, laidOutLinksRef, laidOutNodesRef, markConfig, margin],
  );

  const handleRender = useCallback((context: ChartRendererRenderContext<SankeyRenderDatum>) => {
    // Context datum matches the renderer prop below so RendererChart infers one datum type.
    sceneRef.current = context.scene;
    interactionRef.current = context.interaction;

    const surfaceEl = context.surface.element;
    if (!(surfaceEl instanceof SVGSVGElement)) {return;}

    const gradients = gradientDataRef.current;
    if (gradients && gradients.length > EMPTY_GRADIENT_COUNT) {
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
  }, [animationDuration, enterTransition, gradientDataRef, prefersReducedMotion, revealSignature]);

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
  }, [focusPointerPoint, hoveredLinkIndexRef, hoveredNodeIndexRef]);

  // When the parent seizes node-hover control, link hover is cleared here.
  // Render-time previous-prop comparison commits no stale highlight frame.
  const [prevHoveredNodeIndexProp, setPrevHoveredNodeIndexProp] = useState(hoveredNodeIndexProp);
  if (prevHoveredNodeIndexProp !== hoveredNodeIndexProp) {
    setPrevHoveredNodeIndexProp(hoveredNodeIndexProp);
    if (hoveredNodeIndexProp !== undefined) {
      setHoveredLinkIndex(null);
    }
  }

  const handleMouseLeave = useCallback(() => {
    if (isNodeHoverControlledRef.current) {
      onNodeHoverChangeRef.current?.(null);
    } else {
      setInternalHoveredNodeIndex(null);
    }
    setHoveredLinkIndex(null);
    focusPointerPoint();
  }, [focusPointerPoint]);

  const formatValue = tooltipConfig.formatValue ?? intFmt;
  const tooltipClassName = tooltipConfig.className;

  // Container layout for the sankey chart surface.
  const containerStyle = useMemo<CSSProperties>(
    () => ({ aspectRatio, position: "relative", userSelect: "none", width: "100%" }),
    [aspectRatio],
  );

  const renderTooltipBody = useCallback(
    (bodyCtx: Readonly<{ readonly points: readonly ChartPoint[] }>): ReactNode =>
      renderSankeyTooltipBody(bodyCtx.points[FIRST_TOOLTIP_POINT_INDEX], formatValue, tooltipClassName),
    [formatValue, tooltipClassName],
  );

  const parsedAspectRatio = useMemo(() => {
    const parts = aspectRatio.split("/").map((part) => Number(part.trim()));
    const numerator = parts.at(ASPECT_NUMERATOR_INDEX);
    const denominator = parts.at(ASPECT_DENOMINATOR_INDEX);
    if (parts.length !== ASPECT_PART_COUNT || numerator === undefined || denominator === undefined) {
      return DEFAULT_SANKEY_ASPECT_RATIO;
    }
    if (!numerator || !denominator || Number.isNaN(numerator) || Number.isNaN(denominator)) {
      return DEFAULT_SANKEY_ASPECT_RATIO;
    }
    return numerator / denominator;
  }, [aspectRatio]);

  return (
    <div
      className={className}
      data-bkm-chart="sankey"
      ref={containerRef}
      style={containerStyle}
      onMouseLeave={handleMouseLeave}
    >
      <RendererChart
        renderer={chartMotionRenderer<LaidOutNode | NativeSankeyLink<SankeyNodeDatum, SankeyLinkDatum, number>>()}
        ariaLabel="Sankey chart"
        aspectRatio={parsedAspectRatio}
        definition={definition}
        onRender={handleRender}
        renderTooltipBody={renderTooltipBody}
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
