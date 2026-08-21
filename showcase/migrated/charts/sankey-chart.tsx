// Migrated SankeyChart — TanStack Charts + d3-sankey + WAAPI animations.
//
// Architecture:
//   - Single createMark (sankey-mark.ts) for links + nodes, matching
//     tanstack-sankey.tsx ceiling scenario architecture
//   - Layout computed inside the mark from TanStack's live `chart` bounds
//     (render({ chart })) — no component-side measurement or layoutRef
//     side-channel
//   - Gradient, label, and CSS injection → dedicated injection functions
//     called from onRender, each handling exactly one concern
//   - WAAPI reveal → runSankeyReveal owns the whole lifecycle (pre-paint
//     hide via the shared --revealing class, post-paint WAAPI, deadline,
//     teardown) behind a single RevealHandle; the component holds one
//     seen-key gate (data/signature/duration) and nothing else
//   - Hover listener attachment → separate useEffect (element-level
//     mouseenter/mouseleave, uses element ref arrays — no data-ts-key queries)
//   - CSS transitions (0.18s ease-out) for smooth hover dimming
//   - Cursor-following tooltip in real light-DOM (position:fixed div)
//
// Public API matches bklit's SankeyChart exactly.

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import {
  getSankeyDisplayValue,
  type LaidOutNode,
  type LaidOutLink,
} from "./internal/sankey-layout";
import { createSankeyMark, type SankeyGradientDatum } from "./internal/sankey-mark";
import {
  injectGradientDefs,
  injectLabelCssTransitions,
  runSankeyReveal,
  stampSankeyLinkPathLength,
  type SankeyEnterTransition,
  type SankeyRevealHandle,
} from "./internal/sankey-animation";
import "./styles.css";
import {
  computeNodeHoverConnected,
  computeLinkHoverConnected,
  applySankeyHoverStyle,
  attachSankeyHoverListeners,
} from "./internal/sankey-hover-chrome";
import { intFmt } from "./internal/formatters";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";

// ─── Public types (match bklit's API exactly) ──────────────────────────────

export interface SankeyNodeDatum {
  name: string;
  category?: "source" | "landing" | "outcome";
  [key: string]: unknown;
}

export interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
  [key: string]: unknown;
}

