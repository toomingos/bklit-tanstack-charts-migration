// bklit-ui hover chrome (ChartTooltip) for CandlestickChart, ported onto a
// native pointermove listener (see candlestick-chart.tsx). Shares the
// crosshair/dot/box/date-pill/label-fade port from `hover-chrome.ts`/
// `scatter-hover-chrome.ts` (bklit's ChartTooltip is chart-agnostic — copied
// rather than imported so proven, gate-passing charts can never regress from
// this work, docs/LOG.md D10/D14).
//
// The dim/highlight idiom is a THIRD, candlestick-specific pattern (neither
// Line's path re-stroke nor Scatter's enlarged-copy): bklit's
// `geometryDimOpacity` dims candles PER-CANDLE by timestamp match
// (candlestick.tsx), wrapping EACH candle's wick+body in its OWN <g
// opacity={fadedOpacity}>, then separately paints an undimmed, unscaled,
// instant duplicate of the hovered candle's wick+body rects on top
// (`highlightGeometry` + bare `<g><CandlestickBody/></g>`). Since only one
// candle ever differs from the rest at a time, dimming as two groups split
// by mark type (wick vs body, see setMarksDimmed below) rather than n
// per-candle groups is visually equivalent for the "which candle is
// excluded" question — the hovered candle is already handled by the
// separately-painted undimmed duplicate below. It is NOT equivalent to a
// single shared-ancestor opacity toggle though: bklit's per-candle grouping
// means each candle's body composites over its OWN already-dimmed wick,
// so the wick-under-body band ends up at 1-(1-fadedOpacity)^2 (~0.51 for
// the default 0.3), not a flat fadedOpacity — see setMarksDimmed for the fix
// this required (QA n=1000 hover-30 regression, diagnosed via pixel-ratio
// analysis of the settled vs. hovered captures). Also unlike scatter
// (opacity+blur), bklit candlestick's own dim is CSS `opacity` only, 0.3,
// 0.15s ease-in-out — no blur (candlestick.tsx `geometryDimOpacity` sets a
// plain `opacity` style, never `filter`).
import { intFmt, shortDateFmt, weekdayDateFmt } from "./formatters";
import { createSpring, type Spring } from "./spring";

const SVG_NS = "http://www.w3.org/2000/svg";

// bklit chart-config-context.tsx DEFAULT_CHART_CONFIG
const TOOLTIP_SPRING = { stiffness: 300, damping: 30 }; // crosshair/dot/pill
const TOOLTIP_BOX_SPRING = { stiffness: 100, damping: 20 }; // panel follow
const ENTRANCE_SPRING = { stiffness: 300, damping: 25 }; // panel entrance
const DIM_TRANSITION = "opacity 0.15s ease-in-out";
// bklit chart-tooltip.tsx: dateLabels.length > 60 → instant crosshair/dot/pill
export const DISCRETE_INTERACTION_THRESHOLD = 60;
// bklit tooltip-box.tsx / chart-tooltip.tsx defaults
const BOX_OFFSET = 16;
const BOX_FALLBACK_WIDTH = 180;
// bklit x-axis.tsx XAxisLabel defaults
const TICKER_HALF_WIDTH = 50;
const FADE_BUFFER = 20;

export interface CandlestickHoverChromeState {
  margin: { top: number; right: number; bottom: number; left: number };
  /** Rendered candle count — >60 disables position springs. */
  pointCount: number;
  /** Opacity all candles dim to while any candle is hovered. */
  fadedOpacity: number;
  showHoverFade: boolean;
  showCrosshair: boolean;
  showDots: boolean;
  showDatePill: boolean;
}

/** A rect's scene-space geometry (pixel coords, absolute/margin-inclusive). */
export interface CandleRectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  radius?: number;
  strokeWidth?: number;
}

/** Everything the chrome needs for the hovered candle (candlestick-chart.tsx
    computes this via the SAME stashed d3 scale instances the marks render
    through, so it is pixel-identical to the real candle). */
export interface CandlestickFocusPoint {
  date: Date;
  close: number;
  /** Candle center x (crosshair/dot/pill anchor). */
  centerX: number;
  /** Close price y (tooltip dot — bklit's single invisible "close" line). */
  closeY: number;
  body: CandleRectGeometry;
  wick: CandleRectGeometry;
}

export interface CandlestickHoverChrome {
  onFocusChange(point: CandlestickFocusPoint | null): void;
  detach(): void;
}

