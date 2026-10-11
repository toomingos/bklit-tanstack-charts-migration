import { useMemo } from "react";
import type { ReactNode } from "react";
import type { RendererChart } from "../kit/tooltip/tooltip-leaf";
import type { ChartTooltipProps } from "../kit/types";
import { liveRowOf } from "./definition";

/** bklit commits its live tooltip only when `liveTooltipKey` changes: cursor x and the line's y there, each rounded to a pixel (live-line-chart.tsx:219-227), checked once per frame (:403-421 via :271-284),
 * so the value text holds until the line moves a pixel. The tooltip body store takes a new target only when that key changes (kit's `tooltipEqual`), as bklit's `tooltipData` state does. */
export type BodyTarget = Parameters<NonNullable<Parameters<typeof RendererChart>[0]["tooltipEqual"]>>[0];
export const liveTooltipEqual = (a: BodyTarget, b: BodyTarget): boolean => {
  const p = a.points.at(0);
  const q = b.points.at(0);
  if (p === undefined || q === undefined || a.points.length !== b.points.length) {
    return false;
  }
  if (a.element !== b.element || a.pinned !== b.pinned) {
    return false;
  }
  return Math.round(p.x) === Math.round(q.x) && Math.round(p.y) === Math.round(q.y);
};

interface UseLiveTooltipOptionsArgs {
  readonly formatTime: (time: number) => string;
  readonly formatValue: (value: number) => string;
  readonly dataKey: string;
  readonly stroke: string;
  readonly tooltipCfg: ChartTooltipProps | undefined;
}

/** The kit tooltip body's options: bklit's time title and value format, and the card's `content` fed the focused x and its y. */
interface LiveTooltipOptions {
  readonly title: (d: Date) => string;
  readonly format: (v: number) => string;
  readonly colors: Record<string, string>;
  readonly content: (({ point }: { point: { datum?: unknown; yValue: unknown; xValue: unknown } }) => ReactNode) | undefined;
}

export function useLiveTooltipOptions({ formatTime, formatValue, dataKey: key, stroke: momentumStroke, tooltipCfg }: UseLiveTooltipOptionsArgs): LiveTooltipOptions {
  return useMemo(
    () => ({
      title: (d: Date): string => formatTime(d.getTime()),
      format: (v: number): string => formatValue(v),
      colors: { [key]: momentumStroke },
      content: tooltipCfg?.content
        ? ({ point }: { point: { datum?: unknown; yValue: unknown; xValue: unknown } }): ReactNode => {
            const row = liveRowOf(point);
            // The focused x, not the datum reference: the datum can lag a roll behind while the x follows it.
            const t = point.xValue instanceof Date ? point.xValue.getTime() : (row?.t ?? 0);
            const v = typeof point.yValue === "number" ? point.yValue : 0;
            return tooltipCfg.content?.({ point: { date: new Date(t), time: t / 1000, [key]: v, value: v }, index: 0 });
          }
        : undefined,
    }),
    [formatTime, formatValue, key, momentumStroke, tooltipCfg],
  );
}
