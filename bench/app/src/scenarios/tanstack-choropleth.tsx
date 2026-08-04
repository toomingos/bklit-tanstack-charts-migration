// PERFORMANCE-CEILING reference (native/idiomatic TanStack styling), NOT a
// bklit-styled clone -- same "ceiling-not-clone" philosophy as
// tanstack-sunburst.tsx's/tanstack-radar.tsx's header comments: no
// bklit-specific chrome (hover dim/highlight, opacity-tween reveal, real
// light-DOM tooltip, zoom/pan) is ported here.
//
// This mirrors the canonical conformance fixture's own recipe verbatim
// (repos/tanstack-charts/benchmarks/conformance/cases/108-country-choropleth/
// tanstack.ts):
//
//   marks: [geoShape(countryFeatures(input.revision), {
//     key: (country) => country.properties.id,
//     projection: ({ chart }) => equalEarthCountryProjection(chart),
//     fill: (country) => country.properties.fill,
//     stroke: 'currentColor', strokeOpacity: 0.34, strokeWidth: 0.55,
//   })],
//   x: null, y: null, guides: false, margin: 12,
//
// -- a single `geoShape` mark over an Equal Earth projection
// (`geoEqualEarth().fitExtent(bounds, { type: 'Sphere' })`, from that same
// fixture's atlas-data.ts `equalEarthCountryProjection`), positionless
// (`x: null, y: null, guides: false`, same convention as
// tanstack-sunburst.tsx's `polar` mark -- geo/polar marks own their own
// coordinate system, no cartesian x/y scale applies).
//
// Two deliberate deviations from the fixture, both DOCUMENTED, neither
// changing the recipe's substance:
//  1. `defineChart({...})` (a plain object) is used instead of the
//     fixture's `defineChart(() => ({...}))` (a factory). The factory form
//     exists so the fixture can thread `input.revision` through
//     `countryFeatures(revision)` at build time; this bench instead
//     recomputes the whole `definition` via `useMemo(..., [values])`
//     whenever the seeded value map changes (mount vs. update-tick), which
//     is the same "rebuild the mark for new data" effect through this
//     bench's own React-level mechanism rather than the fixture's revision
//     parameter -- `defineChart`'s two call signatures are functionally
//     interchangeable for a definition with no internal revision state
//     (repos/tanstack-charts/packages/charts-core/src/scene.ts:
//     `defineChart(definition) { return typeof definition === 'function' ?
//     {chart: definition} : definition }`).
//  2. Color: the fixture's own `countryFill(value)` is a hand-rolled
//     bucketing function (`Math.floor(value / 21)` against a fixed 85-value
//     range); this scenario uses an equivalent-shape d3-scale
//     `scaleThreshold` (an existing bench/app dependency, already used
//     idiomatically by other ceiling scenarios) over this bench's OWN
//     seeded [0, 5_000_000) value range (bench/data.ts's
//     `generateChoroplethValues`) instead of the fixture's synthetic
//     `countryValue(id, name)` hash -- same "5-bin threshold color scale"
//     shape as bklit-choropleth.tsx's `colorForValue`, so both scenarios
//     are visually comparable, but implemented as a REAL d3-scale
//     threshold scale here (per docs/LOG.md D34's own closing note:
//     "threshold scales live in scenarios/demos only" -- this IS the
//     scenario/demo layer).
//
// ZOOM EXCLUDED (D34): bklit's choropleth zoom is `@visx/zoom`-specific
// (drag-pan/pinch/wheel with a custom ±5% wheelDelta, hard clamp-by-rejection
// constrain, no double-click, no inertia -- choropleth-chart.tsx). TanStack
// Charts has no equivalent zoom/pan recipe or primitive (grepped
// repos/tanstack-charts/packages/charts-core/src and
// packages/react-charts/src -- no `zoom`/`pan` exports anywhere in either
// package). There is nothing to port a "ceiling" version of, so this
// scenario is a fully static render, matching the fixture (which also has
// no zoom concept) -- not an oversight.
import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth } from "d3-geo";
import type { GeoProjection, GeoSphere } from "d3-geo";
import { scaleThreshold } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { geoShape } from "@tanstack/charts/geo";
import type { ChartBounds } from "@tanstack/charts";
import {
  generateChoroplethValues,
  generateChoroplethValuesUpdate,
  type SeededChoroplethValues,
} from "../../../data";
import { WORLD_COUNTRIES, type CountryFeature } from "./choropleth-world-data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Same fixed 16:9 framing as bklit-choropleth.tsx's `aspectRatio="16 / 9"`
// (ChoroplethChart's own default), for a visually comparable capture.
const CHOROPLETH_ASPECT_RATIO = 16 / 9;

