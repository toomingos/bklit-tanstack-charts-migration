// Pure SVG gradient-defs injection for sankey links, without animation state.
import type { SankeyGradientDatum } from "./sankey-mark";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const GRADIENT_VERTICAL_ORIGIN = "0";
const EMPTY_GRADIENT_COUNT = 0;

interface SankeyGradientStopParams {
  readonly element: SVGLinearGradientElement;
  readonly gradient: Readonly<SankeyGradientDatum>;
}

const appendSankeyGradientStops = (params: Readonly<SankeyGradientStopParams>): void => {
  const { element, gradient } = params;
  const stops = [
    { color: gradient.sourceColor, offset: "0%" },
    { color: gradient.targetColor, offset: "100%" },
  ];
  for (const stop of stops) {
    const stopNode = document.createElementNS(SVG_NAMESPACE, "stop");
    stopNode.setAttribute("offset", stop.offset);
    stopNode.setAttribute("stop-color", stop.color);
    stopNode.setAttribute("stop-opacity", "1");
    element.append(stopNode);
  }
}

const buildSankeyGradientElement = (gradient: Readonly<SankeyGradientDatum>): SVGLinearGradientElement => {
  const element = document.createElementNS(SVG_NAMESPACE, "linearGradient");
  element.setAttribute("id", gradient.id);
  element.setAttribute("gradientUnits", "userSpaceOnUse");
  element.setAttribute("x1", String(gradient.x1));
  element.setAttribute("y1", GRADIENT_VERTICAL_ORIGIN);
  element.setAttribute("x2", String(gradient.x2));
  element.setAttribute("y2", GRADIENT_VERTICAL_ORIGIN);
  appendSankeyGradientStops({ element, gradient });
  return element;
}

const injectGradientDefs = (svg: SVGSVGElement, gradients: readonly Readonly<SankeyGradientDatum>[]): void => {
  if (gradients.length === EMPTY_GRADIENT_COUNT) {return;}

  let defs = svg.querySelector<SVGDefsElement>("defs.bkm-sankey__gradients");
  if (!defs) {
    defs = document.createElementNS(SVG_NAMESPACE, "defs");
    defs.classList.add("bkm-sankey__gradients");
    svg.prepend(defs);
  }

  defs.replaceChildren(...gradients.map((gradient) => buildSankeyGradientElement(gradient)));
}

export { injectGradientDefs };
