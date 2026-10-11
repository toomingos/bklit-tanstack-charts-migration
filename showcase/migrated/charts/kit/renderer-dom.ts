/** The only TS module that names renderer-owned DOM: core's fixed `ts-chart__*` classes, the `data-ts-key` encoding and `data-ts-motion-role`
 * (UPSTREAM-GAPS #36, #50). `data-ts-key` itself is documented (reference/rendering-and-export.md); the key format and the classes are not.
 * styles.css, sankey/sankey.css and live-line/liveline.css repeat these selectors because CSS cannot import them. */

const attr = (op: string, key: string): string => `[data-ts-key${op}="${key}"]`;
export const keyIs = (key: string): string => attr("", key);
export const keyStarts = (prefix: string): string => attr("^", prefix);
export const keyEnds = (suffix: string): string => attr("$", suffix);
export const keyHas = (part: string): string => attr("*", part);

export const CLS = {
  marks: ".ts-chart__marks",
  area: ".ts-chart__area",
  dot: ".ts-chart__dot",
  focusLayer: ".ts-chart__focus-layer",
  guideLayer: ".ts-chart__focus-guide-layer",
  crosshair: ".ts-chart__crosshair",
  crosshairPlot: ".ts-chart__crosshair-plot",
  crosshairMarker: ".ts-chart__crosshair-marker",
  crosshairLabelX: ".ts-chart__crosshair-label--x",
} as const;

/** Class (no dot) of a focus-guide group. Core's motion timing finds guide nodes with `closest('g.ts-chart__crosshair')`, so our own guide groups must carry it (#36). */
export const CROSSHAIR_CLASS = CLS.crosshair.slice(1);

/** Skips a node the renderer is mid-tween on (#50). */
export const NOT_MOTION = ":not([data-ts-motion-role])";

/** True when the renderer is mid-tween on `el` (#50). */
export const isMotionNode = (el: Element): boolean => el.hasAttribute("data-ts-motion-role");

/** The renderer-owned layers that the ready and focus gates hide: the focus layer and the focus-guide layer. */
export const FOCUS_LAYERS = `${CLS.focusLayer},${CLS.guideLayer}`;