// `{ type: 'Sphere' }` -- see atlas-data.ts's `countrySphere`. Used as the
// `fitExtent` geometry so the WHOLE globe (not just the 177 countries'
// combined bbox) is framed, exactly like the fixture.
const COUNTRY_SPHERE: GeoSphere = { type: "Sphere" };

// Same shape as atlas-data.ts's `equalEarthCountryProjection`: an Equal
// Earth projection fit to the mark's own responsive plot bounds (`chart`,
// already inset by the chart-level `margin` -- geo.ts's own doc comment:
// "The projection factory receives the final responsive plot bounds").
function equalEarthProjection({ x, y, width, height }: ChartBounds): GeoProjection {
  return geoEqualEarth().fitExtent(
    [
      [x, y],
      [x + width, y + height],
    ],
    COUNTRY_SPHERE,
  );
}

// Same 5-bin breakpoints as bklit-choropleth.tsx's `colorForValue`, so both
// scenarios bucket this bench's shared [0, 5_000_000) seeded value range
// identically -- implemented here as a real d3-scale `scaleThreshold`
// (idiomatic-TanStack styling; see header comment).
const CHOROPLETH_COLOR_SCALE = scaleThreshold<number, string>()
  .domain([500_000, 1_500_000, 3_000_000, 4_000_000])
  .range([
    "var(--chart-scale-01)",
    "var(--chart-scale-02)",
    "var(--chart-scale-03)",
    "var(--chart-scale-04)",
    "var(--chart-scale-05)",
  ]);

function colorForCountry(country: CountryFeature, values: SeededChoroplethValues): string {
  const name = country.properties?.name;
  const value = name ? values[name] : undefined;
  // Unreachable by construction: `values` (generateChoroplethValues) seeds
  // every country name present in WORLD_COUNTRIES (same vendored asset),
  // kept only as a defensive fallback.
  return value === undefined ? "var(--chart-scale-01)" : CHOROPLETH_COLOR_SCALE(value);
}

export default function TanstackChoropleth({ n }: { n: number }) {
  const [values, setValues] = useState<SeededChoroplethValues>(() =>
    generateChoroplethValues("choropleth", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setValues(generateChoroplethValuesUpdate("choropleth", n, tickRef.current));
      });
    // Same as bklit-choropleth.tsx: choropleth's `n` is nominal (map size
    // is FIXED at ~177 features by the vendored asset) -- no live-append
    // time-series concept applies here.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    return defineChart({
      marks: [
        geoShape(WORLD_COUNTRIES.features, {
          key: (country: CountryFeature) => country.properties?.name ?? String(country.id ?? ""),
          projection: ({ chart }) => equalEarthProjection(chart),
          fill: (country: CountryFeature) => colorForCountry(country, values),
          stroke: "currentColor",
          strokeOpacity: 0.34,
          strokeWidth: 0.55,
        }),
      ],
      // Positionless container mark -- no cartesian x/y scales or guides
      // (same convention as tanstack-sunburst.tsx's `polar` mark; the
      // fixture's own choice too).
      x: null,
      y: null,
      guides: false,
      margin: 12,
    });
  }, [values]);

  return (
    <Chart
      ariaLabel="Choropleth chart benchmark scenario"
      aspectRatio={CHOROPLETH_ASPECT_RATIO}
      definition={definition}
      onRender={onRender}
    />
  );
}
