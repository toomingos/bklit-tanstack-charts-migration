// bklit's dark date pill under the crosshair, fully native: one focus-guide mark whose resolver emits the capsule (box, clipped month and
// day stacks) at the focused x, so hovering never re-resolves the definition. Shared by every time-x chart.
import { createMark } from "@tanstack/charts";
import type { ChartBounds, ChartGradient, ChartMotionContext, ChartMotionDefinition, ResolvedScale, SceneNode } from "@tanstack/charts";
import { erase } from "./erased-types";
import { REST_PX } from "../motion/spring-curve";
import { DATE_PILL_SPRING } from "../motion/springs";
import type { AnyMark } from "./erased-types";
import { shortDateFmt } from "../format";
import type { guideMotion } from "../motion/guide-motion";
import { fontContext } from "../text-width";
import { X_TICK_PADDING } from "../theme";
import { typedAttr } from "../css-hooks";
import { CROSSHAIR_CLASS, NOT_MOTION, keyStarts } from "../renderer-dom";
import { clearAttribute, clearVar, raiseAttribute, writeVar } from "../host-write";

interface DatePillInput<TDatum> {
  readonly rows: Iterable<TDatum>;
  readonly id?: string;
  readonly x: (d: TDatum) => Date;
  readonly y: (d: TDatum) => number;
  readonly key: (d: TDatum) => number;
  readonly yScale?: string;
  /** Pill centre below the plot bottom (px). bklit anchors the pill 4px above the container bottom, so charts pass `margin.bottom - 19`. */
  readonly offset?: number;
  readonly motion: GuideMotion;
}

type GuideMotion = ReturnType<typeof guideMotion>;
type Scales = Readonly<Record<string, ResolvedScale>>;
type CentreOf = (scales: Scales) => ((xValue: unknown) => number) | undefined;

// Null without a document or canvas (SSR): callers keep their own fallback, so text-width.ts's length-ratio `textWidth` fallback is not used.
const measurePill = (text: string): number | null =>
  typeof document === "undefined" ? null : (fontContext(14, 500, getComputedStyle(document.body).fontFamily)?.measureText(text).width ?? null);

