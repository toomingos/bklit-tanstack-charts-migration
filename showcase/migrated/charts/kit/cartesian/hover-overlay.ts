// The hover indicator of a time-x chart (active markers, crosshair rule, date pill, one dot per series) as an element we own, a sibling of the renderer's
// svg inside the chart host. Positions glide along bklit's springs (`springOf`, one shared rAF loop writing transforms; Web Animations keyframes cost
// ~4 ms per move on creation). The renderer's focus-guide layer stays empty:
// it re-serializes its whole fragment to markup and reparses it on every move (UPSTREAM-GAPS #66), which dominated the move cost.
import { REST_PX, springOf } from "../motion/spring-curve";
import { CROSSHAIR_SPRING, DATE_PILL_SPRING } from "../motion/springs";
import type { Spring } from "../motion/springs";
import type { ChartMargin } from "../theme";
import type { PillLayout } from "./date-pill";
import type { PlotSnapshot } from "./plot-size";
import type { Row } from "./series";

/** One circle of a dot: centred on the point, SVG-style (stroke centred on the radius). */
interface OverlayCircle {
  readonly r: number;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
}

/** A marker that follows the focused row of one series: bklit's TooltipDot (glides, `glide`) or the 1.35x active marker (jumps). */
export interface OverlayDot {
  readonly yAxis: string;
  readonly valueOf: (row: Row) => number | undefined;
  readonly circles: readonly OverlayCircle[];
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
}

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

/** An element whose `transform` follows a spring on each axis, velocity kept across retargets (motion's `useSpring`, as bklit's tooltip dots and date ticker do). */
class Glide {
  private readonly axes: Axis[];
  constructor(
    private readonly el: HTMLElement,
    private readonly spring: Spring,
    count: number,
    private readonly css: (values: readonly number[]) => string,
    private readonly ticker: Ticker,
  ) {
    this.axes = Array.from({ length: count }, () => ({ t0: 0, target: 0, v0: 0, x0: 0 }));
  }

  /** Places the element at `values` with no motion. */
  jump(values: readonly number[]): void {
    this.ticker.stop(this);
    this.axes.forEach((axis, i) => { axis.target = values[i] ?? 0; axis.x0 = 0; axis.v0 = 0; });
    this.el.style.transform = this.css(values);
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
    this.el.style.transform = this.css(rest ? this.axes.map((axis) => axis.target) : at);
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
  readonly glide: Glide;
  readonly months: Glide | null;
  readonly days: Glide | null;
  readonly text: HTMLElement | null;
}

/** Imperative hover indicator for one chart host. `mount` once, `update` after each draw, `focus` on every focus change. */
export class HoverOverlay {
  readonly root: HTMLDivElement;
  private model: HoverOverlayModel | null = null;
  private snapshot: PlotSnapshot | null = null;
  private margin: ChartMargin | null = null;
  private rule: HTMLElement | null = null;
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
  update(model: HoverOverlayModel | null, snapshot: PlotSnapshot, margin: ChartMargin): void {
    this.model = model;
    this.snapshot = snapshot;
    this.margin = margin;
    this.root.replaceChildren();
    this.rule = null;
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
      this.buildRule(model.crosshair, snapshot, margin);
    }
    for (const dot of model.dots) {
      this.dots.push(this.buildDot(dot));
    }
    if (model.pill) {
      this.pill = this.buildPill(model.pill, snapshot);
    }
    const held = this.focused;
    this.focused = null;
    this.focus(held?.time ?? null, held?.row ?? null);
  }

