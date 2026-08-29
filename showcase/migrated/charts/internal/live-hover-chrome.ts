import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { intFmt, shortDateFmt } from "./formatters";
import { createSpring, type Spring } from "./spring";
import {
  BOX_FALLBACK_HEIGHT,
  BOX_FALLBACK_WIDTH,
  BOX_OFFSET,
  ENTRANCE_SPRING,
  FADE_BUFFER,
  TICKER_HALF_WIDTH,
  TOOLTIP_SPRING,
} from "./design-tokens";
import {
  indicatorFadeGradientStops,
  resolveVerticalFadeSides,
  type IndicatorFadeEdges,
} from "./fade-mask";
import { resolveTooltipBoxMotion, type SpringConfig } from "./chart-config-context";
import {
  toBoxConfig,
  toDotConfig,
  toIndicatorConfig,
} from "./tooltip-mappers";
import type { ChartTooltipPoint, IndicatorWidth, TooltipRow } from "./types";
const TICK_SPRING = { stiffness: 180, damping: 24 };

// P6/C2: live-line's mark (internal/live-line-mark.ts) emits only
// `polyline`/`area` scene nodes — no per-datum ChartPoint the native `focus`
// system can track — and this chart's whole hover/tooltip path is
// deliberately application-owned (see live-line-chart.tsx's header, D16/D22):
// a plain-ref pointer listener + one continuous rAF loop drive
// `updateHover`/`updateFrame` directly every raw tick, bypassing React state
// and TanStack's focus/tooltip extensions entirely on purpose (perf — the
// architecture note calls this out as "deliberately NOT optimized away").
// The native `tooltip` extension + `renderTooltipBody` therefore cannot
// anchor here (no scene ChartPoints to focus), so this module KEEPS its
// bespoke DOM box/panel unchanged. `tooltip-chrome.ts`, which used to supply
// the box/indicator/dot primitives below, is being deleted wholesale in this
// commit; those primitives are inlined verbatim here as self-owned interim
// code (unchanged in behavior) instead of importing them. FOLLOW-UP FOR C5:
// once live-line-mark gains rolling-path/ChartPoints support, re-evaluate
// whether the native tooltip extension can anchor to those points and this
// bespoke box can be retired in favor of `renderTooltipBody`.

export interface LiveHoverSeries {
  dataKey: string;
  color: string;
  formatValue: (v: number) => string;
}

export interface LiveTooltipPoint {
  x: number;
  date: Date;
  series: Array<{ dataKey: string; value: number; y: number }>;
}

export interface LiveHoverConfig {
  margin: { top: number; right: number; bottom: number; left: number };
  series: LiveHoverSeries[];
  showCrosshair: boolean;
  showDots: boolean;
  showBox: boolean;
  showDatePill: boolean;
  content?: (props: { point: ChartTooltipPoint; index: number }) => React.ReactNode;
  // Full parity props forwarded via live chart's tooltip extraction
  dotVariant?: DotConfig["variant"];
  dotSize?: number;
  dotRadiusFraction?: number;
  dotScale?: number;
  dotStrokeWidth?: number;
  dotColor?: string | ((point: Record<string, unknown>, line: { dataKey: string; stroke?: string }) => string);
  indicatorColor?: string | ((point: Record<string, unknown>) => string);
  indicatorWidth?: IndicatorConfig["width"];
  indicatorSpan?: number;
  columnWidth?: number;
  indicatorDasharray?: string;
  indicatorFadeEdges?: IndicatorConfig["fadeEdges"];
  indicatorFadeLength?: number;
  springConfig?: { stiffness: number; damping: number };
  matchCrosshair?: boolean;
  damping?: number;
  boxSpringConfig?: { stiffness: number; damping: number };
  className?: string;
  panelStyle?: React.CSSProperties;
  backgroundColor?: string;
  rows?: (point: Record<string, unknown>) => { color: string; label: string; value: string | number }[];
  children?: React.ReactNode;
}

