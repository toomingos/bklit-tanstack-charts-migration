const SVG_NS = "http://www.w3.org/2000/svg";

const PULSE_WAVE_DURATION_S = 2.4;
const MS_PER_SECOND = 1000;
const PULSE_WAVE_PEAK_OPACITY = 0.85;
// Bell-curve falloff fractions of peak opacity at the outer/mid/inner wave stops.
const PULSE_WAVE_OUTER_FALLOFF_RATIO = 0.18;
const PULSE_WAVE_MID_FALLOFF_RATIO = 0.5;
const PULSE_WAVE_INNER_FALLOFF_RATIO = 0.85;

// Bklit bar-depth.tsx BarPulse wave gradient (vertical bell curve, brightest at mid-rect during travel).
interface PulseWaveGradientStop {
  readonly offset: string;
  readonly color: string;
  readonly opacity: string;
}

const buildPulseWaveStops = (): PulseWaveGradientStop[] => [
    { color: "white", offset: "0%", opacity: "0" },
    { color: "white", offset: "10%", opacity: "0" },
    { color: "white", offset: "22%", opacity: String(PULSE_WAVE_PEAK_OPACITY * PULSE_WAVE_OUTER_FALLOFF_RATIO) },
    { color: "white", offset: "34%", opacity: String(PULSE_WAVE_PEAK_OPACITY * PULSE_WAVE_MID_FALLOFF_RATIO) },
    { color: "white", offset: "44%", opacity: String(PULSE_WAVE_PEAK_OPACITY * PULSE_WAVE_INNER_FALLOFF_RATIO) },
    { color: "white", offset: "50%", opacity: String(PULSE_WAVE_PEAK_OPACITY) },
    { color: "white", offset: "56%", opacity: String(PULSE_WAVE_PEAK_OPACITY * PULSE_WAVE_INNER_FALLOFF_RATIO) },
    { color: "white", offset: "66%", opacity: String(PULSE_WAVE_PEAK_OPACITY * PULSE_WAVE_MID_FALLOFF_RATIO) },
    { color: "white", offset: "78%", opacity: String(PULSE_WAVE_PEAK_OPACITY * PULSE_WAVE_OUTER_FALLOFF_RATIO) },
    { color: "white", offset: "90%", opacity: "0" },
    { color: "white", offset: "100%", opacity: "0" },
  ];

// Per-<svg> clip-id sequence: ids are document-global, so two charts can't collide.
let pulseClipSeq = 0;

const sanitizeIdToken = (value: string): string => value.replaceAll(/[^a-zA-Z0-9_-]/gu, "");

// Clip-id sequence for one SVG root; hoisted so ensurePulseClipDef stays short.
const ensurePulseClipSeq = (svg: SVGSVGElement): string => {
  let seq = svg.dataset.bkmPulseSeq;
  if (seq === undefined || seq === "") {
    pulseClipSeq += 1;
    seq = String(pulseClipSeq);
    svg.dataset.bkmPulseSeq = seq;
  }
  return seq;
};

interface PulseClipPathArgs {
  readonly defs: SVGDefsElement;
  readonly clipId: string;
  readonly clipD: string;
}

// ClipPath node for one group, created on first sync and kept current. Hoisted so ensurePulseClipDef stays short.
const ensurePulseClipPath = (clipArgs: Readonly<PulseClipPathArgs>): void => {
  let clipPath = clipArgs.defs.querySelector<SVGClipPathElement>(`:scope > #${CSS.escape(clipArgs.clipId)}`);
  if (!clipPath) {
    clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.id = clipArgs.clipId;
    clipPath.append(document.createElementNS(SVG_NS, "path"));
    clipArgs.defs.append(clipPath);
  }
  const clipContour = clipPath.querySelector<SVGPathElement>("path");
  if (clipContour && clipContour.getAttribute("d") !== clipArgs.clipD) {clipContour.setAttribute("d", clipArgs.clipD);}
};

const ensurePulseClipDef = (svg: SVGSVGElement, group: SVGGElement, clipD: string): string => {
  const seq = ensurePulseClipSeq(svg);
  const groupKey = sanitizeIdToken(group.dataset.tsKey ?? "pulse");
  const clipId = `bkm-pulse-clip-${seq}-${groupKey}`;
  let defs = group.querySelector<SVGDefsElement>(":scope > defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    group.prepend(defs);
  }
  ensurePulseClipPath({ clipD, clipId, defs });
  return clipId;
};

export { buildPulseWaveStops, ensurePulseClipDef, MS_PER_SECOND, PULSE_WAVE_DURATION_S, PULSE_WAVE_PEAK_OPACITY };
export type { PulseWaveGradientStop };
