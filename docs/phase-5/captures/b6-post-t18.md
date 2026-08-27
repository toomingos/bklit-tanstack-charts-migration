# B6/T18 — post-implementation capture

Taken after `@visx/pattern` + `@visx/gradient` were removed from `showcase/migrated/**`
(D396). Compared against `captures/b6-pre.md` and BASELINE §1. **All runs below were executed
by the lead, not reported by the implementing agent.**

## Tier-tracked charts (mandated by the T0/T1 policy)

| chart | tier | n | settled | hover-30 | hover-50 | hover-70 | vs pre/BASELINE |
|---|---|---|---|---|---|---|---|
| `candlestick` | **T0** | 1000 | 0.3025 | 0.4953 | 0.3661 | 0.3618 | **bit-identical, all 4** |
| `heatmap` | **T1** | 52 | 0.4277 | 0.3466 | 0.3533 | 0.4256 | **bit-identical, all 4** |

Zero movement on either. Expected: both charts' pattern call sites are dead in-gate (no scenario
sets `bodyPatternPositive`/`bodyPatternNegative` or a patterned `levelStyles`), so the modules are
imported but the pattern branches never execute. The captures confirm the port introduced no
module-level side effect.

## Covered pattern gates

| gate | n | result | vs BASELINE |
|---|---|---|---|
| `patternarea` | 1000 | **PASS** 0.0002 / 0.0002 / 0.0541 / 0.1388 | **bit-identical, all 4** |
| `patternarea` — 8 preset cells | 1000 | **PASS** none 0.1276 · diagonal 0.1293 · horizontal 0.1229 · vertical 0.1656 · cross 0.1323 · dots 0.1340 · circles 0.1536 · accent 0.1327 | all well under gate |
| `brush` | 1000 | **PASS** settled 0.0001, brush-clear 0.0001 | settled matches |
| `barsquares` | **100** | **PASS** 0.0049 / 0.1360 / 0.1503 / 0.1486 | matches (BASELINE 0.0049 / 0.1364 / 0.1504 / 0.1486) |

Typecheck: `npx tsc --noEmit` exit 0, no output.

## Two corrections to the implementing agent's reported numbers

**1. Its `barsquares` FAIL was an artifact of the wrong density.** The agent ran `--n 1000`;
`GATE-MAP.md:30` mandates **n=100** for `barsquares`. At n=1000 it reported overall FAIL with three
"tooltip not visible" heuristic failures. At the mandated n=100 the run is **PASS with
`tooltipB=true` on every cell**. The agent did `git stash`-verify the failure was pre-existing —
good practice — but verified it at a density this gate does not use. There is no tooltip defect.

**2. Its `patternarea` hover-70 of 0.1139 was a noise excursion, not an improvement.** The lead's
re-run returns **0.1388 — exactly BASELINE**. This is the same failure mode that produced the
0.0199 candlestick error corrected in D394: a single reading on a hover cell was treated as a new
value. Hover cells in this project must be re-run before any conclusion is drawn from them;
settled cells have been deterministic in every measurement taken so far.

## What remains unverified, and why

5 of 8 pattern call sites and **all 11 gradient components** have no pixel coverage in any gate
(D394). Their correctness rests on source fidelity, which the lead spot-checked directly rather
than inferring from green gates:

- `Lines` path templates are **byte-identical to visx including newlines and indentation**; the
  only textual difference is `(3 / 4) * height` vs `3 / 4 * height`, which evaluates identically.
- `Hexagons` preserves the quirk of **ignoring its `width` prop** and overriding the tile to
  `width={size}` / `height={sqrt(size)}` while computing the path from the passed `height`.
- `Circles` keeps `radius = 2` with `fill` **left undefined** (SVG-default black), not `fill="none"`.
- `LinearGradient` reproduces the `vertical && !x1 && !x2 && !y1 && !y2` coordinate-default branch.
- **All 11 `.displayName` strings preserved byte-for-byte** — the coupling `pie-chart.tsx:131-132`
  and `gauge-notch.ts:63-64` use to hoist consumer-supplied children into `<defs>`. A break here
  would be invisible to every gate in the project.
