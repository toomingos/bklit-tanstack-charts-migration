// C5 (E1): native `lineY`/`areaY` (dist/line.d.ts, dist/area.d.ts) replace the
// hand-rolled `createMark` polyline/area builder this file used to hold.
// Native marks emit real per-datum ChartPoints (the old `createMark` scene
// nodes were plain polyline/area primitives with no per-point identity) —
// that is what unlocks native focus/crosshair/hover-dots/tooltip for this
// chart; see live-line-chart.tsx's header and the (now-deleted)
// internal/live-hover-chrome.ts, whose own header named this exact
// replacement as "the C5 follow-up".
//
// Rolling-path motion (definition-level, live-line-chart.tsx's `spec.motion`)
// governs ordinary reconciles; the one thing that motion config cannot see is
// "this is the very first paint" vs. "this is an update" for a role with no
// notion of resize (motion.md's `ChartMotionContext.phase`). Legacy bklit
// live-line has no mount reveal — data simply starts streaming — so E5
// requires suppressing the renderer's default matrix-growth ENTER
// choreography (motion.md `markMotionRole`) for these two marks specifically.
// `motion: (context) => context.phase === "enter" ? false : undefined`
// does exactly that: `false` on the one-time mount phase, `undefined` on
// every subsequent phase so the mark falls through to the definition-level
// rolling transition (motion.md's cascade: renderer default → defineChart
// `motion` → mark `motion` → ...) instead of overriding it.
import { areaY } from "@tanstack/charts/area";
import { lineY } from "@tanstack/charts/line";
import type {
  Channel,
  ChartCurve,
  ChartKey,
  ChartMark,
  ChartMotionDefinition,
} from "@tanstack/charts";
import type { ChartDatum } from "./types";

const suppressMountEnter: ChartMotionDefinition<ChartDatum> = (context) =>
  context.phase === "enter" ? false : undefined;

export interface LiveLineMarkOptions {
  id: string;
  x: Channel<ChartDatum, Date | null | undefined>;
  y: Channel<ChartDatum, number | null | undefined>;
  key: Channel<ChartDatum, ChartKey>;
  stroke: string;
  strokeWidth: number;
  curve: ChartCurve;
  /** `url(#id)` fill reference — undefined/omitted when `withFill` is false. */
  fill?: string;
  /**
   * Area baseline in DOMAIN (not pixel) space — the current frame's `yMin`.
   * A plain number (not a per-datum channel) so it is one constant value per
   * commit, satisfying motion.md's "keep an area's baseline semantically
   * stable, such as `y1: 0`" rolling-reproject guidance, adapted since this
   * chart's y domain isn't fixed at 0 (E2/fact 15).
   */
  y1: number;
  withFill: boolean;
}

/** Returns `[line]` or `[area, line]` (area painted first so the stroke sits
 *  on top, matching the legacy DOM order: fill group before line group). */
export function liveLineMark(
  data: ChartDatum[],
  options: LiveLineMarkOptions,
): ChartMark<ChartDatum, Date, number>[] {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  if (options.withFill) {
    marks.push(
      areaY(data, {
        id: `${options.id}__fill`,
        x: options.x,
        y1: options.y1,
        y2: options.y,
        key: options.key,
        fill: options.fill,
        curve: options.curve,
        motion: suppressMountEnter,
      }) as unknown as ChartMark<ChartDatum, Date, number>,
    );
  }
  marks.push(
    lineY(data, {
      id: options.id,
      x: options.x,
      y: options.y,
      key: options.key,
      stroke: options.stroke,
      strokeWidth: options.strokeWidth,
      curve: options.curve,
      motion: suppressMountEnter,
    }) as unknown as ChartMark<ChartDatum, Date, number>,
  );
  return marks;
}
