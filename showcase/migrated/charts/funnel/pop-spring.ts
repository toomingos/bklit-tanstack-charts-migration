// Gaps #16 (states carry no transform key, so the pop cannot be a state; posted #194) and #36 (renderer selectors, kit/renderer-dom.ts): bklit HRing's velocity-keeping spring (funnel-chart.tsx:171-202)
// on the shared WAAPI driver (kit/motion/spring-animate.ts); the resting transform stays static CSS (hover-css.ts), the animation only draws the travel.
import { AREA_PATH } from "./hover-css";
import { readHoverIndex } from "../kit/host-write";
import { springDriver as driver } from "../kit/motion/spring-animate";
import type { Spring } from "../kit/motion/springs";
import { range } from "../kit/range";
import { keyEnds, keyStarts } from "../kit/renderer-dom";

const MAX_LAYERS = 8;
const MAX_STAGES = 24;
const DIM_PERCENT = 60;
/** bklit's per-stage label overlay: a motion opacity spring (funnel-chart.tsx:1011-1017) on 300/24 both ways. */
const LABEL_SPRING: Spring = { damping: 24, mass: 1, stiffness: 300 };
const LABEL_FILLS: readonly (readonly [string, string])[] = [
  ["value", "var(--foreground)"], ["pill", "var(--foreground)"], ["name", "var(--muted-foreground)"],
];
const labelKey = (prefix: string): string => `:is(text,rect)${keyStarts(`funnel-${prefix}`)}`;

/** bklit HRing: stiffness 300 - 60i, damping 24 - 3i (clamped so the outer rings of a deep funnel stay a valid spring). */
const ringSpring = (layer: number): Spring => ({ damping: Math.max(6, 24 - layer * 3), mass: 1, stiffness: Math.max(60, 300 - layer * 60) });

interface FunnelPopOptions {
  readonly horizontal: boolean;
  readonly layers: number;
  /** Rest-to-hot scale delta of a ring (marks.ts popExtra). */
  readonly popOf: (layer: number, layers: number) => number;
}

interface FunnelPop {
  /** The hovered stage changed (null = none): every ring of the previous and the new stage springs to its new target from its live state. */
  readonly to: (stage: number | null) => void;
  /** The stage's rings remount at rest in bklit (enterComplete): a hovered stage springs up from rest again. */
  readonly restart: (stage: number) => void;
  readonly dispose: () => void;
}


const ringsOf = (host: HTMLElement, stage: number, layers: number): { readonly el: SVGElement; readonly layer: number }[] => {
  const rings: { el: SVGElement; layer: number }[] = [];
  for (let layer = 0; layer < Math.min(layers, MAX_LAYERS); layer += 1) {
    for (const el of host.querySelectorAll<SVGElement>(`${AREA_PATH}${keyStarts(`funnel-s${stage}-l${layer}:`)}`)) { rings.push({ el, layer }); }
  }
  return rings;
};

/** The dim as a colour mix (a per-node opacity would show the pill through its text): `dim` 0 = full, 1 = bklit's 0.4 group opacity. */
const dimmedFill = (colour: string, dim: number): string => `color-mix(in srgb,${colour} ${Math.min(100, Math.max(0, 100 - dim * DIM_PERCENT))}%,transparent)`;

const dimOf = (stage: number, hovered: number | null): number => (hovered !== null && hovered !== stage ? 1 : 0);

const createFunnelPop = (host: HTMLElement, options: Readonly<FunnelPopOptions>): FunnelPop => {
  // Picks up a hover already painted on the host: this pop is rebuilt when `horizontal`/`layers` change, and a fresh `null` would make the
  // next leave a no-op while the rings still sit at the hot value. The shared driver keeps the live state of the elements across the rebuild.
  let current = readHoverIndex(host);
  const targetOf = (stage: number, layer: number, hovered: number | null): number => (stage === hovered ? options.popOf(layer, options.layers) : 0);
  const scaleOf = (value: number): string => (options.horizontal ? `scale(1,${1 + value})` : `scale(${1 + value},1)`);
  const play = (el: SVGElement, layer: number, rest: number, target: number, from?: number): void => {
    driver.play({ el, frame: (value) => ({ transform: scaleOf(value) }), from, rest, spring: ringSpring(layer), target });
  };

  const playLabels = (stage: number, previous: number | null, next: number | null): void => {
    for (const [prefix, colour] of LABEL_FILLS) {
      for (const el of host.querySelectorAll<SVGElement>(`${labelKey(prefix)}${keyEnds(`:${stage}`)}`)) {
        driver.play({ el, frame: (value) => ({ fill: dimmedFill(colour, value) }), rest: dimOf(stage, previous), spring: LABEL_SPRING, target: dimOf(stage, next) });
      }
    }
  };

  return {
    dispose: () => { current = null; },
    restart: (stage) => {
      if (stage !== current) { return; }
      for (const { el, layer } of ringsOf(host, stage, options.layers)) { play(el, layer, 0, targetOf(stage, layer, current), 0); }
    },
    to: (stage) => {
      const previous = current;
      if (stage === previous) { return; }
      current = stage;
      // Every stage's label dims or restores when the hover enters or leaves the chart; otherwise only the two stages involved change.
      const labelled = previous === null || stage === null ? range(MAX_STAGES) : [previous, stage];
      for (const label of labelled) { playLabels(label, previous, stage); }
      for (const touched of new Set([previous, stage])) {
        if (touched !== null) {
          for (const { el, layer } of ringsOf(host, touched, options.layers)) { play(el, layer, targetOf(touched, layer, previous), targetOf(touched, layer, current)); }
        }
      }
    },
  };
};

export { createFunnelPop };
export type { FunnelPop };
