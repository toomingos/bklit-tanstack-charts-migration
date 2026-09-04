// App-owned HTML pill positioned from `onFocusGroupChange`; never touches renderer DOM.
// Axis-label fade lives in native `tickLabels.opacity` (axis-ticks.ts), not here.
import { createSpring } from './spring';
import type { Spring } from './spring';
import { createDateTicker } from "./date-ticker";
import type { SpringConfig } from "./chart-config-context";

interface PillBuild {
  layer: HTMLDivElement;
  pill: HTMLDivElement;
  inner: HTMLDivElement;
  label: HTMLSpanElement;
  spring: Spring;
  ticker: ReturnType<typeof createDateTicker> | null;
}

const createDivWithClass = (doc: Document, className: string): HTMLDivElement => {
  const element = doc.createElement("div");
  element.className = className;
  return element;
};

interface PillElements {
  readonly layer: HTMLDivElement;
  readonly pill: HTMLDivElement;
  readonly inner: HTMLDivElement;
  readonly label: HTMLSpanElement;
}

const buildPillElements = (doc: Document): PillElements => {
  const layer = createDivWithClass(doc, "bkm-date-pill-layer");
  const pill = createDivWithClass(doc, "bkm-date-pill");
  const inner = createDivWithClass(doc, "bkm-date-pill-inner");
  const label = doc.createElement("span");
  inner.append(label);
  pill.append(inner);
  layer.append(pill);
  layer.style.display = "none";
  return { inner, label, layer, pill };
};

const buildPill = (doc: Document, tooltipSpring: Readonly<SpringConfig>, getLabels?: () => string[]): PillBuild => {
  const { inner, label, layer, pill } = buildPillElements(doc);
  const spring = createSpring({ damping: tooltipSpring.damping, initial: 0, onUpdate: (x) => { layer.style.left = `${x}px`; }, stiffness: tooltipSpring.stiffness });
  const ticker = getLabels ? createDateTicker(doc, getLabels) : null;
  if (ticker) { inner.textContent = ""; inner.append(ticker.root); }
  return { inner, label, layer, pill, spring, ticker };
}

export { buildPill };
export type { PillBuild };
