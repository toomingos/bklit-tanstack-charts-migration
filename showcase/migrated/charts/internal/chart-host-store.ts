import { scaleBand, scaleLinear, scaleTime } from "d3-scale";
import type { ScaleBand, ScaleLinear, ScaleTime } from "d3-scale";
import type {
  ChartPoint,
  ChartRenderContext,
  ChartRendererRenderContext,
  ChartValue,
  ResolvedScale,
} from "@tanstack/charts";
import type { SetStateAction } from "react";
import type { TooltipData } from "./chart-context";
import type { ChartSelection } from "./use-chart-interaction";

// Latest package render output plus hover state, with split subscriptions.
type ChartHostRenderContext<
  Datum,
  XValue extends ChartValue,
  YValue extends ChartValue,
> =
  | ChartRenderContext<Datum, XValue, YValue>
  | ChartRendererRenderContext<Datum, XValue, YValue>;

interface ChartHostStableSnapshot<
  Datum,
  XValue extends ChartValue,
  YValue extends ChartValue,
> {
  context: ChartHostRenderContext<Datum, XValue, YValue> | null;
}

interface ChartHostHoverSnapshot<
  Datum,
  XValue extends ChartValue,
  YValue extends ChartValue,
> {
  focusGroup: readonly ChartPoint<Datum, XValue, YValue>[];
  selection: ChartSelection | null;
  tooltipOverride: TooltipData | null;
}

interface ChartHostStore<
  Datum,
  XValue extends ChartValue,
  YValue extends ChartValue,
> {
  clearSelection: () => void;
  getHoverSnapshot: () => ChartHostHoverSnapshot<Datum, XValue, YValue>;
  getStableSnapshot: () => ChartHostStableSnapshot<Datum, XValue, YValue>;
  setFocusGroup: (points: readonly ChartPoint<Datum, XValue, YValue>[]) => void;
  setRenderContext: (
    context: ChartHostRenderContext<Datum, XValue, YValue>,
  ) => void;
  setSelection: (selection: ChartSelection | null) => void;
  setTooltipOverride: (update: SetStateAction<TooltipData | null>) => void;
  subscribeHover: (listener: () => void) => () => void;
  subscribeStable: (listener: () => void) => () => void;
}

// A configured scale a ResolvedScale might carry next to its snapshot.
interface CarriedScaleSnapshot {
  copy: () => CarriedScaleSnapshot;
  domain: () => readonly ChartValue[];
  range: () => readonly number[];
}

// 0.16.0 carries no scale: configured-scale.js returns id/type/domain/map only.
const isCarriedScale = (
  candidate: unknown,
): candidate is CarriedScaleSnapshot => {
  if (typeof candidate !== "function") {
    return false;
  }
  return "copy" in candidate && "domain" in candidate && "range" in candidate;
};

const isTooltipUpdater = (
  update: SetStateAction<TooltipData | null>,
): update is (previous: TooltipData | null) => TooltipData | null =>
  typeof update === "function";

const isNumberValue = (value: ChartValue): value is number =>
  typeof value === "number";

const toTimeValue = (value: ChartValue): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (isNumberValue(value)) {
    return new Date(value);
  }
  return new Date(Date.parse(value));
};

