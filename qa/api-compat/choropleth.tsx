// Q2 API-compatibility fixture: exercises the full public prop surface of
// the migrated ChoroplethChart family against
// repos/bklit-ui/packages/ui/src/charts/choropleth/*. Must typecheck with
// zero errors via `tsc --noEmit` (included from bench/app/tsconfig.json).
// Runtime smoke is covered by the bench scenarios (bklit-choropleth.tsx /
// migrated-choropleth.tsx).
//
// Uses a minimal inline FeatureCollection (3 simple polygon features) to
// avoid pulling in the heavy world-atlas TopoJSON dependency. The projections
// (Mercator, center=[0,20]) will still produce valid visual output.
import * as React from "react";
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethTooltip,
  ChoroplethGraticule,
  useChoropleth,
  useChoroplethZoom,
  type ChoroplethChartProps,
  type ChoroplethFeature,
  type ChoroplethFeatureProps,
  type ChoroplethTooltipProps,
  type ChoroplethGraticuleProps,
  type ChoroplethContextValue,
  type TransformMatrix,
} from "@migrated/charts";
import type { FeatureCollection, Feature, Geometry, Polygon } from "geojson";

// ---------------------------------------------------------------------------
// Minimal inline GeoJSON — three simple rectangular polygons in rough world
// space (lon ∈ [-180, 180], lat ∈ [-90, 90]), enough to exercise the full
// choropleth API without an external TopoJSON dependency.
// ---------------------------------------------------------------------------
const POLYGON_A: Polygon = {
  type: "Polygon",
  coordinates: [[[-80, 30], [-40, 30], [-40, 55], [-80, 55], [-80, 30]]],
};
const POLYGON_B: Polygon = {
  type: "Polygon",
  coordinates: [[[20, 35], [60, 35], [60, 60], [20, 60], [20, 35]]],
};
const POLYGON_C: Polygon = {
  type: "Polygon",
  coordinates: [[[-30, -10], [30, -10], [30, 15], [-30, 15], [-30, -10]]],
};

const FEATURE_A: Feature<Polygon, { name: string }> = {
  type: "Feature",
  geometry: POLYGON_A,
  properties: { name: "Region A" },
};
const FEATURE_B: Feature<Polygon, { name: string }> = {
  type: "Feature",
  geometry: POLYGON_B,
  properties: { name: "Region B" },
};
const FEATURE_C: Feature<Polygon, { name: string }> = {
  type: "Feature",
  geometry: POLYGON_C,
  properties: { name: "Region C" },
};

const SAMPLE_DATA: FeatureCollection<Geometry, { name: string }> = {
  type: "FeatureCollection",
  features: [FEATURE_A, FEATURE_B, FEATURE_C],
};

const SAMPLE_DATA_LARGE: FeatureCollection<Geometry, { name: string }> = {
  type: "FeatureCollection",
  features: [],
};

// ---------------------------------------------------------------------------
// Feature color / tooltip value callbacks
// ---------------------------------------------------------------------------
function featureColor(feature: ChoroplethFeature, _index: number): string {
  const name = feature.properties?.name ?? "";
  if (name === "Region A") return "#8B5CF6";
  if (name === "Region B") return "#3B82F6";
  return "#10B981";
}

function featureValue(feature: ChoroplethFeature, _index: number): number | undefined {
  const name = feature.properties?.name ?? "";
  if (name === "Region A") return 120;
  if (name === "Region B") return 85;
  if (name === "Region C") return 42;
  return undefined;
}

// ---------------------------------------------------------------------------
// Consumer hook usage (exercises context hooks)
// ---------------------------------------------------------------------------
function useChoroplethConsumer(): { width: number; height: number } {
  const { width, height } = useChoropleth();
  return { width, height };
}

function useChoroplethZoomConsumer(): boolean {
  const { zoom } = useChoroplethZoom();
  return zoom !== null;
}

function ContextHookWrapper() {
  void useChoroplethConsumer();
  void useChoroplethZoomConsumer();
  return null;
}

