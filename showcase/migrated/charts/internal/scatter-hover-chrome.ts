import { shortDateFmt } from "./formatters";
import {
  DISCRETE_INTERACTION_THRESHOLD,
  FADE_BUFFER,
  TICKER_HALF_WIDTH,
  TICKER_ITEM_HEIGHT,
} from "./design-tokens";
import { createSpring, type Spring } from "./spring";
import type { SpringConfig } from "./chart-config-context";
import {
  indicatorFadeGradientStops,
  resolveVerticalFadeSides,
  type IndicatorFadeEdges,
} from "./fade-mask";
import {
  toDotConfig,
  toIndicatorConfig,
} from "./tooltip-mappers";
import type { ChartTooltipConfig, IndicatorWidth } from "./types";
import { TOOLTIP_SPRING } from "./design-tokens";

// P6/C1: the hover DIM (opacity 0.5 inactive / r×1.35 active) is now expressed
// as native `dot()` mark `states` (see scatter-chart.tsx) instead of DOM
// mutation here — this module keeps only the crosshair/tooltip-dot/date-pill
// chrome, which C3 still owns.
//
// P6/C2: the tooltip BOX/PANEL (bklit's floating rows box) moved to the
// native `tooltip` extension + `renderTooltipBody` (scatter-chart.tsx) — the
// box builder (`buildBox`/`positionBox`/`applyBoxContent`/`hideBoxContent`)
// was deleted from here, not kept/relocated. `tooltip-chrome.ts`, which used
// to supply this module's crosshair/dot/pill/label-fade primitives, is being
// deleted wholesale in the same commit; those primitives are inlined below
// (unchanged in behavior, copied from tooltip-chrome.ts) since C3 replaces
// this whole file with native crosshair/focus geometry shortly after and a
// new shared module is out of scope for this pass.
export interface ScatterHoverChromeSeries {
  dataKey: string;
  fill: string;
}

export interface ScatterHoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  series: ScatterHoverChromeSeries[];
  xDataKey: string;
  pointCount: number;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
  /** CH5/B12 (bklit XAxis.tickerHalfWidth): date-pill fade radius; defaults
      to the TICKER_HALF_WIDTH token when unset. */
  tickerHalfWidth?: number;
  tooltip?: ChartTooltipConfig | null;
  dateLabels?: string[];
}

export interface ScatterFocusPoint {
  markId: string;
  datum: unknown;
  datumIndex: number;
  x: number;
  y: number;
  color: string;
}

export interface ScatterHoverChrome {
  onFocusGroupChange(points: readonly ScatterFocusPoint[]): void;
  detach(): void;
}

export interface ScatterHoverChromeOptions {
  tooltipSpring?: typeof TOOLTIP_SPRING;
}

let gradientCounter = 0;

function resolveDotColor(
  tooltip: ChartTooltipConfig | null | undefined,
  seriesFill: string,
  pointColor: string,
  point: Record<string, unknown>,
  line: { dataKey: string; stroke?: string },
  tooltipRows: { color: string }[] | null,
  index: number,
): string {
  if (tooltip?.rows && tooltipRows?.[index]?.color) return tooltipRows[index]!.color;
  if (tooltip?.dotColor != null) {
    if (typeof tooltip.dotColor === "function") return tooltip.dotColor(point, line);
    return tooltip.dotColor;
  }
  return seriesFill || pointColor;
}

// ─────────────────────────────────────────────────────────────────────────
// Inlined from tooltip-chrome.ts (dying, deleted wholesale this commit) —
// crosshair + dot + date-pill + label-fade primitives only, unchanged.
// ─────────────────────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";

export type DotVariant = "dot" | "ring";

function resolveIndicatorWidth(width: IndicatorWidth): number {
  if (typeof width === "number") return width;
  switch (width) {
    case "line": return 1;
    case "thin": return 2;
    case "medium": return 4;
    case "thick": return 8;
    default: return 1;
  }
}

function resolveIndicatorPixelWidth(cfg: { width?: IndicatorWidth; span?: number; columnWidth?: number }): number {
  if (cfg.span !== undefined && cfg.columnWidth !== undefined) return cfg.span * cfg.columnWidth;
  return resolveIndicatorWidth(cfg.width ?? "line");
}

interface IndicatorConfig {
  width?: IndicatorWidth;
  span?: number;
  columnWidth?: number;
  color?: string | ((point: Record<string, unknown>) => string);
  dasharray?: string;
  fadeEdges?: IndicatorFadeEdges | boolean;
  fadeLength?: number;
  springConfig?: SpringConfig;
}

interface DotConfig {
  variant?: DotVariant;
  size?: number;
  radiusFraction?: number;
  scale?: number;
  strokeWidth?: number;
  color?: string | ((point: Record<string, unknown>, line: { dataKey: string; stroke?: string }) => string);
}

function ringCornerRadius(halfExtent: number, cornerRadiusFraction: number): number {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(0.5, cornerRadiusFraction));
}

interface IndicatorBuild {
  svg: SVGSVGElement;
  rect: SVGRectElement | null;
  line: SVGLineElement | null;
  gradient: SVGLinearGradientElement;
  xSpring: Spring;
  lineXSpring: Spring | null;
  pixelWidth: number;
  isDashed: boolean;
}

function buildIndicator(
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

interface DotLayer {
  svg: SVGSVGElement;
  byKey: Map<string, SVGCircleElement | SVGRectElement>;
  springs: Map<string, { x: Spring; y: Spring }>;
}

function buildDotLayer(doc: Document): DotLayer {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "bkm-hover-layer");
  svg.setAttribute("aria-hidden", "true");
  svg.style.display = "none";
  return { svg, byKey: new Map(), springs: new Map() };
}

