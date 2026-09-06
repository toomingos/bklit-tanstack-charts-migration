// BarPulse wave gradient stops (bell curve, brightest mid-wave).
// Pure data only; the imperative clip and sweep are deleted (V3.9, G14).

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

export { buildPulseWaveStops, MS_PER_SECOND, PULSE_WAVE_DURATION_S, PULSE_WAVE_PEAK_OPACITY };
export type { PulseWaveGradientStop };
