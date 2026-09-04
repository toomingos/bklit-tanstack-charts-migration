// Ceiling reference (idiomatic TanStack, not a bklit clone): fixture 108-choropleth recipe, static.
// GUARD: object-form defineChart + d3 threshold scale are intentional; do not "align".
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

// Same 16:9 framing as bklit for comparable captures.
const CHOROPLETH_ASPECT_RATIO = 16 / 9;

// Fit the whole globe (Sphere), not the countries' bbox, like the fixture.
const COUNTRY_SPHERE: GeoSphere = { type: "Sphere" };

function equalEarthProjection({ x, y, width, height }: ChartBounds): GeoProjection {
  return geoEqualEarth().fitExtent(
    [
      [x, y],
      [x + width, y + height],
    ],
    COUNTRY_SPHERE,
  );
}

// Same 5-bin breakpoints as bklit so both impls bucket identically.
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
  // Unreachable: every country is seeded; defensive fallback only.
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
    // GUARD: n is nominal (fixed ~177 features); no live-append concept applies.
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
