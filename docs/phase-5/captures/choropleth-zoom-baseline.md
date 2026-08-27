# Choropleth zoom-state baseline — the first measurement of zoom parity in this project

Established 2026-08-27 (D395) by the new `qa/zoom-gate.mjs`, on the unmodified tree where **both**
implementations still run `@visx/zoom`. This is the reference T19 must hold.

| state | diff | pixels | settle signal |
|---|---|---|---|
| `reset` | **0.0000%** | 0 of 960000 | timeout-fallback (no transition fires — already at identity) |
| `zoomed` | **0.0104%** | 100 of 960000 | `transitionend` |
| `panned` | **0.0028%** | 27 of 960000 | `transitionend` |

Gate 0.5%, same threshold and `compareBuffers` implementation as the main QA gate. **Overall: PASS.**

**Determinism: four independent runs, bit-identical every time** (three by the implementing agent,
one re-run by the lead). The `zoomed`/`panned` cells settle on a real `transitionend` event for the
`transform 0.18s ease-out` on the marks group, not a fixed sleep, which is why they are stable.

## Why these are not zero

`reset` is exactly zero. `zoomed` and `panned` are not: 100 and 27 differing pixels respectively,
with both impls on the same zoom library. These are subpixel/anti-aliasing edge differences that
appear only once a non-identity transform is applied — the two impls compose their transforms
through different DOM structures. They are reported as found, not tuned away, and they are the
**floor** for T19: a replacement engine is not required to beat them, only to not exceed the gate.

## What this closes

Before this file, zoom/pan had **never been measured**. `qa/screenshot.mjs` contains zero
occurrences of `mouse.wheel`, `mouse.down`, `mouse.up`, `__benchZoomTo` or `choropleth`; all four of
its probes render the map at its default transform. `__benchZoomTo` was built on both impls for
exactly this purpose (`bklit-choropleth.tsx:180`, `migrated-choropleth.tsx:78`) and had **zero
callers repo-wide**. D365 recorded the gap and `02-visx-removal.md:73` / `ledger.md:108` both call
zoom-state verification MANUAL. It is no longer manual.

## Known technical debt in the harness (needs gate-author approval to fix properly)

`qa/screenshot.mjs:1273` calls `main().catch(...)` unconditionally with **no
`import.meta.url === process.argv[1]` entrypoint guard**, so a plain
`import { compareBuffers } from "./screenshot.mjs"` executes the whole CLI and kills the importing
process. `zoom-gate.mjs` works around this caller-side (temporarily neutralising `process.argv` and
`process.exit` across the dynamic import, both restored in a `finally`) rather than duplicating the
diff logic — duplication would let the two gates silently drift apart on what counts as a differing
pixel, which is worse.

The workaround's failure mode is **loud, not silent**: if `screenshot.mjs`'s early-exit path ever
changes, the import would visibly spawn a server/browser rather than quietly returning a wrong
function. The correct fix is a one-line entrypoint guard in `screenshot.mjs`, which is a
**protected harness file requiring explicit gate-author approval** — not taken. Parked for 5.3.5.
