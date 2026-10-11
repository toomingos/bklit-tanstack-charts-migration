import { REVEAL_CSS_EASE } from "../kit/motion/easing";
import { NOT_MOTION } from "../kit/css-hooks";

// Sankey hover is static scoped CSS: per-index `--d` / `--h` rules edited in place through the CSSOM, never chart state or renderer-owned DOM.
// Transitions carry NOT_MOTION; a phase epsilon keeps CSS from reversing a transition (bklit restarts over the full duration).
const VALUE_LABEL_OPACITY = 0.6;
const DIMMED_VALUE_SCALE = 0.8;
const HOVER_STROKE_BOOST = 1.3;
const FLOW_TWEEN = "180ms cubic-bezier(0,0,.58,1)";

// Mark ids are matched through data-ts-key (gap #36: rect/text/link marks document no className/id hook).
const HOST = '[data-bkm-chart="sankey"]';
const NODE_GROUP = 'g[data-ts-key^="sankey:sankey-node-"]';
const NAME_TEXT = 'g[data-ts-key="sankey:nlabel"] > text';
const VALUE_TEXT = 'g[data-ts-key="sankey:vlabel"] > text';
const FLOW_PATH = 'g[data-ts-key="sankey:flow"] > path';

const staticRules = (): string => {
  let css = `${HOST} ${NODE_GROUP} > rect${NOT_MOTION}{opacity:calc(1 + var(--d,0) * (var(--bkm-sk-nf) - 1));transition:opacity var(--bkm-sankey-dur,1100ms) var(--bkm-sankey-ease,${REVEAL_CSS_EASE}) calc(var(--bkm-sk-i) / var(--bkm-sankey-n,1) * 0.24 * var(--bkm-sankey-dur,1100ms))}`;
  css += `${HOST} ${NAME_TEXT}${NOT_MOTION}{fill:color-mix(in srgb,var(--foreground) calc((1 + var(--d,0) * (var(--bkm-sk-nf) - 1)) * 100%),transparent)}`;
  css += `${HOST} ${VALUE_TEXT}${NOT_MOTION}{fill:color-mix(in srgb,var(--foreground) calc((${VALUE_LABEL_OPACITY} + var(--d,0) * (var(--bkm-sk-nf) * ${DIMMED_VALUE_SCALE} - ${VALUE_LABEL_OPACITY})) * 100%),transparent)}`;
  css += `${HOST} ${FLOW_PATH}${NOT_MOTION}{stroke-opacity:calc(var(--bkm-sk-lo) + var(--d,0) * (var(--bkm-sk-lf) - var(--bkm-sk-lo)) + var(--h,0) * (var(--bkm-sk-lh) - var(--bkm-sk-lo)));transition:stroke-opacity ${FLOW_TWEEN}}`;
  return css;
};

/** Index caps of the fixed rule set: elements past them are not dimmed by hover. */
const SANKEY_HOVER_CAP_NODES = 32;
const SANKEY_HOVER_CAP_FLOWS = 96;

/** Per-index rules scoped to one chart (`data-bkm-sk-id` on its host): node rules (index `i`), then flow rules (`SANKEY_HOVER_CAP_NODES + i`), every value at rest; rendered once, the writer edits declarations in place.
 * Keys via `data-ts-key`: no className hook on rect/text/link marks (UPSTREAM-GAPS #36). */
const sankeyIndexCss = (id: string): string => {
  const host = `${HOST}[data-bkm-sk-id="${id}"]`;
  let css = "";
  for (let i = 0; i < SANKEY_HOVER_CAP_NODES; i += 1) {
    css += `${host} :is(g[data-ts-key="sankey:sankey-node-${i}"],g[data-ts-key="sankey:nlabel"] > text[data-ts-key$=":number:${i}"],g[data-ts-key="sankey:vlabel"] > text[data-ts-key$=":number:${i}"]){--d:0}`;
  }
  for (let i = 0; i < SANKEY_HOVER_CAP_FLOWS; i += 1) {
    css += `${host} g[data-ts-key="sankey:flow"] > path[data-ts-key$=":number:${i}"]{--d:0;--h:0}`;
  }
  return css;
};

const STATIC_CSS = staticRules();

/** Static (data-independent) stylesheet text. */
const sankeyHoverCss = (): string => STATIC_CSS;

interface SankeyHoverVars {
  readonly "--bkm-sk-lf": number;
  readonly "--bkm-sk-lh": number;
  readonly "--bkm-sk-lo": number;
  readonly "--bkm-sk-nf": number;
}

