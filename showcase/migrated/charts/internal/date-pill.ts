// Date pill + odometer ticker + axis-label proximity fade.
// SANCTIONED-EXTENSION (research/phase-6/03): the pill is app-owned HTML
// positioned from `onFocusGroupChange` — it never touches renderer DOM.
// Extraction-only (C3): `createDateTicker`, `buildPill`, `applyLabelFade`,
// `resetLabelFade` are the byte-identical twins of the versions previously in
// internal/tooltip-chrome.ts (deleted in C3). The label fade queries
// `[data-bkm-xlabel]` spans, which are app-authored axis overlay labels —
// both the fade and those spans go native in C4.
import { createSpring, type Spring } from "./spring";
import { TICKER_ITEM_HEIGHT } from "./design-tokens";
import type { SpringConfig } from "./chart-config-context";

export interface PillBuild {
  layer: HTMLDivElement;
  pill: HTMLDivElement;
  inner: HTMLDivElement;
  label: HTMLSpanElement;
  spring: Spring;
  ticker: ReturnType<typeof createDateTicker> | null;
}

function createDateTicker(
  doc: Document,
  getLabels: () => string[],
) {
  const root = doc.createElement("div");
  const compactLabel = doc.createElement("span");
  compactLabel.style.whiteSpace = "nowrap"; compactLabel.style.fontWeight = "500";
  compactLabel.style.fontSize = "0.875rem"; compactLabel.style.lineHeight = "1.25rem";
  const stacksOuter = doc.createElement("div");
  stacksOuter.style.display = "flex"; stacksOuter.style.alignItems = "center"; stacksOuter.style.justifyContent = "center";
  stacksOuter.style.gap = "0.25rem"; stacksOuter.style.height = "1.5rem"; stacksOuter.style.overflow = "hidden";
  const monthWrap = doc.createElement("div"); monthWrap.style.position = "relative"; monthWrap.style.height = "1.5rem"; monthWrap.style.overflow = "hidden";
  const monthStack = doc.createElement("div"); monthStack.style.display = "flex"; monthStack.style.flexDirection = "column"; monthWrap.appendChild(monthStack);
  const dayWrap = doc.createElement("div"); dayWrap.style.position = "relative"; dayWrap.style.height = "1.5rem"; dayWrap.style.overflow = "hidden";
  const dayStack = doc.createElement("div"); dayStack.style.display = "flex"; dayStack.style.flexDirection = "column"; dayWrap.appendChild(dayStack);
  stacksOuter.append(monthWrap, dayWrap);
  let isCompact = false;
  let monthSegments: Array<{ month: string; startIndex: number }> = [];
  let prevMonthIndex = -1;
  const dayYSpring = createSpring(0, 400, 35, (y) => { dayStack.style.transform = `translateY(${y}px)`; });
  const monthYSpring = createSpring(0, 400, 35, (y) => { monthStack.style.transform = `translateY(${y}px)`; });
  const rebuild = () => {
    const labels = getLabels(); monthSegments = [];
    for (let i = 0; i < labels.length; i++) {
      const m = (labels[i] ?? "").split(" ")[0] ?? "";
      const prev = monthSegments[monthSegments.length - 1];
      if (!prev || prev.month !== m) monthSegments.push({ month: m, startIndex: i });
    }
    monthStack.textContent = ""; dayStack.textContent = "";
    for (const seg of monthSegments) {
      const row = doc.createElement("div"); row.style.display = "flex"; row.style.height = `${TICKER_ITEM_HEIGHT}px`;
      row.style.flexShrink = "0"; row.style.alignItems = "center"; row.style.justifyContent = "center";
      const span = doc.createElement("span"); span.style.whiteSpace = "nowrap"; span.style.fontWeight = "500"; span.style.fontSize = "0.875rem"; span.style.lineHeight = "1.25rem"; span.textContent = seg.month; row.appendChild(span); monthStack.appendChild(row);
    }
    for (let i = 0; i < labels.length; i++) {
      const day = (labels[i] ?? "").split(" ")[1] ?? "";
      const row = doc.createElement("div"); row.style.display = "flex"; row.style.height = `${TICKER_ITEM_HEIGHT}px`;
      row.style.flexShrink = "0"; row.style.alignItems = "center"; row.style.justifyContent = "center";
      const span = doc.createElement("span"); span.style.whiteSpace = "nowrap"; span.style.fontWeight = "500"; span.style.fontSize = "0.875rem"; span.style.lineHeight = "1.25rem"; span.textContent = day; row.appendChild(span); dayStack.appendChild(row);
    }
    prevMonthIndex = -1;
  };
  const update = (currentIndex: number, discrete: boolean) => {
    const labels = getLabels(); const compact = labels.length > 60;
    if (compact !== isCompact) {
      isCompact = compact; root.textContent = "";
      if (compact) {
        const inner = doc.createElement("div"); inner.style.display = "flex"; inner.style.height = "1.5rem"; inner.style.alignItems = "center"; inner.style.justifyContent = "center"; inner.appendChild(compactLabel); root.appendChild(inner);
      } else { rebuild(); root.appendChild(stacksOuter); }
    }
    if (isCompact) { compactLabel.textContent = labels[currentIndex] ?? labels[0] ?? ""; return; }
    if (monthSegments.length === 0) rebuild();
    let mIdx = 0;
    for (let i = monthSegments.length - 1; i >= 0; i--) { const seg = monthSegments[i]; if (seg && seg.startIndex <= currentIndex) { mIdx = i; break; } }
    const targetDayY = -currentIndex * TICKER_ITEM_HEIGHT;
    const targetMonthY = -mIdx * TICKER_ITEM_HEIGHT;
    if (discrete) dayYSpring.jump(targetDayY); else dayYSpring.set(targetDayY);
    const monthChanged = prevMonthIndex !== mIdx; const isFirst = prevMonthIndex === -1;
    if (isFirst || monthChanged) { if (discrete) monthYSpring.jump(targetMonthY); else monthYSpring.set(targetMonthY); prevMonthIndex = mIdx; }
  };
  const detach = () => { dayYSpring.stop(); monthYSpring.stop(); };
  const setCompactLabel = (label: string) => {
    if (!isCompact) { isCompact = true; root.textContent = ""; const inner = doc.createElement("div"); inner.style.display = "flex"; inner.style.height = "1.5rem"; inner.style.alignItems = "center"; inner.style.justifyContent = "center"; inner.appendChild(compactLabel); root.appendChild(inner); }
    compactLabel.textContent = label;
  };
  return { root, compactLabel, update, detach, setCompactLabel, rebuild };
}