let chromeCounter = 0;

export function attachCandlestickHoverChrome(
  host: HTMLElement,
  getState: () => CandlestickHoverChromeState,
): CandlestickHoverChrome {
  const container = (host.closest("[data-bkm-chart]") as HTMLElement) ?? host;
  const doc = host.ownerDocument;
  const chromeId = ++chromeCounter;
  const gradientId = `bkm-candlestick-crosshair-gradient-${chromeId}`;

  // --- Active highlight (bklit highlightGeometry): undimmed, unscaled,
  //     instant duplicate of the hovered candle's wick+body — same z-order
  //     slot (under crosshair/dots) as scatter/line's own highlight layer.
  const activeHighlightSvg = doc.createElementNS(SVG_NS, "svg");
  activeHighlightSvg.setAttribute("class", "bkm-hover-layer");
  activeHighlightSvg.setAttribute("aria-hidden", "true");
  activeHighlightSvg.style.display = "none";
  const highlightWick = doc.createElementNS(SVG_NS, "rect");
  const highlightBody = doc.createElementNS(SVG_NS, "rect");
  // bklit CandlestickBody paints wick first, body on top.
  activeHighlightSvg.append(highlightWick, highlightBody);

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

  // --- Dot (TooltipDot, single row — bklit's invisible "close" line) -----
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

  // --- Tooltip box (TooltipBox + TooltipContent, one "close" row) --------
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
  const row = doc.createElement("div");
  row.className = "bkm-tooltip-row";
  const rowLeft = doc.createElement("div");
  rowLeft.className = "bkm-tooltip-row-label";
  const rowSwatch = doc.createElement("span");
  rowSwatch.className = "bkm-tooltip-swatch";
  rowSwatch.style.backgroundColor = "var(--chart-line-primary)";
  const rowLabel = doc.createElement("span");
  rowLabel.className = "bkm-tooltip-series";
  rowLabel.textContent = "close";
  rowLeft.append(rowSwatch, rowLabel);
  const rowValue = doc.createElement("span");
  rowValue.className = "bkm-tooltip-value";
  row.append(rowLeft, rowValue);
  boxRows.appendChild(row);
  boxContent.append(boxTitle, boxRows);
  boxPanel.appendChild(boxContent);
  boxLayer.appendChild(boxPanel);
  boxLayer.style.display = "none";

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

  // bklit z-order: active highlight sits under the crosshair/dot chrome.
  host.append(activeHighlightSvg, crosshairSvg, dotsSvg, boxLayer, pillLayer);

  // --- Springs ------------------------------------------------------------
  const crosshairSpring = createSpring(
    0,
    TOOLTIP_SPRING.stiffness,
    TOOLTIP_SPRING.damping,
    (x) => crosshairRect.setAttribute("x", String(x)),
  );
  const dotXSpring = createSpring(
    0,
    TOOLTIP_SPRING.stiffness,
    TOOLTIP_SPRING.damping,
    (x) => dot.setAttribute("cx", String(x)),
  );
  const dotYSpring = createSpring(
    0,
    TOOLTIP_SPRING.stiffness,
    TOOLTIP_SPRING.damping,
    (y) => dot.setAttribute("cy", String(y)),
  );
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

  // D85.1 (D82.1 revert): dims TWO custom rect mark groups (wicks, bodies).
  // The wick-under-body compounding effect
  // (1-(1-fadedOpacity)^2 in the overlap band) is preserved because the
  // bodies group composites OVER the already-dimmed wicks group
  // wherever they overlap — same z-order as bklit's per-candle <g> wrapping
  // (wick first, body on top). Only two CSS toggles total, no per-candle
  // DOM restructuring.
  const setMarksDimmed = (dimmed: boolean, fadedOpacity: number) => {
    const wicksGroup = container.querySelector<SVGGElement>(
      '.ts-chart__candle[data-ts-key="wicks"]',
    );
    const bodiesGroup = container.querySelector<SVGGElement>(
      '.ts-chart__candle[data-ts-key="bodies"]',
    );
    const value = dimmed ? String(fadedOpacity) : "1";
    if (wicksGroup) {
      wicksGroup.style.transition = DIM_TRANSITION;
      wicksGroup.style.opacity = value;
    }
    if (bodiesGroup) {
      bodiesGroup.style.transition = DIM_TRANSITION;
      bodiesGroup.style.opacity = value;
    }
  };

  const applyRectGeometry = (el: SVGRectElement, geometry: CandleRectGeometry) => {
    el.setAttribute("x", String(geometry.x));
    el.setAttribute("y", String(geometry.y));
    el.setAttribute("width", String(geometry.width));
    el.setAttribute("height", String(geometry.height));
    el.setAttribute("fill", geometry.fill);
    if (geometry.radius !== undefined) el.setAttribute("rx", String(geometry.radius));
    if (geometry.strokeWidth) {
      el.setAttribute("stroke", geometry.fill);
      el.setAttribute("stroke-width", String(geometry.strokeWidth));
    } else {
      el.removeAttribute("stroke");
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
    activeHighlightSvg.style.display = "none";
    crosshairSpring.stop();
    dotXSpring.stop();
    dotYSpring.stop();
    boxLeftSpring.stop();
    pillSpring.stop();
    entranceSpring.stop();
    boxFadeAnimation?.cancel();
    boxFadeAnimation = null;
    setMarksDimmed(false, 1);
    // Clear text so the DOM carries no tooltip content while hidden (bklit
    // unmounts its tooltip; the QA harness detects tooltips by text length).
    boxTitle.textContent = "";
    rowValue.textContent = "";
    pillLabel.textContent = "";
    resetLabelOpacities();
  };

  const update = (point: CandlestickFocusPoint | null) => {
    if (!point) {
      hide();
      return;
    }
    const state = getState();
    const { margin } = state;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    const discrete = state.pointCount > DISCRETE_INTERACTION_THRESHOLD;
    const showing = !visible;
    visible = true;

    // Crosshair — rect x is center - width/2 (TooltipIndicator).
    if (state.showCrosshair) {
      crosshairRect.setAttribute("y", String(margin.top));
      crosshairRect.setAttribute("height", String(innerHeight));
      crosshairSvg.style.display = "";
      const rectX = point.centerX - 0.5;
      if (showing || discrete) crosshairSpring.jump(rectX);
      else crosshairSpring.set(rectX);
    }

    // Dot — single row, close price (bklit's one invisible "close" line).
    if (state.showDots) {
      dotsSvg.style.display = "";
      if (showing || discrete) {
        dotXSpring.jump(point.centerX);
        dotYSpring.jump(point.closeY);
      } else {
        dotXSpring.set(point.centerX);
        dotYSpring.set(point.closeY);
      }
    }

    // Dim both rect marks + draw the undimmed highlight duplicate on top
    // (geometryDimOpacity + highlightGeometry). Both instant — bklit's
    // highlight is a plain conditional render, no motion/transition.
    if (state.showHoverFade) setMarksDimmed(true, state.fadedOpacity);
    activeHighlightSvg.style.display = "";
    applyRectGeometry(highlightWick, point.wick);
    applyRectGeometry(highlightBody, point.body);

    // Tooltip box — title + single "close" row, panel pinned to
    // top=margin.top with x-flip at offset 16.
    boxTitle.textContent = weekdayDateFmt.format(point.date);
    boxTitle.style.display = "";
    rowValue.textContent = intFmt(point.close);
    boxLayer.style.top = `${margin.top}px`;
    boxLayer.style.display = "";
    const boxWidth = boxPanel.offsetWidth || BOX_FALLBACK_WIDTH;
    const flip = point.centerX + boxWidth + BOX_OFFSET > width;
    const targetLeft = flip
      ? point.centerX - BOX_OFFSET - boxWidth
      : point.centerX + BOX_OFFSET;
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
    if (state.showDatePill) {
      pillLabel.textContent = shortDateFmt.format(point.date);
      pillLayer.style.display = "";
      if (showing || discrete) pillSpring.jump(point.centerX);
      else pillSpring.set(point.centerX);
    } else {
      pillLayer.style.display = "none";
    }

    // X-axis label fade (XAxisLabel): opacity 0 inside the ticker footprint
    // or when the label text equals the hovered label; 20px linear ramp.
    const hoveredLabel = shortDateFmt.format(point.date);
    for (const span of getLabelSpans()) {
      const labelX = Number(span.dataset.bkmX);
      const distance = Math.abs(labelX - point.centerX);
      let opacity = 1;
      if (distance < TICKER_HALF_WIDTH) {
        opacity = 0;
      } else if (span.textContent === hoveredLabel) {
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
      activeHighlightSvg.remove();
      crosshairSvg.remove();
      dotsSvg.remove();
      boxLayer.remove();
      pillLayer.remove();
    },
  };
}
