import { shortDateFmt, weekdayDateFmt } from "./formatters";
import { DISCRETE_INTERACTION_THRESHOLD, FADE_BUFFER, TICKER_HALF_WIDTH } from "./design-tokens";
import {
  applyBoxContent,
  applyLabelFade,
  buildBox,
  buildDotLayer,
  buildIndicator,
  buildPill,
  ensureDot,
  hideBoxContent,
  hideDot,
  positionBox,
  resetLabelFade,
  updateDotPosition,
} from "./tooltip-chrome";
import {
  toBoxConfig,
  toDotConfig,
  toIndicatorConfig,
} from "./tooltip-mappers";
import type { ChartTooltipConfig } from "./types";
import { BOX_OFFSET, TOOLTIP_SPRING } from "./design-tokens";

const SVG_NS = "http://www.w3.org/2000/svg";

const DIM_OPACITY = "0.5";
const DIM_BLUR_PX = 2;
const DIM_TRANSITION = "opacity 0.15s ease-in-out, filter 0.15s ease-in-out";
const ACTIVE_SCALE = 1.35;

export interface ScatterHoverChromeSeries {
  dataKey: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  ringGap: number;
  radius: number;
  /** Fill for the enlarged hover-highlight copy — bklit's markerStyle.fill
      (the yGradient url when yGradient owns the marker, else `fill`). */
  highlightFill?: string;
  /** Stroke for the highlight copy ring — bklit's markerStyle.stroke
      (`stroke` prop, else `highlightFill`). */
  highlightStroke?: string;
  /** bklit SeriesMarkers fadeOnHover (default true). */
  fadeOnHover?: boolean;
  /** bklit SeriesMarkers inactiveOpacity (default 0.5). */
  inactiveOpacity?: number;
  /** bklit SeriesMarkers inactiveBlur px (default 2). */
  inactiveBlur?: number;
  /** bklit series-point-marker outline circle beyond the ring (default 0). */
  outlineWidth?: number;
  /** Outline color; falls back to `highlightStroke ?? stroke`. */
  outlineColor?: string;
  /** bklit SeriesMarkers showActiveHighlight (default true). */
  showActiveHighlight?: boolean;
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

export function attachScatterHoverChrome(
  host: HTMLElement,
  getState: () => ScatterHoverChromeState,
  options: ScatterHoverChromeOptions = {},
): ScatterHoverChrome {
  const tooltipSpring = options.tooltipSpring ?? TOOLTIP_SPRING;
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;

  const activeHighlightSvg = doc.createElementNS(SVG_NS, "svg");
  activeHighlightSvg.setAttribute("class", "bkm-hover-layer");
  activeHighlightSvg.setAttribute("aria-hidden", "true");
  activeHighlightSvg.style.display = "none";
  const activeGroupBySeries = new Map<string, SVGGElement>();

  const indicator = buildIndicator(doc, chromeId, toIndicatorConfig(getState().tooltip), tooltipSpring);
  const dotLayer = buildDotLayer(doc);
  const boxBuild = buildBox(doc, toBoxConfig(getState().tooltip), tooltipSpring, false);
  const pillBuild = buildPill(doc, tooltipSpring, () => getState().dateLabels ?? []);
  host.append(activeHighlightSvg, indicator.svg, dotLayer.svg, boxBuild.layer, pillBuild.layer);

  let visible = false;
  let prevFlip: boolean | null = null;
  let boxFadeAnimation: Animation | null = null;

  const setMarkersDimmed = (dimmed: boolean) => {
    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup) return;
    const state = getState();
    // bklit wraps EACH series' markers in its own SeriesMarkersDimWrapper
    // (dimBase = fadeOnHover && tooltipData != null), so every series dims to
    // its OWN opacity/blur while any hover is active. TanStack emits one
    // `.ts-chart__dot[data-ts-key]` group per series — style those directly.
    for (const series of state.series) {
      const escaped = series.dataKey.replace(/"/g, '\\"');
      const group = marksGroup.querySelector<SVGGElement>(
        `.ts-chart__dot[data-ts-key="${escaped}"]`,
      );
      if (!group) continue;
      if (!(series.fadeOnHover ?? true)) continue;
      group.style.transition = DIM_TRANSITION;
      group.style.opacity = dimmed ? String(series.inactiveOpacity ?? Number(DIM_OPACITY)) : "1";
      group.style.filter = dimmed ? `blur(${series.inactiveBlur ?? DIM_BLUR_PX}px)` : "none";
    }
  };

  const ensureActiveGroup = (series: ScatterHoverChromeSeries): SVGGElement => {
    let group = activeGroupBySeries.get(series.dataKey);
    if (group) return group;
    // bklit SeriesMarkersActiveHighlight: showActiveHighlight=false keeps the
    // group at scale 1 — still rendered so hover-dim + dots keep working.
    const activeScale = (series.showActiveHighlight ?? true) ? ACTIVE_SCALE : 1;
    group = doc.createElementNS(SVG_NS, "g") as SVGGElement;
    // bklit MarkerCircles draw order: outline → fill disc → ring.
    if ((series.outlineWidth ?? 0) > 0) {
      const outlineCircle = doc.createElementNS(SVG_NS, "circle");
      outlineCircle.setAttribute("cx", "0"); outlineCircle.setAttribute("cy", "0");
      const ringOuter =
        series.strokeWidth > 0
          ? series.radius + series.ringGap + series.strokeWidth
          : series.radius;
      outlineCircle.setAttribute("r", String(ringOuter + (series.outlineWidth ?? 0) / 2));
      outlineCircle.setAttribute("fill", "none");
      outlineCircle.setAttribute("stroke", series.outlineColor ?? series.stroke);
      outlineCircle.setAttribute("stroke-width", String(series.outlineWidth));
      group.appendChild(outlineCircle);
    }
    const fillCircle = doc.createElementNS(SVG_NS, "circle");
    fillCircle.setAttribute("cx", "0"); fillCircle.setAttribute("cy", "0");
    fillCircle.setAttribute("r", String(series.radius));
    fillCircle.setAttribute("fill", series.highlightFill ?? series.fill);
    group.appendChild(fillCircle);
    if (series.strokeWidth > 0) {
      const ringCircle = doc.createElementNS(SVG_NS, "circle");
      ringCircle.setAttribute("cx", "0"); ringCircle.setAttribute("cy", "0");
      ringCircle.setAttribute("r", String(series.radius + series.ringGap + series.strokeWidth / 2));
      ringCircle.setAttribute("fill", "none");
      ringCircle.setAttribute("stroke", series.highlightStroke ?? series.stroke);
      ringCircle.setAttribute("stroke-width", String(series.strokeWidth));
      group.appendChild(ringCircle);
    }
    group.dataset.bkmActiveScale = String(activeScale);
    activeHighlightSvg.appendChild(group);
    activeGroupBySeries.set(series.dataKey, group);
    return group;
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    prevFlip = null;
    indicator.svg.style.display = "none";
    dotLayer.svg.style.display = "none";
    boxBuild.layer.style.display = "none";
    pillBuild.layer.style.display = "none";
    activeHighlightSvg.style.display = "none";
    indicator.xSpring.stop();
    indicator.lineXSpring?.stop();
    boxBuild.leftSpring?.stop(); boxBuild.topSpring?.stop();
    pillBuild.spring.stop();
    boxBuild.entranceSpring.stop();
    boxFadeAnimation?.cancel(); boxFadeAnimation = null;
    for (const { x, y } of dotLayer.springs.values()) { x.stop(); y.stop(); }
    setMarkersDimmed(false);
    for (const group of activeGroupBySeries.values()) group.style.display = "none";
    hideBoxContent(boxBuild);
    pillBuild.label.textContent = "";
    resetLabelFade(container);
  };

  const update = (points: readonly ScatterFocusPoint[]) => {
    if (points.length === 0) { hide(); return; }
    const state = getState();
    const { margin } = state;
    const width = container.clientWidth;
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

    setMarkersDimmed(true);
    activeHighlightSvg.style.display = "";
    for (const series of state.series) {
      const point = pointByMark.get(series.dataKey);
      const group = ensureActiveGroup(series);
      if (!point) { group.style.display = "none"; continue; }
      group.style.display = "";
      group.setAttribute("transform", `translate(${point.x}, ${point.y}) scale(${group.dataset.bkmActiveScale ?? "1.35"})`);
    }

    {
      const tooltip = state.tooltip ?? null;
      const title: string | undefined = isDate ? weekdayDateFmt.format(date as Date) : undefined;
      let rows: { color: string; label: string; value: string | number }[];
      if (tooltip?.rows) rows = tooltip.rows(primary.datum as Record<string, unknown>);
      else rows = state.series.map((series) => {
        const v = (primary.datum as Record<string, unknown>)[series.dataKey];
        return { color: series.fill || pointByMark.get(series.dataKey)?.color || "transparent", label: series.dataKey, value: typeof v === "number" ? v : String(v ?? 0) };
      });
      boxBuild.layer.style.top = `${margin.top}px`;
      boxBuild.layer.style.display = "";
      applyBoxContent(boxBuild, doc, title, rows, primary.datum as Record<string, unknown>, primary.datumIndex, toBoxConfig(tooltip));
      const flip = positionBox(boxBuild, primary.x, margin.top, width, height, BOX_OFFSET, showing, prevFlip, { current: boxFadeAnimation } as { current: Animation | null });
      prevFlip = flip;
    }

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
      activeHighlightSvg.remove();
      indicator.svg.remove();
      dotLayer.svg.remove();
      boxBuild.layer.remove();
      pillBuild.layer.remove();
      dotLayer.byKey.clear(); dotLayer.springs.clear();
      boxBuild.rowByKey.clear();
      activeGroupBySeries.clear();
      pillBuild.ticker?.detach();
      boxBuild.customRoot.current?.unmount();
      boxBuild.childrenRoot.current?.unmount();
    },
  };
}
