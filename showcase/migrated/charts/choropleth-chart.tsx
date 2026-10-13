"use client";
// Bklit ChoroplethChart on native primitives: geoShape marks (countries + optional graticule), host `data-hover` CSS dim plus an owned highlight svg, built-in tooltip, `motion()`.
// Parts live in choropleth/.
import { useMemo, useRef, useState } from "react";
import { useHydratingAttrs } from "./kit/use-hydrating";
import type { CSSProperties, ReactElement } from "react";
import { geoPath } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";
import { motion } from "@tanstack/charts/motion";
import type { ChartBounds } from "@tanstack/charts";
import { RendererChart } from "./kit/tooltip/tooltip-leaf";
import { parseAspectRatio } from "./kit/theme";
import { extractChildren } from "./choropleth/carriers";
import { ChoroplethContext, tooltipSetter } from "./choropleth/context";
import { createDefinition } from "./choropleth/definition";
import { createLayerMotion, useEnterReveal } from "./choropleth/enter";
import { useFeatureHover } from "./choropleth/feature-hover";
import { createGeoGeometry } from "./choropleth/focus";
import type { ProjectionHolder } from "./choropleth/focus";
import { makeProjection, scopePatterns } from "./choropleth/projection";
import { useTooltipBody } from "./choropleth/tooltip";
import type { ChoroplethChartProps, ChoroplethContextValue, Margin } from "./choropleth/types";
import { useWheelFocusClear } from "./choropleth/wheel";
import { ChoroplethZoomContext, identityMatrix, useGeoZoom, zoomStyle } from "./choropleth/zoom";
import type { TransformMatrix } from "./choropleth/zoom";
import { useSanitizedId } from "./kit/use-sanitized-id";

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_MARGIN: Margin = { bottom: 0, left: 0, right: 0, top: 0 };
const ZERO_ZOOM: TransformMatrix = identityMatrix();
const DEFAULT_FADED_OPACITY = 0.4;
// CSS custom properties are not in CSSProperties; this widens it with the dim the host carries.
type HostStyle = CSSProperties & { readonly "--bkm-choro-dim": number };
const HIDDEN_DEFS_STYLE = { height: 0, position: "absolute", width: 0 } as const;

