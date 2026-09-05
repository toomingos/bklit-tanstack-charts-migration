"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, Dispatch, ReactElement, ReactNode, SetStateAction } from "react";
import { Chart, RendererChart as TooltipRendererChart } from "@tanstack/react-charts/tooltip";
import type {
  ChartTooltipBodyRenderContext,
} from "@tanstack/react-charts/tooltip";
import type {
  ChartPoint,
  ChartRenderContext,
  ChartRenderer,
  ChartRendererRenderContext,
  ChartBounds,
  ChartValue,
  DomChartDefinition,
} from "@tanstack/charts";
import {
  buildLinearScale,
  buildTimeScale,
  createChartHostStore,
  focusGroupToTooltip,
} from "./chart-host-store";
import { DEFAULT_Y_AXIS_ID } from "./y-axis-id";
import { ChartChildRegistryProvider } from "./chart-child-registry";
import { ChartProvider } from "./chart-context";
import type {
  ChartContextValue,
  LineConfig,
  Margin,
  ReferenceAreaConfig,
  TooltipData,
} from "./chart-context";
import type { YDomain } from "./y-domain";

// Server/initial scene size before the host reports its first render.
const DEFAULT_INITIAL_WIDTH = 640;
const DEFAULT_FALLBACK_HEIGHT = 320;
// Resize noise below this never rebuilds an entry definition.
const HOST_WIDTH_EPSILON_PX = 0.5;

// Adopts the host-measured width into entry state; no-ops on missing or non-finite widths.
const adoptHostWidth = (setWidth: Dispatch<SetStateAction<number>>, sceneWidth: number | undefined): void => {
  if (sceneWidth === undefined || !Number.isFinite(sceneWidth)) {return;}
  const next: number = sceneWidth;
  setWidth((prev) => (Math.abs(prev - next) > HOST_WIDTH_EPSILON_PX ? next : prev));
};

// Stable empty slots: shared refs keep the stable slice identical on hover.
const EMPTY_DATA: Record<string, unknown>[] = [];
const EMPTY_DATE_LABELS: string[] = [];
const EMPTY_DOMAINS: Record<string, YDomain> = {};
const EMPTY_LINES: LineConfig[] = [];
const EMPTY_REFERENCE_AREAS: ReferenceAreaConfig[] = [];

// Default x reader until translators supply the series accessor (V1.2).
const defaultXAccessor = (): Date => new Date(0);

interface ChartHostProps<
  Datum = unknown,
  XValue extends ChartValue = ChartValue,
  YValue extends ChartValue = ChartValue,
> {
  ariaDescription?: string;
  ariaLabel: string;
  aspectRatio?: number;
  children?: ReactNode;
  className?: string;
  /** Raw TanStack escape hatch: the full definition reaches the host untouched. */
  definition: DomChartDefinition<Datum, XValue, YValue>;
  height?: number;
  initialWidth?: number;
  /** Fixed scene width. Supplying it disables resize observation (fixed-size families only). */
  width?: number;
  onFocusChange?: (
    point: ChartPoint<Datum, XValue, YValue> | null,
  ) => void;
  onFocusGroupChange?: (
    points: readonly ChartPoint<Datum, XValue, YValue>[],
  ) => void;
  /** Raw TanStack escape hatch: reads the live scene, scales and interaction. */
  onRender?: (
    context:
      | ChartRenderContext<Datum, XValue, YValue>
      | ChartRendererRenderContext<Datum, XValue, YValue>,
  ) => void;
  /** Raw TanStack escape hatch: React body inside the built-in tooltip. */
  renderTooltipBody?: (
    context: ChartTooltipBodyRenderContext<Datum, XValue, YValue>,
  ) => ReactNode;
  /** Custom surface renderer; mounts the `/core` entry until V3.5. */
  renderer?: ChartRenderer<Datum, XValue, YValue>;
  style?: CSSProperties;
}

// Host mount: measures, reconciles and interacts; overlays read the store.
const ChartHost = <
  Datum = unknown,
  XValue extends ChartValue = ChartValue,
  YValue extends ChartValue = ChartValue,
