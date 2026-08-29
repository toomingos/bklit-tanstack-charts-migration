import { BOX_OFFSET, DISCRETE_INTERACTION_THRESHOLD, FADE_BUFFER, TICKER_HALF_WIDTH } from "./design-tokens";
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
import { TOOLTIP_SPRING } from "./design-tokens";

export interface BarHoverChromeSeries {
  dataKey: string;
  color: string;
}

export interface BarHoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  series: BarHoverChromeSeries[];
  pointCount: number;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
  /** B12 (bklit BarXAxis.tickerHalfWidth): date-pill fade radius for axis
      labels; defaults to the TICKER_HALF_WIDTH token when unset. */
  tickerHalfWidth?: number;
  tooltip?: ChartTooltipConfig | null;
  dateLabels?: string[];
  hoveredIndex?: number;
}

export interface BarFocusPoint {
  markId: string;
  value: number;
  x: number;
  y: number;
  color: string;
}

export interface BarFocusGroup {
  categoryIndex: number;
  categoryLabel: string;
  anchorX: number;
  points: readonly BarFocusPoint[];
}

export interface BarHoverChrome {
  onFocusChange(group: BarFocusGroup | null): void;
  detach(): void;
}

export interface BarHoverChromeOptions {
  tooltipSpring?: typeof TOOLTIP_SPRING;
}

let gradientCounter = 0;

function resolveDotColor(
  tooltip: ChartTooltipConfig | null | undefined,
  seriesColor: string,
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
  return seriesColor || pointColor;
}

export function attachBarHoverChrome(
  host: HTMLElement,
  getState: () => BarHoverChromeState,
  options: BarHoverChromeOptions = {},
): BarHoverChrome {
  const tooltipSpring = options.tooltipSpring ?? TOOLTIP_SPRING;
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;

  const indicator = buildIndicator(doc, chromeId, toIndicatorConfig(getState().tooltip), tooltipSpring);
  const dotLayer = buildDotLayer(doc);
  const boxBuild = buildBox(doc, toBoxConfig(getState().tooltip), tooltipSpring, false);
  const pillBuild = buildPill(doc, tooltipSpring, () => getState().dateLabels ?? []);
  host.append(indicator.svg, dotLayer.svg, boxBuild.layer, pillBuild.layer);

  let visible = false;
  let prevFlip: boolean | null = null;
  let boxFadeAnimation: Animation | null = null;

  let lastGroup: BarFocusGroup | null = null;

  const hide = () => {
    if (!visible) return;
    visible = false;
    lastGroup = null;
    prevFlip = null;
    indicator.svg.style.display = "none";
    dotLayer.svg.style.display = "none";
    boxBuild.layer.style.display = "none";
    pillBuild.layer.style.display = "none";
    indicator.xSpring.stop();
    indicator.lineXSpring?.stop();
    boxBuild.leftSpring?.stop();
    boxBuild.topSpring?.stop();
    pillBuild.spring.stop();
    boxBuild.entranceSpring.stop();
    boxFadeAnimation?.cancel(); boxFadeAnimation = null;
    for (const { x, y } of dotLayer.springs.values()) { x.stop(); y.stop(); }
    hideBoxContent(boxBuild);
    pillBuild.label.textContent = "";
    resetLabelFade(container);
  };

  const update = (group: BarFocusGroup | null) => {
    lastGroup = group && group.points.length > 0 ? group : null;
    if (!group || group.points.length === 0) { hide(); return; }
    const state = getState();
    const { margin } = state;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    const pointByMark = new Map(group.points.map((p) => [p.markId, p]));
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
      const target = group.anchorX;
      if (showing || discrete) indicator.xSpring.jump(target);
      else indicator.xSpring.set(target);
      if (indicator.lineXSpring) {
        if (showing || discrete) indicator.lineXSpring.jump(target);
        else indicator.lineXSpring.set(target);
      }
    }

    if (state.showDots) {
      dotLayer.svg.style.display = "";
      // Ring-dot sizing is inert (bar.md deviation): bandWidth was never
      // populated by any caller, so dots always used the plain dot config.
      const dotCfg = toDotConfig(state.tooltip);
      let tooltipRows: { color: string }[] | null = null;
      if (state.tooltip?.rows) tooltipRows = state.tooltip.rows({} as Record<string, unknown>) as { color: string }[];
      const pointForDotColor: Record<string, unknown> = {};
      for (const p of group.points) pointForDotColor[p.markId] = p.value;
      for (let i = 0; i < state.series.length; i++) {
        const series = state.series[i]!;
        const point = pointByMark.get(series.dataKey);
        if (!point) { hideDot(dotLayer, series.dataKey); continue; }
        const color = resolveDotColor(state.tooltip ?? null, series.color, point.color, pointForDotColor, { dataKey: series.dataKey, stroke: series.color }, tooltipRows, i);
        ensureDot(doc, dotLayer, series.dataKey, color, point.x, point.y, dotCfg, tooltipSpring);
        updateDotPosition(dotLayer, series.dataKey, point.x, point.y, showing);
      }
    }

    {
      const tooltip = state.tooltip ?? null;
      const title = group.categoryLabel;
      let rows: { color: string; label: string; value: string | number }[];
      if (tooltip?.rows) {
        const point: Record<string, unknown> = { label: group.categoryLabel };
        for (const p of group.points) point[p.markId] = p.value;
        rows = tooltip.rows(point);
      } else {
        rows = state.series.map((series) => {
          const point = pointByMark.get(series.dataKey);
          return { color: series.color || point?.color || "transparent", label: series.dataKey, value: point && typeof point.value === "number" ? point.value : 0 };
        });
      }
      boxBuild.layer.style.top = `${margin.top}px`;
      boxBuild.layer.style.display = "";
      const contentPoint: Record<string, unknown> = { label: group.categoryLabel };
      for (const p of group.points) contentPoint[p.markId] = p.value;
      applyBoxContent(boxBuild, doc, title, rows, contentPoint, group.categoryIndex, toBoxConfig(tooltip));
      const flip = positionBox(boxBuild, group.anchorX, margin.top, width, height, BOX_OFFSET, showing, prevFlip, { current: boxFadeAnimation } as { current: Animation | null });
      prevFlip = flip;
    }

    if (state.showDatePill) {
      pillBuild.layer.style.display = "";
      if (pillBuild.ticker && state.dateLabels && state.dateLabels.length > 0) {
        const idx = state.hoveredIndex ?? group.categoryIndex;
        pillBuild.ticker.update(idx, discrete);
      } else {
        pillBuild.label.textContent = group.categoryLabel;
      }
      if (showing || discrete) pillBuild.spring.jump(group.anchorX);
      else pillBuild.spring.set(group.anchorX);
    } else {
      pillBuild.layer.style.display = "none";
    }

    applyLabelFade(container, group.anchorX, group.categoryLabel, state.tickerHalfWidth ?? TICKER_HALF_WIDTH, FADE_BUFFER);
  };

  return {
    onFocusChange: update,
    detach() {
      hide();
      indicator.svg.remove();
      dotLayer.svg.remove();
      boxBuild.layer.remove();
      pillBuild.layer.remove();
      dotLayer.byKey.clear();
      dotLayer.springs.clear();
      boxBuild.rowByKey.clear();
      pillBuild.ticker?.detach();
      boxBuild.customRoot.current?.unmount();
      boxBuild.childrenRoot.current?.unmount();
    },
  };
}
