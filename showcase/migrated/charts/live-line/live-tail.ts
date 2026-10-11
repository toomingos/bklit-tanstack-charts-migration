// The live tail: the last two stretches of bklit's curve, which the keyed rolling path cannot carry (it ends at N-1, see smoothRows).
// A: N-1 -> N (cubic, flat tangent at N). B: N -> dot (smoothstep the display lerp flattens). Moved by live-css.ts CSS animations, no per-frame JS.
import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";

export interface LiveTailOptions {
  readonly id: string;
  /** Flips each tick: the class change restarts the CSS animations on the persistent nodes. */
  readonly parity: number;
  /** Sample N-1 (end of the rolling path) and its final tangent in value per ms. */
  readonly aT: number;
  readonly aV: number;
  readonly aSlope: number;
  /** Newest sample N. */
  readonly bT: number;
  readonly bV: number;
  /** Lerped display value when N arrived (where the dot is at the start of this tick). */
  readonly dispV: number;
  /** The dot's clock time. */
  readonly tipT: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly strokeOpacity: number;
  readonly areaFloor: number;
  /** The fill colour; undefined hides it. Pieces are painted opaque inside one group carrying the area's `fillOpacity` and bklit's vertical fade (svg-space mask, liveline.css), so overlapping pieces composite as one surface;
   * each is outlined in its own colour by half the line width to close sub-pixel joins. Under A and the rolling path's last stretch (`lead`); under B a wedge plus the block below the lower end, whose top follows the dot. */
  readonly fill?: string;
  readonly fillOpacity: number;
  /** The rolling path's points just before sample N-1 (time, value), ending at N-1. */
  readonly lead: readonly (readonly [number, number])[];
  /** Still (seed frame): the end-of-roll state, no animation. */
  readonly still: boolean;
}

/** Chord error of 8 segments on a 20-40px curve is far below a pixel. */
const STEPS = 8;

const wrap = (key: string, nodes: SceneNode[]): SceneNode => ({ kind: "group", key, className: "bkm-live-rp", children: nodes });

export function liveTail(options: LiveTailOptions): ChartMark<unknown, Date, number> {
  const { id, parity, aT, aV, aSlope, bT, bV, dispV, tipT, stroke, strokeWidth, strokeOpacity, areaFloor, fill, fillOpacity, lead, still } = options;
  return createMark<unknown, Date, number>(() => ({
    id,
    channels: {},
    render: ({ scales }) => {
      const sx = (t: number): number => scales.x.map(new Date(t));
      const sy = (v: number): number => scales.y.map(v);
      const xa = sx(aT);
      const xb = sx(bT);
      const xd = sx(tipT);
      const ya = sy(aV);
      const yb = sy(bV);
      const yd = sy(dispV);
      const yf = sy(areaFloor);
      if (![xa, xb, xd, ya, yb, yd, yf].every(Number.isFinite) || xb <= xa) {
        return { nodes: [] };
      }
      const h = bT - aT;
      const curveA: [number, number][] = [];
      for (let i = 0; i <= STEPS; i += 1) {
        const u = i / STEPS;
        const u2 = u * u;
        const u3 = u2 * u;
        const v = (2 * u3 - 3 * u2 + 1) * aV + (u3 - 2 * u2 + u) * h * aSlope + (-2 * u3 + 3 * u2) * bV;
        curveA.push([xa + (xb - xa) * u, sy(v)]);
      }
      const curveB: [number, number][] = [];
      for (let i = 0; i <= STEPS; i += 1) {
        const u = i / STEPS;
        curveB.push([xb + (xd - xb) * u, yb + (yd - yb) * (3 * u * u - 2 * u * u * u)]);
      }
      const motion = still ? " bkm-live-tail--still" : "";
      const fills: SceneNode[] = [];
      const paint = { fill, fillOpacity: 1, stroke: fill, strokeWidth, lineJoin: "round" } as const;
      if (fill !== undefined && fill !== "") {
        const leadPx = lead.slice(0, -1).flatMap(([t, v]): [number, number][] => {
          const x = sx(t);
          const y = sy(v);
          return Number.isFinite(x) && Number.isFinite(y) ? [[x, y]] : [];
        });
        // The path's last stretch only translates with it; A's own piece also stretches (its right end enters at the dot).
        if (leadPx.length > 0) {
          fills.push({
            kind: "area",
            key: `${id}:area-l`,
            className: `bkm-live-tail-l${motion}`,
            points: [...leadPx, [xa, sy(aV)], [xa, yf], [leadPx[0]?.[0] ?? xa, yf]],
            style: paint,
          });
        }
        fills.push({
          kind: "area",
          key: `${id}:area-a`,
          className: `bkm-live-tail-a${motion}`,
          points: [...curveA, [xb, yf], [xa, yf]],
          style: paint,
        });
      }
      // B's fill: bklit's area follows the curve to the dot. The wedge scales with the line about N's level; the block below
      // has its top edge on the dot, linear in the line's scale (liveline.css).
      const down = yd >= yb;
      if (fill !== undefined && fill !== "" && Math.abs(yd - yb) > 0.25) {
        fills.push({
          kind: "area",
          key: `${id}:area-w`,
          className: `bkm-live-tail-b ${down ? "bkm-live-tail-b--down" : "bkm-live-tail-b--up"}${motion}`,
          points: [...curveB, down ? [xb, yd] : [xd, yb]],
          style: paint,
        });
      }
      if (fill !== undefined && fill !== "") {
        const top = Math.max(yb, yd);
        fills.push({
          kind: "area",
          key: `${id}:area-k`,
          className: `${down ? "bkm-live-tail-k" : "bkm-live-tail-x"}${motion}`,
          points: [[xb, top], [xd, top], [xd, yf], [xb, yf]],
          style: paint,
        });
      }
      const style = { stroke, strokeOpacity, strokeWidth, fill: "none", lineCap: "round", lineJoin: "round" } as const;
      // The pieces ride the path's y reprojection (live-css.ts) inside a wrapper, so the fill group's mask and cut (liveline.css), which
      // are laid out in the svg and must not move, stay outside the transform.
      const children: SceneNode[] = fills.length > 0 ? [{ kind: "group", key: `${id}:fill`, className: "bkm-live-fill", style: { opacity: fillOpacity }, children: [wrap(`${id}:fill-rp`, fills)] }] : [];
      const lines: SceneNode[] = [
        { kind: "polyline", key: `${id}:line-a`, className: `bkm-live-tail-a${motion}`, points: curveA, style },
        {
          kind: "polyline",
          key: `${id}:line-b`,
          className: `bkm-live-tail-b ${yd >= yb ? "bkm-live-tail-b--down" : "bkm-live-tail-b--up"}${motion}`,
          points: curveB,
          style,
        },
      ];
      children.push(wrap(`${id}:line-rp`, lines));
      return { nodes: [{ kind: "group", key: id, className: `bkm-live-tail bkm-tp${parity}`, ariaHidden: true, children }], points: [] };
    },
  }), false);
}
