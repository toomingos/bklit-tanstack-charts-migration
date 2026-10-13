// Radar entrance pieces native text and dot motion cannot express, as fixed-text CSS driven by host custom properties (`radarEntranceVars`).
// Each rule is a CSS animation on a classed group (reference/marks/polar.md): it plays once on mount, a var change only retargets values.
import type { CSSProperties } from "react";
import type { EntranceOrigin } from "../kit/entrance/entrance-origin";
import { toCssEase } from "../kit/motion/enter-transition";
import { springCurve } from "../kit/motion/spring-curve";
import type { SpringCurve } from "../kit/motion/spring-curve";
import { RADAR_ENTER_SPRING } from "./transition";
import type { RadarEnterTransition } from "./transition";

const SAMPLES = 48;
const SPRING_STEP_MS = 8;
const SPRING_LIMIT_MS = 4000;
// motion's rest thresholds scaled to a unit span (about 160px of travel).
const UNIT_REST = { delta: 0.5 / 160, speed: 2 / 160 };
const MAX_LEVELS = 12;
const MAX_METRICS = 24;
const MAX_SERIES = 12;
const LEVEL_LABEL_STEP_MS = 60;
const AXIS_LABEL_STEP_MS = 80;

const round = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A spring as a CSS `linear()` easing over its settle time (overshoots). */
const springEase = (stiffness: number, damping: number, mass: number): SpringCurve =>
  springCurve({ damping, mass, stiffness }, { decimals: 4, limitMs: SPRING_LIMIT_MS, rest: UNIT_REST, samples: SAMPLES, stepMs: SPRING_STEP_MS });

/** bklit's enter transition (default 1.1s bezier tween, or a spring) as a CSS duration + easing. */
const enterCurve = (transition: RadarEnterTransition | undefined): SpringCurve => {
  if (transition?.type === "spring") { return springEase(transition.stiffness ?? RADAR_ENTER_SPRING.stiffness, transition.damping ?? RADAR_ENTER_SPRING.damping, transition.mass ?? RADAR_ENTER_SPRING.mass); }
  return { durationMs: (transition?.duration ?? 1.1) * 1000, ease: toCssEase(transition?.ease) };
};

// bklit RadarLabels: the opacity transition names only a duration, which motion hands to WAAPI as `ease-out` (read off the running animation);
// a group glides centre -> position on a spring (80/15, no delay) while opacity fades in.
const LABEL_GLIDE = springEase(80, 15, 1);

const ROOT = "[data-bkm-radar][data-bkm-enter]";

const staticCss = (): string => {
  // --bkm-rp is the dot travel progress: the group scales by max(.001,p) (hover-css.ts) and the circle by its exact reciprocal, so the dot
  // keeps its size while it travels (two separate keyframes would not cancel: .001 + .999p != p).
  // `--bkm-rp` is registered once in styles.css: a registration in this per-mount <style> would restyle the whole document at every mount.
  let css = "@keyframes bk-radar-p{from{--bkm-rp:0}to{--bkm-rp:1}}";
  css += "@keyframes bk-radar-fade{from{opacity:0}}";
  // bklit RadarGrid: opacity 0 -> 1 on the enter transition, delayed levels*gridStagger*0.5 + i*0.06*df.
  for (let i = 0; i < MAX_LEVELS; i += 1) {
    css += `${ROOT} g.bkm-radar-levels text:nth-child(${i + 1}){animation:bk-radar-fade var(--bkm-r-dur) var(--bkm-r-ease) calc(var(--bkm-r-lvl0) + ${i} * var(--bkm-r-lvlstep)) backwards}`;
  }
  // The glide start is minus the label's offset from the centre: radius * (cos, sin) of its axis angle (angle from 12 o'clock minus 90deg).
  for (let i = 0; i < MAX_METRICS; i += 1) {
    const angle = `calc(${i} * 360deg / var(--bkm-r-n) - 90deg)`;
    css += `${ROOT} g.bkm-radar-axis-labels text:nth-child(${i + 1}){animation:bk-radar-glide-in ${LABEL_GLIDE.durationMs}ms ${LABEL_GLIDE.ease} backwards,bk-radar-fade 500ms ease-out calc(var(--bkm-r-lbl0) + ${i} * ${AXIS_LABEL_STEP_MS}ms) backwards;--bkm-gx:calc(var(--bkm-r-rad) * cos(${angle}));--bkm-gy:calc(var(--bkm-r-rad) * sin(${angle}))}`;
  }
  css += "@keyframes bk-radar-glide-in{from{transform:translate(calc(var(--bkm-gx) * -1),calc(var(--bkm-gy) * -1))}}";
  // bklit series dots sit at the centre at full size from mount (the series group fades in over 0.15s) and travel out with the
  // polygon.
  for (let i = 0; i < MAX_SERIES; i += 1) {
    const delay = `calc(var(--bkm-r-sbase) + ${i} * var(--bkm-r-sstep))`;
    css += `${ROOT} g.bkm-radar-dot.bkm-radar-s${i}{animation:bk-radar-p var(--bkm-r-dur) var(--bkm-r-ease) ${delay} backwards,bk-radar-fade 150ms ease-out backwards}`;
  }
  css += `${ROOT} g.bkm-radar-dot circle{transform-box:fill-box;transform-origin:center;transform:scale(calc(1 / max(.001, var(--bkm-rp))))}`;
  return css;
};