function ensureDot(
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

function updateDotPosition(
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

function hideDot(layer: DotLayer, key: string): void {
  const el = layer.byKey.get(key);
  if (el) el.style.display = "none";
}

interface PillBuild {
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

function buildPill(
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

function applyLabelFade(
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

function resetLabelFade(container: HTMLElement): void {
  for (const span of container.querySelectorAll<HTMLSpanElement>("[data-bkm-xlabel]")) span.style.opacity = "1";
}

// ─────────────────────────────────────────────────────────────────────────

export function attachScatterHoverChrome(
  host: HTMLElement,
  getState: () => ScatterHoverChromeState,
  options: ScatterHoverChromeOptions = {},
): ScatterHoverChrome {
  const tooltipSpring = options.tooltipSpring ?? TOOLTIP_SPRING;
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;

  const indicator = buildIndicator(doc, chromeId, toIndicatorConfig(getState().tooltip), tooltipSpring);
  const dotLayer = buildDotLayer(doc);
  const pillBuild = buildPill(doc, tooltipSpring, () => getState().dateLabels ?? []);
  host.append(indicator.svg, dotLayer.svg, pillBuild.layer);

  let visible = false;

  const hide = () => {
    if (!visible) return;
    visible = false;
    indicator.svg.style.display = "none";
    dotLayer.svg.style.display = "none";
    pillBuild.layer.style.display = "none";
    indicator.xSpring.stop();
    indicator.lineXSpring?.stop();
    pillBuild.spring.stop();
    for (const { x, y } of dotLayer.springs.values()) { x.stop(); y.stop(); }
    pillBuild.label.textContent = "";
    resetLabelFade(container);
  };

  const update = (points: readonly ScatterFocusPoint[]) => {
    if (points.length === 0) { hide(); return; }
    const state = getState();
    const { margin } = state;
    const height = container.clientHeight;
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    const primary = points[0]!;
    const pointByMark = new Map(points.map((p) => [p.markId, p]));
    const date = (primary.datum as Record<string, unknown>)[state.xDataKey];
    const isDate = date instanceof Date;
    const discrete = state.pointCount > DISCRETE_INTERACTION_THRESHOLD;
    const showing = !visible;
    visible = true;

    if (state.showCrosshair) {
      indicator.svg.style.display = "";
      if (indicator.rect && !indicator.isDashed) {
        indicator.rect.setAttribute("y", String(margin.top));
        indicator.rect.setAttribute("height", String(innerHeight));
      }
      if (indicator.line) {
        indicator.line.setAttribute("y1", String(margin.top));
        indicator.line.setAttribute("y2", String(margin.top + innerHeight));
      }
      const target = primary.x;
      if (showing || discrete) indicator.xSpring.jump(target);
      else indicator.xSpring.set(target);
      if (indicator.lineXSpring) {
        if (showing || discrete) indicator.lineXSpring.jump(target);
        else indicator.lineXSpring.set(target);
      }
    }

    if (state.showDots) {
      dotLayer.svg.style.display = "";
      const pointForDotColor = primary.datum as Record<string, unknown>;
      let tooltipRows: { color: string }[] | null = null;
      if (state.tooltip?.rows) tooltipRows = state.tooltip.rows(pointForDotColor) as { color: string }[];
      for (let i = 0; i < state.series.length; i++) {
        const series = state.series[i]!;
        const point = pointByMark.get(series.dataKey);
        if (!point) { hideDot(dotLayer, series.dataKey); continue; }
        const color = resolveDotColor(state.tooltip ?? null, series.fill, point.color, pointForDotColor, { dataKey: series.dataKey, stroke: series.fill }, tooltipRows, i);
        ensureDot(doc, dotLayer, series.dataKey, color, point.x, point.y, toDotConfig(state.tooltip), tooltipSpring);
        updateDotPosition(dotLayer, series.dataKey, point.x, point.y, showing);
      }
    }

    // P6/C1: the inactive-dim + active r×1.35 pop are now native `dot()` mark
    // `states` on the marks layer itself (scatter-chart.tsx) — no DOM
    // mutation happens here anymore.
    //
    // P6/C2: the tooltip box/panel used to render here (`applyBoxContent` +
    // `positionBox`) — it's now the native tooltip extension's
    // `renderTooltipBody` in scatter-chart.tsx, driven by TanStack's own
    // focus tracking rather than this chrome's `points`.

    if (state.showDatePill && isDate) {
      pillBuild.layer.style.display = "";
      if (pillBuild.ticker && state.dateLabels && state.dateLabels.length > 0) {
        pillBuild.ticker.update(primary.datumIndex, discrete);
      } else {
        pillBuild.label.textContent = shortDateFmt.format(date as Date);
      }
      if (showing || discrete) pillBuild.spring.jump(primary.x);
      else pillBuild.spring.set(primary.x);
    } else {
      pillBuild.layer.style.display = "none";
    }

    const hoveredLabel = isDate ? shortDateFmt.format(date as Date) : null;
    applyLabelFade(container, primary.x, hoveredLabel, state.tickerHalfWidth ?? TICKER_HALF_WIDTH, FADE_BUFFER);
  };

  return {
    onFocusGroupChange: update,
    detach() {
      hide();
      indicator.svg.remove();
      dotLayer.svg.remove();
      pillBuild.layer.remove();
      dotLayer.byKey.clear(); dotLayer.springs.clear();
      pillBuild.ticker?.detach();
    },
  };
}
