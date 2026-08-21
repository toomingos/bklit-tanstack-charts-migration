# Initiative 5 Audit

Status: open, not ready for gating.

Evidence: Line/Area/Composed use native group-x, while Bar, Scatter, and Candlestick have separate focus strategies and LiveLine bypasses TanStack focus. Phase refs/setters are duplicated across chart files; no shared scheduled tooltip or phase orchestrator exists. TanStack public `spatialIndex` is available but unused. Rendered-DOM interaction paths violate `00-layer-contract.md`.
