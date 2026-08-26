# P3.13b executor notes (rows 25/26/27/13) — IN PROGRESS

Written incrementally per resume directive. Final report supersedes this file;
this file exists so a harness kill cannot lose verdicts again.

## Row 25 — binTimeX / chart-markers.tsx — NON-VIABLE (D272 shape, 8th closure)

No edits made. No files touched.

Pipeline evidence (direct reads, 2026-08-24):

- `showcase/migrated/charts/internal/chart-markers.tsx:315-389`
  `ChartMarkersOverlay` is a **pure HTML/DOM overlay**: renders
  `<div aria-hidden="true" style={{position:"absolute", inset:0,
  pointerEvents:"none"}}>` (:345-347) containing an inner positioning div
  (:357) and per-bucket `MarkerGroupView` React elements. It imports no
  TanStack machinery at all (no `defineChart`, no mark builders, no transforms).
- It sits OUTSIDE the render pipeline: the host hands it `xScale`,
  `marginLeft`, `marginTop`, `innerHeight` directly as props (:316) — the
  contract comment at :349-356 documents that callers pass an inner-relative
  d3 scale. It renders as a sibling of the chart SVG, not inside any
  `defineChart`/mark-definition/scene structure. `binTimeX`
  (`@tanstack/charts/transform/bin-time`) materializes only as a transform on
  mark data channels inside the scene pipeline; there is no surface here to
  attach it to.
- Independent second blocker, per tanstack.md row 25's own gap note ("buckets
  by d3 interval; **no arbitrary-item grouping**"): the code being replaced is
  NOT plain day-bucketing of scalar data. It is arbitrary-item grouping of
  rich marker objects into fan buckets — `Map<string, Bucket>` keyed by
  `m.date.toDateString()` (:323-332) where each `Bucket` carries `{key,
  markers[], date}` consumed for (a) x-position via `xScale(bucket.date)`
  (:359), (b) active-state comparison `bucket.date.toDateString() ===
  activeDate.toDateString()` (:361-362), and (c) fan-out rendering of N
  markers with individual icon/color/onClick/href. A time-bin transform
  produces binned rows for marks; it cannot produce grouped marker-object
  lists with per-item interaction metadata.
- Verdict: **NON-VIABLE**, matching the D272 shape (native surface only
  reachable inside render pipeline; overlay/DOM-sibling components can't reach
  it) — 8th closure of this shape per the wrapper brief. Gate reduces to
  baseline confirmation (markers n=100 unchanged).

## Row 26 — LANDED (pending QA gate)

Edit complete on disk:
- `showcase/migrated/charts/internal/projection-utils.ts`: added
  `import { linearRegressionRowsY } from "@tanstack/charts/regression"` (:1);
  `linearRegressionSlope` body replaced with native delegation (:97-112):
  calls `linearRegressionRowsY(points, {x:"t", y:"y", samples:2, ci:0})`,
  recovers slope as Δy/Δx between first/last samples, maps empty result → 0
  (native returns [] exactly when custom returned 0).
- `showcase/tsconfig.json`: added missing `"@tanstack/charts/regression"`
  paths entry (:119-121) — first typecheck failed TS2307 without it.
- **TSC_EXIT=0** after both edits (full showcase, from showcase/, no pipe).
- buildAutoFutureValues extrapolation walk confirmed untouched (lines 114+).

## Rows 27 / 13 — pending investigation (not reached)
