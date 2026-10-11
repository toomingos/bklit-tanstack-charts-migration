# Phase 8 — fixer rules (revised)

Replaces the one-line rule list the lead gave fixer agents ("no rAF loops or tuned delays
without a bklit source, no wrappers over TanStack internals, never write renderer-owned
nodes, no definition rebuilds on hover, no overlays, remove replaced code, tsc clean").
An independent audit found that list guarded convention more than nativeness; each rule
below says what it rests on. `PLAN-phase-8.md` ground rules still apply; this file is what
goes into a fixer brief.

## Rules

1. **Evidence before custom code.** Before writing anything that is not a `defineChart`
   composition of built-in marks/layouts, cite in the commit message or LOG the docs page
   and the TanStack source `file:line` showing no native path covers it — after trying, in
   order: mark `states`, `whenFocused`, the interaction controller / `setControlledFocus`,
   `motion()`, a documented custom mark (`guides/custom-marks-and-renderers.md`).
   *Rests on:* PLAN rule 2 ("unless the docs prove there is no native path"), which the old
   brief dropped.

2. **Don't write to, read from, or key on renderer-owned DOM.** No attribute writes on nodes
   the renderer created, no reading their attributes back, no selectors that depend on the
   `data-ts-key` encoding. Attributes and CSS variables on the chart host element are fine.
   *Rests on:* `charts-core/src/reconcile.ts:159-168` (`syncAttributes` strips every attribute
   the next scene lacks); `docs/guides/interactions-and-selections.md:335`; the key encoding
   is undocumented (UPSTREAM-GAPS #36).

3. **Never reach into private TanStack state.** No `Object.getOwnPropertySymbols`, no private
   symbols, no undocumented fields. Wrapping a mark is allowed only in the documented form
   (`reference/custom-extensions.md`, `decorative()`), and only around public behaviour.
   *Rests on:* `guides/custom-marks-and-renderers.md` ("private scene compiler state").

4. **Timers and frames.** rAF and timers are not banned by TanStack (its renderer uses rAF).
   But entrance clocks and ready gating come from `motion()` or CSS; every remaining timer or
   frame wait carries a comment citing the bklit `file:line` it reproduces. A value with no
   such source is removed, not tuned. Mimicking a bklit mount-chain artifact needs a lead
   ruling in LOG.

5. **Hover cost is a measured budget, not a ban.** Definition identity is TanStack's update
   boundary (`guides/dynamic-data-and-animation.md`), so rebuilding on hover is allowed when
   the Live Perf panel shows it within budget (hover p50 ≤ bklit + 2.5 ms, no visible dim
   lag). Choosing CSS over mark `states` must record the measured `states` cost (gap #1).

6. **HTML is fine where the docs allow it.** Tooltip bodies and the `portal` extension
   (`reference/focus-and-interaction.md:790-816`) and bklit's own HTML (NumberFlow centre
   text) are allowed. Not allowed: hand-built DOM that duplicates the native crosshair,
   focus guide or tooltip.

7. **Browser support is stated.** CSS that needs `sibling-index()` or typed `attr()` gets an
   `@supports` fallback (no hover emphasis is acceptable), or the claim says "Chromium only".

8. **Every shim names its gap.** Code that exists because of an upstream limit carries the
   UPSTREAM-GAPS number in a comment; a shim with no gap number fails review.

9. **Hygiene.** Remove replaced code; `cd showcase && npx tsc --noEmit -p . | grep error`
   prints nothing; no console errors on the route.

10. **Record upstream limits as you find them.** When work hits a TanStack limit, or finds that
    a posted issue (#186–#198) is wrong, fixed, or incomplete, write it to `docs/upstream-issues/`
    and say so in your report: correct the matching draft (`NN-*.md`, mark the change "pending
    update to #NNN" in README), or create the next-numbered draft (status "draft, not posted" in
    README) with evidence in `_evidence/`. Same style as the posted ones: short paragraphs, plain
    language, only the sections needed, every claim cited to TanStack source or docs at the
    current main. Merge into an existing draft when it is the same component or feature. Never
    post to GitHub; the user reviews and decides at the end.

## QA brief changes

- Re-report an accepted difference when its size or cause has changed (replaces "don't
  re-report accepted differences").
- Each QA pass includes a native audit: grep the touched files for rAF, `setTimeout`,
  `querySelector`, `setAttribute`, `getOwnPropertySymbols`, `data-ts-key`, and mark
  `initialize`/`render` wrapping; each hit must match rules 1–4 or be reported.

## Known violations of these rules (verified)

| Where | Rule | What |
|---|---|---|
| (none) | | The last one, sunburst's `scene-motion-node` read, was removed in D795. |

`kit/tooltip/bklit-tooltip.ts` `bklitTooltip` (gap #19; was liveline's `liveTooltip`, now shared by every TooltipBox route) is not a rule-3 violation: it is a typed `ChartTooltipExtension` (public, `reference/types.md:352-355`, exported from `@tanstack/charts/tooltip`) composing only the public `tooltip.create` and instance interface; no private state, no casts. Retained because no tooltip option stops the repeated `hide()` (`motion: false` drops bklit's exit fade).

The radar fill read-back (rule 2) was fixed in 13a8cef. Since resolved: bar depth trim (custom mark, f0593ef), heatmap `data-hm-active`, scatter `+ 60`, liveline `INTRO_DELAY_MS` (7f6b651), sunburst `SEED_MS`, hover-host double-rAF (now keyed on focus history), `@supports` guards (823c875), LOG:675 vs parent-size-arm (ruling b3cf02e). Sunburst `REHOVER_DELAY_MS = 135` replaced by the enter sequence derived from bklit's zoom tween, morphing geometry, centre disc and paint order (`charts/sunburst/`), gated on an active window like Blink's synthetic hover move.
