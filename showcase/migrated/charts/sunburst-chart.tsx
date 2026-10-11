"use client";

// Bklit SunburstChart on TanStack Charts: native `sunburst` mark inside `polar`, `motion()` entrance and drill, native focus and `onSelect` zoom.
// Compound children are config carriers; custom pieces are documented in sunburst/sunburst-mark.ts, the parts live in sunburst/.
import { erase } from "./kit/cartesian/erased-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ChartInteractionController, ChartPoint, ChartScene } from "@tanstack/charts";
import { createChartCursor } from "@tanstack/charts/cursor";
import { motion } from "@tanstack/charts/motion";
import { Chart as RendererChart } from "@tanstack/react-charts/core";
import { buildArcs, defaultSunburstGrowPadding } from "./sunburst/arcs";
import type { ArcDatum, SunburstNode } from "./sunburst/arcs";
import { parseChildren } from "./sunburst/carriers";
import { defaultSunburstColors, opacityForRelativeDepth, sunburstCssVars, withAlpha } from "./sunburst/colors";
import type { EnterTransition } from "./kit/motion/phase";
import { SunburstHoverProvider, SunburstStableProvider } from "./sunburst/context";
import { SUNBURST_CSS } from "./sunburst/css";
import { clearAttribute, raiseAttribute } from "./kit/host-write";
import { buildDefinition } from "./sunburst/definition";
import { createSectorFeed, createSectorLayer } from "./sunburst/sunburst-layer";
import { usePointerHold } from "./sunburst/focus";
import { isHub } from "./sunburst/hub";
import type { SunburstDatum } from "./sunburst/hub";
import { useControlledCursor, useHoverGrow, useHoverState } from "./sunburst/hover-grow";
import { SUNBURST_ENTRANCE_ORIGINS, sweepMsOf, useSunburstIntro } from "./sunburst/intro";
import { reapplyPush } from "./sunburst/push";
import type { SectorPush } from "./sunburst/push";
import type { SectorTrail, SunburstNativeNode } from "./sunburst/sunburst-mark";
import { useSunburstZoom } from "./sunburst/zoom";
import { useKeyboardFocusHold } from "./kit/keyboard-hold";
import { useTapFocus } from "./kit/touch-focus";
import { EntranceAlign } from "./kit/entrance/entrance-align";
import { useResizeBox } from "./kit/size/use-resize-box";
import "./styles.css";

const DEFAULT_SIZE = 520;
const DEFAULT_HOVER_POP = 8;

const arcColor = (arc: ArcDatum): string => arc.fill ?? arc.color ?? defaultSunburstColors.at(arc.categoryIndex % defaultSunburstColors.length) ?? sunburstCssVars.slice1;

const hoveredIndexOf = (datum: SunburstDatum | undefined, arcById: ReadonlyMap<string, ArcDatum>): number | null =>
  datum === undefined || isHub(datum) ? null : (arcById.get(datum.id)?.arcIndex ?? null);

/** Only the sweep duration in seconds (bklit `Transition.duration`) is read. */
export type SunburstEnterTransition = Pick<EnterTransition, "duration">;

export interface SunburstChartProps {
  data: SunburstNode;
  size?: number;
  /** Bump to replay the initialization animation. */
  playKey?: number;
  className?: string;
  /** Controlled focus node id for drill-down. */
  focusId?: string;
  /** Called when focus changes via segment click or breadcrumb. */
  onFocusChange?: (focusId: string) => void;
  /** Controlled hover - arc index in the arcs array (drives the hint; sector emphasis follows native focus). */
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  /** Outward growth in px of the focused sector (bklit default 8). */
  hoverPop?: number;
  /** Accepted for bklit compatibility; layout is responsive. */
  padding?: number;
  enterTransition?: SunburstEnterTransition;
  enterStaggerScale?: number;
  children: ReactNode;
}

