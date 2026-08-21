import { shortDateFmt, weekdayDateFmt } from "./formatters";
import { createSpring } from "./spring";
import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, FADE_BUFFER, TICKER_HALF_WIDTH } from "./design-tokens";
import {
  applyBoxContent,
  applyLabelFade,
  buildBox,
  buildIndicator,
  buildPill,
  hideBoxContent,
  positionBox,
  resetLabelFade,
  type BoxConfig,
  type IndicatorConfig,
} from "./tooltip-chrome";
import type { ChartTooltipConfig } from "./types";
import { TOOLTIP_BOX_SPRING, TOOLTIP_SPRING } from "./design-tokens";

const SVG_NS = "http://www.w3.org/2000/svg";
const DIM_TRANSITION = "opacity 0.15s ease-in-out";

export interface CandlestickHoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  pointCount: number;
  fadedOpacity: number;
  showHoverFade: boolean;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
  tooltip?: ChartTooltipConfig | null;
  dateLabels?: string[];
  legendHoveredIndex?: number | null;
}

export interface CandleRectGeometry {
  x: number; y: number; width: number; height: number; fill: string; radius?: number; strokeWidth?: number;
}

export interface CandlestickFocusPoint {
  date: Date;
  close: number;
  centerX: number;
  closeY: number;
  index: number;
  body: CandleRectGeometry;
  wick: CandleRectGeometry;
}

export interface CandlestickHoverChrome {
  onFocusChange(point: CandlestickFocusPoint | null): void;
  syncLegendDim(): void;
  detach(): void;
}

export interface CandlestickHoverChromeOptions {
  tooltipSpring?: typeof TOOLTIP_SPRING;
  tooltipBoxSpring?: typeof TOOLTIP_BOX_SPRING;
}

let chromeCounter = 0;

