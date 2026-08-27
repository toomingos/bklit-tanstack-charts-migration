# 08 — Reach-in census (baseline)

Explore-agent scan, orchestrator-condensed, 2026-08-27. Ground truth: combined grep of
`querySelector(All)?` / `ts-chart__`|`ts-sankey__` literals / `data-ts-key` /
`setAttribute|style.setProperty|getElementById` over `showcase/migrated/**` (497 raw lines,
42 files), every ambiguous match ownership-verified by file read. Full site-by-site listing in
the agent transcript; this file is the actionable condensation.

**Headline: 259 real renderer DOM reach-in sites.** Self-owned overlay mutations (chrome that
builds its own SVG beside the renderer) are excluded from the tally — those layers die with
their subsystems anyway.

## Per-file counts → replacing subsystem

| File | Sites | Replaced by |
|---|---|---|
| radar-chart.tsx | 30 | S5 reveal + S1 hover (dot `r` states) + S3 |
| internal/bar-hover-chrome.ts | 30 | S1 (dim) + S3 (geometry) |
| ring-chart.tsx | 21 | S5 reveal + S1 |
| sunburst-chart.tsx | 19 | S5 (arc sweep + zoom morph) + S1 |
| pie-chart.tsx | 18 | S5 reveal + S1 |
| gauge.tsx | 17 | S5 (arc-sweep enter) |
| internal/hover-chrome.ts | 17 | S1 + S3 + S4 (label fade) |
| candlestick-chart.tsx | 14 | S5 reveal + S1 |
| choropleth-chart.tsx | 13 | S6 (projection-param zoom) + S5 reveal |
| bar-chart.tsx | 11 | S5 reveal + S1 |
| internal/bar-pulse-mark.ts | 11 | S5 (wave/clip sync moves inside the mark renderer) |
| internal/sankey-animation.ts | 11 | S5 (dash sweep inside mark renderer; CSS injection dies) |
| internal/choropleth-hover-chrome.ts | 11 | S1 (predicate states; reparenting wrapper dies) |
| internal/heatmap-components.tsx | 9 | S3 (pointer hit-test → native focus) + S5 reveal |
| sankey-chart.tsx | 7 | S3 (`clientToScene` replaces svg rect hit-test) |
| scatter-chart.tsx | 6 | S5 reveal + S1 |
| composed-chart.tsx | 5 | S1 + S3 + S5 |
| line-chart.tsx | 5 | S5 (wipe → ACCEPT-WITH-LOG single site) + S1 |
| internal/sankey-hover-chrome.ts | 5 | S1 (predicate states) |
| area-chart.tsx | 4 | S5 (wipe) + S1 |
| internal/deferred-reveal.ts | 4 (+ non-literal `dataset.bkmRevealed` writes) | S5 (file deleted) |
| internal/{candlestick,scatter}-hover-chrome.ts | 2+2 | S1 + S3 |
| internal/dash-tail.ts | 2 (+ `getAttribute("d")` geometry read) | S5 (authored dashed mark) |
| internal/radar-reveal.ts | 2 | S5 |
| internal/pie-hover-chrome.ts | 2 (elementMap `d`-rewrite + `style.transform`) | S5 (reactive definition grow) |
| authored-mark `className:"ts-chart__*"` defs (9 files) | 11 | rename to `bkm-chart__*` in each mark's subsystem commit (see scope ruling) |
| funnel-chart.tsx | 0 | out of scope (plain SVG, D30/D54) |

Zero-real-hit files despite grep matches (all self-owned): tooltip-chrome.ts,
tooltip-components.tsx, live-hover-chrome.ts, loading-chrome.tsx, chart-reveal-clip.tsx,
sunburst-reveal.ts, sankey-mark.ts, grid.ts, funnel-chart.tsx.

## Findings the subsystem reports didn't already carry

1. **Radar is a top offender (30)** — it predates the `deferred-reveal` centralization (stamps
   `data-bkm-revealed` on the svg root itself) and mutates renderer dot `r` directly on hover.
   Added to S1/S3/S5 chart lists in go-to-plan.
2. **Authored custom marks deliberately reuse `ts-chart__*` class names** so shared CSS/queries
   target renderer and custom marks uniformly. Once the queries die, the aliasing is pointless
   and defeats the grep guard → rename to `bkm-chart__*` (+ styles.css selector updates) inside
   each mark's subsystem commit.
3. **styles.css has 26 `ts-chart__` selectors** — CSS on renderer classes is a documented
   styling surface (themes-and-styling.md), incl. deliberate overrides (D234 focus-ring
   disable, hiDPI vector-effect). Not counted; guard scoped to `*.ts/*.tsx`.
4. `pie-hover-chrome`'s renderer mutation flows through an `elementMap`, not querySelector —
   the CI guard alone would not have caught it; census=0 verification must re-run this
   ownership-verified scan, not just the grep.

## Census scope ruling (for the 6.5 guard)

- Guard greps `querySelector|data-ts-key|ts-chart__|ts-sankey__` over
  `showcase/migrated/**/*.{ts,tsx}`.
- Allowed exceptions, by name, each D-logged: the S5 wipe-reveal single site (shared helper,
  `onRender`-scoped) and — only if the 6.3 spike fails — the choropleth transform write.
- styles.css excluded (sanctioned CSS surface); comments excluded.