export function buildPill(
  doc: Document,
  tooltipSpring: SpringConfig,
  getLabels?: () => string[],
): PillBuild {
  const layer = doc.createElement("div"); layer.className = "bkm-date-pill-layer";
  const pill = doc.createElement("div"); pill.className = "bkm-date-pill";
  const inner = doc.createElement("div"); inner.className = "bkm-date-pill-inner";
  const label = doc.createElement("span"); inner.appendChild(label); pill.appendChild(inner); layer.appendChild(pill);
  layer.style.display = "none";
  const spring = createSpring(0, tooltipSpring.stiffness, tooltipSpring.damping, (x) => { layer.style.left = `${x}px`; });
  const ticker = getLabels ? createDateTicker(doc, getLabels) : null;
  if (ticker) { inner.textContent = ""; inner.appendChild(ticker.root); }
  return { layer, pill, inner, label, spring, ticker };
}

// ── Label fade ───────────────────────────────────────────────────────────
// Interim home until C4 moves axis labels (and their proximity fade) native.
// The spans queried here are app-authored overlay labels, not renderer DOM.

export function applyLabelFade(
  container: HTMLElement,
  primaryX: number,
  hoveredLabel: string | null,
  tickerHalfWidth: number,
  fadeBuffer: number,
): void {
  for (const span of container.querySelectorAll<HTMLSpanElement>("[data-bkm-xlabel]")) {
    const labelX = Number(span.dataset.bkmX);
    const distance = Math.abs(labelX - primaryX);
    let opacity = 1;
    if (distance < tickerHalfWidth) opacity = 0;
    else if (hoveredLabel && span.textContent === hoveredLabel) opacity = 0;
    else if (distance < tickerHalfWidth + fadeBuffer) opacity = (distance - tickerHalfWidth) / fadeBuffer;
    span.style.opacity = String(opacity);
  }
}

export function resetLabelFade(container: HTMLElement): void {
  for (const span of container.querySelectorAll<HTMLSpanElement>("[data-bkm-xlabel]")) span.style.opacity = "1";
}
