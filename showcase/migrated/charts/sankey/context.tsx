"use client";

// bklit's `useSankey()` context over the native chart: hover lives in a ref store, only <SankeyContextLayer> subscribes.
// The layout is bklit's own d3-sankey run (sankey-chart.tsx:151-168), as the native mark places columns in scene space.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Dispatch, ReactElement, ReactNode, RefObject, SetStateAction } from "react";
import { sankey, sankeyCenter } from "d3-sankey";
import { bumpPath } from "./bump";
import type { SankeyGraph, SankeyLink, SankeyNode } from "d3-sankey";
import type { Transition } from "../kit/motion/phase";
import { useReadyGate } from "../kit/entrance/reveal-arm";
import { useResizeBox } from "../kit/size/use-resize-box";
import type { Margin, SankeyLinkDatum, SankeyNodeDatum } from "./types";

/** Focused node or link, as exposed by `useSankey()`. */
export interface SankeyTooltipData {
  /** Whether a node or a link is focused. */
  type: "node" | "link";
  /** Index of the focused node (when `type` is "node"). */
  nodeIndex?: number;
  /** Index of the focused link (when `type` is "link"). */
  linkIndex?: number;
  /** Horizontal position of the focused item, relative to the chart. */
  x: number;
  /** Vertical position of the focused item, relative to the chart. */
  y: number;
  /** The focused node or link, as laid out by d3-sankey. */
  data: SankeyNodeDatum | SankeyLinkDatum;
}

/** Value returned by `useSankey()`. */
export interface SankeyContextValue {
  /** The d3-sankey graph for the current size. */
  graph: SankeyGraph<SankeyNodeDatum, SankeyLinkDatum>;
  /** Laid-out nodes. */
  nodes: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>[];
  /** Laid-out links. */
  links: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>[];
  /** Chart width in pixels. */
  width: number;
  /** Chart height in pixels. */
  height: number;
  /** Width inside the margins. */
  innerWidth: number;
  /** Height inside the margins. */
  innerHeight: number;
  /** Resolved chart margins. */
  margin: Margin;
  /** Hovered node index, or `null`. */
  hoveredNodeIndex: number | null;
  /** Hovered link index, or `null`. */
  hoveredLinkIndex: number | null;
  /** Moves the native focus to a node; `null` clears it. */
  setHoveredNodeIndex: (index: number | null) => void;
  /** Moves the native focus to a flow; `null` clears it. */
  setHoveredLinkIndex: (index: number | null) => void;
  /** The focused node or link with its anchor position, or `null`. */
  tooltipData: SankeyTooltipData | null;
  /** Focuses the node or flow `value` names (`null` clears); an updater function sees `null`. */
  setTooltipData: Dispatch<SetStateAction<SankeyTooltipData | null>>;
  /** Ref to the chart container element. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** `true` once the enter animation has finished. */
  isLoaded: boolean;
  /** Enter animation duration in milliseconds. */
  animationDuration: number;
  /** The `enterTransition` prop of the chart, if set. */
  enterTransition?: Transition;
  /** Increments when the entrance replays (a new `revealSignature`). */
  revealEpoch: number;
  /** Not tracked: the native tooltip follows the pointer itself, so this is always null. */
  mousePos: { x: number; y: number } | null;
  /** Returns the SVG path of a link, for custom link rendering. */
  createPath: (link: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => string;
}

const SankeyContext = createContext<SankeyContextValue | null>(null);

/** @internal */
export const SankeyProvider = ({ children, value }: { readonly children: ReactNode; readonly value: SankeyContextValue }): ReactElement => (
  <SankeyContext.Provider value={value}>{children}</SankeyContext.Provider>
);

/** Returns the chart state and layout. Call it inside a child of `SankeyChart`; it throws elsewhere. */
export function useSankey(): SankeyContextValue {
  const context = useContext(SankeyContext);
  if (!context) {
    throw new Error("useSankey must be used within a SankeyProvider");
  }
  return context;
}

/** Focus the chart reports: a node or a flow, by its index. */
export interface SankeyFocus {
  readonly kind: "node" | "link";
  readonly index: number;
}

export interface SankeyFocusStore {
  get: () => SankeyFocus | null;
  set: (next: SankeyFocus | null) => void;
  subscribe: (cb: () => void) => () => void;
}

const sameFocus = (left: SankeyFocus | null, right: SankeyFocus | null): boolean => {
  if (left === null || right === null) { return left === right; }
  return left.kind === right.kind && left.index === right.index;
};

export function createSankeyFocusStore(): SankeyFocusStore {
  let value: SankeyFocus | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (sameFocus(next, value)) {
        return;
      }
      value = next;
      for (const listener of listeners) { listener(); }
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
  };
}

interface SankeyContextLayerProps {
  readonly data: { readonly nodes: readonly SankeyNodeDatum[]; readonly links: readonly SankeyLinkDatum[] };
  readonly hostRef: RefObject<HTMLDivElement | null>;
  readonly store: SankeyFocusStore;
  readonly margin: Margin;
  readonly nodeWidth: number;
  readonly nodePadding: number;
  readonly animationDuration: number;
  readonly enterTransition?: Transition;
  readonly revealSignature: string;
  readonly hoveredNodeIndex?: number | null;
  /** Focus a node / flow through the native controller (`null` clears). */
  readonly focusNode: (index: number | null) => void;
  readonly focusLink: (index: number | null) => void;
  readonly children?: ReactNode;
}

