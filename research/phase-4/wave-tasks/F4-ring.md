# F4 — ring hover instability: diagnose before anyone proposes a fix

Repo root: /Users/tomasdomingos/bklit-tanstack-charts-migration

## WRITE INCREMENTALLY
Write each file to disk as soon as its edit is complete. Uncommitted work survives interruption; a resumed session picks up from the working tree.

## Rules
- MAIN GOAL: exact same frontend design/interactivity as legacy bklit; TanStack-native backend; identical public component API.
- D232: fixes live in committed `showcase/` code ONLY — never patch the clones (`repos/bklit-ui/`, `showcase/repos/tanstack-charts/`; both gitignored, Vercel re-clones fresh). Clones are read-only reference.
- Do NOT write to `qa/`, `bench/` (running their scripts is allowed), the clones, or `/tmp`. A guard hook denies these.
- Do not commit; leave changes in the working tree.
- `go-to-plan.md` is the source of truth (staleness rule 4.4.4).

## This is a DIAGNOSIS task first. Do not open with a fix.
The evidence below is strong enough to say *something* is wrong and weak enough that the obvious fix may be the wrong one. **Establish the mechanism with a trace before changing a line.** If your diagnosis contradicts the hypothesis below, say so — that is a good outcome, not a failure. My previous two hypotheses on chronic hover failures (choropleth, pie) were both wrong, and both were caught by an executor who measured instead of assuming.

## The evidence

I pulled **every ring QA run ever recorded** (48 runs, 2026-07-31 → today). The pattern is far older and far clearer than a single wave's worth of runs suggests, and it has one dominant signature:

> **`settled` is deterministic at every density. The hover captures are bimodal — they land on one of two discrete levels, never a continuum.**

Recent, at `--n 1000`:

| run | settled | hover-30 | hover-50 | hover-70 | verdict |
|---|---|---|---|---|---|
| `2026-08-21T11-13-50-919Z` | 0.0868 | 0.0915 | 0.0950 | 0.0965 | PASS |
| `2026-08-22T11-26-23-495Z` | 0.0868 | 0.0873 | 0.0953 | **0.5253** | FAIL |
| `2026-08-22T11-32-52-112Z` | 0.0868 | 0.2555 | 0.0968 | 0.0869 | PASS |
| `2026-08-23T20-05-48-948Z` | 0.0868 | **0.5012** | 0.0919 | 0.4952 | FAIL |
| `2026-08-23T20-09-43-050Z` | 0.0868 | **0.5163** | 0.0978 | 0.0902 | FAIL |
| `2026-08-23T20-18-05-790Z` | 0.0868 | **0.5771** | 0.0982 | 0.3951 | FAIL |

The last three are **solo repros run minutes apart on unchanged code** — not batch contention. `settled` is 0.0868 in all six.

The same bimodality at `--n 4`, going back to **2026-07-31**, with `settled` pinned at 0.0602:

| run | settled | hover-30 | hover-50 | hover-70 |
|---|---|---|---|---|
| `2026-08-07T22-43-52-841Z` | 0.0602 | 0.3123 | 0.3146 | 0.0742 |
| `2026-08-07T23-48-33-262Z` | 0.0602 | 0.3210 | 0.0729 | 0.3194 |
| `2026-08-08T15-40-24-362Z` | 0.0602 | 0.3213 | 0.2543 | 0.3193 |
| `2026-08-09T17-39-54-085Z` | 0.0602 | 0.3182 | 0.3182 | 0.0756 |
| `2026-08-09T19-02-28-003Z` | 0.0602 | 0.3155 | 0.3162 | 0.0702 |

Every hover cell here is either ≈**0.07** or ≈**0.32**.

At `n=1000`, sorting all 18 hover cells ever recorded shows the same shape, with an important wrinkle — **be precise about this, it matters**:

```
LOW MODE (11):  0.0869 0.0873 0.0902 0.0915 0.0919 0.0950 0.0953 0.0965 0.0968 0.0978 0.0982
INTERMEDIATE (2):                    0.2555        0.3951
HIGH MODE (5):        0.4952 0.5012 0.5163 0.5253 0.5771
```

So it is **strongly bimodal but not strictly so**: a very tight low mode (0.087–0.098, spread of 0.011), a diffuse high mode, and **two genuine intermediates**. I initially wrote "nothing in between, ever" — that was wrong, and the correction cuts in favor of the oscillation hypothesis rather than against it. A *strictly* two-valued distribution would suggest a settled race between two stable states. **Intermediates are what you get when the screenshot catches a spring mid-flight** — real motion at capture time. Treat the two intermediates as signal, not noise.

And at `--n 100`, which has **failed every single run since 2026-08-18**, the bad mode is enormous:

| run | settled | hover-30 | hover-50 | hover-70 |
|---|---|---|---|---|
| `2026-08-18T21-42-09-035Z` | 0.0675 | 1.6783 | 0.2022 | 1.7323 |
| `2026-08-20T17-53-59-628Z` | 0.0675 | 1.5955 | 0.2041 | 1.7100 |
| `2026-08-20T22-33-33-392Z` | 0.0675 | 1.7259 | 0.2025 | 1.7087 |

