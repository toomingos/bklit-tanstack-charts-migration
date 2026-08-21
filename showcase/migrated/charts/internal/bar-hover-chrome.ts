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
  type BoxConfig,
  type DotConfig,
  type IndicatorConfig,
} from "./tooltip-chrome";
import type { ChartTooltipConfig } from "./types";
import { TOOLTIP_BOX_SPRING, TOOLTIP_SPRING } from "./design-tokens";

const DIM_TRANSITION = "opacity 0.15s ease-in-out";
const BAR_SQUARES_DIM_TRANSITION = "opacity 0.15s ease-out";
const BAR_TRACK_DIM_TRANSITION = "opacity 0.15s ease-in-out";
const BAR_DEPTH_DIM_TRANSITION = "opacity 0.15s ease-out";

export interface BarHoverChromeSeries {
  dataKey: string;
  color: string;
  fadedOpacity: number;
}

export interface BarSquaresChromeSeries {
  dataKey: string;
  fadedOpacity: number;
}

export interface BarHoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  series: BarHoverChromeSeries[];
  barSquaresSeries?: BarSquaresChromeSeries[];
  barTrackOpacity?: number;
  pointCount: number;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
  tooltip?: ChartTooltipConfig | null;
  dateLabels?: string[];
  hoveredIndex?: number;
  legendHoveredIndex?: number | null;
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
  syncDim(): void;
  detach(): void;
}

export interface BarHoverChromeOptions {
  tooltipSpring?: typeof TOOLTIP_SPRING;
  tooltipBoxSpring?: typeof TOOLTIP_BOX_SPRING;
}

let gradientCounter = 0;

