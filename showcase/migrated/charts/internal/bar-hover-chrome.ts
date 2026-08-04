// bklit-ui hover chrome (ChartTooltip) for BarChart, ported onto our own
// band-index hover resolution (bar-chart.tsx's native pointermove listener —
// NOT TanStack focus/bisect). Shares the crosshair/dot/box/date-pill/label-
// fade geometry with Line/Scatter's copies (bklit's ChartTooltip is genuinely
// chart-agnostic — repos/bklit-ui/.../tooltip/chart-tooltip.tsx), copied
// rather than imported so proven, gate-passing behavior can never regress
// from bar work (docs/LOG.md D10 zero-React-state rule).
//
// Two things differ from both Line and Scatter, confirmed by reading
// chart-tooltip.tsx directly:
//   title      — `barXAccessor(tooltipData.point)`: the pre-formatted
//                category label string itself (bar-chart.tsx categoryAccessor
//                already ran shortDateFmt for Date columns), NOT a re-format
//                via weekdayDateFmt at hover time — bar has no "weekday"
//                title variant at all.
//   dim        — owned by `<Bar>` itself (bar.tsx `isFaded = hoveredBarIndex
//                !== null && hoveredBarIndex !== i`), applied PER CATEGORY
//                INDEX to every rendered bar rect of every series (not
//                per-series like Line's highlight, not a single whole-group
//                blur like Scatter's dim) — opacity-only, plain CSS
//                transition, "opacity 0.15s ease-in-out", fadedOpacity
//                per-series-configurable (bklit Bar prop, default 0.3).
//   dots/x     — per-series dot x is that series' OWN bar center (bklit
//                xPositions[dataKey] = barPos + idx*(individualBarWidth+
//                groupGap) + individualBarWidth/2), not a shared band center;
//                dot y is the bar's value position (bar top). The crosshair /
//                box / date-pill all anchor at the *band* center instead
//                (bklit tooltipX = barPos + bandWidth/2).
import { intFmt } from "./formatters";
import { createSpring, type Spring } from "./spring";

const SVG_NS = "http://www.w3.org/2000/svg";

// bklit chart-config-context.tsx DEFAULT_CHART_CONFIG
const TOOLTIP_SPRING = { stiffness: 300, damping: 30 }; // crosshair/dot/pill
const TOOLTIP_BOX_SPRING = { stiffness: 100, damping: 20 }; // panel follow
const ENTRANCE_SPRING = { stiffness: 300, damping: 25 }; // panel entrance
// bklit bar.tsx AnimatedBar / static rect: per-bar opacity fade, 0.15s.
const DIM_TRANSITION = "opacity 0.15s ease-in-out";
// bklit chart-tooltip.tsx: dateLabels.length > 60 -> instant crosshair/dot/pill
export const DISCRETE_INTERACTION_THRESHOLD = 60;
// bklit tooltip-box.tsx / chart-tooltip.tsx defaults
const BOX_OFFSET = 16;
const BOX_FALLBACK_WIDTH = 180;
// bklit x-axis.tsx / bar-x-axis.tsx XAxisLabel defaults
const TICKER_HALF_WIDTH = 50;
const FADE_BUFFER = 20;

export interface BarHoverChromeSeries {
  dataKey: string;
  /** Resolved dot/swatch color (stroke ?? fill). */
  color: string;
  /** Opacity applied to this series' bars at every non-hovered category. */
  fadedOpacity: number;
}

export interface BarHoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  series: BarHoverChromeSeries[];
  /** Category count — >60 disables position springs (bklit discreteInteraction). */
  pointCount: number;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
}

export interface BarFocusPoint {
  markId: string;
  value: number;
  /** This series' own bar center x (dot x). */
  x: number;
  /** This series' bar value-position y (dot y, bar top). */
  y: number;
  color: string;
}

export interface BarFocusGroup {
  categoryIndex: number;
  /** Pre-formatted category label (categoryAccessor output) — used as both
      the tooltip title and the date-pill text, verbatim. */
  categoryLabel: string;
  /** Band center x — crosshair / box / date-pill anchor. */
  anchorX: number;
  points: readonly BarFocusPoint[];
}

export interface BarHoverChrome {
  onFocusChange(group: BarFocusGroup | null): void;
  detach(): void;
}

let gradientCounter = 0;

