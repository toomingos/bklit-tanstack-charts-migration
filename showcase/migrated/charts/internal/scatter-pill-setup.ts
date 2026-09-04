import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ChartPoint } from "@tanstack/charts";
import { attachScatterPillChrome } from "./scatter-pill-chrome";
import type { ScatterLabelFade, ScatterPillChrome, ScatterPillChromeState } from "./scatter-pill-chrome";
import { shortDateFmt } from "./formatters";
import { INITIAL_SCATTER_PILL_CHROME_STATE, stringifyDatumValue } from "./scatter-datum-utils";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { SpringConfig } from "./chart-config-context";

const mergeScatterLabelFade = (
  prev: ScatterLabelFade | null,
  fade: ScatterLabelFade | null,
): ScatterLabelFade | null => {
  if (fade === null) {return prev === null ? prev : null;}
  if (prev && prev.primaryX === fade.primaryX && prev.hoveredLabel === fade.hoveredLabel) {return prev;}
  return fade;
};

interface MountScatterPillChromeParams {
  readonly handleLabelFadeChange: (fade: ScatterLabelFade | null) => void;
  readonly host: HTMLDivElement;
  readonly pillChromeRef: { current: ScatterPillChrome | null };
  readonly pillChromeStateRef: { current: ScatterPillChromeState };
  readonly tooltipSpring: Readonly<SpringConfig>;
}

const mountScatterPillChrome = ({
  handleLabelFadeChange,
  host,
  pillChromeRef,
  pillChromeStateRef,
  tooltipSpring,
}: Readonly<MountScatterPillChromeParams>): (() => void) => {
  const chrome = attachScatterPillChrome({
    getState: () => pillChromeStateRef.current,
    host,
    onLabelFadeChange: handleLabelFadeChange,
    tooltipSpring,
  });
  pillChromeRef.current = chrome;
  return (): void => {
    pillChromeRef.current = null;
    chrome.detach();
  };
};

interface ApplyScatterFocusGroupChangeParams {
  readonly dragSelectionActiveRef: { current: boolean };
  readonly pillChromeRef: { current: ScatterPillChrome | null };
  readonly points: readonly ChartPoint<ChartDatum, Date, number>[];
  readonly setPointerFocusActive: Dispatch<SetStateAction<boolean>>;
}

const applyScatterFocusGroupChange = ({
  dragSelectionActiveRef,
  pillChromeRef,
  points,
  setPointerFocusActive,
}: Readonly<ApplyScatterFocusGroupChangeParams>): void => {
  // Drag arms on pointerdown and clears the tooltip; hover stays suppressed for the drag.
  if (dragSelectionActiveRef.current) {
    pillChromeRef.current?.update([]);
    setPointerFocusActive((prev) => (prev ? false : prev));
    return;
  }
  pillChromeRef.current?.update(points);
  setPointerFocusActive((prev) => {
    const next = points.length > 0;
    return prev === next ? prev : next;
  });
};

interface UseScatterPillChromeStateParams {
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tickerHalfWidth: number | undefined;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly xDataKey: string;
}

const useScatterPillChromeState = ({
  renderData,
  tickerHalfWidth,
  tooltip,
  xDataKey,
}: Readonly<UseScatterPillChromeStateParams>): { current: ScatterPillChromeState } => {
  const pillChromeStateRef = useRef<ScatterPillChromeState>(INITIAL_SCATTER_PILL_CHROME_STATE);
  const dateLabelsForPill = useMemo(() => renderData.map((datum: Readonly<ChartDatum>) => {
    const value = datum[xDataKey];
    if (value instanceof Date) {return shortDateFmt.format(value);}
    return stringifyDatumValue(value, "");
  }), [renderData, xDataKey]);
  // Chrome reads latest committed state lazily via getState; sync runs post-commit, never during render.
  useEffect(() => {
    pillChromeStateRef.current = {
      dateLabels: dateLabelsForPill,
      pointCount: renderData.length,
      showDatePill: tooltip?.showDatePill ?? true,
      tickerHalfWidth,
      xDataKey,
    };
  });
  return pillChromeStateRef;
};

interface UseScatterPillModelParams {
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly setLabelFade: Dispatch<SetStateAction<ScatterLabelFade | null>>;
  readonly setPointerFocusActive: Dispatch<SetStateAction<boolean>>;
  readonly tickerHalfWidth: number | undefined;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipSpring: Readonly<SpringConfig>;
  readonly width: number;
  readonly xDataKey: string;
}

interface ScatterPillModel {
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly handleFocusGroupChange: (points: readonly ChartPoint<ChartDatum, Date, number>[]) => void;
  readonly overlayHostRef: RefObject<HTMLDivElement | null>;
  readonly pillChromeRef: RefObject<ScatterPillChrome | null>;
}

const useScatterPillModel = ({
  renderData,
  setLabelFade,
  setPointerFocusActive,
  tickerHalfWidth,
  tooltip,
  tooltipSpring,
  width,
  xDataKey,
}: Readonly<UseScatterPillModelParams>): ScatterPillModel => {
  const dragSelectionActiveRef = useRef(false);
  const pillChromeRef = useRef<ScatterPillChrome | null>(null);
  const pillChromeStateRef = useScatterPillChromeState({ renderData, tickerHalfWidth, tooltip, xDataKey });

  const overlayHostRef = useRef<HTMLDivElement | null>(null);

  const handleLabelFadeChange = useCallback(
    (fade: ScatterLabelFade | null) => {
      setLabelFade((prev) => mergeScatterLabelFade(prev, fade));
    },
    [setLabelFade],
  );

  useLayoutEffect((): (() => void) | undefined => {
    const el = overlayHostRef.current;
    // The host only mounts once the chart has a definition (width > 0), so the
    // Width flag doubles as the re-attach trigger when the host appears late.
    if (!el || !(tooltip?.enabled ?? false) || width <= 0) {return undefined;}
    return mountScatterPillChrome({ handleLabelFadeChange, host: el, pillChromeRef, pillChromeStateRef, tooltipSpring });
  }, [pillChromeStateRef, tooltip, width, tooltipSpring, handleLabelFadeChange]);

  const handleFocusGroupChange = useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      applyScatterFocusGroupChange({ dragSelectionActiveRef, pillChromeRef, points, setPointerFocusActive });
    },
    [dragSelectionActiveRef, pillChromeRef, setPointerFocusActive],
  );

  return { dragSelectionActiveRef, handleFocusGroupChange, overlayHostRef, pillChromeRef };
};

export { applyScatterFocusGroupChange, mergeScatterLabelFade, mountScatterPillChrome, useScatterPillChromeState, useScatterPillModel };
export type { ApplyScatterFocusGroupChangeParams, MountScatterPillChromeParams, ScatterPillModel, UseScatterPillChromeStateParams, UseScatterPillModelParams };
