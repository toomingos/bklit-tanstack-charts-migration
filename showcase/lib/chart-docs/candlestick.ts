import type { ChartDoc } from "./types";

const data = `const data = [
  { date: new Date("2025-01-01"), open: 100, high: 108, low: 96, close: 104 },
  { date: new Date("2025-01-02"), open: 104, high: 112, low: 101, close: 109 },
  { date: new Date("2025-01-03"), open: 109, high: 115, low: 105, close: 108 },
  { date: new Date("2025-01-04"), open: 108, high: 114, low: 102, close: 110 },
  { date: new Date("2025-01-05"), open: 110, high: 118, low: 108, close: 115 },
  // ...
];`;

export const doc: ChartDoc = {
  description: "Open, high, low and close per period, for prices and other ranged values over time.",
  code: `import { Candlestick, CandlestickChart, ChartTooltip, XAxis } from "bklit-tanstack-charts";

${data}

export function PriceChart() {
  return (
    <CandlestickChart
      data={data}
      margin={{ top: 16, right: 16, bottom: 40, left: 16 }}
      style={{ height: 320 }}
    >
      <Candlestick fadedOpacity={0.25} />
      <ChartTooltip />
      <XAxis />
    </CandlestickChart>
  );
}
`,
  usage: `import { Candlestick, CandlestickChart, ChartTooltip, XAxis } from "bklit-tanstack-charts";

${data}

export function PriceChart() {
  return (
    <CandlestickChart data={data}>
      <Candlestick />
      <ChartTooltip />
      <XAxis />
    </CandlestickChart>
  );
}
`,
  api: [
    {
      name: "CandlestickChart",
      description: "The root. Holds the data and lays out its children.",
      props: [
        { name: "data", type: "OHLCDataPoint[]", description: "One { date, open, high, low, close } object per candle." },
        { name: "xDataKey", type: "string", default: '"date"', description: "Key holding the x value (a Date)." },
        { name: "animationDuration", type: "number", default: "1100", description: "Reveal duration in ms." },
        { name: "margin", type: "Partial<Margin>", default: "{ top: 40, right: 40, bottom: 40, left: 40 }", description: "Space around the plot." },
        { name: "aspectRatio", type: "string", default: '"2 / 1"', description: "CSS aspect ratio of the chart. A style height replaces it." },
        { name: "candleWidth", type: "number", description: "Fixed candle width in px. By default candles fill their slot minus candleGap." },
        { name: "candleGap", type: "number", default: "0.2", description: "Share of each slot left empty between candles." },
        { name: "xDomain", type: "[Date, Date]", description: "Visible x range." },
        { name: "xDomainSlotCount", type: "number", description: "Number of candle slots across the x range. Defaults to the number of candles." },
        { name: "revealSignature", type: "string", description: "Changing it plays the reveal again." },
        { name: "className", type: "string", description: "Class on the chart container." },
        { name: "style", type: "CSSProperties", description: "Inline styles on the chart container." },
      ],
    },
    {
      name: "Candlestick",
      description: "Draws the candles. A candle is positive when close is at or above open.",
      props: [
        { name: "positiveFill", type: "string", description: "Fill for positive candles. Defaults to green." },
        { name: "negativeFill", type: "string", description: "Fill for negative candles. Defaults to red." },
        { name: "showHoverFade", type: "boolean", default: "true", description: "Dim the other candles while one is hovered." },
        { name: "fadedOpacity", type: "number", default: "0.3", description: "Opacity of dimmed candles." },
        { name: "animate", type: "boolean", default: "true", description: "Animate the reveal." },
      ],
    },
    {
      name: "XAxis",
      props: [
        { name: "numTicks", type: "number", default: "5", description: "Number of labels." },
        { name: "tickMode", type: '"data" | "domain"', default: '"data"', description: '"data" puts labels on candles; "domain" spaces them evenly in time.' },
        { name: "formatValue", type: "(value: Date) => string", description: "Label formatter." },
      ],
    },
    {
      name: "ChartTooltip",
      description: "Crosshair, date pill and tooltip box.",
      props: [
        { name: "showDatePill", type: "boolean", default: "true", description: "Date pill on the x axis." },
        { name: "showCrosshair", type: "boolean", default: "true", description: "Vertical crosshair." },
        { name: "showDots", type: "boolean", default: "true", description: "Dots on the hovered candle." },
        { name: "indicatorColor", type: "string | (point) => string", description: "Crosshair color." },
      ],
    },
  ],
};
