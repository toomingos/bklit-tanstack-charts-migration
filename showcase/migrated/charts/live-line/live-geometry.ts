// The live chart's pixel geometry: bklit's margin-inset window, and where the native plot's edge sits relative to it (the
// rolling path ends two intervals left of the dot; live-tail.ts draws the rest).
import { useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { ChartMargin } from "../kit/theme";
import type { LiveSample } from "./live-frame";

const DEFAULT_HEIGHT = 300;
const TIP_CLEARANCE = 16;
const TIP_OVERHANG = 160;
/** Sample intervals of slack between the renderer's plot edge and plotRight: the demo seed's newest sample is an interval old at
 *  mount (getLiveLineSeed), so the first ticks' N-1 trails bklit's clock by one interval plus the render delay. */
const ROLL_SLACK_STEPS = 2;

function medianInterval(times: readonly number[]): number {
  const deltas: number[] = [];
  for (let i = Math.max(1, times.length - 20); i < times.length; i += 1) {
    const d = (times[i] ?? 0) - (times[i - 1] ?? 0);
    if (d > 0) {
      deltas.push(d);
    }
  }
  if (deltas.length === 0) {
    return 1;
  }
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)] ?? 1;
}

interface UseLivePlotArgs {
  readonly width: number;
  readonly data: readonly LiveSample[];
  readonly windowSecs: number;
  readonly numXTicks: number;
  readonly nowOffsetUnits: number;
  readonly margin: ChartMargin;
  readonly rightAxis: boolean;
}

interface LivePlot {
  readonly bklitWidth: number;
  readonly pxPerMs: number;
  readonly stepSecs: number;
  readonly plotRight: number;
  readonly plotWidth: number;
  readonly rollEdge: number;
  readonly plotMargin: ChartMargin;
  readonly clipExt: number;
  readonly labelShift: number;
}

export function useLivePlot({ width, data, windowSecs, numXTicks, nowOffsetUnits, margin, rightAxis }: UseLivePlotArgs): LivePlot {
  // bklit's pixel scale: the window spans the margin-inset width and the dot sits `leading` short of its right edge. The native plot ends two
  // intervals left of the dot (the path ends at N-1; live-tail.ts draws the rest); the clip is widened back by --bkm-live-ext (live-css.ts).
  const W = width || 800;
  const bklitWidth = Math.max(1, W - margin.left - margin.right);
  const pxPerMs = bklitWidth / (windowSecs * 1000);
  const measuredStep = useMemo(() => medianInterval(data.map((p) => p.time)), [data]);
  // The sample interval is fixed per window size: it sets the plot width, which must not drift between rolls.
  const stepLock = useRef({ windowSecs: 0, secs: 0 });
  if (stepLock.current.secs === 0 || stepLock.current.windowSecs !== windowSecs) {
    stepLock.current = { windowSecs, secs: measuredStep };
  }
  const stepSecs = stepLock.current.secs;
  const leadingMs = (nowOffsetUnits * windowSecs * 1000) / Math.max(1, numXTicks - 1);
  const plotRight = Math.max(margin.left + 1, margin.left + bklitWidth - leadingMs * pxPerMs - 2 * stepSecs * 1000 * pxPerMs);
  const plotWidth = plotRight - margin.left;
  // The renderer's plot edge, ROLL_SLACK_STEPS short of plotRight: the rolling contract only transforms a path that reaches it
  // (charts-core motion-path.ts:8 coordinateTolerance 0.05px, :140-150 coverage) and snaps one that does not; the tail starts at the path's end.
  const rollEdge = Math.max(margin.left + 1, plotRight - ROLL_SLACK_STEPS * stepSecs * 1000 * pxPerMs);
  const plotMargin = useMemo(() => ({ ...margin, right: W - rollEdge }), [margin, W, rollEdge]);
  // Where the clip should end: bklit's right edge (with the dot's clearance when the axis is on the left).
  // A right-hand axis has the tip (dot, halo, badge) overlap it as in bklit, so the clip runs past the edge by the badge's overhang (bklit's svg overflow is visible).
  const clipExt = Math.max(0, (rightAxis ? W + TIP_OVERHANG : W - margin.right + Math.min(margin.right, TIP_CLEARANCE)) - rollEdge);
  // A right-hand axis keeps its labels where bklit puts them, not at the narrower plot's edge.
  const labelShift = rightAxis ? Math.max(0, W - margin.right - rollEdge) : 0;
  return { bklitWidth, pxPerMs, stepSecs, plotRight, plotWidth, rollEdge, plotMargin, clipExt, labelShift };
}

export function parseHeight(raw: CSSProperties["height"]): number {
  if (typeof raw === "number" && raw > 0) {
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return DEFAULT_HEIGHT;
}
