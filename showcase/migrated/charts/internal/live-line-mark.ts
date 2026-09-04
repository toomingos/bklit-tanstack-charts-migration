import { areaY } from "@tanstack/charts/area";
import { lineY } from "@tanstack/charts/line";
import type {
  Channel,
  ChartCurve,
  ChartKey,
  ChartMark,
  ChartMotionContext,
  ChartMotionDefinition,
} from "@tanstack/charts";
import type { ChartDatum } from "./types";

/*
 * Legacy live-line has no mount reveal, so ENTER is suppressed on first paint only.
 */
const suppressMountEnter: ChartMotionDefinition<ChartDatum> = (context: Readonly<ChartMotionContext<ChartDatum>>) => context.phase === "enter" ? false : undefined;

export interface LiveLineMarkOptions {
  readonly id: string;
  readonly x: Channel<ChartDatum, Date | null | undefined>;
  readonly y: Channel<ChartDatum, number | null | undefined>;
  readonly key: Channel<ChartDatum, ChartKey>;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly curve: ChartCurve;
  /** `url(#id)` fill reference — undefined/omitted when `withFill` is false. */
  readonly fill?: string;
  /** Area baseline in domain (not pixel) space, the current frame's `yMin` — a plain number, not a per-datum channel, so it stays stable across the rolling reproject. */
  readonly y1: number;
  readonly withFill: boolean;
}

/**
 * Returns `[line]` or `[area, line]` (area painted first so the stroke sits on top, matching legacy DOM order).
 *
 * @param {readonly Readonly<ChartDatum>[]} data - Rolling datum window bound to both marks by reference.
 * @param {Readonly<LiveLineMarkOptions>} options - Mark configuration; withFill adds the area mark beneath the line.
 * @returns {ChartMark<ChartDatum, Date, number>[]} Line mark alone, or area-plus-line with the fill painted first.
 */
export const liveLineMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<LiveLineMarkOptions>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  if (options.withFill) {
    marks.push(
      areaY(data, {
        curve: options.curve,
        fill: options.fill,
        id: `${options.id}__fill`,
        key: options.key,
        motion: suppressMountEnter,
        x: options.x,
        y1: options.y1,
        y2: options.y,
      }),
    );
  }
  marks.push(
    lineY(data, {
      curve: options.curve,
      id: options.id,
      key: options.key,
      motion: suppressMountEnter,
      stroke: options.stroke,
      strokeWidth: options.strokeWidth,
      x: options.x,
      y: options.y,
    }),
  );
  return marks;
}
