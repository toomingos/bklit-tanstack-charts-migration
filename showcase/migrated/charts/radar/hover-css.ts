// Radar hover as static scoped CSS keyed on host `data-hover="<series>"` (written from the hover store; see hover-springs.ts), so hover never rebuilds the definition.
// Transitions carry `NOT_MOTION` so they never fight a native tween.
import { NOT_MOTION } from "../kit/renderer-dom";

export const MAX_SERIES = 12;
const HOVER_SCALE_DELTA = 0.05;
const DIM_OPACITY = 0.3;
const DIM_TWEEN_MS = 150;
const GLOW_BLUR_PX = 12;
const LABEL_TWEEN_MS = 150;
const LABEL_INTERACTIVE = "g.bkm-radar-label-i";
const HOST = "[data-bkm-radar]";
// Series groups carry the radialArea/radialDot `className` set in radar/definition.ts (reference/marks/polar.md).
const SERIES_GROUPS = "g.bkm-radar-area,g.bkm-radar-dot";
const AREA_GROUPS = "g.bkm-radar-area";
const DOT_GROUPS = "g.bkm-radar-dot";

const radarHoverCss = (): string => {
  let css = "";
  for (let series = 0; series < MAX_SERIES; series += 1) {
    const area = `g.bkm-radar-area.bkm-radar-s${series}`;
    css += `${HOST}[data-hover="${series}"] :is(${area},g.bkm-radar-dot.bkm-radar-s${series}){--bkm-h:1}`;
    css += `${HOST}[data-bkm-glow][data-hover="${series}"] ${area} path{filter:drop-shadow(0 0 ${GLOW_BLUR_PX}px var(--bkm-radar-glow))}`;
  }
  // Hover scale waits for the native entrance tween (role marker, no public hook: UPSTREAM-GAPS #36) and then scales about the fill-box centre.
  // --bkm-p (entrance.ts) is the dot travel progress, 1 once settled, so only the dot groups carry it into the scale.
  css += `${HOST} :is(${SERIES_GROUPS})${NOT_MOTION}{transform-box:fill-box;transform-origin:50% 50%}`;
  css += `${HOST} ${AREA_GROUPS}${NOT_MOTION}{transform:scale(calc(1 + ${HOVER_SCALE_DELTA} * var(--bkm-h,0)))}`;
  css += `${HOST} ${DOT_GROUPS}{transform:scale(calc((1 + ${HOVER_SCALE_DELTA} * var(--bkm-h,0)) * max(.001, var(--bkm-p))))}`;
  css += `${HOST} :is(${SERIES_GROUPS})${NOT_MOTION}{transition:opacity ${DIM_TWEEN_MS}ms ease-out}`;
  css += `${HOST}[data-hover] :is(${SERIES_GROUPS}){opacity:calc(1 - ${1 - DIM_OPACITY} * (1 - var(--bkm-h,0)))}`;
  // Interactive axis labels (bklit `transition-opacity duration-150 cursor-pointer`): rest 0.8 -> 1 on hover; the native state layer
  // swaps the fill attribute, so the 150ms ease rides on a CSS fill transition.
  css += `${HOST} ${LABEL_INTERACTIVE}{cursor:pointer}`;
  css += `${HOST} ${LABEL_INTERACTIVE} text${NOT_MOTION}{transition:fill ${LABEL_TWEEN_MS}ms cubic-bezier(.4,0,.2,1)}`;
  css += `${HOST} ${AREA_GROUPS} path{fill-opacity:calc(.15 + .2 * var(--bkm-h,0));stroke-width:calc(2px + 1px * var(--bkm-h,0))}`;
  css += `${HOST} ${DOT_GROUPS} circle{r:calc(4px + 2px * var(--bkm-h,0))}`;
  return css;
};

export { HOVER_SCALE_DELTA };
export const RADAR_HOVER_CSS = radarHoverCss();
