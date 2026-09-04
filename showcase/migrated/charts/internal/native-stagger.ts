// Synthetic ChartMotionContext for TanStack stagger(): only phase/datumIndex are read;
// The rest are inert placeholders (no caller passes by:'series' or roles).
import { stagger as nativeStagger } from "@tanstack/charts/motion/definition";
import type { ChartMotionContext, ChartMotionRole } from "@tanstack/charts";

const isNumber = <Subject>(value: Subject): value is Subject & number => typeof value === "number";

// Offset + each*index via native stagger(); caller pre-resolves milliseconds.
export const nativeStaggerDelayMs = (each: number, offset: number, index: number, role: ChartMotionRole = "mark"): number => {
  const { delay } = nativeStagger({ each, offset });
  const context: ChartMotionContext = {
    datum: undefined,
    datumCount: 0,
    datumIndex: index,
    key: String(index),
    phase: "enter",
    point: undefined,
    role,
    seriesIndex: index,
    seriesKey: "",
  };
  if (delay === undefined) {
    return 0;
  }
  return isNumber(delay) ? delay : (delay(context) ?? 0);
}
