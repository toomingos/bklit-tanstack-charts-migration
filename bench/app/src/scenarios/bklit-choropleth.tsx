// Faithful adaptation of bklit's OWN docs demo, `ChoroplethAnalyticsDemo`
// (repos/bklit-ui/apps/web/components/docs/choropleth-demo.tsx) -- the
// "rich usage" example this scenario is based on, since bklit ships NO
// registry `choropleth-chart.tsx` example usable as-is (docs/LOG.md D34:
// the registry example, repos/bklit-ui/packages/ui/registry/examples/
// choropleth-chart.tsx, passes a flat array `[{id,name,value}, ...]` where
// a GeoJSON `FeatureCollection` is actually required -- confirmed BROKEN,
// not a basis).
//
// The demo's tree (verbatim):
//   <ChoroplethChart aspectRatio="16 / 9" data={worldData} zoomEnabled>
//     <ChoroplethFeatureComponent getFeatureColor={getVisitorColor} />
//     <ChoroplethTooltip getFeatureValue={getVisitorValue} valueLabel="Unique Visitors" />
//     <AnalyticsZoomControls />
//     <div className="absolute bottom-4 left-4 ...">{/* legend */}</div>
//   </ChoroplethChart>
// is reproduced below with exactly two swaps:
//
//  1. `worldData` -- the demo's `useWorldDataStandalone()` (use-world-data.tsx)
//     runtime-fetches an unversioned TopoJSON file over the network at
//     render time (non-deterministic, network-dependent -- D34, "bklit ships
//     ZERO geometry"). This bench instead uses `WORLD_COUNTRIES`
//     (./choropleth-world-data.ts), the SAME vendored asset + SAME
//     `topojson-client` `feature()` conversion mechanism the demo uses, just
//     resolved from a statically imported, already-committed JSON file
//     instead of a runtime `fetch()`.
//
//  2. `visitorsByCountry` -- the demo hardcodes a sparse ~30-country sample
//     map (with a "no data = var(--muted)" fallback branch in
//     `getVisitorColor`). This bench uses `generateChoroplethValues`/
//     `generateChoroplethValuesUpdate` (bench/data.ts), which seeds a value
//     for EVERY one of the 177 countries in the vendored asset -- so the
//     "no data" branch below is kept (for structural parity with the real
//     `getVisitorColor`) but is UNREACHABLE by construction: every feature's
//     name is always a key in the generated value map.
//
// --- Settle detection (M1b) for this phase-less chart -------------------
// `ChoroplethChartProps` (repos/bklit-ui/packages/ui/src/charts/choropleth/
// choropleth-chart.tsx) has NO `onPhaseChange`/`status` prop -- verified by
// reading the full prop list directly. Like CandlestickChart/HeatmapChart,
// it has its own internal reveal timer, but choropleth has a NOVEL quirk
// (D34): TWO unsynchronized timers drive the reveal, not one:
//
//   (a) `ChoroplethChartInner`'s own `isLoaded` state, flipped via a plain
//       `setTimeout(() => setIsLoaded(true), animationDuration)` fired at
//       mount (choropleth-chart.tsx) -- `animationDuration` defaults to
//       800ms (`ChoroplethChart`'s destructured default,
//       `animationDuration = 800`), NOT overridden here, matching the demo.
//
//   (b) `ChoroplethFeature`'s `EnterFeatureLayer` (choropleth-feature.tsx),
//       which fades in independently via `useMountProgress(enterTransition,
//       0, replayKey)` + `useEnterComplete(mountProgress)`. Since
//       `ChoroplethChart` is not given an `enterTransition` prop (matching
//       the demo), `useMountProgress` (use-mount-progress.ts) falls back to
//       the SHARED `DEFAULT_CHART_ENTER_TRANSITION`
//       (repos/bklit-ui/packages/ui/src/charts/animation.ts:
//       `DEFAULT_ANIMATION_DURATION_MS = 1100`, a
//       `{type:"tween", duration: 1.1, ease:[0.85,0,0.15,1]}` tween).
//       `useEnterComplete` (use-enter-complete.ts) flips `true` exactly when
//       that tween's motion value reaches 1 -- i.e. exactly at the full
//       1100ms, not before.
//
// These two timers are NOT synchronized with each other (800ms vs 1100ms,
// independently fired) -- reproduced faithfully rather than "fixed", per
// D34 ("can pop opacity mid-reveal -- reproduce faithfully"). Since the
// LATER of the two determines when the chart has visually finished
// revealing, settle is armed at `max(800, 1100) + 100ms margin = 1200ms`
// (same "timer + small margin" convention as bklit-heatmap.tsx/
// bklit-candlestick.tsx).
const CHOROPLETH_ANIMATION_DURATION_MS = 800; // ChoroplethChart's own `animationDuration` default
const CHOROPLETH_FEATURE_ENTER_MS = 1100; // shared DEFAULT_ANIMATION_DURATION_MS (animation.ts) driving ChoroplethFeature's fade
const CHOROPLETH_SETTLE_MARGIN_MS = 100;

