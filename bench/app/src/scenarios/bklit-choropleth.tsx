// Docs-demo tree; vendored WORLD_COUNTRIES replaces the demo's network fetch; every country is seeded.
// Phase-less chart: settle = max(800ms chart timer, 1100ms feature fade) + 100ms margin.
const CHOROPLETH_ANIMATION_DURATION_MS = 800; // ChoroplethChart's own `animationDuration` default
const CHOROPLETH_FEATURE_ENTER_MS = 1100; // shared DEFAULT_ANIMATION_DURATION_MS (animation.ts) driving ChoroplethFeature's fade
const CHOROPLETH_SETTLE_MARGIN_MS = 100;

// Zoom QA hook: no imperative zoom prop exists, so ZoomQaBridge uses useChoroplethZoom() like the demo.
// Uses setTransformMatrix (absolute) so each named zoom state is idempotent for repeat-run QA.
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

// Breakpoints re-scaled to the seeded [0, 5M) range (same 5-bin shape as the demo).
function colorForValue(value: number | undefined): string {
  if (value === undefined) {
    // Unreachable (every country seeded); kept for parity with the demo's getVisitorColor.
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

/** Zoom QA bridge: child-context zoom wired to window.__benchZoomTo (see note above). */
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

  // Arm once per mount; n-independent (fixed ~177-feature map).
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
    // n is nominal (fixed ~177-feature map): no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  const getVisitorColor = useMemo(() => makeGetVisitorColor(values), [values]);
  const getVisitorValue = useMemo(() => makeGetVisitorValue(values), [values]);

  return (
    <ChoroplethChart aspectRatio="16 / 9" data={WORLD_COUNTRIES} zoomEnabled>
      <ChoroplethFeatureComponent getFeatureColor={getVisitorColor} />
      <ChoroplethTooltip getFeatureValue={getVisitorValue} valueLabel="Seeded Value" />
      <ZoomQaBridge />
      {/* Legend overlays like the demo's own inline legend div. */}
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
