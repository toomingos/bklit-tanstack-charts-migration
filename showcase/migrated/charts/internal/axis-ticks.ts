// Pure tick-choice math feeding the native axis pipeline (no DOM, no React).
// Even-spacing layout search lives in tick-layout.ts.
// X-axis value builders live in x-axis-tick-values.ts.
// Axis and scale option builders live in axis-scale-options.ts.
// This module keeps bar label thinning and re-exports the full public surface so existing importers are untouched.

/** Modulo thinning (`step = ceil(count/maxLabels)`); deliberately not the even-spacing optimizer. */
const selectBarLabelIndices = (count: number, showAllLabels: boolean, maxLabels = 12): number[] => {
  const all = Array.from({ length: count }, (_unused, index) => index);
  if (showAllLabels || count <= maxLabels) {return all;}
  const step = Math.ceil(count / maxLabels);
  return all.filter((index) => index % step === 0);
}

export { selectEvenlySpacedIndices } from "./tick-layout";
export { buildXAxisTickValues } from "./x-axis-tick-values";
export type { XAxisTickInput, XAxisTickValue } from "./x-axis-tick-values";
export { formatYAxisTick, buildYAxisTickValues, tickLabelFadeOpacity, buildFadeXAxisOptions, buildPrecomputedXAxisOptions, buildYAxisOptions, hiddenAxisOptions } from "./axis-scale-options";
export type { XAxisPresentation } from "./axis-scale-options";
export { selectBarLabelIndices };
