import type { CSSProperties, ReactElement, ReactNode } from "react";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import { ChartSelectionContext } from "./chart-selection";
import { BackgroundLayer } from "./background-layer";
import { ReferenceAreaLayers } from "./reference-area-layer";
import type { ScatterDefinitionModel } from "./scatter-definition-setup";
import type { ScatterPillModel } from "./scatter-pill-setup";
import type { ScatterChartSelection, ScatterReferenceAreas, ScatterSelectionModel } from "./scatter-selection-setup";
import type { ScatterSeriesSetup } from "./scatter-series-setup";
import type { ScatterTimingModel } from "./scatter-reveal-setup";

// Hidden defs svg sits off-layout; the host reserves no space for it.
const SCATTER_DEFS_SVG_STYLE: CSSProperties = { position: "absolute" };
// Selection overlay covers the plot without intercepting pointer input.
const SCATTER_OVERLAY_HOST_STYLE: CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };

interface BuildScatterBackgroundNodeParams {
  readonly background: ScatterSeriesSetup["background"];
  readonly refAreaGeom: ScatterReferenceAreas["refAreaGeom"];
}

const buildScatterBackgroundNode = ({
  background,
  refAreaGeom,
}: Readonly<BuildScatterBackgroundNodeParams>): ReactNode => {
  if (!background) {return undefined;}
  return (
    <BackgroundLayer
      config={background}
      innerWidth={Math.max(0, refAreaGeom.width - refAreaGeom.margin.left - refAreaGeom.margin.right)}
      innerHeight={Math.max(0, refAreaGeom.height - refAreaGeom.margin.top - refAreaGeom.margin.bottom)}
      marginLeft={refAreaGeom.margin.left}
      marginTop={refAreaGeom.margin.top}
    />
  );
};

interface BuildScatterCrosshairGradientNodeParams {
  readonly crosshairFade: ScatterReferenceAreas["crosshairFade"];
  readonly refAreaGeom: ScatterReferenceAreas["refAreaGeom"];
}

