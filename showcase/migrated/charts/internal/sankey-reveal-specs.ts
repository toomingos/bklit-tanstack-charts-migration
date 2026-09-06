// Sankey reveal spec builders: queries, animation specs, and spec playback.
const SANKEY_NODE_STAGGER_FRACTION = 0.4;
const SANKEY_NAME_LABEL_WINDOW_FRACTION = 0.6;
const SANKEY_NAME_LABEL_OFFSET_FRACTION = 0.3;
const SANKEY_VALUE_LABEL_DELAY_MS = 60;
const SANKEY_LABEL_SLIDE_PX = 20;
const SANKEY_LINK_START_FRACTION = 0.2;
const SANKEY_LINK_WINDOW_FRACTION = 0.8;
const SANKEY_LINK_STAGGER_FRACTION = 0.4;
const EMPTY_COUNT = 0;
const NO_DELAY_MS = 0;
const HALF_DIVISOR = 2;
const INDEX_STEP = 1;

const queryNodeRects = (svg: SVGSVGElement): (SVGRectElement | null)[] => [...svg.querySelectorAll<SVGRectElement>(`[data-ts-key^="sankey:sankey-node:"]`)];

const queryLinkPaths = (svg: SVGSVGElement): (SVGPathElement | null)[] => {
  const flowGroup = svg.querySelector<SVGGElement>(`[data-ts-key="sankey:flow"]`);
  return flowGroup ? [...flowGroup.querySelectorAll<SVGPathElement>('path')] : [];
}

// PathLength=1 normalizes dash units; re-stamped each render (reconciler strips it).
const stampSankeyLinkPathLength = (svg: SVGSVGElement): void => {
  for (const el of queryLinkPaths(svg)) {
    el?.setAttribute("pathLength", "1");
  }
}

interface SankeyLabelCollectionParams {
  readonly prefix: string;
  readonly svg: SVGSVGElement;
}

const collectSankeyLabels = (params: Readonly<SankeyLabelCollectionParams>): Map<number, SVGElement> => {
  const { prefix, svg } = params;
  const labels = new Map<number, SVGElement>();
  for (const label of svg.querySelectorAll<SVGElement>(`[data-ts-key^="${prefix}"]`)) {
    const index = Number(label.dataset.tsKey?.split(":").pop());
    if (!Number.isNaN(index)) {labels.set(index, label);}
  }
  return labels;
}

interface SankeySlideParams {
  readonly element: SVGElement;
  readonly svg: SVGSVGElement;
}

const resolveSankeyLabelSlidePx = (params: Readonly<SankeySlideParams>): number => {
  const { element, svg } = params;
  const anchor = element.getAttribute("text-anchor");
  if (anchor === "end") {return SANKEY_LABEL_SLIDE_PX;}
  if (anchor === "start") {return -SANKEY_LABEL_SLIDE_PX;}
  const halfWidth = (svg.viewBox.baseVal.width || svg.clientWidth) / HALF_DIVISOR;
  const positionX = Number(element.getAttribute("x") ?? "0");
  return positionX >= halfWidth ? -SANKEY_LABEL_SLIDE_PX : SANKEY_LABEL_SLIDE_PX;
}

interface SankeyAnimationSpec {
  readonly delayMs: number;
  readonly element: SVGElement;
  readonly keyframes: Keyframe[];
}

interface SankeyLabelSpecParams {
  readonly delayMs: number;
  readonly label: SVGElement;
  readonly svg: SVGSVGElement;
}

const buildSankeyLabelAnimationSpec = (params: Readonly<SankeyLabelSpecParams>): SankeyAnimationSpec => {
  const { delayMs, label, svg } = params;
  const slidePx = resolveSankeyLabelSlidePx({ element: label, svg });
  return {
    delayMs,
    element: label,
    keyframes: [
      { opacity: "0", translate: `${slidePx}px 0px` },
      { opacity: "1", translate: "0px 0px" },
    ],
  };
}

interface SankeyNodeSpecParams {
  readonly nameLabels: ReadonlyMap<number, SVGElement>;
  readonly nodeAnimDuration: number;
  readonly nodeRects: readonly (SVGRectElement | null)[];
  readonly svg: SVGSVGElement;
  readonly valueLabels: ReadonlyMap<number, SVGElement>;
}

interface SankeyNodeStaggerParams {
  readonly index: number;
  readonly nodeAnimDuration: number;
  readonly totalNodes: number;
}

// Stagger delay for one node within the node reveal window.
const resolveNodeStaggerDelayMs = (params: Readonly<SankeyNodeStaggerParams>): number => {
  const { index, nodeAnimDuration, totalNodes } = params;
  return totalNodes > EMPTY_COUNT ? (index / totalNodes) * nodeAnimDuration * SANKEY_NODE_STAGGER_FRACTION : NO_DELAY_MS;
}

interface SankeyNodeRectParams {
  readonly rect: SVGRectElement;
  readonly index: number;
  readonly nodeAnimDuration: number;
  readonly specs: SankeyAnimationSpec[];
  readonly totalNodes: number;
}

