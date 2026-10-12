// The prop-derived numbers funnel.css reads, as custom properties on the host (hover and entrance state are never props of the definition).
import type { CSSProperties } from "react";
import { toCssEase } from "../kit/motion/enter-transition";
import { range } from "../kit/range";

/** funnel.css carries one index rule per stage up to this count. */
const MAX_STAGES = 24;
const MAX_LAYERS = 8;

/** Per-layer ring rest alpha, dimmed alpha and pop, and the pop axis (`--bkm-px` / `--bkm-py`). */
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

interface FunnelEntranceInput {
  readonly horizontal: boolean;
  readonly staggerDelaySec: number;
  readonly durationSec: number;
  readonly ease: readonly number[] | undefined;
}

/** Entrance duration, easing, grow origin and stage stagger (the stage index is `--i` in funnel.css). */
const funnelEntranceVars = (input: Readonly<FunnelEntranceInput>): CSSProperties => Object.fromEntries<string>([
  ["--bkm-e-dur", `${Math.round(input.durationSec * 1000)}ms`],
  ["--bkm-e-ease", toCssEase(input.ease)],
  ["--bkm-e-origin", input.horizontal ? "0% 50%" : "50% 0%"],
  ["--bkm-e-stagger", `${Math.round(input.staggerDelaySec * 1000)}ms`],
]);

export { funnelEntranceVars, funnelHoverVars, MAX_STAGES };
