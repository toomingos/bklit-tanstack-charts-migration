// Same tree/props as bklit-gaugelinear.tsx; only the import source changes (spring tail, see below).
import { useMemo, useEffect, useRef, useState } from "react";
import { Gauge } from "@migrated/charts";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// GUARD: 712, NOT bklit's 450 (see migrated-gauge.tsx); timing is orientation-agnostic.
const SPRING_SETTLE_TAIL_MS = 712;

function gaugeSettleMs(value: number, totalNotches: number): number {
  const stagger = 1;
  const activeNotches = Math.round((value / 100) * totalNotches);
  const bgLastDelayMs = Math.max(0, totalNotches - 1) * 0.015 * stagger * 1000;
  const activeLastDelayMs =
    activeNotches > 0
      ? (0.3 + (activeNotches - 1) * 0.02) * stagger * 1000
      : 0;
  const lastDelayMs = Math.max(bgLastDelayMs, activeLastDelayMs);
  return lastDelayMs + SPRING_SETTLE_TAIL_MS;
}

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
    // GUARD: n is totalNotches; no live-append concept.
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