### What this history actually establishes — read it before you form a hypothesis

1. **This is not a Wave 2 regression, and not a Wave 1 regression either.** The bimodal hover divergence is present in the *earliest* ring runs on record. Do not spend time bisecting recent waves. What changed recently is only that at `n=1000` the bad mode sits at ~0.50% — straddling the 0.5% `COMPARE_GATE` — so the same old defect started reading as "flaky" instead of "clean" or "broken."
2. **A two-state process sampled at a random phase, not jitter.** 11 of 18 hover cells sit in a 0.011-wide band and 5 sit in a high band, with 2 caught in transit. That is a capture sampling a **binary state with real motion between the states** — "was the element hovered at the moment of capture, and if it was mid-transition, how far." Much more specific than "flaky", and directly checkable.
3. **The magnitude scales with density** (0.32 at n=4 → 0.50 at n=1000 → 1.7 at n=100), which tells you the diverging pixels are *chart content*, not a fixed-size piece of chrome like a tooltip. n=100 being the worst is worth a thought — it is not the extreme of that range.
4. **`hover-50` is the well-behaved probe at n=1000 and n=100** (0.09–0.10 and ~0.20 respectively) while 30 and 70 misbehave. Position-specific. At n=4 even hover-50 goes bimodal. Whatever the ejection geometry is, it depends on where the probe lands relative to the ring.

Facts 1 and 2 are the load-bearing ones. **Explain the two-state behaviour and you have solved this.**

### Concrete details from the Wave 2 gate-runner, which characterized ring independently
- The failing probe point is **fixed at (108,164)** in a 1200×800 viewport. Start there — you do not need to search for it.
- `settled` is **833 diff px in every run since Aug 21**, byte-identical. The settled render genuinely does not move.
- hover-30 diff px: 878 (Aug 21) → 2453 (Aug 22) → 4956 / 5540 (Aug 23). The runner read this as a drift trend. **I read it as the high mode becoming more frequent, not larger** — the high band has sat at 0.50–0.58% since Aug 22 while the low band never moved. Worth your own look; if the runner's drift reading is right and mine is wrong, say so.
- In today's solo runs `tooltipVisibleB=false` while bklit showed a tooltip at that point; in the second solo run B's tooltip **did** render and the diff got *worse*. Ring is in `TOOLTIPLESS_CHARTS` so this never asserts, but it means the divergence is **not** merely "migrated is missing a tooltip" — the runner explicitly ruled that out.

## Leading hypothesis (D255) — test it, do not assume it

A repo-wide audit dispatched hours before this failure independently flagged **ring as the single remaining "moving hit area" site in the codebase**:

> `ring-chart.tsx:725` binds `pointerenter` to the **same** track group that `ring-hover-chrome.ts:104` scales by 1.03. Scaling an *annulus* about its center makes the **inner** edge recede outward by ~`0.03 × innerRadius` (≈3–4px), and unlike pie there is no sibling surface behind the hole to catch an ejected cursor — a pointer parked in that thin inner band can drop out and oscillate.

An oscillation would explain the whole evidence table: `settled` untouched (no hover → no oscillation); hover captures **bimodal** because the 700ms `HOVER_WAIT_MS` screenshot catches whichever phase the oscillation happens to be in — hovered or ejected, two states, exactly the two levels the data shows; probe-position dependence, because only probes landing in the thin ejection band are affected; and magnitude scaling with density, because what differs between the two phases is the springing chart content itself.

That is a good fit. It is not proof. **A competing explanation you must rule out**: the two impls could simply *settle into different stable hover states* and the "bimodality" be nothing more than which impl won a startup race — no oscillation, no ejection band, just a hover-state disagreement. A churn count discriminates these immediately: sustained enter/leave churn means oscillation; zero churn with a persistent disagreement means the race. **Run the count before you commit to either.**

**This exact pattern has now been confirmed twice in this codebase** — sunburst (D251) and pie (D254). In pie it produced a *stable* 3.18% for four runs; here it would produce an unstable one. Understand why the two differ before you accept the hypothesis.

**The diagnostic the audit specified**, which is your starting point:
> Playwright-hover at computed coordinates just inside the track's inner rim, then count `pointerenter`/`pointerleave` churn on the track group (or sample the coordinator's hovered value) over ~2s.

Also worth doing, because it is what cracked pie open: **diff each impl's hover capture against its *own* settled capture** rather than against the other impl. In pie, bklit changed 30,342 px on hover while migrated changed 408 — the asymmetry localized the defect immediately. The PNGs are in the run dirs listed above.

## Head start — a previous run's design, salvaged before it was lost

An earlier attempt at this task got as far as designing the diagnostic and was then killed by an infrastructure hang (nothing to do with the work). **Its design was good — start from it rather than re-deriving it**, and improve on it if you see better:

