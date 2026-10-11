// gap #36 / #47: data-ts-key selectors, no scale enter. Scoped CSS entrance mirroring bklit `motion.path`: scale+fade about the notch centre,
// delays bg i*15ms, active (300+i*20)ms, times stagger; `:nth-child` index rules capped at 128; vars `--bkm-gn-dur|ease|s`.
/** Origin of each entrance animation: bklit's opacity is a WAAPI animation, its scale a JS-driven one (see `alignEntranceStart`). */
export const GAUGE_ENTRANCE_ORIGINS = { "bkm-gn-fade": "frame", "bkm-gn-grow": "motion" } as const;
const MAX_NOTCHES = 128;
const BG_STEP_MS = 15;
const ACTIVE_BASE_MS = 300;
const ACTIVE_STEP_MS = 20;
const NOTCH = ":is(path,rect)";

// gap #36: the notch groups are reached through data-ts-key (path/rect marks have no className hook).
const indexRules = (): string => {
  let css = "";
  for (let i = 0; i < MAX_NOTCHES; i += 1) {
    css += `[data-bkm-gn] g[data-ts-key^="gauge:"]>:nth-child(${i + 1}){--gi:${i}}`;
  }
  return css;
};

export const GAUGE_ENTER_CSS = [
  "@keyframes bkm-gn-grow{from,to{transform-box:fill-box;transform-origin:50% 50%}from{scale:0}to{scale:1}}@keyframes bkm-gn-fade{from{opacity:0}to{opacity:1}}",
  `[data-bkm-gn] g[data-ts-key^="gauge:"] ${NOTCH}{animation:bkm-gn-grow var(--bkm-gn-dur) var(--bkm-gn-ease) backwards,bkm-gn-fade var(--bkm-gn-dur) var(--bkm-gn-ease) backwards}`,
  `[data-bkm-gn] g[data-ts-key="gauge:bg"] ${NOTCH}{animation-delay:calc(var(--gi,${MAX_NOTCHES}) * ${BG_STEP_MS}ms * var(--bkm-gn-s))}`,
  `[data-bkm-gn] g[data-ts-key="gauge:active"] ${NOTCH}{animation-delay:calc((${ACTIVE_BASE_MS}ms + var(--gi,${MAX_NOTCHES}) * ${ACTIVE_STEP_MS}ms) * var(--bkm-gn-s))}`,
  `[data-bkm-gn-hold] g[data-ts-key^="gauge:"] ${NOTCH}{animation-play-state:paused}`,
  indexRules(),
].join("");