// --- Zoom QA hook (window.__benchZoomTo) ---------------------------------
// KEY API FINDING: `ChoroplethChart` exposes NO ref/imperative prop for
// zoom control. The real, already-used mechanism (verified in bklit's own
// `AnalyticsZoomControls`/`ZoomControls`, choropleth-demo.tsx /
// choropleth-zoom-demo.tsx) is `useChoroplethZoom()` -- a React context hook
// consumable from any function-component CHILD rendered inside
// `<ChoroplethChart>` (it lands in `overlayChildren` via
// `separateChildren()`'s "not a known SVG child, not a bare HTML tag ->
// overlay" branch, choropleth-chart.tsx) -- which hands back the REAL
// `@visx/zoom` `ProvidedZoom<SVGSVGElement>` instance (bench/app/
// node_modules/@visx/zoom/lib/types.d.ts): `.reset()`, `.scale()`,
// `.setTransformMatrix()`, etc. `ZoomQaBridge` below is exactly this
// pattern, wired to `window.__benchZoomTo` instead of onClick handlers --
// no pointer emulation, per D34.
//
// `setTransformMatrix` (an ABSOLUTE assignment) is used instead of
// `.scale()`/`.translate()` (both of which compose relative to whatever the
// CURRENT transform already is) so each named state is idempotent --
// calling `__benchZoomTo("zoomed")` twice in a row (or after "panned")
// always lands on the exact same matrix, which repeat-run QA depends on.
//   - "reset":  `zoom.reset()` -- back to the identity transform
//     (`DEFAULT_INITIAL_ZOOM`, choropleth-chart.tsx).
//   - "zoomed": 2x scale anchored at the SVG's own center point (so the
//     center of the map stays visually fixed while zooming in) --
//     `translate = center * (1 - scale)`, the standard "fixed point under
//     scale" formula.
//   - "panned": 1.6x scale anchored at the (30%, 30%) point of the SVG
//     instead of dead-center, so the resulting transform is BOTH scaled
//     AND visibly off-center/panned relative to "zoomed" -- distinguishing
//     a "zoom only" QA capture from a "zoom + pan" capture (D34: "captures
//     at untransformed + 1-2 named zoom states").
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethTooltip,
  useChoropleth,
  useChoroplethZoom,
  type ChoroplethFeature,
} from "@bklitui/ui/charts";
import {
  generateChoroplethValues,
  generateChoroplethValuesUpdate,
  type SeededChoroplethValues,
} from "../../../data";
import { WORLD_COUNTRIES } from "./choropleth-world-data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

export type ChoroplethZoomState = "reset" | "zoomed" | "panned";

declare global {
  interface Window {
    __benchZoomTo?: (state: ChoroplethZoomState) => void;
  }
}

// Breakpoints scaled to this bench's [0, 5_000_000) seeded value range
// (bench/data.ts's `generateChoroplethValues`), same 5-bin
// threshold-function SHAPE as the demo's `getVisitorColor`
// (choropleth-demo.tsx) -- just re-scaled thresholds and a re-labeled
// legend, since the demo's own breakpoints (17/13/9/5) are tuned for its
// much smaller ~1-18 visitor-count sample data.
function colorForValue(value: number | undefined): string {
  if (value === undefined) {
    // Unreachable by construction (see header comment) -- kept only for
    // structural parity with the real `getVisitorColor`.
    return "var(--muted)";
  }
  if (value >= 4_000_000) return "var(--chart-scale-05)";
  if (value >= 3_000_000) return "var(--chart-scale-04)";
  if (value >= 1_500_000) return "var(--chart-scale-03)";
  if (value >= 500_000) return "var(--chart-scale-02)";
  return "var(--chart-scale-01)";
}

