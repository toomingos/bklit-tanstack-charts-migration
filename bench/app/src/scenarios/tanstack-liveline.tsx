// Ceiling reference: lineY re-rendered per seeded tick; hard snap, no bklit y-lerp.
// data holds the cutoff-trimmed buffer; visibleData narrows to the window for QA-comparable geometry.
// GUARD: freeze ticks in one synthetic burst (real 600ms cadence would race the settle fallback).
// Live/update ticks use real time; settle has already resolved by then.
// GUARD: gate onRender until freeze ticks land; Chart onRender fires on every pass incl. mount.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart, lineY } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import {
  getLiveLineSeed,
  liveLineCutoffSecs,
  liveLineTickValue,
  liveLineWindowSecs,
  type SeededLiveLinePoint,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import type { Scenario } from "../bench/query";

const TICK_INTERVAL_SEC = 0.6;
const FREEZE_TICK_COUNT = 10;

interface VisibleLiveLinePoint {
  date: Date;
  value: number;
}

export default function TanstackLiveLine({
  n,
  scenario,
}: {
  n: number;
  scenario?: Scenario;
}) {
  const [data, setData] = useState<SeededLiveLinePoint[]>(() =>
    getLiveLineSeed(n),
  );
  const tickRef = useRef(0);
  const ticksExhaustedRef = useRef(scenario === "live");
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  const applyTick = (time: number, tick: number) => {
    const value = liveLineTickValue(n, tick);
    const cutoff = time - liveLineCutoffSecs(n);
    setData((prev) => [
      ...prev.filter((p) => p.time >= cutoff),
      { time, value },
    ]);
  };

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        applyTick(Date.now() / 1000, tickRef.current);
      });
    window.__benchLiveTick = () => {
      tickRef.current += 1;
      applyTick(Date.now() / 1000, tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    if (scenario === "live") {
      return;
    }

    const baseTime = Date.now() / 1000;
    for (let k = 1; k <= FREEZE_TICK_COUNT; k++) {
      tickRef.current += 1;
      applyTick(baseTime + k * TICK_INTERVAL_SEC, tickRef.current);
    }
    ticksExhaustedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, scenario]);

  const visibleData = useMemo<VisibleLiveLinePoint[]>(() => {
    const latest = data[data.length - 1]?.time ?? 0;
    const windowStart = latest - liveLineWindowSecs(n);
    return data
      .filter((p) => p.time >= windowStart)
      .map((p) => ({ date: new Date(p.time * 1000), value: p.value }));
  }, [data, n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(visibleData, {
            id: "price",
            x: "date",
            y: "value",
          }),
        ],
        scales: {
          x: { scale: scaleUtc },
          y: { scale: scaleLinear, nice: true, grid: true },
        },
        tooltip,
      }),
    [visibleData],
  );

  const handleRender = () => {
    if (!ticksExhaustedRef.current) return;
    onRender();
  };

  return (
    <div className="w-full">
      <Chart
        ariaLabel="LiveLine chart benchmark scenario"
        aspectRatio={2}
        definition={definition}
        onRender={handleRender}
      />
    </div>
  );
}
