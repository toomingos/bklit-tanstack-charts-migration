# Initiative 1 Audit

Status: open, not ready for gating.

Evidence: `research/phase-3/inventory/05-consolidated-internals.md` records five spring/reveal families, five duplicated tooltip token sets, three `nice()` y-domain implementations, and fourteen ResizeObserver sites. Migrated reveal code also has uncancellable post-paint/deadline races (`migrated/charts/internal/deferred-reveal.ts`) and rendered-DOM access, which fails the layer contract. Required plan: one token/timing module, exact bklit spring fallback semantics, cancellable reveal controller, and shared y-domain helper.
