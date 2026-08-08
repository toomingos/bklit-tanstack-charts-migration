// LiveLineChart's hover/pointer-driven chrome — crosshair, per-series dots,
// tooltip box (default rows OR a custom `content` render prop), LiveXAxis's
// time pill + per-label fade, LiveYAxis's spring tick list. Everything here
// is imperative DOM (docs/LOG.md D10/D16/D22): pointer events only ever
// write a plain ref (see live-line-chart.tsx's native pointermove listener),
// and this module's `updateHover`/`updateFrame` are the only things that
// touch these elements — zero framer-motion, and the only React re-render
// this module ever causes is the SCOPED content-portal root below (used
// only when a <ChartTooltip content> render prop is supplied), which is
// gated to fire only when the resolved tooltip's content actually changes
// (the same "tooltipKey changed" gate bklit itself uses to decide whether to
// commit `setTooltipData`, live-line-chart.tsx:275-284) — never on every raw
// pointer/rAF tick, and it never touches the rest of the React tree.
//
// Geometry/springs are exact ports of:
//   crosshair   — tooltip/tooltip-indicator.tsx (via chart-tooltip.tsx):
//                 1px rect, vertical fade 10%/90%, var(--chart-crosshair),
//                 spring {300,30} — bklit's chartCssVars crosshairSpring.
//   dot(s)      — tooltip/tooltip-dot.tsx: r=5 circle, series color, 2px
//                 var(--chart-background) stroke, spring {300,30}.
//   box         — tooltip/tooltip-box.tsx: top=margin.top, x-flip at
//                 offset 16, follow spring {100,20}, entrance spring
//                 {300,25} (same constants as internal/hover-chrome.ts,
//                 which ports the SAME bklit source file for the other
//                 charts — not re-imported from there, per D22's "reuse
//                 spring.ts/formatters only").
//   time pill   — live-x-axis.tsx: bottom:4px, spring {300,30}
//                 (`crosshairSpringConfig`), same visual recipe as
//                 chart-tooltip.tsx's DateTicker compact pill.
//   label fade  — live-x-axis.tsx `labelFadeOpacity`: hidden within
//                 tickerHalfWidth(50)px of the crosshair, 20px linear ramp,
//                 0.15s ease-out tween (NOT the static XAxisLabel's 0.4s).
//   y ticks     — live-y-axis.tsx: hysteresis `pickNiceInterval`, tick
//                 spring {180,24} (`tickSpring` — distinct from the shared
//                 hover chrome's HIGHLIGHT_SPRING {180,28}, docs/LOG.md D22
//                 explicitly flags these as easy to conflate), edge fade
//                 28px, entrance = opacity-only (position starts AT target,
//                 matching live-y-axis.tsx's `initial={{opacity:0,
//                 y:tick.y}}` — no positional spring on entry, only on
//                 subsequent domain moves).
import { createRoot, type Root } from "react-dom/client";
import * as React from "react";
import { intFmt, shortDateFmt } from "./formatters";
import { createSpring, type Spring } from "./spring";
import type { ChartTooltipPoint } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

const TOOLTIP_SPRING = { stiffness: 300, damping: 30 };
const TOOLTIP_BOX_SPRING = { stiffness: 100, damping: 20 };
const ENTRANCE_SPRING = { stiffness: 300, damping: 25 };
const BOX_OFFSET = 16;
const BOX_FALLBACK_WIDTH = 180;
const PILL_SPRING = { stiffness: 300, damping: 30 };
const TICKER_HALF_WIDTH = 50;
const FADE_BUFFER = 20;
const TICK_SPRING = { stiffness: 180, damping: 24 };
const EDGE_FADE_PX = 28;

export interface LiveHoverSeries {
  dataKey: string;
  color: string;
  formatValue: (v: number) => string;
}

export interface LiveTooltipPoint {
  /** Canvas-space x (matches the crosshair/dot geometry). */
  x: number;
  date: Date;
  /** Per-series resolved value + y pixel at this x. */
  series: Array<{ dataKey: string; value: number; y: number }>;
}