export const SunburstChart = ({
  data,
  size = DEFAULT_SIZE,
  playKey = 0,
  className,
  focusId: focusIdProp,
  onFocusChange,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  hoverPop = DEFAULT_HOVER_POP,
  padding: paddingProp,
  enterTransition,
  enterStaggerScale = 1,
  children,
}: Readonly<SunburstChartProps>): ReactNode => {
  const model = useMemo(() => buildArcs(data), [data]);
  const [internalFocusId, setInternalFocusId] = useState(model.rootId);
  const isFocusControlled = focusIdProp !== undefined;
  const requestedFocusId = isFocusControlled ? focusIdProp : internalFocusId;
  const focus = model.focusById.get(requestedFocusId) ?? model.focusById.get(model.rootId);
  const focusId = focus?.id ?? model.rootId;
  const arcById = useMemo(() => new Map(model.arcs.map((arc) => [arc.id, arc])), [model.arcs]);

  const parsed = parseChildren(children);
  const segmentKey = JSON.stringify([...parsed.segments.values()]);
  const labelsKey = JSON.stringify(parsed.labels);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const { hoverStore, hoveredArc, isHoverControlled, setHoveredArcIndex } = useHoverState(model.arcs, hoveredIndexProp, onHoverChange);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageBox = useResizeBox(stageRef, { height: size, width: size });
  // bklit draws in a size-unit viewBox, so padding and pop distance shrink with the rendered width.
  const unit = stageBox.width > 0 ? stageBox.width / size : 1;
  const growPadding = (paddingProp ?? defaultSunburstGrowPadding(model.maxDepth, size, hoverPop)) * unit;
  const popPx = hoverPop * unit;
  const sweepMs = sweepMsOf(enterTransition?.duration);
  const registry = useMemo(() => new Map<string, ChartPoint<SunburstNativeNode, number, number>>(), []);
  const pushes = useMemo(() => new Map<string, SectorPush>(), []);
  const trail = useMemo((): SectorTrail => new Map(), []);
  const controller = useMemo(() => createChartCursor<number, number>(), []);
  const interactionRef = useRef<ChartInteractionController<SunburstDatum, number, number> | null>(null);
  const centerRef = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const sceneRef = useRef<ChartScene<SunburstDatum, number, number> | null>(null);
  useTapFocus(hostRef, () => erase(interactionRef.current), { mode: "press" });
  const holdFocus = useKeyboardFocusHold(hostRef, () => erase(interactionRef.current));

  // The arcs of the last hover path written to the host (`data-bk-path`), for the zoom's snap.
  const hoverPathRef = useRef("");
  const { handFocusOver, noteSource, selectZoom, zoomTo, zoomableRef } = useSunburstZoom({
    arcById,
    focus,
    focusId,
    holdFocus,
    hoverPathRef,
    hostRef,
    isFocusControlled,
    model,
    onFocusChange,
    setHoveredArcIndex,
    setInternalFocusId,
  });
  const movingRef = useRef(false);
  usePointerHold({ hostRef, interactionRef, movingRef, zoomableRef });

  const renderer = useMemo(() => motion({ initial: "always" }), []);
  const { hostVars, introAtRef, introRef, settled } = useSunburstIntro(model.arcs, enterStaggerScale, sweepMs, playKey);
  // One feed and layer per chart: the layer's composition must be a stable object across definition rebuilds (a changed renderer remounts it).
  const feed = useMemo(() => createSectorFeed(size), [size]);
  const sectorRenderer = useMemo(() => createSectorLayer(feed, introAtRef), [feed, introAtRef]);
  useEffect(() => {
    feed.onPainted = (): void => { reapplyPush(hostRef.current); };
    return (): void => { feed.onPainted = null; };
  }, [feed]);

  // Segment overrides and labels are read from the latest children through their serialized keys.
  const definition = useMemo(() => {
    if (focus === undefined || model.maxDepth === 0) {
      return null;
    }
    const fillOf = (nodeId: string): string => {
      const arc = arcById.get(nodeId);
      if (arc === undefined) {
        return sunburstCssVars.slice1;
      }
      const override = parsed.segments.get(arc.arcIndex);
      const base = override?.fill ?? override?.color ?? arcColor(arc);
      return withAlpha(base, override?.fillOpacity ?? opacityForRelativeDepth(arc.depth - focus.depth));
    };
    return buildDefinition({
      controller,
      enterStaggerScale,
      fillOf,
      focus,
      feed,
      sectorRenderer,
      isIntro: () => introRef.current,
      center: () => centerRef.current,
      controlled: isHoverControlled,
      introAt: () => introAtRef.current,
      hasCenter: parsed.hasCenter,
      labels: parsed.labels,
      hoverPop: popPx,
      model,
      padding: growPadding,
      pushes,
      registry,
      scene: () => sceneRef.current,
      noteSource,
      moving: () => movingRef.current,
      hoveredId: () => {
        const index = hoverStore.getIndex();
        return index === null ? null : (hoverStore.arcs.current[index]?.id ?? null);
      },
      trail,
      sweepMs,
    });
    // parsed is rebuilt each render; its content is captured by segmentKey/labelsKey/hasCenter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, arcById, focus, segmentKey, labelsKey, parsed.hasCenter, sweepMs, enterStaggerScale, feed, sectorRenderer, popPx, growPadding, controller, registry, pushes, trail, isHoverControlled, noteSource, hoverStore]);

  useControlledCursor(controller, registry, hoveredArc?.id ?? null, isHoverControlled, definition);
  useHoverGrow({ arcs: model.arcs, definition, focusDepth: focus?.depth ?? 0, hostRef, hoverPathRef, hoverPop: popPx, hoverStore, maxDepth: model.maxDepth, pushes });

  const onRender = useCallback(
    (context: { readonly interaction: unknown; readonly scene: ChartScene<SunburstDatum, number, number> }): void => {
      interactionRef.current = erase(context.interaction);
      sceneRef.current = context.scene;
      centerRef.current = { x: context.scene.chart.x + context.scene.chart.width / 2, y: context.scene.chart.y + context.scene.chart.height / 2 };
      handFocusOver(context.scene);
    },
    [handFocusOver],
  );
  const onChartFocus = useCallback(
    (point: ChartPoint<SunburstDatum, number, number> | null): void => {
      holdFocus(erase(point));
      if (hostRef.current !== null) {
        if (isHub(point?.datum)) {
          raiseAttribute(hostRef.current, "data-bk-hub");
        } else {
          clearAttribute(hostRef.current, "data-bk-hub");
        }
      }
      setHoveredArcIndex(hoveredIndexOf(point?.datum, arcById));
    },
    [arcById, holdFocus, setHoveredArcIndex],
  );
  const hostStyle = useMemo(() => ({ maxWidth: "100%", width: size, ...hostVars }), [size, hostVars]);
  const stageStyle = useMemo(() => ({ aspectRatio: "1 / 1", maxWidth: size }), [size]);

  const stable = useMemo(
    () => (focus === undefined ? null : { arcs: model.arcs, data, focus, focusById: model.focusById, focusId, maxDepth: model.maxDepth, rootId: model.rootId, size, zoomTo }),
    [data, focus, focusId, model, size, zoomTo],
  );

  if (stable === null) {
    return null;
  }

  return (
    <SunburstStableProvider value={stable}>
      <SunburstHoverProvider value={hoverStore}>
        <div ref={hostRef} className={className} data-bk-intro={settled ? undefined : ""} style={hostStyle}>
          <style>{SUNBURST_CSS}</style>
          {definition === null || settled ? null : <EntranceAlign hostRef={hostRef} origins={SUNBURST_ENTRANCE_ORIGINS} renderStart={introAtRef} resolveOnFrame />}
          {parsed.breadcrumbs}
          <div ref={stageRef} className="mx-auto w-full" style={stageStyle}>
            {definition === null ? null : (
              <RendererChart
                key={playKey}
                ariaDescription="Use arrow keys to inspect segments and Enter or Space to zoom into a branch. Once zoomed in, press Escape, or arrow to the center disc and press Enter or Space, to zoom out."
                ariaLabel={`Sunburst chart of ${data.name}`}
                aspectRatio={1}
                definition={definition}
                onRender={onRender}
                onFocusChange={onChartFocus}
                onSelect={selectZoom}
                renderer={renderer}
              />
            )}
          </div>
          {parsed.hints}
        </div>
      </SunburstHoverProvider>
    </SunburstStableProvider>
  );
};
SunburstChart.displayName = "SunburstChart";

export { SunburstBreadcrumb, useSunburstBreadcrumbItems } from "./sunburst/breadcrumb";
export type { SunburstBreadcrumbItem, SunburstBreadcrumbProps } from "./sunburst/breadcrumb";
export { SunburstCenter, SunburstLabels, SunburstSegment } from "./sunburst/carriers";
export type { SunburstCenterProps, SunburstLabelsProps, SunburstSegmentProps } from "./sunburst/carriers";
export { SunburstHint } from "./sunburst/hint";
export type { SunburstHintContext, SunburstHintProps } from "./sunburst/hint";
export type { ArcDatum, Focus, SunburstNode } from "./sunburst/arcs";
export { useSunburstHover, useSunburstStable } from "./sunburst/context";
export { defaultSunburstColors, opacityForRelativeDepth, sunburstCssVars } from "./sunburst/colors";
export { buildArcs, clockwiseFraction, defaultSunburstGrowPadding, ringOptions, sumValues } from "./sunburst/arcs";