const buildScatterCrosshairGradientNode = ({
  crosshairFade,
  refAreaGeom,
}: Readonly<BuildScatterCrosshairGradientNodeParams>): ReactNode => {
  if (!crosshairFade) {return undefined;}
  return (
    <linearGradient
      key={crosshairFade.id}
      id={crosshairFade.id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      x2={0}
      y1={refAreaGeom.margin.top}
      y2={refAreaGeom.margin.top + Math.max(0, refAreaGeom.height - refAreaGeom.margin.top - refAreaGeom.margin.bottom)}
    >
      {crosshairFade.stops.map((stop) => (
        <stop key={stop.offset} offset={stop.offset} stopColor={crosshairFade.color} stopOpacity={stop.opacity} />
      ))}
    </linearGradient>
  );
};

const buildScatterRadialGradientNodes = (
  gradientDefs: ScatterSeriesSetup["gradientDefs"],
): ReactNode => gradientDefs.map((def) => (
  <radialGradient key={def.id} id={def.id}>
    <stop offset="0%" stopColor={def.fill} stopOpacity={1} />
    <stop
      offset={`${def.fillFadeStart}%`}
      stopColor={def.fill}
      stopOpacity={1}
    />
    <stop
      offset={`${def.fillFadeEnd}%`}
      stopColor={def.fill}
      stopOpacity={0}
    />
    <stop
      offset={`${def.gapFadeStart}%`}
      stopColor={def.stroke}
      stopOpacity={0}
    />
    <stop
      offset={`${def.gapFadeEnd}%`}
      stopColor={def.stroke}
      stopOpacity={1}
    />
    <stop offset="100%" stopColor={def.stroke} stopOpacity={1} />
  </radialGradient>
));

interface BuildScatterYGradientNodesParams {
  readonly refAreaGeom: ScatterReferenceAreas["refAreaGeom"];
  readonly yGradientDefs: ScatterReferenceAreas["yGradientDefs"];
}

const buildScatterYGradientNodes = ({
  refAreaGeom,
  yGradientDefs,
}: Readonly<BuildScatterYGradientNodesParams>): ReactNode => yGradientDefs.map((def) => (
  <linearGradient
    key={def.id}
    id={def.id}
    gradientUnits="userSpaceOnUse"
    x1={0}
    x2={0}
    y1={refAreaGeom.height}
    y2={0}
  >
    <stop offset="0%" stopColor={def.from} />
    <stop offset="100%" stopColor={def.to} />
  </linearGradient>
));

interface BuildScatterDefsSvgParams {
  readonly crosshairFade: ScatterReferenceAreas["crosshairFade"];
  readonly gradientDefs: ScatterSeriesSetup["gradientDefs"];
  readonly refAreaGeom: ScatterReferenceAreas["refAreaGeom"];
  readonly yGradientDefs: ScatterReferenceAreas["yGradientDefs"];
}

const buildScatterDefsSvg = ({
  crosshairFade,
  gradientDefs,
  refAreaGeom,
  yGradientDefs,
}: Readonly<BuildScatterDefsSvgParams>): ReactNode => {
  const showDefsSvg = gradientDefs.length > 0 || yGradientDefs.length > 0 || crosshairFade !== undefined;
  if (!showDefsSvg) {return undefined;}
  return (
    // Defs svg renders AFTER the chart: the harness locates charts via #chart-root svg.first().
    <svg
      width={0}
      height={0}
      style={SCATTER_DEFS_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {buildScatterRadialGradientNodes(gradientDefs)}
        {buildScatterYGradientNodes({ refAreaGeom, yGradientDefs })}
        {buildScatterCrosshairGradientNode({ crosshairFade, refAreaGeom })}
      </defs>
    </svg>
  );
};

interface BuildScatterRendererNodeParams {
  readonly definition: ScatterDefinitionModel["definition"];
  readonly handleFocusGroupChange: ScatterPillModel["handleFocusGroupChange"];
  readonly handleRender: ScatterTimingModel["handleRender"];
  readonly parsedAspectRatio: number;
  readonly renderTooltipBody: ScatterSelectionModel["renderTooltipBody"];
  readonly renderer: ScatterChartSelection["scatterChartRenderer"];
}

const buildScatterRendererNode = ({
  definition,
  handleFocusGroupChange,
  handleRender,
  parsedAspectRatio,
  renderTooltipBody,
  renderer,
}: Readonly<BuildScatterRendererNodeParams>): ReactNode => {
  if (definition === undefined) {return undefined;}
  return (
    <RendererChart
      ariaLabel="Scatter chart"
      aspectRatio={parsedAspectRatio}
      definition={definition}
      renderer={renderer}
      onFocusGroupChange={handleFocusGroupChange}
      onRender={handleRender}
      renderTooltipBody={renderTooltipBody}
    />
  );
};

interface BuildScatterRefAreaNodeParams {
  readonly configs: ScatterReferenceAreas["refAreaChildren"];
  readonly geom: ScatterReferenceAreas["refAreaGeom"];
}

const buildScatterRefAreaNode = ({
  configs,
  geom,
}: Readonly<BuildScatterRefAreaNodeParams>): ReactNode => {
  if (geom.height <= 0) {return undefined;}
  return (
    <ReferenceAreaLayers
      configs={configs}
      geom={geom}
    />
  );
};

interface BuildScatterOverlayNodeParams {
  readonly hostRef: ScatterPillModel["overlayHostRef"];
  readonly tooltipEnabled: ScatterSelectionModel["tooltipEnabled"];
}

const buildScatterOverlayNode = ({
  hostRef,
  tooltipEnabled,
}: Readonly<BuildScatterOverlayNodeParams>): ReactNode => {
  if (!tooltipEnabled) {return undefined;}
  return (
    <div
      ref={hostRef}
      style={SCATTER_OVERLAY_HOST_STYLE}
    />
  );
};

interface BuildScatterChartTreeParams {
  readonly className: string | undefined;
  readonly marks: Pick<ScatterDefinitionModel, "definition">;
  readonly pill: Pick<ScatterPillModel, "handleFocusGroupChange" | "overlayHostRef">;
  readonly refAreas: Pick<ScatterReferenceAreas, "containerStyle" | "crosshairFade" | "parsedAspectRatio" | "refAreaChildren" | "refAreaGeom" | "yGradientDefs">;
  readonly selection: ScatterSelectionModel;
  readonly series: Pick<ScatterSeriesSetup, "background" | "containerRef" | "gradientDefs">;
  readonly timing: Pick<ScatterTimingModel, "handleRender">;
}

const buildScatterChartTree = ({
  className,
  marks,
  pill,
  refAreas,
  selection,
  series,
  timing,
}: Readonly<BuildScatterChartTreeParams>): ReactElement => (
  <ChartSelectionContext.Provider value={selection.scatterSelection}>
    <div
      ref={series.containerRef}
      className={className}
      style={refAreas.containerStyle}
      data-bkm-chart="scatter"
    >
      {buildScatterBackgroundNode({ background: series.background, refAreaGeom: refAreas.refAreaGeom })}
      {marks.definition && (
        <>
          {buildScatterRendererNode({
            definition: marks.definition,
            handleFocusGroupChange: pill.handleFocusGroupChange,
            handleRender: timing.handleRender,
            parsedAspectRatio: refAreas.parsedAspectRatio,
            renderTooltipBody: selection.renderTooltipBody,
            renderer: selection.scatterChartRenderer,
          })}
          {buildScatterDefsSvg({
            crosshairFade: refAreas.crosshairFade,
            gradientDefs: series.gradientDefs,
            refAreaGeom: refAreas.refAreaGeom,
            yGradientDefs: refAreas.yGradientDefs,
          })}
          {buildScatterRefAreaNode({ configs: refAreas.refAreaChildren, geom: refAreas.refAreaGeom })}
          {buildScatterOverlayNode({ hostRef: pill.overlayHostRef, tooltipEnabled: selection.tooltipEnabled })}
        </>
      )}
    </div>
  </ChartSelectionContext.Provider>
);

export {
  buildScatterBackgroundNode,
  buildScatterChartTree,
  buildScatterCrosshairGradientNode,
  buildScatterDefsSvg,
  buildScatterOverlayNode,
  buildScatterRadialGradientNodes,
  buildScatterRefAreaNode,
  buildScatterRendererNode,
  buildScatterYGradientNodes,
};
export type {
  BuildScatterBackgroundNodeParams,
  BuildScatterChartTreeParams,
  BuildScatterCrosshairGradientNodeParams,
  BuildScatterDefsSvgParams,
  BuildScatterOverlayNodeParams,
  BuildScatterRefAreaNodeParams,
  BuildScatterRendererNodeParams,
  BuildScatterYGradientNodesParams,
};
