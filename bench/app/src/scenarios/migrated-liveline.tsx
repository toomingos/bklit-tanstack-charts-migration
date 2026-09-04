// Drop-in twin of bklit-liveline.tsx (tree/props/freeze protocol); only the import source changes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChartTooltip,
  LiveLine,
  LiveLineChart,
  LiveXAxis,
  LiveYAxis,
  type LiveLinePoint,
} from "@migrated/charts";
import {
  getLiveLineSeed,
  liveLineCutoffSecs,
  liveLineTickValue,
  liveLineWindowSecs,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import type { Scenario } from "../bench/query";

const TICK_INTERVAL_MS = 600;
const FREEZE_TICK_COUNT = 10;
const LERP_CONVERGENCE_WAIT_MS = 2000;
// Fallback sized with headroom over the ~8s freeze duration; safety net only.
const SETTLE_FALLBACK_MS = 15000;

function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

function rafDelay(frames: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = frames;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
      } else {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  });
}

export default function MigratedLiveLine({
  n,
  scenario,
}: {
  n: number;
  scenario?: Scenario;
}) {
  const [data, setData] = useState<LiveLinePoint[]>(() => getLiveLineSeed(n));
  const [value, setValue] = useState<number>(
    () => data[data.length - 1]?.value ?? 0,
  );
  const [paused, setPaused] = useState(false);
  const tickRef = useRef(0);
  const { resolve } = useMemo(() => armManualSettle(SETTLE_FALLBACK_MS), []);

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
    window.__benchUpdate = () => measureUpdatePaint(() => pushLiveTick());
    window.__benchLiveTick = () => pushLiveTick();
  }, [pushLiveTick]);

  useEffect(() => {
    let cancelled = false;

    if (scenario === "live") {
      (async () => {
        await new Promise((r) => setTimeout(r, LERP_CONVERGENCE_WAIT_MS));
        if (cancelled) return;
        await rafDelay(2);
        if (cancelled) return;
        resolve();
      })();
      return () => {
        cancelled = true;
      };
    }

    let count = 0;
    const id = setInterval(() => {
      count += 1;
      pushLiveTick();
      if (count >= FREEZE_TICK_COUNT) {
        clearInterval(id);
        (async () => {
          await new Promise((r) => setTimeout(r, LERP_CONVERGENCE_WAIT_MS));
          if (cancelled) return;
          setPaused(true);
          await rafDelay(2);
          if (cancelled) return;
          resolve();
        })();
      }
    }, TICK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, scenario]);

  return (
    <div className="w-full">
      <LiveLineChart
        data={data}
        margin={{ top: 16, right: 16, bottom: 40, left: 56 }}
        paused={paused}
        style={{ height: 260 }}
        value={value}
        window={liveLineWindowSecs(n)}
      >
        <LiveLine
          dataKey="value"
          formatValue={formatUsd}
          stroke="var(--chart-line-primary)"
        />
        <ChartTooltip
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
        <LiveXAxis />
        <LiveYAxis formatValue={formatUsd} position="left" />
      </LiveLineChart>
    </div>
  );
}
