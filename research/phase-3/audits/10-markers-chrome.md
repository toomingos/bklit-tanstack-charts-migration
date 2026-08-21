# Initiative 10 Audit

Status: open, not ready for gating.

Evidence: migrated code has no ChartMarkers, SeriesMarkers, highlight layer, dash-tail overlay, or LineSeriesTerminalMarker. Scatter's stock `dot` plus bespoke hover chrome is only partial. Native `dot`/`createMark`/focus can provide the backend, but bklit marker API, reveal timing, dim/blur, active highlight, fan geometry, post-overlay ordering, and terminal marker parity remain.
