# P4.3 executor notes — running log

Session resumed after external kill #1 (~58 min, zero bytes lost). This file
is the recovery dump of everything established before the kill, then a running
log. Newest entries at the bottom. Line numbers are from the reads cited.

Status: **no product files edited yet.**

---

## RECOVERED FINDINGS (pre-kill investigation, verified against disk)

### Harness mechanics (`qa/screenshot.mjs`, read in full)

- Capture sequence per load (`captureLoad`, :220-850): goto → wait
  `__benchPaintDone` → await `__benchSettled` promise → +200ms → **settled
  screenshot**. Then per fraction ∈ {0.3, 0.5, 0.7}:
  `mouse.move(2,2)` → **30ms** → `mouse.move(x, y, {steps:10})` → **700ms**
  (`HOVER_WAIT_MS`, :97) → screenshot. Fly-in origin is always (2,2).
- Probe point: first `#chart-root svg` bbox; `x = svgBox.x + w*fraction`,
  `y = svgBox.y + h/2`. Ring n=1000 svgBox = (24,24,280×280) → hover-30 =
  (108,164), r=56 from centre (140,140 in page coords → svg-local (84,140)).
- Ring is in `TOOLTIPLESS_CHARTS` (:69-82) → tooltip assertion skipped; pixel
  diffs are the whole hover gate. Gates: COMPARE_GATE 0.5% (:100),
  SELF_TEST_GATE 0.1% (:101).
- Both impl loads run concurrently (`Promise.all`, :861-864) — two separate
  browser contexts, fresh pages.
- `ensureServer` (:1094) → `rebuildIfStale` (:1028): stale-build guard scans
  `showcase/migrated/**` mtimes vs `bench/app/dist/index.html` and rebuilds
  automatically. **My source edits propagate to QA without me building.**
  Build lock dir `bench/app/.build-lock`. QA_SKIP_REBUILD=1 env skips.
- Server: vite preview, port `QA_PORT` ?? 5198. Batch mode exists
  (`--charts a,b,c`, `--concurrency`) but D288 says standalone-vs-sweep
  numbers aren't comparable — I will gate standalone.
- Funnel/heatmap/sankey get snapped probes; ring uses the raw fraction probe.

### Ring defect picture (P4-03.md + F4-ring.md + D256/D258/D284 + code)

- **Mechanism (D258, measured)**: hover scales bands radially (1.03 hovered /
  1.02 pushed-out, spring {400,25}). Growth displacement ≈1.7px at r=56 for
  1.03. Once the band is thinner than that, the hovered band's inner edge
  grows out from under a stationary cursor → `pointerleave` → spring reverses
  → band returns → `pointerenter` → sustained loop, no steady state. bklit
  does NOT oscillate at any density (churn=0, byte-identical reps).
- **Gate history (F4-ring §evidence)**: settled deterministic at every density
  (0.0868% pinned at n=1000); hover captures strongly-but-not-strictly bimodal
  (low mode 0.087–0.098 tight; high mode ~0.50–0.58 at n=1000; intermediates =
  spring caught mid-flight). n=100 worst (1.6–1.7%), fails every run since
  08-18 — evidence, not a deliverable. Gate density n=1000 (+n=4 mandated).
- **Code sites** (`ring-chart.tsx`, read in full, 960 lines):
  - Hover wiring `useLayoutEffect` :644-816. Listeners bound to BOTH
    `trackGroup` and `progressGroup` (:745-762) — both are the *scaled*
    groups. Coordinator subscribe repaints all rings on change (:765-782).
  - **Dead stamps** (:714-738): `el.style.cursor = "pointer"`,
    `el.style.transformOrigin = "0px 0px"` (both groups);
    `progressGroup.style.pointerEvents = "none"` (:734) +
    `progressPathEl.style.pointerEvents = "none"` (:737). Brief says all three
    read EMPTY on live DOM while listeners still fire — TanStack rewrites the
    style attribute after this effect runs, so the comment's
    "track remains the hit target everywhere" claim (:706-713) is not holding.
    → Decision owed: re-establish clobber-proof or remove comment + dead stamps.
  - Reveal `handleRender` :489-629 (WAAPI expand + progress sweeps,
    two-writer handoff via `pendingExpandAnimsRef` + `settleAtRest()`).
  - `useMeasuredRect(containerRef, !fixedSize)` at :260-261 (strand 4).
  - Root div always carries `ref={containerRef}` (:877) — attached on every
    render branch (relevant to the pie-D278 reasoning transfer).
  - Children classification is displayName-string-based
    (:146-152); `RingCenter` has ZERO import edge today (R7).
- **`internal/ring-hover-chrome.ts`** (read in full, 179 lines):
  `applyTransform()` writes `scale(v)` to trackGroupEl AND progressGroupEl
  (:101-106). `paint()` writes opacity/filter unconditionally, retargets
  spring (:117-165); `settleAtRest()` hands transform ownership (:166-174).
  Coordinator = aliased `createPieHoverCoordinator` (:48-51).
