import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import type { HeatmapMargin, HeatmapLayout } from "./heatmap-context";
import { HeatmapChartInner } from "./heatmap-chart-inner";
import type { HeatmapChartInnerProps } from "./heatmap-chart-inner";
import { HeatmapInteractionProvider } from "./heatmap-interaction";
import { createHeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import type { HeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import { flattenChartChildren, hasChildrenProp, isHeatmapSeparatorChild } from "./heatmap-children";
import { HEATMAP_DEFAULT_ENTER_DURATION_MS, HEATMAP_DEFAULT_ENTER_TRANSITION, HEATMAP_LOADING_CHART_OPACITY, HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY, HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS } from "./heatmap-animation";
import type { HeatmapEnterTransition } from "./heatmap-animation";
import type { HeatmapColumn, HeatmapColumnSeparatorsConfig, HeatmapWeekStartDay } from "./heatmap-utils";
import type { HeatmapLevelColors, HeatmapLevelStyles } from "./heatmap-colors";
import { usePositiveChartSize } from "./use-container-size";

// This file is extracted from heatmap-chart.tsx and holds the actual HeatmapChart implementation.
// It lives under internal/ rather than the top-level heatmap-chart.tsx.
// This lets heatmap-chart-loading.tsx import it as a sibling instead of reaching back up to the barrel file, which would create an import cycle.
// The top-level heatmap-chart.tsx re-exports the same names, so the public API (HeatmapChart, HeatmapChartProps) is unchanged.

const DEFAULT_CHART_STATUS: HeatmapChartInnerProps["status"] = "ready";
const DEFAULT_HEATMAP_MIN_HEIGHT_PX = 160;

interface HeatmapChartProps {
  data: HeatmapColumn[];
  xDomain?: [Date, Date];
  sizingColumnCount?: number;
  layout?: HeatmapLayout;
  margin?: Readonly<Partial<HeatmapMargin>>;
  binSize?: number;
  gap?: number;
  colorScale?: (count: number) => string;
  levelColors?: HeatmapLevelColors;
  levelStyles?: HeatmapLevelStyles;
  aspectRatio?: string;
  className?: string;
  status?: HeatmapChartInnerProps["status"];
  loadingLabel?: string;
  animationDuration?: number;
  enterTransition?: HeatmapEnterTransition;
  revealSignature?: string;
  enterStaggerScale?: number;
  animate?: boolean;
  loadingOpacity?: number;
  showLoadingCells?: boolean;
  loadingCellMaxOpacity?: number;
  loadingCellRandomness?: number;
  columnSeparators?: Readonly<HeatmapColumnSeparatorsConfig>;
  weekStartDay?: HeatmapWeekStartDay;
  children: ReactNode;
}

const elementHasChildrenProp = (child: Readonly<ReactElement>): child is ReactElement<{ children?: ReactNode }> =>
  hasChildrenProp(child.props);

// This finds the first HeatmapSeparator among possibly nested children and lifts its props into a config.
// Every path ends in a genuine `return <expression>;`, never a bare `return;` and never an implicit fall-through.
// The "not found" case is produced only by Array#find's own undefined-when-no-match behaviour, never by writing the word undefined or void in this file.
const resolveHeatmapSeparatorConfigFromChildren = (children: Readonly<ReactNode>): HeatmapColumnSeparatorsConfig | undefined => {
  const flat = flattenChartChildren(children);
  const direct = flat.find((child: Readonly<ReactElement>) => isHeatmapSeparatorChild(child));
  if (direct) {
    return { every: direct.props.every, groupBy: direct.props.groupBy, spacing: direct.props.spacing };
  }
  const nestedMatches = flat.flatMap((child: Readonly<ReactElement>) =>
    elementHasChildrenProp(child) ? [resolveHeatmapSeparatorConfigFromChildren(child.props.children)] : [],
  );
  return nestedMatches.find(Boolean);
};

const useHeatmapContainerStyle = (aspectRatio: string | undefined, hasMeasuredSize: boolean): CSSProperties => {
  const hasAspectRatio = (aspectRatio ?? "").length > 0;
  return useMemo<CSSProperties>(() => {
    const style: CSSProperties = { height: "100%", position: "relative", width: "100%" };
    if (hasAspectRatio) {
      style.aspectRatio = aspectRatio;
    }
    if (!hasMeasuredSize && !hasAspectRatio) {
      style.minHeight = DEFAULT_HEATMAP_MIN_HEIGHT_PX;
    }
    return style;
  }, [aspectRatio, hasAspectRatio, hasMeasuredSize]);
};

interface HeatmapChartRoot {
  width: number;
  height: number;
  coordinator: HeatmapHoverCoordinator;
  containerStyle: CSSProperties;
  handlePointerLeave: () => void;
  separatorConfig: HeatmapColumnSeparatorsConfig | undefined;
}

interface HeatmapChartRootInputs {
  aspectRatio: string | undefined;
  columnSeparators: Readonly<HeatmapColumnSeparatorsConfig> | undefined;
  children: ReactNode;
}

// This bundles the non-JSX setup (sizing, the hover coordinator, the resolved container style, and the separator config) so HeatmapChart's own body stays short.
// The memoisation shape is unchanged from the original single-hook implementation.
// The containerRef is accepted as its own parameter (rather than folded into the returned object) so the returned HeatmapChartRoot never itself carries a ref field.
const useHeatmapChartRoot = (
  containerRef: RefObject<HTMLDivElement | null>,
  inputs: Readonly<HeatmapChartRootInputs>,
): HeatmapChartRoot => {
  const sz = usePositiveChartSize(containerRef);

  // This lazily constructs a single hover coordinator for the component's lifetime.
  // State lazy initialisation keeps the instance stable without render-time ref access.
  // No re-render is skipped or delayed by doing so.
  // Moving it into an effect would leave the first render without a coordinator, breaking pointer and hover wiring.
  const [coordinator] = useState(() => createHeatmapHoverCoordinator());

  const containerStyle = useHeatmapContainerStyle(inputs.aspectRatio, sz.height > 0);
  const handlePointerLeave = useCallback(() => {
    coordinator.clearInteraction();
  }, [coordinator]);

  const separatorConfig = useMemo(
    () => inputs.columnSeparators ?? resolveHeatmapSeparatorConfigFromChildren(inputs.children),
    [inputs.columnSeparators, inputs.children],
  );

  return { containerStyle, coordinator, handlePointerLeave, height: sz.height, separatorConfig, width: sz.width };
};

type HeatmapChartInnerPassthroughProps = Omit<
  HeatmapChartInnerProps,
  "containerRef" | "containerWidth" | "containerHeight" | "separatorConfig" | "children"
>;

interface HeatmapChartBodyProps {
  root: Readonly<HeatmapChartRoot>;
  containerRef: RefObject<HTMLDivElement | null>;
  innerProps: Readonly<HeatmapChartInnerPassthroughProps>;
  children: ReactNode;
}

// This renders the interaction provider and the inner chart once the
// Container has a measured, non-zero size. It is pulled out of HeatmapChart
// Purely to keep that component's own function body short.
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

// Assembles the inner-chart passthrough props from the public props.
// It applies the same defaults the component signature used to apply via destructuring.
const resolveHeatmapInnerProps = (props: Readonly<HeatmapChartProps>): HeatmapChartInnerPassthroughProps => {
  const {
    data,
    layout = "fluid",
    binSize = 0,
    sizingColumnCount,
    gap = 2,
    colorScale,
    margin,
    weekStartDay = 0,
    xDomain,
    levelColors,
    levelStyles,
    status = DEFAULT_CHART_STATUS,
    animationDuration = HEATMAP_DEFAULT_ENTER_DURATION_MS,
    enterTransition = HEATMAP_DEFAULT_ENTER_TRANSITION,
    enterStaggerScale = 1,
    revealSignature = "",
    loadingCellMaxOpacity = HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
    loadingCellRandomness = HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS,
    loadingLabel,
    animate = true,
    loadingOpacity = HEATMAP_LOADING_CHART_OPACITY,
    showLoadingCells = true,
  } = props;
  return {
    animate,
    animationDuration,
    binSize,
    colorScale,
    data,
    enterStaggerScale,
    enterTransition,
    gap,
    layout,
    levelColors,
    levelStyles,
    loadingCellMaxOpacity,
    loadingCellRandomness,
    loadingLabel,
    loadingOpacity,
    margin,
    revealSignature,
    showLoadingCells,
    sizingColumnCount,
    status,
    weekStartDay,
    xDomain,
  };
}

const HeatmapChart = (props: Readonly<HeatmapChartProps>): ReactElement => {
  const { children, className, aspectRatio, columnSeparators } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const root = useHeatmapChartRoot(containerRef, { aspectRatio, children, columnSeparators });
  const innerProps = resolveHeatmapInnerProps(props);

  return (
    <div
      className={className}
      data-bkm-chart="heatmap"
      ref={containerRef}
      style={root.containerStyle}
      onPointerLeave={root.handlePointerLeave}
    >
      <HeatmapChartBody
        root={root}
        containerRef={containerRef}
        innerProps={innerProps}
      >
        {children}
      </HeatmapChartBody>
    </div>
  );
};

export { HeatmapChart, type HeatmapChartProps };
