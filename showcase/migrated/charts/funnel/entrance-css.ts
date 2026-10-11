// gap #36 (no className on area/rect/text): data-ts-key selectors. Entrance CSS gated by `data-entering`; grow runs on `scale` so the hover pop composes,
// like bklit funnel-chart.tsx:191-201 inside :320-327 (origins :325 / :536).
import type { CSSProperties } from "react";
import { toCssEase } from "../kit/motion/enter-transition";
import { MAX_STAGES } from "./hover-css";

// Fill is `backwards`, not `both`: a forwards fill holds a composited layer at scale(1) and re-rasters it at the end.
const ROOT = '[data-bkm-chart="funnel"][data-entering]';
// funnel-chart.tsx:653-655, 722-724: delay index * staggerDelay + 0.25 s, duration 0.35 s, easeOut.
const LABEL_FADE_DELAY_MS = 250;
const LABEL_FADE_MS = 350;

const staticCss = (): string => {
  let css = "@keyframes bkm-funnel-label-in{from{opacity:0}}@keyframes bkm-funnel-grow{from{scale:0}}";
  // gap #36: ring paths and labels are reached through ts-chart__area and data-ts-key (no className hook on area/text/rect).
  css += `[data-bkm-chart="funnel"] g.ts-chart__area path{transform-box:fill-box;transform-origin:var(--bkm-e-origin)}`;
  for (let stage = 0; stage < MAX_STAGES; stage += 1) {
    const delay = `calc(${stage} * var(--bkm-e-stagger))`;
    css += `${ROOT} g.ts-chart__area path[data-ts-key^="funnel-s${stage}-"]{animation:bkm-funnel-grow var(--bkm-e-dur) var(--bkm-e-ease) ${delay} backwards}`;
    css += `${ROOT} :is(text,rect)[data-ts-key*="funnel-"][data-ts-key$=":${stage}"]:not([data-ts-key*="funnel-bands"]):not([data-ts-key*="funnel-lines"]):not([data-ts-key*="funnel-pct"]){animation:bkm-funnel-label-in ${LABEL_FADE_MS}ms ease-out calc(${delay} + ${LABEL_FADE_DELAY_MS}ms) backwards}`;
    // bklit fades the label group (pill + text) as one layer (funnel-chart.tsx:645-657, 707-726); per-node text opacity would blend into the pill,
    // so the text stays opaque and appears (step-start) when the pill's fade begins.
    css += `${ROOT} text[data-ts-key*="funnel-pct"][data-ts-key$=":${stage}"]{animation:bkm-funnel-label-in ${LABEL_FADE_MS}ms step-start calc(${delay} + ${LABEL_FADE_DELAY_MS}ms) backwards}`;
  }
  return css;
};

const FUNNEL_ENTRANCE_CSS = staticCss();

interface FunnelEntranceInput {
  readonly horizontal: boolean;
  readonly staggerDelaySec: number;
  readonly durationSec: number;
  readonly ease: readonly number[] | undefined;
}

/** Prop-derived entrance numbers as host custom properties (the stage index lives in the rule). */
const funnelEntranceVars = (input: Readonly<FunnelEntranceInput>): CSSProperties => Object.fromEntries<string>([
  ["--bkm-e-dur", `${Math.round(input.durationSec * 1000)}ms`],
  ["--bkm-e-ease", toCssEase(input.ease)],
  ["--bkm-e-origin", input.horizontal ? "0% 50%" : "50% 0%"],
  ["--bkm-e-stagger", `${Math.round(input.staggerDelaySec * 1000)}ms`],
]);

export { FUNNEL_ENTRANCE_CSS, funnelEntranceVars };
