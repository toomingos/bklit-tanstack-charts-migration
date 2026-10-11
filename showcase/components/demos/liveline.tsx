"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as BklitCharts from "@showcase/bklit-charts";
import * as MigratedCharts from "@showcase/migrated-charts";
import {
  getLiveLineSeed,
  liveLineCutoffSecs,
  liveLineTickValue,
  liveLineWindowSecs,
} from "@/lib/demo-data";

const TICK_INTERVAL_MS = 600;

function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

interface LiveLineDemoProps {
  impl: "bklit" | "migrated";
  n: number;
}

export default function LiveLineDemo({ impl, n }: LiveLineDemoProps) {
  const Charts = impl === "bklit" ? BklitCharts : MigratedCharts;
  const [data, setData] = useState(() => getLiveLineSeed(n));
  const [value, setValue] = useState<number>(
    () => data[data.length - 1]?.value ?? 0,
  );
  const tickRef = useRef(0);

  const pushLiveTick = useCallback(() => {
    tickRef.current += 1;
    const tick = tickRef.current;
    const nextValue = liveLineTickValue(n, tick);
    const nextTime = Date.now() / 1000;
    const cutoff = liveLineCutoffSecs(n);
    setData((prev) => {
      const cutoffTime = nextTime - cutoff;
      return [
        ...prev.filter((p) => p.time >= cutoffTime),
        { time: nextTime, value: nextValue },
      ];
    });
    setValue(nextValue);
  }, [n]);

  useEffect(() => {
    const id = setInterval(pushLiveTick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pushLiveTick]);

  return (
    <div className="w-full">
      <Charts.LiveLineChart
        data={data}
        margin={{ top: 16, right: 16, bottom: 40, left: 56 }}
        style={{ height: 260 }}
        value={value}
        window={liveLineWindowSecs(n)}
      >
        <Charts.LiveLine
          dataKey="value"
          formatValue={formatUsd}
          stroke="var(--chart-line-primary)"
        />
        <Charts.ChartTooltip
          content={({ point }) => {
            const date = point.date instanceof Date ? point.date : new Date();
            const time = date.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            const val = typeof point.value === "number" ? point.value : 0;
            return (
              <div className="px-3 py-2.5">
                <div className="mb-1.5 font-medium text-popover-foreground text-xs opacity-60">
                  {time}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Price</span>
                  <span className="ml-auto font-medium text-popover-foreground tabular-nums">
                    {formatUsd(val)}
                  </span>
                </div>
              </div>
            );
          }}
          showDatePill={false}
        />
        <Charts.LiveXAxis />
        <Charts.LiveYAxis formatValue={formatUsd} position="left" />
      </Charts.LiveLineChart>
    </div>
  );
}
