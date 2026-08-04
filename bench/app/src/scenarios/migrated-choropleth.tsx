// Migrated ChoroplethChart scenario — IDENTICAL usage to bklit-choropleth.tsx
// (same component tree, same props), only the import source changes. The
// migrated package must be a drop-in replacement.
//
// See bklit-choropleth.tsx for full design rationale (settle detection,
// zoom QA hook, color scale, legend) — reproduced here verbatim.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethTooltip,
  useChoropleth,
  useChoroplethZoom,
  type ChoroplethFeature,
} from "@migrated/charts";
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
function colorForValue(value: number | undefined): string {
  if (value === undefined) return "var(--muted)";
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

const CHOROPLETH_ANIMATION_DURATION_MS = 800;
const CHOROPLETH_FEATURE_ENTER_MS = 1100;
const CHOROPLETH_SETTLE_MARGIN_MS = 100;

/** Zoom QA bridge — same pattern as bklit-choropleth.tsx */
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

export default function MigratedChoropleth({ n }: { n: number }) {
  const [values, setValues] = useState<SeededChoroplethValues>(() =>
    generateChoroplethValues("choropleth", n),
  );
  const tickRef = useRef(0);

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
    window.__benchLiveTick = () => {};
  }, [n]);

  const getVisitorColor = useMemo(() => makeGetVisitorColor(values), [values]);
  const getVisitorValue = useMemo(() => makeGetVisitorValue(values), [values]);

  return (
    <ChoroplethChart aspectRatio="16 / 9" data={WORLD_COUNTRIES} zoomEnabled>
      <ChoroplethFeatureComponent getFeatureColor={getVisitorColor} />
      <ChoroplethTooltip getFeatureValue={getVisitorValue} valueLabel="Seeded Value" />
      <ZoomQaBridge />
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