const toNumberValue = (value: ChartValue): number => {
  if (isNumberValue(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return Number(value);
};

const toStringValue = (value: ChartValue): string =>
  value instanceof Date ? String(value.getTime()) : String(value);

const effectiveDomain = (resolved: ResolvedScale): readonly ChartValue[] => {
  if (isCarriedScale(resolved)) {
    return resolved.domain();
  }
  return resolved.domain;
};

// Range pair with a fallback per end, for carried ranges of unknown length.
const pairOrFallback = (
  values: readonly number[],
  fallback: readonly [number, number],
): readonly [number, number] => [
  values[0] ?? fallback[0],
  values[1] ?? fallback[1],
];

// Pixel range observed through map (bandwidth extends band starts to edges).
const effectiveRange = (
  resolved: ResolvedScale,
  fallback: readonly [number, number],
): readonly [number, number] => {
  if (isCarriedScale(resolved)) {
    return pairOrFallback(resolved.range(), fallback);
  }
  const domain = effectiveDomain(resolved);
  if (domain.length < 2) {
    return fallback;
  }
  const start = resolved.map(domain[0]);
  const end = resolved.map(domain.at(-1)) + resolved.bandwidth;
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return [start, end];
  }
  return fallback;
};

// Builds a real d3 time scale from the resolved domain and observed range.
const buildTimeScale = (
  resolved: ResolvedScale | undefined,
  fallbackRange: readonly [number, number],
): ScaleTime<number, number> => {
  if (resolved === undefined) {
    return scaleTime()
      .domain([new Date(0), new Date(1)])
      .range(fallbackRange);
  }
  const [first = new Date(0), second = new Date(1)] = effectiveDomain(
    resolved,
  ).map(toTimeValue);
  return scaleTime()
    .domain([first, second])
    .range(effectiveRange(resolved, fallbackRange));
};

// Builds a real d3 linear scale from the resolved domain and observed range.
const buildLinearScale = (
  resolved: ResolvedScale | undefined,
  fallbackRange: readonly [number, number],
): ScaleLinear<number, number> => {
  if (resolved === undefined) {
    return scaleLinear().domain([0, 1]).range(fallbackRange);
  }
  const [first = 0, second = 1] =
    effectiveDomain(resolved).map(toNumberValue);
  return scaleLinear()
    .domain([first, second])
    .range(effectiveRange(resolved, fallbackRange));
};

// Builds a real d3 band scale from the resolved domain and observed range.
const buildBandScale = (
  resolved: ResolvedScale | undefined,
  fallbackRange: readonly [number, number],
): ScaleBand<string> => {
  if (resolved === undefined) {
    return scaleBand().domain([]).range(fallbackRange);
  }
  return scaleBand()
    .domain(effectiveDomain(resolved).map(toStringValue))
    .range(effectiveRange(resolved, fallbackRange));
};

// Package-resolved band mapping (bar x): the domain/map/bandwidth the package
// Committed to. Overlays read this instead of rebuilding the band by hand.
interface ResolvedBandBinding {
  (value: string): number | undefined;
  readonly bandwidth: () => number;
  readonly domain: () => string[];
}

// Bands resolve with nonzero bandwidth; time/linear resolvers return 0.
const resolveBandBinding = (
  resolved: ResolvedScale | undefined,
): ResolvedBandBinding | undefined => {
  if (resolved === undefined || resolved.bandwidth <= 0) {
    return undefined;
  }
  const binding = (value: string): number | undefined => {
    const center = resolved.map(value);
    // Package band map returns the band center; the binding exposes starts.
    if (!Number.isFinite(center)) {return undefined;}
    return center - resolved.bandwidth / 2;
  };
  binding.bandwidth = (): number => resolved.bandwidth;
  binding.domain = (): string[] => resolved.domain.map(String);
  return binding;
};

// Package datum rows are objects; anything else yields an empty payload.
const isDatumRecord = (candidate: unknown): candidate is Record<string, unknown> =>
  candidate !== null && typeof candidate === "object";

// First focus point becomes the legacy tooltip payload for its mark.
const focusGroupToTooltip = (
  points: readonly ChartPoint[],
): TooltipData | null => {
  if (points.length === 0) {
    return null;
  }
  const [first] = points;
  return {
    index: first.datumIndex,
    point: isDatumRecord(first.datum) ? first.datum : {},
    x: first.x,
    yPositions: { [first.markId]: first.y },
  };
};

// Notifies one slice without touching the other.
const emit = (listeners: ReadonlySet<() => void>): void => {
  for (const notify of listeners) {
    notify();
  }
};

// One store per ChartHost; stable and hover slices notify independently.
const createChartHostStore = <
  Datum,
  XValue extends ChartValue,
  YValue extends ChartValue,
>(): ChartHostStore<Datum, XValue, YValue> => {
  let hover: ChartHostHoverSnapshot<Datum, XValue, YValue> = {
    focusGroup: [],
    selection: null,
    tooltipOverride: null,
  };
  let stable: ChartHostStableSnapshot<Datum, XValue, YValue> = {
    context: null,
  };
  const stableListeners = new Set<() => void>();
  const hoverListeners = new Set<() => void>();

  const subscribeStable = (listener: () => void): (() => void) => {
    stableListeners.add(listener);
    return (): void => {
      stableListeners.delete(listener);
    };
  };

  const subscribeHover = (listener: () => void): (() => void) => {
    hoverListeners.add(listener);
    return (): void => {
      hoverListeners.delete(listener);
    };
  };

  const getStableSnapshot = (): ChartHostStableSnapshot<
    Datum,
    XValue,
    YValue
  > => stable;

  const getHoverSnapshot = (): ChartHostHoverSnapshot<
    Datum,
    XValue,
    YValue
  > => hover;

  const setRenderContext = (
    context: ChartHostRenderContext<Datum, XValue, YValue>,
  ): void => {
    if (context === stable.context) {
      return;
    }
    stable = { context };
    emit(stableListeners);
  };

  const setFocusGroup = (
    points: readonly ChartPoint<Datum, XValue, YValue>[],
  ): void => {
    if (points === hover.focusGroup) {
      return;
    }
    hover = {
      focusGroup: points,
      selection: hover.selection,
      tooltipOverride: hover.tooltipOverride,
    };
    emit(hoverListeners);
  };

  const setTooltipOverride = (
    update: SetStateAction<TooltipData | null>,
  ): void => {
    const next = isTooltipUpdater(update)
      ? update(hover.tooltipOverride)
      : update;
    if (next === hover.tooltipOverride) {
      return;
    }
    hover = {
      focusGroup: hover.focusGroup,
      selection: hover.selection,
      tooltipOverride: next,
    };
    emit(hoverListeners);
  };

  const setSelection = (selection: ChartSelection | null): void => {
    if (selection === hover.selection) {
      return;
    }
    hover = {
      focusGroup: hover.focusGroup,
      selection,
      tooltipOverride: hover.tooltipOverride,
    };
    emit(hoverListeners);
  };

  const clearSelection = (): void => {
    setSelection(null);
  };

  return {
    clearSelection,
    getHoverSnapshot,
    getStableSnapshot,
    setFocusGroup,
    setRenderContext,
    setSelection,
    setTooltipOverride,
    subscribeHover,
    subscribeStable,
  };
};

export {
  buildBandScale,
  buildLinearScale,
  buildTimeScale,
  createChartHostStore,
  focusGroupToTooltip,
  resolveBandBinding,
};
export type {
  ChartHostHoverSnapshot,
  ChartHostRenderContext,
  ChartHostStableSnapshot,
  ChartHostStore,
  ResolvedBandBinding,
};
