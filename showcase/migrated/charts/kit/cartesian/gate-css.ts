import { FOCUS_LAYERS } from "../renderer-dom";
// Visibility rules for the renderer-owned tooltip and focus layers (gap #20; no documented hook, gap #36).
const GATED_LAYERS = `.ts-chart-tooltip,${FOCUS_LAYERS}`;

/** Until the reveal timer sets `data-bkm-ready` (bklit `canInteract = isLoaded`) the host takes no pointer and the tooltip and focus layers are hidden; `deep` also hides their descendants. */
export const readyGateCss = (scope: string, deep = false): string => {
  const gated = `${scope}:not([data-bkm-ready]) :is(${GATED_LAYERS})`;
  const inert = `${scope}:not([data-bkm-ready]) .ts-chart-host{pointer-events:none}`;
  const hidden = deep ? `${gated},${gated} *{visibility:hidden}` : `${gated}{visibility:hidden}`;
  return inert + hidden;
};

/** Pointer inside the chart with no focused row (`guard` fails): the layers stay hidden until a row resolves. */
export const focusEmptyHiddenCss = (scope: string, guard = ":not([data-bkm-on])", layers = GATED_LAYERS): string =>
  `${scope}${guard} .ts-chart-surface:hover :is(${layers}){visibility:hidden}`;
