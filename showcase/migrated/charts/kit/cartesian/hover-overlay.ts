// The hover indicator of a cartesian chart (active markers, crosshair rule, date pill, one dot per series) as an element we own, a sibling of the renderer's
// svg inside the chart host. Positions glide along bklit's springs (`springOf`, one shared rAF loop writing transforms; Web Animations keyframes cost
// ~4 ms per move on creation). The renderer's focus-guide layer stays empty:
// it re-serializes its whole fragment to markup and reparses it on every move (UPSTREAM-GAPS #66), which dominated the move cost.
import { REST_PX, springOf } from "../motion/spring-curve";
import { CROSSHAIR_SPRING, DATE_PILL_SPRING } from "../motion/springs";
import type { Spring } from "../motion/springs";
import type { ChartMargin } from "../theme";
import type { PillLayout } from "./date-pill";
import type { PlotSnapshot } from "./plot-size";

/** What the overlay reads of a draw: the host height, the plot size and the resolved domains (x in ms). */
export interface OverlayPlot {
  readonly height: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly xDomain: readonly [number, number];
  readonly yDomains: Readonly<Record<string, readonly [number, number]>>;
}

export const overlayPlotOf = ({ built, size }: PlotSnapshot): OverlayPlot => ({
  height: size.height,
  innerWidth: size.innerWidth,
  innerHeight: size.innerHeight,
  xDomain: [built.domains.x[0].getTime(), built.domains.x[1].getTime()],
  yDomains: built.domains.y,
});
import type { Row } from "./series";

/** One shape of a dot, centred on the point, SVG-style (stroke centred on the edge): a circle of radius `r`, or with `corner` a rounded square of half-extent `r` (bklit's "ring" tooltip dot). */
export interface OverlayShape {
  readonly r: number;
  readonly corner?: number;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
}

/** A marker that follows the focused row of one series: bklit's TooltipDot (glides, `glide`) or the 1.35x active marker (jumps). */
export interface OverlayDot {
  readonly yAxis: string;
  readonly valueOf: (row: Row) => number | undefined;
  /** Shapes in paint order; a function when they depend on the plot size (a bar's band width). */
  readonly shapes: readonly OverlayShape[] | ((plot: OverlayPlot) => readonly OverlayShape[]);
  /** Where a category chart puts the dot: an x offset from the focus line and a y within the plot, or undefined to hide it. Replaces `valueOf` and the y domain. */
  readonly at?: (row: Row, plot: OverlayPlot, key: number) => { readonly dx: number; readonly y: number } | undefined;
  readonly glide: boolean;
}

export interface HoverOverlayModel {
  /** bklit TooltipIndicator: a `width`px rule with the 0/10/90/100% vertical fade, or a plain dashed line. */
  readonly crosshair: { readonly color: string; readonly width: number; readonly dash: string | undefined } | null;
  /** Date ticker: the measured rolling layout, or null for the compact text-sized pill (above 60 labels, bklit date-ticker.tsx:12). */
  readonly pill: { readonly layout: PillLayout | null; readonly labels: readonly string[] } | null;
  /** Markers in paint order (active markers first, dots last). */
  readonly dots: readonly OverlayDot[];
  /** Position of a focused row's time in the pill's label list. */
  readonly indexOf: (time: number) => number;
  /** x within the plot of a focus key; time charts omit it and the x domain maps the time. */
  readonly xOf?: (key: number, plot: OverlayPlot) => number;
}

let gradientCount = 0;
const SVG_NS = "http://www.w3.org/2000/svg";
const PILL_ROW = 24;

interface Axis {
  target: number;
  /** Displacement from `target` and velocity (px/s) at `t0`. */
  x0: number;
  v0: number;
  t0: number;
}

/** One animation-frame loop for every Glide of an overlay: a single rAF callback writes each moving element's transform, as motion's frame loop does for bklit's springs (date-ticker.tsx:81-82, tooltip-dot.tsx). */
class Ticker {
  private readonly active = new Set<Glide>();
  private frame = 0;

