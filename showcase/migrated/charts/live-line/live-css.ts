// The live line's JS-injected rules: the stylesheet pipeline rewrites typed `attr(... type(<number>))` into invalid syntax,
// and these are shaped by config (lerp curve, label pool), never by data.
import { COMMIT_MS, LABEL_POOL, headEasing, settleFrames, FRAME_MS, stairEasing } from "./head-ease";
import { typedAttr } from "../kit/css-hooks";

const SCOPE = '[data-bkm-chart="liveline"]';
export const settleMs = (lerp: number): number => Math.round(settleFrames(lerp) * FRAME_MS);

/** Clip widened by `--bkm-live-ext` (tail + tip clearance); head slides from `--bkm-live-dy` along the sampled curve; tail A slides in, B and the block under it grow from the dot on bklit's head easing
 * as a `linear()`. Parity classes restart each tick (nodes persist); rolls start from the path's start transform (Frame.roll); pooled labels show from step `--bkm-s` to `--bkm-e` of their group's stepped `--bkm-st` (one animation per pool). */
export function liveCss(lerp: number): string {
  const headEase = stairEasing(headEasing(lerp), settleMs(lerp));
  const rules: string[] = [
    // Typed attr() is Chromium-only (133+); unguarded, `width:auto` overrides the rect's width and collapses the clip (the plot vanishes).
    // Under `@supports` other browsers clip at the native width.
    typedAttr(`${SCOPE} clipPath rect{width:calc(attr(width type(<number>),0) * 1px + var(--bkm-live-ext,0px))}`),
  ];
  for (const parity of [0, 1]) {
    const still = ".bkm-live-tail--still";
    // The roll's clock: linear in steady state, the intro easing on the first roll (the path's own tween easing either way).
    const roll = "var(--bkm-live-roll,600ms) var(--bkm-live-roll-ease,linear)";
    const settle = `var(--bkm-live-settle,1380ms) ${headEase}`;
    // x: A rides the path's x start with its right end where bklit's clock puts N; B and the blocks under it grow from the dot.
    // y (rp/rd): the path's y start on the same clock (gap #33: the rolling path reprojects y over the whole roll).
    rules.push(
      `@keyframes bkm-tail-a${parity}{from{transform:translate(var(--bkm-live-ax,0px),0) scale(var(--bkm-live-ak,1),1)}to{transform:translate(0,0) scale(1,1)}}`,
      `@keyframes bkm-tail-x${parity}{from{scale:var(--bkm-live-b0,0) 1}to{scale:1 1}}`,
      `@keyframes bkm-tail-l${parity}{from{translate:var(--bkm-live-ax,0px) 0}to{translate:0 0}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-l:not(${still}){animation:bkm-tail-l${parity} ${roll}}`,
      `@keyframes bkm-tail-y${parity}{from{transform:scaleY(1)}to{transform:scaleY(0)}}`,
      `@keyframes bkm-tail-k${parity}{from{transform:scaleY(1)}to{transform:scaleY(var(--bkm-live-k,1))}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-a:not(${still}){transform-box:view-box;transform-origin:var(--bkm-live-xa,0px) 0;animation:bkm-tail-a${parity} ${roll}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-x:not(${still}){animation:bkm-tail-x${parity} ${roll}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-b:not(${still}){transform:scaleY(0);animation:bkm-tail-x${parity} ${roll},bkm-tail-y${parity} ${settle}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-k:not(${still}){transform:scaleY(var(--bkm-live-k,1));animation:bkm-tail-x${parity} ${roll},bkm-tail-k${parity} ${settle}}`,
      `@keyframes bkm-rp${parity}{from{transform:translate(0,var(--bkm-live-ry-t,0px)) scale(1,var(--bkm-live-ry-s,1))}to{transform:translate(0,0) scale(1,1)}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-rp{transform-box:view-box;transform-origin:0 0;animation:bkm-rp${parity} ${roll}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-rp :is(path,polyline){vector-effect:non-scaling-stroke}`,
      `@keyframes bkm-rd${parity}{from{transform:translate(0,var(--bkm-live-ry-d,0px))}to{transform:translate(0,0)}}`,
      `@keyframes bkm-dy${parity}{from{translate:0 var(--bkm-live-dy,0px)}to{translate:0 0}}`,
      `${SCOPE} .bkm-live-tip.bkm-dp${parity}{animation:bkm-dy${parity} var(--bkm-live-settle,1380ms) ${headEase},bkm-rd${parity} ${roll}}`,
      `@keyframes bkm-st${parity}{from{--bkm-st:0}to{--bkm-st:${LABEL_POOL}}}`,
      `${SCOPE} .bkm-sp${parity}{animation:bkm-st${parity} ${LABEL_POOL * COMMIT_MS}ms steps(${LABEL_POOL},end)}`,
    );
  }
  for (let i = 0; i <= LABEL_POOL; i += 1) {
    rules.push(`${SCOPE} .bkm-s${i}{--bkm-s:${i}}`, `${SCOPE} .bkm-e${i}{--bkm-e:${i}}`);
  }
  return rules.join("\n");
}
