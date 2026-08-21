import * as React from "react";
import { intFmt, shortDateFmt } from "./formatters";
import { createSpring, type Spring } from "./spring";
import {
  BOX_OFFSET,
  FADE_BUFFER,
  TICKER_HALF_WIDTH,
} from "./design-tokens";
import {
  applyBoxContent,
  buildBox,
  buildDotLayer,
  buildIndicator,
  ensureDot,
  hideBoxContent,
  hideDot,
  positionBox,
  updateDotPosition,
  type BoxConfig,
  type DotConfig,
  type IndicatorConfig,
} from "./tooltip-chrome";
import type { ChartTooltipPoint } from "./types";
import { TOOLTIP_BOX_SPRING, TOOLTIP_SPRING } from "./design-tokens";
const TICK_SPRING = { stiffness: 180, damping: 24 };

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
  width: number; height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  xLabels: Array<{ x: number; label: string; key: number }>;
  yTicks: Array<{ key: string; y: number; label: string; edgeAlpha: number }>;
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
  tooltipBoxSpring?: typeof TOOLTIP_BOX_SPRING;
}

let gradientCounter = 0;

function toIndicatorConfig(cfg: LiveHoverConfig): IndicatorConfig {
  return {
    width: cfg.indicatorWidth,
    span: cfg.indicatorSpan,
    columnWidth: cfg.columnWidth,
    color: cfg.indicatorColor as IndicatorConfig["color"],
    dasharray: cfg.indicatorDasharray,
    fadeEdges: cfg.indicatorFadeEdges,
    fadeLength: cfg.indicatorFadeLength,
    springConfig: cfg.springConfig,
  };
}
function toDotConfig(cfg: LiveHoverConfig): DotConfig {
  return {
    variant: cfg.dotVariant,
    size: cfg.dotSize,
    radiusFraction: cfg.dotRadiusFraction,
    scale: cfg.dotScale,
    strokeWidth: cfg.dotStrokeWidth,
    color: cfg.dotColor as DotConfig["color"],
  };
}
function toBoxConfig(cfg: LiveHoverConfig): BoxConfig {
  return {
    springConfig: cfg.springConfig,
    matchCrosshair: cfg.matchCrosshair,
    damping: cfg.damping,
    boxSpringConfig: cfg.boxSpringConfig,
    className: cfg.className,
    panelStyle: cfg.panelStyle,
    backgroundColor: cfg.backgroundColor,
    content: cfg.content,
    children: cfg.children,
    rows: cfg.rows,
  };
}

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
  // Rebuild box springs to use tooltipBoxSpring when not overridden
  // (buildBox uses resolveBoxSpring which reads damping/boxSpringConfig; for live we keep that)

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

  let boxFadeAnimation: Animation | null = null;
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
    boxFadeAnimation?.cancel(); boxFadeAnimation = null;
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
      const flip = positionBox(boxBuild, point.x, config.margin.top, width, host.clientHeight, BOX_OFFSET, showing, prevFlip, { current: boxFadeAnimation } as { current: Animation | null });
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
    yTickLayer.style.top = `${input.margin.top}px`;
    yTickLayer.style.left = "0px";
    yTickLayer.style.width = `${input.margin.left}px`;
    yTickLayer.style.height = `${innerHeightPx}px`;
    void input.width;
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
