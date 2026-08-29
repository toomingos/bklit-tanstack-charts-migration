import { shortDateFmt } from "./formatters";
import { createSpring } from "./spring";
import {
  DISCRETE_INTERACTION_THRESHOLD,
  FADE_BUFFER,
  TICKER_HALF_WIDTH,
} from "./design-tokens";
import {
  applyLabelFade,
  buildDotLayer,
  buildIndicator,
  buildPill,
  ensureDot,
  hideDot,
  resetLabelFade,
  updateDotPosition,
} from "./tooltip-chrome";
import {
  toDotConfig,
  toIndicatorConfig,
} from "./tooltip-mappers";
import type { ChartTooltipConfig } from "./types";
import { HIGHLIGHT_SPRING, TOOLTIP_SPRING } from "./design-tokens";
import { isChartInteractionPhase, type ChartPhase } from "./chart-phase";

export type HoverReanchor = () => void;

// ── Re-anchor (folded from ./hover-reanchor) ─────────────────────────────

interface ReanchorOptions {
  chartPhase: ChartPhase;
  isLoaded: boolean;
  lastX: number | null;
  renderData: unknown[];
  xScale: { invert(x: number): Date; (v: Date): number | undefined | null } | null;
  xDataKey: string;
  resolvePoints: (x: number, index: number, datum: unknown) => unknown[] | null;
  onReanchor: (points: unknown[]) => void;
  onClear: () => void;
}

