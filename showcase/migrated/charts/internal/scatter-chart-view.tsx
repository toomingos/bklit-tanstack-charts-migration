import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ChartHost, HOST_INITIAL_WIDTH } from "./chart-host";
import { ChartSelectionContext } from "./chart-selection";
import { useChartStable } from "./chart-context";
import { BackgroundLayer } from "./background-layer";
import { ReferenceAreaLayers } from "./reference-area-layer";
import type { ScatterDefinitionModel } from "./scatter-definition-setup";
import type { ScatterFocusModel } from "./scatter-label-fade";
import type { ScatterChartSelection, ScatterReferenceAreas, ScatterSelectionModel } from "./scatter-selection-setup";
import type { ScatterSeriesSetup } from "./scatter-series-setup";
import type { ScatterTimingModel } from "./scatter-reveal-setup";

// Hidden defs svg sits off-layout; the host reserves no space for it.
const SCATTER_DEFS_SVG_STYLE: CSSProperties = { position: "absolute" };

interface BuildScatterBackgroundNodeParams {
  readonly background: ScatterSeriesSetup["background"];
}

const buildScatterBackgroundNode = ({
  background,
}: Readonly<BuildScatterBackgroundNodeParams>): ReactNode => {
  if (!background) {return undefined;}
  return (
    <BackgroundLayer
      config={background}
    />
  );
};

interface BuildScatterCrosshairGradientNodeParams {
  readonly crosshairFade: ScatterReferenceAreas["crosshairFade"];
}

const ScatterCrosshairGradientNode = ({
  crosshairFade,
}: Readonly<BuildScatterCrosshairGradientNodeParams>): ReactNode => {
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  if (!crosshairFade) {return undefined;}
  return (
    <linearGradient
      key={crosshairFade.id}
      id={crosshairFade.id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      x2={0}
      y1={margin.top}
      y2={margin.top + plot.height}
    >
      {crosshairFade.stops.map((stop) => (
        <stop key={stop.offset} offset={stop.offset} stopColor={crosshairFade.color} stopOpacity={stop.opacity} />
      ))}
    </linearGradient>
  );
};

interface BuildScatterYGradientNodesParams {
  readonly yGradientDefs: ScatterReferenceAreas["yGradientDefs"];
}

const ScatterYGradientNodes = ({
  yGradientDefs,
}: Readonly<BuildScatterYGradientNodesParams>): ReactNode => {
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  return yGradientDefs.map((def) => (
    <linearGradient
      key={def.id}
      id={def.id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      x2={0}
      y1={margin.top + plot.height + margin.bottom}
      y2={0}
    >
      <stop offset="0%" stopColor={def.from} />
      <stop offset="100%" stopColor={def.to} />
    </linearGradient>
  ));
};

interface BuildScatterDefsSvgParams {
  readonly crosshairFade: ScatterReferenceAreas["crosshairFade"];
  readonly yGradientDefs: ScatterReferenceAreas["yGradientDefs"];
}

const ScatterDefsSvg = ({
  crosshairFade,
  yGradientDefs,
}: Readonly<BuildScatterDefsSvgParams>): ReactNode => {
  const showDefsSvg = yGradientDefs.length > 0 || crosshairFade !== undefined;
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
        <ScatterYGradientNodes yGradientDefs={yGradientDefs} />
        <ScatterCrosshairGradientNode crosshairFade={crosshairFade} />
      </defs>
    </svg>
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
  if (configs.length === 0) {return undefined;}
  return (
    <ReferenceAreaLayers
      configs={configs}
      geom={geom}
    />
  );
};

interface BuildScatterRendererNodeParams {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly background: ScatterSeriesSetup["background"];
  readonly configs: ScatterReferenceAreas["refAreaChildren"];
  readonly crosshairFade: ScatterReferenceAreas["crosshairFade"];
  readonly definition: ScatterDefinitionModel["definition"];
  readonly geom: ScatterReferenceAreas["refAreaGeom"];
  readonly handleFocusGroupChange: ScatterFocusModel["handleFocusGroupChange"];
  readonly handleRender: ScatterTimingModel["handleRender"];
  readonly parsedAspectRatio: number;
  readonly renderTooltipBody: ScatterSelectionModel["renderTooltipBody"];
  readonly renderer: ScatterChartSelection["scatterChartRenderer"];
  readonly yGradientDefs: ScatterReferenceAreas["yGradientDefs"];
}

const buildScatterRendererNode = ({
  ariaDescription,
  ariaLabel = "Scatter chart",
  background,
  configs,
  crosshairFade,
  definition,
  geom,
  handleFocusGroupChange,
  handleRender,
  parsedAspectRatio,
  renderTooltipBody,
  renderer,
  yGradientDefs,
}: Readonly<BuildScatterRendererNodeParams>): ReactNode => {
  if (definition === undefined) {return undefined;}
  return (
    <ChartHost
      ariaLabel={ariaLabel}
      ariaDescription={ariaDescription}
      aspectRatio={parsedAspectRatio}
      initialWidth={HOST_INITIAL_WIDTH}
      definition={definition}
      renderer={renderer}
      onFocusGroupChange={handleFocusGroupChange}
      onRender={handleRender}
      renderTooltipBody={renderTooltipBody}
    >
      {buildScatterBackgroundNode({ background })}
      {buildScatterRefAreaNode({ configs, geom })}
      <ScatterDefsSvg crosshairFade={crosshairFade} yGradientDefs={yGradientDefs} />
    </ChartHost>
  );
};

interface BuildScatterChartTreeParams {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly className: string | undefined;
  readonly marks: Pick<ScatterDefinitionModel, "definition">;
  readonly focus: Pick<ScatterFocusModel, "handleFocusGroupChange">;
  readonly refAreas: Pick<ScatterReferenceAreas, "containerStyle" | "crosshairFade" | "parsedAspectRatio" | "refAreaChildren" | "refAreaGeom" | "yGradientDefs">;
  readonly selection: ScatterSelectionModel;
  readonly series: Pick<ScatterSeriesSetup, "background" | "containerRef">;
  readonly timing: Pick<ScatterTimingModel, "handleRender">;
}

const buildScatterChartTree = ({
  ariaDescription,
  ariaLabel,
  className,
  marks,
  focus,
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
      {marks.definition && (
        <>
          {buildScatterRendererNode({
            ariaDescription,
            ariaLabel,
            background: series.background,
            configs: refAreas.refAreaChildren,
            crosshairFade: refAreas.crosshairFade,
            definition: marks.definition,
            geom: refAreas.refAreaGeom,
            handleFocusGroupChange: focus.handleFocusGroupChange,
            handleRender: timing.handleRender,
            parsedAspectRatio: refAreas.parsedAspectRatio,
            renderTooltipBody: selection.renderTooltipBody,
            renderer: selection.scatterChartRenderer,
            yGradientDefs: refAreas.yGradientDefs,
          })}
        </>
      )}
    </div>
  </ChartSelectionContext.Provider>
);

export {
  ScatterCrosshairGradientNode,
  ScatterDefsSvg,
  ScatterYGradientNodes,
  buildScatterBackgroundNode,
  buildScatterChartTree,
  buildScatterRefAreaNode,
  buildScatterRendererNode,
};
export type {
  BuildScatterBackgroundNodeParams,
  BuildScatterChartTreeParams,
  BuildScatterCrosshairGradientNodeParams,
  BuildScatterDefsSvgParams,
  BuildScatterRefAreaNodeParams,
  BuildScatterRendererNodeParams,
  BuildScatterYGradientNodesParams,
};
