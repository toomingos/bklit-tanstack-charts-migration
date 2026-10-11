// Bklit SankeyChart on TanStack Charts 1.0: native sankeyDiagram layout, the native tooltip, and the `motion()` renderer for the
// entrance. The connected-flow hover dim is static scoped CSS driven by per-index custom properties on the host (sankey/hover-css.ts).
"use client";

import { HoldArm } from "./kit/size/parent-size-arm";
import { useHostSize } from "./kit/size/host-size";
import { joinClasses } from "./kit/cn";
import { hasText } from "./kit/guards";
import { EntranceAlign } from "./kit/entrance/entrance-align";
import { Children, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { RendererChart } from "./kit/tooltip/tooltip-leaf";
import { defineChart } from "@tanstack/charts/scene";
import { motion } from "@tanstack/charts/motion";
import { bklitTooltip } from "./kit/tooltip/bklit-tooltip";
import type { ChartInteractionController, ChartPoint, ChartRendererRenderContext } from "@tanstack/charts";
import type { Transition } from "./kit/motion/phase";
import { toCssEase } from "./kit/motion/enter-transition";
import { buildSankeyGradients, createSankeyMark, intFmt } from "./sankey/marks";
import type { SankeyDatum, SankeyInputLinkRow, SankeyInputData } from "./sankey/marks";
import { createSankeyFocus, SANKEY_LINK_POINT_MARK_ID, SANKEY_NODE_POINT_MARK_ID } from "./sankey/focus";
import { childProps, isConfigCarrier, rowOf, sanitizeSankeyData } from "./sankey/data";
import { SANKEY_ENTRANCE_ORIGINS, toNativeTransition } from "./sankey/entrance";
import { createSankeyFocusStore, SankeyContextLayer } from "./sankey/context";
import { sankeyTooltipBody, sankeyTooltipContent } from "./sankey/tooltip";
import type { Margin, SankeyData } from "./sankey/types";
import type { SankeyFocus } from "./sankey/context";
import { bklitTooltipPlacement } from "./kit/tooltip/bklit-tooltip-portal";
import { ResourceHost, scopePaintUrl, scopeResourceIds } from "./kit/resource-host";
import { parseAspectRatio, TOOLTIP_MOTION } from "./kit/theme";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { useTapFocus } from "./kit/touch-focus";
import "./styles.css";
import { createSankeyHoverWriter, sankeyHoverSets, sankeyHoverCss, sankeyHoverVars, sankeyIndexCss } from "./sankey/hover-css";
import type { SankeyHoverFocus } from "./sankey/hover-css";
import "./sankey/sankey.css";
import { CHART_PALETTE } from "./kit/palette";
import { useSanitizedId } from "./kit/use-sanitized-id";

interface SankeyChartProps {
  readonly data: SankeyData;
  readonly margin?: Partial<Margin>;
  readonly animationDuration?: number;
  readonly enterTransition?: Transition;
  readonly revealSignature?: string;
  readonly aspectRatio?: string;
  readonly nodeWidth?: number;
  readonly nodePadding?: number;
  readonly className?: string;
  readonly children?: ReactNode;
  readonly hoveredNodeIndex?: number | null;
  readonly onNodeHoverChange?: (index: number | null) => void;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const DEFAULT_MARGIN: Margin = { bottom: 40, left: 180, right: 180, top: 40 };
const DEFAULT_ANIMATION_MS = 1100;
const RENDERER = motion();
const RENDERER_STYLE: CSSProperties = { width: "100%" };
const formatInt = (value: number): string => intFmt.format(value);

const isNodeMark = (point: { readonly markId: string } | null | undefined): boolean => point?.markId.startsWith(SANKEY_NODE_POINT_MARK_ID) === true;

/** The node or flow a focused point stands for, by index (a flow's index is its position in the data). */
const hoverFocusOf = (point: ChartPoint<SankeyDatum, number, number> | null, links: readonly object[]): SankeyHoverFocus | null => {
  const row = rowOf(point ?? undefined);
  if (isNodeMark(point) && row.key !== undefined) { return { node: row.key }; }
  if (point?.markId === SANKEY_LINK_POINT_MARK_ID && row.data !== undefined) { return { link: links.indexOf(row.data) }; }
  return null;
};

const storeFocusOf = (focus: SankeyHoverFocus | null): SankeyFocus | null => {
  if (focus === null) { return null; }
  return "node" in focus ? { index: focus.node, kind: "node" } : { index: focus.link, kind: "link" };
};

const SankeyChart = ({
  data: dataProp,
  margin: marginProp,
  animationDuration = DEFAULT_ANIMATION_MS,
  enterTransition,
  revealSignature,
  aspectRatio = "2 / 1",
  nodeWidth = 16,
  nodePadding = 24,
  className,
  children,
  hoveredNodeIndex,
  onNodeHoverChange,
  ariaLabel = "Sankey chart",
  ariaDescription,
}: SankeyChartProps): ReactElement => {
  const data = useMemo(() => sanitizeSankeyData(dataProp), [dataProp]);
  const revealKey = revealSignature ?? "";
  const idPrefix = useSanitizedId();
  const linkConfig = useMemo(() => childProps(children, "SankeyLink") ?? {}, [children]);
  const nodeConfig = useMemo(() => childProps(children, "SankeyNode") ?? {}, [children]);
  const tooltipConfig = useMemo(() => childProps(children, "SankeyTooltip"), [children]);
  const formatValue = tooltipConfig?.formatValue ?? formatInt;

  const nodeColor = useCallback((index: number): string => {
    if (hasText(nodeConfig.fill)) {return nodeConfig.fill;}
    const node = data.nodes.at(index);
    const custom = nodeConfig.getNodeColor ?? linkConfig.getNodeColor;
    if (custom !== undefined && node !== undefined) {return custom({ ...node, index }, index);}
    return CHART_PALETTE[index % CHART_PALETTE.length] ?? CHART_PALETTE[0];
  }, [data.nodes, linkConfig.getNodeColor, nodeConfig]);

  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const useGradient = linkConfig.useGradient ?? true;

  // bklit mounts no svg until ParentSize's first size commit (sankey-chart.tsx:246); here the renderer mounts in the layout-effect measure, before first paint,
  // at the real width; the host keeps bklit's aspect-ratio box meanwhile (sankey-chart.tsx:231,236).
  const { ref: hostRef, size: hostSize } = useHostSize();
  const sized = hostSize !== null;

  const definition = useMemo(() => {
    const input: SankeyInputData = data;
    const linkStroke = (row: SankeyInputLinkRow, sourceColor: string, gradientId: string | null): string => {
      // bklit order: a pattern id wins over the flat stroke, getLinkColor and the gradient.
      if (linkConfig.getLinkPattern) {
        const index = data.links.indexOf(row.data);
        const patternId = linkConfig.getLinkPattern({ ...row.data, index }, index);
        if (hasText(patternId)) {return scopePaintUrl(`url(#${patternId})`, idPrefix);}
      }
      if (hasText(linkConfig.stroke)) {return linkConfig.stroke;}
      if (linkConfig.getLinkColor) {
        const index = data.links.indexOf(row.data);
        return linkConfig.getLinkColor({ ...row.data, index }, index);
      }
      return gradientId === null ? sourceColor : `url(#${gradientId})`;
    };
    // bklit lays out in `width - left - right`; once that is narrower than a node the columns run right to left (never an error).
    // The builder receives the scene width (the margins are 0 here, so it is the host width): no observer, no state.
    return defineChart(({ width }) => {
      const reversed = width - margin.left - margin.right < nodeWidth;
      // The flow draw direction is a CSS rule keyed on the host attribute; set in the same synchronous build that lays the scene out,
      // so it is in place before first paint (React does not own this attribute).
      hostRef.current?.toggleAttribute("data-bkm-reversed", reversed);
      return {
        gradients: useGradient && !hasText(linkConfig.stroke) && linkConfig.getLinkColor === undefined ? buildSankeyGradients(input, nodeColor, reversed) : [],
        guides: false,
        // The side margins are applied by the mark (it places the columns, see layoutColumns); the chart keeps only top/bottom.
        margin: { bottom: margin.bottom, left: 0, right: 0, top: margin.top },
        marks: [createSankeyMark({
          data: input,
          enter: { durationMs: animationDuration, transition: toNativeTransition(enterTransition, animationDuration) },
          labelOrientation: nodeConfig.labelOrientation ?? "horizontal",
          lineCap: nodeConfig.lineCap ?? 4,
          linkStroke,
          nodeColor,
          nodePadding,
          nodeWidth,
          sideMargin: { left: margin.left, right: margin.right },
          showLabels: nodeConfig.showLabels ?? true,
          showValueLabels: nodeConfig.showValueLabels ?? true,
          strokeOpacity: linkConfig.strokeOpacity ?? 0.5,
          useGradient,
        })],
        scales: { x: null, y: null },
      };
    }, {
      // A builder chart takes its interaction options (focus, tooltip) as the second argument; inside the built spec they are ignored.
      focus: createSankeyFocus<SankeyDatum>(),
      focusRing: false,
      tooltip: {
        anchor: "pointer",
        className: joinClasses("bkm-sankey-tooltip", tooltipConfig?.className),
        content: sankeyTooltipContent(formatValue),
        motion: TOOLTIP_MOTION,
        offset: 16,
        portal: bklitTooltipPlacement(),
        // bklit's sankey has no click handling (sankey/*.tsx): a click must not pin the tooltip (dialog role, re-placement, body
        // re-render), and click-then-leave hides it like a plain leave.
        sticky: false,
        use: bklitTooltip,
      },
    });
  }, [animationDuration, idPrefix, data, enterTransition, linkConfig, margin, nodeColor, nodeConfig, nodePadding, nodeWidth, tooltipConfig, formatValue, useGradient]);

  const hoverVars = useMemo(
    () => sankeyHoverVars(nodeConfig.fadedOpacity ?? 0.4, linkConfig.fadedOpacity ?? 0.1, linkConfig.strokeOpacity ?? 0.5),
    [linkConfig.fadedOpacity, linkConfig.strokeOpacity, nodeConfig.fadedOpacity],
  );

  const renderTooltipBody = useMemo(() => sankeyTooltipBody(data, tooltipConfig), [data, tooltipConfig]);

  // Controlled hover: drive the same native focus the pointer would.
  const interactionRef = useRef<ChartInteractionController<SankeyDatum, number, number> | null>(null);
  const sceneRef = useRef<ChartRendererRenderContext<SankeyDatum, number, number>["scene"] | null>(null);
  const hoveredRef = useRef(hoveredNodeIndex);
  hoveredRef.current = hoveredNodeIndex;
  const applyControlledHover = useCallback(() => {
    const interaction = interactionRef.current;
    const target = hoveredRef.current;
    if (!interaction || target === undefined) {return;}
    if (target === null) {
      interaction.setControlledFocus(null);
      return;
    }
    const point = sceneRef.current?.points.find((candidate) => candidate.markId.startsWith(SANKEY_NODE_POINT_MARK_ID) && rowOf(candidate).key === target);
    if (point) {interaction.setControlledFocus(point);}
  }, []);
  useEffect(applyControlledHover, [applyControlledHover, hoveredNodeIndex]);

  useTapFocus(hostRef, () => interactionRef.current, { mode: "tap" });
  const hoverWriter = useMemo(() => createSankeyHoverWriter(), []);
  const handleRender = useCallback((context: ChartRendererRenderContext<SankeyDatum, number, number>) => {
    interactionRef.current = context.interaction;
    sceneRef.current = context.scene;
    applyControlledHover();
  }, [applyControlledHover]);

  // Hover never touches React state or the definition: the focused node / flow and everything connected to it are written into the
  // chart's own per-index stylesheet (never on renderer-owned elements) and the static rules in sankey/hover-css.ts do the dim.
  const indexStyleRef = useRef<HTMLStyleElement | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const applyHover = useCallback((point: ChartPoint<SankeyDatum, number, number> | null) => {
    const { links, nodes } = dataRef.current;
    const focus = hoverFocusOf(point, links);
    hoverWriter.write(indexStyleRef.current?.sheet ?? null, focus === null ? null : sankeyHoverSets(links, focus), { links: links.length, nodes: nodes.length });
  }, [hoverWriter]);

  const focusNode = useCallback((index: number | null) => {
    const interaction = interactionRef.current;
    if (index === null) {
      interaction?.setControlledFocus(null);
      return;
    }
    const point = sceneRef.current?.points.find((candidate) => candidate.markId.startsWith(SANKEY_NODE_POINT_MARK_ID) && rowOf(candidate).key === index);
    if (point !== undefined) {interaction?.setControlledFocus(point);}
  }, []);
  const focusLink = useCallback((index: number | null) => {
    const interaction = interactionRef.current;
    if (index === null) {
      interaction?.setControlledFocus(null);
      return;
    }
    const link = dataRef.current.links.at(index);
    const point = link === undefined ? undefined : sceneRef.current?.points.find((candidate) => candidate.markId === SANKEY_LINK_POINT_MARK_ID && rowOf(candidate).data === link);
    if (point !== undefined) {interaction?.setControlledFocus(point);}
  }, []);
  // The public `useSankey()` layer exists only when the chart has children beyond its own config carriers.
  const focusStore = useMemo(() => createSankeyFocusStore(), []);
  const hasContextChildren = !Children.toArray(children).every(isConfigCarrier);
  const onNodeHoverChangeRef = useRef(onNodeHoverChange);
  onNodeHoverChangeRef.current = onNodeHoverChange;
  const holdFocus = useKeyboardFocusHold(hostRef, () => interactionRef.current);
  const handleFocusChange = useCallback((point: ChartPoint<SankeyDatum, number, number> | null) => {
    holdFocus(point);
    applyHover(point);
    focusStore.set(storeFocusOf(hoverFocusOf(point, dataRef.current.links)));
    onNodeHoverChangeRef.current?.(isNodeMark(point) ? (rowOf(point ?? undefined).key ?? null) : null);
  }, [applyHover, focusStore, holdFocus]);

  // Entrance fades native motion cannot animate are the static rules in sankey.css, driven by these wrapper vars and sibling-index()
  // (stagger is Chromium-only, under `@supports`).
  const ease = toCssEase(enterTransition?.ease);
  const dur = Math.round(enterTransition?.duration === undefined ? animationDuration : enterTransition.duration * 1000);
  const nodeCount = Math.max(1, data.nodes.length);
  const hostStyle = useMemo((): CSSProperties => {
    const entranceVars = { "--bkm-sankey-dur": `${dur}ms`, "--bkm-sankey-ease": ease, "--bkm-sankey-n": nodeCount };
    return { aspectRatio: sized ? undefined : aspectRatio, ...entranceVars, ...hoverVars, position: "relative", userSelect: "none", width: "100%" };
  }, [aspectRatio, dur, ease, hoverVars, nodeCount, sized]);

  return (
    <div className={className} data-bkm-chart="sankey" data-bkm-sk-hold="" data-bkm-sk-id={idPrefix} data-slot="chart" ref={hostRef} style={hostStyle}>
      <style>{sankeyHoverCss()}</style>
      <style ref={indexStyleRef}>{sankeyIndexCss(idPrefix)}</style>
      {sized ? <HoldArm key={`arm-${revealSignature}`} attribute="data-bkm-sk-hold" hostRef={hostRef} /> : null}
      {sized ? <EntranceAlign hostRef={hostRef} key={`align-${revealSignature}`} origins={SANKEY_ENTRANCE_ORIGINS} /> : null}
      {sized ? <RendererChart
        key={revealSignature}
        ariaDescription={ariaDescription}
        ariaLabel={ariaLabel}
        aspectRatio={parseAspectRatio(aspectRatio)}
        definition={definition}
        idPrefix={idPrefix}
        initialWidth={hostSize?.width ?? 640}
        onFocusChange={handleFocusChange}
        onRender={handleRender}
        renderer={RENDERER}
        renderTooltipBody={renderTooltipBody}
        style={RENDERER_STYLE}
      /> : null}
      {hasContextChildren ? (
        <SankeyContextLayer
          animationDuration={animationDuration}
          data={data}
          enterTransition={enterTransition}
          focusLink={focusLink}
          focusNode={focusNode}
          hostRef={hostRef}
          hoveredNodeIndex={hoveredNodeIndex}
          margin={margin}
          nodePadding={nodePadding}
          nodeWidth={nodeWidth}
          revealSignature={revealKey}
          store={focusStore}
        >
          {children}
        </SankeyContextLayer>
      ) : null}
      {linkConfig.patterns !== undefined && linkConfig.patterns !== null && linkConfig.patterns !== false ? <ResourceHost idPrefix={idPrefix} resources={scopeResourceIds(linkConfig.patterns, idPrefix)} /> : null}
    </div>
  );
};

export { SankeyLink } from "./sankey/link";
export { SankeyNode } from "./sankey/node";
export { SankeyTooltip } from "./sankey/tooltip";
export { SankeyChart };
export type { SankeyLinkProps } from "./sankey/link";
export type { SankeyLabelOrientation, SankeyNodeProps } from "./sankey/node";
export type { SankeyTooltipProps } from "./sankey/tooltip";
export type { SankeyData } from "./sankey/types";
export type { SankeyChartProps };
