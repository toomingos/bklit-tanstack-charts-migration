// Selectors via kit/renderer-dom.ts. Hover as static CSS on host `data-hover="<stage>"` (`--h` hot, `--d` dimmed);
// pop-spring.ts draws the springs, transitions carry `NOT_MOTION`.
import type { CSSProperties } from "react";
import { CLS, NOT_MOTION, keyEnds, keyHas, keyStarts } from "../kit/renderer-dom";
import { range } from "../kit/range";

const FILL_TWEEN_MS = 150;
const FILL_TWEEN_EASE = "cubic-bezier(0,0,.58,1)";
const MAX_STAGES = 24;
const MAX_LAYERS = 8;
const DIM_PERCENT = 60;

const HOST = '[data-bkm-chart="funnel"]';
const AREA_PATH = `g${CLS.area} path`;
const layerSel = (layer: number): string => `${AREA_PATH}${keyHas(`-l${layer}:`)}`;

const LABEL_FILLS: readonly (readonly [string, string])[] = [
  ["value", "var(--foreground)"], ["pill", "var(--foreground)"], ["name", "var(--muted-foreground)"],
];

const mix = (colour: string): string => `color-mix(in srgb,${colour} calc(100% - var(--d,1) * ${DIM_PERCENT}%),transparent)`;
const shadow = (alpha: string): string => `drop-shadow(0 1px 1.5px rgb(0 0 0/${alpha})) drop-shadow(0 1px 1px rgb(0 0 0/${alpha}))`;
const DIMMED_SHADOW_ALPHA = "calc(.1 * (1 - var(--d,1) * .6))";

const staticRules = (layerCount: number): string => {
  let css = "";
  // Hot stage: its ring paths, label text and pill.
  for (const stage of range(MAX_STAGES)) {
    css += `${HOST}[data-hover="${stage}"] :is(${AREA_PATH}${keyStarts(`funnel-s${stage}-`)},:is(text,rect)${keyHas("funnel-")}${keyEnds(`:${stage}`)}){--d:0;--h:1}`;
  }
  // bklit's per-stage label overlays carry `cursor-pointer` (funnel-chart.tsx:1012); they tile every stage cell, so the host carries it.
  css += `${HOST}{cursor:pointer}`;
  for (const layer of range(layerCount)) {
    const sel = layerSel(layer);
    css += `${HOST}[data-hover] ${sel}{fill-opacity:calc(var(--bkm-r${layer}) + var(--d,1) * (var(--bkm-m${layer}) - var(--bkm-r${layer})))}`;
    // The resting pop (the spring's target, which also paints an element the renderer recreates mid-hover). bklit renders the same spring-driven rings
    // inside the entering stage (funnel-chart.tsx:319-378, HRing :171-202), so it is not gated: it composes with the entrance's `scale` (entrance-css.ts).
    css += `${HOST} ${sel}{transform:scale(calc(1 + var(--h,0) * var(--bkm-px) * var(--bkm-pop${layer})),calc(1 + var(--h,0) * var(--bkm-py) * var(--bkm-pop${layer})))}`;
    css += `${HOST} ${sel}${NOT_MOTION}{transition:fill-opacity ${FILL_TWEEN_MS}ms ${FILL_TWEEN_EASE}}`;
  }
  // bklit's 0.4 group opacity as a colour mix (per-node opacity would show the pill through its text); the pill's percentage text is not mixed.
  for (const [prefix, colour] of LABEL_FILLS) {
    css += `${HOST}[data-hover] :is(text,rect)${keyStarts(`funnel-${prefix}`)}{fill:${mix(colour)}}`;
  }
  // Label opacity springs on 300/24 (funnel-chart.tsx:1011-1017, pop-spring.ts); the pill shadow is bklit `shadow-sm`, dimmed with --d.
  css += `${HOST} rect${keyStarts("funnel-pill-")}{filter:${shadow(".1")}}`;
  css += `${HOST}[data-hover] rect${keyStarts("funnel-pill-")}{filter:${shadow(DIMMED_SHADOW_ALPHA)}}`;
  return css;
};

const cssByLayers = new Map<number, string>();

/** Stylesheet text; only the per-layer rules depend on `layers` (cached per layer count). */
const funnelHoverCss = (layers: number): string => {
  const count = Math.min(layers, MAX_LAYERS);
  let css = cssByLayers.get(count);
  if (css === undefined) {
    css = staticRules(count);
    cssByLayers.set(count, css);
  }
  return css;
};

/** Per-host custom properties derived from `layers` and orientation (props, not hover state). */
const funnelHoverVars = (
  layers: number,
  horizontal: boolean,
  ring: (layer: number, layers: number) => number,
  dim: (layer: number, layers: number) => number,
  pop: (layer: number, layers: number) => number,
): CSSProperties => {
  const vars: [string, string][] = [["--bkm-px", horizontal ? "0" : "1"], ["--bkm-py", horizontal ? "1" : "0"]];
  for (const layer of range(Math.min(layers, MAX_LAYERS))) {
    vars.push([`--bkm-r${layer}`, String(ring(layer, layers))], [`--bkm-m${layer}`, String(dim(layer, layers))], [`--bkm-pop${layer}`, String(pop(layer, layers))]);
  }
  return Object.fromEntries<string>(vars);
};

export { AREA_PATH, funnelHoverCss, funnelHoverVars, MAX_STAGES };
