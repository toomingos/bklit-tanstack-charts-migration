// Migrated Gauge (linear) scenario -- IDENTICAL usage/scope to
// bklit-gaugelinear.tsx (same docs-mdx-derived "with label below center"
// component tree/props -- see that file's own header for the full D28
// rationale on why this is a SEPARATE `ChartKind` ("gaugelinear") from the
// arc pilot, each covering its own structurally disjoint `Gauge` code path
// at its own gated `n`), only the import source changes.
//
// Same `armManualSettle` + same `gaugeSettleMs` STAGGER math +
// `REVEAL_CLOCK_MARGIN_MS` as bklit-gaugelinear.tsx / migrated-gauge.tsx
// (reveal timing is orientation-agnostic), but the per-notch reveal TAIL
// deliberately differs from bklit's -- see SPRING_SETTLE_TAIL_MS below and
// migrated-gauge.tsx's full derivation (docs/LOG.md D56).
import { useMemo, useEffect, useRef, useState } from "react";
import { Gauge } from "@migrated/charts";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// DELIBERATELY DIFFERENT from bklit-gaugelinear.tsx's 450 — reveal timing is
// orientation-agnostic, so see migrated-gauge.tsx's full derivation for why
// migrated's baked WAAPI tween runs 712ms (SETTLE_EPSILON = 0.001) where
// bklit's live framer-motion spring is 1%-settled at 450 (docs/LOG.md D56).
const SPRING_SETTLE_TAIL_MS = 712;

function gaugeSettleMs(value: number, totalNotches: number): number {
  const stagger = 1; // enterStaggerScale default
  const activeNotches = Math.round((value / 100) * totalNotches);
  const bgLastDelayMs = Math.max(0, totalNotches - 1) * 0.015 * stagger * 1000;
  const activeLastDelayMs =
    activeNotches > 0
      ? (0.3 + (activeNotches - 1) * 0.02) * stagger * 1000
      : 0;
  const lastDelayMs = Math.max(bgLastDelayMs, activeLastDelayMs);
  return lastDelayMs + SPRING_SETTLE_TAIL_MS;
}

// Same constant/derivation as bklit-gaugelinear.tsx's REVEAL_CLOCK_MARGIN_MS.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function MigratedGaugeLinear({ n }: { n: number }) {
  const [gauge, setGauge] = useState<SeededGauge>(() =>
    generateGauge("gaugelinear", n),
  );
  const tickRef = useRef(0);

  useMemo(() => {
    const initial = generateGauge("gaugelinear", n);
    const settleMs =
      gaugeSettleMs(initial.value, initial.totalNotches) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setGauge(generateGaugeUpdate("gaugelinear", n, tickRef.current));
      });
    // Same as migrated-gauge.tsx: `n` is totalNotches, no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <Gauge
      orientation="linear"
      value={gauge.value}
      centerValue={gauge.centerValue}
      defaultLabel="ARR run rate"
      labelPlacement="bottom"
      labelAlign="center"
      totalNotches={gauge.totalNotches}
      spacing={0}
      notchCornerRadius={3}
      inactiveFillOpacity={0.4}
      useGradient
    />
  );
}