const RADAR_ENTRANCE_CSS = staticCss();

interface RadarEntranceVarsInput {
  readonly levels: number;
  readonly metricCount: number;
  /** viewBox side in user units (the chart's size). */
  readonly size: number;
  readonly margin: number;
  readonly labelOffset: number;
  readonly staggerScale: number;
  readonly enterDurationMs: number;
  readonly enterTransition: RadarEnterTransition | undefined;
  readonly seriesBaseMs: number;
  readonly seriesStepMs: number;
}

/** Prop/size-derived entrance numbers as host custom properties. */
const radarEntranceVars = (o: Readonly<RadarEntranceVarsInput>): CSSProperties => {
  const df = o.enterDurationMs / 1100;
  const gridStagger = 0.08 * o.staggerScale * df * 1000;
  const curve = enterCurve(o.enterTransition);
  return Object.fromEntries<string>([
    ["--bkm-r-dur", `${round(curve.durationMs)}ms`],
    ["--bkm-r-ease", curve.ease],
    ["--bkm-r-lbl0", `${round(o.levels * 0.08 * 0.5 * 1000)}ms`],
    ["--bkm-r-lvl0", `${round(o.levels * gridStagger * 0.5)}ms`],
    ["--bkm-r-lvlstep", `${round(LEVEL_LABEL_STEP_MS * df)}ms`],
    ["--bkm-r-n", String(Math.max(1, o.metricCount))],
    ["--bkm-r-rad", `${round(Math.max(0, (o.size - o.margin * 2) / 2) + o.labelOffset)}px`],
    ["--bkm-r-sbase", `${round(o.seriesBaseMs)}ms`],
    ["--bkm-r-sstep", `${round(o.seriesStepMs)}ms`],
  ]);
};

/** Origin of each entrance animation in bklit's motion terms (kit/entrance/entrance-origin.ts): opacity is WAAPI, the glide is JS. The dot travel is bklit's JS `mountProgress`,
 * but its measured first-move frame (prod, 6 runs: bklit 685.5 ms median, ours 680.5 on `frame`, 697 on `motion`) and settle (2182.8 vs 2186 ms on `frame`; +16.7 ms on `motion`) match the `frame` origin. */
const RADAR_ENTRANCE_ORIGINS = { "bk-radar-fade": "frame", "bk-radar-glide-in": "motion", "bk-radar-p": "frame" } as const satisfies Readonly<Record<string, EntranceOrigin>>;

export { RADAR_ENTRANCE_CSS, RADAR_ENTRANCE_ORIGINS, radarEntranceVars };