export interface LiveHoverConfig {
  margin: { top: number; right: number; bottom: number; left: number };
  series: LiveHoverSeries[];
  showCrosshair: boolean;
  showDots: boolean;
  /** Tooltip box — false when no enabled <ChartTooltip> child exists (bklit
      renders no tooltip UI at all then; pill/label-fade still run). */
  showBox: boolean;
  /** LiveXAxis's time pill — driven by <LiveXAxis> presence, NOT by
      ChartTooltip's own `showDatePill` (a different pill in bklit). */
  showDatePill: boolean;
  content?: (props: { point: ChartTooltipPoint; index: number }) => React.ReactNode;
}

export interface LiveHoverFrameInput {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  /** Evenly time-spaced label positions (LiveXAxis), canvas x already
      includes margin.left. */
  xLabels: Array<{ x: number; label: string; key: number }>;
  /** LiveYAxis tick set for this commit (already filtered to the visible
      band, canvas y already includes margin.top offset via the scale). */
  yTicks: Array<{ key: string; y: number; label: string; edgeAlpha: number }>;
}

export interface LiveHoverInput {
  point: LiveTooltipPoint | null;
  /** Time label for the LiveXAxis pill (formatTime(timeMs)). */
  pillLabel: string | null;
  index: number;
}

export interface LiveHoverChrome {
  updateFrame(input: LiveHoverFrameInput): void;
  updateHover(input: LiveHoverInput): void;
  /** Toggles the "live tip" group's scrubbing dim (bklit live-line.tsx
      `motion.g animate={{opacity: isScrubbing ? 0.25 : 1}}`). Registers the
      live group elements to dim; safe to call before/after updateHover. */
  registerLiveGroups(elements: Element[]): void;
  detach(): void;
}

let gradientCounter = 0;

