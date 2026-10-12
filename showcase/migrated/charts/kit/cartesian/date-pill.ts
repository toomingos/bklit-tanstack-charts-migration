// Date-pill support shared by every time-x chart: the measured pill layout, the tick-blanking CSS under the pill, host sync, and the focus-guide helpers
// live-line and segment marks still use. The pill itself is drawn by hover-overlay.ts.
import { createMark } from "@tanstack/charts";
import type { ChartBounds, ChartGradient, ChartMotionDefinition, ResolvedScale, SceneNode } from "@tanstack/charts";
import { erase } from "../erased-types";
import type { AnyMark } from "../erased-types";
import { shortDateFmt } from "../format";
import { fontContext } from "../text-width";
import { typedAttr } from "../css-hooks";
import { CROSSHAIR_CLASS, NOT_MOTION, keyStarts } from "../renderer-dom";
import { clearAttribute, clearVar, raiseAttribute, writeVar } from "../host-write";

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
export function syncPillHost(host: HTMLElement, tickTimes: PillTicks, spanMs: number, plotWidth: number, time: number | null, names: PillHostNames = OWN_PILL_NAMES): void {
  const geo = tickTimes.pillGeometry;
  if (time === null || !geo || spanMs <= 0) {
    pillApplied.delete(host);
    clearAttribute(host, names.active);
    return;
  }
  const next: PillApplied = { plotWidth, spanMs, ticks: tickTimes, time };
  // Pointer moves inside one point re-emit the same focus; the entry (`active` absent) always writes.
  if (samePillFocus(pillApplied.get(host), next) && host.hasAttribute(names.active)) {
    return;
  }
  pillApplied.set(host, next);
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

/** Tick times optionally carrying the x layout (plot left in svg px, domain start ms) for the CSS distance ramp. */
export type PillTicks = readonly number[] & { pillGeometry?: { plotLeft: number; domainStart: number } };

/** Attaches the x layout to the tick times (in place) so the pill's tick-opacity ramp can read it back. */
export function withPillGeometry(times: number[], geometry: NonNullable<PillTicks["pillGeometry"]>): number[] & PillTicks {
  return Object.assign(times, { pillGeometry: geometry });
}
