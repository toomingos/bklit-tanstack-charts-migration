// bklit-ui hover chrome (ChartTooltip) for ScatterChart, ported onto
// TanStack's focus system. Shares the crosshair/dot/box/date-pill/label-fade
// port from `hover-chrome.ts` (bklit's ChartTooltip is genuinely shared
// between Line and Scatter — repos/bklit-ui/.../tooltip/chart-tooltip.tsx
// reads only `lines`/`tooltipData` from context, chart-agnostic) — copied
// rather than imported so LineChart's proven, gate-passing behavior can never
// regress from scatter work (docs/LOG.md D10 zero-React-state rule; D14).
//
// Only the series dim/highlight differs from Line (D14), because it is owned
// by the *series* components (SeriesMarkersDimWrapper / ActiveHighlight in
// repos/bklit-ui/.../series-markers.tsx), not by ChartTooltip itself:
//   dim        — ALL marker circles (fill + ring, every series) to
//                opacity 0.5 + blur(2px), 0.15s ease-in-out, while any point
//                is hovered (inactiveOpacity/inactiveBlur/fadeOnHover
//                defaults; not per-series in the pilot API).
//   highlight  — the hovered point of each series gets an enlarged (x1.35),
//                undimmed marker copy drawn on top, shown/hidden with no
//                transition (StaticSeriesPointMarker conditional render is
//                instant — no spring, no CSS transition in bklit's source).
import { intFmt, shortDateFmt, weekdayDateFmt } from "./formatters";
import { createSpring, type Spring } from "./spring";

const SVG_NS = "http://www.w3.org/2000/svg";

// bklit chart-config-context.tsx DEFAULT_CHART_CONFIG
const TOOLTIP_SPRING = { stiffness: 300, damping: 30 }; // crosshair/dot/pill
const TOOLTIP_BOX_SPRING = { stiffness: 100, damping: 20 }; // panel follow
const ENTRANCE_SPRING = { stiffness: 300, damping: 25 }; // panel entrance
// bklit series-markers.tsx SeriesMarkersDimWrapper defaults (inactiveOpacity
// 0.5, inactiveBlur 2, 0.15s ease-in-out on both opacity and filter).
const DIM_OPACITY = "0.5";
const DIM_BLUR_PX = 2;
const DIM_TRANSITION = "opacity 0.15s ease-in-out, filter 0.15s ease-in-out";
// bklit series-markers.tsx SeriesMarkersActiveHighlight: activeScale 1.35.
const ACTIVE_SCALE = 1.35;
// bklit chart-tooltip.tsx: dateLabels.length > 60 → instant crosshair/dot/pill
export const DISCRETE_INTERACTION_THRESHOLD = 60;
// bklit tooltip-box.tsx / chart-tooltip.tsx defaults
const BOX_OFFSET = 16;
const BOX_FALLBACK_WIDTH = 180;
// bklit x-axis.tsx XAxisLabel defaults
const TICKER_HALF_WIDTH = 50;
const FADE_BUFFER = 20;

export interface ScatterHoverChromeSeries {
  dataKey: string;
  /** Resolved fill (bklit: fill ?? stroke ?? defaultScatterColors[i]). */
  fill: string;
  /** Resolved ring stroke (bklit: stroke ?? resolvedFill). */
  stroke: string;
  strokeWidth: number;
  ringGap: number;
  radius: number;
}

export interface ScatterHoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  series: ScatterHoverChromeSeries[];
  xDataKey: string;
  /** Rendered point count — >60 disables position springs. */
  pointCount: number;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
}

/** Subset of TanStack's ChartPoint the chrome reads (scene px coords). */
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

let gradientCounter = 0;