/** Fixed pill layout measured once per definition (bklit's stacked date ticker): box width and the text centre offsets from the pill centre. */
export interface PillLayout {
  readonly width: number;
  /** Month text centre minus pill centre (px): the month is centred in a column as wide as the widest month. */
  readonly month?: number;
  /** Day text centre minus pill centre (px): the day is centred in a column as wide as the widest day. */
  readonly day?: number;
  /** One entry per run of consecutive equal month words (bklit's `monthSegments`): the rows of the month stack. */
  readonly months: readonly string[];
  /** Per label: the index of its month run (the month stack only moves when the run changes). */
  readonly monthOf: readonly number[];
  /** Per label: the day word (the rows of the day stack). */
  readonly days: readonly string[];
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** bklit's date ticker: 16px padding, a month column (widest month), a 4px gap, a day column (widest day), each text centred in its column.
 * Above 60 labels bklit uses a compact text-sized pill (null: one native label). The native box is widened to `width` by pillTickStaticCss. */
export function pillLayout(labels: readonly string[]): PillLayout | null {
  if (labels.length === 0 || labels.length > 60) {
    return null;
  }
  let month = 0;
  let day = 0;
  const months: string[] = [];
  const monthOf: number[] = [];
  const days: string[] = [];
  for (const label of labels) {
    const [m = "", d = ""] = label.split(" ");
    const mw = measurePill(m);
    const dw = measurePill(d);
    if (mw === null || dw === null) {
      return null;
    }
    month = Math.max(month, mw);
    day = Math.max(day, dw);
    if (months.length === 0 || months.at(-1) !== m) {
      months.push(m);
    }
    monthOf.push(months.length - 1);
    days.push(d);
  }
  return { width: Math.round((32 + month + 4 + day) * 10) / 10, month: round2(-2 - day / 2), day: round2(2 + month / 2), months, monthOf, days };
}

const PILL_ROW = 24;
/** bklit's date ticker rolls with useSpring (date-ticker.tsx:81-82), see DATE_PILL_SPRING. */
const PILL_ROLL_SPRING = { type: "spring", ...DATE_PILL_SPRING, restSpeed: REST_PX.speed, restDelta: REST_PX.delta } as const;

/** A focus-guide-only mark: `node` builds the guide's scene node at the focused x (`centre` swaps in a scale-derived x, e.g. a bar band's centre),
 * so hover never re-resolves the definition and the node glides with the guide motion. */
export function guideMark(options: {
  readonly id: string;
  readonly motion: unknown;
  readonly yScale?: string;
  readonly centre?: CentreOf;
  /** Which focused value the guide follows (default "x"). `centre` maps it to the position `node` receives as its first argument. */
  readonly by?: "x" | "y";
  readonly node: (x: number, chart: ChartBounds, xValue: unknown, scales: Scales) => unknown;
}): AnyMark {
  const { id } = options;
  const motion = erase(options.motion);
  return erase(
    createMark<unknown>(
      () => ({
        id,
        focusGuideOnly: true,
        channels: { x: { scale: "x", values: [] }, y: { scale: options.yScale ?? "y", values: [] } },
        render: ({ chart, surface, scales, layout: sceneLayout }) => {
          const centreOf = options.centre?.(scales);
          return {
            nodes: [],
            focusGuides: [
              {
                key: id,
                markId: id,
                chart,
                surface,
                motion,
                measureText: sceneLayout.measureText,
                direction: sceneLayout.typography?.direction,
                resolve: ({ focus, cursor }) => {
                  const value = options.by === "y" ? focus?.primary.yValue : focus?.primary.xValue;
                  const c = focus && centreOf ? centreOf(value) : undefined;
                  const fallback = options.by === "y" ? (focus?.primary.y ?? cursor?.y?.position) : (focus?.primary.x ?? cursor?.x?.position);
                  const x = c !== undefined && Number.isFinite(c) ? c : fallback;
                  if (x === undefined || !Number.isFinite(x)) {
                    return undefined;
                  }
                  // Callers build the node loosely typed; the scene compiler consumes it as a SceneNode.
                  return erase(options.node(x, chart, value, scales));
                },
              },
            ],
          };
        },
      }),
      motion,
    ),
  );
}

/** bklit's 32px capsule (16px side padding, 14px text) straddling the plot's bottom edge, one focus-guide mark. A measured `layout` gives the rolling ticker: static 24px rows
 * in a 24px clip window, translateY sprung by the guide motion (CSS roll-in `bkm-roll-*`); without one it shows the whole date. `offset` is the pill centre below the plot bottom + 0.2px. */
export function pillMark(options: {
  readonly id: string;
  readonly layout: PillLayout | null;
  readonly offset: number;
  readonly motion: GuideMotion;
  readonly yScale?: string;
  /** Vertical text shift inside the window (px). */
  readonly textDy?: number;
  /** Text of the compact pill for the focused x value. */
  readonly format?: (value: unknown) => string;
  /** Index of the focused x value in the layout's label list (the rolling stacks travel there). Default 0. */
  readonly indexOf?: (xValue: unknown) => number;
  /** Pill x for a focused x value, from the chart scales (bklit centres a bar pill on the category band, not on the nearest bar). Default: the focus x. */
  readonly centre?: CentreOf;
}): AnyMark {
  const { id, layout, offset, textDy = 1 } = options;
  // The stacks roll with bklit's ticker spring (400/35); everything else in the pill glides with the chart's guide motion.
  const motion = (context: ChartMotionContext<never>): ReturnType<GuideMotion> =>
    context.phase !== "enter" && /:pill-[md]$/u.test(context.key) ? { transition: PILL_ROLL_SPRING } : options.motion(context);
  const yScale = options.yScale ?? "y";
  const format = options.format ?? ((value: unknown): string => (value instanceof Date ? shortDateFmt.format(value) : String(value)));
  const style = { fill: "var(--chart-date-pill-background)" };
  const text = { fill: "var(--chart-date-pill-foreground)", fillOpacity: 1 };
  const label = (key: string, value: string, x: number, y: number): SceneNode => ({
    kind: "label" as const,
    key,
    x,
    y,
    text: value,
    anchor: "middle" as const,
    baseline: "middle" as const,
    fontSize: 14,
    fontWeight: 500,
    style: text,
  });
  // The stack's translateY is the roll: the guide motion springs it between rows (no CSS vars, no host restyle).
  const stack = (prefix: string, values: readonly string[], x: number, row: number): SceneNode => ({
    kind: "group" as const,
    key: `${id}:${prefix}`,
    className: `bkm-${prefix}`,
    translateY: -row * PILL_ROW,
    children: values.map((value, k) => label(`${id}:${prefix}:${k}`, value, x, k * PILL_ROW + textDy)),
  });
  const build = (x: number, y: number, xValue: unknown): SceneNode => {
    if (!layout) {
      const width = Math.round(((measurePill(format(xValue)) ?? 60) + 32) * 10) / 10;
      return {
        kind: "group" as const,
        key: id,
        className: CROSSHAIR_CLASS,
        ariaHidden: true,
        translateX: x,
        translateY: y,
        children: [
          { kind: "rect" as const, key: `${id}:pill-box`, className: "bkm-pill-box", x: -width / 2, y: -16, width, height: 32, radius: 16, style },
          label(`${id}:pill-text`, format(xValue), 0, textDy),
        ],
      };
    }
    const hasDay = layout.days.some((d) => d !== "");
    const rawIndex = Math.round(options.indexOf?.(xValue) ?? 0);
    const index = Math.max(0, Math.min(layout.days.length - 1, rawIndex));
    return {
      kind: "group" as const,
      key: id,
      className: CROSSHAIR_CLASS,
      ariaHidden: true,
      translateX: x,
      translateY: y,
      children: [
        { kind: "rect" as const, key: `${id}:pill-box`, className: "bkm-pill-box", x: -layout.width / 2, y: -16, width: layout.width, height: 32, radius: 16, style },
        {
          kind: "group" as const,
          key: `${id}:pill-window`,
          className: "bkm-pill-window",
          clip: { x: -layout.width / 2, y: -12, width: layout.width, height: 24 },
          children: [stack("pill-m", layout.months, layout.month ?? 0, layout.monthOf[index] ?? 0), ...(hasDay ? [stack("pill-d", layout.days, layout.day ?? 0, index)] : [])],
        },
      ],
    };
  };
  return guideMark({ id, motion, yScale, centre: options.centre, node: (x, chart, xValue) => build(x, chart.y + chart.height + offset - 0.2, xValue) });
}

/** A focused-point dot as a focus-guide-only mark (bklit's TooltipDot / active marker): `valueAt` gives the series value at the focused x,
 * placed with the mark's y scale, so a hover only reconciles the guide fragment. */
export function dotGuideMark(options: {
  readonly id: string;
  readonly motion: ChartMotionDefinition<never>;
  readonly yScale?: string;
  readonly valueAt: (xValue: unknown) => number | undefined;
  readonly marker: { readonly radius: number; readonly fill: string; readonly stroke: string; readonly strokeWidth: number };
}): AnyMark {
  const { id, valueAt, marker } = options;
  const yScale = options.yScale ?? "y";
  const style = { fill: marker.fill, fillOpacity: 1, stroke: marker.stroke, strokeOpacity: 1, strokeWidth: marker.strokeWidth };
  return guideMark({
    id,
    motion: options.motion,
    yScale,
    node: (x, _chart, xValue, scales) => {
      const value = valueAt(xValue);
      const y = value === undefined ? Number.NaN : scales[yScale]?.map(value);
      if (!Number.isFinite(y)) {
        return undefined;
      }
      // The guide motion glides a group's translate (a dot's own cx/cy would snap).
      return {
        kind: "group" as const,
        key: id,
        className: CROSSHAIR_CLASS,
        ariaHidden: true,
        translateX: x,
        translateY: y,
        children: [{ kind: "dot" as const, key: `${id}:marker`, x: 0, y: 0, radius: marker.radius, style }],
      };
    },
  });
}

/** bklit's TooltipIndicator for time charts: a `width`-px rect filled with the vertical fade gradient (`paint` is its scoped url; focus-guide nodes are not paint-resolved).
 * A native crosshair rule is a zero-width line, which an objectBoundingBox gradient cannot paint; a rect antialiases like bklit's. */
export function crosshairGradient(id: string, color: string): ChartGradient {
  return { id, x1: 0, y1: 0, x2: 0, y2: 1, stops: [0, 0.1, 0.9, 1].map((offset) => ({ offset, color, opacity: offset === 0 || offset === 1 ? 0 : 1 })) };
}

export function crosshairRuleMark(options: { readonly id: string; readonly paint: string; readonly width: number; readonly motion: ChartMotionDefinition<never>; readonly yScale?: string; readonly centre?: CentreOf; readonly by?: "x" | "y"; readonly className?: string }): AnyMark {
  const { id, paint, width, className } = options;
  return guideMark({
    id,
    motion: options.motion,
    yScale: options.yScale,
    centre: options.centre,
    by: options.by,
    node: (x, chart) => ({
      kind: "group" as const,
      key: id,
      className: className === undefined ? CROSSHAIR_CLASS : `${CROSSHAIR_CLASS} ${className}`,
      ariaHidden: true,
      translateX: x,
      children: [{ kind: "rect" as const, key: `${id}:rule`, x: -width / 2, y: chart.y, width, height: chart.height, style: { fill: paint } }],
    }),
  });
}

/** Kit-facing wrapper: the pill of a time-x chart (`rows` / accessors are unused now that the mark reads the focus state). */
export function datePillGuides<TDatum>(input: DatePillInput<TDatum>, layout: PillLayout | null): AnyMark[] {
  const labelIndex = new Map<number, number>();
  let n = 0;
  for (const row of input.rows) {
    labelIndex.set(input.key(row), n);
    n += 1;
  }
  const indexOf = (value: unknown): number => labelIndex.get(value instanceof Date ? value.getTime() : Number(value)) ?? 0;
  return [pillMark({ id: input.id ?? "date-pill", layout, offset: input.offset ?? 6 + X_TICK_PADDING, motion: input.motion, yScale: input.yScale, indexOf })];
}

/** Roll-in of bklit's per-hover ticker: the host carries the row each stack starts from (`--bkm-rm0` month run, `--bkm-rd0` label index) while a hover begins;
 * the styles.css keyframes start the stacks there and settle onto the guide translate. Written once on entry, never while moving. */
export function writePillRollIn(host: HTMLElement, layout: PillLayout | null | undefined, index: number): void {
  if (!layout || index < 0 || index >= layout.days.length) {
    clearVar(host, "--bkm-rm0");
    clearVar(host, "--bkm-rd0");
    return;
  }
  const day = String(index);
  // An unchanged label index keeps its vars: a rewrite would invalidate style for the whole host with nothing new to say.
  if (host.style.getPropertyValue("--bkm-rd0") !== day) {
    writeVar(host, "--bkm-rm0", String(layout.monthOf[index] ?? 0));
    writeVar(host, "--bkm-rd0", day);
  }
}

/** Host attribute / CSS var the static pill rule is keyed on (charts with their own hover attribute pass distinct names). */
interface PillHostNames {
  readonly active: string;
  readonly fx: string;
  /** Prefix of the `0..PILL_SAME_MAX-1` vars holding the x of ticks that read like the focused date (bklit hides those too). */
  readonly same: string;
}
const DEFAULT_PILL_NAMES: PillHostNames = { active: "data-bkm-hover", fx: "--bkm-hx", same: "--bkm-same" };
/** For charts that already use `data-bkm-hover` / `--bkm-hx` for their own emphasis. */
export const OWN_PILL_NAMES: PillHostNames = { active: "data-bkm-pill", fx: "--bkm-pfx", same: "--bkm-psame" };

const PILL_SAME_MAX = 4;

/** bklit's XAxisLabel hides every tick whose label text equals the hovered row's label, whatever its distance. CSS cannot compare text,
 * so the host carries the x (svg px) of those ticks and the static rule below zeroes the tick sitting on one. */
export function writePillSameLabel(host: HTMLElement, tickTimes: readonly number[], time: number, px: (t: number) => number, names: PillHostNames = DEFAULT_PILL_NAMES): void {
  const label = shortDateFmt.format(time);
  let n = 0;
  for (const t of tickTimes) {
    if (n < PILL_SAME_MAX && t !== time && shortDateFmt.format(t) === label) {
      writeVar(host, `${names.same}${n}`, px(t).toFixed(2));
      n += 1;
    }
  }
  for (; n < PILL_SAME_MAX; n += 1) {
    clearVar(host, `${names.same}${n}`);
  }
}

/** What `syncPillHost` last wrote per host: an identical focus (same time, ticks and geometry) has nothing left to write. */
interface PillApplied {
  readonly time: number;
  readonly ticks: PillTicks;
  readonly spanMs: number;
  readonly plotWidth: number;
}
const pillApplied = new WeakMap<HTMLElement, PillApplied>();
const samePillFocus = (a: PillApplied | undefined, b: PillApplied): boolean =>
  a?.time === b.time && a.ticks === b.ticks && a.spanMs === b.spanMs && a.plotWidth === b.plotWidth;

/** Writes the focus x (svg px, from the ticks' `pillGeometry`) and active attribute for `pillTickStaticCss` onto the host. */
export function syncPillHost(host: HTMLElement, tickTimes: PillTicks, spanMs: number, plotWidth: number, time: number | null, index: number, names: PillHostNames = OWN_PILL_NAMES): void {
  const geo = tickTimes.pillGeometry;
  if (time === null || !geo || spanMs <= 0) {
    pillApplied.delete(host);
    clearAttribute(host, names.active);
    writePillRollIn(host, null, -1);
    return;
  }
  const next: PillApplied = { plotWidth, spanMs, ticks: tickTimes, time };
  // Pointer moves inside one point re-emit the same focus; the entry (`active` absent) always writes.
  if (samePillFocus(pillApplied.get(host), next) && host.hasAttribute(names.active)) {
    return;
  }
  pillApplied.set(host, next);
  if (!host.hasAttribute(names.active)) {
    writePillRollIn(host, geo.pill, index);
  }
  const px = (t: number): number => geo.plotLeft + ((t - geo.domainStart) / spanMs) * plotWidth;
  writeVar(host, names.fx, px(time).toFixed(2));
  writePillSameLabel(host, tickTimes, time, px, names);
  raiseAttribute(host, names.active);
}

/** Fixed-text pill tick rule: pill size is per-definition, focus x lives on the host as `--bkm-hx`, the fade is keyed on `data-bkm-hover`. Null without geometry.
 * Tick text and pill nodes are addressed through the key prefix / suffix (gap #36: no documented class or id hook). */
export function pillTickStaticCss(
  scope: string,
  tickTimes: PillTicks,
  reachPx: number,
  names: PillHostNames = DEFAULT_PILL_NAMES,
  keyPrefix = 'x-tick-label:',
): string | null {
  const geo = tickTimes.pillGeometry;
  if (!geo) {
    return null;
  }
  // bklit x-axis.tsx: opacity ramps linearly from tickerHalfWidth to +20px from the pointer, 0.4s ease-in-out.
  const sel = `${scope} text${keyStarts(keyPrefix)}`;
  const half = reachPx - 12;
  const same = Array.from({ length: PILL_SAME_MAX }, (_, i) => `calc((abs(attr(x type(<number>)) - var(${names.same}${i},-9999)) - .5) * 1000)`).join(", ");
  return [
    `${sel}${NOT_MOTION}{transition:opacity .4s ease-in-out}`,
    // The native axes paint above the pill (bklit's ticks sit under it): a tick inside the hidden zone drops to 0 at once instead of ghosting through the capsule for its 0.4s fade; typed attr() is Chromium-only (133+),
    // so both rules sit under `@supports` (unguarded, the var() keeps them past parsing and they are invalid at computed time: a 0s transition and `opacity:1!important`) and other browsers keep every tick visible.
    typedAttr([
    `${scope}[${names.active}] text${keyStarts(keyPrefix)}${NOT_MOTION}{transition-duration:calc(clamp(0, (abs(attr(x type(<number>)) - var(${names.fx},-9999)) - ${half}) * 1000, 1) * .4s)}`,
    // A tick within 0.5px of a same-label x is hidden outright (min with a 0 step), like bklit's `label === hoveredLabel` branch.
    `${scope}[${names.active}] text${keyStarts(keyPrefix)}{opacity:clamp(0, min(calc((abs(attr(x type(<number>)) - var(${names.fx},-9999)) - ${half}) / 20), ${same}), 1)!important}`,
    ].join("")),
  ].join("");
}

/** The pill layout a definition measured from its date labels, or null (native text-sized box). */
export const pillLayoutOf = (tickTimes: PillTicks): PillLayout | null => tickTimes.pillGeometry?.pill ?? null;

/** Tick times optionally carrying the x layout (plot left in svg px, domain start ms) for the CSS distance ramp. */
export type PillTicks = readonly number[] & { pillGeometry?: { plotLeft: number; domainStart: number; pill?: PillLayout | null } };

/** Attaches the x layout to the tick times (in place) so the pill's tick-opacity ramp can read it back with `pillLayoutOf`. */
export function withPillGeometry(times: number[], geometry: NonNullable<PillTicks["pillGeometry"]>): number[] & PillTicks {
  return Object.assign(times, { pillGeometry: geometry });
}

export { BKLIT_GUIDE_SPRING, guideMotion as pillGuideMotion } from "../motion/guide-motion";