// Grow spec for one node rect; keeps the node loop under max-statements.
const appendNodeRectSpec = (params: Readonly<SankeyNodeRectParams>): void => {
  const { rect, index, nodeAnimDuration, specs, totalNodes } = params;
  const staggerDelayMs = resolveNodeStaggerDelayMs({ index, nodeAnimDuration, totalNodes });
  rect.style.transformOrigin = "center";
  specs.push({
    delayMs: staggerDelayMs,
    element: rect,
    keyframes: [
      { opacity: "0", transform: "scaleY(0)" },
      { opacity: "1", transform: "scaleY(1)" },
    ],
  });
}

interface SankeyNodeLabelParams {
  readonly index: number;
  readonly nameLabels: ReadonlyMap<number, SVGElement>;
  readonly nodeAnimDuration: number;
  readonly specs: SankeyAnimationSpec[];
  readonly svg: SVGSVGElement;
  readonly totalNodes: number;
  readonly valueLabels: ReadonlyMap<number, SVGElement>;
}

// Slide specs for one node's name and value labels; keeps the node loop under max-statements.
const appendNodeLabelSpecs = (params: Readonly<SankeyNodeLabelParams>): void => {
  const { index, nameLabels, nodeAnimDuration, specs, svg, totalNodes, valueLabels } = params;
  const staggerDelayMs = resolveNodeStaggerDelayMs({ index, nodeAnimDuration, totalNodes });
  const nameLabelDelayMs = staggerDelayMs + nodeAnimDuration * SANKEY_NAME_LABEL_WINDOW_FRACTION * SANKEY_NAME_LABEL_OFFSET_FRACTION;
  const nameLabel = nameLabels.get(index);
  const valueLabel = valueLabels.get(index);
  if (nameLabel) {
    specs.push(buildSankeyLabelAnimationSpec({ delayMs: nameLabelDelayMs, label: nameLabel, svg }));
  }
  if (valueLabel) {
    specs.push(buildSankeyLabelAnimationSpec({ delayMs: nameLabelDelayMs + SANKEY_VALUE_LABEL_DELAY_MS, label: valueLabel, svg }));
  }
}

const buildSankeyNodeAnimationSpecs = (params: Readonly<SankeyNodeSpecParams>): SankeyAnimationSpec[] => {
  const { nameLabels, nodeAnimDuration, nodeRects, svg, valueLabels } = params;
  const specs: SankeyAnimationSpec[] = [];
  for (let index = 0; index < nodeRects.length; index += INDEX_STEP) {
    const rect = nodeRects[index];
    if (rect) {
      appendNodeRectSpec({ index, nodeAnimDuration, rect, specs, totalNodes: nodeRects.length });
      appendNodeLabelSpecs({ index, nameLabels, nodeAnimDuration, specs, svg, totalNodes: nodeRects.length, valueLabels });
    }
  }
  return specs;
}

interface SankeyLinkSpecParams {
  readonly animationDuration: number;
  readonly linkPaths: readonly (SVGPathElement | null)[];
}

const buildSankeyLinkAnimationSpecs = (params: Readonly<SankeyLinkSpecParams>): SankeyAnimationSpec[] => {
  const { animationDuration, linkPaths } = params;
  const specs: SankeyAnimationSpec[] = [];
  const linkStartDelay = animationDuration * SANKEY_LINK_START_FRACTION;
  const linkAnimWindow = animationDuration * SANKEY_LINK_WINDOW_FRACTION;
  for (let index = 0; index < linkPaths.length; index += INDEX_STEP) {
    const link = linkPaths[index];
    if (link) {
      const staggerDelayMs = linkPaths.length > EMPTY_COUNT ? linkStartDelay + (index / linkPaths.length) * linkAnimWindow * SANKEY_LINK_STAGGER_FRACTION : linkStartDelay;
      specs.push({
        delayMs: staggerDelayMs,
        element: link,
        keyframes: [
          { strokeDasharray: "1 1", strokeDashoffset: "1" },
          { strokeDasharray: "1 1", strokeDashoffset: "0" },
        ],
      });
    }
  }
  return specs;
}

interface SankeyPlayParams {
  readonly animations: Animation[];
  readonly durationMs: number;
  readonly easingCss: string;
  readonly specs: readonly SankeyAnimationSpec[];
}

const playSankeyAnimationSpecs = (params: Readonly<SankeyPlayParams>): number => {
  // Renderer owns the entrance (dash draw-on needs a ruling).
  // Max delay still feeds the settle deadline.
  const { specs } = params;
  let maxDelayMs = 0;
  for (const spec of specs) {
    if (spec.delayMs > maxDelayMs) {maxDelayMs = spec.delayMs;}
  }
  return maxDelayMs;
}

export { buildSankeyLinkAnimationSpecs, buildSankeyNodeAnimationSpecs, collectSankeyLabels, playSankeyAnimationSpecs, queryLinkPaths, queryNodeRects, stampSankeyLinkPathLength };
export type { SankeyAnimationSpec };
