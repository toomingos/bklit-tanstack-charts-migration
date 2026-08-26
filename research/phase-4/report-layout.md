# Phase 4 Standardized Report Layout (4.1.3)

Every 4.1.4.1 report is written to `research/phase-4/<part>.md` (part name from `taxonomy.md`). Keep text concise and terse; structure with tables. Do NOT decide SHARED vs UNIQUE (that's the 4.1.4.2 usage-matrix). Read the actual source files — do not guess.

## Layout (exact section order)

```markdown
# <part> — Phase 4 Research Report

**Files:** <migrated file paths>
**Legacy source(s):** <repos/bklit-ui/packages/ui/src/charts/... paths>

## Feature summary

<2-3 lines prose: what the part does, key visuals/interactions>

## Public API

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|

Legacy parity ∈ same / renamed / missing / extra. "missing" = legacy has it, migrated doesn't; "extra" = migrated-only. Cover every exported symbol and every prop of exported components. For shared internal groups with no public API, table the group's exported surface instead and mark parity vs the corresponding legacy module.

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|

- Kind: component / hook / context / mark / overlay / util fn / constant / CSS class / type
- Origin (where the behavior comes from): BKLIT (parity requirement) / TANSTACK (default) / CUSTOM (new addition)
- Impl (how it's built): TS-NATIVE (TanStack API directly) / CUSTOM-ON-TS (custom code layered on TanStack primitives) / CUSTOM (independent of TanStack)
- TanStack-native candidate?: yes / maybe / no — cheap guess, pre-seeds synthesis 4.2.1.4
- MUST include: inlined constants/magic values (durations, easings, px offsets, colors), side-effect channels (WAAPI animations, direct DOM mutation, event listeners, rAF loops), contexts/hooks consumed or provided, CSS classes used from `styles.css`

## Imports

<bullet list of `internal/` modules this part imports (from the migrated files themselves)>

## Deviations

<bullet list: TODOs, workarounds, known parity gaps, suspicious duplication noticed while reading. "None found" if clean.>
```
