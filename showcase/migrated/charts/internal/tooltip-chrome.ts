import * as React from "react";
import { createSpring, type Spring } from "./spring";
import { TICKER_ITEM_HEIGHT } from "./design-tokens";
import {
  indicatorFadeGradientStops,
  resolveVerticalFadeSides,
  type IndicatorFadeEdges,
} from "./fade-mask";
import type { SpringConfig } from "./chart-config-context";
import type { ChartTooltipPoint, IndicatorWidth, TooltipRow } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

// `IndicatorWidth` / `TooltipRow` are owned by `./types` (P4 dedup) and imported
// above; they used to be declared here as byte-identical second copies.
export type DotVariant = "dot" | "ring";

export function resolveIndicatorWidth(width: IndicatorWidth): number {
  if (typeof width === "number") return width;
  switch (width) {
    case "line": return 1;
    case "thin": return 2;
    case "medium": return 4;
    case "thick": return 8;
    default: return 1;
  }
}

export function resolveIndicatorPixelWidth(cfg: { width?: IndicatorWidth; span?: number; columnWidth?: number }): number {
  if (cfg.span !== undefined && cfg.columnWidth !== undefined) return cfg.span * cfg.columnWidth;
  return resolveIndicatorWidth(cfg.width ?? "line");
}

export interface IndicatorConfig {
  width?: IndicatorWidth;
  span?: number;
  columnWidth?: number;
  color?: string | ((point: Record<string, unknown>) => string);
  dasharray?: string;
  fadeEdges?: IndicatorFadeEdges | boolean;
  fadeLength?: number;
  springConfig?: SpringConfig;
}

export interface DotConfig {
  variant?: DotVariant;
  size?: number;
  radiusFraction?: number;
  scale?: number;
  strokeWidth?: number;
  color?: string | ((point: Record<string, unknown>, line: { dataKey: string; stroke?: string }) => string);
}

export interface BoxConfig {
  springConfig?: SpringConfig;
  matchCrosshair?: boolean;
  damping?: number;
  boxSpringConfig?: SpringConfig;
  className?: string;
  panelStyle?: React.CSSProperties;
  backgroundColor?: string;
  content?: (props: { point: ChartTooltipPoint; index: number }) => React.ReactNode;
  children?: React.ReactNode;
  rows?: (point: Record<string, unknown>) => TooltipRow[];
}

function ringCornerRadius(halfExtent: number, cornerRadiusFraction: number): number {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(0.5, cornerRadiusFraction));
}

// ── Indicator (crosshair) ────────────────────────────────────────────────

export interface IndicatorBuild {
  svg: SVGSVGElement;
  rect: SVGRectElement | null;
  line: SVGLineElement | null;
  gradient: SVGLinearGradientElement;
  xSpring: Spring;
  lineXSpring: Spring | null;
  pixelWidth: number;
  isDashed: boolean;
}