export function attachScatterHoverChrome(
  host: HTMLElement,
  getState: () => ScatterHoverChromeState,
): ScatterHoverChrome {
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;
  const gradientId = `bkm-scatter-crosshair-gradient-${chromeId}`;

  // --- Active highlight (SeriesMarkersActiveHighlight): enlarged undimmed
  //     marker copy of the hovered point per series, drawn under the
  //     crosshair/dots chrome (same z-order slot Line's highlight band used).
  const activeHighlightSvg = doc.createElementNS(SVG_NS, "svg");
  activeHighlightSvg.setAttribute("class", "bkm-hover-layer");
  activeHighlightSvg.setAttribute("aria-hidden", "true");
  activeHighlightSvg.style.display = "none";
  const activeGroupBySeries = new Map<string, SVGGElement>();

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

  // bklit z-order: active highlight sits under the crosshair/dots chrome.
  host.append(activeHighlightSvg, crosshairSvg, dotsSvg, boxLayer, pillLayer);

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
  let entranceFrom = 0;
  const entranceSpring = createSpring(
    1,
    ENTRANCE_SPRING.stiffness,
    ENTRANCE_SPRING.damping,
    (p) => {
      boxPanel.style.transform = `translateX(${entranceFrom * (1 - p)}px) scale(${0.85 + 0.15 * p})`;
      boxPanel.style.opacity = String(p);
    },
  );

  let visible = false;
  let prevFlip: boolean | null = null;
  let boxFadeAnimation: Animation | null = null;

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

  // ALL marker circles (both fill + ring marks, every series) — bklit
  // SeriesMarkersDimWrapper wraps one <g style="filter:blur(...)"> around a
  // series' fill+ring circles *together* so they blur as one flattened
  // shape. Blurring the fill-mark group and ring-mark group as two
  // *separate* filtered elements (composited afterwards) is visually
  // different at high point density (verified via QA diff at n=1000: >2%
  // vs the 0.5% gate) — blur is not linear over independently-rasterized
  // layers. `.ts-chart__marks` is the one stable ancestor already common to
  // every mark (scene.ts), so dimming it as a single group reproduces
  // bklit's "blur the composited shape" semantics without reparenting
  // TanStack's own DOM nodes (which risks breaking its keyed reconciliation
  // on a later data update).
  const setMarkersDimmed = (dimmed: boolean) => {
    const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marksGroup) return;
    marksGroup.style.transition = DIM_TRANSITION;
    marksGroup.style.opacity = dimmed ? DIM_OPACITY : "1";
    marksGroup.style.filter = dimmed ? `blur(${DIM_BLUR_PX}px)` : "none";
  };

  const ensureActiveGroup = (series: ScatterHoverChromeSeries): SVGGElement => {
    let group = activeGroupBySeries.get(series.dataKey);
    if (group) return group;
    group = doc.createElementNS(SVG_NS, "g") as SVGGElement;
    const fillCircle = doc.createElementNS(SVG_NS, "circle");
    fillCircle.setAttribute("cx", "0");
    fillCircle.setAttribute("cy", "0");
    fillCircle.setAttribute("r", String(series.radius));
    fillCircle.setAttribute("fill", series.fill);
    group.appendChild(fillCircle);
    if (series.strokeWidth > 0) {
      const ringCircle = doc.createElementNS(SVG_NS, "circle");
      ringCircle.setAttribute("cx", "0");
      ringCircle.setAttribute("cy", "0");
      ringCircle.setAttribute(
        "r",
        String(series.radius + series.ringGap + series.strokeWidth / 2),
      );
      ringCircle.setAttribute("fill", "none");
      ringCircle.setAttribute("stroke", series.stroke);
      ringCircle.setAttribute("stroke-width", String(series.strokeWidth));
      group.appendChild(ringCircle);
    }
    activeHighlightSvg.appendChild(group);
    activeGroupBySeries.set(series.dataKey, group);
    return group;
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    prevFlip = null;
    crosshairSvg.style.display = "none";
    dotsSvg.style.display = "none";
    boxLayer.style.display = "none";
    pillLayer.style.display = "none";
    activeHighlightSvg.style.display = "none";
    crosshairSpring.stop();
    boxLeftSpring.stop();
    pillSpring.stop();
    entranceSpring.stop();
    boxFadeAnimation?.cancel();
    boxFadeAnimation = null;
    for (const { x, y } of dotSprings.values()) {
      x.stop();
      y.stop();
    }
    setMarkersDimmed(false);
    for (const group of activeGroupBySeries.values()) group.style.display = "none";
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

  const update = (points: readonly ScatterFocusPoint[]) => {
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

    // Dots — one per configured series (TooltipDot, fixed r=5 regardless of
    // the series' own marker radius — same as the shared Line chrome).
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
        dot.setAttribute("fill", series.fill || point.color);
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

    // Dim all markers + draw the enlarged active-highlight copy per series
    // (SeriesMarkersDimWrapper + SeriesMarkersActiveHighlight). Both are
    // instant (no spring) — bklit's active marker is a plain conditional
    // render with no motion/transition.
    setMarkersDimmed(true);
    activeHighlightSvg.style.display = "";
    for (const series of state.series) {
      const point = pointByMark.get(series.dataKey);
      const group = ensureActiveGroup(series);
      if (!point) {
        group.style.display = "none";
        continue;
      }
      group.style.display = "";
      group.setAttribute(
        "transform",
        `translate(${point.x}, ${point.y}) scale(${ACTIVE_SCALE})`,
      );
    }

    // Tooltip box — title + one row per series (TooltipContent), panel
    // pinned to top=margin.top with x-flip at offset 16.
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
        series.fill || point?.color || "transparent";
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
      boxFadeAnimation?.cancel();
      boxFadeAnimation = boxLayer.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 100,
        fill: "both",
      });
      runEntrance(flip);
    } else {
      boxLeftSpring.set(targetLeft);
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
      activeHighlightSvg.remove();
      crosshairSvg.remove();
      dotsSvg.remove();
      boxLayer.remove();
      pillLayer.remove();
      dotBySeries.clear();
      dotSprings.clear();
      rowBySeries.clear();
      activeGroupBySeries.clear();
    },
  };
}