/** Per-host custom properties from the faded / rest opacities (props, not hover state). */
const sankeyHoverVars = (fadedNode: number, fadedLink: number, strokeOpacity: number): SankeyHoverVars => ({
  "--bkm-sk-lf": fadedLink,
  "--bkm-sk-lh": Math.min(1, strokeOpacity * HOVER_STROKE_BOOST),
  "--bkm-sk-lo": strokeOpacity,
  "--bkm-sk-nf": fadedNode,
});

interface SankeyLinkRef {
  readonly source: number;
  readonly target: number;
}

type SankeyHoverFocus = { readonly node: number } | { readonly link: number };

interface SankeyHoverSets {
  readonly nodes: readonly number[];
  readonly links: readonly number[];
}

/** The active node / flow indices for a focused node (itself, its flows and their far ends) or a focused flow (it and its two ends). */
const sankeyHoverSets = (links: readonly SankeyLinkRef[], focus: SankeyHoverFocus): SankeyHoverSets => {
  const nodes = new Set<number>();
  const flows: number[] = [];
  if ("node" in focus) {
    nodes.add(focus.node);
    for (const [index, row] of links.entries()) {
      if (row.source === focus.node || row.target === focus.node) {
        flows.push(index);
        nodes.add(row.source);
        nodes.add(row.target);
      }
    }
  } else {
    const row = links.at(focus.link);
    if (row !== undefined) {
      flows.push(focus.link);
      nodes.add(row.source);
      nodes.add(row.target);
    }
  }
  return { links: flows, nodes: [...nodes] };
};

const EPSILON = 0.0002;
const PHASES = 3;
const FLOW_FADED = 1;
const FLOW_HOT = 2;

const flowState = (hovered: boolean, active: boolean): number => {
  if (!hovered) { return 0; }
  return active ? FLOW_HOT : FLOW_FADED;
};

interface Slot {
  /** Node: 1 dimmed. Flow: 0 rest, 1 faded, 2 hot (the value-distinct states). */
  state: number;
  phase: number;
}

/** Per-chart memory of each index's last written state, so a hover change edits only the rules whose own state changed. */
interface SankeyHoverWriter {
  write: (sheet: CSSStyleSheet | null, sets: SankeyHoverSets | null, counts: { readonly nodes: number; readonly links: number }) => void;
}

const slotOf = (list: Slot[], index: number): Slot => (list[index] ??= { phase: 0, state: 0 });
// The fraction of a state with its phase nudge: the state's own end (0 or 1) pulled in by phase * EPSILON.
const fraction = (on: boolean, phase: number): string => String(on ? 1 - phase * EPSILON : phase * EPSILON);
const advance = (slot: Slot, state: number): boolean => {
  if (slot.state === state) { return false; }
  slot.state = state;
  slot.phase = (slot.phase + 1) % PHASES;
  return true;
};
const ruleAt = (sheet: CSSStyleSheet, index: number): CSSStyleDeclaration | null => {
  const rule = sheet.cssRules[index];
  return rule instanceof CSSStyleRule ? rule.style : null;
};

const createSankeyHoverWriter = (): SankeyHoverWriter => {
  let nodes: Slot[] = [];
  let flows: Slot[] = [];
  let current: CSSStyleSheet | null = null;
  return {
    write: (sheet, sets, counts) => {
      if (sheet === null) { return; }
      // A new sheet (remount, text change) starts every rule at rest.
      if (sheet !== current) {
        current = sheet;
        nodes = [];
        flows = [];
      }
      const activeNodes = new Set<number>(sets?.nodes);
      const activeFlows = new Set<number>(sets?.links);
      const hovered = sets !== null;
      for (let index = 0; index < Math.min(counts.nodes, SANKEY_HOVER_CAP_NODES); index += 1) {
        const slot = slotOf(nodes, index);
        if (advance(slot, hovered && !activeNodes.has(index) ? 1 : 0)) {
          ruleAt(sheet, index)?.setProperty("--d", fraction(slot.state === 1, slot.phase));
        }
      }
      for (let index = 0; index < Math.min(counts.links, SANKEY_HOVER_CAP_FLOWS); index += 1) {
        const slot = slotOf(flows, index);
        const state = flowState(hovered, activeFlows.has(index));
        if (advance(slot, state)) {
          const rule = ruleAt(sheet, SANKEY_HOVER_CAP_NODES + index);
          rule?.setProperty("--d", fraction(state === FLOW_FADED, slot.phase));
          rule?.setProperty("--h", fraction(state === FLOW_HOT, slot.phase));
        }
      }
    },
  };
};

export { createSankeyHoverWriter, sankeyHoverCss, sankeyHoverSets, sankeyHoverVars, sankeyIndexCss };
export type { SankeyHoverFocus };