export interface SankeyData {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SankeyChartProps {
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
}

export interface SankeyLinkProps {
  stroke?: string;
  strokeOpacity?: number;
  fadedOpacity?: number;
  useGradient?: boolean;
}

export type SankeyLabelOrientation = "horizontal" | "vertical";

export interface SankeyNodeProps {
  fill?: string;
  lineCap?: number;
  fadedOpacity?: number;
  showLabels?: boolean;
  showValueLabels?: boolean;
  labelOrientation?: SankeyLabelOrientation;
  getNodeColor?: (node: LaidOutNode, index: number) => string;
}

export interface SankeyTooltipProps {
  formatValue?: (value: number) => string;
  className?: string;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_MARGIN: Margin = { top: 40, right: 180, bottom: 40, left: 180 };
const DEFAULT_ANIMATION_DURATION = 1100;
const DEFAULT_NODE_WIDTH = 16;
const DEFAULT_NODE_PADDING = 24;

const DEFAULT_COLORS = [
  "var(--chart-1, #7c3aed)",
  "var(--chart-2, #0ea5e9)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #10b981)",
  "var(--chart-5, #ec4899)",
];

function defaultNodeColor(index: number): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? DEFAULT_COLORS[0]!;
}

// ─── Config extraction from children ───────────────────────────────────────

function extractChildByDisplayName(children: ReactNode, name: string): ReactElement | null {
  let found: ReactElement | null = null;
  Children.forEach(children, (child) => {
    if (isValidElement(child) && (child.type as { displayName?: string }).displayName === name) {
      found = child as ReactElement;
    }
  });
  return found;
}

function extractSankeyLinkConfig(children: ReactNode): SankeyLinkProps {
  const child = extractChildByDisplayName(children, "SankeyLink");
  return (child?.props as SankeyLinkProps) ?? {};
}

function extractSankeyNodeConfig(children: ReactNode): SankeyNodeProps {
  const child = extractChildByDisplayName(children, "SankeyNode");
  return (child?.props as SankeyNodeProps) ?? {};
}

function extractSankeyTooltipConfig(children: ReactNode): SankeyTooltipProps {
  const child = extractChildByDisplayName(children, "SankeyTooltip");
  return (child?.props as SankeyTooltipProps) ?? {};
}

// ─── Tooltip (light DOM, cursor-following) ─────────────────────────────────

interface TooltipContentProps {
  mousePos: { x: number; y: number } | null;
  tooltipData: {
    type: "node" | "link";
    nodeIndex?: number;
    linkIndex?: number;
    nodeName?: string;
    sourceName?: string;
    targetName?: string;
    value: number;
  } | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  formatValue: (v: number) => string;
  className: string;
}

function SankeyChartTooltip({
  mousePos,
  tooltipData,
  containerRef,
  formatValue,
  className,
}: TooltipContentProps) {
  if (!tooltipData || !mousePos) return null;

  const EST_TOOLTIP_H = 64;
  const OFFSET = 16;

  const containerRect = containerRef.current?.getBoundingClientRect();
  const vpHeight = containerRect ? containerRect.height : window.innerHeight;
  const clampedTop = Math.max(OFFSET, Math.min(mousePos.y - EST_TOOLTIP_H / 2, vpHeight - EST_TOOLTIP_H - OFFSET));

  const isNode = tooltipData.type === "node";
  const title = isNode
    ? (tooltipData.nodeName ?? `Node ${tooltipData.nodeIndex}`)
    : `${tooltipData.sourceName ?? "Source"} → ${tooltipData.targetName ?? "Target"}`;
  const label = isNode ? "Sessions" : "Flow";
  const dotColor = "var(--chart-1, #7c3aed)";

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        left: mousePos.x + OFFSET,
        top: clampedTop,
        zIndex: 50,
        pointerEvents: "none",
        minWidth: 140,
        overflow: "hidden",
        borderRadius: 8,
        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        background: "var(--chart-tooltip-background, white)",
        backdropFilter: "blur(12px)",
        color: "var(--chart-tooltip-foreground, currentColor)",
      }}
    >
      <div style={{ padding: "10px 12px" }}>
        <div style={{ marginBottom: 8, textAlign: "left", fontWeight: 500, fontSize: 12, lineHeight: "16px" }}>
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", backgroundColor: dotColor, flexShrink: 0 }} />
            <span style={{ color: "var(--chart-tooltip-muted, var(--muted-foreground))", fontSize: 14, lineHeight: "20px" }}>
              {label}
            </span>
          </div>
          <span style={{ fontWeight: 500, fontSize: 14, lineHeight: "20px", fontVariantNumeric: "tabular-nums" }}>
            {formatValue(tooltipData.value)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Hover event handlers factory ──────────────────────────────────────────

function createHoverHandlers(
  data: SankeyData,
  hoveredNodeIndexRef: { current: number | null },
  hoveredLinkIndexRef: { current: number | null },
  setTooltipData: (v: TooltipContentProps["tooltipData"]) => void,
  applyHoverStyles: () => void,
) {
  return {
    onNodeEnter: (i: number) => {
      hoveredNodeIndexRef.current = i;
      hoveredLinkIndexRef.current = null;
      const node = data.nodes[i];
      const displayVal = getSankeyDisplayValue(node as unknown as LaidOutNode, i, data.links as unknown as LaidOutLink[]);
      setTooltipData({
        type: "node",
        nodeIndex: i,
        nodeName: node?.name,
        value: displayVal,
      });
      applyHoverStyles();
    },
    onNodeLeave: () => {
      hoveredNodeIndexRef.current = null;
      setTooltipData(null);
      applyHoverStyles();
    },
    onLinkEnter: (i: number) => {
      hoveredLinkIndexRef.current = i;
      hoveredNodeIndexRef.current = null;
      const link = data.links[i];
      const sourceName = data.nodes[link?.source ?? -1]?.name ?? `Node ${link?.source ?? 0}`;
      const targetName = data.nodes[link?.target ?? -1]?.name ?? `Node ${link?.target ?? 0}`;
      setTooltipData({
        type: "link",
        linkIndex: i,
        sourceName,
        targetName,
        value: link?.value ?? 0,
      });
      applyHoverStyles();
    },
    onLinkLeave: () => {
      hoveredLinkIndexRef.current = null;
      setTooltipData(null);
      applyHoverStyles();
    },
  };
}

// ─── Element population helpers ────────────────────────────────────────────

function populateNodeElements(svg: SVGSVGElement, ref: { current: (SVGGElement | null)[] }): void {
  const nodeSelector = `[data-ts-key^="sankey:node:"]`;
  ref.current = Array.from(svg.querySelectorAll<SVGGElement>(nodeSelector));
}

function populateLinkElements(svg: SVGSVGElement, ref: { current: (SVGPathElement | null)[] }): void {
  const linkSelector = `[data-ts-key^="sankey:link:"]`;
  ref.current = Array.from(svg.querySelectorAll<SVGPathElement>(linkSelector));
}

// ─── Main component ────────────────────────────────────────────────────────

// The reveal's replay key: a new reveal runs when any of these change.
interface RevealKey {
  data: SankeyData;
  signature: string;
  duration: number;
}

export function SankeyChart({
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
}: SankeyChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gradientDataRef = useRef<SankeyGradientDatum[] | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // ── Reveal state: one seen-key gate + one handle ──
  // handleRender runs the reveal once per replay key (data identity,
  // revealSignature, animationDuration — same triggers as before, matching
  // bklit's revealEpoch semantics). Unmount cleanup resets the key so a
  // StrictMode/adapter re-mount replays instead of staying un-revealed.
  const seenRevealKeyRef = useRef<RevealKey | null>(null);
  const revealHandleRef = useRef<SankeyRevealHandle | null>(null);

  const nodeElementsRef = useRef<(SVGGElement | null)[]>([]);
  const linkElementsRef = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    return () => {
      revealHandleRef.current?.cancel();
      revealHandleRef.current = null;
      seenRevealKeyRef.current = null;
    };
  }, []);

  const linkConfig = useMemo(() => ({ useGradient: true, ...extractSankeyLinkConfig(children) }), [children]);
  const nodeConfig = useMemo(() => extractSankeyNodeConfig(children), [children]);
  const tooltipConfig = useMemo(() => extractSankeyTooltipConfig(children), [children]);

  const getNodeColorFn = useCallback(
    (node: LaidOutNode, index: number) => {
      if (nodeConfig.fill) return nodeConfig.fill;
      if (nodeConfig.getNodeColor) return nodeConfig.getNodeColor(node, index);
      return defaultNodeColor(index);
    },
    [nodeConfig],
  );

  // ── Hover state (refs for zero-React-pointer-path; DOM writes on hover) ──
  const hoveredNodeIndexRef = useRef<number | null>(null);
  const hoveredLinkIndexRef = useRef<number | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipContentProps["tooltipData"]>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);

  const markConfig = useMemo(() => ({
    strokeOpacity: linkConfig.strokeOpacity ?? 0.5,
    strokeOverride: linkConfig.stroke,
    useGradient: linkConfig.useGradient ?? true,
    nodeColorFn: getNodeColorFn,
    lineCap: nodeConfig.lineCap ?? 4,
    nodeWidth,
    nodePadding,
    showLabels: nodeConfig.showLabels ?? true,
    showValueLabels: nodeConfig.showValueLabels ?? true,
    labelOrientation: nodeConfig.labelOrientation ?? "vertical",
  }), [linkConfig, getNodeColorFn, nodeConfig.lineCap, nodeWidth, nodePadding, nodeConfig.showLabels, nodeConfig.showValueLabels, nodeConfig.labelOrientation]);

  // ── Hover style applicator (reads from refs, writes DOM directly) ──
  const applyHoverStyles = useCallback(() => {
    const svg = containerRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const nodeEls = nodeElementsRef.current;
    const linkEls = linkElementsRef.current;
    const nodeCount = data.nodes.length;
    const linkCount = data.links.length;

    const linkIndices = data.links.map((l) => ({ source: l.source, target: l.target }));

    const { nodeConnected, linkConnected, anyHovered } =
      hoveredNodeIndexRef.current !== null
        ? computeNodeHoverConnected(hoveredNodeIndexRef.current, nodeCount, linkIndices)
        : computeLinkHoverConnected(hoveredLinkIndexRef.current, nodeCount, linkIndices);

    applySankeyHoverStyle(
      svg,
      nodeEls,
      linkEls,
      nodeCount,
      linkCount,
      { nodeConnected, linkConnected, anyHovered },
      nodeConfig.fadedOpacity ?? 0.4,
      linkConfig.fadedOpacity ?? 0.1,
      linkConfig.strokeOpacity ?? 0.5,
    );
  }, [data, nodeConfig.fadedOpacity, linkConfig.fadedOpacity, linkConfig.strokeOpacity]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [createSankeyMark(data, markConfig, gradientDataRef)],
        guides: false,
        x: null,
        y: null,
        margin,
      }),
    [data, markConfig, margin],
  );

  // ── onRender: gradients, CSS, WAAPI reveal (labels now live as SceneLabel in the mark) ──
  // Hover listener attachment is NOT here — it's in a separate useEffect below.
  const handleRender = useCallback((ctx?: { svg?: SVGSVGElement; container?: HTMLElement }) => {
    const svg = ctx?.svg ?? (containerRef.current?.querySelector("svg") as SVGSVGElement | null);
    if (!svg) return;

    // Phase 1: populate element refs (always, so hover refs stay fresh on resize)
    populateNodeElements(svg, nodeElementsRef);
    populateLinkElements(svg, linkElementsRef);

    // Phase 2: inject gradients + CSS (labels are now SceneLabel nodes in the mark itself)
    const gradients = gradientDataRef.current;
    if (gradients && gradients.length > 0) {
      injectGradientDefs(svg, gradients);
    }
    injectLabelCssTransitions(svg);
    stampSankeyLinkPathLength(linkElementsRef.current);

    // Phase 3: reveal — once per replay key (data/signature/duration change).
    const seen = seenRevealKeyRef.current;
    if (
      seen !== null &&
      seen.data === data &&
      seen.signature === revealSignature &&
      seen.duration === animationDuration
    ) {
      return;
    }

    // Reduced motion / zero duration: the scene's resting state is already
    // fully visible (reveal keyframes all end at resting values), so just
    // make sure no reveal is running and consume the key.
    if (prefersReducedMotion || animationDuration <= 0) {
      revealHandleRef.current?.cancel();
      revealHandleRef.current = null;
      seenRevealKeyRef.current = { data, signature: revealSignature, duration: animationDuration };
      return;
    }

    // Not laid out yet (bklit renders null under width 10): leave the key
    // unconsumed so the resize-triggered onRender retries.
    if (svg.getBoundingClientRect().width < 10) return;

    seenRevealKeyRef.current = { data, signature: revealSignature, duration: animationDuration };
    revealHandleRef.current?.cancel();
    revealHandleRef.current = runSankeyReveal({
      svg,
      nodeGroups: nodeElementsRef.current,
      linkPaths: linkElementsRef.current,
      animationDuration,
      enterTransition,
    });
  }, [data, revealSignature, animationDuration, enterTransition, prefersReducedMotion]);

  // ── Hover listener attachment (bar-chart pattern: separate effect) ──
  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const handlers = createHoverHandlers(
      data,
      hoveredNodeIndexRef,
      hoveredLinkIndexRef,
      setTooltipData,
      applyHoverStyles,
    );

    const cleanup = attachSankeyHoverListeners(nodeElementsRef.current, linkElementsRef.current, handlers);
    return cleanup;
  }, [data, applyHoverStyles]);

  // ── Mouse move / leave ── (scoped to container + gated on active hover)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handlePointerMove = (e: PointerEvent) => {
      if (hoveredNodeIndexRef.current === null && hoveredLinkIndexRef.current === null) return;
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener("pointermove", handlePointerMove);
    return () => el.removeEventListener("pointermove", handlePointerMove);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredNodeIndexRef.current = null;
    hoveredLinkIndexRef.current = null;
    setTooltipData(null);
    setMousePos(null);
    applyHoverStyles();
  }, [applyHoverStyles]);

  const formatValue = tooltipConfig.formatValue ?? intFmt;

  const parsedAspectRatio = useMemo(() => {
    const parts = aspectRatio.split("/").map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && parts[0] && parts[1] && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] / parts[1];
    }
    return 2;
  }, [aspectRatio]);

  return (
    <div
      className={className}
      data-bkm-chart="sankey"
      ref={containerRef}
      style={{ position: "relative", width: "100%", aspectRatio, userSelect: "none" }}
      onMouseLeave={handleMouseLeave}
    >
      <Chart
        ariaLabel="Sankey chart"
        aspectRatio={parsedAspectRatio}
        definition={definition}
        onRender={handleRender}
      />
      <SankeyChartTooltip
        className={tooltipConfig.className ?? ""}
        containerRef={containerRef}
        formatValue={formatValue}
        mousePos={mousePos}
        tooltipData={tooltipData}
      />
    </div>
  );
}

SankeyChart.displayName = "SankeyChart";

// ─── Config-carrier children (return null, like bklit's composition model) ──

export function SankeyLink(_props: SankeyLinkProps): null {
  return null;
}
SankeyLink.displayName = "SankeyLink";

export function SankeyNode(_props: SankeyNodeProps): null {
  return null;
}
SankeyNode.displayName = "SankeyNode";

export function SankeyTooltip(_props: SankeyTooltipProps): null {
  return null;
}
SankeyTooltip.displayName = "SankeyTooltip";

export default SankeyChart;
