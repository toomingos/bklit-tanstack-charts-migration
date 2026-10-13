import type { CSSProperties, ReactElement } from "react";
import type { Frame } from "./live-frame";

/** The pulse ring's slices of its 1.5 s cycle (see LivePulse). */
const SLICES = 12;
/** bklit's ring: r from dotSize to dotSize * 3.5 and opacity 0.5 -> 0 over 1.5 s, linear, stroke 1.5 (live-line.tsx:250-275). */
const REACH = 3.5;
const STROKE = 1.5;
const PERIOD_MS = 1500;
const OPACITY_FROM = 0.5;
/** A hard edge between slices, as a share of the cycle. */
const EDGE = 0.0005;

const LAYER_STYLE: CSSProperties = { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" };

/** The ring's keyframes and slice boxes for a dot size. Slice k covers progress k/SLICES..(k+1)/SLICES of the cycle: a box laid out at the slice's end radius, border STROKE, scaled from the slice's start radius
 * to 1 while its opacity follows the cycle's linear fade, hidden for the rest of the cycle. */
function pulseCss(dotSize: number): string {
  const rules: string[] = [];
  for (let k = 0; k < SLICES; k += 1) {
    const p0 = k / SLICES;
    const p1 = (k + 1) / SLICES;
    const r1 = dotSize * (1 + (REACH - 1) * p1);
    const s0 = (1 + (REACH - 1) * p0) / (1 + (REACH - 1) * p1);
    const a0 = OPACITY_FROM * (1 - p0);
    const a1 = OPACITY_FROM * (1 - p1);
    const pct = (p: number): string => `${Math.round(p * 1e5) / 1e3}%`;
    const hidden = `opacity:0;scale:${s0}`;
    rules.push(
      `@keyframes bkm-pr${k}{0%{${hidden}}${k > 0 ? `${pct(p0 - EDGE)}{${hidden}}` : ""}${pct(p0)}{opacity:${a0};scale:${s0}}${pct(p1)}{opacity:${a1};scale:1}${k < SLICES - 1 ? `${pct(p1 + EDGE)}{opacity:0;scale:1}` : ""}100%{opacity:0;scale:1}}`,
      // The border-box reaches half a stroke past the ring's radius, so the border's centre line sits on it as an svg stroke does.
      `.bkm-pr${k}{width:${2 * r1 + STROKE}px;height:${2 * r1 + STROKE}px;margin:${-(r1 + STROKE / 2)}px 0 0 ${-(r1 + STROKE / 2)}px;animation:bkm-pr${k} ${PERIOD_MS}ms linear infinite}`,
    );
  }
  return rules.join("\n");
}

interface LivePulseProps {
  readonly frame: Frame;
  readonly color: string;
  readonly dotSize: number;
  readonly width: number;
  readonly innerHeight: number;
  readonly margin: { readonly top: number; readonly right: number; readonly left: number };
}

/** bklit's pulse ring (live-line.tsx:250-275, an SVG <animate> of r and opacity that runs at display rate) as HTML over the chart. Every animation on an SVG child runs on the main thread and keeps
 * a frame per vsync (idle share, METRICS.md); on an HTML box, `scale` and `opacity` run on the compositor. A box scales its border with it, so the cycle is cut into SLICES boxes that each scale over a short
 * radius span (the stroke stays within a quarter pixel of 1.5), shown one after the other.
 * The wrapper takes the tip's own motion (live-css.ts: the head settle `bkm-dy` and the roll's `bkm-rd`) on the tip's parity class, so the ring stays on the dot; the ring's cycle is not restarted by it (bklit's SMIL ring is
 * not either). The mask cuts the dot's outer edge (r + half its 2px stroke) out of the ring, which bklit paints beneath the dot. The first roll (the tip tweens through the renderer) shows no ring. */
export const LivePulse = ({ frame, color, dotSize, width, innerHeight, margin }: LivePulseProps): ReactElement | null => {
  const tip = frame.tip;
  if (tip === undefined || frame.intro || frame.seed) {
    return null;
  }
  const [x0, x1] = frame.xDomain;
  const [y0, y1] = frame.yDomain;
  const x = margin.left + ((tip.t - x0) / (x1 - x0 || 1)) * (width - margin.left - margin.right);
  const y = margin.top + ((y1 - tip.v) / (y1 - y0 || 1)) * innerHeight;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const hole = dotSize + 1;
  const box = 2 * REACH * dotSize + 4;
  return (
    <div aria-hidden="true" data-bkm-live-pulse="" style={LAYER_STYLE}>
      <style>{pulseCss(dotSize)}</style>
      <div className={`bkm-live-pulse-ov bkm-dp${frame.parity}`} style={{ left: x, top: y }}>
        <div className="bkm-pr-mask" style={{ width: box, height: box, margin: -box / 2, maskImage: `radial-gradient(circle at center, transparent ${hole - 0.25}px, #000 ${hole + 0.25}px)`, color }}>
          {Array.from({ length: SLICES }, (_, k) => (
            <div key={k} className={`bkm-pr bkm-pr${k}`} />
          ))}
        </div>
      </div>
    </div>
  );
};
