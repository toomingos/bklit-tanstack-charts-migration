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
//   - Hover dim (C1 states+legend) → reactive, not DOM mutation: hover
//     indices live in React state (hoveredLinkIndex / internalHoveredNodeIndex
//     / the controlled hoveredNodeIndex prop), which feed markConfig → the
//     `definition` useMemo rebuilds createSankeyMark(), whose render pass
//     bakes connectivity-based dim/boost straight into node/label resting
//     styles and the native link() mark's per-datum `strokeOpacity` channel
//     (internal/sankey-mark.ts). internal/sankey-hover-chrome.ts supplies the
//     pure connectivity math plus the mouseenter/mouseleave → state-setter
//     wiring; it no longer writes to the DOM. Smooth dim/restore rides the
//     flat 0.18s ease-out CSS transition sankey-animation.ts's
//     injectLabelCssTransitions already installs unconditionally.
//   - Tooltip → native `tooltip` extension + `renderTooltipBody` (C2), bridged
//     from app-owned hover detection via `interaction.setControlledFocus`
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
import { Chart } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import type {
  ChartInteractionController,
  ChartPoint,
  ChartRenderContext,
  ChartScene,
} from "@tanstack/charts";
import type { SankeyLink as NativeSankeyLink } from "@tanstack/charts/network/sankey";
import {
  type LaidOutNode,
} from "./internal/sankey-layout";
import {
  createSankeyMark,
  SANKEY_MARK_ID,
  SANKEY_NODE_MARK_ID,
  type SankeyGradientDatum,
} from "./internal/sankey-mark";
import {
  injectGradientDefs,
  injectLabelCssTransitions,
  runSankeyReveal,
  stampSankeyLinkPathLength,
  type SankeyEnterTransition,
  type SankeyRevealHandle,
} from "./internal/sankey-animation";
import "./styles.css";
import { attachSankeyHoverListeners } from "./internal/sankey-hover-chrome";
import { intFmt } from "./internal/formatters";
import { CHART_CATEGORY_PALETTE_WITH_FALLBACK } from "./internal/design-tokens";
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
  /** Controlled hovered node index (e.g. from ChartLegend). */
  hoveredNodeIndex?: number | null;
  /** Called when node hover changes from the chart surface. */
  onNodeHoverChange?: (index: number | null) => void;
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

// T-D15 (P3.1): sourced from the shared 5-entry categorical palette (with
// its literal hex fallbacks preserved exactly) rather than a local literal
// set — see internal/design-tokens.ts.
const DEFAULT_COLORS: readonly string[] = CHART_CATEGORY_PALETTE_WITH_FALLBACK;

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

// ─── Tooltip (native tooltip extension + renderTooltipBody, C2) ────────────
//
// Replaces the old cursor-following `position:fixed` panel (SankeyChartTooltip)
// with the native DOM tooltip extension (`definition.tooltip`), driven by the
// app-owned hover detection below via `interaction.setControlledFocus(point,
// {source:'pointer'})` — see the `focusPointerPoint` bridge in SankeyChart.
// `renderTooltipBody` reproduces the old panel's exact inner markup (title,
// colored dot, label, formatted value); the tooltip host itself now owns
// positioning (`anchor:'point'`, `placement`, `offset` on the tooltip option
// below approximate the old right-offset, vertically-centered placement).
function renderSankeyTooltipBody(
  point: ChartPoint | undefined,
  formatValue: (v: number) => string,
  className?: string,
): ReactNode {
  if (!point) return null;

  const isNode = point.markId === SANKEY_NODE_MARK_ID;
  let title: string;
  let value: number;
  if (isNode) {
    const node = point.datum as LaidOutNode & { name?: string };
    title = node.name ?? `Node ${point.datumIndex}`;
    value = node.value ?? 0;
  } else {
    const linkRow = point.datum as NativeSankeyLink<SankeyNodeDatum, SankeyLinkDatum>;
    const sourceName = linkRow.sourceNode?.data?.name ?? `Node ${linkRow.sourceIndex}`;
    const targetName = linkRow.targetNode?.data?.name ?? `Node ${linkRow.targetIndex}`;
    title = `${sourceName} → ${targetName}`;
    value = linkRow.value ?? 0;
  }
  const label = isNode ? "Sessions" : "Flow";
  // bklit's SankeyTooltip rows: node dots use --chart-line-primary,
  // link dots use --chart-foreground-muted (tooltip-content.tsx colors).
  const dotColor = isNode ? "var(--chart-line-primary)" : "var(--chart-foreground-muted)";

  // Panel chrome: the old fixed-position panel's minWidth/radius/shadow/
  // background/blur inline styles are byte-equivalent to styles.css's
  // `.bkm-tooltip-panel` rule — reuse it (consumer className appended here,
  // same element the old panel applied it to).
  return (
    <div className={className ? `bkm-tooltip-panel ${className}` : "bkm-tooltip-panel"}>
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
          {formatValue(value)}
        </span>
      </div>
    </div>
    </div>
  );
}