export interface LiveHoverFrameInput {
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  xLabels: Array<{ x: number; label: string; key: number }>;
  yTicks: Array<{ key: string; y: number; label: string; edgeAlpha: number }>;
  /** <LiveYAxis position> parity (bklit live-y-axis.tsx): "left" puts the
      tick layer in the left margin gutter (labels right-aligned), "right"
      mirrors it into the right gutter (width margin.right, labels
      left-aligned). Default: "left". */
  yAxisPosition?: "left" | "right";
}

export interface LiveHoverInput {
  point: LiveTooltipPoint | null;
  pillLabel: string | null;
  index: number;
}

export interface LiveHoverChrome {
  updateFrame(input: LiveHoverFrameInput): void;
  updateHover(input: LiveHoverInput): void;
  registerLiveGroups(elements: Element[]): void;
  detach(): void;
}

export interface LiveHoverChromeOptions {
  tooltipSpring?: typeof TOOLTIP_SPRING;
}

let gradientCounter = 0;

// ─────────────────────────────────────────────────────────────────────────
// Inlined from tooltip-chrome.ts (dying, deleted wholesale this commit) —
// crosshair + dot + box/panel primitives, unchanged in behavior. Live keeps
// its bespoke box (see header comment above for why native tooltip can't
// anchor here); scatter's copy of this same code (scatter-hover-chrome.ts)
// dropped the box half since scatter moved to the native extension.
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

interface BoxConfig {
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

function resolveBoxSpring(
  cfg: BoxConfig,
  tooltipSpring: SpringConfig,
  discrete: boolean,
): { animate: boolean; springConfig: SpringConfig } {
  if (cfg.boxSpringConfig) return { animate: !discrete, springConfig: cfg.boxSpringConfig };
  if (cfg.matchCrosshair) return { animate: !discrete, springConfig: cfg.springConfig ?? tooltipSpring };
  return resolveTooltipBoxMotion(cfg.damping);
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

// ── rAF-coalesced commit scheduler (folded from tooltip-chrome.ts) ────────

function defaultDedupeKey<T>(tooltip: T): string {
  if (typeof tooltip === "object" && tooltip !== null && "index" in tooltip && typeof (tooltip as { index: unknown }).index === "number") {
    const { index, x } = tooltip as { index: number; x?: number };
    if (typeof x === "number") return `${index}:${Math.round(x)}`;
    return String(index);
  }
  return JSON.stringify(tooltip);
}

interface TooltipScheduler<T> {
  schedule(tooltip: T, dedupeKey?: string): void;
  clear(): void;
  resetDedupe(): void;
  dispose(): void;
}

function createTooltipScheduler<T>(options: { commit(t: T | null): void }): TooltipScheduler<T> {
  let lastKey: string | null = null;
  let pending: T | null = null;
  let pendingKey: string | null = null;
  let rafId: number | null = null;

  const commitTooltip = (tooltip: T, key: string) => {
    if (key === lastKey) return;
    lastKey = key;
    options.commit(tooltip);
  };

  return {
    schedule(tooltip: T, dedupeKey?: string) {
      const key = dedupeKey ?? defaultDedupeKey(tooltip);
      pending = tooltip;
      pendingKey = key;
      if (key === lastKey) return;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const next = pending;
        const nextKey = pendingKey;
        if (next !== null && nextKey !== null) commitTooltip(next, nextKey);
      });
    },
    clear() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pending = null;
      pendingKey = null;
      lastKey = null;
      options.commit(null);
    },
    resetDedupe() {
      lastKey = null;
    },
    dispose() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}

interface BoxBuild {
  layer: HTMLDivElement;
  panel: HTMLDivElement;
  content: HTMLDivElement;
  title: HTMLDivElement;
  rows: HTMLDivElement;
  custom: HTMLDivElement;
  childrenWrap: HTMLDivElement | null;
  rowByKey: Map<string, { root: HTMLDivElement; swatch: HTMLSpanElement; label: HTMLSpanElement; value: HTMLSpanElement }>;
  customRoot: { current: Root | null };
  leftSpring: Spring | null;
  topSpring: Spring | null;
  entranceSpring: Spring;
  runEntrance: (flipped: boolean) => void;
  lastContentKey: { current: string | null };
  childrenRoot: { current: Root | null };
  contentScheduler: TooltipScheduler<() => void> | null;
}

