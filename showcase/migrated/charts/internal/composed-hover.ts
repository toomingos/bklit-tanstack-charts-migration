import type { ChartInteractionController } from "@tanstack/charts";
import type { ScaleTime } from "d3-scale";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { resolveNearestIndex } from "./bisect";
import { isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import { toDate } from "./coerce-date";
import type { DatePillController } from "./date-pill-overlay";
import { shortDateFmt } from "./formatters";
import type { ChartDatum, ChartTooltipConfig } from "./types";

interface HoverLabelFade {
  readonly hoveredLabel: string | null;
  readonly primaryX: number;
}

type HoverLabelFadeState = Readonly<HoverLabelFade> | undefined;

interface HoverTarget {
  readonly decimatedIndex: number;
  readonly parsedDatumX: Readonly<Date>;
  readonly rawIndex: number;
}

interface HoverScene {
  readonly interaction: ChartInteractionController<ChartDatum, Date, number>;
  readonly x0Ms: number;
  readonly xScale: ScaleTime<number, number>;
}

interface HoverMove {
  readonly decimatedIndex: number;
  readonly interaction: ChartInteractionController<ChartDatum, Date, number>;
  readonly parsedDatumX: Date;
  readonly rawIndex: number;
  readonly resolvedX: number;
}

interface CheckHoverActiveParams {
  readonly chartPhase: ChartPhase;
  readonly clearChrome: () => void;
  readonly dragActive: boolean;
  readonly isLoaded: boolean;
}

interface ResolveHoverSceneParams {
  readonly clearChrome: () => void;
  readonly clientX: number;
  readonly clientY: number;
  readonly interaction: ChartInteractionController<ChartDatum, Date, number> | null;
  readonly rawLength: number;
  readonly xScale: ScaleTime<number, number> | null;
}

interface ResolveHoverTargetParams {
  readonly decimatedRows: readonly Readonly<ChartDatum>[];
  readonly rawRows: readonly Readonly<ChartDatum>[];
  readonly x0Ms: number;
  readonly xDataKey: string;
}

interface ResolveHoverMoveParams {
  readonly clearChrome: () => void;
  readonly clientX: number;
  readonly clientY: number;
  readonly decimatedRows: readonly Readonly<ChartDatum>[];
  readonly interaction: ChartInteractionController<ChartDatum, Date, number> | null;
  readonly rawLength: number;
  readonly rawRows: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly xScale: ScaleTime<number, number> | null;
}

interface SyncHoverDatePillParams {
  readonly datePillCtl: DatePillController;
  readonly discreteFlag: boolean;
  readonly parsedDatumX: Date;
  readonly rawIndex: number;
  readonly resolvedX: number;
  readonly setLabelFade: Dispatch<SetStateAction<HoverLabelFadeState>>;
  readonly tooltipCfg: ChartTooltipConfig | undefined;
  readonly wasVisibleRef: RefObject<boolean>;
}

interface ComposedHoverInputs {
  readonly clearFocusChrome: () => void;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly datePill: DatePillController;
  readonly isDiscrete: boolean;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly xDataKey: string;
}

interface RunPointerMoveParams {
  readonly chartPhase: ChartPhase;
  readonly dragActive: boolean;
  readonly hoverInputs: Readonly<ComposedHoverInputs>;
  readonly interaction: ChartInteractionController<ChartDatum, Date, number> | null;
  readonly isLoaded: boolean;
  readonly setHoveredIndex: Dispatch<SetStateAction<number | null>>;
  readonly setLabelFade: Dispatch<SetStateAction<HoverLabelFadeState>>;
  readonly wasVisibleRef: RefObject<boolean>;
  readonly xScale: ScaleTime<number, number> | null;
}

const checkHoverActive = (params: Readonly<CheckHoverActiveParams>): boolean => {
  if (params.dragActive) {
    params.clearChrome();
    return false;
  }
  if (!isChartInteractionPhase(params.chartPhase) || !params.isLoaded) {
    params.clearChrome();
    return false;
  }
  return true;
};

const resolveHoverScene = (params: Readonly<ResolveHoverSceneParams>): HoverScene | undefined => {
  if (!params.xScale || params.rawLength === 0) {
    params.clearChrome();
    return undefined;
  }
  if (!params.interaction) {
    return undefined;
  }
  // Scene x is used as-is (margin-inclusive, same origin as the old clientX-rect computation).
  const scenePos = params.interaction.clientToScene(params.clientX, params.clientY);
  if (!scenePos) {
    params.clearChrome();
    return undefined;
  }
  return {
    interaction: params.interaction,
    x0Ms: params.xScale.invert(scenePos.x).getTime(),
    xScale: params.xScale,
  };
};

const resolveHoverTarget = (params: Readonly<ResolveHoverTargetParams>): HoverTarget | undefined => {
  const dateAccessor = (row: Readonly<ChartDatum>): number => {
    const parsed = toDate(row[params.xDataKey]);
    return parsed ? parsed.getTime() : Number.NaN;
  };
  const rawIndex = resolveNearestIndex(params.rawRows, dateAccessor, params.x0Ms);
  if (rawIndex < 0) {
    return undefined;
  }
  const decimatedIndex =
    params.decimatedRows.length > 0 ? resolveNearestIndex(params.decimatedRows, dateAccessor, params.x0Ms) : -1;
  const datum = params.rawRows[rawIndex];
  const parsedDatumX = toDate(datum[params.xDataKey]);
  if (!parsedDatumX) {
    return undefined;
  }
  return { decimatedIndex, parsedDatumX, rawIndex };
};

const projectHoverMoveTarget = (
  scene: Readonly<HoverScene>,
  target: Readonly<HoverTarget>,
  clearChrome: () => void,
): HoverMove | undefined => {
  const resolvedX = scene.xScale(target.parsedDatumX);
  if (!Number.isFinite(resolvedX)) {
    clearChrome();
    return undefined;
  }
  return {
    decimatedIndex: target.decimatedIndex,
    interaction: scene.interaction,
    parsedDatumX: target.parsedDatumX,
    rawIndex: target.rawIndex,
    resolvedX,
  };
};

const resolveHoverMove = (params: Readonly<ResolveHoverMoveParams>): HoverMove | undefined => {
  const scene = resolveHoverScene(params);
  if (!scene) {
    return undefined;
  }
  const target = resolveHoverTarget({
    decimatedRows: params.decimatedRows,
    rawRows: params.rawRows,
    x0Ms: scene.x0Ms,
    xDataKey: params.xDataKey,
  });
  if (!target) {
    params.clearChrome();
    return undefined;
  }
  return projectHoverMoveTarget(scene, target, params.clearChrome);
};

const syncHoverDatePill = (params: Readonly<SyncHoverDatePillParams>): void => {
  if (params.tooltipCfg?.showDatePill ?? true) {
    const label = shortDateFmt.format(params.parsedDatumX);
    const jump = !params.wasVisibleRef.current;
    params.wasVisibleRef.current = true;
    params.datePillCtl.show(params.resolvedX, { discrete: params.discreteFlag, index: params.rawIndex, jump, label });
    params.setLabelFade((prev) =>
      prev?.primaryX === params.resolvedX && prev.hoveredLabel === label
        ? prev
        : { hoveredLabel: label, primaryX: params.resolvedX },
    );
  } else {
    params.wasVisibleRef.current = false;
    params.datePillCtl.hide();
    params.setLabelFade(undefined);
  }
};

const runComposedPointerMove = (
  event: PointerEvent,
  params: Readonly<RunPointerMoveParams>,
): void => {
  const inputs = params.hoverInputs;
  if (!checkHoverActive({
    chartPhase: params.chartPhase,
    clearChrome: inputs.clearFocusChrome,
    dragActive: params.dragActive,
    isLoaded: params.isLoaded,
  })) {return;}
  const move = resolveHoverMove({
    clearChrome: inputs.clearFocusChrome,
    clientX: event.clientX,
    clientY: event.clientY,
    decimatedRows: inputs.renderData,
    interaction: params.interaction,
    rawLength: inputs.data.length,
    rawRows: inputs.data,
    xDataKey: inputs.xDataKey,
    xScale: params.xScale,
  });
  if (!move) {return;}
  params.setHoveredIndex(move.decimatedIndex >= 0 ? move.decimatedIndex : null);
  syncHoverDatePill({
    datePillCtl: inputs.datePill,
    discreteFlag: inputs.isDiscrete,
    parsedDatumX: move.parsedDatumX,
    rawIndex: move.rawIndex,
    resolvedX: move.resolvedX,
    setLabelFade: params.setLabelFade,
    tooltipCfg: inputs.tooltip,
    wasVisibleRef: params.wasVisibleRef,
  });
  const resolution = move.interaction.resolvePointer(event.clientX, event.clientY) ?? null;
  move.interaction.setControlledFocus(resolution, { source: "pointer" });
};

export { checkHoverActive, resolveHoverMove, runComposedPointerMove, syncHoverDatePill };
export type { ComposedHoverInputs, HoverLabelFade, HoverLabelFadeState, HoverMove };
