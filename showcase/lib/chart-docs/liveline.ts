import type { ChartDoc } from "./types";

export const doc: ChartDoc = {
  description: "A line that scrolls as new values arrive, for prices, metrics and other streaming data.",
  code: `import { useEffect, useState } from "react";
import { ChartTooltip, LiveLine, LiveLineChart, LiveXAxis, LiveYAxis } from "bklit-tanstack-charts";

const WINDOW_SECS = 30;
const formatUsd = (v: number) => \`$\${v.toFixed(2)}\`;

export function PriceTicker() {
  const [data, setData] = useState(() => {
    const now = Date.now() / 1000;
    return Array.from({ length: 30 }, (_, i) => ({ time: now - (30 - i), value: 100 + Math.sin(i / 4) * 2 }));
  });
  const [value, setValue] = useState(data[data.length - 1].value);

  // Push a new point every 600 ms and drop the ones that left the window.
  useEffect(() => {
    const id = setInterval(() => {
      const time = Date.now() / 1000;
      const next = 100 + Math.sin(time / 4) * 2 + (Math.random() - 0.5);
      setData((prev) => [...prev.filter((p) => p.time >= time - WINDOW_SECS * 2), { time, value: next }]);
      setValue(next);
    }, 600);
    return () => clearInterval(id);
  }, []);

  return (
    <LiveLineChart
      data={data}
      value={value}
      window={WINDOW_SECS}
      margin={{ top: 16, right: 16, bottom: 40, left: 56 }}
      style={{ height: 260 }}
    >
      <LiveLine dataKey="value" formatValue={formatUsd} stroke="var(--chart-line-primary)" />
      <ChartTooltip showDatePill={false} />
      <LiveXAxis />
      <LiveYAxis formatValue={formatUsd} position="left" />
    </LiveLineChart>
  );
}
`,
  usage: `import { LiveLine, LiveLineChart, LiveXAxis } from "bklit-tanstack-charts";

// data: { time: number; value: number }[] with time in seconds. Append a point and update value as each one arrives.
export function Ticker({ data, value }: { data: { time: number; value: number }[]; value: number }) {
  return (
    <LiveLineChart data={data} value={value} style={{ height: 260 }}>
      <LiveLine dataKey="value" />
      <LiveXAxis />
    </LiveLineChart>
  );
}
`,
  api: [
    {
      name: "LiveLineChart",
      description: "The root. Takes the points so far and the latest value.",
      props: [
        { name: "data", type: "{ time: number; value: number }[]", description: "Points, with time in seconds. Append new points and drop old ones." },
        { name: "value", type: "number", description: "The latest value. The line head moves to it." },
        { name: "dataKey", type: "string", default: '"value"', description: "Key holding the y value." },
        { name: "window", type: "number", default: "30", description: "Seconds of history visible." },
        { name: "numXTicks", type: "number", default: "5", description: "Number of time labels." },
        { name: "nowOffsetUnits", type: "number", default: "0", description: "Gap between the head and the right edge, in x-tick units." },
        { name: "exaggerate", type: "boolean", default: "false", description: "Fit the y range tightly to the visible values." },
        { name: "lerpSpeed", type: "number", default: "0.08", description: "How fast the y range follows the data. Higher is faster." },
        { name: "paused", type: "boolean", default: "false", description: "Freeze the scroll." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 24, right: 16, bottom: 32, left: 16 }", description: "Space around the plot." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles. Set the height here." },
      ],
    },
    {
      name: "LiveLine",
      props: [
        { name: "dataKey", type: "string", description: "Key holding the y value." },
        { name: "stroke", type: "string", default: "var(--chart-line-primary)", description: "Line color." },
        { name: "strokeWidth", type: "number", default: "2", description: "Line width." },
        { name: "fill", type: "boolean", default: "true", description: "Fade fill under the line." },
        { name: "pulse", type: "boolean", default: "true", description: "Pulse ring on the head dot." },
        { name: "dotSize", type: "number", default: "4", description: "Head dot radius." },
        { name: "badge", type: "boolean", default: "true", description: "Value badge next to the head." },
        { name: "formatValue", type: "(value: number) => string", description: "Formats the badge and tooltip value." },
        { name: "momentumColors", type: "{ up: string; down: string; flat: string }", description: "Colors the head dot by recent direction." },
      ],
    },
    {
      name: "LiveXAxis",
      props: [
        { name: "numTicks", type: "number", description: "Number of labels. Overrides numXTicks." },
        { name: "formatTime", type: "(time: number) => string", description: "Label formatter; receives seconds." },
      ],
    },
    {
      name: "LiveYAxis",
      props: [
        { name: "position", type: '"left" | "right"', default: '"left"', description: "Side of the axis." },
        { name: "minGap", type: "number", default: "36", description: "Minimum space between labels in px." },
        { name: "allowDecimals", type: "boolean", default: "true", description: "Allow non-integer tick values." },
        { name: "formatValue", type: "(value: number) => string", description: "Label formatter." },
      ],
    },
    {
      name: "ChartTooltip",
      description: "Crosshair and tooltip box on hover.",
      props: [
        { name: "showCrosshair", type: "boolean", default: "true", description: "Vertical crosshair." },
        { name: "showDots", type: "boolean", default: "true", description: "Dot on the line." },
        { name: "content", type: "(props) => ReactNode", description: "Replaces the box content. point has date, time and the value." },
      ],
    },
  ],
};
