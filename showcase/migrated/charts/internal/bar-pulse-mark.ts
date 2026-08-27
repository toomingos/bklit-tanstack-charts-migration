import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import { barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import type { ChartDatum } from "./types";

export const PULSE_WAVE_HEIGHT_RATIO = 0.55;
export const PULSE_WAVE_HEIGHT_MIN_PX = 36;
export const PULSE_WAVE_DURATION_S = 2.4;
export const PULSE_WAVE_PEAK_OPACITY = 0.85;

// bklit bar-depth.tsx BarPulse wave gradient — vertical bell curve with a
// centered bright band (y1=1, y2=0 makes offset 50% the rect's center, so the
// brightest pixel sits mid-rect during travel). Ported verbatim; the
// <linearGradient> def itself is built by bar-chart.tsx's depth defs svg
// (house pattern — the app runtime's plain SVG renderer emits no
// spec.gradients defs, so fills reference host-built url(#id) gradients).
export interface PulseWaveGradientStop {
  offset: string;
  color: string;
  opacity: string;
}

export function buildPulseWaveStops(): PulseWaveGradientStop[] {
  return [
    { offset: "0%", color: "white", opacity: "0" },
    { offset: "10%", color: "white", opacity: "0" },
    { offset: "22%", color: "white", opacity: String(PULSE_WAVE_PEAK_OPACITY * 0.18) },
    { offset: "34%", color: "white", opacity: String(PULSE_WAVE_PEAK_OPACITY * 0.5) },
    { offset: "44%", color: "white", opacity: String(PULSE_WAVE_PEAK_OPACITY * 0.85) },
    { offset: "50%", color: "white", opacity: String(PULSE_WAVE_PEAK_OPACITY) },
    { offset: "56%", color: "white", opacity: String(PULSE_WAVE_PEAK_OPACITY * 0.85) },
    { offset: "66%", color: "white", opacity: String(PULSE_WAVE_PEAK_OPACITY * 0.5) },
    { offset: "78%", color: "white", opacity: String(PULSE_WAVE_PEAK_OPACITY * 0.18) },
    { offset: "90%", color: "white", opacity: "0" },
    { offset: "100%", color: "white", opacity: "0" },
  ];
}

export function buildBarSilhouettePath(
  bandX: number,
  bandWidth: number,
  topY: number,
  bottomY: number,
  depth: number,
  perspectiveRise: number,
  isRightOfCenter: boolean,
): string {
  if (depth <= 0) {
    return [`M ${bandX} ${topY}`, `L ${bandX + bandWidth} ${topY}`, `L ${bandX + bandWidth} ${bottomY}`, `L ${bandX} ${bottomY}`, "Z"].join(" ");
  }
  if (isRightOfCenter) {
    return [
      `M ${bandX - depth} ${topY - perspectiveRise}`,
      `L ${bandX + bandWidth - depth} ${topY - perspectiveRise}`,
      `L ${bandX + bandWidth} ${topY}`,
      `L ${bandX + bandWidth} ${bottomY}`,
      `L ${bandX} ${bottomY}`,
      `L ${bandX - depth} ${bottomY - perspectiveRise}`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${bandX} ${topY}`,
    `L ${bandX + depth} ${topY - perspectiveRise}`,
    `L ${bandX + bandWidth + depth} ${topY - perspectiveRise}`,
    `L ${bandX + bandWidth + depth} ${bottomY - perspectiveRise}`,
    `L ${bandX + bandWidth} ${bottomY}`,
    `L ${bandX} ${bottomY}`,
    "Z",
  ].join(" ");
}

export interface BarPulseMarkOptions {
  id: string;
  data: ChartDatum[];
  bandWidth: number;
  bandScale?: { step?: () => number };
  bandPos: (label: string) => number;
  categoryAccessor: (d: ChartDatum) => string;
  yAccessor: (d: ChartDatum) => number;
  activeIndex?: number;
  pulsePaused?: boolean;
  /** Id of the host-built wave linearGradient def (see buildPulseWaveStops). */
  gradientId: string;
}

export function barPulseMark(
  data: ChartDatum[],
  options: BarPulseMarkOptions,
): ChartMark<ChartDatum, string, number> | null {
  const { id, bandWidth, bandScale, bandPos, categoryAccessor, yAccessor, activeIndex, pulsePaused, gradientId } = options;
  if (pulsePaused) return null;
  if (activeIndex == null || !Number.isFinite(activeIndex)) return null;
  if (activeIndex < 0 || activeIndex >= data.length) return null;
  return createMark(() => {
    const xValues = data.map((d) => categoryAccessor(d));
    const yValues = data.map((d) => yAccessor(d));
    return {
      id,
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: yValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
          includeZero: true,
        },
      },
      render: ({ scales, chart }) => {
        const baseline = scales.y.map(0);
        const yScale = scales.y;
        const innerWidth = chart.width;
        const centerX = chart.x + innerWidth / 2;
        const step = (bandScale as unknown as { step?: () => number })?.step?.() ?? bandWidth;
        const maxDepth = barDepthMaxDepth(step, bandWidth);
        const i = activeIndex;
        const datum = data[i];
        if (!datum) return { nodes: [], points: [] };
        const yValue = yValues[i];
        if (typeof yValue !== "number" || !Number.isFinite(yValue) || yValue <= 0) return { nodes: [], points: [] };
        const valuePos = yScale.map(yValue);
        if (!Number.isFinite(valuePos)) return { nodes: [], points: [] };
        const barLengthPx = baseline - valuePos;
        if (barLengthPx <= 0) return { nodes: [], points: [] };
        const xValue = xValues[i]!;
        const bandX = bandPos(String(xValue));
        const cx = bandX + bandWidth / 2;
        const offsetFromCenter = innerWidth > 0 ? (cx - centerX) / (innerWidth / 2) : 0;
        const isRightOfCenter = offsetFromCenter > 0;
        const absOffset = Math.min(1, Math.abs(offsetFromCenter));
        const { depth, perspectiveRise } = barDepthAndRise(absOffset, barLengthPx, maxDepth);
        const topY = valuePos;
        const bottomY = baseline;
        const barHeight = bottomY - topY;
        const silhouettePath = buildBarSilhouettePath(bandX, bandWidth, topY, bottomY, depth, perspectiveRise, isRightOfCenter);
        const waveHeight = Math.max(barHeight * PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_HEIGHT_MIN_PX);
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__bar-pulse",
              ariaHidden: true,
              children: [
                // Invisible silhouette — read back by syncBarPulseGroups as the
                // clipPath source (the scene layer has no clipPath node type).
                {
                  kind: "area",
                  key: `${id}:silhouette`,
                  points: [],
                  path: silhouettePath,
                  style: { fill: "none" },
                } as SceneNode,
                // Wave band parked at its sweep START (the bar's bottom edge),
                // spanning bar + depth like legacy's rect (the clip crops the
                // overflow). syncBarPulseGroups clips it to the silhouette and
                // starts the WAAPI translateY loop once the reveal completes.
                {
                  kind: "rect",
                  key: `${id}:wave`,
                  x: bandX - depth - 1,
                  y: bottomY,
                  width: bandWidth + 2 * depth + 2,
                  height: waveHeight,
                  style: { fill: `url(#${gradientId})` },
                } as SceneNode,
              ],
            },
          ],
        };
      },
    };
  });
}