// ─── Hover event handlers factory ──────────────────────────────────────────

// C2 (tooltip): tooltip content no longer needs precomputing here (name/value
// lookups moved into renderSankeyTooltipBody, reading straight off the
// focused ChartPoint's `datum`) — this factory now only updates the
// app-owned hover refs (unchanged — still what drives markConfig's
// connectivity dim) and bridges to the native tooltip via
// `focusPointerPoint`, matching each hover source's ChartPoint by markId +
// datumIndex (SANKEY_NODE_MARK_ID for nodes, "flow" — the native link()
// mark's id — for links).
function createHoverHandlers(
  hoveredNodeIndexRef: { current: number | null },
  hoveredLinkIndexRef: { current: number | null },
  focusPointerPoint: (predicate: ((point: ChartPoint) => boolean) | null) => void,
) {
  return {
    onNodeEnter: (i: number) => {
      hoveredNodeIndexRef.current = i;
      hoveredLinkIndexRef.current = null;
      focusPointerPoint((point) => point.markId === SANKEY_NODE_MARK_ID && point.datumIndex === i);
    },
    onNodeLeave: () => {
      hoveredNodeIndexRef.current = null;
      focusPointerPoint(null);
    },
    onLinkEnter: (i: number) => {
      hoveredLinkIndexRef.current = i;
      hoveredNodeIndexRef.current = null;
      focusPointerPoint((point) => point.markId === "flow" && point.datumIndex === i);
    },
    onLinkLeave: () => {
      hoveredLinkIndexRef.current = null;
      focusPointerPoint(null);
    },
  };
}

// ─── Element population helpers ────────────────────────────────────────────

function populateNodeElements(svg: SVGSVGElement, ref: { current: (SVGGElement | null)[] }): void {
  const nodeSelector = `[data-ts-key^="sankey:node:"]`;
  ref.current = Array.from(svg.querySelectorAll<SVGGElement>(nodeSelector));
}

// T-D13: links render through the native link() child mark (id "flow"), whose
// composited layer group has the stable key "sankey:flow". Paths follow in
// data order inside that group.
function populateLinkElements(svg: SVGSVGElement, ref: { current: (SVGPathElement | null)[] }): void {
  const flowGroup = svg.querySelector<SVGGElement>(`[data-ts-key="${SANKEY_MARK_ID}:flow"]`);
  ref.current = flowGroup
    ? Array.from(flowGroup.querySelectorAll<SVGPathElement>("path"))
    : [];
}

// ─── Main component ────────────────────────────────────────────────────────

