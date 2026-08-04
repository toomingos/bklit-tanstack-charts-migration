// bklit-ui hover chrome (ChartTooltip) ported onto TanStack's focus system.
// Everything here is imperative DOM driven by `onFocusGroupChange` — zero
// React state updates, zero framer-motion in the pointer path (docs/LOG.md
// D10). Geometry, springs, and styling are exact ports of
// repos/bklit-ui/packages/ui/src/charts/tooltip/* :
//   crosshair  — TooltipIndicator: 1px rect, vertical fade 10% both ends,
//                var(--chart-crosshair), spring {300,30} (instant when the
//                series has >60 points — "discrete interaction")
//   dot        — TooltipDot: r=5 circle, series color, 2px background stroke
//   box        — TooltipBox pinned to top=margin.top, x-flip at offset 16,
//                follow spring {100,20}, entrance spring {300,25}
//   date pill  — DateTicker compact variant (>60 labels) at bottom:4px
//   label fade — XAxisLabel: hide within tickerHalfWidth(50)px of the
//                crosshair, 20px linear fade ramp, 0.4s opacity transition
import { intFmt, shortDateFmt, weekdayDateFmt } from "./formatters";
import { createSpring, type Spring } from "./spring";

const SVG_NS = "http://www.w3.org/2000/svg";

// bklit chart-config-context.tsx DEFAULT_CHART_CONFIG
const TOOLTIP_SPRING = { stiffness: 300, damping: 30 }; // crosshair/dot/pill
const TOOLTIP_BOX_SPRING = { stiffness: 100, damping: 20 }; // panel follow
const ENTRANCE_SPRING = { stiffness: 300, damping: 25 }; // panel entrance
const HIGHLIGHT_SPRING = { stiffness: 180, damping: 28 }; // highlight band
// bklit line.tsx SeriesHoverDim: series dims to 0.3 while hovering, 0.4s tween
// (area.tsx hardcodes dimOpacity={0.6} on its own SeriesHoverDim instead —
// the only per-chart difference in this file, so it's a per-`attach` option
// rather than a new state field threaded through every render; the default
// keeps line-chart.tsx's call site — which passes no options — bit-for-bit
// unchanged).
const DIM_OPACITY = "0.3";
const DIM_TRANSITION = "opacity 0.4s ease-in-out";
// bklit series-bar.tsx post-load static branch: `{opacity:{duration:0.12}}` —
// NOT the standalone <Bar>'s 0.15s (a different component/constant).
const BAR_DIM_TRANSITION = "opacity 0.12s ease-in-out";
// bklit chart-tooltip.tsx: dateLabels.length > 60 → instant crosshair/dot/pill
export const DISCRETE_INTERACTION_THRESHOLD = 60;
// bklit tooltip-box.tsx / chart-tooltip.tsx defaults
const BOX_OFFSET = 16;
const BOX_FALLBACK_WIDTH = 180;
// bklit x-axis.tsx XAxisLabel defaults
const TICKER_HALF_WIDTH = 50;
const FADE_BUFFER = 20;

export interface HoverChromeSeries {
  dataKey: string;
  /** Resolved stroke (Line config stroke, else TanStack's assigned color). */
  color: string;
  strokeWidth: number;
  /** bklit Line showHighlight (default true): hover dim + highlight band. */
  showHighlight: boolean;
}

export interface HoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  series: HoverChromeSeries[];
  xDataKey: string;
  /** Rendered (decimated) point count — >60 disables position springs. */
  pointCount: number;
  /** Scene x (px) of rendered point `index` — for the highlight band. */
  xForIndex: (index: number) => number;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
  /** ComposedChart's <SeriesBar> series only (bklit series-bar.tsx per-row
      hover fade). Bars render RAW (non-decimated) data with one `rect` per
      row under `.ts-chart__bar-y[data-ts-key="<dataKey>"]`; the row to keep
      at full opacity is given per-call via `onFocusGroupChange`'s
      `barRowIndex`, since it indexes RAW data while every `FocusPoint`'s
      own `datumIndex` indexes the DECIMATED render (see
      composed-chart.tsx). Omitted (default) for every other chart. */
  bars?: readonly { dataKey: string; fadedOpacity: number }[];
}

