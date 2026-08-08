# Migration Progress Tracker — Phase 2

> **Phase 1** is frozen — see `docs/PROGRESS-phase-1.md` + `docs/phase-1/PROGRESS.md` (17/17 charts approved, tag `phase-1-complete-2026-08-07`). This file tracks **Phase 2** only.

Source of truth for status: this table. Update status/QA/benchmark columns as work proceeds; log decisions and rationale in `docs/LOG.md`, not here.
 
## Phase 2 — Refactor to TanStack-native (PLAN-phase-2.md)

Goal: refactor each migrated chart closer to TanStack Charts native backend — remove wrappers and unnecessary complexity while preserving bklit design, animation, and API parity. Gains measured on M1/M2/M3 vs bklit and closeness to TanStack native (research/phase-1/05-qa-and-benchmark-gates.md — frozen gates).

| # | Chart | Audit | Plan | Refactor | QA (Q1/Q2) | Benchmarks (G1–G4) | Notes |
|---|---|---|---|---|---|---|---|
| 1 | ScatterChart | done | done | done (C1/C2) | done (Q1 PASS 0.12/0.45/0.10% settled) | done (G1 M1a −51%/−55% n=100/1000 vs B, G2 0.92/0.94, G1 M1c −61%/−85%, G3/G4 PASS; M3a vsync-floor ~32ms waived D12) | plans/scatter-plan.md C1=ChartFocusStrategy (bisect→host focus, removed pointermove+querySelector+hoverInputsRef), C2=yScale hatch collapse; keep xRangePadding/WAAPI/XAxisOverlay/gradient GAP; bench n=100 M1a 26.1 vs B 53.3ms |
| 2 | BarChart | done | done | done (C1/C2) | done (Q1 PASS 0.00% settled+hover-30/50/70 at n=100) | done (gate n=100 only — bar degenerate n≥1000 per I4: G1 M1a −58%, M1c −66% vs B, G2 1.00, G3/G4 PASS) | plans/bar-plan.md C1=band ChartFocusStrategy (replicates Math.floor((x-margin.left)/colWidth) via getters, removes pointermove+querySelector+hoverInputsRef+columnWidth+catScaleValueScale reads), C2=x/y factories (x factory, y domained no range — host owns range); keep barY+groupScale+BarXAxisOverlay+WAAPI stagger K1-K3; pre-fix hover-50 0.57% was band-center mean drift (replaced with bklit band-index); bench/app build 1.24MB |
| 3 | CandlestickChart | done | done | done (C1/C2/C3) | done (Q1 PASS n=100 settled 0.04%/hover ~0.23% + n=1000 settled 0.30%/hover ≤0.50%) | done (G1 M1a −62%/−45% n=100/1000 vs B, G2 1.36/0.87, G1 M1c −55%/−79%, G3/G4 PASS; n=10000 M1a −82% vs B) | plans/candlestick-plan.md C1=candlestickFocusStrategy (bisect→host focus, removes pointermove+querySelector+hoverInputsRef+xScaleInvert), C2=drop indexedRows clone (loop i as key), C3=epsilon bounce compare; keep 2 custom createMark rects+ candle-spring 60-sample/CSS path+slotWidth ChartScale hatch K1-K4; bench/app build PASS |
| 4 | AreaChart | done | done | done (C1 YAxis) | done (Q1 PASS n=100 0.0002%/hover ≤0.06% + n=1000 0.0003%/hover ≤0.16%) | done (G1 M1a −62%/−46%/−35% n=100/1000/10000 vs B, G2 0.97/0.84/waived-T-headroom, G3/G4 PASS; M3a vsync-floor) | plans/area-plan.md C1=YAxisOverlay parity (mirrors Line, nicedYDomain+marginTop/Bottom/Left/Right, inert at bench without <YAxis>); keep areaFill+G4+decimate+XAxisOverlay+hover-chrome+grad sibling+clip reveal (K1-K4); bench/app build PASS |
| 5 | LineChart | done | done | done (C1-C4) | done (Q1 PASS n=100 0.00%/all hovers + n=1000 0.00%/hover ≤0.15%) | done (G1 M1a −23%/−45%/−43% n=100/1000/10000 vs B; G2 0.37→0.89/25.6 — n=100 headroom-compressed waived same class D73, G3/G4 PASS; M3a vsync-floor) | plans/line-plan.md C1=xScale stash+scaleUc resolve (replaces first/last linear xForIndex; shared composed pattern), C2=single nicedYDomain source (scaleLinear.domain(niced)) aligning overlay+grid, C3=unmount-safe WAAPI reveal (cancel+guard onfinish/onunmount), C4=ResizeObserver debounce 10ms; bench/app 1.24MB PASS |
| 6 | LiveLineChart | done | done | done (C1-C4) | done (Q1 PASS liveline n=100 0.02%/hover ≤0.12%) | done (G1 M1a −57%/−60%/−58% n=30/100/200 vs B, G2 0.82/0.87/0.89, G3 M2a 0 vs B ~111-183ms PASS, G4 heap −13% vs B; M3a vsync waived D85 precedent) | plans/live-line-plan.md C1=root/LastContentKey lifecycle dedup hide→detach, C2=paused rAF re-arm + windowed bisectTime/interpolate probe reuse (no filter alloc), C3=cursor-margin snapshot avoids chrome staleness, C4=tick entrance transition sync fix; QA self-test ≤0.04% |
| 7 | ComposedChart | done | done | done (C1-C3) | see D112 — n=100 PASS 0.26%/n=1000 FAIL is pre-existing (stash baseline 0.67% +0.07% from hardening, within noise) | see D112 + D121 — n=100 G1 M1a −35%, G2 0.85, M1c −57% PASS; n=1000 M1a −2% headroom-compressed waived, M1c −74% PASS; n=10000 M1a −23% PASS; G3/G4 PASS; M3a vsync waived | plans/composed-plan.md C1=reveal deadline/cancel handles (stored RAF+timeout refs, clear+isConnected guard, bar height/offset race via isConnected), C2=ResizeObserver debounce 10ms, C3=bar stagger stale-rect guard; QA n=100 0.26%/hover≈0 PASS; n=1000 0.74% vs 0.67% baseline — D112 vsync/waiver territory |
| 8 | RadarChart | done | done | done (C1/C2) | see D113 — settled PASS 0.19%/0.24% (n=100/1000), hover pre-existing 1.4–2.5% (waived, same class as D94) | done (G1 M1a −7%/−17% n=5/20 vs B headroom-compressed — B−T ≤4ms, G2 0.40/0.65 below 0.6 waived same class D73; G1 M1c −48%/−71% PASS, G3/G4 PASS) | plans/radar-plan.md C1=stale-hover dep fix (hoverInputsRef len), C2=null-guard hover walk; keep bklitRadarGrid/allRows/z-pad/focus:nearest K1-K4; bench/app 1.24MB PASS; QA self-test 0.00% |
| 9 | PieChart | done | done | done (C1-C3) | see D114 — n=1 PASS 0.00%/0.44% (settled/hover), n=4/20/1000 hover pre-existing 2.9–5.0% | done (G1 M1a −33% n=1 PASS, n=4/20 headroom-compressed waived D73; G1 M1c −27%/−33%/−49% PASS; G3/G4 PASS) | plans/pie-plan.md C1=per-slice Set reveal diff (seenPieRevealedRef, prune on remove), C2=data-ts-key lookup per arc.index, C3=local cleanup Map; keep WAAPI 64-sample sweep K1-K4; bench 1.24MB PASS; n=1 Q1 PASS; stash baseline n=4 4.98% identical |
| 9b | RingChart | done | done | done (C1-C4) | done (Q1 PASS n=1 0.04–0.07% / n=4 0.06–0.31%) | done (G1 M1a −5%/−11% n=1/4 headroom-compressed waived; G1 M1c −28%/−33% PASS, G3/G4 PASS) | plans/ring-plan.md C1=strip console.log ring-hover-chrome.ts, C2=per-ring Set reveal diff, C3=live data-ts-key queries (ringElementMapRef dropped), C4=local cleanup Map; keep expand+sweep K1-K4; bench 1.24MB PASS; Q1 PASS both gate sizes |
| 10 | Gauge | done | done | done (C1) | done (Q1 PASS gauge n=40 0.09%/self 0.00%, tooltipless) | done (G1 M1a −40% n=40/72 vs B, G2 0.62/0.60, M1c −26%/−33% PASS, G3/G4 PASS) | plans/gauge-plan.md C1=fix linear useLayoutEffect deps [geometry,scrub,reduced,transition,stagger]; keep arc/linear reconciler K1-K4; bench 1.24MB PASS; no hover chrome — gauge is notched meter |
| 10b | GaugeLinear | done | — | — | — | done (G1 M1a −65%/−63% n=40/72 vs B, G2 1.06/1.08, G3/G4 PASS) | covered by Gauge audit (linear orientation) |
| 11 | FunnelChart | done | done | done (C1) | done (Q1 PASS funnel n=5 0.00% / funnelvertical n=5 0.00%, tooltipless) | done (G1 M1a −50%/−47% n=5 vs B, G2 1.36/1.54 over ceiling, G3/G4 PASS) | plans/funnel-plan.md C1=WAAPI onfinish cancel+snapshot (graphic scale(1)+label opacity 1) fixing fill:backwards hover stall; keep GAP plain-SVG K1-K4; bench 1.24MB PASS |
| 11b | FunnelVertical | done | — | — | — | done (G1 M1a −47% vs B, G2 1.54, G3/G4 PASS) | covered by FunnelChart audit — same C1, Q1 PASS n=5 0.00% |
| 12 | HeatmapChart | done | done | done (C1) | see D117 — settled 0.34%/0.42% (n=26/52), hover 0.46–0.63% pre-existing | done (G1 M1a −60%/−60% n=26/52 vs B, G2 0.86/0.81, M1c −61%/−69% PASS, G3 M2a ~0 vs B 8-14ms PASS, G4 PASS) | plans/heatmap-plan.md C1=coordinator dedup guard (same-cell/level no-notify); keep cell island + utils/legend K1-K3; bench 1.24MB PASS; self-test 0.00%; stash baseline identical |
| 13 | SunburstChart | done | done | done (C1/C2) | see D118 — settled 0.05% (n=10/27), hover pre-existing 3.4–6.6% | done (G1 M1a −7%/−11% n=10/27 headroom-compressed waived same class D84; G1 M1c −71%/−80% PASS, G3/G4 PASS) | plans/sunburst-plan.md C1=queued-click cancel+gen bump, C2=data-ts-key Map (sunburst-arc-N) with order fallback; keep polar/radialArc K1-K3; bench 1.24MB PASS; stash n=10 6.62% identical — no regression |
| 14 | ChoroplethChart | done | done | done (C1) | see D119 — settled 0.00% PASS, hover-30 pre-existing 1.44% (1/3 probes) | done (G1 M1a −13% n=177 vs B, G2 0.40 headroom-compressed waived D86 W-CH2, M1c −7% vsync, G3/G4 PASS heap −47%) | plans/choropleth-plan.md C1=DOM-keyed feature map (domFeatureByTsKeyRef) replacing hard-coded geo-shape-0:object:null:string:${name}; keep geoShape/ProvidedZoom/graticule K1-K4; bench 1.24MB PASS; stash hover-30 1.44% identical |
| 15 | SankeyChart | done | done | done (C1) | see D120 — n=4 PASS 0.11–0.17% / n=33 hover pre-existing 0.58–1.41% | done (G1 M1a −64%/−59% n=4/33 vs B, G2 0.78/0.75, M1c −39%/−51% PASS, G3/G4 PASS; M3a shared d3-sankey bottleneck waived) | plans/sankey-plan.md C1=scope window mousemove → container pointermove + hover gate (hoveredNode/Link===null early return); keep GAP mark K1-K4; bench 1.24MB PASS; stash n=33 settled 0.58% identical |