export function attachBarHoverChrome(
  host: HTMLElement,
  getState: () => BarHoverChromeState,
): BarHoverChrome {
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;
  const gradientId = `bkm-bar-crosshair-gradient-${chromeId}`;

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

  host.append(crosshairSvg, dotsSvg, boxLayer, pillLayer);

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

  // Per-category-index dim (bar.tsx `isFaded`): every rendered bar rect of
  // every series, opacity-only. `hoveredIndex === null` restores all bars to
  // full opacity (unhover). O(total bars) per call — bklit itself re-renders
  // every <Bar> on every hoveredBarIndex change, so this matches its own cost
  // model exactly; the pilot's bar geometry is only meaningful at demo/QA
  // scale (n=100 — grouped bars are visually degenerate well before n=1000,
  // docs/LOG.md I4), so this is not a hot path at the sizes bar is used at.
  const setCategoryHover = (hoveredIndex: number | null, series: readonly BarHoverChromeSeries[]) => {
    for (const s of series) {
      const escaped = s.dataKey.replace(/"/g, '\\"');
      const group = container.querySelector<SVGGElement>(
        `.ts-chart__bar-y[data-ts-key="${escaped}"]`,
      );
      if (!group) continue;
      const rects = group.querySelectorAll<SVGRectElement>("rect");
      rects.forEach((rect, i) => {
        rect.style.transition = DIM_TRANSITION;
        rect.style.opacity =
          hoveredIndex !== null && hoveredIndex !== i
            ? String(s.fadedOpacity)
            : "1";
      });
    }
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    prevFlip = null;
    crosshairSvg.style.display = "none";
    dotsSvg.style.display = "none";
    boxLayer.style.display = "none";
    pillLayer.style.display = "none";
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
    setCategoryHover(null, getState().series);
    boxTitle.textContent = "";
    for (const row of rowBySeries.values()) {
      row.label.textContent = "";
      row.value.textContent = "";
    }
    pillLabel.textContent = "";
    resetLabelOpacities();
  };

  const update = (group: BarFocusGroup | null) => {
    if (!group || group.points.length === 0) {
      hide();
      return;
    }
    const state = getState();
    const { margin } = state;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    const pointByMark = new Map(group.points.map((p) => [p.markId, p]));
    const discrete = state.pointCount > DISCRETE_INTERACTION_THRESHOLD;
    const showing = !visible;
    visible = true;

    // Crosshair — anchored at the band center (bklit tooltipX).
    if (state.showCrosshair) {
      crosshairRect.setAttribute("y", String(margin.top));
      crosshairRect.setAttribute("height", String(innerHeight));
      crosshairSvg.style.display = "";
      const rectX = group.anchorX - 0.5;
      if (showing || discrete) crosshairSpring.jump(rectX);
      else crosshairSpring.set(rectX);
    }

    // Dots — one per configured series, positioned at that series' OWN bar
    // center / value-position (not the shared band center).
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

    // Per-category-index dim (bar.tsx isFaded) — instant recompute over
    // every rendered bar, exactly mirroring bklit's own per-render cost.
    setCategoryHover(group.categoryIndex, state.series);

    // Tooltip box — title is the category label itself (chart-tooltip.tsx:
    // `barXAccessor ? barXAccessor(point) : weekdayDateFmt.format(...)` —
    // bar always takes the first branch), one row per series.
    boxTitle.textContent = group.categoryLabel;
    boxTitle.style.display = "";
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
      row.value.textContent =
        point && typeof point.value === "number" ? intFmt(point.value) : "0";
    }
    boxLayer.style.top = `${margin.top}px`;
    boxLayer.style.display = "";
    const boxWidth = boxPanel.offsetWidth || BOX_FALLBACK_WIDTH;
    const flip = group.anchorX + boxWidth + BOX_OFFSET > width;
    const targetLeft = flip
      ? group.anchorX - BOX_OFFSET - boxWidth
      : group.anchorX + BOX_OFFSET;
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

    // Date pill — same pre-formatted category label, anchored at band center.
    if (state.showDatePill) {
      pillLabel.textContent = group.categoryLabel;
      pillLayer.style.display = "";
      if (showing || discrete) pillSpring.jump(group.anchorX);
      else pillSpring.set(group.anchorX);
    } else {
      pillLayer.style.display = "none";
    }

    // X-axis label fade (BarXAxisLabel): opacity 0 inside the ticker
    // footprint or when the label text equals the hovered label; 20px ramp.
    for (const span of getLabelSpans()) {
      const labelX = Number(span.dataset.bkmX);
      const distance = Math.abs(labelX - group.anchorX);
      let opacity = 1;
      if (distance < TICKER_HALF_WIDTH) {
        opacity = 0;
      } else if (span.textContent === group.categoryLabel) {
        opacity = 0;
      } else if (distance < TICKER_HALF_WIDTH + FADE_BUFFER) {
        opacity = (distance - TICKER_HALF_WIDTH) / FADE_BUFFER;
      }
      span.style.opacity = String(opacity);
    }
  };

  return {
    onFocusChange: update,
    detach() {
      hide();
      crosshairSvg.remove();
      dotsSvg.remove();
      boxLayer.remove();
      pillLayer.remove();
      dotBySeries.clear();
      dotSprings.clear();
      rowBySeries.clear();
    },
  };
}
