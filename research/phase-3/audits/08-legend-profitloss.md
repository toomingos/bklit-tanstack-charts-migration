# Initiative 8 Audit

Status: open, not ready for gating.

Evidence: migrated code has no cartesian Legend, ChartLegend, legend-hover provider, ProfitLossLine, or ProfitLossLegend. TanStack `colorLegend()`/`colorGradientLegend()` covers backend legend semantics, but bklit HTML composition, progress/value renderers, hover dimming, and Profit/Loss zero-crossing segmentation require one design-layer adapter.
