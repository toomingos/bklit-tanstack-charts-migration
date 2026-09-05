"use client";

import { createElement, useMemo, useState } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import { useDashTailMeasurement } from "./dash-tail-measure";
import type { DashTailSeries, Measured } from "./dash-tail-measure";
import type { ChartDatum } from "./types";
import { useSanitizedId } from "./use-sanitized-id";

// Numeric-cell guard for the optional dashFromIndex prop.
// Absent or non-numeric means "no dash tail", so the prop is parsed here.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

const resolveDashTailBounds = (dashFromIndex: number | undefined, dataLength: number): boolean => (
    isNumber(dashFromIndex) &&
    dashFromIndex >= 0 &&
    dashFromIndex < dataLength - 1
  );


interface DashTailOverlayProps {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly width: number;
  readonly height: number;
  readonly margin: { readonly top: number; readonly left: number; readonly right: number; readonly bottom: number };
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly series: readonly DashTailSeries[];
  readonly innerWidth: number;
  readonly innerHeight: number;
  // SeriesHoverDim parity: dimOpacity while hovering, else 1 (absent = no dim).
  readonly dimOpacity?: number;
  readonly hasHover?: boolean;
  readonly legendHoveredKey?: string;
}

interface DashTailEntryOptions {
  readonly entryKey: string;
  readonly measuredEntry: Readonly<Measured>;
  readonly baseId: string;
  readonly marginTop: number;
  readonly marginLeft: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly dimmed: boolean;
  readonly dimOpacity: number | undefined;
}

// Single opacity slot for pointer hover, legend dim, or both combined.
const resolveDashDimmed = (
  dimOpacity: number | undefined,
  hasHover: boolean,
  legendHoveredKey: string | undefined,
  seriesEntry: Readonly<DashTailSeries> | undefined,
  entryKey: string,
): boolean => {
  if (dimOpacity === undefined || seriesEntry?.dimEnabled === false) {return false;}
  if (hasHover) {return true;}
  return legendHoveredKey !== undefined && legendHoveredKey !== entryKey;
};

const renderDashTailEntry = (options: Readonly<DashTailEntryOptions>): ReactElement => {
  const { baseId, dimOpacity, dimmed, entryKey, innerHeight, innerWidth, marginLeft, marginTop, measuredEntry } = options;
  const clipId = `${baseId}-dash-${entryKey.replaceAll(/[^a-zA-Z0-9_-]/gu, "_")}`;
  const pad = measuredEntry.strokeWidth * 2;
  const tailWidth = Math.max(0, marginLeft + innerWidth - measuredEntry.dashStartX + pad);
  const defsEl = createElement("defs", undefined, createElement("clipPath", { id: clipId }, createElement("rect", { height: innerHeight + pad, width: tailWidth, x: measuredEntry.dashStartX - measuredEntry.strokeWidth, y: marginTop - measuredEntry.strokeWidth })));
  const basePathEl = createElement("path", { d: measuredEntry.pathD, fill: "none", stroke: measuredEntry.stroke, strokeDasharray: `${measuredEntry.dashStartLength} ${Math.max(1, measuredEntry.pathLength - measuredEntry.dashStartLength)}`, strokeLinecap: "round", strokeWidth: measuredEntry.strokeWidth });
  const tailPathEl = createElement("path", { clipPath: `url(#${clipId})`, d: measuredEntry.pathD, fill: "none", stroke: measuredEntry.stroke, strokeDasharray: measuredEntry.dashArray, strokeLinecap: "round", strokeWidth: measuredEntry.strokeWidth });
  return createElement(
    "g",
    dimOpacity === undefined
      ? { "data-bkm-dash-tail": entryKey, key: entryKey }
      : { className: "bkm-dash-tail", "data-bkm-dash-tail": entryKey, key: entryKey, opacity: dimmed ? dimOpacity : 1 },
    defsEl,
    basePathEl,
    tailPathEl
  );
}

const DashTailOverlay = (props: Readonly<DashTailOverlayProps>): ReactNode => {
  const { containerRef, dimOpacity, hasHover = false, height, innerHeight, innerWidth, legendHoveredKey, margin, renderData, series, width, xDataKey } = props;
  const baseId = useSanitizedId();
  const [measured, setMeasured] = useState<Map<string, Measured>>(new Map());

  const activeSeries = useMemo(
    () => series.filter((seriesEntry) => resolveDashTailBounds(seriesEntry.dashFromIndex, renderData.length)),
    [series, renderData.length]
  );

  useDashTailMeasurement({ activeSeries, containerRef, innerHeight, innerWidth, marginLeft: margin.left, onMeasured: setMeasured, renderData, xDataKey });

  if (activeSeries.length === 0 || measured.size === 0) {return undefined;}

  // No wrapping translate: pathD already carries host margins; re-adding them double-counts.
  const seriesByKey = new Map(series.map((seriesEntry) => [seriesEntry.dataKey, seriesEntry]));
  return createElement(
    "svg",
    { "aria-hidden": "true", height, style: { inset: 0, pointerEvents: "none", position: "absolute" }, width },
    [...measured.entries()].map(([entryKey, measuredEntry]: readonly [string, Measured]) =>
      renderDashTailEntry({ baseId, dimOpacity, dimmed: resolveDashDimmed(dimOpacity, hasHover, legendHoveredKey, seriesByKey.get(entryKey), entryKey), entryKey, innerHeight, innerWidth, marginLeft: margin.left, marginTop: margin.top, measuredEntry }))
  );
}

export { resolveDashStartX } from "./dash-tail-measure";
export type { DashTailSeries } from "./dash-tail-measure";
export type { DashTailOverlayProps };
export { resolveDashTailBounds, DashTailOverlay };