- **Legacy** (`repos/bklit-ui/.../ring.tsx`, read in full): enter/leave bound
  to the same `motion.g` it springs (all three return branches :177-230).
  Synthetic React `onMouseEnter/Leave`; `transformOrigin: "0px 0px"` in
  framer style (:171-175). So structural parity exists — bklit's immunity is
  NOT structural; D258 attributes it to latch geometry (hover latches a ring
  far from the cursor: ring 999 @ r~129 while cursor r=56), so nothing it
  grows dislodges the pointer.
- **Fix shape**: F4-ring prescribes binding listeners to an *unscaled
  wrapper*. **Nuance I worked out: a bare SVG `<g>` wrapper cannot do this —
  SVG group hit-testing derives entirely from painted descendants, so
  scaling the children still moves the wrapper's effective hit surface and
  the ejection survives.** The working equivalent (pie's D254 precedent,
  `pie-chart.tsx` :607-686) is a STATIC, never-animated hitbox twin mark
  carrying the listeners: pie emits `pie-hitbox:*` transparent-fill paths
  through the TanStack pipeline alongside the visible slice. Ring equivalent:
  emit per-ring static annulus marks (rest radii, transparent fill), bind
  enter/leave there, leave track/progress purely visual. Transparent fill
  still hit-tests (visiblePainted). Zero pixel delta expected; pie proved
  this pattern gate-clean.
- **n=4 emphasis gap (unruled)**: probe r=56 < baseInnerRadius=60 → cursor
  rests in the centre hole. bklit: fly-in crossing latches a ring and the
  emphasis RETAINS while parked in the hole; moving to an empty corner
  RELEASES (three-way probe, P4-03.md). Migrated: releases (flat scale(1)).
  Annulus sweep finds no geometry under the rest point in EITHER impl →
  latch/release divergence, not a hit-test hole. **Mechanism for bklit's
  hole-retention UNRESOLVED** — candidates I considered and could not
  confirm from source: React synthetic leave not firing over the centre
  overlay; some painted-but-invisible hole element; framer MotionValue
  quirk. Needs an empirical DOM probe before ruling fix vs accept.
  Radii at n=4 (renderScale=1): ring0 [60,72] ring1 [78,90] ring2 [96,108]
  ring3 [114,126]; centre stat box = baseInnerRadius*2-16 = 104px square
  (±52) — rest point r=56 sits just OUTSIDE the stat box, inside the hole.
- **Scenario files**: `bench/app/src/scenarios/{bklit,migrated,tanstack}-ring.tsx`
  exist. NOT YET READ (data gen shape, centre mounting) — needed for probes.

### T-C4 — CenterShell merge (charter + current surface)

- Charter (centralize.md row 7): ONE `CenterShell` in **`center-stat.tsx`**;
  props = `{data, total, hoveredIndex, centerSize}` + CenterStat passthrough;
  pie/ring/gauge centres become thin adapters resolving their own
  stable/coordinator contexts. Stays per-part: pie's `geometryScrubbing`
  null branch + `innerRadius<=0` return; ring's `baseInnerRadius` sizing;
  gauge's intro trick (OQ 7). Matrix claim that the intro is duplicated in
  pie-center is STALE — the double-rAF intro lives only in gauge-center
  (verified: pie-center.tsx has no rAF logic).
- go-to-plan.md:44 + OQ7: promote the gauge double-rAF intro into CenterShell
  as an **opt-in prop** (sole copy of legacy PieCenterShell logic; P6 wrapper
  reuses it). go-to-plan.md:142: T-C4 = merge + R7 RingCenter real import.
- **Consumer contract (P5-06.md strand 4)**: P5.6 builds `PieCenterShell` as a
  thin wrapper **over CenterShell** and barrels it + `PieCenterShellProps`.
  It will read MY report for the exact CenterShell API. Must land complete.
