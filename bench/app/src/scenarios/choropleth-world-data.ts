// Shared TopoJSON->GeoJSON conversion for both choropleth scenarios, computed once at module scope.
// GUARD: vendored world-atlas asset addressed by name (objects.countries); never runtime-fetch.
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import worldTopologyRaw from "../assets/world-countries-110m.json";

export interface CountryProperties {
  name: string;
  [key: string]: string | number | boolean | null | undefined;
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

// All 177 countries, converted once; properties.name (unique) is the join key.
export const WORLD_COUNTRIES: FeatureCollection<Geometry, CountryProperties> =
  feature<CountryProperties>(worldTopology, worldTopology.objects.countries);
