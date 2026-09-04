import { CHART_CATEGORY_PALETTE } from "./design-tokens";

// 5-entry palette, not TanStack's native 6: a 6-cycle desyncs after index 5.
const defaultPieColors: readonly string[] = CHART_CATEGORY_PALETTE;

export { defaultPieColors };
