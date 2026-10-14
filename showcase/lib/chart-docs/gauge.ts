import type { ChartDoc } from "./types";

export const doc: ChartDoc = {
  description: "Shows one value out of 100 as a row of notches, in an arc or a straight line.",
  code: `import { Gauge } from "bklit-tanstack-charts";

export function Gauges() {
  return (
    <div>
      <Gauge
        value={66}
        centerValue={428000}
        defaultLabel="ARR run rate"
        formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
        inactiveFillOpacity={0.4}
        spacing={25}
      />
      <Gauge
        orientation="linear"
        value={72}
        totalNotches={72}
        notchCornerRadius={3}
        notchLengthPercent={38}
        inactiveFillOpacity={0.4}
        spacing={0}
        useGradient
      />
      <Gauge
        orientation="linear"
        value={72}
        centerValue={428000}
        defaultLabel="ARR run rate"
        formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
        inactiveFillOpacity={0.4}
        labelAlign="center"
        labelPlacement="bottom"
        notchCornerRadius={3}
        spacing={0}
        totalNotches={72}
        useGradient
      />
    </div>
  );
}
`,
  usage: `import { Gauge } from "bklit-tanstack-charts";

export function Score() {
  return <Gauge value={66} centerValue={66} defaultLabel="Score" />;
}
`,
  api: [
    {
      name: "Gauge",
      description: "A single component; there are no children to compose.",
      props: [
        { name: "value", type: "number", description: "Filled share, from 0 to 100." },
        { name: "orientation", type: '"arc" | "linear"', default: '"arc"', description: "Arc or straight line." },
        { name: "totalNotches", type: "number", default: "40", description: "Number of notches." },
        { name: "spacing", type: "number", default: "25", description: "Gap between notches." },
        { name: "notchCornerRadius", type: "number", default: "0", description: "Rounding of notch corners." },
        { name: "notchLengthPercent", type: "number", default: "100", description: "Notch length as a percent of the track." },
        { name: "notchWidthPercent", type: "number", default: "80", description: "Notch width as a percent of its slot." },
        { name: "startAngle", type: "number", default: "135", description: "Arc start in degrees." },
        { name: "endAngle", type: "number", default: "405", description: "Arc end in degrees." },
        { name: "useGradient", type: "boolean", default: "false", description: "Fill active notches with a gradient." },
        { name: "activeGradient", type: "readonly [string, string]", description: "Gradient colors for active notches." },
        { name: "inactiveGradient", type: "readonly [string, string]", description: "Gradient colors for inactive notches." },
        { name: "activeFill", type: "string", description: "Solid color for active notches." },
        { name: "inactiveFill", type: "string", description: "Solid color for inactive notches." },
        { name: "activeFillOpacity", type: "number", default: "1", description: "Opacity of active notches." },
        { name: "inactiveFillOpacity", type: "number", default: "0.8", description: "Opacity of inactive notches." },
        { name: "centerValue", type: "number", description: "Number shown as the label value." },
        { name: "defaultLabel", type: "string", default: '"Total"', description: "Label text." },
        { name: "prefix", type: "string", description: "Text before the value." },
        { name: "suffix", type: "string", description: "Text after the value." },
        { name: "formatOptions", type: "Intl.NumberFormatOptions", description: "Number format for the value." },
        { name: "labelPlacement", type: '"top" | "bottom"', default: '"top"', description: "Label position on a linear gauge." },
        { name: "labelAlign", type: '"start" | "center" | "end"', default: '"start"', description: "Label alignment on a linear gauge." },
        { name: "linearHeight", type: "number", default: "24", description: "Track height in px for a linear gauge." },
        { name: "width", type: "number", description: "Fixed width in px." },
        { name: "height", type: "number", description: "Fixed height in px." },
        { name: "minWidth", type: "number", description: "Minimum width in px." },
        { name: "className", type: "string", description: "Class on the gauge container." },
      ],
    },
  ],
};
