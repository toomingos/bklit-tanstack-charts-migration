// Ceiling reference: fixture 28-candlestick three-link structure (wick + pre-split gain/loss bodies).
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart, link } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import {
  generateCandles,
  generateCandlesUpdate,
  type SeededOhlcRow,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveCandle } from "../bench/live";

// Body width from approx inner width / n (fixed 5px would block up at n=1000+); never measured live.
const CHART_ROOT_WIDTH = 1100;
const CHART_ROOT_PADDING = 24;
const ESTIMATED_AXIS_MARGIN = 64;
const APPROX_INNER_WIDTH =
  CHART_ROOT_WIDTH - CHART_ROOT_PADDING * 2 - ESTIMATED_AXIS_MARGIN;

function candleStrokeWidth(n: number): number {
  const raw = (APPROX_INNER_WIDTH / Math.max(n, 1)) * 0.8;
  return Math.min(20, Math.max(0.5, raw));
}

export default function TanstackCandlestick({ n }: { n: number }) {
  const [data, setData] = useState<SeededOhlcRow[]>(() =>
    generateCandles("candlestick", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateCandlesUpdate("candlestick", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveCandle("candlestick", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  const definition = useMemo(() => {
    const bodyStrokeWidth = candleStrokeWidth(n);
    const gains = data.filter((d) => d.close >= d.open);
    const losses = data.filter((d) => d.close < d.open);
    return defineChart({
      marks: [
        link(data, {
          id: "wick",
          x1: "date",
          y1: "low",
          x2: "date",
          y2: "high",
          key: "id",
          stroke: "#64748b",
          strokeWidth: 1,
        }),
        link(gains, {
          id: "gains",
          x1: "date",
          y1: "open",
          x2: "date",
          y2: "close",
          key: "id",
          stroke: "#10b981",
          strokeWidth: bodyStrokeWidth,
        }),
        link(losses, {
          id: "losses",
          x1: "date",
          y1: "open",
          x2: "date",
          y2: "close",
          key: "id",
          stroke: "#ef4444",
          strokeWidth: bodyStrokeWidth,
        }),
      ],
      x: { scale: scaleUtc, nice: true },
      y: { scale: scaleLinear, nice: true, grid: true },
      tooltip,
    });
  }, [data, n]);

  return (
    <Chart
      ariaLabel="Candlestick chart benchmark scenario"
      aspectRatio={2}
      definition={definition}
      onRender={onRender}
    />
  );
}