  start(glide: Glide): void {
    this.active.add(glide);
    if (this.frame === 0) {
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  stop(glide: Glide): void {
    this.active.delete(glide);
  }

  clear(): void {
    this.active.clear();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly tick = (now: number): void => {
    this.frame = 0;
    for (const glide of this.active) {
      if (glide.step(now)) {
        this.active.delete(glide);
      }
    }
    if (this.active.size > 0) {
      this.frame = requestAnimationFrame(this.tick);
    }
  };
}

interface Sink {
  readonly el: HTMLElement | SVGElement;
  readonly css: (values: readonly number[]) => string;
  last: string;
}

/** An element whose `transform` follows a spring on each axis, velocity kept across retargets (motion's `useSpring`, as bklit's tooltip dots and date ticker do). */
class Glide {
  private readonly axes: Axis[];
  private readonly sinks: Sink[] = [];
  constructor(
    el: HTMLElement | SVGElement,
    private readonly spring: Spring,
    count: number,
    css: (values: readonly number[]) => string,
    private readonly ticker: Ticker,
  ) {
    this.axes = Array.from({ length: count }, () => ({ t0: 0, target: 0, v0: 0, x0: 0 }));
    this.follow(el, css);
  }

  /** Another element that takes the same position (one spring for the crosshair and the pill, which share spring and target). */
  follow(el: HTMLElement | SVGElement, css: (values: readonly number[]) => string): void {
    this.sinks.push({ css, el, last: "" });
  }

  private write(values: readonly number[]): void {
    for (const sink of this.sinks) {
      const next = sink.css(values);
      // A spring settling on its target repeats the last value; an identical write still dirties the element's style.
      if (next !== sink.last) {
        sink.last = next;
        sink.el.style.transform = next;
      }
    }
  }

  /** Places the element at `values` with no motion. */
  jump(values: readonly number[]): void {
    this.ticker.stop(this);
    this.axes.forEach((axis, i) => { axis.target = values[i] ?? 0; axis.x0 = 0; axis.v0 = 0; });
    this.write(values);
  }

  /** Springs from wherever the element is (and however fast it moves) to `values`. */
  glide(values: readonly number[]): void {
    const now = performance.now();
    const motion = springOf(this.spring, REST_PX);
    this.axes.forEach((axis, i) => {
      const live = motion.sample(now - axis.t0, { from: axis.x0, to: 0, velocity: axis.v0 });
      const target = values[i] ?? 0;
      axis.x0 = axis.target + live.value - target;
      axis.v0 = live.velocity;
      axis.target = target;
      axis.t0 = now;
    });
    this.ticker.start(this);
  }

  /** Writes the position at frame time `now`; true once every axis is at rest. */
  step(now: number): boolean {
    const motion = springOf(this.spring, REST_PX);
    let rest = true;
    const at = this.axes.map((axis) => {
      const s = motion.sample(Math.max(0, now - axis.t0), { from: axis.x0, to: 0, velocity: axis.v0 });
      rest &&= s.done;
      return axis.target + (s.done ? 0 : s.value);
    });
    this.write(rest ? this.axes.map((axis) => axis.target) : at);
    return rest;
  }
}

const translate = (v: readonly number[]): string => `translate(${v[0] ?? 0}px,${v[1] ?? 0}px)`;
const translateX = (v: readonly number[]): string => `translateX(${v[0] ?? 0}px)`;
const translateY = (v: readonly number[]): string => `translateY(${v[0] ?? 0}px)`;

const div = (cls: string, parent?: HTMLElement): HTMLDivElement => {
  const el = document.createElement("div");
  el.className = cls;
  parent?.append(el);
  return el;
};

interface DotView {
  readonly dot: OverlayDot;
  readonly el: HTMLElement;
  readonly glide: Glide | null;
}

interface PillView {
  readonly el: HTMLElement;
  /** Null when the crosshair's glide carries the pill (same spring, same x). */
  readonly glide: Glide | null;
  readonly months: Glide | null;
  readonly days: Glide | null;
  readonly text: HTMLElement | null;
}

/** Imperative hover indicator for one chart host. `mount` once, `update` after each draw, `focus` on every focus change. */
export class HoverOverlay {
  readonly root: HTMLDivElement;
  private model: HoverOverlayModel | null = null;
  private plot: OverlayPlot | null = null;
  private margin: ChartMargin | null = null;
  private ruleGlide: Glide | null = null;
  private dots: DotView[] = [];
  private pill: PillView | null = null;
  private focused: { readonly time: number; readonly row: Row } | null = null;
  private entered = false;
  private monthRun = -1;
  private readonly ticker = new Ticker();

  constructor() {
    this.root = div("bkm-hov");
    this.root.setAttribute("aria-hidden", "true");
  }

  /** The model and plot of the latest draw; rebuilds the elements (a draw is a resize or a data change, never a hover move) and replays the current focus without motion. */
  update(model: HoverOverlayModel | null, plot: OverlayPlot, margin: ChartMargin): void {
    this.model = model;
    this.plot = plot;
    this.margin = margin;
    this.root.replaceChildren();
    this.ticker.clear();
    this.ruleGlide = null;
    this.dots = [];
    this.pill = null;
    this.monthRun = -1;
    this.entered = false;
    if (!model) {
      return;
    }
    if (model.crosshair) {
      this.buildRule(model.crosshair, plot, margin);
    }
    for (const dot of model.dots) {
      this.dots.push(this.buildDot(dot, plot));
    }
    if (model.pill) {
      this.pill = this.buildPill(model.pill, plot);
    }
    const held = this.focused;
    this.focused = null;
    this.focus(held?.time ?? null, held?.row ?? null);
  }

  /** Moves the indicator to the focused row (`null` hides it at once, like bklit unmounting the crosshair and dots). */
  focus(time: number | null, row: Row | null): void {
    const { model, plot, margin } = this;
    if (time === null || row === null || !model || !plot || !margin) {
      this.focused = null;
      this.entered = false;
      this.root.removeAttribute("data-on");
      return;
    }
    if (this.focused?.row === row && this.focused.time === time) {
      return;
    }
    this.focused = { row, time };
    const enter = !this.entered;
    this.entered = true;
    const [xStart, xEnd] = plot.xDomain;
    const span = xEnd - xStart;
    const x = margin.left + (model.xOf ? model.xOf(time, plot) : span > 0 ? ((time - xStart) / span) * plot.innerWidth : 0);
    this.ruleGlide?.[enter ? "jump" : "glide"]([x]);
    for (const view of this.dots) {
      const spot = this.spotOf(view.dot, row, plot, time, margin.top);
      view.el.style.display = spot ? "" : "none";
      if (spot) {
        const at = [x + spot.dx, spot.y];
        view.glide?.[enter ? "jump" : "glide"](at);
        if (!view.glide) { view.el.style.transform = translate(at); }
      }
    }
    this.focusPill(model, time, x, enter);
    this.root.setAttribute("data-on", "");
  }

  private spotOf(dot: OverlayDot, row: Row, plot: OverlayPlot, key: number, top: number): { readonly dx: number; readonly y: number } | undefined {
    if (dot.at) {
      const spot = dot.at(row, plot, key);
      return spot && Number.isFinite(spot.y) ? { dx: spot.dx, y: top + spot.y } : undefined;
    }
    const value = dot.valueOf(row);
    const domain = plot.yDomains[dot.yAxis];
    if (value === undefined || !Number.isFinite(value) || !domain) {
      return undefined;
    }
    return { dx: 0, y: top + plot.innerHeight - ((value - domain[0]) / (domain[1] - domain[0] || 1)) * plot.innerHeight };
  }

  private focusPill(model: HoverOverlayModel, time: number, x: number, enter: boolean): void {
    const pill = this.pill;
    if (!pill || !model.pill) {
      return;
    }
    pill.glide?.[enter ? "jump" : "glide"]([x]);
    const index = model.indexOf(time);
    const layout = model.pill.layout;
    if (pill.text) {
      pill.text.textContent = model.pill.labels[index] ?? "";
      return;
    }
    if (!layout) {
      return;
    }
    const run = layout.monthOf[index] ?? 0;
    // bklit's stacks mount at row 0 and spring to the focused row on every hover start (date-ticker.tsx:81-92); the month stack only moves when its run changes.
    if (enter) {
      pill.days?.jump([0]);
      pill.months?.jump([0]);
      this.monthRun = -1;
    }
    pill.days?.glide([-index * PILL_ROW]);
    if (this.monthRun !== run) {
      pill.months?.glide([-run * PILL_ROW]);
      this.monthRun = run;
    }
  }

  private buildRule(rule: NonNullable<HoverOverlayModel["crosshair"]>, plot: OverlayPlot, margin: ChartMargin): void {
    const height = Math.max(0, plot.innerHeight);
    const wrap = div("bkm-hov-x", this.root);
    wrap.style.top = `${margin.top}px`;
    wrap.style.height = `${height}px`;
    // An svg rect like bklit's TooltipIndicator (tooltip-indicator.tsx:163-200), moved by an in-svg transform so it rasterizes at the same subpixel position
    // (an HTML div or a composited layer antialiases the 1px edge differently).
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "1");
    svg.setAttribute("height", String(height));
    svg.style.overflow = "visible";
    let mark: SVGElement;
    if (rule.dash) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("y2", String(height));
      line.style.stroke = rule.color;
      line.style.strokeWidth = String(rule.width);
      line.style.strokeDasharray = rule.dash.replace(",", " ");
      mark = line;
    } else {
      // bklit gradient: transparent -> colour at 10% -> colour at 90% -> transparent (indicatorFadeGradientStops).
      const id = `bkm-hov-grad-${gradientCount++}`;
      const defs = document.createElementNS(SVG_NS, "defs");
      const gradient = document.createElementNS(SVG_NS, "linearGradient");
      gradient.id = id;
      gradient.setAttribute("x1", "0%");
      gradient.setAttribute("x2", "0%");
      gradient.setAttribute("y1", "0%");
      gradient.setAttribute("y2", "100%");
      for (const [offset, opacity] of [["0%", "0"], ["10%", "1"], ["90%", "1"], ["100%", "0"]] as const) {
        const stop = document.createElementNS(SVG_NS, "stop");
        stop.setAttribute("offset", offset);
        stop.style.stopColor = rule.color;
        stop.style.stopOpacity = opacity;
        gradient.append(stop);
      }
      defs.append(gradient);
      svg.append(defs);
      const bar = document.createElementNS(SVG_NS, "rect");
      bar.setAttribute("x", String(-rule.width / 2));
      bar.setAttribute("width", String(rule.width));
      bar.setAttribute("height", String(height));
      bar.style.fill = `url(#${id})`;
      mark = bar;
    }
    svg.append(mark);
    wrap.append(svg);
    // bklit's crosshair rides the tooltipSpring (charts/chart-config-context.tsx:20).
    this.ruleGlide = new Glide(mark, CROSSHAIR_SPRING, 1, translateX, this.ticker);
  }

  private buildDot(dot: OverlayDot, plot: OverlayPlot): DotView {
    const el = div("bkm-hov-dot", this.root);
    const svg = document.createElementNS(SVG_NS, "svg");
    // 1x1, not 0x0: a zero-sized svg is not rendered.
    svg.setAttribute("width", "1");
    svg.setAttribute("height", "1");
    svg.style.overflow = "visible";
    for (const c of typeof dot.shapes === "function" ? dot.shapes(plot) : dot.shapes) {
      let shape: SVGElement;
      if (c.corner === undefined) {
        shape = document.createElementNS(SVG_NS, "circle");
        shape.setAttribute("r", String(c.r));
      } else {
        shape = document.createElementNS(SVG_NS, "rect");
        shape.setAttribute("x", String(-c.r));
        shape.setAttribute("y", String(-c.r));
        shape.setAttribute("width", String(c.r * 2));
        shape.setAttribute("height", String(c.r * 2));
        shape.setAttribute("rx", String(c.corner));
      }
      // style, not attributes: presentation attributes do not resolve var().
      shape.style.fill = c.fill;
      shape.style.stroke = c.stroke;
      shape.style.strokeWidth = String(c.strokeWidth);
      svg.append(shape);
    }
    el.append(svg);
    return { dot, el, glide: dot.glide ? new Glide(el, CROSSHAIR_SPRING, 2, translate, this.ticker) : null };
  }

  private buildPill(spec: NonNullable<HoverOverlayModel["pill"]>, plot: OverlayPlot): PillView {
    const wrap = div("bkm-hov-pill", this.root);
    // The native pill sat with its 32px capsule centred 20px above the host bottom (bklit date pill: bottom 4px, z-50).
    wrap.style.top = `${plot.height - 36}px`;
    const box = div("bkm-hov-pill-box", wrap);
    const layout = spec.layout;
    if (!layout) {
      const text = document.createElement("span");
      text.className = "bkm-hov-pill-text";
      div("bkm-hov-pill-row", box).append(text);
      return { days: null, el: wrap, glide: this.pillGlide(wrap), months: null, text };
    }
    const column = (values: readonly string[]): Glide => {
      const col = div("bkm-hov-pill-col", box);
      const stack = div("bkm-hov-pill-stack", col);
      for (const value of values) {
        const row = div("bkm-hov-pill-row", stack);
        row.textContent = value;
      }
      // bklit's ticker springs both stacks with useSpring(0, { stiffness: 400, damping: 35 }) (tooltip/date-ticker.tsx:81-82).
      return new Glide(stack, DATE_PILL_SPRING, 1, translateY, this.ticker);
    };
    const months = column(layout.months);
    // bklit always mounts the day stack, empty for month-only labels: its gap-1 keeps the capsule 4px wider (date-ticker.tsx:96-125).
    const days = column(layout.days);
    return { days, el: wrap, glide: this.pillGlide(wrap), months, text: null };
  }

  /** The pill rides the crosshair's spring and target (both CROSSHAIR_SPRING on x), so it follows that glide; alone it springs by itself. */
  private pillGlide(wrap: HTMLElement): Glide | null {
    if (this.ruleGlide) {
      this.ruleGlide.follow(wrap, translateX);
      return null;
    }
    return new Glide(wrap, CROSSHAIR_SPRING, 1, translateX, this.ticker);
  }
}