// The reveal's replay key: a new reveal runs when any of these change.
interface RevealKey {
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
  hoveredNodeIndex: hoveredNodeIndexProp,
  onNodeHoverChange,
}: SankeyChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gradientDataRef = useRef<SankeyGradientDatum[] | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // ── Reveal state: one seen-key gate + one handle ──
  // handleRender runs the reveal once per replay key (revealSignature,
  // animationDuration — same triggers as bklit's revealEpoch, which does NOT
  // include data identity: a new-array data prop with the same signature
  // must not replay the enter animation). Unmount cleanup resets the key so
  // a StrictMode/adapter re-mount replays instead of staying un-revealed.
  const seenRevealKeyRef = useRef<RevealKey | null>(null);
  const revealHandleRef = useRef<SankeyRevealHandle | null>(null);

  const nodeElementsRef = useRef<(SVGGElement | null)[]>([]);
  const linkElementsRef = useRef<(SVGPathElement | null)[]>([]);
  const laidOutNodesRef = useRef<LaidOutNode[] | null>(null);

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

  // ── Hover state (React state — drives the reactive dim mechanism) ──
  // C1 states+legend: hoveredLinkIndex/internalHoveredNodeIndex used to live
  // in plain refs, with a separate imperative `applyHoverStyles()` DOM-write
  // pass invoked on every hover change. Dim is now expressed as per-datum
  // style/channel values computed inside internal/sankey-mark.ts, rebuilt by
  // the `definition` useMemo below whenever hover state changes — so hover
  // must be React state (not a bare ref) to actually trigger that rebuild.
  // A same-value ref mirror is kept alongside each piece of state purely for
  // synchronous imperative reads (the pointermove gate, handleMouseLeave)
  // that don't need to be reactive themselves.
  const [hoveredLinkIndex, setHoveredLinkIndex] = useState<number | null>(null);
  const hoveredLinkIndexLiveRef = useRef<number | null>(null);
  hoveredLinkIndexLiveRef.current = hoveredLinkIndex;
  const hoveredLinkIndexRef = {
    get current(): number | null {
      return hoveredLinkIndexLiveRef.current;
    },
    set current(v: number | null) {
      setHoveredLinkIndex(v);
    },
  };
  // C2 (tooltip): pointer-driven native tooltip bridge. NOT
  // useFocusInjection().focusPoint (hardcodes source:'programmatic', which
  // would incorrectly satisfy C1's whenSeriesDimmed legend-dim predicate) —
  // a local variant that always injects source:'pointer'. scene/interaction
  // are captured from the same onRender context as the reveal logic below;
  // sankey's own SVG hit-testing (createHoverHandlers/
  // attachSankeyHoverListeners) stays the sole hover-detection source, so the
  // chart definition also sets `pointer: false` to keep TanStack's native
  // pointer-driven focus resolution from fighting these calls (its
  // mousemove handler would otherwise call setControlledFocus-equivalent
  // updateFocus([]) on every move — dist/renderer.js:451).
  const sceneRef = useRef<ChartScene | null>(null);
  const interactionRef = useRef<ChartInteractionController | null>(null);
  const focusPointerPoint = useCallback(
    (predicate: ((point: ChartPoint) => boolean) | null) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (!predicate) {
        interaction.setControlledFocus(null, { source: "pointer" });
        return;
      }
      const point = sceneRef.current?.points.find(predicate) ?? null;
      interaction.setControlledFocus(point, { source: "pointer" });
    },
    [],
  );

  // Controlled/uncontrolled node hover, ported from bklit's SankeyChartCore
  // (`isNodeHoverControlled ? hoveredNodeIndexProp : internalHoveredNodeIndex`).
  // In controlled mode the surface never stores the index itself — a write
  // reports via onNodeHoverChange and the caller re-renders with a new
  // hoveredNodeIndex prop, which the `definition` useMemo below reacts to
  // directly. Link hover stays uncontrolled (legacy keeps it in component
  // state). All four inputs flow through render-refreshed refs so the ref
  // adapter stays correct even when captured by long-lived listener
  // closures; the setter now triggers a React state update (via the stable
  // `setInternalHoveredNodeIndex` identity) instead of a bare ref mutation.
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
    set current(v: number | null) {
      if (isNodeHoverControlledRef.current) {
        onNodeHoverChangeRef.current?.(v);
      } else {
        setInternalHoveredNodeIndex(v);
      }
    },
  };
  // The mark's own hover-index inputs: the SAME effective value the getter
  // above resolves, read directly (not through the getter/setter shim) so it
  // can sit in a dependency array.
  const effectiveHoveredNodeIndex = isNodeHoverControlledRef.current
    ? (hoveredNodeIndexProp ?? null)
    : internalHoveredNodeIndex;

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
    // bklit's SankeyNode defaults labelOrientation="horizontal" — keep parity.
    labelOrientation: nodeConfig.labelOrientation ?? "horizontal",
    // Connectivity-based hover dim (C1 states+legend) — see
    // internal/sankey-mark.ts's marks() callback for where this resolves
    // into per-datum style/channel values.
    hoveredNodeIndex: effectiveHoveredNodeIndex,
    hoveredLinkIndex,
    fadedNodeOpacity: nodeConfig.fadedOpacity ?? 0.4,
    fadedLinkOpacity: linkConfig.fadedOpacity ?? 0.1,
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
        marks: [createSankeyMark(data, markConfig, gradientDataRef, laidOutNodesRef)],
        guides: false,
        scales: { x: null, y: null },
        margin,
        // T-D15 (P3.1): explicit 5-entry palette override (with literal hex
        // fallbacks), NOT the native 6-entry defaultChartTheme.palette — see
        // internal/design-tokens.ts. Node/link colors are already resolved
        // JS-side via defaultNodeColor/DEFAULT_COLORS, so this has no pixel
        // effect today.
        theme: { palette: CHART_CATEGORY_PALETTE_WITH_FALLBACK },
        // P3.3/T-D2 CSS-suppression-cleanup: sankey owns its own hover
        // feedback (internal/sankey-hover-chrome.ts), same as every other
        // custom-mark chart in this migration — suppress TanStack's native
        // focus ring natively instead of relying solely on the
        // `[data-ts-chart-focus] {display:none}` CSS rule.
        focusRing: false,
        // C2 (tooltip): TanStack's own pointer-driven focus resolution is
        // off — app-owned SVG hit-testing (sankey-hover-chrome.ts) stays the
        // sole hover-detection source, bridged to the tooltip's focus state
        // via `focusPointerPoint`/`setControlledFocus` below. Without this,
        // every native mousemove would call updateFocus([]) and clear
        // whatever this bridge just set (dist/renderer.js:451).
        pointer: false,
        tooltip: {
          use: tooltip,
          // Host chrome reset by the `.bkm-native-tooltip` rule in styles.css
          // (dist/tooltip.js's createTooltip sets its own position/padding/
          // border/background/font via inline CSS-var-driven defaults); panel
          // chrome + the consumer's className land on the `.bkm-tooltip-panel`
          // wrapper inside `renderSankeyTooltipBody`, matching where the old
          // fixed-position panel applied them.
          className: "bkm-native-tooltip",
          sticky: false,
          // Old panel: cursor-following, offset 16px to the right, vertically
          // centered/clamped on the cursor. The native tooltip anchors to
          // point geometry rather than the raw pointer (app-owned hit-testing
          // means `interaction`'s own pointer state isn't populated) — anchor
          // on the focused node/link point, offset to its right (falling
          // back left near the edge), same 16px offset as the old OFFSET
          // constant.
          anchor: "point",
          placement: ["right", "left"],
          offset: 16,
        },
      }),
    [data, markConfig, margin],
  );

  // ── onRender: gradients, CSS, WAAPI reveal (labels now live as SceneLabel in the mark) ──
  // Hover listener attachment is NOT here — it's in a separate useEffect below.
  const handleRender = useCallback((context: ChartRenderContext<any, any, any>) => {
    // C2 (tooltip): capture scene/interaction first (compose with reveal
    // logic below, same as focus-injection.ts's captureRenderContext) — see
    // focusPointerPoint above. `any` datum/x/y generics: the composite
    // sankeyDiagram() mark's node/link union datum type is internal to
    // sankey-mark.ts (SankeyNodeData/SankeyLinkData aren't exported), and
    // ChartRenderContext is invariant on TDatum (ChartInteractionController's
    // setControlledFocus takes ChartPoint<TDatum> as an input, i.e.
    // contravariant position) — so the bare default-generic annotation
    // doesn't structurally match what <Chart definition={definition}
    // onRender={...}> infers. sceneRef/interactionRef below are still
    // concretely typed (ChartScene/ChartInteractionController), so this
    // doesn't leak `any` past this one parameter.
    sceneRef.current = context.scene;
    interactionRef.current = context.interaction as unknown as ChartInteractionController;

    const svg = context.svg;
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

    // Phase 3: reveal — once per replay key (signature/duration change).
    const seen = seenRevealKeyRef.current;
    if (seen !== null && seen.signature === revealSignature && seen.duration === animationDuration) {
      return;
    }

    // Reduced motion / zero duration: the scene's resting state is already
    // fully visible (reveal keyframes all end at resting values), so just
    // make sure no reveal is running and consume the key.
    if (prefersReducedMotion || animationDuration <= 0) {
      revealHandleRef.current?.cancel();
      revealHandleRef.current = null;
      seenRevealKeyRef.current = { signature: revealSignature, duration: animationDuration };
      return;
    }

    // Not laid out yet (bklit renders null under width 10): leave the key
    // unconsumed so the resize-triggered onRender retries.
    if (svg.getBoundingClientRect().width < 10) return;

    seenRevealKeyRef.current = { signature: revealSignature, duration: animationDuration };
    revealHandleRef.current?.cancel();
    revealHandleRef.current = runSankeyReveal({
      svg,
      nodeGroups: nodeElementsRef.current,
      linkPaths: linkElementsRef.current,
      animationDuration,
      enterTransition,
    });
  }, [revealSignature, animationDuration, enterTransition, prefersReducedMotion]);

  // ── Hover listener attachment (bar-chart pattern: separate effect) ──
  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const handlers = createHoverHandlers(
      hoveredNodeIndexRef,
      hoveredLinkIndexRef,
      focusPointerPoint,
    );

    const cleanup = attachSankeyHoverListeners(nodeElementsRef.current, linkElementsRef.current, handlers);
    return cleanup;
  }, [data, focusPointerPoint]);

  // Controlled-mode sync: a hoveredNodeIndex prop change (e.g. ChartLegend
  // hover) clears any local link-hover state left over from surface
  // interaction. The dim repaint itself no longer needs an explicit trigger
  // here — `effectiveHoveredNodeIndex` (derived straight from
  // `hoveredNodeIndexProp` in controlled mode) already sits in markConfig's
  // dependency array, so the prop change alone reactively rebuilds the mark.
  // C2: no tooltip-state clear needed here anymore — ChartLegend-driven
  // (programmatic-source) focus is a separate concern from this pointer
  // bridge, and this surface's own pointer hover already clears itself via
  // onNodeLeave/onLinkLeave.
  useEffect(() => {
    if (!isNodeHoverControlledRef.current) return;
    setHoveredLinkIndex(null);
  }, [hoveredNodeIndexProp]);

  // C2 (tooltip): mouse-move/position tracking retired along with the old
  // cursor-following panel — the native tooltip positions itself
  // (anchor/placement/offset on the definition above). handleMouseLeave
  // keeps clearing the app-owned hover refs and the bridged focus.
  const handleMouseLeave = useCallback(() => {
    hoveredNodeIndexRef.current = null;
    hoveredLinkIndexRef.current = null;
    focusPointerPoint(null);
  }, [focusPointerPoint]);

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
        renderTooltipBody={(ctx) => renderSankeyTooltipBody(ctx.points[0], formatValue, tooltipConfig.className)}
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