/** Subset of TanStack's ChartPoint the chrome reads (scene px coords). */
export interface FocusPoint {
  markId: string;
  datum: unknown;
  datumIndex: number;
  x: number;
  y: number;
  color: string;
}

export interface HoverChrome {
  /** `barRowIndex` — RAW-data row index for `state.bars` per-row hover fade
      (composed-chart.tsx only; every other caller omits it). */
  onFocusGroupChange(points: readonly FocusPoint[], barRowIndex?: number): void;
  detach(): void;
}

export interface HoverChromeOptions {
  /** Series-dim opacity while hovering (bklit SeriesHoverDim `dimOpacity`).
      Default "0.3" (Line's bklit value). Area passes "0.6" (area.tsx
      hardcodes `dimOpacity={0.6}`). */
  dimOpacity?: string;
}

let gradientCounter = 0;

export function attachHoverChrome(
  host: HTMLElement,
  getState: () => HoverChromeState,
  options: HoverChromeOptions = {},
): HoverChrome {
  const dimOpacity = options.dimOpacity ?? DIM_OPACITY;
  // The host is an inset:0 overlay layer rendered AFTER the chart surface
  // (bklit portals its chrome after the chart too, and the QA/bench harness
  // expects the first `svg` in the container to be the chart itself). The
  // chart root is used for sizing and x-axis label lookups.
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;
  const gradientId = `bkm-crosshair-gradient-${chromeId}`;
  const highlightClipId = `bkm-highlight-clip-${chromeId}`;

  // --- Highlight band (HighlightSegment): re-strokes each series path at
  //     full color, clipped to a vertical band one rendered point either
  //     side of the hovered point; the dimmed base stroke sits underneath.
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

  // --- Crosshair (TooltipIndicator: gradient-faded 1px rect) --------------
  const crosshairSvg = doc.createElementNS(SVG_NS, "svg");
  crosshairSvg.setAttribute("class", "bkm-hover-layer");
  crosshairSvg.setAttribute("aria-hidden", "true");
  const defs = doc.createElementNS(SVG_NS, "defs");
  const gradient = doc.createElementNS(SVG_NS, "linearGradient");
  gradient.setAttribute("id", gradientId);
  gradient.setAttribute("x1", "0%");
  gradient.setAttribute("x2", "0%");
  gradient.setAttribute("y1", "0%");
  gradient.setAttribute("y2", "100%");
  // indicator-fade.ts stops for fadeEdges="both", fadeLength=10
  for (const [offset, opacity] of [
    ["0%", 0],
    ["10%", 1],
    ["50%", 1],
    ["90%", 1],
    ["100%", 0],
  ] as const) {
    const stop = doc.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute(
      "style",
      `stop-color: var(--chart-crosshair); stop-opacity: ${opacity}`,
    );
    gradient.appendChild(stop);
  }
  defs.appendChild(gradient);
  crosshairSvg.appendChild(defs);
  const crosshairRect = doc.createElementNS(SVG_NS, "rect");
  crosshairRect.setAttribute("width", "1");
  crosshairRect.setAttribute("fill", `url(#${gradientId})`);
  crosshairSvg.appendChild(crosshairRect);
  crosshairSvg.style.display = "none";

  // --- Dots (TooltipDot per series) ---------------------------------------
  const dotsSvg = doc.createElementNS(SVG_NS, "svg");
  dotsSvg.setAttribute("class", "bkm-hover-layer");
  dotsSvg.setAttribute("aria-hidden", "true");
  dotsSvg.style.display = "none";
  const dotBySeries = new Map<string, SVGCircleElement>();

  // --- Tooltip box (TooltipBox + TooltipContent) --------------------------
  const boxLayer = doc.createElement("div");
  boxLayer.className = "bkm-tooltip-layer";
  const boxPanel = doc.createElement("div");
  boxPanel.className = "bkm-tooltip-panel";
  const boxContent = doc.createElement("div");
  boxContent.className = "bkm-tooltip-content";
  const boxTitle = doc.createElement("div");
  boxTitle.className = "bkm-tooltip-title";
  const boxRows = doc.createElement("div");
  boxRows.className = "bkm-tooltip-rows";
  boxContent.append(boxTitle, boxRows);
  boxPanel.appendChild(boxContent);
  boxLayer.appendChild(boxPanel);
  boxLayer.style.display = "none";
  interface RowElements {
    root: HTMLDivElement;
    swatch: HTMLSpanElement;
    label: HTMLSpanElement;
    value: HTMLSpanElement;
  }
  const rowBySeries = new Map<string, RowElements>();

  // --- Date pill (DateTicker compact) -------------------------------------
  const pillLayer = doc.createElement("div");
  pillLayer.className = "bkm-date-pill-layer";
  const pill = doc.createElement("div");
  pill.className = "bkm-date-pill";
  const pillInner = doc.createElement("div");
  pillInner.className = "bkm-date-pill-inner";
  const pillLabel = doc.createElement("span");
  pillInner.appendChild(pillLabel);
  pill.appendChild(pillInner);
  pillLayer.appendChild(pill);
  pillLayer.style.display = "none";

  // bklit z-order: highlight re-stroke sits under the crosshair/dots chrome.
  host.append(highlightSvg, crosshairSvg, dotsSvg, boxLayer, pillLayer);

  // --- Springs ------------------------------------------------------------
  const crosshairSpring = createSpring(
    0,
    TOOLTIP_SPRING.stiffness,
    TOOLTIP_SPRING.damping,
    (x) => crosshairRect.setAttribute("x", String(x)),
  );
  const dotSprings = new Map<string, { x: Spring; y: Spring }>();
  const boxLeftSpring = createSpring(
    0,
    TOOLTIP_BOX_SPRING.stiffness,
    TOOLTIP_BOX_SPRING.damping,
    (left) => {
      boxLayer.style.left = `${left}px`;
    },
  );
  const pillSpring = createSpring(
    0,
    TOOLTIP_SPRING.stiffness,
    TOOLTIP_SPRING.damping,
    (x) => {
      pillLayer.style.left = `${x}px`;
    },
  );
  // Panel entrance: one 0→1 progress spring drives scale/opacity/translateX
  // (equivalent to framer animating all three with the same spring).
  let entranceFrom = 0; // translateX start: -20 normal, +20 flipped
  const entranceSpring = createSpring(
    1,
    ENTRANCE_SPRING.stiffness,
    ENTRANCE_SPRING.damping,
    (p) => {
      boxPanel.style.transform = `translateX(${entranceFrom * (1 - p)}px) scale(${0.85 + 0.15 * p})`;
      boxPanel.style.opacity = String(p);
    },
  );

  // Highlight band springs (use-highlight-segment.ts: {180,28}, jump on
  // activate) driving the clip rect that windows the re-stroked paths.
  const highlightXSpring = createSpring(
    0,
    HIGHLIGHT_SPRING.stiffness,
    HIGHLIGHT_SPRING.damping,
    (x) => highlightClipRect.setAttribute("x", String(x)),
  );
  const highlightWidthSpring = createSpring(
    0,
    HIGHLIGHT_SPRING.stiffness,
    HIGHLIGHT_SPRING.damping,
    (w) => highlightClipRect.setAttribute("width", String(Math.max(0, w))),
  );

  let visible = false;
  let prevFlip: boolean | null = null;
  let boxFadeAnimation: Animation | null = null;
  let highlightFadeAnimation: Animation | null = null;
  // Base series paths dimmed while hovering (SeriesHoverDim), restored on hide.
  const dimmedPaths = new Set<SVGPathElement>();
  // ComposedChart bar per-row fade — touched rects restored on hide.
  const dimmedBarRects = new Set<SVGRectElement>();
  // Perf: cache each bar series' rect list (keyed by dataKey, invalidated
  // when the underlying <g> node identity changes — i.e. a data/scene
  // rebuild) and remember the previously-focused row, so steady-state hover
  // moves touch only the 2 rects whose opacity actually changes instead of
  // re-querying + rewriting every rect on every pointermove. See the bars
  // block below for why this matters at scale.
  const barRectsCache = new Map<string, { group: SVGGElement; rects: SVGRectElement[] }>();
  let lastBarRowIndex: number | null = null;

  const runEntrance = (flipped: boolean) => {
    boxPanel.style.transformOrigin = flipped ? "right top" : "left top";
    entranceFrom = flipped ? 20 : -20;
    entranceSpring.jump(0);
    entranceSpring.set(1);
  };

  const getLabelSpans = () =>
    container.querySelectorAll<HTMLSpanElement>("[data-bkm-xlabel]");

  const resetLabelOpacities = () => {
    for (const span of getLabelSpans()) span.style.opacity = "1";
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    prevFlip = null;
    crosshairSvg.style.display = "none";
    dotsSvg.style.display = "none";
    boxLayer.style.display = "none";
    pillLayer.style.display = "none";
    highlightSvg.style.display = "none";
    crosshairSpring.stop();
    boxLeftSpring.stop();
    pillSpring.stop();
    entranceSpring.stop();
    highlightXSpring.stop();
    highlightWidthSpring.stop();
    boxFadeAnimation?.cancel();
    boxFadeAnimation = null;
    highlightFadeAnimation?.cancel();
    highlightFadeAnimation = null;
    for (const { x, y } of dotSprings.values()) {
      x.stop();
      y.stop();
    }
    // SeriesHoverDim unhover: tween back to full opacity (transition stays).
    for (const path of dimmedPaths) path.style.opacity = "1";
    dimmedPaths.clear();
    for (const rect of dimmedBarRects) rect.style.opacity = "1";
    dimmedBarRects.clear();
    lastBarRowIndex = null;
    // Clear text so the DOM carries no tooltip content while hidden (bklit
    // unmounts its tooltip; the QA harness detects tooltips by text length).
    boxTitle.textContent = "";
    for (const row of rowBySeries.values()) {
      row.label.textContent = "";
      row.value.textContent = "";
    }
    pillLabel.textContent = "";
    resetLabelOpacities();
  };

  const update = (points: readonly FocusPoint[], barRowIndex?: number) => {
    if (points.length === 0) {
      hide();
      return;
    }
    const state = getState();
    const { margin } = state;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    const primary = points[0]!;
    const pointByMark = new Map(points.map((p) => [p.markId, p]));
    const date = (primary.datum as Record<string, unknown>)[state.xDataKey];
    const isDate = date instanceof Date;
    // bklit: crosshair/dot/pill springs are disabled above 60 points.
    const discrete = state.pointCount > DISCRETE_INTERACTION_THRESHOLD;
    const showing = !visible;
    visible = true;

    // Crosshair — rect x is center - width/2 (TooltipIndicator).
    if (state.showCrosshair) {
      crosshairRect.setAttribute("y", String(margin.top));
      crosshairRect.setAttribute("height", String(innerHeight));
      crosshairSvg.style.display = "";
      const rectX = primary.x - 0.5;
      if (showing || discrete) crosshairSpring.jump(rectX);
      else crosshairSpring.set(rectX);
    }

    // Dots — one per configured series, bklit lines order.
    if (state.showDots) {
      dotsSvg.style.display = "";
      for (const series of state.series) {
        const point = pointByMark.get(series.dataKey);
        let dot = dotBySeries.get(series.dataKey);
        if (!point) {
          if (dot) dot.style.display = "none";
          continue;
        }
        if (!dot) {
          dot = doc.createElementNS(SVG_NS, "circle");
          dot.setAttribute("r", "5");
          dot.setAttribute("stroke", "var(--chart-background)");
          dot.setAttribute("stroke-width", "2");
          dotsSvg.appendChild(dot);
          dotBySeries.set(series.dataKey, dot);
          dotSprings.set(series.dataKey, {
            x: createSpring(
              point.x,
              TOOLTIP_SPRING.stiffness,
              TOOLTIP_SPRING.damping,
              (x) => dot!.setAttribute("cx", String(x)),
            ),
            y: createSpring(
              point.y,
              TOOLTIP_SPRING.stiffness,
              TOOLTIP_SPRING.damping,
              (y) => dot!.setAttribute("cy", String(y)),
            ),
          });
        }
        dot.style.display = "";
        dot.setAttribute("fill", series.color || point.color);
        const springs = dotSprings.get(series.dataKey)!;
        if (showing || discrete) {
          springs.x.jump(point.x);
          springs.y.jump(point.y);
        } else {
          springs.x.set(point.x);
          springs.y.set(point.y);
        }
      }
    }

    // Series dim + highlight band (SeriesHoverDim + HighlightSegment): the
    // whole base stroke dims to 0.3 while a full-color re-stroke of the same
    // path shows through a clip band one rendered point either side of the
    // hovered point (highlight-segment-bounds.ts, clamped to the data range).
    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
    // Resolve each series' STROKE path by markId rather than by DOM
    // position. Previously this was `basePaths[seriesIndex]` (the
    // seriesIndex-th `<path>` under `.ts-chart__marks`), which relied on
    // exactly one `<path>` per series in `state.series` order — true for
    // <Line> (one lineY mark per series) but not for <Area>, which renders
    // TWO marks per series (an areaY fill mark id'd `${dataKey}__fill`
    // alongside a lineY boundary mark id'd `dataKey`) and would silently
    // pair the wrong path per series (or the fill path) once that second
    // mark existed. TanStack's lineY mark renders its group with
    // `data-ts-key="${markId}:${zGroupKey}"` (charts-core line.ts
    // `groupRows`; the suffix is a constant here since no `z` channel is
    // ever passed) — matched by prefix, scoped to `.ts-chart__line` so an
    // areaY group (class `.ts-chart__area`) can never match even if some
    // future series named its fill mark without the `__fill` suffix.
    const findSeriesPath = (dataKey: string): SVGPathElement | null => {
      if (!marksGroup) return null;
      const escaped = dataKey.replace(/"/g, '\\"');
      const group = marksGroup.querySelector<SVGGElement>(
        `.ts-chart__line[data-ts-key^="${escaped}:"]`,
      );
      return group?.querySelector<SVGPathElement>("path") ?? null;
    };
    // Area's fill mark (id `${dataKey}__fill`, class .ts-chart__area). bklit's
    // SeriesHoverDim wraps the WHOLE series group — fill and boundary stroke
    // dim together — so the chrome must dim both paths. Null for charts whose
    // series have no fill mark (line), leaving them untouched.
    const findSeriesFillPath = (dataKey: string): SVGPathElement | null => {
      if (!marksGroup) return null;
      const escaped = dataKey.replace(/"/g, '\\"');
      // areaY renders one group per mark with key = the mark id itself (no
      // z-group suffix, unlike lineY): area.ts `nodes: [{kind:'group', key:
      // id, className:'ts-chart__area', ...}]`.
      const group = marksGroup.querySelector<SVGGElement>(
        `.ts-chart__area[data-ts-key="${escaped}__fill"]`,
      );
      return group?.querySelector<SVGPathElement>("path") ?? null;
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
        // HighlightSegment activation: opacity 0→1 tween, 0.4s ease-in-out.
        highlightFadeAnimation?.cancel();
        highlightFadeAnimation = highlightSvg.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 400, easing: "ease-in-out", fill: "both" },
        );
      } else {
        highlightXSpring.set(bandStart);
        highlightWidthSpring.set(bandEnd - bandStart);
      }
      highlightSvg.style.display = "";
      state.series.forEach((series) => {
        const base = findSeriesPath(series.dataKey);
        const fill = findSeriesFillPath(series.dataKey);
        let highlightPath = highlightPathBySeries.get(series.dataKey);
        if (!base || !series.showHighlight) {
          if (highlightPath) highlightPath.style.display = "none";
          for (const path of [base, fill]) {
            if (path && dimmedPaths.has(path)) {
              path.style.opacity = "1";
              dimmedPaths.delete(path);
            }
          }
          return;
        }
        base.style.transition = DIM_TRANSITION;
        base.style.opacity = dimOpacity;
        dimmedPaths.add(base);
        if (fill) {
          fill.style.transition = DIM_TRANSITION;
          fill.style.opacity = dimOpacity;
          dimmedPaths.add(fill);
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
        // Re-stroke the base path `d` verbatim at RAW series color (bklit
        // SeriesHighlightLayer bypasses the edge-fade gradient stroke).
        highlightPath.setAttribute("d", base.getAttribute("d") ?? "");
        highlightPath.setAttribute(
          "stroke",
          series.color || pointByMark.get(series.dataKey)?.color || "",
        );
        highlightPath.setAttribute("stroke-width", String(series.strokeWidth));
      });
    } else {
      highlightSvg.style.display = "none";
    }

    // ComposedChart bar per-row fade (bklit series-bar.tsx SeriesBar
    // hover-dim): the hovered RAW row's bars stay full opacity, every other
    // row's bars dim to `fadedOpacity`. Indexed by `barRowIndex` (RAW data
    // index), not `primary.datumIndex` (DECIMATED render index used above
    // for the highlight band) — the two indices diverge once decimation
    // reduces point count.
    if (state.bars?.length && marksGroup) {
      const resolvedBarRowIndex = barRowIndex ?? null;
      for (const bar of state.bars) {
        const escaped = bar.dataKey.replace(/"/g, '\\"');
        const group = marksGroup.querySelector<SVGGElement>(
          `.ts-chart__bar-y[data-ts-key="${escaped}"]`,
        );
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
          // Fresh hover session (or a just-rebuilt rect cache after a
          // data/scene change): one unavoidable O(n) pass to establish the
          // baseline faded state. Deliberately OMITS `style.transition` here
          // (instant, not animated) — assigning a fresh CSS transition to
          // 10,000+ elements in the same task was confirmed via CDP trace
          // (n=10000) to force a multi-second compositor "Commit" stall
          // (Blink has to set up transition tracking for every element at
          // once), even though the JS write-loop itself only costs ~6ms.
          // There's nothing to visibly animate FROM on this first frame
          // anyway (every bar is jumping from "never dimmed" to its baseline
          // state), so instant assignment is also the more correct behavior,
          // not just the faster one.
          rects.forEach((_rect, index) => {
            applyOpacity(
              index,
              resolvedBarRowIndex == null || index === resolvedBarRowIndex
                ? "1"
                : String(bar.fadedOpacity),
              false,
            );
          });
        } else if (resolvedBarRowIndex !== lastBarRowIndex) {
          // Steady-state move within the same hover session: only the
          // previously- and newly-focused rows' opacity actually changes, so
          // only touch those two elements (with their fade transition, since
          // touching just 2 elements is cheap regardless).
          if (lastBarRowIndex != null) applyOpacity(lastBarRowIndex, String(bar.fadedOpacity), true);
          if (resolvedBarRowIndex != null) applyOpacity(resolvedBarRowIndex, "1", true);
        }
      }
      lastBarRowIndex = resolvedBarRowIndex;
    }

    // Tooltip box — title + one row per series (TooltipContent), panel
    // pinned to top=margin.top with x-flip at offset 16 (chart-tooltip.tsx
    // passes y=margin.top / top=margin.top for vertical charts).
    boxTitle.textContent = isDate ? weekdayDateFmt.format(date) : "";
    boxTitle.style.display = isDate ? "" : "none";
    for (const series of state.series) {
      const point = pointByMark.get(series.dataKey);
      let row = rowBySeries.get(series.dataKey);
      if (!row) {
        const root = doc.createElement("div");
        root.className = "bkm-tooltip-row";
        const left = doc.createElement("div");
        left.className = "bkm-tooltip-row-label";
        const swatch = doc.createElement("span");
        swatch.className = "bkm-tooltip-swatch";
        const label = doc.createElement("span");
        label.className = "bkm-tooltip-series";
        left.append(swatch, label);
        const value = doc.createElement("span");
        value.className = "bkm-tooltip-value";
        root.append(left, value);
        boxRows.appendChild(root);
        row = { root, swatch, label, value };
        rowBySeries.set(series.dataKey, row);
      }
      row.swatch.style.backgroundColor =
        series.color || point?.color || "transparent";
      row.label.textContent = series.dataKey;
      const value = (primary.datum as Record<string, unknown>)[series.dataKey];
      row.value.textContent =
        typeof value === "number" ? intFmt(value) : String(value ?? 0);
    }
    boxLayer.style.top = `${margin.top}px`;
    boxLayer.style.display = "";
    const boxWidth = boxPanel.offsetWidth || BOX_FALLBACK_WIDTH;
    const flip = primary.x + boxWidth + BOX_OFFSET > width;
    const targetLeft = flip
      ? primary.x - BOX_OFFSET - boxWidth
      : primary.x + BOX_OFFSET;
    if (showing) {
      boxLeftSpring.jump(targetLeft);
      // TooltipBox entrance: outer fades in over 100ms, panel springs in.
      boxFadeAnimation?.cancel();
      boxFadeAnimation = boxLayer.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 100,
        fill: "both",
      });
      runEntrance(flip);
    } else {
      boxLeftSpring.set(targetLeft);
      // bklit remounts the panel when the flip side changes (flipKey),
      // replaying the entrance from the new side.
      if (prevFlip !== null && flip !== prevFlip) runEntrance(flip);
    }
    prevFlip = flip;

    // Date pill — compact DateTicker (bench path always has >60 labels).
    if (state.showDatePill && isDate) {
      pillLabel.textContent = shortDateFmt.format(date);
      pillLayer.style.display = "";
      if (showing || discrete) pillSpring.jump(primary.x);
      else pillSpring.set(primary.x);
    } else {
      pillLayer.style.display = "none";
    }

    // X-axis label fade (XAxisLabel): opacity 0 inside the ticker footprint
    // or when the label text equals the hovered label; 20px linear ramp.
    const hoveredLabel = isDate ? shortDateFmt.format(date) : null;
    for (const span of getLabelSpans()) {
      const labelX = Number(span.dataset.bkmX);
      const distance = Math.abs(labelX - primary.x);
      let opacity = 1;
      if (distance < TICKER_HALF_WIDTH) {
        opacity = 0;
      } else if (hoveredLabel && span.textContent === hoveredLabel) {
        opacity = 0;
      } else if (distance < TICKER_HALF_WIDTH + FADE_BUFFER) {
        opacity = (distance - TICKER_HALF_WIDTH) / FADE_BUFFER;
      }
      span.style.opacity = String(opacity);
    }
  };

  return {
    onFocusGroupChange: update,
    detach() {
      hide();
      highlightSvg.remove();
      crosshairSvg.remove();
      dotsSvg.remove();
      boxLayer.remove();
      pillLayer.remove();
      dotBySeries.clear();
      dotSprings.clear();
      rowBySeries.clear();
      highlightPathBySeries.clear();
    },
  };
}
