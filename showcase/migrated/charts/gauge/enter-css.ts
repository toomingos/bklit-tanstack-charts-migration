import type { NotchEnter } from "./transition";
import { keyIs, keyStarts } from "../kit/renderer-dom";
// Selectors via kit/renderer-dom.ts; gap #47 (no scale enter). One CSS animation per notch mirrors bklit `motion.path` (scale+fade about the centre):
// delays bg i*15ms, active (300+i*20)ms, times stagger; vars `--bkm-gn-dur|s`; `--bkm-gn-lag` backdates the start to motion's frame clock.
const MAX_NOTCHES = 128;
const BG_STEP_MS = 15;
const ACTIVE_BASE_MS = 300;
const ACTIVE_STEP_MS = 20;
const NOTCH = ":is(path,rect)";
/** motion-dom `frameloop/batcher.mjs`: bklit's JS-driven scale starts one 60 Hz frame after its WAAPI opacity. */
const SCALE_LAG_MS = 1000 / 60;
const PERCENT = 100;
const PERCENT_DECIMALS = 4;
const SIBLING = "(sibling-index() - 1)";
const NTH = `var(--bkm-gi,${MAX_NOTCHES})`;
const SUPPORTS_SIBLING = "(width: calc(sibling-index() * 1px))";

const percent = (ratio: number): string => `${(ratio * PERCENT).toFixed(PERCENT_DECIMALS)}%`;

/** Opacity eases over [0, D] and scale over [lag, D + lag], both with the notch easing: the one animation spans D + lag. */
const keyframes = (name: string, durationMs: number, easing: string): string => {
  const total = durationMs + SCALE_LAG_MS;
  const ease = `animation-timing-function:${easing}`;
  return `@keyframes ${name}{0%{opacity:0;scale:0;${ease}}${percent(SCALE_LAG_MS / total)}{scale:0;${ease}}${percent(durationMs / total)}{opacity:1}100%{scale:1}}`;
};

const indexRules = (): string => {
  let css = "";
  for (let i = 0; i < MAX_NOTCHES; i += 1) {
    css += `[data-bkm-gn] g${keyStarts("gauge:")}>:nth-child(${i + 1}){--bkm-gi:${i}}`;
  }
  return css;
};

const delay = (index: string, base: string, step: number): string =>
  `animation-delay:calc((${base} + ${index} * ${step}ms) * var(--bkm-gn-s) - var(--bkm-gn-lag,0ms))`;

const delayRules = (index: string): string => [
  `[data-bkm-gn] g${keyIs("gauge:bg")} ${NOTCH}{${delay(index, "0ms", BG_STEP_MS)}}`,
  `[data-bkm-gn] g${keyIs("gauge:active")} ${NOTCH}{${delay(index, `${ACTIVE_BASE_MS}ms`, ACTIVE_STEP_MS)}}`,
].join("");

const HASH_RADIX = 36;
const HASH_MUL = 31;
const HASH_MOD = 2 ** 31;

/** The keyframe name carries a hash of the notch enter, so galleries with several durations or easings do not collide. */
const nameOf = (durationMs: number, easing: string): string => {
  let hash = 0;
  for (const ch of easing) { hash = (hash * HASH_MUL + (ch.codePointAt(0) ?? 0)) % HASH_MOD; }
  return `bkm-gn-${durationMs}-${hash.toString(HASH_RADIX)}`;
};

/** The entrance stylesheet for a notch enter; the easing is a literal inside the keyframes (a `var()` there is not applied). */
export const buildEnterCss = ({ durationMs, easing }: NotchEnter): string => {
  const name = nameOf(durationMs, easing);
  return [
    keyframes(name, durationMs, easing),
    `[data-bkm-gn] g${keyStarts("gauge:")} ${NOTCH}{transform-box:fill-box;transform-origin:50% 50%;animation:${name} calc(var(--bkm-gn-dur) + ${SCALE_LAG_MS}ms) linear backwards}`,
    `@supports ${SUPPORTS_SIBLING}{${delayRules(SIBLING)}}`,
    `@supports not ${SUPPORTS_SIBLING}{${delayRules(NTH)}${indexRules()}}`,
  ].join("");
};
