// Public `animationDuration` / `animationEasing` PROP DEFAULTS.
//
// Provenance: bklit legacy `animation.ts:4,6` (`DEFAULT_ANIMATION_EASING`,
// `DEFAULT_ANIMATION_DURATION_MS`), both of which legacy re-exports from its
// public barrel (`index.ts:18-19`). These are part of the COMPONENT API — a
// caller may import them to compute a matching duration for their own
// transitions — so they are exported from this package's barrel too.
//
// ── Why this is NOT `./design-tokens`'s `REVEAL_DURATION_MS` / `REVEAL_EASE_CSS` ──
//
// They currently hold the same two values (1100 / cubic-bezier(.85,0,.15,1)),
// and collapsing them would look like an obvious dedup. It is not: the two
// pairs have DIFFERENT SOURCES OF TRUTH and are free to diverge.
//
//   - `design-tokens.ts`'s REVEAL_* are a hand-maintained MIRROR of native
//     TanStack charts-core's module-private reveal defaults (`motion.ts:207,209`)
//     — see that file's T-D1 note. If upstream changes, they follow upstream.
//   - The constants HERE are the bklit legacy prop defaults. They follow legacy,
//     because Phase 4's parity goal is that a caller who omits `animationDuration`
//     gets the same animation from the migrated chart as from the legacy one.
//
// An upstream `motion.ts` change must move the REVEAL_* pair and must NOT move
// these; a legacy `animation.ts` change must move these and must NOT move the
// REVEAL_* pair. Aliasing either to the other would silently couple them.
//
// Before P4 these were re-inlined as six byte-identical private copies across
// area/bar/candlestick/composed/line/scatter-chart.tsx; this module is their
// single home.

export const DEFAULT_ANIMATION_DURATION_MS = 1100;
export const DEFAULT_ANIMATION_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