// d3-sankey's sankeyLinkHorizontal (source.x1,y0 to target.x0,y1), without its d3-shape and d3-path imports.
const createPath = (link: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>): string => {
  const { source, target } = link as { source: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>; target: SankeyNode<SankeyNodeDatum, SankeyLinkDatum> };
  return bumpPath([[source.x1 ?? Number.NaN, link.y0 ?? Number.NaN], [target.x0 ?? Number.NaN, link.y1 ?? Number.NaN]]);
};
const noFocus = (): null => null;

const hoveredNodeOf = (controlled: number | null | undefined, focus: SankeyFocus | null): number | null => {
  if (controlled !== undefined) { return controlled; }
  return focus?.kind === "node" ? focus.index : null;
};

/** Provides `useSankey()` to the chart's children; the only subscriber to the hover store. */
export const SankeyContextLayer = (props: Readonly<SankeyContextLayerProps>): ReactElement => {
  const { data, hostRef, store, margin, nodeWidth, nodePadding, animationDuration, enterTransition, revealSignature, hoveredNodeIndex: controlledNode, focusNode, focusLink, children } = props;
  const size = useResizeBox(hostRef);
  const focus = useSyncExternalStore(store.subscribe, store.get, noFocus);
  const innerWidth = size.width - margin.left - margin.right;
  const innerHeight = size.height - margin.top - margin.bottom;
  // bklit's isLoaded timer (sankey-chart.tsx:130-136) is only exposed through `useSankey()`: it gates no hover.
  const { arm: armReady, ready: isLoaded } = useReadyGate(hostRef, animationDuration, { resetKey: revealSignature, viaState: true });
  useEffect(() => {
    armReady();
  }, [armReady]);
  const [revealEpoch, setRevealEpoch] = useState(0);
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
  }, [animationDuration, revealSignature]);
  const graph = useMemo(
    () =>
      sankey<SankeyNodeDatum, SankeyLinkDatum>()
        .nodeWidth(nodeWidth)
        .nodePadding(nodePadding)
        .nodeAlign(sankeyCenter)
        .extent([[0, 0], [innerWidth, innerHeight]])({ nodes: data.nodes.map((node) => ({ ...node })), links: data.links.map((link) => ({ ...link })) }),
    [data, nodeWidth, nodePadding, innerWidth, innerHeight],
  );
  const tooltipData = useMemo((): SankeyTooltipData | null => {
    if (!focus) {
      return null;
    }
    if (focus.kind === "node") {
      const node = graph.nodes.at(focus.index);
      return node === undefined ? null : { type: "node", nodeIndex: focus.index, x: ((node.x0 ?? 0) + (node.x1 ?? 0)) / 2, y: ((node.y0 ?? 0) + (node.y1 ?? 0)) / 2, data: node };
    }
    const link = graph.links.at(focus.index);
    if (link === undefined) { return null; }
    // SAFETY: after d3-sankey's layout every link's source and target are the node rows (the input indices are replaced).
    const { source, target } = link as { source: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>; target: SankeyNode<SankeyNodeDatum, SankeyLinkDatum> };
    return { type: "link", linkIndex: focus.index, x: ((source.x1 ?? 0) + (target.x0 ?? 0)) / 2, y: ((link.y0 ?? 0) + (link.y1 ?? 0)) / 2, data: link };
  }, [focus, graph]);
  const setTooltipData = useCallback<Dispatch<SetStateAction<SankeyTooltipData | null>>>(
    (next) => {
      const value = typeof next === "function" ? next(null) : next;
      if (value === null) {
        focusNode(null);
        return;
      }
      if (value.type === "node" && value.nodeIndex !== undefined) {
        focusNode(value.nodeIndex);
        return;
      }
      if (value.linkIndex !== undefined) {
        focusLink(value.linkIndex);
      }
    },
    [focusNode, focusLink],
  );
  const value = useMemo(
    (): SankeyContextValue => ({
      graph,
      nodes: graph.nodes,
      links: graph.links,
      width: size.width,
      height: size.height,
      innerWidth,
      innerHeight,
      margin,
      hoveredNodeIndex: hoveredNodeOf(controlledNode, focus),
      hoveredLinkIndex: focus?.kind === "link" ? focus.index : null,
      setHoveredNodeIndex: focusNode,
      setHoveredLinkIndex: focusLink,
      tooltipData,
      setTooltipData,
      containerRef: hostRef,
      isLoaded,
      animationDuration,
      enterTransition,
      revealEpoch,
      mousePos: null,
      createPath,
    }),
    [graph, size.width, size.height, innerWidth, innerHeight, margin, controlledNode, focus, focusNode, focusLink, tooltipData, setTooltipData, hostRef, isLoaded, animationDuration, enterTransition, revealEpoch],
  );
  return <SankeyProvider value={value}>{children}</SankeyProvider>;
};
