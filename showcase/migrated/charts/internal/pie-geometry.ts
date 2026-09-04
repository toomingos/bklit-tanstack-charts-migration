// One shared port of bklit's duplicated slice-arc/offset helpers;
// D3-shape arc() used directly (byte-identical to the @visx/shape wrapper).
import { arc as arcGenerator } from "d3-shape";

interface PieArcPathOptions {
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly cornerRadius: number;
  readonly padAngle: number;
}

const pieArcPath = (options: Readonly<PieArcPathOptions>): string => {
  const { cornerRadius, endAngle, innerRadius, outerRadius, padAngle, startAngle } = options;
  const generator = arcGenerator<{ startAngle: number; endAngle: number }>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(cornerRadius)
    .padAngle(padAngle);
  return generator({ endAngle, startAngle }) ?? "";
}

interface SliceOffset {
  readonly x: number;
  readonly y: number;
}

// Outward offset along the slice's own mid-angle (d3: 0 at 12 o'clock, CW).
const sliceMidOffset = (startAngle: number, endAngle: number, distance: number): SliceOffset => {
  const midAngle = (startAngle + endAngle) / 2;
  return {
    x: Math.sin(midAngle) * distance,
    y: -Math.cos(midAngle) * distance,
  };
}

export { pieArcPath, sliceMidOffset };
export type { PieArcPathOptions, SliceOffset };
