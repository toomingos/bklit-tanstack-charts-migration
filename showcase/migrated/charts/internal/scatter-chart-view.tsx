import type { ReactElement, ReactNode } from "react";
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

interface BuildScatterBackgroundNodeParams {
  readonly background: ScatterSeriesSetup["background"];
  readonly idPrefix: string;
}

const buildScatterBackgroundNode = ({
  background,
  idPrefix,
}: Readonly<BuildScatterBackgroundNodeParams>): ReactNode => {
  if (!background) {return undefined;}
  return (
    <BackgroundLayer
      config={background}
      idPrefix={idPrefix}
    />
  );
};

interface BuildScatterYGradientNodesParams {
  readonly yGradientDefs: ScatterReferenceAreas["yGradientDefs"];
}

// Y gradients span the full chart height in userSpace; one def per gradient series.
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
  readonly definition: ScatterDefinitionModel["definition"];
  readonly geom: ScatterReferenceAreas["refAreaGeom"];
  readonly handleFocusGroupChange: ScatterFocusModel["handleFocusGroupChange"];
  readonly handleRender: ScatterTimingModel["handleRender"];
  readonly idPrefix: string;
  readonly parsedAspectRatio: number;
  readonly renderTooltipBody: ScatterSelectionModel["renderTooltipBody"];
  readonly renderer: ScatterChartSelection["scatterChartRenderer"];
  readonly yGradientDefs: ScatterReferenceAreas["yGradientDefs"];
}

// Seam nodes build outside the tree so no JSX sits in a prop value.
const buildScatterSeamResources = (yGradientDefs: ScatterReferenceAreas["yGradientDefs"]): ReactNode =>
  yGradientDefs.length === 0 ? undefined : <ScatterYGradientNodes yGradientDefs={yGradientDefs} />;

const buildScatterRendererNode = ({
  ariaDescription,
  ariaLabel = "Scatter chart",
  background,
  configs,
  definition,
  geom,
  handleFocusGroupChange,
  handleRender,
  idPrefix,
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
      idPrefix={idPrefix}
      renderer={renderer}
      resources={buildScatterSeamResources(yGradientDefs)}
      onFocusGroupChange={handleFocusGroupChange}
      onRender={handleRender}
      renderTooltipBody={renderTooltipBody}
    >
      {buildScatterBackgroundNode({ background, idPrefix })}
      {buildScatterRefAreaNode({ configs, geom })}
    </ChartHost>
  );
};

interface BuildScatterChartTreeParams {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly className: string | undefined;
  readonly marks: Pick<ScatterDefinitionModel, "definition">;
  readonly focus: Pick<ScatterFocusModel, "handleFocusGroupChange">;
  readonly refAreas: Pick<ScatterReferenceAreas, "containerStyle" | "parsedAspectRatio" | "refAreaChildren" | "refAreaGeom" | "yGradientDefs">;
  readonly selection: ScatterSelectionModel;
  readonly series: Pick<ScatterSeriesSetup, "background" | "containerRef" | "idPrefix">;
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
      data-slot="chart"
    >
      {marks.definition && (
        <>
          {buildScatterRendererNode({
            ariaDescription,
            ariaLabel,
            background: series.background,
            configs: refAreas.refAreaChildren,
            definition: marks.definition,
            geom: refAreas.refAreaGeom,
            handleFocusGroupChange: focus.handleFocusGroupChange,
            handleRender: timing.handleRender,
            idPrefix: series.idPrefix,
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
  ScatterYGradientNodes,
  buildScatterBackgroundNode,
  buildScatterChartTree,
  buildScatterRefAreaNode,
  buildScatterRendererNode,
};
export type {
  BuildScatterBackgroundNodeParams,
  BuildScatterChartTreeParams,
  BuildScatterRefAreaNodeParams,
  BuildScatterRendererNodeParams,
  BuildScatterYGradientNodesParams,
};
