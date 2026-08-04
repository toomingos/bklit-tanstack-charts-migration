// Shared focus-disabled strategy — charts that have zero pointer/tooltip
// interaction but still need to disable TanStack's pointer-focus engine.
// charts-core has an identical internal `focusDisabled` (focus-disabled.ts)
// it doesn't export. Left untyped so the `() => []` members stay assignable
// to every `ChartFocusStrategy` instantiation (the alias's generics are
// invariant). Used by radar-chart.tsx and gauge.tsx.

export const FOCUS_DISABLED = {
  resolve: () => [],
  group: () => [],
  navigation: () => [],
};
