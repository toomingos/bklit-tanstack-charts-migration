# Phase 3 Layer Contract

This contract governs every Phase 3 initiative.

## Backend boundary

- Migrated charts use TanStack Charts public APIs only. No deep imports, package internals, rendered-DOM queries, or DOM patching are allowed.
- The bklit layer owns visual tokens, layout policy, animation timing, and public prop compatibility. TanStack owns scales, marks, focus, guides, legends, spatial indexes, and tooltip primitives where its public API provides them.
- A utility has one implementation and one import path. Consumers may configure it, but may not fork its behavior per chart.

## Compatibility

- Public migrated prop types must satisfy the corresponding bklit prop surface without silently dropping props.
- Shared fixtures must render against both backends and report runtime console errors.
- TanStack dependencies are pinned; upgrades require the complete Phase 3 gate sequence.

## Tokens and gates

One design-token module owns shared magic values, including spring parameters, the 1100ms reveal easing, marker fan angle, and tooltip offsets. Each initiative follows Q3 boundary, type parity, Q2 API, Q1 visual, then G1-G4 benchmark gates across every affected chart. A failure remains visible in the tracker and log until fixed or explicitly waived.