function bisectDateLeft(data: unknown[], xDataKey: string, targetMs: number): number {
  let lo = 0, hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const v = (data[mid] as Record<string, unknown>)[xDataKey];
    const ms = v instanceof Date ? v.getTime() : NaN;
    if (ms < targetMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function reanchorHoverChrome(opts: ReanchorOptions): void {
  if (!isChartInteractionPhase(opts.chartPhase) || !opts.isLoaded) return;
  if (opts.lastX === null || !opts.xScale || opts.renderData.length === 0) return;
  const x0 = opts.xScale.invert(opts.lastX);
  const ms = x0.getTime();
  const idx = bisectDateLeft(opts.renderData, opts.xDataKey, ms);
  const d0 = opts.renderData[idx - 1] as Record<string, unknown> | undefined;
  const d1 = opts.renderData[idx] as Record<string, unknown> | undefined;
  if (!d0) { opts.onClear(); return; }
  let d: Record<string, unknown> = d0;
  let fi = idx - 1;
  if (d1) {
    const t0 = (d0[opts.xDataKey] as Date).getTime();
    const t1 = (d1[opts.xDataKey] as Date).getTime();
    if (ms - t0 > t1 - ms) { d = d1; fi = idx; }
  }
  const pxRaw = opts.xScale(d[opts.xDataKey] as Date);
  if (pxRaw == null || !Number.isFinite(pxRaw)) { opts.onClear(); return; }
  const points = opts.resolvePoints(pxRaw as number, fi, d);
  if (points && points.length > 0) opts.onReanchor(points);
  else opts.onClear();
}

const SVG_NS = "http://www.w3.org/2000/svg";

const DIM_OPACITY = "0.3";
const DIM_TRANSITION = "opacity 0.4s ease-in-out";
const BAR_DIM_TRANSITION = "opacity 0.12s ease-in-out";
const MARKER_DIM_OPACITY = "0.5";
const MARKER_DIM_BLUR_PX = 2;
const MARKER_DIM_TRANSITION = "opacity 0.15s ease-in-out, filter 0.15s ease-in-out";
const MARKER_ACTIVE_SCALE = 1.35;

export interface HoverChromeSeries {
  dataKey: string;
  color: string;
  strokeWidth: number;
  showHighlight: boolean;
  /** Area-only (A4): when false the series' boundary path is invisible
      (`showLine={false}`) — the highlight band is suppressed while the dim
      still applies, matching bklit's split gating (`highlightEnabled =
      showHighlight && showLine` vs SeriesHoverDim keyed on showHighlight). */
  showLine?: boolean;
  marker?: { fill: string; stroke: string; strokeWidth: number; ringGap: number; radius: number; outlineWidth?: number; outlineColor?: string; showActiveHighlight?: boolean } | null;
  /** C11 (P3-03): per-series dim opacity override. bklit dims Area series
      to 0.6 and Line series to 0.3 — mark types that carry genuinely
      different "how visible should the faded trace stay" defaults — while
      every prior migrated chart only ever had ONE mark type per chart and
      so never needed more than `HoverChromeOptions.dimOpacity` (chart-wide).
      Falls back to that chart-wide value when unset, so every existing
      call site (line/area/bar/candlestick/scatter, all single-mark-type)
      is byte-identical. Composed is the one chart that sets this today. */
  dimOpacity?: string;
}

export interface HoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  series: HoverChromeSeries[];
  xDataKey: string;
  pointCount: number;
  xForIndex: (index: number) => number;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
  /** CH5/B12 (bklit XAxis.tickerHalfWidth): date-pill fade radius for axis
      labels; defaults to the TICKER_HALF_WIDTH token when unset. */
  tickerHalfWidth?: number;
  bars?: readonly { dataKey: string; fadedOpacity: number }[];
  tooltip?: ChartTooltipConfig | null;
  dateLabels?: string[];
  hoveredIndex?: number;
  // Optional re-anchor support (D4, shared `./hover-reanchor`): when a chart
  // populates these, `HoverChrome.reanchor()` re-resolves the focused
  // point(s) from the chrome's internally tracked last pointer x whenever the
  // caller detects renderData/x-scale identity changes while a hover is
  // active (bklit ground truth: use-chart-interaction.ts's re-anchor-on-data-
  // change effect). Charts that leave these undefined get a no-op reanchor(),
  // so every other `attachHoverChrome` call site is unaffected.
  chartPhase?: ChartPhase;
  isLoaded?: boolean;
  renderData?: unknown[];
  xScale?: { invert(x: number): Date; (v: Date): number | undefined | null } | null;
  resolvePoints?: (x: number, index: number, datum: unknown) => readonly FocusPoint[] | null;
}

export interface FocusPoint {
  markId: string;
  datum: unknown;
  datumIndex: number;
  x: number;
  y: number;
  color: string;
}

export interface HoverChrome {
  onFocusGroupChange(points: readonly FocusPoint[], barRowIndex?: number): void;
  reanchor: HoverReanchor;
  detach(): void;
}

export interface HoverChromeOptions {
  dimOpacity?: string;
  tooltipSpring?: typeof TOOLTIP_SPRING;
  highlightSpring?: typeof HIGHLIGHT_SPRING;
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

export function attachHoverChrome(
  host: HTMLElement,
  getState: () => HoverChromeState,
  options: HoverChromeOptions = {},
): HoverChrome {
  const dimOpacity = options.dimOpacity ?? DIM_OPACITY;
  const tooltipSpring = options.tooltipSpring ?? TOOLTIP_SPRING;
  const highlightSpring = options.highlightSpring ?? HIGHLIGHT_SPRING;
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;
  const highlightClipId = `bkm-highlight-clip-${chromeId}`;

  const highlightSvg = doc.createElementNS(SVG_NS, "svg");
  highlightSvg.setAttribute("class", "bkm-hover-layer");
  highlightSvg.setAttribute("aria-hidden", "true");
  const highlightDefs = doc.createElementNS(SVG_NS, "defs");
  const highlightClip = doc.createElementNS(SVG_NS, "clipPath");
  highlightClip.setAttribute("id", highlightClipId);
  const highlightClipRect = doc.createElementNS(SVG_NS, "rect");
  highlightClip.appendChild(highlightClipRect);
  highlightDefs.appendChild(highlightClip);
  highlightSvg.appendChild(highlightDefs);
  highlightSvg.style.display = "none";
  const highlightPathBySeries = new Map<string, SVGPathElement>();
  const markerActiveSvg = doc.createElementNS(SVG_NS, "svg");
  markerActiveSvg.setAttribute("class", "bkm-marker-active-layer");
  markerActiveSvg.setAttribute("aria-hidden", "true");
  markerActiveSvg.style.display = "none";
  markerActiveSvg.style.position = "absolute";
  (markerActiveSvg.style as unknown as Record<string, string>).inset = "0";
  markerActiveSvg.style.pointerEvents = "none";
  const markerActiveGroupByKey = new Map<string, SVGGElement>();
  const dimmedMarkerGroups = new Set<SVGGElement>();

  const indicator = buildIndicator(doc, chromeId, toIndicatorConfig(getState().tooltip), tooltipSpring);
  const dotLayer = buildDotLayer(doc);
  const pillBuild = buildPill(doc, tooltipSpring, () => getState().dateLabels ?? []);

  host.append(highlightSvg, markerActiveSvg, indicator.svg, dotLayer.svg, pillBuild.layer);

  const highlightXSpring = createSpring(0, highlightSpring.stiffness, highlightSpring.damping, (x) => highlightClipRect.setAttribute("x", String(x)));
  const highlightWidthSpring = createSpring(0, highlightSpring.stiffness, highlightSpring.damping, (w) => highlightClipRect.setAttribute("width", String(Math.max(0, w))));

  let visible = false;
  let highlightFadeAnimation: Animation | null = null;
  const dimmedPaths = new Set<SVGPathElement>();
  const dimmedBarRects = new Set<SVGRectElement>();
  const barRectsCache = new Map<string, { group: SVGGElement; rects: SVGRectElement[] }>();
  let lastBarRowIndex: number | null = null;
  // D4: the chrome holds the last pointer x itself so `reanchor()` doesn't
  // need the caller to track/pass it separately.
  let lastX: number | null = null;

  const hide = () => {
    if (!visible) return;
    visible = false;
    lastX = null;
    indicator.svg.style.display = "none";
    dotLayer.svg.style.display = "none";
    pillBuild.layer.style.display = "none";
    highlightSvg.style.display = "none";
    markerActiveSvg.style.display = "none";
    for (const g of markerActiveGroupByKey.values()) g.style.display = "none";
    for (const g of dimmedMarkerGroups) { g.style.opacity = "1"; g.style.filter = "none"; }
    dimmedMarkerGroups.clear();
    indicator.xSpring.stop();
    indicator.lineXSpring?.stop();
    pillBuild.spring.stop();
    highlightXSpring.stop();
    highlightWidthSpring.stop();
    highlightFadeAnimation?.cancel(); highlightFadeAnimation = null;
    for (const { x, y } of dotLayer.springs.values()) { x.stop(); y.stop(); }
    for (const path of dimmedPaths) path.style.opacity = "1";
    dimmedPaths.clear();
    for (const rect of dimmedBarRects) rect.style.opacity = "1";
    dimmedBarRects.clear();
    lastBarRowIndex = null;
    pillBuild.label.textContent = "";
    resetLabelFade(container);
  };

  const update = (points: readonly FocusPoint[], barRowIndex?: number) => {
    if (points.length === 0) { hide(); return; }
    const state = getState();
    const { margin } = state;
    const height = container.clientHeight;
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    const primary = points[0]!;
    lastX = primary.x;
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
        const color = resolveDotColor(state.tooltip ?? null, series.color, point.color, pointForDotColor, { dataKey: series.dataKey, stroke: series.color }, tooltipRows, i);
        ensureDot(doc, dotLayer, series.dataKey, color, point.x, point.y, toDotConfig(state.tooltip), tooltipSpring);
        updateDotPosition(dotLayer, series.dataKey, point.x, point.y, showing);
      }
    }

    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
    const findSeriesPath = (dataKey: string): SVGPathElement | null => {
      if (!marksGroup) return null;
      const escaped = dataKey.replace(/"/g, '\\"');
      const group = marksGroup.querySelector<SVGGElement>(`.ts-chart__line[data-ts-key^="${escaped}:"]`);
      return group?.querySelector<SVGPathElement>("path") ?? null;
    };
    const findSeriesFillPath = (dataKey: string): SVGPathElement | null => {
      if (!marksGroup) return null;
      const escaped = dataKey.replace(/"/g, '\\"');
      const group = marksGroup.querySelector<SVGGElement>(`.ts-chart__area[data-ts-key="${escaped}__fill"]`);
      return group?.querySelector<SVGPathElement>("path") ?? null;
    };
    const findMarkerGroup = (dataKey: string): SVGGElement | null => {
      if (!marksGroup) return null;
      const escaped = `${dataKey}__marker`.replace(/"/g, '\\"');
      return marksGroup.querySelector<SVGGElement>(`.ts-chart__dot[data-ts-key="${escaped}"]`);
    };
    const findDashTailGroup = (dataKey: string): Element | null => {
      if (!container) return null;
      return container.querySelector(`[data-bkm-dash-tail="${dataKey}"]`);
    };
    const anyHighlight = !!marksGroup && state.series.some((s) => s.showHighlight);
    if (anyHighlight) {
      highlightClipRect.setAttribute("y", String(margin.top));
      highlightClipRect.setAttribute("height", String(innerHeight));
      const idx = primary.datumIndex;
      const lastIndex = Math.max(0, state.pointCount - 1);
      const bandStart = state.xForIndex(Math.max(0, idx - 1));
      const bandEnd = state.xForIndex(Math.min(lastIndex, idx + 1));
      if (showing) {
        highlightXSpring.jump(bandStart);
        highlightWidthSpring.jump(bandEnd - bandStart);
        highlightFadeAnimation?.cancel();
        highlightFadeAnimation = highlightSvg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: "ease-in-out", fill: "both" });
      } else {
        highlightXSpring.set(bandStart);
        highlightWidthSpring.set(bandEnd - bandStart);
      }
      highlightSvg.style.display = "";
      state.series.forEach((series) => {
        const base = findSeriesPath(series.dataKey);
        const fill = findSeriesFillPath(series.dataKey);
        let highlightPath = highlightPathBySeries.get(series.dataKey);
        const seriesDimOpacity = series.dimOpacity ?? dimOpacity;
        if (!base || !series.showHighlight) {
          if (highlightPath) highlightPath.style.display = "none";
          for (const path of [base, fill]) {
            if (path && dimmedPaths.has(path as SVGPathElement)) {
              (path as SVGPathElement).style.opacity = "1";
              dimmedPaths.delete(path as SVGPathElement);
            }
          }
          return;
        }
        base.style.transition = DIM_TRANSITION;
        base.style.opacity = seriesDimOpacity;
        dimmedPaths.add(base);
        if (fill) { fill.style.transition = DIM_TRANSITION; fill.style.opacity = seriesDimOpacity; dimmedPaths.add(fill); }
        const dashTail = findDashTailGroup(series.dataKey);
        if (dashTail instanceof SVGElement) {
          dashTail.style.transition = DIM_TRANSITION;
          dashTail.style.opacity = seriesDimOpacity;
          dimmedPaths.add(dashTail as unknown as SVGPathElement);
        }
        // A4 (showLine=false): bklit gates the highlight band on
        // `showHighlight && showLine` (area.tsx highlightEnabled) while the
        // SeriesHoverDim keys off showHighlight alone — keep the dim above,
        // drop the band re-stroke.
        if (series.showLine === false) {
          if (highlightPath) highlightPath.style.display = "none";
          return;
        }
        if (!highlightPath) {
          highlightPath = doc.createElementNS(SVG_NS, "path");
          highlightPath.setAttribute("fill", "none");
          highlightPath.setAttribute("stroke-linecap", "round");
          highlightPath.setAttribute("clip-path", `url(#${highlightClipId})`);
          highlightSvg.appendChild(highlightPath);
          highlightPathBySeries.set(series.dataKey, highlightPath);
        }
        highlightPath.style.display = "";
        highlightPath.setAttribute("d", base.getAttribute("d") ?? "");
        highlightPath.setAttribute("stroke", series.color || pointByMark.get(series.dataKey)?.color || "");
        highlightPath.setAttribute("stroke-width", String(series.strokeWidth));
      });
    } else {
      highlightSvg.style.display = "none";
    }
    // Marker dim + active highlight (single-writer: same update flow as path dim above — no parallel writer).
    {
      const ensureMarkerActiveGroup = (series: HoverChromeSeries): SVGGElement => {
        let g = markerActiveGroupByKey.get(series.dataKey);
        if (g) return g;
        g = doc.createElementNS(SVG_NS, "g") as SVGGElement;
        const m = series.marker;
        const fill = m?.fill ?? series.color;
        const stroke = m?.stroke ?? fill;
        const radius = m?.radius ?? 5;
        const strokeWidth = m?.strokeWidth ?? 2;
        const ringGap = m?.ringGap ?? 2;
        const outlineWidth = m?.outlineWidth ?? 0;
        const outlineColor = m?.outlineColor ?? stroke;
        if (outlineWidth > 0) {
          const outline = doc.createElementNS(SVG_NS, "circle");
          const ringOuter = strokeWidth > 0 ? radius + ringGap + strokeWidth : radius;
          const outlineR = ringOuter + outlineWidth / 2;
          outline.setAttribute("cx", "0"); outline.setAttribute("cy", "0");
          outline.setAttribute("r", String(outlineR)); outline.setAttribute("fill", "none");
          outline.setAttribute("stroke", outlineColor); outline.setAttribute("stroke-width", String(outlineWidth));
          g.appendChild(outline);
        }
        const fillCircle = doc.createElementNS(SVG_NS, "circle");
        fillCircle.setAttribute("cx", "0"); fillCircle.setAttribute("cy", "0");
        fillCircle.setAttribute("r", String(radius)); fillCircle.setAttribute("fill", fill);
        g.appendChild(fillCircle);
        if (strokeWidth > 0) {
          const ringCircle = doc.createElementNS(SVG_NS, "circle");
          ringCircle.setAttribute("cx", "0"); ringCircle.setAttribute("cy", "0");
          ringCircle.setAttribute("r", String(radius + ringGap + strokeWidth / 2));
          ringCircle.setAttribute("fill", "none"); ringCircle.setAttribute("stroke", stroke);
          ringCircle.setAttribute("stroke-width", String(strokeWidth));
          g.appendChild(ringCircle);
        }
        markerActiveSvg.appendChild(g);
        markerActiveGroupByKey.set(series.dataKey, g);
        return g;
      };
      if (visible) {
        for (const s of state.series) {
          if (!s.marker) continue;
          const mg = findMarkerGroup(s.dataKey);
          if (!mg) continue;
          mg.style.transition = MARKER_DIM_TRANSITION;
          mg.style.opacity = MARKER_DIM_OPACITY;
          mg.style.filter = `blur(${MARKER_DIM_BLUR_PX}px)`;
          dimmedMarkerGroups.add(mg);
        }
        markerActiveSvg.style.display = "";
        for (const s of state.series) {
          if (!s.marker) continue;
          const pt = pointByMark.get(s.dataKey);
          const g = ensureMarkerActiveGroup(s);
          if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) { g.style.display = "none"; continue; }
          const showActive = s.marker.showActiveHighlight ?? true;
          const scale = showActive ? MARKER_ACTIVE_SCALE : 1;
          g.style.display = "";
          g.setAttribute("transform", `translate(${pt.x}, ${pt.y}) scale(${scale})`);
        }
      } else {
        for (const g of dimmedMarkerGroups) { g.style.opacity = "1"; g.style.filter = "none"; }
        dimmedMarkerGroups.clear();
        markerActiveSvg.style.display = "none";
        for (const g of markerActiveGroupByKey.values()) g.style.display = "none";
      }
    }

    if (state.bars?.length && marksGroup) {
      const resolvedBarRowIndex = barRowIndex ?? null;
      for (let barIdx = 0; barIdx < state.bars.length; barIdx++) {
        const bar = state.bars[barIdx]!;
        const escaped = bar.dataKey.replace(/"/g, '\\"');
        const group = marksGroup.querySelector<SVGGElement>(`.ts-chart__bar-y[data-ts-key="${escaped}"]`);
        if (!group) continue;
        let cached = barRectsCache.get(bar.dataKey);
        let rebuilt = false;
        if (!cached || cached.group !== group) {
          cached = { group, rects: Array.from(group.querySelectorAll<SVGRectElement>("rect")) };
          barRectsCache.set(bar.dataKey, cached);
          rebuilt = true;
        }
        const { rects } = cached;
        const applyOpacity = (index: number, opacity: string, withTransition: boolean) => {
          const rect = rects[index];
          if (!rect) return;
          if (withTransition) rect.style.transition = BAR_DIM_TRANSITION;
          rect.style.opacity = opacity;
          if (opacity === "1") dimmedBarRects.delete(rect);
          else dimmedBarRects.add(rect);
        };
        if (showing || rebuilt) {
          rects.forEach((_rect, index) => {
            const shouldDim = resolvedBarRowIndex != null && index !== resolvedBarRowIndex;
            applyOpacity(index, shouldDim ? String(bar.fadedOpacity) : "1", false);
          });
        } else if (resolvedBarRowIndex !== lastBarRowIndex) {
          rects.forEach((_rect, index) => {
            const shouldDim = resolvedBarRowIndex != null && index !== resolvedBarRowIndex;
            const prevShouldDim = lastBarRowIndex != null && index !== lastBarRowIndex;
            if (shouldDim !== prevShouldDim) {
              applyOpacity(index, shouldDim ? String(bar.fadedOpacity) : "1", true);
            }
          });
        }
      }
      lastBarRowIndex = resolvedBarRowIndex;
    }

    if (state.showDatePill && isDate) {
      pillBuild.layer.style.display = "";
      if (pillBuild.ticker && state.dateLabels && state.dateLabels.length > 0) {
        pillBuild.ticker.update(state.hoveredIndex ?? primary.datumIndex, discrete);
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

  // D4: re-resolve the focused point(s) from the last known pointer x and
  // re-drive the chrome — called by a chart's own effect when its render
  // data or x-scale identity changes while a hover is active. No-op unless
  // the chart populates the optional reanchor fields on HoverChromeState.
  const reanchor: HoverReanchor = () => {
    const state = getState();
    const resolvePoints = state.resolvePoints;
    if (
      lastX === null ||
      state.chartPhase === undefined ||
      state.isLoaded === undefined ||
      !state.renderData ||
      !state.xScale ||
      !resolvePoints
    ) {
      return;
    }
    reanchorHoverChrome({
      chartPhase: state.chartPhase,
      isLoaded: state.isLoaded,
      lastX,
      renderData: state.renderData,
      xScale: state.xScale,
      xDataKey: state.xDataKey,
      resolvePoints: (x, index, datum) => resolvePoints(x, index, datum) as unknown[] | null,
      onReanchor: (points) => update(points as FocusPoint[]),
      onClear: () => hide(),
    });
  };

  return {
    onFocusGroupChange: update,
    reanchor,
    detach() {
      hide();
      highlightSvg.remove();
      markerActiveSvg.remove();
      markerActiveGroupByKey.clear();
      for (const g of dimmedMarkerGroups) { g.style.opacity = "1"; g.style.filter = "none"; }
      dimmedMarkerGroups.clear();
      indicator.svg.remove();
      dotLayer.svg.remove();
      pillBuild.layer.remove();
      dotLayer.byKey.clear();
      dotLayer.springs.clear();
      highlightPathBySeries.clear();
      pillBuild.ticker?.detach();
    },
  };
}
