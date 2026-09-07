"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSanitizedId } from "./use-sanitized-id";
import { ResourceHost } from "./resource-host";
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
  ResolvedScale,
} from "@tanstack/charts";
import type { ScaleTime } from "d3-scale";
import {
  buildLinearScale,
  createChartHostStore,
  focusGroupToTooltip,
  resolveBandBinding,
} from "./chart-host-store";
import { DEFAULT_Y_AXIS_ID } from "./y-axis-id";
import { ChartChildRegistryProvider, shallowEqualChildProps, useChartChildEntries } from "./chart-child-registry";
import type { ChartChildRegistration } from "./chart-child-registry";
import { extractChildren } from "./children-extract";
import { BrushHostInputsProvider } from "./brush-host-inputs";
import { useStableList } from "./use-stable-list";
import { MarkerLayer } from "./marker-layer";
import type { ChartDatum } from "./types";
import { ChartProvider } from "./chart-context";
import { useStaticChartPreview } from "./static-chart-preview";
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
  /** Core chart inputs for optional layers; the host never reads them itself. */
  chartData?: readonly ChartDatum[];
  chartXDataKey?: string;
  chartXDomain?: readonly [Date, Date];
  className?: string;
  /** Raw TanStack escape hatch: the full definition reaches the host untouched. */
  definition: DomChartDefinition<Datum, XValue, YValue>;
  height?: number;
  /** Prefix scoping renderer-owned ids (gradients, clips) to this mount. */
  idPrefix?: string;
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
  /** Custom surface renderer. */
  renderer?: ChartRenderer<Datum, XValue, YValue>;
  /** Time-scale builder; time-axis charts supply buildTimeScale, others take the linear default. */
  buildXScale?: (resolved: ResolvedScale | undefined, range: readonly [number, number]) => ScaleTime<number, number>;
  /** R10 seam resources (patterns, radial gradients) rendered beside the chart svg. */
  resources?: ReactNode;
  style?: CSSProperties;
}

const LayerContributions = (properties: Readonly<{
  readonly tree: ReactNode;
}>): ReactNode => {
  const { tree } = properties;
  const entries = useChartChildEntries();
  const extracted = useMemo(() => extractChildren(tree, entries), [tree, entries]);
  // Every registry bump re-extracts the tree; element-stable lists keep each layer's contribution memoized, so its own registration cannot re-trigger it.
  const lines = useStableList(extracted.lines);
  const hasMarkers = lines.some((line) => line.showMarkers ?? false);
  if (!hasMarkers) {return null;}
  return <MarkerLayer lines={lines} />;
};

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
    buildXScale,
    children,
    chartData,
    chartXDataKey,
    chartXDomain,
    className,
    definition,
    height,
    initialWidth = DEFAULT_INITIAL_WIDTH,
    width: widthProp,
    idPrefix: idPrefixProp,
    resources,
    onFocusChange,
    onFocusGroupChange,
    onRender,
    renderTooltipBody,
    renderer,
    style,
  } = properties;

  const [store] = useState(createChartHostStore<Datum, XValue, YValue>);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Static docs previews (idiom 9) mount at a fixed width with no enter resize.
  const staticPreview = useStaticChartPreview();
  const fixedWidth = staticPreview ? (widthProp ?? initialWidth) : widthProp;

  // One prefix per mount scopes renderer ids and seam ids alike.
  const fallbackPrefix = useSanitizedId();
  const idPrefix = idPrefixProp ?? fallbackPrefix;

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
    const width = fixedWidth ?? scene?.width ?? initialWidth;
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
    // SAFETY: Linear default keeps the declared time-scale surface; no non-time chart reads it.
    // eslint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion -- see SAFETY above
    const xScale = buildXScale === undefined ? (buildLinearScale(xResolved, [0, innerWidth]) as unknown as ScaleTime<number, number>) : buildXScale(xResolved, [0, innerWidth]);
    const yScale = buildLinearScale(yResolved, [innerHeight, 0]);
    const yScales: Record<string, ReturnType<typeof buildLinearScale>> = {};
    yScales[DEFAULT_Y_AXIS_ID] = yScale;
    // Package-resolved band mapping for bar overlays (V1.2/G6).
    const xBand = resolveBandBinding(xResolved);
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
      xBand,
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
    buildXScale,
    containerRef,
    fallbackHeight,
    fixedWidth,
    hoverSnapshot,
    initialWidth,
    stableSnapshot,
    store,
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
        idPrefix={idPrefix}
        initialWidth={initialWidth}
        width={fixedWidth}
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
        idPrefix={idPrefix}
        initialWidth={initialWidth}
        width={fixedWidth}
        onFocusChange={onFocusChange}
        onFocusGroupChange={handleFocusGroupChange}
        onRender={handleRender}
        renderTooltipBody={renderTooltipBody}
        renderer={renderer}
        style={style}
      />
    );

  // Brush inputs for ChartBrush carriers; memoized so registry bumps never re-publish it.
  const brushHostInputs = useMemo(() => ({ data: chartData, tree: children, xDataKey: chartXDataKey, xDomain: chartXDomain }), [chartData, chartXDataKey, chartXDomain, children]);

  // Registry pass: carriers register pre-paint; the bump re-renders once.
  return (
    <ChartProvider value={value}>
      <div ref={containerRef}>
        {chartNode}
        <ResourceHost idPrefix={idPrefix} resources={resources} />
        <BrushHostInputsProvider value={brushHostInputs}>
          <ChartChildRegistryProvider>
            {children}
            <LayerContributions tree={children} />
          </ChartChildRegistryProvider>
        </BrushHostInputsProvider>
      </div>
    </ChartProvider>
  );
};

// Registry bridge (V1.2/G6): host child reading entries for the entry above.
const ChartRegistryBridge = (properties: {
  readonly onEntries: (entries: readonly ChartChildRegistration[]) => void;
}): null => {
  const entries = useChartChildEntries();
  const { onEntries } = properties;
  useEffect(() => {
    onEntries(entries);
  }, [entries, onEntries]);
  return null;
};

// Registry entries state for entries (V1.2/G6); guard keeps the memo stable.
const useRegistryEntriesState = (): readonly [
  readonly ChartChildRegistration[],
  (entries: readonly ChartChildRegistration[]) => void,
] => {
  const [entries, setEntries] = useState<readonly ChartChildRegistration[]>([]);
  const report = useCallback((next: readonly ChartChildRegistration[]): void => {
    setEntries((previous) => {
      if (previous.length !== next.length) {return next;}
      const same = previous.every((entry, index) => entry.role === next[index].role && shallowEqualChildProps(entry.props, next[index].props) && entry.contribution === next[index].contribution);
      return same ? previous : next;
    });
  }, []);
  return [entries, report];
};

export { ChartHost, ChartRegistryBridge, adoptHostWidth, useRegistryEntriesState, DEFAULT_INITIAL_WIDTH as HOST_INITIAL_WIDTH };
// Time-axis charts at the dependency cap import the builder through the host module.
export { buildTimeScale } from "./chart-host-store";
export type { ChartHostProps };