function toIndicatorConfig(cfg?: ChartTooltipConfig | null): IndicatorConfig {
  if (!cfg) return {};
  return {
    width: cfg.indicatorWidth,
    span: cfg.indicatorSpan,
    columnWidth: cfg.columnWidth,
    color: cfg.indicatorColor as IndicatorConfig["color"],
    dasharray: cfg.indicatorDasharray,
    fadeEdges: cfg.indicatorFadeEdges as IndicatorConfig["fadeEdges"],
    fadeLength: cfg.indicatorFadeLength,
    springConfig: cfg.springConfig,
  };
}
function toBoxConfig(cfg?: ChartTooltipConfig | null): BoxConfig {
  if (!cfg) return {};
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

export function attachCandlestickHoverChrome(
  host: HTMLElement,
  getState: () => CandlestickHoverChromeState,
  options: CandlestickHoverChromeOptions = {},
): CandlestickHoverChrome {
  const tooltipSpring = options.tooltipSpring ?? TOOLTIP_SPRING;
  const _tooltipBoxSpring = options.tooltipBoxSpring ?? TOOLTIP_BOX_SPRING;
  void _tooltipBoxSpring;
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++chromeCounter;

  const activeHighlightSvg = doc.createElementNS(SVG_NS, "svg");
  activeHighlightSvg.setAttribute("class", "bkm-hover-layer");
  activeHighlightSvg.setAttribute("aria-hidden", "true");
  activeHighlightSvg.style.display = "none";
  const highlightWick = doc.createElementNS(SVG_NS, "rect");
  const highlightBody = doc.createElementNS(SVG_NS, "rect");
  activeHighlightSvg.append(highlightWick, highlightBody);

  const indicator = buildIndicator(doc, chromeId, toIndicatorConfig(getState().tooltip), tooltipSpring);
  // Candlestick dot is a single circle (not per-series); keep custom dot handling for simplicity
  // but use shared pill/box
  const dotsSvg = doc.createElementNS(SVG_NS, "svg");
  dotsSvg.setAttribute("class", "bkm-hover-layer");
  dotsSvg.setAttribute("aria-hidden", "true");
  dotsSvg.style.display = "none";
  const dot = doc.createElementNS(SVG_NS, "circle");
  dot.setAttribute("r", "5");
  dot.setAttribute("fill", "var(--chart-line-primary)");
  dot.setAttribute("stroke", "var(--chart-background)");
  dot.setAttribute("stroke-width", "2");
  dotsSvg.appendChild(dot);

  const boxBuild = buildBox(doc, toBoxConfig(getState().tooltip), tooltipSpring, false);
  // Candlestick box is single-row "close" — but if tooltip.rows/content is provided, use shared branching
  const pillBuild = buildPill(doc, tooltipSpring, () => getState().dateLabels ?? []);

  host.append(activeHighlightSvg, indicator.svg, dotsSvg, boxBuild.layer, pillBuild.layer);

  const dotXSpring = createSpring(0, tooltipSpring.stiffness, tooltipSpring.damping, (x) => dot.setAttribute("cx", String(x)));
  const dotYSpring = createSpring(0, tooltipSpring.stiffness, tooltipSpring.damping, (y) => dot.setAttribute("cy", String(y)));

  let visible = false;
  let prevFlip: boolean | null = null;
  let boxFadeAnimation: Animation | null = null;

  const setMarksDimmed = (dimmed: boolean, fadedOpacity: number) => {
    const wicksGroup = container.querySelector<SVGGElement>('.ts-chart__candle[data-ts-key="wicks"]');
    const bodiesGroup = container.querySelector<SVGGElement>('.ts-chart__candle[data-ts-key="bodies"]');
    const value = dimmed ? String(fadedOpacity) : "1";
    if (wicksGroup) { wicksGroup.style.transition = DIM_TRANSITION; wicksGroup.style.opacity = value; }
    if (bodiesGroup) { bodiesGroup.style.transition = DIM_TRANSITION; bodiesGroup.style.opacity = value; }
  };

  const applyRectGeometry = (el: SVGRectElement, geometry: CandleRectGeometry) => {
    el.setAttribute("x", String(geometry.x)); el.setAttribute("y", String(geometry.y));
    el.setAttribute("width", String(geometry.width)); el.setAttribute("height", String(geometry.height));
    el.setAttribute("fill", geometry.fill);
    if (geometry.radius !== undefined) el.setAttribute("rx", String(geometry.radius));
    if (geometry.strokeWidth) { el.setAttribute("stroke", geometry.fill); el.setAttribute("stroke-width", String(geometry.strokeWidth)); }
    else el.removeAttribute("stroke");
  };

  let lastPoint: CandlestickFocusPoint | null = null;
  let legendActive = false;

  const syncLegendDim = () => {
    const st = getState();
    const nowLegendActive = st.legendHoveredIndex != null;
    if (nowLegendActive === legendActive) return;
    legendActive = nowLegendActive;
    if (legendActive) {
      setMarksDimmed(false, 1);
      if (visible && lastPoint) {
        activeHighlightSvg.style.display = "none";
      }
    } else if (visible && lastPoint) {
      if (st.showHoverFade) setMarksDimmed(true, st.fadedOpacity);
      activeHighlightSvg.style.display = "";
    }
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    lastPoint = null;
    prevFlip = null;
    indicator.svg.style.display = "none";
    dotsSvg.style.display = "none";
    boxBuild.layer.style.display = "none";
    pillBuild.layer.style.display = "none";
    activeHighlightSvg.style.display = "none";
    indicator.xSpring.stop(); indicator.lineXSpring?.stop();
    dotXSpring.stop(); dotYSpring.stop();
    boxBuild.leftSpring?.stop(); boxBuild.topSpring?.stop();
    pillBuild.spring.stop();
    boxBuild.entranceSpring.stop();
    boxFadeAnimation?.cancel(); boxFadeAnimation = null;
    setMarksDimmed(false, 1);
    hideBoxContent(boxBuild);
    pillBuild.label.textContent = "";
    resetLabelFade(container);
  };

  const update = (point: CandlestickFocusPoint | null) => {
    lastPoint = point;
    if (!point) { hide(); return; }
    const state = getState();
    const { margin } = state;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    const discrete = state.pointCount > DISCRETE_INTERACTION_THRESHOLD;
    const showing = !visible;
    visible = true;

    // Indicator color may be fn(point) — resolve per point
    if (state.tooltip?.indicatorColor && typeof state.tooltip.indicatorColor === "function") {
      const c = state.tooltip.indicatorColor({ date: point.date, close: point.close } as Record<string, unknown>);
      if (indicator.rect) indicator.rect.setAttribute("fill", c);
      if (indicator.line) indicator.line.setAttribute("stroke", c);
    }

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
      const target = point.centerX;
      if (showing || discrete) indicator.xSpring.jump(target);
      else indicator.xSpring.set(target);
      if (indicator.lineXSpring) {
        if (showing || discrete) indicator.lineXSpring.jump(target);
        else indicator.lineXSpring.set(target);
      }
    }

    if (state.showDots) {
      dotsSvg.style.display = "";
      // dotColor may be fn for candlestick (close vs open) — resolve
      let dotFill = "var(--chart-line-primary)";
      if (state.tooltip?.dotColor) {
        if (typeof state.tooltip.dotColor === "function") dotFill = state.tooltip.dotColor({ date: point.date, close: point.close } as Record<string, unknown>, { dataKey: "close" });
        else dotFill = state.tooltip.dotColor;
      }
      dot.setAttribute("fill", dotFill);
      // dotVariant/ring for candlestick: honor if set
      if (state.tooltip?.dotVariant === "ring") {
        // Convert circle to ring rect is not trivial; keep circle but adjust stroke
        dot.setAttribute("fill", "transparent");
        dot.setAttribute("stroke", dotFill);
        dot.setAttribute("stroke-width", String(state.tooltip.dotStrokeWidth ?? 1.5));
        const size = (state.tooltip.dotSize ?? 5) * (state.tooltip.dotScale ?? 1);
        dot.setAttribute("r", String(size));
      }
      // Dot always springs (bklit ChartTooltip never passes discrete to TooltipDot).
      if (showing) { dotXSpring.jump(point.centerX); dotYSpring.jump(point.closeY); }
      else { dotXSpring.set(point.centerX); dotYSpring.set(point.closeY); }
    }

    const legendDimActive = state.legendHoveredIndex != null;
    legendActive = legendDimActive;
    if (!legendDimActive && state.showHoverFade) setMarksDimmed(true, state.fadedOpacity);
    else if (legendDimActive) setMarksDimmed(false, 1);
    if (legendDimActive) {
      activeHighlightSvg.style.display = "none";
    } else {
      activeHighlightSvg.style.display = "";
      applyRectGeometry(highlightWick, point.wick);
      applyRectGeometry(highlightBody, point.body);
    }

    // Tooltip box — if custom rows/content provided, delegate to shared helper; else single "close" row
    {
      const tooltip = state.tooltip ?? null;
      if (tooltip?.rows || tooltip?.content || tooltip?.children) {
        const pointRec: Record<string, unknown> = { date: point.date, close: point.close };
        let rows: { color: string; label: string; value: string | number }[];
        if (tooltip?.rows) rows = tooltip.rows(pointRec);
        else rows = [{ color: "var(--chart-line-primary)", label: "close", value: point.close }];
        const title = weekdayDateFmt.format(point.date);
        boxBuild.layer.style.top = `${margin.top}px`;
        boxBuild.layer.style.display = "";
        applyBoxContent(boxBuild, doc, title, rows, pointRec, 0, toBoxConfig(tooltip));
        const flip = positionBox(boxBuild, point.centerX, margin.top, width, height, BOX_OFFSET, showing, prevFlip, { current: boxFadeAnimation } as { current: Animation | null });
        prevFlip = flip;
      } else {
        boxBuild.layer.style.top = `${margin.top}px`;
        boxBuild.layer.style.display = "";
        // Ensure default single-row content is present
        // Use shared helper with single row
        applyBoxContent(boxBuild, doc, weekdayDateFmt.format(point.date), [{ color: "var(--chart-line-primary)", label: "close", value: point.close }], { date: point.date, close: point.close } as Record<string, unknown>, 0, toBoxConfig(tooltip));
        const flip = positionBox(boxBuild, point.centerX, margin.top, width, height, BOX_OFFSET, showing, prevFlip, { current: boxFadeAnimation } as { current: Animation | null });
        prevFlip = flip;
      }
    }

    if (state.showDatePill) {
      pillBuild.layer.style.display = "";
      if (pillBuild.ticker && state.dateLabels && state.dateLabels.length > 0) {
        pillBuild.ticker.update(point.index, discrete);
      } else {
        pillBuild.label.textContent = shortDateFmt.format(point.date);
      }
      if (showing || discrete) pillBuild.spring.jump(point.centerX);
      else pillBuild.spring.set(point.centerX);
    } else {
      pillBuild.layer.style.display = "none";
    }

    const hoveredLabel = shortDateFmt.format(point.date);
    applyLabelFade(container, point.centerX, hoveredLabel, TICKER_HALF_WIDTH, FADE_BUFFER);
  };

  return {
    onFocusChange: update,
    syncLegendDim,
    detach() {
      hide();
      activeHighlightSvg.remove();
      indicator.svg.remove();
      dotsSvg.remove();
      boxBuild.layer.remove();
      pillBuild.layer.remove();
      pillBuild.ticker?.detach();
      boxBuild.customRoot.current?.unmount();
      boxBuild.childrenRoot.current?.unmount();
    },
  };
}