// ─── Pulse loop wiring ────────────────────────────────────────────────
//
// The wave's clip + infinite WAAPI sweep cannot live in the scene. `SceneGroup`
// DOES carry a `clip?: ChartBounds` (types.d.ts:853) and the SVG renderer emits
// a real `<defs><clipPath><rect>` for it (svg-renderer.js:81) — but that clip is
// rectangular only, and the wave needs the bar silhouette's polygon (D381). On
// top of that the identity-based reconciler wipes injected nodes/attributes on
// every render. So — like the per-bar
// reveal tweens — the loop is owned imperatively: syncBarPulseGroups is
// re-invoked after every chart render (bar-chart.tsx handleRender) and on
// every phase flip, reads the geometry back off the scene-emitted nodes, and
// (re)applies three things: the injected <clipPath> def, the group's
// clip-path attribute, and ONE WAAPI translateY loop per group. The loop is
// recreated only when the silhouette/rect geometry actually changes.
//
// Visibility parity with legacy BarPulse (repos/bklit-ui …/bar-depth.tsx):
// held until the bars finish growing (`isLoaded` → here: chart phase
// "ready"), frozen/absent under `pulsePaused` (the mark returns null, so the
// whole group disappears). Legacy has no prefers-reduced-motion branch — the
// loop intentionally honors none either.

const SVG_NS = "http://www.w3.org/2000/svg";

interface BarPulseLoopState {
  anim: Animation | null;
  geomKey: string | null;
}

const loopStates = new WeakMap<SVGGElement, BarPulseLoopState>();
// Clip ids are document-global; a per-<svg> sequence keeps them unique so two
// charts on one page can't collide. Stored on the retained svg root itself,
// so a given svg keeps its slot for its lifetime.
let pulseClipSeq = 0;

function sanitizeIdToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function ensurePulseClipDef(svg: SVGSVGElement, group: SVGGElement, clipD: string): string {
  let seq = svg.dataset.bkmPulseSeq;
  if (!seq) {
    pulseClipSeq += 1;
    seq = String(pulseClipSeq);
    svg.dataset.bkmPulseSeq = seq;
  }
  const groupKey = sanitizeIdToken(group.getAttribute("data-ts-key") ?? "pulse");
  const clipId = `bkm-pulse-clip-${seq}-${groupKey}`;
  let defs = group.querySelector<SVGDefsElement>(":scope > defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement;
    group.insertBefore(defs, group.firstChild);
  }
  let clipPath = defs.querySelector<SVGClipPathElement>(`:scope > #${CSS.escape(clipId)}`);
  if (!clipPath) {
    clipPath = document.createElementNS(SVG_NS, "clipPath") as SVGClipPathElement;
    clipPath.id = clipId;
    clipPath.appendChild(document.createElementNS(SVG_NS, "path"));
    defs.appendChild(clipPath);
  }
  const clipShape = clipPath.querySelector<SVGPathElement>("path");
  if (clipShape && clipShape.getAttribute("d") !== clipD) clipShape.setAttribute("d", clipD);
  return clipId;
}

