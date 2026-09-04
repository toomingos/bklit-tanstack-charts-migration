// Linear gauge: docs-mdx pattern verbatim (separate ChartKind); no formatOptions, so plain decimal format.
import { useMemo, useEffect, useRef, useState } from "react";
import { Gauge } from "@bklitui/ui/charts";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Same notch reveal timing as arc (orientation only changes geometry); same settle formula.
const SPRING_SETTLE_TAIL_MS = 450;

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

// Covers render-to-animation-start gap; mirrored in migrated pair (M1b absorbs it).
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitGaugeLinear({ n }: { n: number }) {
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
    // n = totalNotches, not a window: no live-append concept.
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
