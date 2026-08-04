// Native TanStack Charts equivalent of bklit's candlestick-chart.tsx demo,
// following the three-link structure documented in
// repos/tanstack-charts/benchmarks/conformance/cases/28-candlestick/tanstack.ts
// (one wick `link` per candle low->high, plus pre-split gains/losses body
// `link`s open->close so up/down candles get distinct colors without a
// color-scale channel) -- default/unstyled TanStack theming only (see
// docs/LOG.md) -- this is the performance-ceiling reference, NOT a
// bklit-styled clone (same philosophy as tanstack-line.tsx's header
// comment). Colors (#64748b wick, #10b981 gains, #ef4444 losses) are taken
// verbatim from that conformance fixture, the canonical "plain TanStack"
// candlestick reference.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart, link } from "@tanstack/charts";
import {
  generateCandles,
  generateCandlesUpdate,
  type SeededOhlcRow,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveCandle } from "../bench/live";

// --- Body stroke-width approximation -------------------------------------
// The conformance fixture this scenario is modeled on hardcodes a fixed
// 5px body stroke width (fine for its 30-candle fixture, but at bench sizes
// n=1000/10000 a fixed 5px would visibly overlap into a solid block -- not
// a "density-appropriate" ceiling render). Per the task, this instead
// derives stroke width from (an approximation of) chart inner width / n.
//
// This is a deliberate APPROXIMATION, not a live measurement: `Chart` fills
// 100% of its container's width (packages/core/src/sizing.ts) and #chart-root
// has a fixed CSS width of 1100px with 24px padding each side (bench/app/src
// /styles.css), but the chart's own auto-computed margin (from axis label
// widths, packages/charts-core/src/facet.ts) isn't knowable before render
// without an extra measure-then-reflow pass -- which would risk perturbing
// the very M1a/M1c mount timings this harness measures. 64px stands in for
// a typical y-axis price-label + tick reservation. Getting this exactly
// right isn't the point; "density-appropriate instead of a fixed 5px" is.
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
        // Wick: low -> high, thin. Its y channel values (low, high) are the
        // widest extent in the dataset, so the auto-computed y domain across
        // all three marks below already comes out to [min(low), max(high)]
        // nice -- body-link y values (open/close) are always within that
        // range, so no manual y domain override is needed to get there.
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
        // Body, up candles (close >= open, matching bklit's isPositive rule).
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
        // Body, down candles.
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
      tooltip: true,
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
