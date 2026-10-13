// The x tick labels (`definition.controls`): a pool of nodes per slot, so a roll rewrites text. bklit re-derives them each commit (live-x-axis.tsx:64-75);
// a mid-roll render cancels the path (charts-core motion.ts:985), so a slot's texts over the roll are a stack switched by CSS (live-css.ts).
import type { ChartControl } from "@tanstack/charts";
import { COMMIT_MS, LABEL_POOL, labelWindow } from "./head-ease";

/** Nodes per slot: one second-format boundary falls in a roll (a tick is under a second), two if it runs long; a finer format holds its last text. */
const X_POOL = 3;

export interface LiveXLabelsOptions {
  readonly id: string;
  /** Slot times (ms) at the start of the roll: slot i sits at the scale position of its end-of-roll time (times[i] + rollMs), which never moves. */
  readonly times: readonly number[];
  /** The roll's length: the labels' clock advances this far over it. */
  readonly rollMs: number;
  /** The frame's tick parity: restarts the stack's animations each tick (live-css.ts). */
  readonly parity: number;
  /** Gap between the plot bottom and the label box (the axis padding it replaces). */
  readonly padding: number;
  readonly fontSize: number;
  readonly format: (time: number) => string;
}

export function liveXLabels(options: LiveXLabelsOptions): ChartControl<Date, number> {
  const { id, times, rollMs, parity, padding, fontSize, format } = options;
  return {
    id,
    resolve: ({ scales, chart }) => {
      const {x} = scales;
      const children = times.flatMap((time, i) => {
        const at = x.map(new Date(time + rollMs));
        if (!Number.isFinite(at)) {
          return [];
        }
        // The text the slot shows at each commit step, with the step it first shows at.
        const texts: { text: string; step: number }[] = [];
        for (let step = 0; step < LABEL_POOL; step += 1) {
          const text = format(time + step * COMMIT_MS);
          if (texts.at(-1)?.text !== text) {
            texts.push({ text, step });
          }
        }
        const shown = texts.slice(0, X_POOL);
        return Array.from({ length: X_POOL }, (_, n) => {
          const entry = shown.at(n);
          const window = entry === undefined ? "" : ` ${labelWindow(entry.step, shown.at(n + 1)?.step)}`;
          return {
            kind: "label" as const,
            key: `x-tick-label:slot:${i}:${n}`,
            className: `bkm-live-xlabel bkm-lbl${window}`,
            x: at,
            y: chart.y + chart.height + padding + fontSize * 0.8,
            text: entry?.text ?? "",
            anchor: "middle" as const,
            fontSize,
            style: { fill: "var(--chart-label)", fillOpacity: 1 },
          };
        });
      });
      // Classed so the focus x (`--bkm-fx`, not inherited) reaches the labels through this group alone (live-line-chart.tsx FOCUS_VARS_CSS).
      return { nodes: [{ kind: "group", key: id, className: `bkm-live-xlabels bkm-sp${parity}`, ariaHidden: true, children }] };
    },
  };
}
