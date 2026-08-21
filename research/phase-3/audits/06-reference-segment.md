# Initiative 6 Audit

Status: open, not ready for gating.

Evidence: bklit ReferenceArea and Segment are absent as migrated utilities. Native `rect`, `ruleY`/`ruleX`, `link`, and clip can cover primitives, but omitted-bound semantics, overflow modes, patterns, edge fades, bracket markers, selection thresholds, and y-domain registration require one shared compatibility layer. Affected set: Line, Area, Composed, Bar, Scatter, Candlestick, and confirmed LiveLine child extraction.
