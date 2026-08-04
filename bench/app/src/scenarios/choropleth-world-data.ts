// Shared TopoJSON -> GeoJSON conversion for the two choropleth scenarios
// (bklit-choropleth.tsx, tanstack-choropleth.tsx). Computed ONCE at module
// scope (both scenario modules import the same `WORLD_COUNTRIES` constant,
// so the conversion itself is never duplicated or repeated per-mount).
//
// Conversion mirrors bklit's own docs demo, repos/bklit-ui/apps/web/
// components/docs/use-world-data.tsx (`fetchWorldData`): `feature(topology,
// topology.objects[<key>])` via `topojson-client`, cast to
// `FeatureCollection<Geometry, CountryProperties>`. The one deliberate
// deviation: the demo resolves the object key dynamically
// (`Object.keys(topology.objects)[0]`) because it doesn't know the shape of
// whatever unversioned TopoJSON it fetches over the network at runtime; this
// bench statically imports a KNOWN vendored asset (world-atlas@2.0.2 110m
// countries, bench/app/src/assets/world-countries-110m.json) whose
// `objects` keys are verified to be exactly `["countries", "land"]`, so the
// wanted object (`objects.countries`, a GeometryCollection of 177 country
// features) is addressed directly by name instead of by "first key"
// happenstance -- same `feature()` mechanism, less fragile addressing.
//
// D34: bklit ships ZERO geometry itself (the demo runtime-fetches
// unversioned TopoJSON -- non-deterministic, network-dependent); this bench
// instead imports the already-vendored, already-committed asset statically,
// per this task's explicit constraint (no runtime fetch, no new deps --
// topojson-client is an existing bench/app dependency).
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import worldTopologyRaw from "../assets/world-countries-110m.json";

export interface CountryProperties {
  name: string;
  [key: string]: unknown;
}

export type CountryFeature = Feature<Geometry, CountryProperties>;

interface WorldTopology {
  type: "Topology";
  objects: {
    countries: unknown;
    land: unknown;
  };
}

const worldTopology = worldTopologyRaw as unknown as WorldTopology;

/**
 * All 177 world-atlas countries as a GeoJSON `FeatureCollection`, converted
 * once at module load. `properties.name` is the join key used throughout
 * this bench (bench/data.ts's `generateChoroplethValues`, bklit's own
 * `ChoroplethTooltip` default title, bklit's docs-demo `visitorsByCountry`
 * lookup) -- verified unique across all 177 features.
 */
export const WORLD_COUNTRIES: FeatureCollection<Geometry, CountryProperties> =
  feature<CountryProperties>(worldTopology, worldTopology.objects.countries);
