import { useEffect, useMemo, useRef, useState } from "react";
import { erase } from "../kit/erased-types";
import type { ReactElement } from "react";
import { motion } from "@tanstack/charts/motion";
import { RendererChart } from "../kit/tooltip/tooltip-leaf";
import type { ChartMargin } from "../kit/theme";
import { buildLiveYAxisDefinition } from "./definition";
import { COMMIT_MS } from "./head-ease";
import { pickStep, rollYAt, shownDomain, stepRaw } from "./live-frame";
import type { Frame, RollClock, StepPick } from "./live-frame";
import { yTickValues } from "./live-yaxis";

const OVERLAY_STYLE = { position: "absolute", inset: 0, pointerEvents: "none" } as const;

/** Gap between y labels and the plot, and the advance of one 12px mono glyph (bklit's font-mono text-xs). */
export const Y_LABEL_GAP = 8;
const Y_LABEL_CHAR_PX = 7.2;

interface LiveYLabelsProps {
  readonly frame: Frame;
  readonly roll: { readonly current: { readonly roll: RollClock | null } };
  readonly pick: { readonly current: StepPick };
  readonly height: number;
  readonly margin: ChartMargin;
  readonly top: number;
  readonly innerHeight: number;
  readonly minGap: number;
  readonly lerp: number;
  readonly allowDecimals: boolean;
  readonly position: "left" | "right";
  readonly format: (v: number) => string;
  /** bklit's label box width (the margin minus its 8px gap). */
  readonly labelBox: number;
  readonly labelShift: number;
}

/** The y labels as their own chart over the line's, as bklit's LiveYAxis is its own layer (live-y-axis.tsx:188-191) re-reading the domain each 32ms commit (live-line-chart.tsx:275-284: step with hysteresis :120-129, labels :135-157, slots :160-176, spring :198-205).
 * In 1.0 a tick set lives in the scene, so a new step on the line's chart re-planned and snapped the path (charts-core motion.ts:985, motion-path.ts:94); here only this chart renders. Re-picks the on-screen domain (rollYAt) each display frame past COMMIT_MS until the first pick after settle. */
export const LiveYLabels = ({ frame, roll, pick, height, margin, top, innerHeight, minGap, lerp, allowDecimals, position, format, labelBox, labelShift }: LiveYLabelsProps): ReactElement => {
  const [shown, setShown] = useState<{ readonly frame: Frame; readonly interval: number; readonly domain: readonly [number, number] } | null>(null);
  // The intro, and the frame after it (a sample that lands mid-intro carries what is left of that roll, motion.ts:1918-1923), follow the
  // domain on screen; later frames keep their own.
  const prior = useRef<{ frame: Frame | null; intro: boolean }>({ frame: null, intro: false });
  if (prior.current.frame !== frame) {
    prior.current = { frame, intro: frame.intro || (prior.current.frame?.intro ?? false) };
  }
  const follow = prior.current.intro;
  // Before this frame's first pick: those labels start where the line does (the roll's start transform), the rest on the frame's domain.
  const start = useMemo(
    () => ({ interval: frame.interval, domain: follow ? shownDomain(frame.yDomain, frame.roll, top, innerHeight) : frame.yDomain }),
    [frame, follow, top, innerHeight],
  );
  useEffect(() => {
    if (frame.seed) {
      return;
    }
    let last: { interval: number; domain: readonly [number, number] } = start;
    let raf = 0;
    const tick = (time: number): void => {
      const r = roll.current.roll;
      const p = pick.current;
      // bklit's raw domain steps once per rAF tick (live-line-chart.tsx:105-127, :383-431), whether or not the tick commits.
      const raw = stepRaw(p, frame.yTarget, lerp);
      // bklit's commit clock is performance.now() read inside the tick, not the rAF timestamp (live-line-chart.tsx:399, :281), so a late tick
      // (a long mount frame) shifts every later commit with it.
      const now = performance.now();
      if (now - p.commit >= COMMIT_MS) {
        p.commit = now;
        const onScreen = shownDomain(frame.yDomain, rollYAt(r, time), top, innerHeight);
        const interval = pickStep(p, raw, innerHeight, minGap);
        const domain = follow ? onScreen : frame.yDomain;
        if (interval !== last.interval || domain[0] !== last.domain[0] || domain[1] !== last.domain[1]) {
          last = { interval, domain };
          setShown({ frame, interval, domain });
        }
        if (!r || (r.at !== null && time - r.at >= r.dur)) {
          return;
        }
      }
      // Next re-pick frame (live-line-chart.tsx:383-431).
      raf = requestAnimationFrame(tick);
    };
    // Labels re-pick per lerp frame like bklit (live-line-chart.tsx:383-431, live-y-axis.tsx:191-205).
    raf = requestAnimationFrame(tick);
    return (): void => { cancelAnimationFrame(raf); };
  }, [frame, roll, pick, top, innerHeight, minGap, lerp]);
  const now = shown?.frame === frame ? shown : start;
  // A label leaving the set stays, fading to 0, for the rest of the frame (bklit: AnimatePresence opacity spring, live-y-axis.tsx:191-205). The native
  // exit is cancelled by each render (charts-core motion.ts:985, `cancel: cleanup`), so a kept label's opacity is an update track the next render resumes.
  const kept = useRef<{ frame: Frame | null; values: readonly number[]; leaving: readonly number[] }>({ frame: null, values: [], leaving: [] });
  const definition = useMemo(() => {
    const ticks = yTickValues(now.domain, now.interval, innerHeight, allowDecimals);
    const was = kept.current.frame === frame || (follow && kept.current.frame) ? [...kept.current.values, ...kept.current.leaving] : [];
    const tickSet = new Set(ticks);
    const leaving = [...new Set(was.filter((v) => !tickSet.has(v)))];
    kept.current = { frame, values: ticks, leaving };
    // bklit's label box is the margin minus an 8px gap, text right-aligned inside it; a label wider than that box overflows
    // towards the plot edge rather than past the container. Native anchors at the axis, so shrink the gap.
    const widest = Math.max(0, ...ticks.map((v) => format(v).length)) * Y_LABEL_CHAR_PX;
    return buildLiveYAxisDefinition({
      xDomain: frame.xDomain,
      yDomain: now.domain,
      margin,
      formatValue: format,
      yPosition: position,
      yTicks: [...ticks, ...leaving].sort((a, b) => a - b),
      yLeaving: leaving,
      yLabelPad: Y_LABEL_GAP + labelShift - Math.max(0, widest - labelBox),
      plotHeight: innerHeight,
    });
  }, [frame, now.domain, now.interval, innerHeight, allowDecimals, format, margin, position, labelShift, labelBox]);
  const renderer = useMemo(() => motion({ initial: false }), []);
  const erasedDefinition = erase(definition);
  return (
    <div aria-hidden="true" data-bkm-live-ylabels="" style={OVERLAY_STYLE}>
      <RendererChart definition={erasedDefinition} renderer={renderer} height={height} ariaLabel="" tabIndex={-1} />
    </div>
  );
};