/** Topmost y in the silhouette path (= lid's back edge) — the sweep's END
 * anchor. Our own generator emits absolute M/L pairs, so y coords sit at
 * odd token indices. */
function silhouetteMinY(clipD: string): number {
  let minY = Number.POSITIVE_INFINITY;
  const nums = clipD.match(/-?\d*\.?\d+/g) ?? [];
  for (let i = 1; i < nums.length; i += 2) {
    const v = Number.parseFloat(nums[i]!);
    if (Number.isFinite(v) && v < minY) minY = v;
  }
  return minY;
}

/**
 * Re-apply clip + sweep to every `.ts-chart__bar-pulse` group under `host`.
 * Called from every bar-chart.tsx handleRender exit path and on phase flips.
 * `active` is false while a reveal is in flight — groups stay hidden and
 * their loops cancelled (legacy holds the wave until bars finish growing).
 *
 * Geometry is validated BEFORE the group is un-hidden: a sync that can't
 * find the scene-emitted silhouette/wave yet (reconciler mid-rebuild race)
 * leaves the group safely hidden and schedules a next-frame retry, so an
 * unclipped wave rect can never paint outside the bar.
 */
const pendingRetries = new WeakMap<ParentNode, { count: number }>();

function schedulePulseRetry(host: ParentNode, active: boolean): void {
  let box = pendingRetries.get(host);
  if (!box) {
    box = { count: 0 };
    pendingRetries.set(host, box);
  }
  // Bounded: a genuinely-gone chart stops retrying after a few frames.
  if (box.count >= 10) return;
  box.count += 1;
  requestAnimationFrame(() => {
    box!.count = 0;
    syncBarPulseGroups(host, active);
  });
}

export function syncBarPulseGroups(host: ParentNode, active: boolean): void {
  const svgs = host.querySelectorAll<SVGSVGElement>("svg.ts-chart");
  svgs.forEach((svg) => {
    const groups = svg.querySelectorAll<SVGGElement>("g.ts-chart__bar-pulse");
    groups.forEach((group) => {
      let state = loopStates.get(group);
      if (!state) {
        state = { anim: null, geomKey: null };
        loopStates.set(group, state);
      }
      if (!active) {
        if (state.anim) {
          state.anim.cancel();
          state.anim = null;
          state.geomKey = null;
        }
        group.style.display = "none";
        return;
      }
      const silhouette = group.querySelector<SVGPathElement>(`path[data-ts-key$=":silhouette"]`);
      const wave = group.querySelector<SVGRectElement>(`rect[data-ts-key$=":wave"]`);
      if (!silhouette || !wave) {
        // Scene children not resolvable yet — stay hidden, heal next frame.
        schedulePulseRetry(host, true);
        return;
      }
      const clipD = silhouette.getAttribute("d") ?? "";
      const waveX = Number.parseFloat(wave.getAttribute("x") ?? "0");
      const waveY = Number.parseFloat(wave.getAttribute("y") ?? "0");
      const waveH = Number.parseFloat(wave.getAttribute("height") ?? "0");
      if (!clipD || !Number.isFinite(waveY) || !Number.isFinite(waveH) || waveH <= 0) {
        schedulePulseRetry(host, true);
        return;
      }
      group.style.display = "";
      const minY = silhouetteMinY(clipD);
      // Travel flows root → tip: from the parked start (bar bottom edge) up
      // to just above the lid's back edge (negative delta). ease-in-out +
      // Infinity mirrors legacy's motion transition exactly.
      const yEnd = (Number.isFinite(minY) ? minY : waveY) - waveH;
      const travel = yEnd - waveY;
      const geomKey = `${clipD}|${waveX}|${waveY}|${waveH}`;
      const clipId = ensurePulseClipDef(svg, group, clipD);
      const desiredClip = `url(#${clipId})`;
      if (group.getAttribute("clip-path") !== desiredClip) group.setAttribute("clip-path", desiredClip);
      if (state.geomKey === geomKey && state.anim) return;
      state.anim?.cancel();
      state.anim = wave.animate(
        [{ transform: "translateY(0px)" }, { transform: `translateY(${travel}px)` }],
        { duration: PULSE_WAVE_DURATION_S * 1000, easing: "ease-in-out", iterations: Infinity },
      );
      state.geomKey = geomKey;
    });
  });
}
