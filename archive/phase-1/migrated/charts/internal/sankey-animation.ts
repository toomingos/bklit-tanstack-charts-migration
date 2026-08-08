// Sankey WAAPI reveal animation + label/gradient injection.
// Called from onRender callback — SVG DOM guaranteed ready by TanStack.

import type { SankeyLabelOrientation } from "../sankey-chart";
import { intFmt } from "./formatters";
import type { LaidOutNode, LaidOutLink } from "./sankey-layout";
import type { SankeyGradientDatum } from "./sankey-mark";

const LABEL_OFFSET = 12;
const VALUE_LABEL_GAP = 16;

function computeDisplayValue(node: LaidOutNode, nodeIndex: number, links: LaidOutLink[]): number {
  const category = (node as { category?: string }).category;
  let displayValue = 0;
  for (const l of links) {
    const sIdx = (l as { source: LaidOutNode }).source?.index;
    const tIdx = (l as { target: LaidOutNode }).target?.index;
    if (category === "source" && sIdx === nodeIndex) {
      displayValue += (l as { value: number }).value ?? 0;
    } else if (category !== "source" && tIdx === nodeIndex) {
      displayValue += (l as { value: number }).value ?? 0;
    }
  }
  return displayValue;
}

export function injectGradientDefs(svg: SVGSVGElement, gradients: SankeyGradientDatum[]): void {
  if (gradients.length === 0) return;

  let defs = svg.querySelector<SVGDefsElement>("defs.ts-sankey__gradients");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.classList.add("ts-sankey__gradients");
    svg.insertBefore(defs, svg.firstChild);
  }

  const htmlFrag = gradients
    .map(
      (g) =>
        `<linearGradient id="${g.id}" gradientUnits="userSpaceOnUse" x1="${g.x1}" y1="0" x2="${g.x2}" y2="0">` +
        `<stop offset="0%" stop-color="${g.sourceColor}" stop-opacity="1"/>` +
        `<stop offset="100%" stop-color="${g.targetColor}" stop-opacity="1"/>` +
        `</linearGradient>`,
    )
    .join("");

  defs.innerHTML = htmlFrag;
}

export function injectLabelCssTransitions(svg: SVGSVGElement): void {
  if (svg.querySelector("style.ts-sankey__transitions")) return;

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.classList.add("ts-sankey__transitions");
  style.textContent = `
    .ts-sankey__node rect { transition: opacity 0.18s ease-out; }
    .ts-sankey__links > path { transition: opacity 0.18s ease-out; }
    [data-bkm-sankey-label], [data-bkm-sankey-valuelabel] { transition: opacity 0.18s ease-out; }
  `;
  svg.insertBefore(style, svg.firstChild);
}

