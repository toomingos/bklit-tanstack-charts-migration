import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { erase } from "../kit/erased-types";
import { writePresence } from "../kit/host-write";
import type { RefObject } from "react";
import type { ChartPoint } from "@tanstack/charts";
import { useMousePressFreeze, useTapFocus } from "../kit/touch-focus";
import { createHoverStore } from "./context";
import type { GeoGeometry, ProjectionHolder } from "./focus";
import { FEATURES_ID } from "./projection";
import { baseTooltipPoint } from "./tooltip";
import type { ChoroplethFeature, HoverStore } from "./types";
import type { RenderedChart } from "./wheel";

const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

interface Size {
  readonly width: number;
  readonly height: number;
}

interface FeatureHover {
  readonly size: Size;
  readonly hoverStore: HoverStore;
  readonly renderRef: RefObject<RenderedChart | null>;
  readonly handleRender: (context: Partial<RenderedChart>) => void;
  readonly handleFocusChange: (point: ChartPoint<ChoroplethFeature> | null) => void;
  readonly setHoveredFeatureIndex: (index: number | null) => void;
}

/** useChoropleth() compatibility: measured size and the focus mirror, plus the host-attribute hover state and touch holds. */
export const useFeatureHover = (options: {
  readonly hostRef: RefObject<HTMLDivElement | null>;
  readonly holder: ProjectionHolder;
  readonly geometry: GeoGeometry;
  readonly transform: ProjectionHolder["transform"];
  readonly zoomEnabled: boolean;
}): FeatureHover => {
  const { hostRef, holder, geometry, transform, zoomEnabled } = options;
  const [size, setSize] = useState<Size>({ height: 0, width: 0 });
  const hoverStore = useMemo(() => createHoverStore(), []);
  const renderRef = useRef<RenderedChart | null>(null);
  const handleRender = useCallback((context: Partial<RenderedChart>): void => {
    const { scene, interaction } = context;
    if (!scene || !interaction) {return;}
    renderRef.current = { interaction, scene };
    // oxlint-disable-next-line react/immutability -- the holder is the focus strategy's shared mutable state, written once per render
    holder.renderedPoints = scene.points;
    setSize((prev) => (Math.abs(prev.width - scene.width) > 0.5 || Math.abs(prev.height - scene.height) > 0.5 ? { height: scene.height, width: scene.width } : prev));
  }, [holder]);
  // bklit hovers on mouseenter / mouseleave, so a tap hovers until a tap elsewhere; a zoomable map's drag (visx / use-gesture) also captures the press and pans by touch.
  const getInteraction = useCallback(() => erase(renderRef.current?.interaction), []);
  useMousePressFreeze(hostRef, getInteraction, zoomEnabled);
  useTapFocus(hostRef, getInteraction, { mode: "tap" });
  const handleFocusChange = useCallback((point: ChartPoint<ChoroplethFeature> | null): void => {
    // bklit removes the tooltip the instant the pointer leaves a country (no exit); the native exit spring would
    // keep it up for ~270ms, so an idle flag on the host lets CSS drop it at once (no definition/React work).
    const onFeature = point?.markId === FEATURES_ID;
    const host = hostRef.current;
    writePresence(host, "data-bkm-idle", !onFeature);
    // Presence only: the dim is one group-level rule (fades on enter, snaps on leave; a feature-to-feature move leaves it alone, so
    // only the guide swaps, like bklit's highlighted path).
    writePresence(host, "data-hover", onFeature);
    if (!onFeature) {
      hoverStore.set(null, null);
      return;
    }
    // bklit's tooltipData: the clamped centroid in unzoomed space (consumers apply the zoom transform, as bklit's tooltip does).
    const base = baseTooltipPoint(holder, point.datum) ?? { x: point.x, y: point.y };
    hoverStore.set(point.datumIndex, { feature: point.datum, featureIndex: point.datumIndex, ...base });
  }, [holder, hoverStore, hostRef]);
  // Pan/zoom re-renders without touching the definition, so the core layout effect repaints the hovered focus and re-runs `tooltipAnchor` (as bklit's zoom.applyToPoint);
  // a hovered feature the zoom carries out of view is cleared like bklit's mouseleave.
  useIsomorphicLayoutEffect(() => {
    const held = hoverStore.tooltip?.feature;
    if (held === undefined || geometry.visible(held)) {return;}
    renderRef.current?.interaction.setControlledFocus(null);
  }, [geometry, hoverStore, transform]);
  const setHoveredFeatureIndex = useCallback((index: number | null): void => {
    const ctx = renderRef.current;
    if (index === null || !ctx) {hoverStore.set(index, null); return;}
    const candidate = ctx.scene.points.find((point) => point.markId === FEATURES_ID && point.datumIndex === index);
    if (candidate) {ctx.interaction.setControlledFocus(candidate, { source: "programmatic" });}
  }, [hoverStore]);

  return { handleFocusChange, handleRender, hoverStore, renderRef, setHoveredFeatureIndex, size };
};
