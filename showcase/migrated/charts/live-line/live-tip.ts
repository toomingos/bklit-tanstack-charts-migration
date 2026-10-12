// The live tip: dashed value rule, pulse ring, halo + dot, value badge. Native has no pulsing-ring or text-pill mark, so this is one
// createMark emitting plain scene nodes from the chart's scales; the pulse is a CSS animation (liveline.css).
import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import { LABEL_POOL, labelWindow } from "./head-ease";
import type { HeadLabel } from "./head-ease";

export interface LiveTipOptions {
  readonly id: string;
  readonly time: number;
  readonly value: number;
  readonly color: string;
  readonly stroke: string;
  readonly dotSize: number;
  readonly pulse: boolean;
  readonly badge: boolean;
  /** The badge text as bklit's display lerp walks it: the formatted value at each commit step with the step it first shows at (headLabels). No native text tween, so each step is a label node shown by a CSS animation (live-css.ts);
   * the pill is one rect per run of equal text length so its width follows the text like bklit's `length * 7.5 + 16`. */
  readonly labels: readonly HeadLabel[];
  /** Flips each tick: the nodes persist (and tween with the dot), the class change restarts their animations. */
  readonly parity: number;
  /** Head easing: the tip is laid out at its target and a CSS animation (live-css.ts) carries it from where bklit's display lerp stands (`--bkm-live-dy`) along the lerp curve,
   * so a y-domain jump moves the start with it. Off during the intro, where the tip follows the chart's own roll. */
  readonly ease: boolean;
}

const BADGE_HEIGHT = 24;
const BADGE_GAP = 12;
const CHAR_WIDTH = 7.5;
const BADGE_PAD = 16;
const BADGE_TEXT_DY = 4;
/** Pill widths a tick can walk through (runs of equal text length); a longer walk folds into the last slot. */
const PILL_POOL = 4;

interface PillRun {
  readonly length: number;
  /** The commit step the run first shows at. */
  readonly step: number;
}

/** Runs of equal text length along the label walk: one pill width each. */
function pillRuns(labels: readonly HeadLabel[]): PillRun[] {
  const runs: PillRun[] = [];
  for (const label of labels) {
    if (runs.at(-1)?.length !== label.text.length) {
      runs.push({ length: label.text.length, step: label.step });
    }
  }
  const final = runs.at(-1);
  if (runs.length > PILL_POOL && final) {
    runs.splice(PILL_POOL - 1, Number.POSITIVE_INFINITY, final);
  }
  return runs;
}

export function liveTip(options: LiveTipOptions): ChartMark<unknown, Date, number> {
  const { id, time, value, color, stroke, dotSize, pulse, badge, labels, parity, ease } = options;
  const pills = pillRuns(labels);
  return createMark<unknown, Date, number>(() => ({
    id,
    // No channels: the tip never influences either domain.
    channels: {},
    render: ({ scales, chart }) => {
      const x = scales.x.map(new Date(time));
      const y = scales.y.map(value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { nodes: [] };
      }
      const children: SceneNode[] = [
        {
          kind: "rule",
          key: `${id}:rule`,
          x1: chart.x,
          x2: x,
          y1: y,
          y2: y,
          style: { stroke, strokeOpacity: 0.25, strokeWidth: 1, strokeDasharray: "4 4" },
        },
      ];
      // At rest the indicator group carries the tip's translate, so a tick rewrites one transform; while the tip tweens (`ease` off)
      // the nodes take absolute coordinates so each follows the chart's roll.
      const lx = ease ? 0 : x;
      const ly = ease ? 0 : y;
      // A slot the tick does not use drops its parity and window classes and nothing else, so it stays untouched from tick to tick.
      const indicator: SceneNode[] = [];
      if (pulse) {
        indicator.push({
          kind: "dot",
          key: `${id}:pulse`,
          className: "bkm-live-pulse",
          x: lx,
          y: ly,
          radius: dotSize * 2,
          style: { fill: "none", stroke: color, strokeWidth: 1.5 },
        });
      }
      indicator.push(
        { kind: "dot", key: `${id}:halo`, x: lx, y: ly, radius: dotSize + 2, style: { fill: color, fillOpacity: 0.1 } },
        {
          kind: "dot",
          key: `${id}:dot`,
          x: lx,
          y: ly,
          radius: dotSize,
          style: { fill: color, stroke: "var(--chart-background)", strokeWidth: 2 },
        },
      );
      if (badge) {
        for (let i = 0; i < PILL_POOL; i += 1) {
          const run = pills.at(i);
          indicator.push({
            kind: "rect",
            key: `${id}:badge:${i}`,
            className: run === undefined ? "bkm-lbl" : `bkm-lbl ${labelWindow(parity, run.step, pills.at(i + 1)?.step)}`,
            x: lx + BADGE_GAP,
            y: ly - BADGE_HEIGHT / 2,
            width: (run?.length ?? 0) * CHAR_WIDTH + BADGE_PAD,
            height: BADGE_HEIGHT,
            radius: 6,
            style: { fill: "var(--popover)", fillOpacity: 0.95 },
          });
        }
        for (let i = 0; i < LABEL_POOL; i += 1) {
          const label = labels.at(i);
          indicator.push({
            kind: "label",
            key: `${id}:badge-text:${i}`,
            className: label === undefined ? "bkm-live-badge-text bkm-lbl" : `bkm-live-badge-text bkm-lbl ${labelWindow(parity, label.step, labels.at(i + 1)?.step)}`,
            x: lx + BADGE_GAP + 8,
            // bklit: <text y={4}> in a 24px box centred on the dot, alphabetic baseline (not dominant-baseline middle).
            y: ly + BADGE_TEXT_DY,
            text: label?.text ?? "",
            anchor: "start",
            fontSize: 11,
            fontWeight: 500,
          });
        }
      }
      children.push({ kind: "group", key: `${id}:indicator`, className: "bkm-live-indicator", ...(ease ? { translateX: x, translateY: y } : {}), children: indicator });
      return {
        nodes: [{ kind: "group", key: id, className: ease ? `bkm-live-tip bkm-dp${parity}` : "bkm-live-tip", ariaHidden: true, children }],
        points: [],
      };
    },
  }), ease ? false : undefined);
}