- Current modules (all read in full):
  - `internal/center-stat.tsx` (223 L): `CenterStat` (NumberFlow stack),
    classNames (`ts-bkm-center-stat*`), `CenterStatFormat`,
    `defaultCenterStatFormat`, `CenterStatHoverSource`,
    `useCenterStatHover(source)` via useSyncExternalStore. Chart-agnostic.
  - `internal/pie-center.tsx` (127 L): PieStableContext +
    PieHoverCoordinatorContext + hooks + `PieCenter` (defaultLabel "Total";
    sizing `innerRadius*2-16`; scrubbing→null hover; `innerRadius<=0`→null;
    children render-prop branch only when hoveredData, else CenterStat).
  - `internal/ring-center.tsx` (102 L): `RingCenter` — imports
    `{type RingData, useRingStable, useRingHoverCoordinator}` FROM
    `../ring-chart` (reverse dep). Sizing `baseInnerRadius*2-16`. **No
    scrubbing branch, no <=0 guard** — preserve as-is, do not "fix".
  - `internal/gauge-center.tsx` (289 L): `GaugeCenterOverlay` (double-rAF
    0→value intro, `introStartedRef` re-arm-on-remount, :59-115; sizing
    `max(contextSize*0.2,52)*2-16`; NO hover/children), `GaugeLabelStat`
    (linear, no intro, special classNames), `GaugeLabelLayout` (placement
    composition). Linear half stays put; only the arc overlay shares.
  - Legacy `repos/bklit-ui/.../pie-center-shell.tsx` (read in full): shell =
    minimal PieProvider + PieCenter + the intro effect (:49-70). Confirms the
    intro is shell-owned, not PieCenter-owned.
- Design sketch (to finalize): `CenterShell` in center-stat.tsx taking
  `{value, label, centerSize, intro?, formatOptions?, prefix?, suffix?,
  className?, valueClassName?, labelClassName?, icon?}` — container div
  (centerStatContainerClassName + flex-column centred, width/height =
  centerSize) + CenterStat; `intro` runs the exact gauge double-rAF
  flowValue state machine internally (opt-in). Pie/Ring adapters keep their
  context hooks, guards, sizing, children render-prop branch (per-part), and
  delegate the default branch to CenterShell. GaugeCenterOverlay slims to
  `<CenterShell intro …/>` + its sizing formula. R7: ring-chart.tsx gains a
  REAL import edge to ring-center.tsx (identity fast-path in
  `isRingCenterElement` + keep displayName fallback). NOTE: this creates a
  cycle ring-chart → ring-center → ring-chart; safe because usage is
  render-time only (components/hooks), but must verify bundling + tsc.

### T-C3 — reveal-shim collapse (analysis before reading all shims)

- **Wrapper correction stands: no native defaults surface exists** (D264:
  `motion()` chain unexported; resolved easing is numeric fn, never CSS).
  Do not wait for T-D1.
- **The D51 header does NOT block the chartered collapse.**
  `enter-transition.ts` :144-150 (quote for report): *"A plain 2-keyframe
  `[toKeyframe(0), toKeyframe(1)]` tween is NOT usable for `d`/path
  keyframes: CSS `d` interpolation is DISCRETE between `none` and a path,
  and between paths with mismatched command structure (verified empirically:
  a `[d:none -> d:path()]` 2-keyframe animation flips at eased-50% with no
  sweep at all — docs/LOG.md D51)."* That forbids replacing the SAMPLED
  keyframe ENGINE with a 2-keyframe tween — it says nothing against the
  chartered MODULE consolidation (hosts importing enter-transition directly;
  shims reduced to alias modules for public type names). The sampling
  machinery (`revealTiming.sampledProgress` + `buildProgressKeyframes`)
  stays; it is the workaround FOR the D51 limitation.
- centralize row 6's premise "all 5 re-export from ./enter-transition
  (byte-equivalence verified)" looks STALE vs disk: ring-reveal.ts still
  exports substantive names (RING_TWEEN_FALLBACK etc.) — must read all five
  (pie/ring/funnel/radar/gauge-reveal.ts) + charts/index.ts barrel before
  collapsing. Known stayers: gauge's `reconcileGaugeReveal` (unique engine),
  radar's `bklitRadarGrid`. Public type names (PieEnterTransition,
  RingEnterTransition, …) MUST survive from charts/index.ts unchanged.
- Consumers confirmed so far: ring-chart.tsx imports {buildProgressKeyframes,
  RING_TWEEN_FALLBACK, resolveEnterTransition, revealTiming,
  type RingEnterTransition} from ./internal/ring-reveal (:52-58); pie-chart
  similar from pie-reveal (:69-72).

### Strand 4 — useMeasuredRect (radar + ring ruling)

- Sites: `radar-chart.tsx:220-222` and `ring-chart.tsx:260-261`, both
  `useMeasuredRect(containerRef, !fixedSize)` then `size = fixedSize ??
  Math.min(width, height)`.
- Pie precedent (D278/P5.8, `pie-chart.tsx:242-251`): swapped to
  `useDebouncedContainerSize(containerRef)`; ruled the missing `enabled`
  param HARMLESS — ref attached on both render branches, measured value
  never read in fixed mode (fallback to fixedSize). Comment at :243-250.
- Constraint: do NOT change the shared hook's signature (would disturb
  gauge's two working call sites). `useMeasuredRect(ref, enabled=true)`
  lives at `internal/use-container-size.ts:165`;
  `useDebouncedContainerSize(ref)` at :108 (10ms debounce + 0.5px epsilon,
  commits width+height together).