export function injectSankeyLabels(
  svg: SVGSVGElement,
  layout: { nodes: LaidOutNode[]; links: LaidOutLink[] },
  showLabels: boolean,
  showValueLabels: boolean,
  orientation: SankeyLabelOrientation,
): void {
  if (!showLabels) return;

  let nodeMinX = Infinity;
  let nodeMaxX = -Infinity;
  for (const n of layout.nodes) {
    const nx = n.x0 ?? 0;
    const nx1 = n.x1 ?? 0;
    if (nx < nodeMinX) nodeMinX = nx;
    if (nx1 > nodeMaxX) nodeMaxX = nx1;
  }
  const chartMidX = isFinite(nodeMinX) && isFinite(nodeMaxX) ? (nodeMinX + nodeMaxX) / 2 : 200;

  let labelsGroup = svg.querySelector<SVGGElement>("g.ts-sankey__labels");
  if (labelsGroup) {
    labelsGroup.innerHTML = "";
  } else {
    labelsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labelsGroup.classList.add("ts-sankey__labels");
    svg.appendChild(labelsGroup);
  }

  const NS = "http://www.w3.org/2000/svg";

  layout.nodes.forEach((node, index) => {
    const nodeX = node.x0 ?? 0;
    const nodeY = node.y0 ?? 0;
    const nodeW = Math.max(0, (node.x1 ?? 0) - nodeX);
    const nodeH = Math.max(0, (node.y1 ?? 0) - nodeY);
    const centerY = nodeY + nodeH / 2;
    const isLeftSide = nodeX < chartMidX;
    const nodeName = (node as { name: string }).name ?? `Node ${index}`;

    if (orientation === "horizontal") {
      const labelX = isLeftSide ? nodeX - LABEL_OFFSET : nodeX + nodeW + LABEL_OFFSET;
      const anchor = isLeftSide ? "end" : "start";

      const nameG = document.createElementNS(NS, "g");
      nameG.setAttribute("transform", `translate(${labelX},${centerY})`);
      nameG.setAttribute("data-bkm-sankey-label", "");
      nameG.setAttribute("data-node-index", String(index));
      nameG.style.opacity = "0";
      const nameText = document.createElementNS(NS, "text");
      nameText.setAttribute("dy", "0.35em");
      nameText.setAttribute("text-anchor", anchor);
      nameText.setAttribute("fill", "var(--foreground)");
      nameText.setAttribute("font-size", "13px");
      nameText.setAttribute("font-weight", "500");
      nameText.textContent = nodeName;
      nameG.appendChild(nameText);
      labelsGroup!.appendChild(nameG);

      if (showValueLabels) {
        const displayVal = computeDisplayValue(node, index, layout.links);
        const valG = document.createElementNS(NS, "g");
        valG.setAttribute("transform", `translate(${labelX},${centerY + VALUE_LABEL_GAP})`);
        valG.setAttribute("data-bkm-sankey-valuelabel", "");
        valG.setAttribute("data-node-index", String(index));
        valG.style.opacity = "0";
        const valText = document.createElementNS(NS, "text");
        valText.setAttribute("dy", "0.35em");
        valText.setAttribute("text-anchor", anchor);
        valText.setAttribute("fill", "var(--foreground)");
        valText.setAttribute("font-size", "11px");
        valText.textContent = `${intFmt(displayVal)} sessions`;
        valG.appendChild(valText);
        labelsGroup!.appendChild(valG);
      }
    } else {
      const labelX = isLeftSide ? nodeX - LABEL_OFFSET : nodeX + nodeW + LABEL_OFFSET;
      const rotate = isLeftSide ? -90 : 90;
      const halfGap = VALUE_LABEL_GAP / 2;

      const nameLocalX = showValueLabels ? (isLeftSide ? halfGap : -halfGap) : 0;

      const nameG = document.createElementNS(NS, "g");
      nameG.setAttribute("transform", `translate(${labelX},${centerY}) rotate(${rotate})`);
      nameG.setAttribute("data-bkm-sankey-label", "");
      nameG.setAttribute("data-node-index", String(index));
      nameG.style.opacity = "0";
      const nameText = document.createElementNS(NS, "text");
      nameText.setAttribute("x", String(nameLocalX));
      nameText.setAttribute("dy", "0.35em");
      nameText.setAttribute("text-anchor", "middle");
      nameText.setAttribute("fill", "var(--foreground)");
      nameText.setAttribute("font-size", "13px");
      nameText.setAttribute("font-weight", "500");
      nameText.textContent = nodeName;
      nameG.appendChild(nameText);
      labelsGroup!.appendChild(nameG);

      if (showValueLabels) {
        const displayVal = computeDisplayValue(node, index, layout.links);
        const valueLocalX = isLeftSide ? -halfGap : halfGap;

        const valG = document.createElementNS(NS, "g");
        valG.setAttribute("transform", `translate(${labelX},${centerY}) rotate(${rotate})`);
        valG.setAttribute("data-bkm-sankey-valuelabel", "");
        valG.setAttribute("data-node-index", String(index));
        valG.style.opacity = "0";
        const valText = document.createElementNS(NS, "text");
        valText.setAttribute("x", String(valueLocalX));
        valText.setAttribute("dy", "0.35em");
        valText.setAttribute("text-anchor", "middle");
        valText.setAttribute("fill", "var(--foreground)");
        valText.setAttribute("font-size", "11px");
        valText.textContent = `${intFmt(displayVal)} sessions`;
        valG.appendChild(valText);
        labelsGroup!.appendChild(valG);
      }
    }
  });
}