function buildBox(
  doc: Document,
  cfg: BoxConfig,
  tooltipSpring: SpringConfig,
  discrete: boolean,
): BoxBuild {
  const layer = doc.createElement("div");
  layer.className = cfg.className ? `bkm-tooltip-layer ${cfg.className}` : "bkm-tooltip-layer";
  const panel = doc.createElement("div");
  panel.className = "bkm-tooltip-panel";
  if (cfg.panelStyle) Object.assign(panel.style, cfg.panelStyle);
  if (cfg.backgroundColor) panel.style.backgroundColor = cfg.backgroundColor;
  const content = doc.createElement("div"); content.className = "bkm-tooltip-content";
  const title = doc.createElement("div"); title.className = "bkm-tooltip-title";
  const rows = doc.createElement("div"); rows.className = "bkm-tooltip-rows";
  content.append(title, rows);
  const custom = doc.createElement("div");
  let childrenWrap: HTMLDivElement | null = null;
  if (cfg.children) {
    childrenWrap = doc.createElement("div");
    childrenWrap.style.marginTop = "0.5rem";
    childrenWrap.style.transition = "opacity 200ms ease-out";
  }
  panel.append(content, custom);
  if (childrenWrap) panel.appendChild(childrenWrap);
  layer.appendChild(panel);
  layer.style.display = "none";
  const rowByKey = new Map<string, { root: HTMLDivElement; swatch: HTMLSpanElement; label: HTMLSpanElement; value: HTMLSpanElement }>();
  const resolved = resolveBoxSpring(cfg, tooltipSpring, discrete);
  const leftSpring = resolved.animate ? createSpring(0, resolved.springConfig.stiffness, resolved.springConfig.damping, (l) => { layer.style.left = `${l}px`; }) : null;
  const topSpring = resolved.animate ? createSpring(0, resolved.springConfig.stiffness, resolved.springConfig.damping, (t) => { layer.style.top = `${t}px`; }) : null;
  let entranceFrom = 0;
  const entranceSpring = createSpring(1, ENTRANCE_SPRING.stiffness, ENTRANCE_SPRING.damping, (p) => {
    panel.style.transform = `translateX(${entranceFrom * (1 - p)}px) scale(${0.85 + 0.15 * p})`;
    panel.style.opacity = String(p);
  });
  const runEntrance = (flipped: boolean) => {
    panel.style.transformOrigin = flipped ? "right top" : "left top";
    entranceFrom = flipped ? 20 : -20;
    entranceSpring.jump(0); entranceSpring.set(1);
  };
  const contentScheduler = createTooltipScheduler<() => void>({
    commit: (fn) => fn?.(),
  });
  return { layer, panel, content, title, rows, custom, childrenWrap, rowByKey, customRoot: { current: null }, leftSpring, topSpring, entranceSpring, runEntrance, lastContentKey: { current: null }, childrenRoot: { current: null }, contentScheduler };
}

function positionBox(
  box: BoxBuild,
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number,
  offset: number,
  showing: boolean,
  prevFlip: boolean | null,
  boxFadeRef: { current: Animation | null },
): boolean {
  const w = box.panel.offsetWidth || BOX_FALLBACK_WIDTH;
  const h = box.panel.offsetHeight || BOX_FALLBACK_HEIGHT;
  const flip = x + w + offset > containerWidth;
  const targetLeft = flip ? x - offset - w : x + offset;
  const targetTop = Math.max(offset, Math.min(y - h / 2, containerHeight - h - offset));
  const animate = box.leftSpring !== null && box.topSpring !== null;
  if (showing) {
    if (animate) { box.leftSpring!.jump(targetLeft); box.topSpring!.jump(targetTop); }
    else { box.layer.style.left = `${targetLeft}px`; box.layer.style.top = `${targetTop}px`; }
    boxFadeRef.current?.cancel();
    boxFadeRef.current = box.layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, fill: "both" });
    box.runEntrance(flip);
  } else {
    if (animate) { box.leftSpring!.set(targetLeft); box.topSpring!.set(targetTop); }
    else { box.layer.style.left = `${targetLeft}px`; box.layer.style.top = `${targetTop}px`; }
    if (prevFlip !== null && flip !== prevFlip) box.runEntrance(flip);
  }
  return flip;
}

