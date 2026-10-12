// The live line's JS-injected rules: the stylesheet pipeline rewrites typed `attr(... type(<number>))` into invalid syntax,
// and these are shaped by config (lerp curve, label pool), never by data.
import { COMMIT_MS, LABEL_POOL, headEasing, sampledEasing, settleFrames, FRAME_MS } from "./head-ease";
import { typedAttr } from "../kit/css-hooks";

const SCOPE = '[data-bkm-chart="liveline"]';
export const settleMs = (lerp: number): number => Math.round(settleFrames(lerp) * FRAME_MS);

/** Clip widened by `--bkm-live-ext` (tail + tip clearance); head slides from `--bkm-live-dy` along the sampled curve; tail A slides in, B and the block under it grow from the dot on bklit's head easing
 * as a `linear()`. Parity classes restart each tick (nodes persist); rolls start from the path's start transform (Frame.roll); badge label i shows from step `--ds` to `--de` (head-ease labelWindow). */
export function liveCss(lerp: number): string {
  const headEase = sampledEasing(headEasing(lerp));
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
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-l:not(${still}){animation:bkm-tail-l${parity} ${roll} both}`,
      `@keyframes bkm-tail-y${parity}{from{transform:scaleY(1)}to{transform:scaleY(0)}}`,
      `@keyframes bkm-tail-k${parity}{from{transform:scaleY(1)}to{transform:scaleY(var(--bkm-live-k,1))}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-a:not(${still}){transform-box:view-box;transform-origin:var(--bkm-live-xa,0px) 0;animation:bkm-tail-a${parity} ${roll} both}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-x:not(${still}){animation:bkm-tail-x${parity} ${roll} both}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-b:not(${still}){animation:bkm-tail-x${parity} ${roll} both,bkm-tail-y${parity} ${settle} both}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-tail-k:not(${still}){animation:bkm-tail-x${parity} ${roll} both,bkm-tail-k${parity} ${settle} both}`,
      `@keyframes bkm-rp${parity}{from{transform:translate(0,var(--bkm-live-ry-t,0px)) scale(1,var(--bkm-live-ry-s,1))}to{transform:translate(0,0) scale(1,1)}}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-rp{transform-box:view-box;transform-origin:0 0;animation:bkm-rp${parity} ${roll} both}`,
      `${SCOPE} .bkm-tp${parity} .bkm-live-rp :is(path,polyline){vector-effect:non-scaling-stroke}`,
      `@keyframes bkm-rd${parity}{from{transform:translate(0,var(--bkm-live-ry-d,0px))}to{transform:translate(0,0)}}`,
      `@keyframes bkm-dy${parity}{from{translate:0 var(--bkm-live-dy,0px)}to{translate:0 0}}`,
      `${SCOPE} .bkm-live-tip.bkm-dp${parity}{animation:bkm-dy${parity} var(--bkm-live-settle,1380ms) ${headEase} both,bkm-rd${parity} ${roll} both}`,
      // Window [--ds,--de): visible from its first instant to its last, hidden after (forwards); the last node holds visible from --ds (1ms, never a zero-length animation).
      `@keyframes bkm-w${parity}{from{visibility:visible}to{visibility:hidden}}`,
      `@keyframes bkm-on${parity}{from{visibility:visible}to{visibility:visible}}`,
      `${SCOPE} .bkm-lbl.bkm-w${parity}{animation:bkm-w${parity} calc(var(--de,0ms) - var(--ds,0ms)) var(--ds,0ms) forwards}`,
      `${SCOPE} .bkm-lbl.bkm-on${parity}{animation:bkm-on${parity} 1ms var(--ds,0ms) forwards}`,
    );
  }
  for (let i = 0; i <= LABEL_POOL; i += 1) {
    rules.push(`${SCOPE} .bkm-s${i}{--ds:${i * COMMIT_MS}ms}`, `${SCOPE} .bkm-e${i}{--de:${i * COMMIT_MS}ms}`);
  }
  return rules.join("\n");
}