const LEGEND_ITEMS: ReadonlyArray<{ color: string; label: string }> = [
  { color: "var(--chart-scale-01)", label: "< 500K" },
  { color: "var(--chart-scale-02)", label: "500K - 1.5M" },
  { color: "var(--chart-scale-03)", label: "1.5M - 3M" },
  { color: "var(--chart-scale-04)", label: "3M - 4M" },
  { color: "var(--chart-scale-05)", label: "4M+" },
];

function makeGetVisitorColor(values: SeededChoroplethValues) {
  return function getVisitorColor(feature: ChoroplethFeature): string {
    const name = feature.properties?.name;
    return colorForValue(name ? values[name] : undefined);
  };
}

function makeGetVisitorValue(values: SeededChoroplethValues) {
  return function getVisitorValue(feature: ChoroplethFeature): number | undefined {
    const name = feature.properties?.name;
    return name ? values[name] : undefined;
  };
}

/** See header comment's "Zoom QA hook" section for the full design rationale. */
function ZoomQaBridge() {
  const { zoom } = useChoroplethZoom();
  const { width, height } = useChoropleth();

  useEffect(() => {
    if (!zoom) return undefined;

    window.__benchZoomTo = (state: ChoroplethZoomState) => {
      if (state === "reset") {
        zoom.reset();
        return;
      }
      if (state === "zoomed") {
        const s = 2;
        const cx = width / 2;
        const cy = height / 2;
        zoom.setTransformMatrix({
          scaleX: s,
          scaleY: s,
          translateX: cx * (1 - s),
          translateY: cy * (1 - s),
          skewX: 0,
          skewY: 0,
        });
        return;
      }
      // "panned"
      const s = 1.6;
      const px = width * 0.3;
      const py = height * 0.3;
      zoom.setTransformMatrix({
        scaleX: s,
        scaleY: s,
        translateX: px * (1 - s),
        translateY: py * (1 - s),
        skewX: 0,
        skewY: 0,
      });
    };

    return () => {
      window.__benchZoomTo = undefined;
    };
  }, [zoom, width, height]);

  return null;
}

export default function BklitChoropleth({ n }: { n: number }) {
  const [values, setValues] = useState<SeededChoroplethValues>(() =>
    generateChoroplethValues("choropleth", n),
  );
  const tickRef = useRef(0);

  // Arm once per mount, synchronously during render (bklit-heatmap.tsx /
  // bklit-candlestick.tsx convention) -- n-independent, since the map's
  // reveal timers (800ms/1100ms) don't depend on the (fixed, ~177-feature)
  // dataset size.
  useMemo(() => {
    armBklitTimerSettle(
      Math.max(CHOROPLETH_ANIMATION_DURATION_MS, CHOROPLETH_FEATURE_ENTER_MS) +
        CHOROPLETH_SETTLE_MARGIN_MS,
    );
  }, []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setValues(generateChoroplethValuesUpdate("choropleth", n, tickRef.current));
      });
    // Choropleth's `n` is nominal (D34: the map size is FIXED at ~177
    // features by the vendored asset, not a user-selectable series length)
    // -- no live-append time-series concept applies here, matching the
    // heatmap/sunburst precedent.
    window.__benchLiveTick = () => {};
  }, [n]);

  const getVisitorColor = useMemo(() => makeGetVisitorColor(values), [values]);
  const getVisitorValue = useMemo(() => makeGetVisitorValue(values), [values]);

  return (
    <ChoroplethChart aspectRatio="16 / 9" data={WORLD_COUNTRIES} zoomEnabled>
      <ChoroplethFeatureComponent getFeatureColor={getVisitorColor} />
      <ChoroplethTooltip getFeatureValue={getVisitorValue} valueLabel="Seeded Value" />
      <ZoomQaBridge />
      {/* Legend -- same overlay-child placement/markup shape as the demo's
          own inline legend div (choropleth-demo.tsx). */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded-lg bg-card/90 p-3 text-xs backdrop-blur-sm">
        <span className="font-medium text-muted-foreground">Seeded Value</span>
        {LEGEND_ITEMS.map((item) => (
          <div className="flex items-center gap-2" key={item.label}>
            <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </ChoroplethChart>
  );
}
