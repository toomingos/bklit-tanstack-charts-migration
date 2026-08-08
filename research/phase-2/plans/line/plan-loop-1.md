# LineChart — Phase 2 Refactor Plan (1.1 synthesis)

> Inputs: `research/phase-2/audits/line-audit.md`, `research/phase-2/inventory/04-migrated-inventory.md` §1+§4, `research/phase-2/tanstack-native/01-load.md` + `02-render.md` + `03-hooks-and-updates.md` + `04-interactivity.md`, plus live read of `migrated/charts/line-chart.tsx` (362 lines, confirms audit lines at +1).

## Goal

Move Line — the most TanStack-native cartesian chart — a step closer to TanStack-native refs while preserving bklit 1:1 parity and today's QA PASS streak (n=100 settled+hover). Do not repeat composed/scatter-scale changes; keep justified overhead and tag the rest as deferred.

## Distilled overhead (audit non-redundant)

The audit enumerates ~11 flags, four broken flows, seven remediation candidates; consolidated de-dup across Inventory §4:

1. **TanStack-native mark is already complete** (`lineY` + `defineChart` + `focus:'group-x'`) — no C there; pressure is on the surrounding wrappers.
2. **Wrappers with TanStack-native equivalents:** manual `ResizeObserver`+width state, `XAxisOverlay`/`YAxisOverlay` HTML ticks, imperative `attachHoverChrome` host, `xForIndex` manual time→px math, WAAPI clipPath reveal. Most are K/D this pass; only the systemic parts (xForIndex hardening + domain single source + reveal leakage guard) are taken C this slice.
3. **Broken flows per audit §4:** `xForIndex` highlight drift (only 100%-repo-relevant C this pass), `prevNicedYDomainRef` sync tween miss, RO debounce thrash, `querySelector(".ts-chart__marks")` + stale `onPhaseChange` leakage from unmounted WAAPI `onfinish`. Last 3 + 1 leakage are small C fixes folded into the plan.
4. **Jutified keeps:** y-domain exact port, edge-fade dataset seam, decimation parity, aspectRatio plumbing. Not changed.

## Synthesis (what to change vs keep vs defer) — aligned to PLAN-phase-2 1.1 intent

The instruction is to **synthesize the audit into a non-redundant plan that gets closer to TanStack native** — not to re-list every audit candidate. So:

### Change — C (tight, no design drift; inferred per audit line refs)

**C1 — xForIndex: source from TanStack scale, not date interpolation.** Replace the `first/last renderData` + `(value-first)/(last-first)` linearization (`line-chart.tsx:202-217`, audit §2 row M + §4 row 1) with the established cartesian TanStack-native primitive: stash the live `scaleUtc` via `ChartScale.resolve`-esque shimming and have `xForIndex(idx) := xScaleD3Ref.current.map(value)`. Reuses the `ComposedChart` `xScaleD3Ref` pattern cited by the audit (`composed-chart.tsx:501-546`). This is the only Fig 1 audit C that hardens hover highlight alignment before margin/nice creep, and is cheap (zero new deps — just hoisting the scale TanStack already owns).

**C2 — Single source for nicedYDomain.** Audit §4 row 5: `definition` calls `scaleLinear().domain(yDomain).nice()` while `YAxisOverlay` is fed a sibling `scaleLinear().domain(yDomain).nice().domain()` memo — two paths that can misalign grid vs labels. Collapse to one `niced = scaleLinear().domain(yDomain).nice().domain()` and (a) feed `yDomain: niced` to the TanStack `y` channel spec (use `scaleLinear().domain(niced)` — same effect as `.nice()` but single source) and (b) reuse the same tuple for `YAxisOverlay` + chrome sizing. Fixes a real, gate-visible rounding seam with zero design cost.

**C3 — Unmount-safe WAAPI reveal.** Audit §4 row 4 + row 5 adjacent leakage: `handleRender` installs `anim.onfinish = () => setPhase("ready")` on an `Animation` with no cancellation, so unmount-for-navigate + late finish calls `onPhaseChange` on a detached ref (n=1000 reveal still airborne). Guard with an Abort-ish token: `let stale = false; anim.onfinish = () => { if (!stale) setPhase("ready"); }; return () => { stale = true; anim.cancel(); marks.dataset.bkmRevealed = ""; }` — or minimal equivalent. Also drop `bkmRevealed` guard that masked the true race and silence the leaked callback. Tiny C; targeted only at the reported leakage (no clip→`animate` migration — deferred).

**C4 — RO debounce (10 ms).** Audit §4 row 3: `ResizeObserver` has no `debounceTime={10}` parity — restores `ParentSize debounceTime` gate with a trivial rAF/timer on the width commit. Few lines, lines up with `bklitui-native/00-README.md` Sizing gate cited by the audit.

### Keep — K (justified, do not move this slice)

- **K1 y-domain provenance, decimation/LTTB, XAxisOverlay/YAxisOverlay parity.** Audit itself marks y-domain as justified (bklit exact port cited `time-series-chart-shell.tsx:337-371`) and notes overlays are design-preserving — revisit only in a cross-cartesian axis sweep, not as a single-file plan.
- **K2 Imperative hover chrome (`attachHoverChrome`) + chromeStateRef/refs.** Audit's high-severity row is real, but the primitive correctly avoids React state per hover; migrating it to TanStack tooltip/portal is a multi-chart D-track, too risky mid-loop for a gate that already passes at n=100 settled+hover. Keep.
- **K3 WAAPI clipPath reveal path (not migrated to `animate`).** Audit remediation #1 is correctly deferred — TanStack reconcile's numeric-skeleton `d` interpolation is not a clip wipe; swapping it risks a visible mount seam with no M-metric signal at n=100. Leak fix above is sufficient.
- **K4 bezier-easing + data-bkm-fade-edges + aspectRatio.** Scalp-level wrappers; not worth churn.

### Defer — D (cross-chart sweeps, not single-file)

- **D1 host-scoped sizing:** collapse manual `ResizeObserver` into `<Chart width height aspectRatio> {ctx => spec}` with TanStack internal observer — rightly deferred until the whole time-series family can absorb the sized-ctx contract (line/area/composed share it). Audit candidate 3.
- **D2 TanStack guides for X/Y:** native `guide:true` cutover and tick search removal — deferred along with the overlay family (line+area+live-line share the same `x-ticks.ts` search).
- **D3 xForIndex superset:** full `ChartScale` shim threading across all axes if C1 needs to generalize to composed later — defer.

## Execution (1.2)

- Implement C1..C4 in `migrated/charts/line-chart.tsx` (single file; ~362→~375 lines), lint+bench/app smoke build, then QA the line gate at n=100 + n=1000.
- Pre/post verification expectations: QA settled+hover ≤0.1%/≤0.5% stays PASS at both n, hover highlight safe margin drift fix repro verified by auditing `xScaleD3Ref.map` output vs previous `xForIndex` interpolation; nicedYDomain source collapse checked by diffing overlay tick vs grid y across two niced rounds.

## Risks

- C1 touches the only hover band path — mitigated by keeping both `xForIndex` fallbacks until the first `Chart attach` control run passes.
- C2 may subtly change Ticks where bklit's twin `.nice()` calls coincidentally diverged before; treated as a fix, not a drift — flag if QA moves >0.05%.

## Questions open

- None blocking — Fig 1 before/after QA will be the tie-breaker; audit lines already confirmed vs source (audit +1 drift handled).