export function attachLiveHoverChrome(
  host: HTMLElement,
  getConfig: () => LiveHoverConfig,
): LiveHoverChrome {
  const doc = host.ownerDocument;
  const chromeId = ++gradientCounter;
  const gradientId = `bkm-live-crosshair-gradient-${chromeId}`;

  // --- Crosshair -------------------------------------------------------
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
    stop.setAttribute("style", `stop-color: var(--chart-crosshair); stop-opacity: ${opacity}`);
    gradient.appendChild(stop);
  }
  defs.appendChild(gradient);
  crosshairSvg.appendChild(defs);
  const crosshairRect = doc.createElementNS(SVG_NS, "rect");
  crosshairRect.setAttribute("width", "1");
  crosshairRect.setAttribute("fill", `url(#${gradientId})`);
  crosshairSvg.appendChild(crosshairRect);
  crosshairSvg.style.display = "none";
  const crosshairSpring = createSpring(0, TOOLTIP_SPRING.stiffness, TOOLTIP_SPRING.damping, (x) =>
    crosshairRect.setAttribute("x", String(x)),
  );

  // --- Dots --------------------------------------------------------------
  const dotsSvg = doc.createElementNS(SVG_NS, "svg");
  dotsSvg.setAttribute("class", "bkm-hover-layer");
  dotsSvg.setAttribute("aria-hidden", "true");
  dotsSvg.style.display = "none";
  const dotBySeries = new Map<string, SVGCircleElement>();
  const dotSprings = new Map<string, { x: Spring; y: Spring }>();

  // --- Tooltip box ---------------------------------------------------------
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
  const boxCustom = doc.createElement("div");
  // Custom `content` renders DIRECTLY in the panel, outside the padded
  // `.bkm-tooltip-content` wrapper: bklit's ChartTooltip only wraps the
  // DEFAULT title+rows path in <TooltipContent> (chart-tooltip.tsx 331-339 —
  // `content(...)` is passed straight to TooltipBox's children), so the
  // render prop supplies ALL its own padding. Nesting it under boxContent
  // double-padded the box (~10px content offset vs bklit in QA diffs).
  boxContent.append(boxTitle, boxRows);
  boxPanel.append(boxContent, boxCustom);
  boxLayer.appendChild(boxPanel);
  boxLayer.style.display = "none";
  interface RowElements {
    root: HTMLDivElement;
    swatch: HTMLSpanElement;
    label: HTMLSpanElement;
    value: HTMLSpanElement;
  }
  const rowBySeries = new Map<string, RowElements>();
  let customRoot: Root | null = null;
  let lastContentKey: string | null = null;

  // --- Time pill (LiveXAxis) ------------------------------------------------
  const pillLayer = doc.createElement("div");
  pillLayer.className = "bkm-date-pill-layer";
  const pill = doc.createElement("div");
  pill.className = "bkm-date-pill";
  const pillInner = doc.createElement("div");
  pillInner.className = "bkm-date-pill-inner";
  const pillLabelEl = doc.createElement("span");
  pillInner.appendChild(pillLabelEl);
  pill.appendChild(pillInner);
  pillLayer.appendChild(pill);
  pillLayer.style.display = "none";
  const pillSpring = createSpring(0, PILL_SPRING.stiffness, PILL_SPRING.damping, (x) => {
    pillLayer.style.left = `${x}px`;
  });

  // --- X-axis labels (LiveXAxis) -------------------------------------------
  const xLabelLayer = doc.createElement("div");
  xLabelLayer.className = "bkm-live-xlabel-layer";
  const xLabelBySlot = new Map<number, HTMLSpanElement>();
  const xLabelXBySlot = new Map<number, number>();

  // --- Y-axis ticks (LiveYAxis) ---------------------------------------------
  const yTickLayer = doc.createElement("div");
  yTickLayer.className = "bkm-live-ytick-layer";
  interface YTick {
    el: HTMLDivElement;
    span: HTMLSpanElement;
    ySpring: Spring;
    entered: boolean;
  }
  const yTickByKey = new Map<string, YTick>();

  host.append(crosshairSvg, dotsSvg, boxLayer, pillLayer, xLabelLayer, yTickLayer);

  let boxFadeAnimation: Animation | null = null;
  let entranceFrom = 0;
  const boxLeftSpring = createSpring(0, TOOLTIP_BOX_SPRING.stiffness, TOOLTIP_BOX_SPRING.damping, (left) => {
    boxLayer.style.left = `${left}px`;
  });
  const entranceSpring = createSpring(1, ENTRANCE_SPRING.stiffness, ENTRANCE_SPRING.damping, (p) => {
    boxPanel.style.transform = `translateX(${entranceFrom * (1 - p)}px) scale(${0.85 + 0.15 * p})`;
    boxPanel.style.opacity = String(p);
  });
  const runEntrance = (flipped: boolean) => {
    boxPanel.style.transformOrigin = flipped ? "right top" : "left top";
    entranceFrom = flipped ? 20 : -20;
    entranceSpring.jump(0);
    entranceSpring.set(1);
  };

  let visible = false;
  let prevFlip: boolean | null = null;
  const liveGroups: Element[] = [];

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
    for (const { x, y } of dotSprings.values()) {
      x.stop();
      y.stop();
    }
    boxFadeAnimation?.cancel();
    boxFadeAnimation = null;
    boxTitle.textContent = "";
    for (const row of rowBySeries.values()) {
      row.label.textContent = "";
      row.value.textContent = "";
    }
    pillLabelEl.textContent = "";
    for (const span of xLabelBySlot.values()) span.style.opacity = "1";
    for (const el of liveGroups) (el as HTMLElement).style.opacity = "1";
  };

  function updateHover(input: LiveHoverInput): void {
    const { point } = input;
    if (!point) {
      hide();
      return;
    }
    const config = getConfig();
    const width = host.clientWidth;
    const showing = !visible;
    visible = true;

    if (config.showCrosshair) {
      crosshairRect.setAttribute("y", String(config.margin.top));
      crosshairRect.setAttribute(
        "height",
        String(Math.max(0, host.clientHeight - config.margin.top - config.margin.bottom)),
      );
      crosshairSvg.style.display = "";
      const rectX = point.x - 0.5;
      if (showing) crosshairSpring.jump(rectX);
      else crosshairSpring.set(rectX);
    }

    if (config.showDots) {
      dotsSvg.style.display = "";
      for (const series of config.series) {
        const s = point.series.find((p) => p.dataKey === series.dataKey);
        let dot = dotBySeries.get(series.dataKey);
        if (!s) {
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
            x: createSpring(point.x, TOOLTIP_SPRING.stiffness, TOOLTIP_SPRING.damping, (x) =>
              dot!.setAttribute("cx", String(x)),
            ),
            y: createSpring(s.y, TOOLTIP_SPRING.stiffness, TOOLTIP_SPRING.damping, (y) =>
              dot!.setAttribute("cy", String(y)),
            ),
          });
        }
        dot.style.display = "";
        dot.setAttribute("fill", series.color);
        const springs = dotSprings.get(series.dataKey)!;
        if (showing) {
          springs.x.jump(point.x);
          springs.y.jump(s.y);
        } else {
          springs.x.set(point.x);
          springs.y.set(s.y);
        }
      }
    }

    // Tooltip box.
    if (config.showBox) {
      if (config.content) {
        const contentKey = `${Math.round(point.x)}:${point.series.map((s) => `${s.dataKey}=${s.value}`).join(",")}`;
        // Hide the whole padded default wrapper, not just its children —
        // an empty visible boxContent still contributes its py-2.5/px-3.
        boxContent.style.display = "none";
        boxCustom.style.display = "";
        if (contentKey !== lastContentKey) {
          lastContentKey = contentKey;
          if (!customRoot) customRoot = createRoot(boxCustom);
          const plainPoint: ChartTooltipPoint = { date: point.date };
          for (const s of point.series) plainPoint[s.dataKey] = s.value;
          customRoot.render(
            React.createElement(React.Fragment, null, config.content({ point: plainPoint, index: input.index })),
          );
        }
      } else {
        boxCustom.style.display = "none";
        boxContent.style.display = "";
        boxTitle.textContent = shortDateFmt.format(point.date);
        for (const series of config.series) {
          const s = point.series.find((p) => p.dataKey === series.dataKey);
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
          row.swatch.style.backgroundColor = series.color;
          row.label.textContent = series.dataKey;
          row.value.textContent = s ? series.formatValue(s.value) : "";
        }
      }
      boxLayer.style.top = `${config.margin.top}px`;
      boxLayer.style.display = "";
      const boxWidth = boxPanel.offsetWidth || BOX_FALLBACK_WIDTH;
      const flip = point.x + boxWidth + BOX_OFFSET > width;
      const targetLeft = flip ? point.x - BOX_OFFSET - boxWidth : point.x + BOX_OFFSET;
      if (showing) {
        boxLeftSpring.jump(targetLeft);
        boxFadeAnimation?.cancel();
        boxFadeAnimation = boxLayer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, fill: "both" });
        runEntrance(flip);
      } else {
        boxLeftSpring.set(targetLeft);
        if (prevFlip !== null && flip !== prevFlip) runEntrance(flip);
      }
      prevFlip = flip;
    } else {
      boxLayer.style.display = "none";
      prevFlip = null;
    }

    // Time pill.
    if (config.showDatePill && input.pillLabel !== null) {
      pillLabelEl.textContent = input.pillLabel;
      pillLayer.style.display = "";
      if (showing) pillSpring.jump(point.x);
      else pillSpring.set(point.x);
    } else {
      pillLayer.style.display = "none";
    }

    // X-axis label fade.
    for (const [slot, span] of xLabelBySlot) {
      const labelX = xLabelXBySlot.get(slot) ?? 0;
      const distance = Math.abs(labelX - point.x);
      let opacity = 1;
      if (distance < TICKER_HALF_WIDTH) opacity = 0;
      else if (distance < TICKER_HALF_WIDTH + FADE_BUFFER) opacity = (distance - TICKER_HALF_WIDTH) / FADE_BUFFER;
      span.style.opacity = String(opacity);
    }

    // Live-tip group dim (bklit motion.g opacity 1 -> 0.25 while scrubbing).
    for (const el of liveGroups) (el as HTMLElement).style.opacity = "0.25";
  }

  function updateFrame(input: LiveHoverFrameInput): void {
    // --- X-axis labels: position only (opacity is hover-driven above). ---
    const seen = new Set<number>();
    for (const l of input.xLabels) {
      seen.add(l.key);
      xLabelXBySlot.set(l.key, l.x);
      let span = xLabelBySlot.get(l.key);
      if (!span) {
        span = doc.createElement("span");
        span.className = "bkm-live-xlabel";
        xLabelLayer.appendChild(span);
        xLabelBySlot.set(l.key, span);
      }
      span.textContent = l.label;
      span.style.left = `${l.x}px`;
    }
    for (const [slot, span] of xLabelBySlot) {
      if (!seen.has(slot)) {
        span.remove();
        xLabelBySlot.delete(slot);
        xLabelXBySlot.delete(slot);
      }
    }

    // --- Y-axis ticks: diff by key, spring position, fade entrance/exit. --
    const seenTicks = new Set<string>();
    for (const t of input.yTicks) {
      seenTicks.add(t.key);
      let tick = yTickByKey.get(t.key);
      if (!tick) {
        const el = doc.createElement("div");
        el.className = "bkm-live-ytick";
        const span = doc.createElement("span");
        el.appendChild(span);
        yTickLayer.appendChild(el);
        // Entrance: position starts AT target (no positional spring on
        // entry, live-y-axis.tsx `initial={{y: tick.y}}`), opacity 0->1.
        // Transition set synchronously — avoids the rAF race where a
        // second `updateFrame` before the next frame clobbered it.
        el.style.transition = "opacity 220ms ease-out";
        el.style.transform = `translateY(${t.y}px)`;
        el.style.opacity = "0";
        requestAnimationFrame(() => {
          el.style.opacity = String(t.edgeAlpha);
        });
        const ySpring = createSpring(t.y, TICK_SPRING.stiffness, TICK_SPRING.damping, (y) => {
          el.style.transform = `translateY(${y}px)`;
        });
        tick = { el, span, ySpring, entered: true };
        yTickByKey.set(t.key, tick);
      } else {
        tick.el.style.opacity = String(t.edgeAlpha);
        tick.ySpring.set(t.y);
      }
      tick.span.textContent = t.label;
    }
    for (const [key, tick] of yTickByKey) {
      if (!seenTicks.has(key)) {
        tick.ySpring.stop();
        tick.el.style.transition = "opacity 150ms ease-out";
        tick.el.style.opacity = "0";
        tick.el.style.pointerEvents = "none";
        setTimeout(() => tick.el.remove(), 200);
        yTickByKey.delete(key);
      }
    }

    xLabelLayer.style.setProperty("--bkm-live-x-bottom", "12px");

    // --- Y-axis tick panel geometry (live-y-axis.tsx's wrapping div: top:
    // margin.top, height: innerHeight, left:0/width:margin.left for the only
    // implemented "left" position) — the per-tick elements only ever receive
    // a `translateY` (set above/on entry), so the panel itself must be
    // positioned here for those offsets to land in the right place. ---
    const innerHeightPx = Math.max(0, input.height - input.margin.top - input.margin.bottom);
    yTickLayer.style.top = `${input.margin.top}px`;
    yTickLayer.style.left = "0px";
    yTickLayer.style.width = `${input.margin.left}px`;
    yTickLayer.style.height = `${innerHeightPx}px`;
    void input.width;
  }

  return {
    updateFrame,
    updateHover,
    registerLiveGroups(elements) {
      liveGroups.length = 0;
      liveGroups.push(...elements);
    },
    detach() {
      lastContentKey = null;
      hide();
      crosshairSvg.remove();
      dotsSvg.remove();
      boxLayer.remove();
      pillLayer.remove();
      xLabelLayer.remove();
      yTickLayer.remove();
      customRoot?.unmount();
      customRoot = null;
      dotBySeries.clear();
      dotSprings.clear();
      rowBySeries.clear();
      for (const tick of yTickByKey.values()) tick.ySpring.stop();
      yTickByKey.clear();
      xLabelBySlot.clear();
      xLabelXBySlot.clear();
    },
  };
}

// Re-exported for live-line-chart.tsx (default tooltip row value formatting
// when a series has no LiveLine `formatValue` override — matches bklit's
// TooltipContent numeric fallback, chart-tooltip.tsx `intFmt`).
export const defaultRowFormat = intFmt;