export function runSankeyReveal(
  svg: SVGSVGElement,
  layout: { nodes: LaidOutNode[]; links: LaidOutLink[] },
  animationDuration: number,
  nodeGroups: (SVGGElement | null)[],
  linkPaths: (SVGPathElement | null)[],
): Animation[] {
  const animations: Animation[] = [];
  const totalNodes = layout.nodes.length;
  const totalLinks = layout.links.length;
  const nodeAnimDuration = animationDuration * 0.6;
  const revealDuration = 1100;

  // ── Node rect animation ──
  for (let i = 0; i < nodeGroups.length; i++) {
    const group = nodeGroups[i];
    if (!group) continue;
    const stagDelayMs = totalNodes > 0 ? (i / totalNodes) * nodeAnimDuration * 0.4 : 0;

    const rect = group.querySelector("rect");
    if (rect) {
      (rect as SVGElement).style.transformOrigin = "center";
      const anim = (rect as SVGElement).animate(
        [
          { transform: "scaleY(0)", opacity: "0" },
          { transform: "scaleY(1)", opacity: "1" },
        ],
        {
          duration: revealDuration,
          delay: stagDelayMs,
          easing: "cubic-bezier(0.85, 0, 0.15, 1)",
          fill: "backwards",
        },
      );
      animations.push(anim);
    }

    // ── Label animations ──
    const nameLabelDelayMs = stagDelayMs + nodeAnimDuration * 0.6 * 0.3;
    const valueLabelDelayMs = nameLabelDelayMs + 60;

    const nameLabel = svg.querySelector(`[data-bkm-sankey-label][data-node-index="${i}"]`);
    if (nameLabel) {
      const anim = (nameLabel as SVGElement).animate(
        [{ opacity: "0" }, { opacity: "1" }],
        {
          duration: revealDuration,
          delay: nameLabelDelayMs,
          easing: "cubic-bezier(0.85, 0, 0.15, 1)",
          fill: "backwards",
        },
      );
      animations.push(anim);
    }

    const valueLabel = svg.querySelector(`[data-bkm-sankey-valuelabel][data-node-index="${i}"]`);
    if (valueLabel) {
      const anim = (valueLabel as SVGElement).animate(
        [{ opacity: "0" }, { opacity: "1" }],
        {
          duration: revealDuration,
          delay: valueLabelDelayMs,
          easing: "cubic-bezier(0.85, 0, 0.15, 1)",
          fill: "backwards",
        },
      );
      animations.push(anim);
    }
  }

  // ── Link animation ──
  const linkStartDelay = animationDuration * 0.2;
  const linkAnimWindow = animationDuration * 0.8;

  for (let i = 0; i < linkPaths.length; i++) {
    const el = linkPaths[i];
    if (!el) continue;
    const stagDelayMs = totalLinks > 0
      ? linkStartDelay + (i / totalLinks) * linkAnimWindow * 0.4
      : linkStartDelay;

    const pathLen = el.getTotalLength();
    el.style.strokeDasharray = String(pathLen);
    el.style.strokeDashoffset = String(pathLen);

    const anim = el.animate(
      [
        { strokeDashoffset: String(pathLen) },
        { strokeDashoffset: "0" },
      ],
      {
        duration: revealDuration,
        delay: stagDelayMs,
        easing: "cubic-bezier(0.85, 0, 0.15, 1)",
        fill: "backwards",
      },
    );
    anim.onfinish = () => {
      el.style.strokeDashoffset = "0";
      el.style.strokeDasharray = "none";
    };
    animations.push(anim);
  }

  return animations;
}
