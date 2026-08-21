# Initiative 2 Audit

Status: open, not ready for gating.

Evidence: `research/phase-3/inventory/05-consolidated-internals.md` identifies fourteen local ResizeObserver implementations, nine scale stashes, and absent migrated chart contexts. TanStack host sizing (`width`/`height`/`aspectRatio`/`initialWidth`) is the native replacement. Preserve radial square sizing, heatmap zero-size behavior, and standalone exceptions; do not reintroduce React hover contexts.
