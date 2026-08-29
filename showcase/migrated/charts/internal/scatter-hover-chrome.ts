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

// P6/C1: the hover DIM (opacity 0.5 inactive / r×1.35 active) is now expressed
// as native `dot()` mark `states` (see scatter-chart.tsx) instead of DOM
// mutation here — this module keeps only the crosshair/tooltip-dot/box/
// date-pill chrome, which C3 still owns. The former active-highlight clone
// (`ensureActiveGroup`) and per-series dim (`setMarkersDimmed`) were deleted
// in the same pass; `ScatterHoverChromeSeries` now carries only what the
// remaining chrome (tooltip dot color resolution) needs.
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
  const boxBuild = buildBox(doc, toBoxConfig(getState().tooltip), tooltipSpring, false);
  const pillBuild = buildPill(doc, tooltipSpring, () => getState().dateLabels ?? []);
  host.append(indicator.svg, dotLayer.svg, boxBuild.layer, pillBuild.layer);

  let visible = false;
  let prevFlip: boolean | null = null;
  let boxFadeAnimation: Animation | null = null;

  const hide = () => {
    if (!visible) return;
    visible = false;
    prevFlip = null;
    indicator.svg.style.display = "none";
    dotLayer.svg.style.display = "none";
    boxBuild.layer.style.display = "none";
    pillBuild.layer.style.display = "none";
    indicator.xSpring.stop();
    indicator.lineXSpring?.stop();
    boxBuild.leftSpring?.stop(); boxBuild.topSpring?.stop();
    pillBuild.spring.stop();
    boxBuild.entranceSpring.stop();
    boxFadeAnimation?.cancel(); boxFadeAnimation = null;
    for (const { x, y } of dotLayer.springs.values()) { x.stop(); y.stop(); }
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

    // P6/C1: the inactive-dim + active r×1.35 pop are now native `dot()` mark
    // `states` on the marks layer itself (scatter-chart.tsx) — no DOM
    // mutation happens here anymore.

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
      indicator.svg.remove();
      dotLayer.svg.remove();
      boxBuild.layer.remove();
      pillBuild.layer.remove();
      dotLayer.byKey.clear(); dotLayer.springs.clear();
      boxBuild.rowByKey.clear();
      pillBuild.ticker?.detach();
      boxBuild.customRoot.current?.unmount();
      boxBuild.childrenRoot.current?.unmount();
    },
  };
}
