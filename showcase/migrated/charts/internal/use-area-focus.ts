// Area focus hook: tooltip body, label-fade choreography, focus handling.
// Hook call order is unchanged; logic moved verbatim.
import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { ChartInteractionController, ChartPoint } from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { renderSeriesTooltipBody } from "./tooltip-components";
import { isFocusOutsideXDomain } from "./focus-marks";
import { createActiveMarkersStore } from "./active-markers-store";
import { isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import { shortDateFmt, weekdayDateFmt } from "./formatters";
import type { ChartDatum, ExtractedChildren } from "./types";
import {
  firstNonEmptyString,
  isNumber,
  isString,
  stringifyDatumField,
} from "./area-chart-model";
import type { ReadonlyResolvedArea } from "./area-chart-model";
import type { AreaLabelFade } from "./area-chart-definition";
import type { AreaSeries } from "./use-area-series";

interface AreaFocusPrimaryInput {
  readonly chartPhase: ChartPhase;
  readonly dragActive: boolean;
  readonly isLoaded: boolean;
  readonly points: readonly ChartPoint<ChartDatum, Date, number>[];
  readonly xDataKey: string;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
}

interface AreaFocusPrimary {
  readonly clearStaleFocus: boolean;
  readonly primary: ChartPoint<ChartDatum, Date, number> | undefined;
}

// Picks the focused point, suppressing it while brushing, outside the x-domain, or pre-interaction.
const resolveAreaFocusPrimary = (input: Readonly<AreaFocusPrimaryInput>): AreaFocusPrimary => {
  const rawPrimary = input.points.at(0);
  const outsideXDomain =
    input.xDomain !== undefined && rawPrimary !== undefined && isFocusOutsideXDomain(rawPrimary.datum, input.xDataKey, input.xDomain);
  const phaseGated = !(isChartInteractionPhase(input.chartPhase) && input.isLoaded);
  const suppressed = outsideXDomain || input.dragActive || phaseGated;
  return {
    clearStaleFocus: suppressed && input.points.length > 0,
    primary: suppressed ? undefined : rawPrimary,
  };
};

interface AreaLabelFadeRequest {
  readonly primaryX: number;
}

interface AreaLabelFadeParams {
  readonly primary: Readonly<AreaLabelFadeRequest> | undefined;
  readonly setLabelFade: Dispatch<SetStateAction<AreaLabelFade | undefined>>;
  readonly showDatePill: boolean;
  readonly validDate: Date | undefined;
}

// The crosshair x label carries the date text now; only the axis label fade stays here.
const updateAreaLabelFade = (params: Readonly<AreaLabelFadeParams>): void => {
  const { primary, showDatePill, validDate } = params;
  if (primary && showDatePill) {
    const label = validDate ? shortDateFmt.format(validDate) : null;
    // Skip definition rebuilds when the focus point didn't change.
    params.setLabelFade((prev: Readonly<AreaLabelFade> | undefined) =>
      prev && prev.primaryX === primary.primaryX && prev.hoveredLabel === label
        ? prev
        : { hoveredLabel: label ?? undefined, primaryX: primary.primaryX },
    );
  } else {
    params.setLabelFade(undefined);
  }
};

// Focus dates arrive as Date instances or raw timestamps; anything else reads as absent.
const resolveFocusDate = (datum: Readonly<ChartDatum> | undefined, xDataKey: string): Date | undefined => {
  const rawDate = datum?.[xDataKey];
  if (rawDate instanceof Date) {return rawDate;}
  return isString(rawDate) || isNumber(rawDate) ? new Date(rawDate) : undefined;
};

// First matching point color for a mark id; absent when the series has no focused point.
const pointColorForMark = (points: readonly { readonly markId: string; readonly color?: string }[], markId: string): string | undefined =>
  points.find((point) => point.markId === markId)?.color;

interface AreaFocusParams {
  readonly chartPhase: ChartPhase;
  readonly interactionRef: RefObject<ChartInteractionController<ChartDatum, Date, number> | null>;
  readonly isDiscrete: boolean;
  readonly isLoaded: boolean;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly setHoveredIndex: AreaSeries["setHoveredIndex"];
  readonly setLabelFade: AreaSeries["setLabelFade"];
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
  readonly xDataKey: string;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
}

interface AreaFocus {
  readonly clearFocusChrome: () => void;
  readonly handleFocusChange: (points: readonly ChartPoint<ChartDatum, Date, number>[]) => void;
  readonly handleSelectionDragEnd: () => void;
  readonly handleSelectionDragStart: () => void;
  readonly markerActiveStore: ReturnType<typeof createActiveMarkersStore>;
  readonly renderTooltipBody: (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>) => ReactNode;
}

const useAreaFocus = (params: Readonly<AreaFocusParams>): AreaFocus => {
  const {
    chartPhase,
    interactionRef,
    isLoaded,
    resolvedAreas,
    setHoveredIndex,
    setLabelFade,
    tooltip,
    xDataKey,
    xDomain,
  } = params;
  const renderTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): ReactNode =>
      renderSeriesTooltipBody(ctx, {
        buildRows: (datum, rowsCtx: Readonly<ChartTooltipBodyRenderContext<ChartDatum, Date, number>>) =>
          resolvedAreas.map((area: ReadonlyResolvedArea) => {
            const value = datum[area.dataKey];
            // First non-empty color wins (bklit || chain); preserves "" falling through to transparent.
            const pointColor = pointColorForMark(rowsCtx.points, area.dataKey);
            return {
              color: firstNonEmptyString([area.stroke, pointColor]) ?? "transparent",
              label: area.dataKey,
              value: isNumber(value) ? value : stringifyDatumField(value, "0"),
            };
          }),
        resolveTitle: (datum) => {
          const date = datum[xDataKey];
          return date instanceof Date ? weekdayDateFmt.format(date) : undefined;
        },
        tooltip,
      }),
    [tooltip, xDataKey, resolvedAreas],
  );
  const dragSelectionActiveRef = useRef(false);
  // Live tooltip date store for marker-active consumers.
  const markerActiveStore = useMemo(() => createActiveMarkersStore(), []);

  const clearFocusChrome = useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(undefined);
    markerActiveStore.setActiveDate(null);
    setLabelFade(undefined);
  }, [markerActiveStore, interactionRef, setHoveredIndex, setLabelFade]);

  const handleFocusChange = useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      const { clearStaleFocus, primary } = resolveAreaFocusPrimary({
        chartPhase,
        dragActive: dragSelectionActiveRef.current,
        isLoaded,
        points,
        xDataKey,
        xDomain,
      });
      if (clearStaleFocus) {
        interactionRef.current?.setControlledFocus(null, { source: "pointer" });
      }
      setHoveredIndex(primary ? primary.datumIndex : undefined);
      const dateValue = resolveFocusDate(primary?.datum, xDataKey);
      const validDate = dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue : undefined;
      markerActiveStore.setActiveDate(validDate ?? null);
      updateAreaLabelFade({
        primary: primary ? { primaryX: primary.x } : undefined,
        setLabelFade,
        showDatePill: tooltip?.showDatePill ?? true,
        validDate,
      });
    },
    [xDomain, xDataKey, chartPhase, isLoaded, markerActiveStore, tooltip, interactionRef, setHoveredIndex, setLabelFade],
  );

  const handleSelectionDragStart = useCallback(() => {
    dragSelectionActiveRef.current = true;
    clearFocusChrome();
  }, [clearFocusChrome]);
  const handleSelectionDragEnd = useCallback(() => {
    dragSelectionActiveRef.current = false;
  }, []);

  return {
    clearFocusChrome,
    handleFocusChange,
    handleSelectionDragEnd,
    handleSelectionDragStart,
    markerActiveStore,
    renderTooltipBody,
  };
};

export { useAreaFocus };
export type { AreaFocus, AreaFocusParams };