  /** Moves the indicator to the focused row (`null` hides it at once, like bklit unmounting the crosshair and dots). */
  focus(time: number | null, row: Row | null): void {
    const { model, snapshot, margin } = this;
    if (time === null || row === null || !model || !snapshot || !margin) {
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
    const { built, size } = snapshot;
    const xStart = built.domains.x[0].getTime();
    const span = built.domains.x[1].getTime() - xStart;
    const x = margin.left + (span > 0 ? ((time - xStart) / span) * size.innerWidth : 0);
    this.ruleGlide?.[enter ? "jump" : "glide"]([x]);
    for (const view of this.dots) {
      const value = view.dot.valueOf(row);
      const domain = built.domains.y[view.dot.yAxis];
      const y = value === undefined || !Number.isFinite(value) || !domain ? Number.NaN : margin.top + size.innerHeight - ((value - domain[0]) / (domain[1] - domain[0] || 1)) * size.innerHeight;
      view.el.style.display = Number.isFinite(y) ? "" : "none";
      if (Number.isFinite(y)) {
        view.glide?.[enter ? "jump" : "glide"]([x, y]);
        if (!view.glide) { view.el.style.transform = translate([x, y]); }
      }
    }
    this.focusPill(model, time, x, enter);
    this.root.setAttribute("data-on", "");
  }

  private focusPill(model: HoverOverlayModel, time: number, x: number, enter: boolean): void {
    const pill = this.pill;
    if (!pill || !model.pill) {
      return;
    }
    pill.glide[enter ? "jump" : "glide"]([x]);
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

  private buildRule(rule: NonNullable<HoverOverlayModel["crosshair"]>, snapshot: PlotSnapshot, margin: ChartMargin): void {
    const wrap = div("bkm-hov-x", this.root);
    wrap.style.top = `${margin.top}px`;
    wrap.style.height = `${Math.max(0, snapshot.size.innerHeight)}px`;
    if (rule.dash) {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("width", "1");
      svg.setAttribute("height", String(Math.max(0, snapshot.size.innerHeight)));
      svg.style.overflow = "visible";
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("y2", String(Math.max(0, snapshot.size.innerHeight)));
      line.style.stroke = rule.color;
      line.style.strokeWidth = String(rule.width);
      line.style.strokeDasharray = rule.dash.replace(",", " ");
      svg.append(line);
      wrap.append(svg);
    } else {
      // bklit TooltipIndicator gradient: transparent -> colour at 10% -> colour at 90% -> transparent (tooltip-indicator.tsx).
      const bar = div("bkm-hov-bar", wrap);
      bar.style.width = `${rule.width}px`;
      bar.style.marginLeft = `${-rule.width / 2}px`;
      bar.style.backgroundImage = `linear-gradient(to bottom,transparent 0%,${rule.color} 10%,${rule.color} 90%,transparent 100%)`;
    }
    this.rule = wrap;
    // bklit's crosshair rides the tooltipSpring (charts/chart-config-context.tsx:20).
    this.ruleGlide = new Glide(wrap, CROSSHAIR_SPRING, 1, translateX, this.ticker);
  }

  private buildDot(dot: OverlayDot): DotView {
    const el = div("bkm-hov-dot", this.root);
    const svg = document.createElementNS(SVG_NS, "svg");
    // 1x1, not 0x0: a zero-sized svg is not rendered.
    svg.setAttribute("width", "1");
    svg.setAttribute("height", "1");
    svg.style.overflow = "visible";
    for (const c of dot.circles) {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", String(c.r));
      // style, not attributes: presentation attributes do not resolve var().
      circle.style.fill = c.fill;
      circle.style.stroke = c.stroke;
      circle.style.strokeWidth = String(c.strokeWidth);
      svg.append(circle);
    }
    el.append(svg);
    return { dot, el, glide: dot.glide ? new Glide(el, CROSSHAIR_SPRING, 2, translate, this.ticker) : null };
  }

  private buildPill(spec: NonNullable<HoverOverlayModel["pill"]>, snapshot: PlotSnapshot): PillView {
    const wrap = div("bkm-hov-pill", this.root);
    // The native pill sat with its 32px capsule centred 20px above the host bottom (bklit date pill: bottom 4px, z-50).
    wrap.style.top = `${snapshot.size.height - 36}px`;
    const box = div("bkm-hov-pill-box", wrap);
    const layout = spec.layout;
    if (!layout) {
      const text = document.createElement("span");
      text.className = "bkm-hov-pill-text";
      div("bkm-hov-pill-row", box).append(text);
      return { days: null, el: wrap, glide: new Glide(wrap, CROSSHAIR_SPRING, 1, translateX, this.ticker), months: null, text };
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
    const days = layout.days.some((d) => d !== "") ? column(layout.days) : null;
    return { days, el: wrap, glide: new Glide(wrap, CROSSHAIR_SPRING, 1, translateX, this.ticker), months, text: null };
  }
}
