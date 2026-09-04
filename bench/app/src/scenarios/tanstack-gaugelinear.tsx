// Ceiling reference: n notches as plain barY bars (active rule mirrors bklit's activeNotches).
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barY, defineChart } from "@tanstack/charts";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const LINEAR_ASPECT_RATIO = 8;

interface LinearNotch {
  index: string;
  height: number;
  active: boolean;
}

function buildLinearNotches(
  totalNotches: number,
  value: number,
): LinearNotch[] {
  const activeNotches = Math.round((value / 100) * totalNotches);
  return Array.from({ length: totalNotches }, (_, i) => ({
    index: `notch-${i}`,
    height: 1,
    active: i < activeNotches,
  }));
}

export default function TanstackGaugeLinear({ n }: { n: number }) {
  const [gauge, setGauge] = useState<SeededGauge>(() =>
    generateGauge("gaugelinear", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setGauge(generateGaugeUpdate("gaugelinear", n, tickRef.current));
      });
    // GUARD: n is totalNotches; no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const notches = buildLinearNotches(gauge.totalNotches, gauge.value);
    return defineChart({
      marks: [
        barY(notches, {
          id: "notches",
          x: "index",
          y: "height",
          key: "index",
          inset: 1,
          fill: (notch) => (notch.active ? "#10b981" : "#e5e7eb"),
        }),
      ],
      x: { scale: () => scaleBand<string>().paddingInner(0.15), grid: false },
      y: { scale: scaleLinear().domain([0, 1]), grid: false },
      tooltip: false,
    });
  }, [gauge]);

  return (
    <Chart
      ariaLabel="Gauge (linear) chart benchmark scenario"
      aspectRatio={LINEAR_ASPECT_RATIO}
      definition={definition}
      onRender={onRender}
    />
  );
}
