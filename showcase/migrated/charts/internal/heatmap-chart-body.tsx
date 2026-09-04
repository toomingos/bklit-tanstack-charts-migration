import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import { HeatmapChartInner } from "./heatmap-chart-inner";
import type { HeatmapChartInnerProps } from "./heatmap-chart-inner";
import { HeatmapInteractionProvider } from "./heatmap-interaction";
import type { HeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import type { HeatmapColumnSeparatorsConfig } from "./heatmap-utils";

type HeatmapChartInnerPassthroughProps = Omit<
  HeatmapChartInnerProps,
  "containerRef" | "containerWidth" | "containerHeight" | "separatorConfig" | "children"
>;

interface HeatmapChartRoot {
  width: number;
  height: number;
  coordinator: HeatmapHoverCoordinator;
  containerStyle: CSSProperties;
  handlePointerLeave: () => void;
  separatorConfig: HeatmapColumnSeparatorsConfig | undefined;
}

interface HeatmapChartBodyProps {
  root: Readonly<HeatmapChartRoot>;
  containerRef: RefObject<HTMLDivElement | null>;
  innerProps: Readonly<HeatmapChartInnerPassthroughProps>;
  children: ReactNode;
}

const HeatmapChartBody = ({ root, containerRef, innerProps, children }: Readonly<HeatmapChartBodyProps>): ReactElement => (
  <HeatmapInteractionProvider coordinator={root.coordinator}>
    {root.width > 0 && root.height > 0 && (
      <HeatmapChartInner
        animate={innerProps.animate}
        animationDuration={innerProps.animationDuration}
        binSize={innerProps.binSize}
        colorScale={innerProps.colorScale}
        containerHeight={root.height}
        containerRef={containerRef}
        containerWidth={root.width}
        data={innerProps.data}
        enterStaggerScale={innerProps.enterStaggerScale}
        enterTransition={innerProps.enterTransition}
        gap={innerProps.gap}
        layout={innerProps.layout}
        levelColors={innerProps.levelColors}
        levelStyles={innerProps.levelStyles}
        loadingCellMaxOpacity={innerProps.loadingCellMaxOpacity}
        loadingCellRandomness={innerProps.loadingCellRandomness}
        loadingLabel={innerProps.loadingLabel}
        loadingOpacity={innerProps.loadingOpacity}
        margin={innerProps.margin}
        revealSignature={innerProps.revealSignature}
        separatorConfig={root.separatorConfig}
        showLoadingCells={innerProps.showLoadingCells}
        sizingColumnCount={innerProps.sizingColumnCount}
        status={innerProps.status}
        weekStartDay={innerProps.weekStartDay}
        xDomain={innerProps.xDomain}
      >
        {children}
      </HeatmapChartInner>
    )}
  </HeatmapInteractionProvider>
);

export { HeatmapChartBody };
export type { HeatmapChartBodyProps, HeatmapChartInnerPassthroughProps, HeatmapChartRoot };