- **Capture-phase `document` listeners for BOTH event models**: `pointerenter`/`pointerleave` (what migrated binds natively) *and* `mouseover`/`mouseout` (what drives bklit's React synthetic `onMouseEnter`). Without this you measure two different things on the two sides and the comparison is worthless.
- **Frame-by-frame sampling of `elementFromPoint(probe)`** plus each tracked group's live transform, for ~2.5s after hover-in. This is the discriminator between oscillation (sustained churn) and the race hypothesis (zero churn, persistent disagreement).
- **Dump the ancestor transform chain of the track groups.** This is the sharpest idea from that run and it may overturn the mechanism I described above, so test it early: `transformOrigin: "0px 0px"` only pivots at the **ring center** if TanStack wraps marks in a `translate(center,center)` group the way visx does. **If no such wrapper exists, the 1.03 scale pivots at the SVG origin and translates the entire ring** rather than merely widening the inner rim — a far bigger displacement, and a much better fit for the 1.6–1.7% seen at `n=100` than my "≈3–4px inner band" story. If that is what is happening, say so plainly: my mechanism description in this brief is then wrong, and the fix is different (correct the transform origin / add the centering wrapper) — and it would very likely be a **migrated-only** defect, i.e. outcome (b).

The dev server for that run came up on port 5198; a scratch file `temp-ring-selfdiff.mjs` may still be at the repo root from it — reuse or overwrite it freely.

## The critical complication — read this before proposing any fix

**D255 ruled ring ACCEPT, not FIX, and that ruling stands unless your evidence overturns its premise.** The reason: **legacy bklit has the identical structure** — `repos/bklit-ui/.../ring.tsx:179-188` binds `onMouseEnter/Leave` to the same `motion.g` it springs. So if this is the oscillation, **legacy oscillates too**, and "fixing" migrated would be a deviation from legacy under DOC-1 — the opposite of the MAIN GOAL.

That creates three genuinely different outcomes, and your job is to determine which one is true:

- **(a) Both sides oscillate.** Then the diff is comparing two independently-nondeterministic captures and the failure is a **harness/parity artifact**, not a code defect. The right output is a recommendation about the gate (e.g. probe placement, or accepting ring hover as nondeterministic-by-parity), **not** a code change. Say so plainly.
- **(b) Only migrated oscillates**, because some migrated-side difference (spring config, event type — `pointerenter` vs `mouseenter` — scale origin, an extra `pointerEvents` surface, DOM ordering) makes its ejection band real where legacy's is not. **That is a genuine migration defect and should be fixed**, and the parity-neutral fix is to bind the listeners to an **unscaled wrapper `<g>`** around track+progress (zero pixel change).
- **(c) It is not oscillation at all.** Then report what it actually is.

**Do not fix under (a).** Do not silently overturn D255 — if your evidence contradicts it, say explicitly that it does and why, and let the ruling be revisited on the record.

## Wave 2 is already ruled out — do not re-bisect it
I have settled this from the history above: the bimodal hover divergence predates every wave. For the record, Wave 2's ring edits were `internal/ring-hover-chrome.ts` (`RingHoverConfig.groupEl` shim removal, fake-`Animation` sentinel typing, single cleanup registration), all reported as already-landed-by-a-prior-session and merely completed; `git diff -- '*ring*'` shows them. Read that diff once for context if it helps you understand the current code, but **do not spend turns bisecting waves** — the answer is upstream of all of them.

## Explicitly out of scope
- **markers `--n 100` hover-30 ≈ 0.5507%** is a *separate*, **pre-existing, deterministic** failure — 0.5489 on 2026-08-20, 0.5507 on 2026-08-23 pre-Wave-2, 0.5507 twice post-Wave-2. Not yours. Do not investigate or fix it.
- **ring at `--n 100`** (the 1.6–1.7% rows) is shown above as *evidence about the mechanism*, not as a target. The gate density for ring is `--n 1000`. If your fix happens to also collapse the n=100 divergence that is a strong confirmation and worth reporting — but do not go chasing n=100 as a deliverable.
- Do not touch any file outside the ring cluster without reporting first.

## Gates (only if you make a code change)
- `cd showcase && npx tsc --noEmit` exits 0; production build succeeds.
- Solo `node qa/screenshot.mjs --charts ring --n 1000` — **run it at least 3 times** and report all three, because a single passing run proves nothing about a nondeterministic failure. (`pnpm qa -- --chart x` is broken — it injects a literal `"--"` argv element the parser rejects. Use `node qa/screenshot.mjs` directly.)
- Confirm no other chart regressed if you touched a shared file.

## Report back
- **The mechanism, with the trace output that proves it** — not a plausible story.
- Which of (a) / (b) / (c) is true, and the evidence that discriminates between them.
- Whether it predates Wave 2, with evidence.
- If you changed code: what, why it is parity-neutral, and the three ring runs.
- If you did NOT change code: say so clearly and give your recommendation. **A well-evidenced "this needs no code change" is a complete and successful outcome for this task.**
- Anything unresolved, honestly. Do not omit a failure.