// ---------------------------------------------------------------------------
// Main fixture
// ---------------------------------------------------------------------------
export function ChoroplethChartApiFixture() {
  return (
    <>
      {/* Canonical zoom-enabled path (matching bench scenario). */}
      <ChoroplethChart data={SAMPLE_DATA} zoomEnabled>
        <ChoroplethFeatureComponent getFeatureColor={featureColor} />
        <ChoroplethTooltip getFeatureValue={featureValue} valueLabel="Population" />
      </ChoroplethChart>

      {/* All optional props populated. */}
      <ChoroplethChart
        data={SAMPLE_DATA}
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        animationDuration={500}
        aspectRatio="2 / 1"
        scale={100}
        center={[0, 20]}
        translate={[200, 150]}
        zoomEnabled
        zoomMin={0.3}
        zoomMax={5}
        initialZoom={{ scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, skewX: 0, skewY: 0 }}
        className="fixture-choropleth"
      >
        <ChoroplethFeatureComponent
          fill="var(--chart-1)"
          stroke="var(--border)"
          strokeWidth={1}
          fadedOpacity={0.2}
          getFeatureColor={featureColor}
        />
        <ChoroplethTooltip
          getFeatureValue={featureValue}
          valueLabel="Revenue"
          formatValue={(v: number) => `$${v}M`}
          getFeatureName={(f: ChoroplethFeature) => f.properties?.name ?? "Unknown"}
          className="fixture-tooltip"
          panelStyle={{ borderRadius: 8, fontSize: 14 }}
          backgroundColor="var(--chart-tooltip-background)"
        />
        <ChoroplethGraticule
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          step={[15, 15]}
        />
        <div className="fixture-overlay">Legend content</div>
      </ChoroplethChart>

      {/* Zoom disabled (static map). */}
      <ChoroplethChart data={SAMPLE_DATA} zoomEnabled={false}>
        <ChoroplethFeatureComponent fill="var(--chart-2)" stroke="var(--background)" />
        <ChoroplethTooltip />
      </ChoroplethChart>

      {/* Min/max zoom constraints, custom aspect ratio, wide margin. */}
      <ChoroplethChart
        data={SAMPLE_DATA}
        aspectRatio="4 / 3"
        margin={{ top: 40, right: 8, bottom: 60, left: 8 }}
        zoomMin={1}
        zoomMax={2}
        zoomEnabled
      >
        <ChoroplethFeatureComponent strokeWidth={0} getFeatureColor={featureColor} />
      </ChoroplethChart>

      {/* Exhaustive prop typecheck (string-aspect, large margin, no children yet). */}
      <ChoroplethChart
        data={SAMPLE_DATA}
        aspectRatio="3/2"
        margin={{ top: 32, right: 0, bottom: 0, left: 0 }}
        scale={200}
        center={[10, 30]}
        translate={[300, 100]}
        animationDuration={300}
        zoomEnabled
        zoomMin={0.8}
        zoomMax={2.5}
        initialZoom={{ scaleX: 1.2, scaleY: 1.2, translateX: 10, translateY: 20, skewX: 0, skewY: 0 }}
        className="full-prop-surface"
      >
        <ChoroplethFeatureComponent
          fill="var(--chart-3)"
          stroke="currentColor"
          strokeWidth={1.5}
          fadedOpacity={0.5}
          getFeatureColor={featureColor}
        />
        <ChoroplethTooltip
          content={({ feature }: { feature: ChoroplethFeature; index: number }) => (
            <div>{feature.properties?.name ?? ""}</div>
          )}
          getFeatureValue={featureValue}
          valueLabel="Count"
          className="custom-content"
        />
        <ChoroplethGraticule stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} step={[10, 10]} />
        <ContextHookWrapper />
      </ChoroplethChart>

      {/* Exhaustive `ChoroplethChartProps` reference (typecheck-only — kept
          last to verify every documented prop at once). */}
      {((): ChoroplethChartProps => ({
        data: SAMPLE_DATA,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        animationDuration: 800,
        enterTransition: { type: "tween", duration: 1.1, ease: [0.85, 0, 0.15, 1] } as unknown,
        revealSignature: "v1",
        aspectRatio: "16 / 9",
        scale: 150,
        center: [0, 20],
        translate: [200, 200],
        zoomEnabled: true,
        zoomMin: 0.5,
        zoomMax: 4,
        initialZoom: { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, skewX: 0, skewY: 0 },
        className: "exhaustive-ref",
        children: (
          <>
            <ChoroplethFeatureComponent getFeatureColor={featureColor} />
            <ChoroplethTooltip getFeatureValue={featureValue} valueLabel="Metric" />
          </>
        ),
      }))() && null}
    </>
  );
}