export function buildIndicator(
  doc: Document,
  chromeId: number,
  cfg: IndicatorConfig,
  tooltipSpring: SpringConfig,
): IndicatorBuild {
  const pixelWidth = resolveIndicatorPixelWidth(cfg);
  const isDashed = Boolean(cfg.dasharray);
  const effectiveFadeEdges: IndicatorFadeEdges | boolean = isDashed ? "none" : (cfg.fadeEdges ?? "both");
  const effectiveFadeLength = cfg.fadeLength ?? 10;
  const colorValue = typeof cfg.color === "string" ? cfg.color : "var(--chart-crosshair)";
  const gradientId = `bkm-crosshair-gradient-${chromeId}`;
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "bkm-hover-layer");
  svg.setAttribute("aria-hidden", "true");
  const defs = doc.createElementNS(SVG_NS, "defs");
  const gradient = doc.createElementNS(SVG_NS, "linearGradient") as SVGLinearGradientElement;
  gradient.setAttribute("id", gradientId);
  gradient.setAttribute("x1", "0%"); gradient.setAttribute("x2", "0%");
  gradient.setAttribute("y1", "0%"); gradient.setAttribute("y2", "100%");
  const fadeSides = resolveVerticalFadeSides(effectiveFadeEdges as IndicatorFadeEdges);
  for (const { offset, opacity } of indicatorFadeGradientStops(fadeSides, effectiveFadeLength)) {
    const stop = doc.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("style", `stop-color: ${colorValue}; stop-opacity: ${opacity}`);
    gradient.appendChild(stop);
  }
  defs.appendChild(gradient);
  svg.appendChild(defs);
  let rect: SVGRectElement | null = null;
  let line: SVGLineElement | null = null;
  if (isDashed) {
    const l = doc.createElementNS(SVG_NS, "line") as SVGLineElement;
    l.setAttribute("stroke", colorValue);
    l.setAttribute("stroke-width", String(Math.max(1, pixelWidth)));
    if (cfg.dasharray) l.setAttribute("stroke-dasharray", cfg.dasharray);
    svg.appendChild(l);
    line = l;
    const r = doc.createElementNS(SVG_NS, "rect");
    r.setAttribute("width", String(pixelWidth)); r.setAttribute("fill", "transparent"); r.style.display = "none";
    svg.appendChild(r); rect = r;
  } else if (fadeSides.any) {
    const r = doc.createElementNS(SVG_NS, "rect");
    r.setAttribute("width", String(pixelWidth)); r.setAttribute("fill", `url(#${gradientId})`);
    svg.appendChild(r); rect = r;
  } else {
    const r = doc.createElementNS(SVG_NS, "rect");
    r.setAttribute("width", String(pixelWidth)); r.setAttribute("fill", colorValue);
    svg.appendChild(r); rect = r;
  }
  svg.style.display = "none";
  const springCfg = cfg.springConfig ?? tooltipSpring;
  const xSpring = createSpring(0, springCfg.stiffness, springCfg.damping, (x) => {
    if (line) { line.setAttribute("x1", String(x)); line.setAttribute("x2", String(x)); }
    if (rect && !isDashed) rect.setAttribute("x", String(x - pixelWidth / 2));
    else if (rect) rect.setAttribute("x", String(x - pixelWidth / 2));
  });
  let lineXSpring: Spring | null = null;
  if (isDashed && line) {
    lineXSpring = createSpring(0, springCfg.stiffness, springCfg.damping, (x) => {
      line!.setAttribute("x1", String(x)); line!.setAttribute("x2", String(x));
    });
  }
  return { svg, rect, line, gradient, xSpring, lineXSpring, pixelWidth, isDashed };
}

export function positionIndicator(
  build: IndicatorBuild,
  x: number,
  y: number,
  height: number,
): void {
  if (build.rect && !build.isDashed) {
    build.rect.setAttribute("y", String(y));
    build.rect.setAttribute("height", String(height));
  }
  if (build.rect && build.isDashed) {
    build.rect.setAttribute("y", String(y));
    build.rect.setAttribute("height", String(height));
  }
  if (build.line) {
    build.line.setAttribute("y1", String(y));
    build.line.setAttribute("y2", String(y + height));
  }
}

// ── Dots ─────────────────────────────────────────────────────────────────

export interface DotLayer {
  svg: SVGSVGElement;
  byKey: Map<string, SVGCircleElement | SVGRectElement>;
  springs: Map<string, { x: Spring; y: Spring }>;
}

export function buildDotLayer(doc: Document): DotLayer {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "bkm-hover-layer");
  svg.setAttribute("aria-hidden", "true");
  svg.style.display = "none";
  return { svg, byKey: new Map(), springs: new Map() };
}

