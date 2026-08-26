# P4.2 executor notes (running log — insurance against session kills)

Final report supersedes this file. Newest entries last.
Entries are appended ONLY after the described code exists on disk.

## Entry 1 — resume state (post-kill)

- **T-C8**: CLOSED by lead (gate-green, −6 lines, TSC_EXIT=0). Files
  `bar-squares-layout.ts` / `bar-squares-mark.ts` / `bar-column-track-mark.ts`
  are hands-off from here on.
- **T-C2**: NOT STARTED. **T-C7**: NOT STARTED (`grep createBroadcastStore` = 0 hits).

### T-C2 candlestick y-sort verdict (evidence gathered pre-kill)

**Ruling: keep insertion order (option b).** Evidence read:

- `repos/bklit-ui/packages/ui/src/charts/use-chart-interaction.ts:78-115` —
  `resolveTooltipFromX` returns a SINGLE `{point, index, x, yPositions}`;
  `yPositions` is a Record<dataKey, number>. There is **no grouped point
  array anywhere in bklit's interaction layer**, hence no ordering to inherit.
- Grep `\.sort\(` across `repos/bklit-ui/packages/ui/src/charts/**` → hits only
  in sunburst/pie-center/x-axis/heatmap-utils; **zero `a.y - b.y` sorts** in any
  chart source. The migrated bar/scatter y-sort mirrors TanStack `focusX`
  grouped, not bklit.
- Therefore normalizing candlestick to y-sorted would invent behavior; keeping
  Map insertion order is the conservative match.

### Planned designs (fixed before coding)

- **Kit module**: `internal/chart-focus-kit.ts` — exports `focusValueKey`
  (byte-identical twin from bar/scatter), `collectFocusGroup(points, primary,
  xKeyOf, memberKeyOf, sortOthersByY)`, `findNearestPointByX`,
  `uniquePointsInNavigationOrder`. Keyer fns defined at MODULE level in each
  strategy file (hoisted once → zero per-event closure allocation).
- **Candlestick**: `sortOthersByY=false` → documented divergence w/ citation.
- **T-C7 module**: `internal/broadcast-store.ts` — `createBroadcastStore<T>
  ({initial, equals?})`; `equals` omitted/null ⇒ ALWAYS notify (pie's no-dedup
  preserved); per-field comparators for heatmap; `setSilent` + single `notify()`
  reproduces heatmap's ONE-broadcast `clearInteraction`; heatmap `subscribe`
  joins three store subscriptions behind one unsubscribe.
- Ring/funnel alias sites untouched (they alias `createPieHoverCoordinator`,
  whose export surface does not change).
- Scatter-path honesty note for §1: T-C7 does not touch scatter at all; T-C2's
  kit replaces inline loops with parameterized keyers (monomorphic closure
  calls, no new allocations; the rewritten collector drops one intermediate
  filter array per call). Neither strand is expected to MOVE M3a; hypothesis
  for the regression recorded in final report.

## Entry 2 — T-C2 code on disk (typecheck pending)

- NEW `internal/chart-focus-kit.ts`: `focusValueKey`, `findNearestPointByX`,
  `collectFocusGroup(points, primary, xKeyOf, memberKeyOf, sortOthersByY)`,
  `navigationOrder(points, xKeyOf)`.
- REWROTE bar/scatter/candlestick-focus-strategy.ts onto the kit.
  - Bar: module-level `byXKey`/`byMemberKey` (`group ?? markId`);
    band-division branch + fallback kept verbatim except: fallback's
    anchorX precompute folded into the nearest-loop (`sum/count` inline) and
    candidate collection switched from Map+ArrayCopy to Set+push (same
    first-wins semantics).
  - Scatter: `byMarkId`, y-sort ON.
  - Candlestick: `epochMs` as xKeyOf, `byMarkId`, **y-sort OFF** — insertion
    order preserved; divergence citation in file header
    (bklit use-chart-interaction.ts:78-115 single-point tooltip).
- Host files untouched; signatures unchanged. Ring/funnel/pie/heatmap files
  untouched so far.

## Entry 3 — T-C7 code on disk; tree typechecks

- NEW `internal/broadcast-store.ts`: `createBroadcastStore<T>({initial,
  equals?})`; `equals===null ⇒ always notify` (pie no-dedup); `setSilent` +
  `notify()` for one-broadcast multi-field writes (heatmap clearInteraction).
- EDITED `internal/pie-hover-chrome.ts`: factory wraps a comparator-less
  store; controlled/uncontrolled split verbatim; export surface unchanged →
  ring/funnel alias re-exports untouched.
- EDITED `internal/heatmap-hover-chrome.ts`: three stores — cells comparator
  `a===b || (col&&row equal)`, legend `a===b`, tooltip `a===b ||
  (col&&row&&count equal)` — exact old guards; clear = all-null guard +
  3× setSilent(null) + ONE cells.notify(); subscribe joins 3 unsubs.
- Mid-run incidents (self-reported): (1) wrote corrupted draft of this module
  to WRONG PATH `/Users/tomasdomingos/bklset-tanstack-charts-migration/…`
  (stray dir + corrupt file left in place — no-delete rule; LEAD PLEASE
  DELETE). (2) First store draft had lazy-init bug that would have skipped
  first-set notify; fixed before wiring via explicit `initial`.
- `npx tsc --noEmit` (from showcase/) → **TSC_EXIT=0** (P4.1's
  live-hover-chrome.ts error cleared by peer mid-session).
- QA pending: bar 100, scatter 1000, candlestick 1000, pie 1000, ring 1000,
  funnel 1000, heatmap 52.
