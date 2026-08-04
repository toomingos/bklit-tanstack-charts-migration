// Ambient module declaration for `topojson-client` (bench/app dependency,
// already listed in bench/app/package.json -- NOT a new npm dependency).
//
// FINDING: `topojson-client`'s own package.json has no `types`/`typings`
// field (main: "dist/topojson-client.js" only), and neither
// `@types/topojson-client` nor `topojson-specification` are installed in
// bench/app/node_modules (checked: no `*topojson*` dir under
// bench/app/node_modules/@types, and topojson-client's own package.json
// carries no types entry). Under this tsconfig's `strict: true` (which
// implies `noImplicitAny`), a bare `import { feature } from
// "topojson-client"` would fail with TS7016 ("could not find a declaration
// file"). This file is a pure ADDITION (no existing file edited, no
// package installed) that types only the one export this bench actually
// calls, matching how `repos/tanstack-charts/benchmarks/conformance/cases/
// 108-country-choropleth/atlas-data.ts` uses the same library
// (`feature(topology, object)` -> GeoJSON `FeatureCollection`).
declare module "topojson-client" {
  import type { Geometry, GeoJsonProperties, FeatureCollection } from "geojson";

  // Minimal typing of the one entry point this bench uses. Real
  // `topojson-client` also accepts a bare Geometry object and can then
  // return a single `Feature` (not a collection) -- this bench only ever
  // passes a TopoJSON `GeometryCollection` (`objects.countries`), so the
  // narrower `FeatureCollection`-returning signature is sufficient here.
  export function feature<P = GeoJsonProperties>(
    topology: unknown,
    object: unknown,
  ): FeatureCollection<Geometry, P>;
}