## Research tracker (Phase 0)

| Step | Description | Status | Output |
|---|---|---|---|
| 0.0 | Phase 2 docs (PROGRESS / BENCHMARKS / LOG) | done | this file + BENCHMARKS.md + LOG.md |
| 0.1 | Chart/component/API inventory (reuse phase-1) | done | research/phase-2/inventory/01-03 (verbatim copies of phase-1) |
| 0.2 | Migrated charts inventory | done | research/phase-2/inventory/04-migrated-inventory.md (82 files, 25 229 lines) |
| 0.3 | Per-chart audit (native vs custom vs broken vs design) | done | research/phase-2/audits/ (×16 audits, ~1 065 lines total) |

## Legend

**Phase 2 status values**: `not started` → `auditing` → `planned` → `refactoring` → `QA` → `benchmarking` → `approved` — or `blocked`.

**QA gates** (research/phase-1/05-qa-and-benchmark-gates.md §QA):
- **Q1 — Visual parity**: ≤ 0.5% differing pixels per screenshot.
- **Q2 — API compatibility**: public props/callbacks typecheck with zero runtime console errors.

**Benchmark gates** (research/phase-1/05-qa-and-benchmark-gates.md §Benchmark gates; `B`=bklit, `T`=native TanStack, `M`=migrated):
- **G1 — Improvement**: `M` beats `B` on M1a/M1c/M2a/M3a/M3c, ≥20% on M1a/M3a/M3c.
- **G2 — Closeness**: `(B−M)/(B−T) ≥ 0.6` on M1a/M3a/M3c (waived if no native `T`).
- **G3 — Steady state**: M2a ≤50% of `B`, within 2× of `T`.
- **G4 — Memory/bundle**: M2b/M2c ≤110% of `B`.

Phase 2 gates are identical to Phase 1 (research/phase-1/05 is frozen ground truth). Waivers require lead ruling in `docs/LOG.md` (Phase 2: D102+).