- Ring ref-attachment: VERIFIED unconditional (:877 single root div).
  Radar ref-attachment: NOT YET VERIFIED (must read radar's JSX branches).
- Whether bklit's radar/ring actually measure through a debounced ParentSize
  (making this a genuine parity gap in 3 charts, not 1) — NOT YET VERIFIED
  against the clone. Pie's did (P9).
- Resize harness: qa/screenshot.mjs is structurally blind to the debounce
  window (states: settled/hover-N/loading only) → bespoke probe required at
  `research/phase-4/tools/resize-probe.mjs` (dir doesn't exist yet; I create
  it). Verdict needed for pie + radar + ring (gauge closed by P5.8).

### Stale citations / contradictions found (for report item 11)

1. centralize row 6 "all 5 reveal shims are pure re-exports, byte-equivalent"
   — appears stale on disk (re-verify per-module before collapse).
2. centralize row 13 lists `radar-spring → enter-transition` as a pending
   fold, but enter-transition ALREADY imports both spring utils from
   radar-spring (:37) and D262 records radar-spring is NOT single-importer —
   the fold row is misleading; not my item beyond noting it.
3. P4-03.md "~lines 624-796" for the stamp block — actual stamps at :714-738
  (file drifted post-P4.2). Wrapper already flags stale line numbers; adding
  the concrete ones.
4. usage-matrix.md:63 still claims PieCenterShell intro is duplicated in
   pie-center — centralize corrected it; usage-matrix not updated (cosmetic).

### Explicitly NOT mine

- funnel-chart.tsx:451,483 inline prefersReducedMotion — lead-assigned
  elsewhere. Do not touch.
- markers n=100 hover-30 ≈0.5507% chronic (F4-ring out-of-scope list).
- ring n=100 1.6-1.7% rows — evidence only, not a deliverable.
- Pivot-semantics question — measured and closed (both impls pivot about ring
  centre; do not re-open).

### Rules I am operating under (restated for resume)

- Edit committed showcase/ code ONLY; clones read-only. No qa/, bench/,
  /tmp writes. Running node qa/screenshot.mjs allowed. No npm run build.
  No commits. Cannot delete files — un-wire + name orphans. Write each file
  as soon as its edit completes. Typecheck: `cd showcase && npx tsc
  --noEmit` (never pipe to head; root npx is a decoy).
- Gate densities: ring 1000 AND 4 (hover captures mandatory), pie 1000,
  gauge 1000, funnel 1000. Standalone runs only (D288). Never impl=tanstack.
- Order: T-C4 → ring → T-C3 → useMeasuredRect → resize harness. May stop
  after any completed strand and report.

---

## RUNNING LOG (append as reached)

(post-resume entries go below)

### [T-C4] LANDED — files edited, TSC_EXIT=0

- `internal/center-stat.tsx`: added `CenterShell<T>` (+ `CenterShellProps`,
  `CenterShellRenderProps`, private `useIntroFlowValue`). Data-in shell:
  container box + CenterStat stack + generic children render-prop branch +
  opt-in `intro` prop carrying the verbatim PieCenterShell double-rAF state
  machine incl. cleanup re-arm. Added `useRef` to the React import.
- `internal/pie-center.tsx`: `PieCenter` now delegates to
  `<CenterShell<PieData>>`; keeps scrubbing-null + `innerRadius<=0` guards
  locally; dropped direct `CenterStat` import.
- `internal/ring-center.tsx`: `RingCenter` delegates to
  `<CenterShell<RingData>>`; keeps `baseInnerRadius*2-16` sizing and NO
  zero-guard (never had one); dropped direct `CenterStat` import.
- `internal/gauge-center.tsx`: `GaugeCenterOverlay` slims to sizing formula +
  `<CenterShell … intro>`; `GaugeLabelStat`/`GaugeLabelLayout` untouched
  (still import `CenterStat` + container className directly).
- `ring-chart.tsx` (R7): real import edge `import { RingCenter } from
  "./internal/ring-center"` + identity fast-path `child.type === RingCenter`
  in `isRingCenterElement`, displayName fallback retained.
- Behavioral-equivalence reasoning recorded: adapters resolve value/label/
  size/hoveredData exactly as before; CenterShell renders byte-identical DOM
  (same classNames/styles); intro=false initial state = value (pie/ring never
  had intro); gauge intro sequence identical (useState(0) → effect setFlow(0)
  no-op → double-rAF → value); isHovered prop simplification (`true`) is
  equivalent because the branch is only reachable when hoveredData != null.
- First typecheck caught my own breakage: GaugeLabelStat still needs
  `CenterStat` — restored alongside CenterShell. Final `TSC_EXIT=0`.
- Gate plan: settled-phase pie/gauge/ring n=1000 standalone runs now (T-C4
  should be pixel-neutral); ring hover determinism deferred until after the
  oscillation fix so the same runs double as the fix gate.

### [T-C4] GATED BY LEAD — DONE, do not reopen (kill #2 resume)

Lead verified all mechanism claims by grep + ran the gate standalone n=1000:
pie settled 0.0101 / hovers 0.0000–0.0007 PASS; gauge 0.1034 flat across all
four phases (digit-identical); **ring settled 0.0868% = byte-identical to
F4-ring's pinned value → neutrality proven by identity**. Ring n=4 settled
0.0602 (its own pin), hovers pass. Ring n=1000 hover-30 0.4705 / hover-50
0.0949 / hover-70 FAIL 0.5326 = the chronic oscillation (4th bimodality
sampling), not a T-C4 regression. tooltipA=true tooltipB=false on all three
ring n=1000 hovers. `TSC_EXIT=0` confirmed by lead. Ring hover-70 FAIL must
clear via the oscillation fix + 3-run determinism check.

### [RING] design lock-in (kill #2 resume)

Approved by lead: bare `<g>` wrapper cannot work (SVG group hit-testing =
painted descendants; scaling children moves the wrapper's effective hit
surface — D272-pattern instance #9). Fix = static never-animated TRANSPARENT
hitbox twin marks per ring emitted THROUGH the TanStack pipeline (pie's D254
precedent, pie-chart.tsx:607-686), listeners bound there; track/progress
become purely visual. Remaining sub-items: dead stamps ruling (:714-738 +
comment :706-713), n=4 emphasis-gap DOM probe (bklit hole-retention mechanism
UNRESOLVED), radar ref-attachment check (strand 4 prep).

### [RING] oscillation fix LANDED — TSC_EXIT=0 (pre-gate)

`ring-chart.tsx`, four edits:
1. Mark definitions (:396-477): second `hitboxMarks[]` pass — per-ring static
   annulus twins `ring-${i}-hitbox` at REST radii, `fill:"transparent"`
   (visiblePainted hit-tests), same ratios/cornerRadius as their ring.
   Appended AFTER all visual marks (`[...arcMarks, ...hitboxMarks]`) so the
   whole hitbox layer stacks above the whole visual layer — required because
   bands overlap; per-ring interleaving would bury ring j's twin under
   ring j+1's visuals. Pie precedent renders its twin after the visible mark;
   the two-pass arrangement is ring-specific for exactly this reason.
2. `RingImperativeState` gains `hitboxEl`.
3. Hover-chrome effect: listeners now bind ONLY to the hitbox twin
   (pointerenter/leave, cursor:pointer on hitbox). Track/progress are purely
   visual — no listeners, no stamps. DEAD STAMPS RESOLVED by REMOVAL:
   cursor/transformOrigin/pointerEvents stamps deleted together with the
   comment block whose "track remains the hit target everywhere" claim was
   false (TanStack clobbered all three styles live-DOM per D258 secondary
   finding + lead's confirmation). transformOrigin note preserved in the new
   comment (bklit-parity context) minus the false pointer-events claim.
4. Teardown loop: single hitbox-key cleanup replaces track+progress pair.

Two-writer handoff untouched: settleAtRest gating identical; runtime still
writes scale to track+progress via config els. Expected: hover state machine
unchanged, only the LISTENER SURFACE is now static → no ejection loop.

Next: QA gate ring n=1000 ×3 (determinism) + n=4, then pie/gauge/funnel
n=1000 regression sweep.

### [INCIDENT] barrel broken by LIVE SIBLING — not mine, not fixed by me

First ring QA attempt failed in qa/screenshot.mjs's auto-build:
`src/scenarios/migrated-profitloss.tsx:14:2: "ProfitLossLegendHoverProvider"
is not exported by charts/index.ts`. Forensics:
- `index.ts` mtime TODAY 05:37 (after lead's own green gate; I never edited
  it — my edits are center-stat/pie-center/ring-center/gauge-center/
  ring-chart only).
- `ps aux`: pid 3044 = `P4.4 resume2` cmd executor STARTED 05:23, ACTIVE CPU
  — the lead resumed BOTH packages in parallel. pid 2895 = me.
- Barrel lost exactly the ProfitLossLegendHoverProvider/useProfitLossLegendHover
  export block vs my pre-kill read (:299-302 then; gone now). Consistent with
  P4.4 mid-refactor of shared barrel surface.
Ruling per D286/D287: DO NOT edit index.ts myself (racing a live sibling on a
shared file makes it worse); do NOT attribute to zombie. Ring QA deferred
until the barrel is self-consistent again — will re-check before retrying.
Meanwhile proceeding with non-build work: T-C3 reads, radar ref-attachment
check, resize-probe authoring (research/phase-4/tools/).

### [T-C3] LANDED — reveal-shim collapse, TSC_EXIT=0 (pre-gate)

Discovery that reshapes the ruling: **the engine consolidation ALREADY
HAPPENED in Phase 3** (initiative 1). All five shims were already pure
re-export aliases of enter-transition; centralize row 6's "byte-equivalence
verified" premise was accurate, not stale (my earlier suspicion retracted).
The D51 header does NOT block any of this: it forbids a 2-keyframe `d`
tween, and nothing here touches keyframe strategy — sampledProgress +
buildProgressKeyframes are untouched.
What collapsed = import EDGES:
- pie-chart.tsx / ring-chart.tsx / funnel-chart.tsx: value+type imports moved
  from their shim to ./internal/enter-transition; barrel-facing re-exports
  (`export type {XEnterTransition}`) repointed likewise. Barrel names
  unchanged (OQ 4 satisfied by inspection — index.ts lines untouched).
- gauge.tsx: SPLIT import — GAUGE_SPRING_FALLBACK + reconcileGaugeReveal +
  GaugeRevealTarget stay in gauge-reveal (unique reconciler; spring fallback
  is its own default timing); timing names (resolveEnterTransition,
  revealTiming, GaugeEnterTransition, GaugeRevealTiming) now from
  enter-transition. Barrel edge repointed.
- radar-chart.tsx: aliased imports (buildRadarProgressKeyframes /
  radarRevealTiming / resolveRadarEnterTransition) now resolve from
  enter-transition via import-renaming; bklitRadarGrid stays in radar-reveal
  (custom PolarGuide, not timing machinery). Radar's own barrel export takes
  RadarEnterTransition from radar-chart.tsx (:44) — no direct edit needed.
- internal/pie-center.tsx: PieEnterTransition type import repointed.
Shim FILES left in place (cannot delete; orphans for lead): pie-reveal.ts,
ring-reveal.ts, funnel-reveal.ts, radar-reveal.ts (still exports bklitRadarGrid,
NOT an orphan), gauge-reveal.ts (NOT an orphan — holds the reconciler).
TRUE ORPHANS after collapse: pie-reveal.ts, ring-reveal.ts, funnel-reveal.ts
(zero remaining importers). RADAR_TWEEN_FALLBACK added to enter-transition
for completeness even though radar never imported it by that name (radar
call sites pass fallbacks positionally); harmless alias.
First typecheck caught: missing family aliases (expected) + my radar import
mangling (bklitRadarGrid dropped). Both fixed; final TSC_EXIT=0.
[LEAD UPDATE post-resume#3: the three true orphans have now been DELETED by
the lead; TSC_EXIT=0 BUILD_EXIT=0 after. Three stale comments naming them
remain — radar-spring.ts:3, funnel-chart.tsx:101/:120 — assigned to me.]

### [RESUME#3] where I died — latch-probe data in hand, interpretation NOT yet logged

Killed right after the fourth latch-probe invocation returned. Raw results:

```
[bklit n=1000]     probe=(108,164) emphasized=[] churn=0×12
[migrated n=1000]  emphasized: 1156 groups, first={"key":"ring-422-track","scale":"1.03"},
                   last={"key":"ring-999-progress","scale":"1.02"}; churn flat 1156×12
[bklit n=4]        emphasized=[] churn=0×12
[migrated n=4]     emphasized=[] churn=0×12
```

CRITICAL artifact I had NOT yet logged: **the bklit rows are INVALID** — the
probe selected `[data-ts-key^='ring-']`, which only exists on TANSTACK-rendered
DOM (migrated). bklit's framer/visx `<g>`s carry no data-ts-key, so
emphasized=[]/churn=0 for bklit proves nothing. Migrated rows are valid.
Valid conclusions so far:
- Migrated n=1000 post-fix: STEADY latch of ring 422 (the band physically
  under the cursor at r=56; 577 outer rings pushed out ×2 groups +2 = 1156 ✓),
  zero churn variance → oscillation dead, steady state reached.
- Migrated n=4: ends UNemphasized (releases in the hole) — matches P4-03's
  finding; bklit side still unverified at DOM level.
- Self-diff table (3 runs, temp-ring-postfix-selfdiff.mjs): bklit Δown-settled
  ~1030-1054px stable; migrated ~6321-6375px stable; cross-run diff spread
  0.7072-0.7107% (±0.002) vs pre-fix ±0.14 swing. Determinism ACHIEVED;
  residual = stable latch-target disagreement (bklit latches far/outer ring
  w/ hairline emphasis + center-text swap [tooltipA=true]; migrated latches
  band-under-cursor w/ full 577-ring push-out).
Interpretation owed: the latch-target divergence predates the fix (old high
mode 0.50-0.58% = latched-but-mid-flight phases; steady latch = full push-out
= 0.71%). The lead's prescribed fix inherently produces this; needs an
explicit accept/rule in the report, not silent passage.
Also pending: n=4 mechanism probe w/ corrected bklit selector (`svg g` +
inline-style scan, plus center-text delta), radar ref check, measuredRect
ruling, 3 stale comments, resize harness (qa/resize-probe.mjs EXISTS — read
first). New fences: no edits to either styles.css (D297); new baselines ring
n=1000 settled 0.0100 / n=4 0.0000 / gauge 0.0053 / pie 0.0071. QA gate runs
are now the LEAD's; mine are bespoke research probes only.

### [RESUME#4] where I died — n=4 probe RESULT in hand, unlogged

Stale-comment fixes ALREADY LANDED before this kill (all three verified in
edit results): internal/radar-spring.ts:1-5 (now names enter-transition +
notes the T-C3 collapse/deletion), funnel-chart.tsx:101 → enter-transition,
funnel-chart.tsx:120 → enter-transition. NOTE: my first radar-spring edit
call used a TYPO'D path (...charts-migration missing the t) and errored;
the SECOND call with the correct path succeeded — §0's correction confirms
the file is edited, will re-verify on disk.
THE DECISIVE n=4 PROBE RESULT (temp-ring-n4-probe.mjs, harness-exact flight):
```
[bklit n=4]     SETTLED      emphasized=[]                              text="Total"
[bklit n=4]     HOVER+300ms  [1×scale(1.03), 3×scale(1.02)]             text="Ring 1"
[bklit n=4]     HOVER+700ms  [1×scale(1.03), 3×scale(1.02)]             text="Ring 1"
[bklit n=4]     HOVER+1500ms [1×scale(1.03), 3×scale(1.02)]             text="Ring 1"
[bklit n=4]     RELEASED     []                                         text="Total"
[migrated n=4]  ALL SAMPLES  []                                         text="Total"
```
Reading: bklit RETAINS a full latch (one hovered ring + all three outer
pushed out, center readout swapped to "Ring 1") indefinitely while the
cursor rests at r=56 — inside the centre hole, outside every band and
outside the 104px stat box. Migration releases to rest immediately.
This is the n=4 emphasis gap MEASURED at DOM level: the ~0.31% hover
residual = bklit's retained emphasis + swapped center text vs migrated's
settled-state pixels. Generic inline-style scan → valid on BOTH DOMs.
Mechanism (WHY bklit retains) still unnamed — one more probe owed:
elementFromPoint at rest + boundary-event log, to decide fix-vs-accept on
facts rather than theory. Remaining queue: that probe → radar ref check →
measuredRect ruling → resize harness via qa/resize-probe.mjs (READ FIRST)
→ final tsc → report.

### [ITEM 1] CLOSED — n=4 gap ruled ACCEPT-WITH-REASON (DOM-proven mechanism)

Probes: temp-ring-n4-mech.mjs (boundary events + elementFromPoint sampling),
temp-radialscan.mjs (radial elementFromPoint sweep), temp-hitpath/temp-
hitstack (path identity + isPointInFill), temp-radialscan-settled (control).
FACTS:
1. At the harness rest point (r=56, in the hole): bklit elementFromPoint →
   REAL path (ring0's track annulus d=M-72..A60,60, fill var(--border),
   pointerEvents auto); migrated → bare svg.ts-chart. bklit's last boundary
   event = pointerenter (no leave); emphasis flat-retained 1.2s+; center
   readout swapped to "Ring 1". Migrated: instant release, text stays Total.
2. Radial scan THROUGH the rest point, post-hover: bklit ring0-band
   hit-tests r∈[40,76] — far beyond its painted [60,72], inflated INWARD
   across the hole (~36px past inner edge). Migrated bands hit-test EXACTLY
   their painted extent ([60,72],[78,90],...).
3. CONTROL: settled/no-hover bklit scans EXACT [60,72] — the fat surface is
   hover-state-dependent, not a permanent geometry.
4. bklit isPointInFill(local inverse-mapped rest point) = true despite nominal
   geometry excluding it (scaled inner edge 61.8 > 56) — i.e. Chromium's
   hit-test of framer's transformed g disagrees with the analytic model;
   legacy's OWN DOM grants the retention. Not synthetic-event semantics.
INTERPRETATION: legacy retention is genuine legacy behaviour produced by a
legacy-side hit-surface anomaly we cannot reproduce without understanding it
(D299 lesson: don't port un-understood quirks off green gates). Migrated's
static-twin architecture yields exact-annulus hit surfaces — strictly closer
to legacy's SETTLED truth. RULING: ACCEPT. Evidence: residual ~0.31% stable
PASS at mandated density; n=4 settled 0.0000% post-D297; D298 precedent
(latch divergence accepted at n=1000 on same logic).

### [ITEMS 2+3] CLOSED — radar ref verified; measuredRect ruled FIX for both

Radar ref-attachment VERIFIED: single root div (:884-898) carries
ref={containerRef} on the ONLY return branch; no conditional JSX tree.
Legacy measurement mechanism confirmed from clone: BOTH ring-chart.tsx:465
and radar-chart.tsx:237 wrap in `<ParentSize debounceTime={10}>` in fluid
mode — identical to legacy pie's P9. So this is the SAME genuine parity gap
pie had, in three charts, not one.
RULING: FIX both. Edits:
- ring-chart.tsx :267-276 → useDebouncedContainerSize(containerRef); import
  swapped :66; provenance comment names pie :243-251 + gauge G5 precedent,
  states the enabled-param reasoning CHECKED for ring (single unconditional
  ref site + fixed-mode value never read).
- radar-chart.tsx :222-232 → same swap; import swapped :32; comment names
  legacy ParentSize at radar-chart.tsx:237 and cites its own ref line :885.
- Shared hook signature untouched (gauge's two call sites undisturbed);
  useMeasuredRect remains exported (live-line still imports it — unverified
  consumer, out of scope).
TSC_EXIT=0 after both edits.
Gate owed to lead (behavioral, invisible to tsc): resize-window probe on
pie+radar+ring through the 10ms debounce window; qa/resize-probe.mjs exists
but is sankey/showcase-specific — see next entry for the harness plan.

### [ITEM 4] CLOSED — three stale comments corrected (verified on disk)

radar-spring.ts:1-5 → now names enter-transition as the consumer + notes the
T-C3 collapse/deletion of the pie/ring/funnel shims (gauge-reveal re-export
note retained). funnel-chart.tsx:101 → `internal/enter-transition.ts`.
funnel-chart.tsx:120 → `internal/enter-transition.ts`. All three verified in
edit snippets + re-read from disk after RESUME#4.

### [ITEM 5] CLOSED — resize harness built AND RUN: ALL OK

Discovery chain (logged because it cost several probes):
1. qa/resize-probe.mjs = sankey/showcase-specific (label-based cell lookup,
   /charts/sankey route) — not reusable for pie/ring/radar.
2. NO existing surface exercises fluid mode anywhere: every bench scenario
   passes size={280}, every showcase demo a fixed size (ring 320/pie 280/
   radar 400). The debounce window was untestable without new surface.
3. Built showcase/app/charts/resize-lab/page.tsx — fluid-mode (no size prop)
   bklit+migrated × {pie, radar, ring} cells tagged data-resize-lab.
4. First probe attempt: page-viewport resizes are ABSORBED by the showcase
   layout (main pinned 744px, body scrolls) — cells never saw width change
   (diag: inner=700 but bodyScroll=744). Fixed by driving CELL widths
   explicitly via style.width — which is also exactly the ResizeObserver
   stimulus the debounced hook responds to. Steps 600→380→620 (third
   distinct width so a stale-width latch can't pass by luck).
RESULT: ALL OK — svg tracks commanded cell width exactly at all three steps,
bklit ≡ migrated at every step (600²/380²/620²), zero stale measurements,
zero impl disagreement. Verdict: the useDebouncedContainerSize swap in ring+
radar is behaviorally correct across resizes; parity holds through the
debounce window. Servers started for probes were stopped; ports verified free.

### [FINAL STATE] files touched this run (RESUME#3→#4 window)

- showcase/migrated/charts/internal/radar-spring.ts (comment only)
- showcase/migrated/charts/funnel-chart.tsx (comments :101/:120 only)
- showcase/migrated/charts/ring-chart.tsx (measuredRect swap + comment)
- showcase/migrated/charts/radar-chart.tsx (measuredRect swap + comment)
- showcase/app/charts/resize-lab/page.tsx (NEW lab page)
- research/phase-4/tools/temp-resize-probe.mjs (+ earlier temp-ring-* probes)
- notes file (this file)
KNOWN NON-MINE BREAKAGE: line-chart.tsx:96/132 Margin/DEFAULT_MARGIN missing
— P4-4-resume4 (pid 61670) edited line-chart.tsx 11:34:43, mid-edit state in
its own file. Excluded from my verdict; P4.4 to close.
DELETION LIST FOR LEAD: stray dir /Users/tomasdomingos/bklit-tanstack-chars-
migration/ (my typo'd write created it; contains one corrupted page.tsx).
[FINAL TYPECHECK]: raw `npx tsc --noEmit` = exit 1, but ALL remaining errors
are P4.4's in-flight Margin refactor migrating across chart files (line-chart
→ candlestick-chart between my two checks; identical TS2304 Margin/
DEFAULT_MARGIN signature). With P4.4's files excluded, zero errors — my
changes typecheck clean. My verdict: TSC_EXIT=0 for P4.3-owned surface.








### [T-C3] gate status

Ring n=1000 ×3 + n=4 hover runs still pending on the sibling-barrel incident;
pie/gauge/funnel n=1000 regression sweep likewise. Will retry once bench/app
build is self-consistent again.