function toDotConfig(cfg?: ChartTooltipConfig | null, bandWidth?: number, seriesCount?: number, groupGap?: number): DotConfig {
  if (!cfg) return {};
  const out: DotConfig = {
    variant: cfg.dotVariant,
    size: cfg.dotSize,
    radiusFraction: cfg.dotRadiusFraction,
    scale: cfg.dotScale,
    strokeWidth: cfg.dotStrokeWidth,
    color: cfg.dotColor as DotConfig["color"],
  };
  if (cfg.dotVariant === "ring" && bandWidth != null && seriesCount != null) {
    const gap = groupGap ?? (seriesCount > 1 ? 4 : 0);
    const squareSize = (bandWidth - gap * (seriesCount - 1)) / seriesCount;
    if (squareSize > 0) out.size = (squareSize / 2) * (cfg.dotScale ?? 1);
    out.scale = 1;
  }
  return out;
}

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
  const _tooltipBoxSpring = options.tooltipBoxSpring ?? TOOLTIP_BOX_SPRING;
  void _tooltipBoxSpring;
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

  const setCategoryHover = (hoveredIndex: number | null, series: readonly BarHoverChromeSeries[]) => {
    const stateLegend = getState().legendHoveredIndex ?? null;
    for (let idx = 0; idx < series.length; idx++) {
      const s = series[idx]!;
      const isLegendDimmed = stateLegend !== null && stateLegend !== idx;
      const escaped = s.dataKey.replace(/"/g, '\\"');
      const group = container.querySelector<SVGGElement>(`.ts-chart__bar-y[data-ts-key="${escaped}"]`);
      if (!group) continue;
      const rects = group.querySelectorAll<SVGRectElement>("rect");
      rects.forEach((rect, i) => {
        rect.style.transition = DIM_TRANSITION;
        const dimByRow = hoveredIndex !== null && hoveredIndex !== i;
        rect.style.opacity = dimByRow || isLegendDimmed ? String(s.fadedOpacity) : "1";
      });
    }
    const squaresSeries = getState().barSquaresSeries;
    if (squaresSeries && squaresSeries.length > 0) {
      for (let sIdx = 0; sIdx < squaresSeries.length; sIdx++) {
        const s = squaresSeries[sIdx]!;
        const isLegendDimmed = stateLegend !== null && stateLegend !== sIdx;
        const escaped = s.dataKey.replace(/"/g, '\\"');
        const group = container.querySelector<SVGGElement>(`.ts-chart__bar-squares[data-ts-key="${escaped}"]`);
        if (!group) continue;
        const rects = group.querySelectorAll<SVGRectElement>("rect");
        rects.forEach((rect) => {
          rect.style.transition = BAR_SQUARES_DIM_TRANSITION;
          const key = rect.getAttribute("data-ts-key") ?? "";
          const m = key.match(/:sq:(\d+):/);
          const colIndex = m ? Number.parseInt(m[1]!, 10) : 0;
          const dimByRow = hoveredIndex !== null && hoveredIndex !== colIndex;
          rect.style.opacity = dimByRow || isLegendDimmed ? String(s.fadedOpacity) : "1";
        });
      }
    }
    const trackGroups = container.querySelectorAll<SVGGElement>(`.ts-chart__bar-column-track`);
    const trackOpacity = hoveredIndex !== null ? "0" : String(getState().barTrackOpacity ?? 0.3);
    trackGroups.forEach((g) => {
      (g as unknown as HTMLElement).style.transition = BAR_TRACK_DIM_TRANSITION as unknown as string;
      g.style.opacity = trackOpacity;
      g.querySelectorAll<SVGRectElement>("rect").forEach((r) => {
        r.style.opacity = "";
      });
    });
    {
      const hasHover = hoveredIndex !== null;
      const hasLegend = stateLegend !== null;
      if (hasHover || hasLegend) {
        const depthBackGroups = container.querySelectorAll<SVGGElement>(`.ts-chart__bar-depth-back`);
        depthBackGroups.forEach((g) => {
          const paths = g.querySelectorAll<SVGElement>("path");
          paths.forEach((p) => {
            const k = p.getAttribute("data-ts-key") ?? "";
            const mm = k.match(/:(side|lid):(\d+)/);
            const barIdx = mm ? Number.parseInt(mm[2]!, 10) : null;
            if (barIdx === null) return;
            const dimByRow = hoveredIndex !== null && hoveredIndex !== barIdx;
            p.style.transition = BAR_DEPTH_DIM_TRANSITION;
            p.style.opacity = dimByRow || hasLegend ? "0.3" : "1";
          });
        });
        const depthFrontGroups = container.querySelectorAll<SVGGElement>(`.ts-chart__bar-depth-front`);
        depthFrontGroups.forEach((g) => {
          const rects = g.querySelectorAll<SVGRectElement>("rect");
          rects.forEach((r) => {
            const k = r.getAttribute("data-ts-key") ?? "";
            const mm = k.match(/:glass:(\d+)/);
            const barIdx = mm ? Number.parseInt(mm[1]!, 10) : null;
            if (barIdx === null) return;
            const dimByRow = hoveredIndex !== null && hoveredIndex !== barIdx;
            r.style.transition = BAR_DEPTH_DIM_TRANSITION;
            r.style.opacity = dimByRow || hasLegend ? "0.3" : "1";
          });
        });
        const pulseGroups = container.querySelectorAll<SVGGElement>(`.ts-chart__bar-pulse`);
        pulseGroups.forEach((g) => {
          (g as unknown as HTMLElement).style.transition = BAR_DEPTH_DIM_TRANSITION;
          g.style.opacity = hasHover || hasLegend ? "0.3" : "1";
        });
      } else {
        container.querySelectorAll<SVGGElement>(`.ts-chart__bar-depth-back path`).forEach((p) => {
          (p as unknown as HTMLElement).style.opacity = "1";
        });
        container.querySelectorAll<SVGGElement>(`.ts-chart__bar-depth-front rect`).forEach((r) => {
          (r as unknown as HTMLElement).style.opacity = "1";
        });
        container.querySelectorAll<SVGGElement>(`.ts-chart__bar-pulse`).forEach((g) => {
          (g as unknown as HTMLElement).style.opacity = "1";
        });
      }
    }
  };

  let lastGroup: BarFocusGroup | null = null;

  const syncDim = () => {
    const state = getState();
    const legendHoveredIndex = state.legendHoveredIndex ?? null;
    if (!visible || !lastGroup) {
      if (legendHoveredIndex === null) {
        for (const s of state.series) {
          const escaped = s.dataKey.replace(/"/g, '\\"');
          const group = container.querySelector<SVGGElement>(`.ts-chart__bar-y[data-ts-key="${escaped}"]`);
          if (!group) continue;
          const rects = group.querySelectorAll<SVGRectElement>("rect");
          rects.forEach((rect) => { rect.style.opacity = "1"; });
        }
        if (state.barSquaresSeries) {
          for (const s of state.barSquaresSeries) {
            const escaped = s.dataKey.replace(/"/g, '\\"');
            const group = container.querySelector<SVGGElement>(`.ts-chart__bar-squares[data-ts-key="${escaped}"]`);
            if (!group) continue;
            const rects = group.querySelectorAll<SVGRectElement>("rect");
            rects.forEach((rect) => { rect.style.opacity = "1"; });
          }
        }
        const trackGroups2 = container.querySelectorAll<SVGGElement>(`.ts-chart__bar-column-track`);
        trackGroups2.forEach((g) => { g.style.opacity = String(state.barTrackOpacity ?? 0.3); });
        container.querySelectorAll<SVGGElement>(`.ts-chart__bar-depth-back path`).forEach((p) => { (p as unknown as HTMLElement).style.opacity = "1"; });
        container.querySelectorAll<SVGGElement>(`.ts-chart__bar-depth-front rect`).forEach((r) => { (r as unknown as HTMLElement).style.opacity = "1"; });
        container.querySelectorAll<SVGGElement>(`.ts-chart__bar-pulse`).forEach((g) => { (g as unknown as HTMLElement).style.opacity = "1"; });
        return;
      }
      for (let idx = 0; idx < state.series.length; idx++) {
        const s = state.series[idx]!;
        const isLegendDimmed = legendHoveredIndex !== idx;
        const escaped = s.dataKey.replace(/"/g, '\\"');
        const group = container.querySelector<SVGGElement>(`.ts-chart__bar-y[data-ts-key="${escaped}"]`);
        if (!group) continue;
        const rects = group.querySelectorAll<SVGRectElement>("rect");
        rects.forEach((rect) => {
          rect.style.transition = DIM_TRANSITION;
          rect.style.opacity = isLegendDimmed ? String(s.fadedOpacity) : "1";
        });
      }
      if (state.barSquaresSeries) {
        for (let sIdx = 0; sIdx < state.barSquaresSeries.length; sIdx++) {
          const s = state.barSquaresSeries[sIdx]!;
          const isLegendDimmed = legendHoveredIndex !== sIdx;
          const escaped = s.dataKey.replace(/"/g, '\\"');
          const group = container.querySelector<SVGGElement>(`.ts-chart__bar-squares[data-ts-key="${escaped}"]`);
          if (!group) continue;
          const rects = group.querySelectorAll<SVGRectElement>("rect");
          rects.forEach((rect) => {
            rect.style.transition = BAR_SQUARES_DIM_TRANSITION;
            rect.style.opacity = isLegendDimmed ? String(s.fadedOpacity) : "1";
          });
        }
      }
      container.querySelectorAll<SVGGElement>(`.ts-chart__bar-depth-back path`).forEach((p) => { (p as unknown as HTMLElement).style.transition = BAR_DEPTH_DIM_TRANSITION; (p as unknown as HTMLElement).style.opacity = "0.3"; });
      container.querySelectorAll<SVGGElement>(`.ts-chart__bar-depth-front rect`).forEach((r) => { (r as unknown as HTMLElement).style.transition = BAR_DEPTH_DIM_TRANSITION; (r as unknown as HTMLElement).style.opacity = "0.3"; });
      container.querySelectorAll<SVGGElement>(`.ts-chart__bar-pulse`).forEach((g) => { (g as unknown as HTMLElement).style.transition = BAR_DEPTH_DIM_TRANSITION; (g as unknown as HTMLElement).style.opacity = "0.3"; });
      return;
    }
    setCategoryHover(lastGroup.categoryIndex, state.series);
  };

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
    setCategoryHover(null, getState().series);
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
      const bandWidth = (state as unknown as { bandWidth?: number }).bandWidth;
      const dotCfg = toDotConfig(state.tooltip, bandWidth, state.series.length, 4);
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

    setCategoryHover(group.categoryIndex, state.series);

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

    applyLabelFade(container, group.anchorX, group.categoryLabel, TICKER_HALF_WIDTH, FADE_BUFFER);
  };

  return {
    onFocusChange: update,
    syncDim,
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
