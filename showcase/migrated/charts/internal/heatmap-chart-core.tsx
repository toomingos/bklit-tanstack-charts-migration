import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import type { HeatmapMargin, HeatmapLayout } from "./heatmap-context";
import { HeatmapChartBody } from "./heatmap-chart-body";
import type { HeatmapChartInnerPassthroughProps, HeatmapChartRoot } from "./heatmap-chart-body";
import type { HeatmapChartInnerProps } from "./heatmap-chart-inner";
import { createHeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import { flattenChartChildren, hasChildrenProp, isHeatmapSeparatorChild } from "./heatmap-children";
import { HEATMAP_DEFAULT_ENTER_DURATION_MS, HEATMAP_DEFAULT_ENTER_TRANSITION, HEATMAP_LOADING_CHART_OPACITY, HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY, HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS } from "./heatmap-animation";
import type { HeatmapEnterTransition } from "./heatmap-animation";
import type { HeatmapColumn, HeatmapColumnSeparatorsConfig, HeatmapWeekStartDay } from "./heatmap-utils";
import type { HeatmapLevelColors, HeatmapLevelStyles } from "./heatmap-colors";
import { HOST_INITIAL_WIDTH } from "./chart-host";

/*
 * Extracted from heatmap-chart.tsx into internal/ so heatmap-chart-loading stays cycle-free; public API unchanged.
 */

const DEFAULT_CHART_STATUS: HeatmapChartInnerProps["status"] = "ready";
const DEFAULT_HEATMAP_MIN_HEIGHT_PX = 160;
// Server height before the container reports (matches the min-height style fallback).
const HEATMAP_HOST_INITIAL_HEIGHT = DEFAULT_HEATMAP_MIN_HEIGHT_PX;
// Resize noise below this never relays out the bins.
const HEATMAP_RESIZE_EPSILON_PX = 0.5;

// SSR/first paint uses the host initial size; the browser adopts the measured size.
// Host onRender threading needs the body/context files (V1.2).
const useHeatmapLiveSize = (
  containerRef: RefObject<HTMLDivElement | null>,
): { height: number; width: number } => {
  const [liveSize, setLiveSize] = useState({ height: HEATMAP_HOST_INITIAL_HEIGHT, width: HOST_INITIAL_WIDTH });
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {return undefined;}
    const adopt = (next: { height: number; width: number }): void => {
      if (!(next.width > 0 && next.height > 0)) {return;}
      setLiveSize((prev) => (Math.abs(prev.width - next.width) > HEATMAP_RESIZE_EPSILON_PX || Math.abs(prev.height - next.height) > HEATMAP_RESIZE_EPSILON_PX ? next : prev));
    };
    const rect = el.getBoundingClientRect();
    adopt({ height: rect.height, width: rect.width });
    const observer = new ResizeObserver((entries) => {
      const entryRect = entries.at(0)?.contentRect;
      if (!entryRect) {return;}
      adopt({ height: entryRect.height, width: entryRect.width });
    });
    observer.observe(el);
    return (): void => {observer.disconnect();};
  }, [containerRef]);
  return liveSize;
};

interface HeatmapChartProps {
  readonly data: HeatmapColumn[];
  readonly xDomain?: [Date, Date];
  readonly sizingColumnCount?: number;
  readonly layout?: HeatmapLayout;
  readonly margin?: Readonly<Partial<HeatmapMargin>>;
  readonly binSize?: number;
  readonly gap?: number;
  readonly colorScale?: (count: number) => string;
  readonly levelColors?: HeatmapLevelColors;
  readonly levelStyles?: HeatmapLevelStyles;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly status?: HeatmapChartInnerProps["status"];
  readonly loadingLabel?: string;
  readonly animationDuration?: number;
  readonly enterTransition?: HeatmapEnterTransition;
  readonly revealSignature?: string;
  readonly enterStaggerScale?: number;
  readonly animate?: boolean;
  readonly loadingOpacity?: number;
  readonly showLoadingCells?: boolean;
  readonly loadingCellMaxOpacity?: number;
  readonly loadingCellRandomness?: number;
  readonly columnSeparators?: Readonly<HeatmapColumnSeparatorsConfig>;
  readonly weekStartDay?: HeatmapWeekStartDay;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const elementHasChildrenProp = (child: Readonly<ReactElement>): child is ReactElement<{ children?: ReactNode }> =>
  hasChildrenProp(child.props);

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

interface HeatmapChartRootInputs {
  readonly aspectRatio: string | undefined;
  readonly columnSeparators: Readonly<HeatmapColumnSeparatorsConfig> | undefined;
  readonly children: ReactNode;
}

/*
 * ContainerRef stays a separate parameter so the returned root never carries a ref field.
 */
const useHeatmapChartRoot = (
  containerRef: RefObject<HTMLDivElement | null>,
  inputs: Readonly<HeatmapChartRootInputs>,
): HeatmapChartRoot => {
  const sz = useHeatmapLiveSize(containerRef);

  /*
   * Stable coordinator without render-time ref access; an effect would leave the first render unwired.
   */
  const coordinator = useMemo(() => createHeatmapHoverCoordinator(), []);

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
    ariaDescription,
    ariaLabel,
  } = props;
  return {
    animate,
    animationDuration,
    ariaDescription,
    ariaLabel,
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
