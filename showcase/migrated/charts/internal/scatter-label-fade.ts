import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ChartPoint } from "@tanstack/charts";
import { shortDateFmt } from "./formatters";
import { INITIAL_SCATTER_LABEL_FADE_STATE } from "./scatter-datum-utils";
import type { ChartDatum, ExtractedChildren } from "./types";

interface ScatterLabelFade {
  readonly primaryX: number;
  readonly hoveredLabel: string | null;
}

interface ScatterLabelFadeState {
  readonly xDataKey: string;
  readonly showDatePill: boolean;
}

interface ScatterLabelFadeChrome {
  readonly update: (points: readonly Readonly<ChartPoint<ChartDatum, Date, number>>[]) => void;
  readonly detach: () => void;
}

interface AttachScatterLabelFadeParams {
  readonly getState: () => ScatterLabelFadeState;
  readonly onLabelFadeChange: (fade: ScatterLabelFade | null) => void;
}

const attachScatterLabelFade = ({
  getState,
  onLabelFadeChange,
}: Readonly<AttachScatterLabelFadeParams>): ScatterLabelFadeChrome => {
  const update = (points: readonly Readonly<ChartPoint<ChartDatum, Date, number>>[]): void => {
    if (points.length === 0) {
      onLabelFadeChange(null);
      return;
    }
    const [primary] = points;
    const state = getState();
    const date = primary.datum[state.xDataKey];
    if (!state.showDatePill || !(date instanceof Date)) {
      onLabelFadeChange(null);
      return;
    }
    onLabelFadeChange({ hoveredLabel: shortDateFmt.format(date), primaryX: primary.x });
  };
  const detach = (): void => {
    onLabelFadeChange(null);
  };
  return { detach, update };
};

const mergeScatterLabelFade = (
  prev: ScatterLabelFade | null,
  fade: ScatterLabelFade | null,
): ScatterLabelFade | null => {
  if (fade === null) {return prev === null ? prev : null;}
  if (prev && prev.primaryX === fade.primaryX && prev.hoveredLabel === fade.hoveredLabel) {return prev;}
  return fade;
};

interface ApplyScatterFocusGroupChangeParams {
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly labelFadeRef: RefObject<ScatterLabelFadeChrome | null>;
  readonly points: readonly ChartPoint<ChartDatum, Date, number>[];
  readonly setPointerFocusActive: Dispatch<SetStateAction<boolean>>;
}

const applyScatterFocusGroupChange = ({
  dragSelectionActiveRef,
  labelFadeRef,
  points,
  setPointerFocusActive,
}: Readonly<ApplyScatterFocusGroupChangeParams>): void => {
  // Drag arms on pointerdown and clears the tooltip; hover stays suppressed for the drag.
  if (dragSelectionActiveRef.current) {
    labelFadeRef.current?.update([]);
    setPointerFocusActive((prev) => (prev ? false : prev));
    return;
  }
  labelFadeRef.current?.update(points);
  setPointerFocusActive((prev) => {
    const next = points.length > 0;
    return prev === next ? prev : next;
  });
};

interface UseScatterLabelFadeStateParams {
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly xDataKey: string;
}

const useScatterLabelFadeState = ({
  tooltip,
  xDataKey,
}: Readonly<UseScatterLabelFadeStateParams>): { current: ScatterLabelFadeState } => {
  const labelFadeStateRef = useRef<ScatterLabelFadeState>(INITIAL_SCATTER_LABEL_FADE_STATE);
  // Chrome reads latest committed state lazily via getState; sync runs post-commit, never during render.
  useEffect(() => {
    labelFadeStateRef.current = {
      showDatePill: tooltip?.showDatePill ?? true,
      xDataKey,
    };
  });
  return labelFadeStateRef;
};

interface UseScatterFocusModelParams {
  readonly setLabelFade: Dispatch<SetStateAction<ScatterLabelFade | null>>;
  readonly setPointerFocusActive: Dispatch<SetStateAction<boolean>>;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly xDataKey: string;
}

interface ScatterFocusModel {
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly handleFocusGroupChange: (points: readonly ChartPoint<ChartDatum, Date, number>[]) => void;
  readonly labelFadeRef: RefObject<ScatterLabelFadeChrome | null>;
}

const useScatterFocusModel = ({
  setLabelFade,
  setPointerFocusActive,
  tooltip,
  xDataKey,
}: Readonly<UseScatterFocusModelParams>): ScatterFocusModel => {
  const dragSelectionActiveRef = useRef(false);
  const labelFadeRef = useRef<ScatterLabelFadeChrome | null>(null);
  const labelFadeStateRef = useScatterLabelFadeState({ tooltip, xDataKey });

  const handleLabelFadeChange = useCallback(
    (fade: ScatterLabelFade | null) => {
      setLabelFade((prev) => mergeScatterLabelFade(prev, fade));
    },
    [setLabelFade],
  );

  // The chrome is pure label-fade logic, so one attach covers the mount lifetime.
  useEffect((): (() => void) => {
    const chrome = attachScatterLabelFade({
      getState: () => labelFadeStateRef.current,
      onLabelFadeChange: handleLabelFadeChange,
    });
    labelFadeRef.current = chrome;
    return (): void => {
      labelFadeRef.current = null;
      chrome.detach();
    };
  }, [labelFadeStateRef, handleLabelFadeChange]);

  const handleFocusGroupChange = useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      applyScatterFocusGroupChange({ dragSelectionActiveRef, labelFadeRef, points, setPointerFocusActive });
    },
    [dragSelectionActiveRef, labelFadeRef, setPointerFocusActive],
  );

  return { dragSelectionActiveRef, handleFocusGroupChange, labelFadeRef };
};

export { applyScatterFocusGroupChange, attachScatterLabelFade, mergeScatterLabelFade, useScatterFocusModel, useScatterLabelFadeState };
export type { ApplyScatterFocusGroupChangeParams, AttachScatterLabelFadeParams, ScatterFocusModel, ScatterLabelFade, ScatterLabelFadeChrome, ScatterLabelFadeState, UseScatterFocusModelParams, UseScatterLabelFadeStateParams };
