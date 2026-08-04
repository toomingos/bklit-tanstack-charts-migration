// Native TanStack Charts PERFORMANCE-CEILING approximation of bklit's arc
// Gauge -- NOT a pixel clone (same philosophy as every other
// `tanstack-*.tsx` ceiling scenario's header comment: tanstack-radar.tsx/
// tanstack-pie.tsx/tanstack-line.tsx). Per docs/LOG.md D28's own ruling,
// this ceiling is explicitly framed performance-only: "ceiling scenario =
// custom-notch composition at matching n framed performance-only" -- the
// real migrated port uses a bespoke `PolarMark` calling bklit's
// `createNotchPath` verbatim (straight-chord + quadratic-Bezier-fillet
// notches; `radialArc`'s d3-arc generator structurally cannot produce
// bklit's rectangular/tapered notch shape). This file instead approximates
// the SAME "n discrete notches around an arc, some active" structure using
// `radialArc`'s own angular math -- close enough in DOM shape/count to
// stress the same rendering path, not a geometry match.
//
// Angle convention: bklit's arc gauge sweeps `startAngle=135deg` ->
// `endAngle=405deg` (a 270deg sweep, standard-math-angle convention, y-down
// SVG coords -- gauge.tsx:278-279). Per docs/LOG.md D28, this is CONFIRMED
// (via repos/tanstack-charts/benchmarks/conformance/cases/98-needle-gauge/
// tanstack.ts, read here strictly as an ANGLE-CONVENTION reference, not a
// design basis -- that fixture is a classic banded needle gauge, explicitly
// ruled architecturally unrelated to bklit's notch meter) to correspond to
// TanStack's own `-3*PI/4` -> `3*PI/4` (TanStack's polar 0 = 12 o'clock,
// clockwise-positive, matching bklit's own convention exactly per D24 --
// same 270deg sweep, reprojected). `radialArc`'s default `startAngle`/
// `endAngle` channels read absolute per-datum radian properties directly
// (polar.ts's `numberProperty(datum, 'startAngle'|'endAngle')`) with no
// angle-scale involvement (`requiresAngleScale: false`) -- exactly like
// this fixture's own `pieLayout` pass-through -- so this file computes
// absolute per-notch start/end radians up front and lets `radialArc` read
// them off the notch objects with zero channel overrides.
//
// Two-layer structure mirrors bklit's own `GaugeNotchSvg` (gauge.tsx:
// 149-218) at the DOM-shape level: ALL `n` notches render once as a
// background arc layer (gray, lower opacity), then the active SUBSET
// (`i < activeNotches`) renders a second overlaid arc layer on top (solid
// color, full opacity) -- `radialArc`'s single per-mark `fillOpacity`
// can't vary per-datum, so two `radialArc` mark calls (not one) are the
// simplest way to reproduce bklit's two-opacity structure; each call is
// still "one radialArc per notch layer", i.e. n (respectively
// activeNotches) arcs drawn as computed start/end angles with gaps, per the
// task's ceiling design instruction.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { polar, radialArc } from "@tanstack/charts/polar";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Matches bklit's arc `Gauge`'s default `aspect-[21/16]` box (gauge.tsx's
// fully-responsive branch), fixed to a concrete pixel size the same way
// tanstack-radar.tsx/tanstack-pie.tsx fix their `<Chart>` dimensions:
// 420x320 = exactly a 21:16 ratio, comfortably inside #chart-root's ~1052px
// usable width and 800px-tall bench viewport.
const GAUGE_ARC_WIDTH = 420;
const GAUGE_ARC_HEIGHT = 320;

// bklit's own 270deg sweep, reprojected into TanStack's angle convention --
// see header comment for the D28-confirmed 135->405deg <-> -3*PI/4->3*PI/4
// correspondence.
const START_ANGLE = (-3 * Math.PI) / 4;
const END_ANGLE = (3 * Math.PI) / 4;

// bklit's arc-gauge default (`spacing` prop default 25, gauge.tsx:273) --
// reused here purely for a visually comparable gap ratio; the ceiling
// doesn't need to track the scenario's actual `spacing` prop since bklit's
// pixel geometry is out of scope for this performance-only approximation.
const SPACING_PERCENT = 25;

interface ArcNotch {
  index: number;
  startAngle: number;
  endAngle: number;
}

function buildArcNotches(totalNotches: number): ArcNotch[] {
  const totalAngle = END_ANGLE - START_ANGLE;
  const availableAngle = totalAngle * (1 - SPACING_PERCENT / 100);
  const notchAngle = totalNotches > 0 ? availableAngle / totalNotches : 0;
  const gapDen = totalNotches - 1 > 0 ? totalNotches - 1 : 1;
  const gapAngle = (totalAngle * (SPACING_PERCENT / 100)) / gapDen;

  return Array.from({ length: totalNotches }, (_, i) => {
    const start = START_ANGLE + i * (notchAngle + gapAngle);
    return { index: i, startAngle: start, endAngle: start + notchAngle };
  });
}

export default function TanstackGauge({ n }: { n: number }) {
  const [gauge, setGauge] = useState<SeededGauge>(() =>
    generateGauge("gauge", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setGauge(generateGaugeUpdate("gauge", n, tickRef.current));
      });
    // Same as bklit-gauge.tsx: `n` is totalNotches, no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const notches = buildArcNotches(gauge.totalNotches);
    const activeNotches = Math.round(
      (gauge.value / 100) * gauge.totalNotches,
    );
    const activeSubset = notches.filter((notch) => notch.index < activeNotches);

    return defineChart({
      marks: [
        polar({
          startAngle: START_ANGLE,
          endAngle: END_ANGLE,
          radiusRatio: 0.9,
          marks: [
            // Background layer -- ALL notches, gray, lower opacity (bklit's
            // "bg" pass, gauge.tsx:149-181).
            radialArc(notches, {
              key: (notch) => `bg-${notch.index}`,
              innerRadius: ({ radius }) => radius * 0.6,
              outerRadius: ({ radius }) => radius,
              cornerRadius: 1,
              fill: "#e5e7eb",
              fillOpacity: 0.8,
            }),
            // Active overlay -- only the active subset, solid color, full
            // opacity (bklit's active-fill pass, gauge.tsx:183-218).
            radialArc(activeSubset, {
              key: (notch) => `active-${notch.index}`,
              innerRadius: ({ radius }) => radius * 0.6,
              outerRadius: ({ radius }) => radius,
              cornerRadius: 1,
              fill: "#10b981",
              fillOpacity: 1,
            }),
          ],
        }),
      ],
      // Polar is a positionless container mark -- no cartesian x/y scales
      // or guides (every polar worked example in the docs, radar/pie
      // precedent). No angle/radius scale is configured at the `polar()`
      // level either: both `radialArc` calls read absolute per-datum
      // radians directly (see header comment), so `requiresAngleScale` /
      // `requiresRadiusScale` are both false here and no scale is required.
      guides: false,
      x: null,
      y: null,
    });
  }, [gauge]);

  return (
    <Chart
      ariaLabel="Gauge (arc) chart benchmark scenario"
      width={GAUGE_ARC_WIDTH}
      height={GAUGE_ARC_HEIGHT}
      definition={definition}
      onRender={onRender}
    />
  );
}
