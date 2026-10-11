import { REVEAL_CSS_EASE } from "../kit/motion/easing";
import type { ArcDatum } from "./arcs";
import type { SunburstLabelsProps } from "./carriers";
import { sunburstCssVars } from "./colors";
import { LABEL_PUSH_TRANSITION, PUSH_CAP } from "./push";
import type { SunburstNativeNode } from "./sunburst-mark";

/** Labels fade in once this fraction of the sweep has played. */
export const LABEL_START_RATIO = 0.85;
const DEFAULT_LABEL_FONT_SIZE = 11;
const LABEL_FONT_WEIGHT = 600;
const DEFAULT_LABEL_HALO = 2.5;

// bklit drops unrelated labels the moment one is hovered. The related set lives on the host (`data-bk-rel`): every scene repaint strips foreign attributes from the elements it reconciles, so a per-label marker would not survive the hover repaint. Rules per arc index, like the push rules.
const labelHideCss = (count: number): string => Array.from({ length: Math.min(count, PUSH_CAP) }, (_, i) => `[data-bk-hov]:not([data-bk-rel~="${i}"]) .bk-sb-l-${i}{visibility:hidden}`).join("");

export const labelCss = (count: number): string => `.bk-sunburst-label{transition:${LABEL_PUSH_TRANSITION}}.bk-sunburst-label{paint-order:stroke;stroke-linejoin:round;pointer-events:none}[data-bk-intro] .bk-sunburst-label{animation:bk-sb-label-in var(--bk-sb-label-dur,1100ms) ${REVEAL_CSS_EASE} var(--bk-sb-label-delay,0ms) backwards}@keyframes bk-sb-label-in{from{opacity:0}}${labelHideCss(count)}`;

interface LabelsOption {
  readonly fill: string;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly nameOf: (node: SunburstNativeNode) => string;
  readonly classOf: (node: SunburstNativeNode) => string;
}

/** The mark's label decoration for the `SunburstLabels` carrier, or undefined when the chart has none. */
export const labelsOption = (labels: SunburstLabelsProps | null, arcById: ReadonlyMap<string, ArcDatum>): LabelsOption | undefined =>
  labels === null
    ? undefined
    : {
        fill: labels.fill ?? sunburstCssVars.label,
        fontSize: labels.fontSize ?? DEFAULT_LABEL_FONT_SIZE,
        fontWeight: LABEL_FONT_WEIGHT,
        stroke: labels.stroke ?? sunburstCssVars.background,
        strokeWidth: labels.strokeWidth ?? DEFAULT_LABEL_HALO,
        nameOf: (node: SunburstNativeNode): string => arcById.get(node.id)?.name ?? node.name,
        classOf: (node: SunburstNativeNode): string => `bk-sb-l-${arcById.get(node.id)?.arcIndex ?? -1}`,
      };