const ChoroplethChart = ({
  data,
  margin: marginProp,
  animationDuration = 800,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = DEFAULT_CENTER,
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = ZERO_ZOOM,
  className = "",
  children,
  ariaLabel = "Choropleth chart",
  ariaDescription,
}: ChoroplethChartProps): ReactElement => {
  const margin = useMemo((): Margin => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const patternPrefix = `${useSanitizedId()}-`;
  const hydratingAttrs = useHydratingAttrs();
  const { featureConfig, tooltipConfig, graticuleConfig, overlayChildren } = useMemo(() => extractChildren(children), [children]);
  const dim = featureConfig?.fadedOpacity ?? DEFAULT_FADED_OPACITY;
  const renderer = useMemo(() => motion({ initial: "always" }), []);

  const [holder] = useState((): ProjectionHolder => ({ projection: undefined, transform: { k: initialZoom.scaleX, x: initialZoom.translateX, y: initialZoom.translateY } }));
  const [geometry] = useState(() => createGeoGeometry(holder));
  const wheel = useWheelFocusClear();
  const { instance: zoomInstance, transform } = useGeoZoom({ enabled: zoomEnabled, holder, hostRef, initial: initialZoom, max: zoomMax, min: zoomMin, onWheelZoom: wheel.onWheelZoom });
  const { ready, epoch, enterMotion, fadeVars } = useEnterReveal(hostRef, { animationDuration, enterTransition, revealSignature });

  const definition = useMemo(() => createDefinition({
    center, data, featureConfig, geometry, graticuleConfig, holder, margin, patternPrefix, scale: scaleProp, tooltipConfig, translate: translateProp,
    layerMotion: createLayerMotion(enterMotion),
  }), [center, data, enterMotion, featureConfig, geometry, graticuleConfig, holder, margin, patternPrefix, scaleProp, tooltipConfig, translateProp]);

  const renderTooltipBody = useTooltipBody(tooltipConfig);
  const { size, hoverStore, renderRef, isHeld, handleRender, handleFocusChange, setHoveredFeatureIndex } = useFeatureHover({ geometry, holder, hostRef, transform, zoomEnabled });
  wheel.bind({ hoverStore, isHeld, renderRef });

  const contextValue = useMemo((): ChoroplethContextValue => {
    const bounds: ChartBounds = { height: size.height - margin.top - margin.bottom, width: size.width - margin.left - margin.right, x: margin.left, y: margin.top };
    const projection = makeProjection(bounds, { center, k: transform.k, scale: scaleProp, translate: translateProp, tx: transform.x, ty: transform.y });
    const path = geoPath(projection);
    const raw = (geo: GeoPermissibleObjects): string | null => path(geo);
    const projectPoint = (coords: [number, number]): [number, number] | null => {
      const p = projection(coords);
      return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1]] : null;
    };
    let featurePaths: (string | null)[] | undefined = undefined;
    return {
      animationDuration,
      containerRef: hostRef,
      enterTransition,
      featureCollection: data,
      get featurePaths() { return (featurePaths ??= data.features.map(raw)); },
      features: data.features,
      height: size.height,
      hoveredFeatureIndex: null,
      hoverStore,
      innerHeight: Math.max(0, bounds.height),
      innerWidth: Math.max(0, bounds.width),
      isLoaded: false,
      margin,
      pathGenerator: (feature) => raw(feature) ?? undefined,
      projectPoint,
      readyStore: ready,
      rawPathGenerator: raw,
      revealEpoch: epoch,
      setHoveredFeatureIndex,
      setTooltipData: tooltipSetter(hoverStore),
      tooltipData: null,
      unprojectPoint: (point) => {
        const p = projection.invert?.(point);
        return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1]] : null;
      },
      width: size.width,
    };
  }, [animationDuration, center, data, enterTransition, hoverStore, ready, epoch, margin, scaleProp, setHoveredFeatureIndex, size, transform, translateProp]);

  const hostStyle = useMemo((): HostStyle => ({
    aspectRatio: String(ratio),
    contain: "layout style paint",
    cursor: zoomEnabled ? "grab" : undefined,
    overflow: "hidden",
    position: "relative",
    touchAction: zoomEnabled ? "none" : undefined,
    width: "100%",
    ...zoomStyle(initialZoom),
    ...fadeVars,
    // bklit's hover dim of the features group (`fadedOpacity`), read by styles.css.
    "--bkm-choro-dim": dim,
  }), [ratio, zoomEnabled, initialZoom, dim, fadeVars]);

  const zoomValue = useMemo(() => ({ zoom: zoomInstance }), [zoomInstance]);

  // Entrance starts on the first draw, without bklit's ParentSize frames (choropleth-chart.tsx:482), at the user's direction (no frame waits); the curve is unchanged.
  return (
    <div ref={hostRef} className={className} style={hostStyle} data-bkm-chart="choropleth" {...hydratingAttrs} data-slot="chart" data-bkm-drag={zoomInstance?.isDragging === true ? "" : undefined}>
      <ChoroplethContext.Provider value={contextValue}>
        <ChoroplethZoomContext.Provider value={zoomValue}>
          {featureConfig?.patterns === undefined || featureConfig.patterns === null || featureConfig.patterns === false ? undefined : <svg aria-hidden="true" style={HIDDEN_DEFS_STYLE}><defs>{scopePatterns(featureConfig.patterns, patternPrefix)}</defs></svg>}
          <RendererChart
              ariaDescription={ariaDescription}
              ariaLabel={ariaLabel}
              aspectRatio={ratio}
              definition={definition}
              onFocusChange={handleFocusChange}
              onRender={handleRender}
              renderer={renderer}
              renderTooltipBody={renderTooltipBody}
            />
          {overlayChildren}
        </ChoroplethZoomContext.Provider>
      </ChoroplethContext.Provider>
    </div>
  );
};

ChoroplethChart.displayName = "ChoroplethChart";

export { ChoroplethFeatureComponent, ChoroplethGraticule, ChoroplethTooltip } from "./choropleth/carriers";
export { ChoroplethProvider, useChoropleth } from "./choropleth/context";
export { useChoroplethZoom } from "./choropleth/zoom";
export { ChoroplethChart };
export type {
  ChoroplethChartProps,
  ChoroplethContextValue,
  ChoroplethFeature,
  ChoroplethFeatureProperties,
  ChoroplethFeatureProps,
  ChoroplethGraticuleProps,
  ChoroplethTooltipData,
  ChoroplethTooltipProps,
} from "./choropleth/types";
