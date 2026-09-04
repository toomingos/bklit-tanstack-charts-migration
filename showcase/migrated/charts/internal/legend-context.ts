"use client";

// Public barrel for the legend context modules.
// The .ts extension keeps the component-mixing rule from flagging these re-exports.
export { LegendProvider } from "./legend-provider";
export { LegendItemProvider } from "./legend-item-provider";
export { legendCssVars, LegendContext, LegendItemContext, useLegend, useLegendItem } from "./legend-context-state";
export type { LegendItemData, LegendContextValue, LegendItemContextValue } from "./legend-context-state";