function applyBoxContent(
  box: BoxBuild,
  doc: Document,
  title: string | undefined,
  rows: TooltipRow[],
  point: Record<string, unknown> | null,
  index: number,
  cfg: BoxConfig,
): void {
  const syncDisplayForContent = () => {
    if (cfg.content && point) {
      box.content.style.display = "none";
      box.custom.style.display = "";
      if (box.childrenWrap) box.childrenWrap.style.display = "none";
    } else {
      box.lastContentKey.current = null;
      box.custom.style.display = "none";
      box.content.style.display = "";
    }
  };

  if (cfg.content && point) {
    const key = `${index}:${JSON.stringify(point)}`;
    syncDisplayForContent();
    if (title !== undefined) { box.title.textContent = title; box.title.style.display = title ? "" : "none"; }
    const seen = new Set<string>();
    for (const row of rows) {
      const k = `${row.label}-${row.color}`; seen.add(k);
      let els = box.rowByKey.get(k);
      if (!els) {
        const root = doc.createElement("div"); root.className = "bkm-tooltip-row";
        const left = doc.createElement("div"); left.className = "bkm-tooltip-row-label";
        const swatch = doc.createElement("span"); swatch.className = "bkm-tooltip-swatch";
        const label = doc.createElement("span"); label.className = "bkm-tooltip-series";
        left.append(swatch, label);
        const value = doc.createElement("span"); value.className = "bkm-tooltip-value";
        root.append(left, value); box.rows.appendChild(root);
        els = { root, swatch, label, value }; box.rowByKey.set(k, els);
      }
      els.swatch.style.backgroundColor = row.color; els.label.textContent = row.label;
      els.value.textContent = typeof row.value === "number" ? intFmt(row.value) : String(row.value);
      els.root.style.display = "";
    }
    for (const [k, els] of box.rowByKey) if (!seen.has(k)) els.root.style.display = "none";
    if (key === box.lastContentKey.current) return;
    const doRender = () => {
      if (key !== box.lastContentKey.current) {
        box.lastContentKey.current = key;
        if (!box.customRoot.current) box.customRoot.current = createRoot(box.custom);
        box.customRoot.current.render(React.createElement(React.Fragment, null, cfg.content!({ point: point as ChartTooltipPoint, index })));
      }
      if (box.childrenWrap && cfg.children) {
        if (!box.childrenRoot.current) box.childrenRoot.current = createRoot(box.childrenWrap);
        box.childrenRoot.current.render(React.createElement(React.Fragment, null, cfg.children));
      }
    };
    if (box.contentScheduler) {
      box.contentScheduler.schedule(doRender, key);
    } else {
      doRender();
    }
    return;
  }
  syncDisplayForContent();
  if (title !== undefined) { box.title.textContent = title; box.title.style.display = title ? "" : "none"; }
  const seen = new Set<string>();
  for (const row of rows) {
    const k = `${row.label}-${row.color}`; seen.add(k);
    let els = box.rowByKey.get(k);
    if (!els) {
      const root = doc.createElement("div"); root.className = "bkm-tooltip-row";
      const left = doc.createElement("div"); left.className = "bkm-tooltip-row-label";
      const swatch = doc.createElement("span"); swatch.className = "bkm-tooltip-swatch";
      const label = doc.createElement("span"); label.className = "bkm-tooltip-series";
      left.append(swatch, label);
      const value = doc.createElement("span"); value.className = "bkm-tooltip-value";
      root.append(left, value); box.rows.appendChild(root);
      els = { root, swatch, label, value }; box.rowByKey.set(k, els);
    }
    els.swatch.style.backgroundColor = row.color; els.label.textContent = row.label;
    els.value.textContent = typeof row.value === "number" ? intFmt(row.value) : String(row.value);
    els.root.style.display = "";
  }
  for (const [k, els] of box.rowByKey) if (!seen.has(k)) els.root.style.display = "none";
  if (box.childrenWrap && cfg.children) {
    const doChildrenRender = () => {
      if (!box.childrenRoot.current) box.childrenRoot.current = createRoot(box.childrenWrap!);
      box.childrenRoot.current.render(React.createElement(React.Fragment, null, cfg.children));
    };
    if (box.contentScheduler) {
      box.contentScheduler.schedule(doChildrenRender, `children:${index}`);
    } else {
      doChildrenRender();
    }
    box.childrenWrap.style.display = "";
  } else if (box.childrenWrap) {
    box.childrenWrap.style.display = "none";
  }
}