export function ensureDot(
  doc: Document,
  layer: DotLayer,
  key: string,
  color: string,
  x: number,
  y: number,
  cfg: DotConfig,
  tooltipSpring: SpringConfig,
): void {
  const variant = cfg.variant ?? "dot";
  const rawSize = cfg.size ?? 5;
  const size = rawSize * (cfg.scale ?? 1);
  const isRing = variant === "ring";
  let el = layer.byKey.get(key);
  const strokeWidth = cfg.strokeWidth ?? (isRing ? 1.5 : 2);
  const radiusFraction = cfg.radiusFraction ?? 0.25;
  if (!el) {
    if (isRing) {
      const rect = doc.createElementNS(SVG_NS, "rect") as unknown as SVGRectElement;
      const side = size * 2; const rx = ringCornerRadius(size, radiusFraction);
      rect.setAttribute("width", String(side)); rect.setAttribute("height", String(side));
      rect.setAttribute("rx", String(rx)); rect.setAttribute("ry", String(rx));
      rect.setAttribute("fill", "transparent"); rect.setAttribute("stroke", color);
      rect.setAttribute("stroke-width", String(strokeWidth));
      layer.svg.appendChild(rect);
      layer.byKey.set(key, rect as unknown as SVGRectElement);
      el = rect as unknown as SVGRectElement;
      layer.springs.set(key, {
        x: createSpring(x, tooltipSpring.stiffness, tooltipSpring.damping, (nx) => (el as unknown as SVGRectElement).setAttribute("x", String(nx - size))),
        y: createSpring(y, tooltipSpring.stiffness, tooltipSpring.damping, (ny) => (el as unknown as SVGRectElement).setAttribute("y", String(ny - size))),
      });
    } else {
      const circle = doc.createElementNS(SVG_NS, "circle") as SVGCircleElement;
      circle.setAttribute("r", String(size)); circle.setAttribute("fill", color);
      circle.setAttribute("stroke", "var(--chart-background)"); circle.setAttribute("stroke-width", String(strokeWidth));
      layer.svg.appendChild(circle);
      layer.byKey.set(key, circle);
      el = circle;
      layer.springs.set(key, {
        x: createSpring(x, tooltipSpring.stiffness, tooltipSpring.damping, (nx) => (el as unknown as SVGCircleElement).setAttribute("cx", String(nx))),
        y: createSpring(y, tooltipSpring.stiffness, tooltipSpring.damping, (ny) => (el as unknown as SVGCircleElement).setAttribute("cy", String(ny))),
      });
    }
  }
  el.style.display = "";
  if (isRing) {
    (el as unknown as SVGRectElement).setAttribute("stroke", color);
    (el as unknown as SVGRectElement).setAttribute("stroke-width", String(strokeWidth));
    const side = size * 2; const rx = ringCornerRadius(size, radiusFraction);
    (el as unknown as SVGRectElement).setAttribute("width", String(side));
    (el as unknown as SVGRectElement).setAttribute("height", String(side));
    (el as unknown as SVGRectElement).setAttribute("rx", String(rx));
    (el as unknown as SVGRectElement).setAttribute("ry", String(rx));
  } else {
    (el as unknown as SVGCircleElement).setAttribute("fill", color);
    (el as unknown as SVGCircleElement).setAttribute("r", String(size));
    (el as unknown as SVGCircleElement).setAttribute("stroke-width", String(strokeWidth));
  }
}

export function updateDotPosition(
  layer: DotLayer,
  key: string,
  x: number,
  y: number,
  showing: boolean,
): void {
  const s = layer.springs.get(key);
  if (!s) return;
  // Dot always springs (bklit ChartTooltip never passes discrete to TooltipDot) —
  // only a fresh mount snaps in place.
  if (showing) { s.x.jump(x); s.y.jump(y); } else { s.x.set(x); s.y.set(y); }
}

export function hideDot(layer: DotLayer, key: string): void {
  const el = layer.byKey.get(key);
  if (el) el.style.display = "none";
}

// ── Date pill / DateTicker ───────────────────────────────────────────────

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