>(
  properties: Readonly<ChartHostProps<Datum, XValue, YValue>>,
): ReactElement => {
  const {
    ariaDescription,
    ariaLabel,
    aspectRatio,
    children,
    className,
    definition,
    height,
    initialWidth = DEFAULT_INITIAL_WIDTH,
    width: widthProp,
    onFocusChange,
    onFocusGroupChange,
    onRender,
    renderTooltipBody,
    renderer,
    style,
  } = properties;

  const [store] = useState(createChartHostStore<Datum, XValue, YValue>);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleRender = useCallback(
    (
      context: Parameters<typeof store.setRenderContext>[0],
    ): void => {
      store.setRenderContext(context);
      if (onRender !== undefined) {
        onRender(context);
      }
    },
    [onRender, store],
  );

  const handleFocusGroupChange = useCallback(
    (points: readonly ChartPoint<Datum, XValue, YValue>[]): void => {
      store.setFocusGroup(points);
      if (onFocusGroupChange !== undefined) {
        onFocusGroupChange(points);
      }
    },
    [onFocusGroupChange, store],
  );

  // The server snapshot reuses the cached getter for hydration agreement.
  const stableSnapshot = useSyncExternalStore(
    store.subscribeStable,
    store.getStableSnapshot,
    store.getStableSnapshot,
  );
  const hoverSnapshot = useSyncExternalStore(
    store.subscribeHover,
    store.getHoverSnapshot,
    store.getHoverSnapshot,
  );

  const fallbackHeight = height ?? DEFAULT_FALLBACK_HEIGHT;

  const value = useMemo((): ChartContextValue => {
    const scene = stableSnapshot.context?.scene;
    const scales = scene?.scales;
    const resolved = scales === undefined ? [] : Object.values(scales);
    const [firstScale, secondScale] = resolved;
    const xResolved = scales?.x ?? firstScale;
    const yResolved = scales?.y ?? secondScale;
    const width = widthProp ?? scene?.width ?? initialWidth;
    const plotHeight = scene?.height ?? fallbackHeight;
    const margin: Margin = scene?.margin ?? {
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    };
    const innerWidth = Math.max(0, width - margin.left - margin.right);
    const innerHeight = Math.max(0, plotHeight - margin.top - margin.bottom);
    // Plot rect from the live scene; chrome reads it instead of measuring (V1.7).
    const chart: ChartBounds = scene?.chart ?? {
      height: innerHeight,
      width: innerWidth,
      x: margin.left,
      y: margin.top,
    };
    const xScale = buildTimeScale(xResolved, [0, innerWidth]);
    const yScale = buildLinearScale(yResolved, [innerHeight, 0]);
    const yScales: Record<string, ReturnType<typeof buildLinearScale>> = {};
    yScales[DEFAULT_Y_AXIS_ID] = yScale;
    const tooltip: TooltipData | null =
      hoverSnapshot.tooltipOverride ??
      focusGroupToTooltip(hoverSnapshot.focusGroup);
    return {
      animationDuration: 0,
      animationEasing: undefined,
      bandWidth: undefined,
      barScale: undefined,
      barXAccessor: undefined,
      chart,
      chartPhase: "ready",
      chartStatus: "ready",
      clearSelection: store.clearSelection,
      columnWidth: innerWidth,
      composedBarDataKeys: undefined,
      composedBarGap: undefined,
      composedBarSize: undefined,
      composedMaxBarSize: undefined,
      composedStackGap: undefined,
      composedStackOffsets: undefined,
      composedStacked: undefined,
      containerRef,
      data: EMPTY_DATA,
      dateLabels: EMPTY_DATE_LABELS,
      enterTransition: undefined,
      height: plotHeight,
      hoveredBarIndex: undefined,
      hoveredCandleIndex: undefined,
      innerHeight,
      innerWidth,
      isLoaded: true,
      lines: EMPTY_LINES,
      loadingLabel: undefined,
      margin,
      notifyLoadingPulseComplete: undefined,
      orientation: undefined,
      referenceAreas: EMPTY_REFERENCE_AREAS,
      renderData: EMPTY_DATA,
      revealEpoch: undefined,
      selection: hoverSnapshot.selection ?? null,
      setHoveredBarIndex: undefined,
      setHoveredCandleIndex: undefined,
      setTooltipData: store.setTooltipOverride,
      squareSnap: undefined,
      stackOffsets: undefined,
      stacked: undefined,
      tooltipData: tooltip,
      width,
      xAccessor: defaultXAccessor,
      xDomain: undefined,
      xDomainSlotCount: undefined,
      xScale,
      yDomainSkeletonByAxis: EMPTY_DOMAINS,
      yDomainTargetByAxis: EMPTY_DOMAINS,
      yDomainTweenDuration: 0,
      yScale,
      yScales,
    };
  }, [
    containerRef,
    fallbackHeight,
    hoverSnapshot,
    initialWidth,
    stableSnapshot,
    store,
    widthProp,
  ]);

  // Custom renderer mounts through the tooltip entry so renderTooltipBody keeps working.
  const chartNode =
    renderer === undefined ? (
      <Chart
        ariaDescription={ariaDescription}
        ariaLabel={ariaLabel}
        aspectRatio={aspectRatio}
        className={className}
        definition={definition}
        height={height}
        initialWidth={initialWidth}
        width={widthProp}
        onFocusChange={onFocusChange}
        onFocusGroupChange={handleFocusGroupChange}
        onRender={handleRender}
        renderTooltipBody={renderTooltipBody}
        style={style}
      />
    ) : (
      <TooltipRendererChart
        ariaDescription={ariaDescription}
        ariaLabel={ariaLabel}
        aspectRatio={aspectRatio}
        className={className}
        definition={definition}
        height={height}
        initialWidth={initialWidth}
        width={widthProp}
        onFocusChange={onFocusChange}
        onFocusGroupChange={handleFocusGroupChange}
        onRender={handleRender}
        renderTooltipBody={renderTooltipBody}
        renderer={renderer}
        style={style}
      />
    );

  // Registry pass: carriers register pre-paint; the bump re-renders once.
  return (
    <ChartProvider value={value}>
      <div ref={containerRef}>
        {chartNode}
        <ChartChildRegistryProvider>{children}</ChartChildRegistryProvider>
      </div>
    </ChartProvider>
  );
};

export { ChartHost, adoptHostWidth, DEFAULT_INITIAL_WIDTH as HOST_INITIAL_WIDTH };
export type { ChartHostProps };