function hideBoxContent(box: BoxBuild): void {
  box.title.textContent = "";
  for (const els of box.rowByKey.values()) { els.label.textContent = ""; els.value.textContent = ""; }
  box.lastContentKey.current = null;
}

// ─────────────────────────────────────────────────────────────────────────

export function attachLiveHoverChrome(
  host: HTMLElement,
  getConfig: () => LiveHoverConfig,
  options: LiveHoverChromeOptions = {},
): LiveHoverChrome {
  const tooltipSpring = options.tooltipSpring ?? TOOLTIP_SPRING;
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;

  const indicator = buildIndicator(doc, chromeId, toIndicatorConfig(getConfig()), tooltipSpring);
  const dotLayer = buildDotLayer(doc);
  const boxBuild = buildBox(doc, toBoxConfig(getConfig()), tooltipSpring, false);

  const pillLayer = doc.createElement("div");
  pillLayer.className = "bkm-date-pill-layer";
  const pill = doc.createElement("div"); pill.className = "bkm-date-pill";
  const pillInner = doc.createElement("div"); pillInner.className = "bkm-date-pill-inner";
  const pillLabelEl = doc.createElement("span"); pillInner.appendChild(pillLabelEl);
  pill.appendChild(pillInner); pillLayer.appendChild(pill); pillLayer.style.display = "none";
  const pillSpring = createSpring(0, tooltipSpring.stiffness, tooltipSpring.damping, (x) => { pillLayer.style.left = `${x}px`; });

  const xLabelLayer = doc.createElement("div"); xLabelLayer.className = "bkm-live-xlabel-layer";
  const xLabelBySlot = new Map<number, HTMLSpanElement>();
  const xLabelXBySlot = new Map<number, number>();

  const yTickLayer = doc.createElement("div"); yTickLayer.className = "bkm-live-ytick-layer";
  interface YTick { el: HTMLDivElement; span: HTMLSpanElement; ySpring: Spring; entered: boolean; }
  const yTickByKey = new Map<string, YTick>();

  host.append(indicator.svg, dotLayer.svg, boxBuild.layer, pillLayer, xLabelLayer, yTickLayer);

  const boxFadeRef: { current: Animation | null } = { current: null };
  let visible = false;
  let prevFlip: boolean | null = null;
  const liveGroups: Element[] = [];

  const hide = () => {
    if (!visible) return;
    visible = false;
    prevFlip = null;
    indicator.svg.style.display = "none";
    dotLayer.svg.style.display = "none";
    boxBuild.layer.style.display = "none";
    pillLayer.style.display = "none";
    indicator.xSpring.stop(); indicator.lineXSpring?.stop();
    boxBuild.leftSpring?.stop(); boxBuild.topSpring?.stop();
    pillSpring.stop();
    boxBuild.entranceSpring.stop();
    for (const { x, y } of dotLayer.springs.values()) { x.stop(); y.stop(); }
    boxFadeRef.current?.cancel(); boxFadeRef.current = null;
    hideBoxContent(boxBuild);
    pillLabelEl.textContent = "";
    for (const span of xLabelBySlot.values()) span.style.opacity = "1";
    for (const el of liveGroups) (el as HTMLElement).style.opacity = "1";
  };

  function updateHover(input: LiveHoverInput): void {
    const { point } = input;
    if (!point) { hide(); return; }
    const config = getConfig();
    const width = host.clientWidth;
    const showing = !visible;
    visible = true;

    if (config.showCrosshair) {
      indicator.svg.style.display = "";
      if (indicator.rect && !indicator.isDashed) {
        indicator.rect.setAttribute("y", String(config.margin.top));
        indicator.rect.setAttribute("height", String(Math.max(0, host.clientHeight - config.margin.top - config.margin.bottom)));
      }
      if (indicator.line) {
        indicator.line.setAttribute("y1", String(config.margin.top));
        indicator.line.setAttribute("y2", String(config.margin.top + Math.max(0, host.clientHeight - config.margin.top - config.margin.bottom)));
      }
      const target = point.x;
      if (showing) indicator.xSpring.jump(target);
      else indicator.xSpring.set(target);
      if (indicator.lineXSpring) {
        if (showing) indicator.lineXSpring.jump(target);
        else indicator.lineXSpring.set(target);
      }
    }

    if (config.showDots) {
      dotLayer.svg.style.display = "";
      const dotCfg = toDotConfig(config);
      for (const series of config.series) {
        const s = point.series.find((p) => p.dataKey === series.dataKey);
        if (!s) { hideDot(dotLayer, series.dataKey); continue; }
        // Resolve dot color: dotColor fn or series color
        let color = series.color;
        if (config.dotColor) {
          if (typeof config.dotColor === "function") {
            const pt: Record<string, unknown> = { date: point.date };
            for (const sp of point.series) pt[sp.dataKey] = sp.value;
            color = config.dotColor(pt, { dataKey: series.dataKey, stroke: series.color });
          } else color = config.dotColor;
        }
        ensureDot(doc, dotLayer, series.dataKey, color, point.x, s.y, dotCfg, tooltipSpring);
        updateDotPosition(dotLayer, series.dataKey, point.x, s.y, showing);
      }
    }

    if (config.showBox) {
      // Build rows: custom rows fn or default
      let rows: { color: string; label: string; value: string | number }[];
      if (config.rows) {
        const pt: Record<string, unknown> = { date: point.date };
        for (const s of point.series) pt[s.dataKey] = s.value;
        rows = config.rows(pt);
      } else {
        rows = config.series.map((series) => {
          const s = point.series.find((p) => p.dataKey === series.dataKey);
          return { color: series.color, label: series.dataKey, value: s ? series.formatValue(s.value) : "" };
        });
      }
      const title = shortDateFmt.format(point.date);
      // For live, content branching uses box helper directly (index for dedupe)
      const pt: Record<string, unknown> = { date: point.date };
      for (const s of point.series) pt[s.dataKey] = s.value;
      boxBuild.layer.style.top = `${config.margin.top}px`;
      boxBuild.layer.style.display = "";
      applyBoxContent(boxBuild, doc, title, rows, pt, input.index, toBoxConfig(config));
      const flip = positionBox(boxBuild, point.x, config.margin.top, width, host.clientHeight, BOX_OFFSET, showing, prevFlip, boxFadeRef);
      prevFlip = flip;
    } else {
      boxBuild.layer.style.display = "none";
      prevFlip = null;
    }

    if (config.showDatePill && input.pillLabel !== null) {
      pillLabelEl.textContent = input.pillLabel;
      pillLayer.style.display = "";
      if (showing) pillSpring.jump(point.x);
      else pillSpring.set(point.x);
    } else {
      pillLayer.style.display = "none";
    }

    for (const [slot, span] of xLabelBySlot) {
      const labelX = xLabelXBySlot.get(slot) ?? 0;
      const distance = Math.abs(labelX - point.x);
      let opacity = 1;
      if (distance < TICKER_HALF_WIDTH) opacity = 0;
      else if (distance < TICKER_HALF_WIDTH + FADE_BUFFER) opacity = (distance - TICKER_HALF_WIDTH) / FADE_BUFFER;
      span.style.opacity = String(opacity);
    }

    for (const el of liveGroups) (el as HTMLElement).style.opacity = "0.25";
  }

  function updateFrame(input: LiveHoverFrameInput): void {
    // bklit live-y-axis.tsx 186/209-211: per-tick alignment follows
    // <LiveYAxis position> — left branch is right-aligned with paddingRight,
    // right branch left-aligned with paddingLeft (class toggled per tick
    // below; the gutter panel itself further down).
    const yAxisIsLeft = (input.yAxisPosition ?? "left") !== "right";
    const seen = new Set<number>();
    for (const l of input.xLabels) {
      seen.add(l.key);
      xLabelXBySlot.set(l.key, l.x);
      let span = xLabelBySlot.get(l.key);
      if (!span) {
        span = doc.createElement("span");
        span.className = "bkm-live-xlabel";
        xLabelLayer.appendChild(span);
        xLabelBySlot.set(l.key, span);
      }
      span.textContent = l.label;
      span.style.left = `${l.x}px`;
    }
    for (const [slot, span] of xLabelBySlot) {
      if (!seen.has(slot)) { span.remove(); xLabelBySlot.delete(slot); xLabelXBySlot.delete(slot); }
    }

    const seenTicks = new Set<string>();
    for (const t of input.yTicks) {
      seenTicks.add(t.key);
      let tick = yTickByKey.get(t.key);
      if (!tick) {
        const el = doc.createElement("div"); el.className = "bkm-live-ytick";
        const span = doc.createElement("span"); el.appendChild(span);
        yTickLayer.appendChild(el);
        el.style.transition = "opacity 220ms ease-out";
        el.style.transform = `translateY(${t.y}px)`;
        el.style.opacity = "0";
        requestAnimationFrame(() => { el.style.opacity = String(t.edgeAlpha); });
        const ySpring = createSpring(t.y, TICK_SPRING.stiffness, TICK_SPRING.damping, (y) => { el.style.transform = `translateY(${y}px)`; });
        tick = { el, span, ySpring, entered: true };
        yTickByKey.set(t.key, tick);
      } else {
        tick.el.style.opacity = String(t.edgeAlpha);
        tick.ySpring.set(t.y);
      }
      tick.span.textContent = t.label;
      // bklit live-y-axis.tsx 209-211: alignment flips with position —
      // right branch is `{left:0, paddingLeft:8, textAlign:left}`.
      tick.el.classList.toggle("bkm-live-ytick--right", !yAxisIsLeft);
      if ((t as { labelColor?: string }).labelColor) tick.span.style.color = (t as { labelColor?: string }).labelColor!;
      else tick.span.style.color = "";
    }
    for (const [key, tick] of yTickByKey) {
      if (!seenTicks.has(key)) {
        tick.ySpring.stop();
        tick.el.style.transition = "opacity 150ms ease-out";
        tick.el.style.opacity = "0";
        tick.el.style.pointerEvents = "none";
        setTimeout(() => tick.el.remove(), 200);
        yTickByKey.delete(key);
      }
    }

    xLabelLayer.style.setProperty("--bkm-live-x-bottom", "12px");
    const innerHeightPx = Math.max(0, input.height - input.margin.top - input.margin.bottom);
    // bklit live-y-axis.tsx 190-198: the gutter panel is `top: margin.top,
    // height: innerHeight` with `left:0, width: margin.left` for position
    // "left" and `right:0, width: margin.right` for "right".
    yTickLayer.style.top = `${input.margin.top}px`;
    yTickLayer.style.height = `${innerHeightPx}px`;
    if (yAxisIsLeft) {
      yTickLayer.style.left = "0px";
      yTickLayer.style.right = "";
      yTickLayer.style.width = `${input.margin.left}px`;
    } else {
      yTickLayer.style.left = "";
      yTickLayer.style.right = "0px";
      yTickLayer.style.width = `${input.margin.right}px`;
    }
  }

  return {
    updateFrame,
    updateHover,
    registerLiveGroups(elements) {
      liveGroups.length = 0;
      liveGroups.push(...elements);
    },
    detach() {
      hide();
      indicator.svg.remove();
      dotLayer.svg.remove();
      boxBuild.layer.remove();
      pillLayer.remove();
      xLabelLayer.remove();
      yTickLayer.remove();
      boxBuild.customRoot.current?.unmount();
      boxBuild.childrenRoot.current?.unmount();
      dotLayer.byKey.clear(); dotLayer.springs.clear();
      boxBuild.rowByKey.clear();
      for (const tick of yTickByKey.values()) tick.ySpring.stop();
      yTickByKey.clear();
      xLabelBySlot.clear(); xLabelXBySlot.clear();
    },
  };
}

export const defaultRowFormat = intFmt;
