// Bklit SankeyChart on TanStack Charts (native sankeyDiagram + WAAPI reveal, package-state hover dim).
import { isValidElement, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
import { ChartHost, HOST_INITIAL_WIDTH } from "./internal/chart-host";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import type {
  ChartLinearGradient,
  ChartPoint,
  ChartRendererRenderContext,
} from "@tanstack/charts";
import type { SankeyLink as NativeSankeyLink } from "@tanstack/charts/network/sankey";
import type {
  LaidOutNode,
} from "./internal/sankey-layout";
import { createSankeyMark, createSankeySpatialIndex, sankeyIdentityColorScale, SANKEY_NODE_POINT_MARK_ID } from './internal/sankey-mark';
import type { LaidOutLink } from './internal/sankey-mark';
import { sankeyFlowGradientId } from "./internal/sankey-flow-style";
import { runSankeyReveal, stampSankeyLinkPathLength } from './internal/sankey-animation';
import type { SankeyEnterTransition, SankeyRevealHandle } from './internal/sankey-animation';
import "./styles.css";
import { intFmt } from "./internal/formatters";
import { CHART_CATEGORY_PALETTE_WITH_FALLBACK } from "./internal/design-tokens";
import type { SankeyLinkProps } from "./internal/sankey-link";
import type { SankeyNodeProps } from "./internal/sankey-node";
import type { SankeyTooltipProps } from "./internal/sankey-tooltip";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useFocusInjection } from "./internal/focus-injection";
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
  readonly nodes: SankeyNodeDatum[];
  readonly links: SankeyLinkDatum[];
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
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
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
  if ("name" in datum) {
    const name: unknown = datum.name;
    if (isString(name)) {return name;}
  }
  // Package node rows carry the raw row under `data` (no top-level name).
  const raw: unknown = datum;
  if (isObjectValue(raw) && "data" in raw) {
    const nested: unknown = raw.data;
    if (isObjectValue(nested) && "name" in nested) {
      const name: unknown = nested.name;
      if (isString(name)) {return name;}
    }
  }
  return undefined;
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
  ariaLabel = "Sankey chart",
  ariaDescription,
}: SankeyChartProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
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
      if (nodeConfig.getNodeColor) {return nodeConfig.getNodeColor({ ...node, name: sankeyNodeName(node, index) }, index);}
      return defaultNodeColor(index);
    },
    [nodeConfig],
  );

  // Box fractions reproduce the legacy userSpaceOnUse gradient.
  // Centreline spans the two node edges.
  const sankeyFlowGradients = useMemo<readonly ChartLinearGradient[]>(() => {
    if (!(linkConfig.useGradient ?? true)) {return [];}
    if (linkConfig.stroke !== undefined && linkConfig.stroke !== "") {return [];}
    return data.links.map((linkDatum, index) => {
      const sourceNode: LaidOutNode = { ...data.nodes[linkDatum.source], index: linkDatum.source };
      const targetNode: LaidOutNode = { ...data.nodes[linkDatum.target], index: linkDatum.target };
      return {
        id: sankeyFlowGradientId(index),
        stops: [
          { color: getNodeColorFn(sourceNode, linkDatum.source), offset: 0 },
          { color: getNodeColorFn(targetNode, linkDatum.target), offset: 1 },
        ],
        x1: 0,
        x2: 1,
        y1: 0,
        y2: 0,
      };
    });
  }, [data, getNodeColorFn, linkConfig.stroke, linkConfig.useGradient]);

  // Package-owned hover: dim rides mark states, so hover never rebuilds the definition.
  // Focus changes only notify the hover callback; the tooltip reads package points.
  const { captureRenderContext, clearFocus, focusPoint } = useFocusInjection<SankeyRenderDatum>();
  const onNodeHoverChangeRef = useRef(onNodeHoverChange);
  useEffect(() => {
    onNodeHoverChangeRef.current = onNodeHoverChange;
  }, [onNodeHoverChange]);

  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);

  const markConfig = useMemo(() => ({
    fadedLinkOpacity: linkConfig.fadedOpacity ?? DEFAULT_FADED_LINK_OPACITY,
    fadedNodeOpacity: nodeConfig.fadedOpacity ?? DEFAULT_FADED_NODE_OPACITY,
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
  ]);

  const definition = useMemo(
    () =>
      defineChart({
        // The rect color channel holds the final paint.
        // Backed by the identity scale below.
        color: { scale: sankeyIdentityColorScale },
        focusRing: false,
        gradients: sankeyFlowGradients,
        guides: false,
        margin,
        marks: [createSankeyMark({ config: markConfig, data, laidOutLinksRef, laidOutNodesRef })],
        scales: { x: null, y: null },
        // Package hover order: nodes first, links in reverse paint order.
        spatialIndex: (points) => createSankeySpatialIndex(points, laidOutNodesRef.current ?? [], laidOutLinksRef.current ?? []),
        // Palette override has no pixel effect (colors resolve JS-side); keeps native surfaces agreeing.
        theme: { palette: CHART_CATEGORY_PALETTE_WITH_FALLBACK },
        tooltip: {
          // Legacy anchors the sankey tooltip at the mouse position and places it immediately
          // (TooltipBox: left = x + 16, top = y - h / 2, no enter fade), so no tooltip motion.
          anchor: "pointer",
          className: "bkm-native-tooltip",
          motion: false,
          offset: 16,
          placement: ["right", "left"],
          sticky: false,
          use: tooltip,
        },
      }),
    [data, laidOutLinksRef, laidOutNodesRef, markConfig, margin, sankeyFlowGradients],
  );

  const handleRender = useCallback((context: ChartRendererRenderContext<SankeyRenderDatum>) => {
    // Context datum matches the renderer prop below so RendererChart infers one datum type.
    captureRenderContext(context);

    const surfaceEl = context.surface.element;
    if (!(surfaceEl instanceof SVGSVGElement)) {return;}

    stampSankeyLinkPathLength(surfaceEl);

    updateSankeyReveal(surfaceEl, {
      animationDuration,
      enterTransition,
      prefersReducedMotion,
      revealHandleRef,
      revealSignature,
      seenRef: seenRevealKeyRef,
    });
  }, [animationDuration, captureRenderContext, enterTransition, prefersReducedMotion, revealSignature]);

  // Package-owned pointer: focus changes only notify; dim rides the mark states.
  const handleFocusChange = useCallback((point: ChartPoint | null) => {
    const next = point?.markId === SANKEY_NODE_POINT_MARK_ID ? point.datumIndex : null;
    onNodeHoverChangeRef.current?.(next);
  }, []);

  // Parent-controlled node hover paints through package focus, not the DOM.
  useEffect(() => {
    if (hoveredNodeIndexProp === undefined) {return;}
    if (hoveredNodeIndexProp === null) {
      clearFocus();
      return;
    }
    const target = hoveredNodeIndexProp;
    focusPoint((scenePoint) => scenePoint.markId === SANKEY_NODE_POINT_MARK_ID && scenePoint.datumIndex === target);
  }, [clearFocus, focusPoint, hoveredNodeIndexProp]);

  const handleMouseLeave = useCallback(() => {
    onNodeHoverChangeRef.current?.(null);
    clearFocus("pointer");
  }, [clearFocus]);

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
      <ChartHost
        renderer={chartMotionRenderer<LaidOutNode | NativeSankeyLink<SankeyNodeDatum, SankeyLinkDatum, number>>()}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        aspectRatio={parsedAspectRatio}
        className={className}
        initialWidth={HOST_INITIAL_WIDTH}
        definition={definition}
        onFocusChange={handleFocusChange}
        onRender={handleRender}
        renderTooltipBody={renderTooltipBody}
        style={containerStyle}
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
