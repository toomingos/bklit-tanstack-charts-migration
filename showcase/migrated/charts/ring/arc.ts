// Per-ring arc generator for radialArc({ generator }): each row carries its own radii, which stock radialArc cannot express per datum.
// bklit's hover scale is a CSS transform on each ring's <g> (ring-chart.tsx), not geometry; focus hit-tests the static radii.
import { arc as d3Arc } from "d3-shape";
import type { Arc } from "d3-shape";

interface RingArcRow {
  readonly key: string;
  readonly kind: "track" | "progress";
  readonly ringIndex: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly cornerRadius: number;
  readonly fill: string;
  readonly animate: boolean;
}

const ringArcGenerator = (fit: number) =>
  (): Arc<unknown, RingArcRow> =>
    d3Arc<RingArcRow>()
      .startAngle((row: Readonly<RingArcRow>) => row.startAngle)
      .endAngle((row: Readonly<RingArcRow>) => row.endAngle)
      .innerRadius((row: Readonly<RingArcRow>) => row.innerRadius * fit)
      .outerRadius((row: Readonly<RingArcRow>) => row.outerRadius * fit)
      .cornerRadius((row: Readonly<RingArcRow>) => row.cornerRadius * fit);

export { ringArcGenerator };
export type { RingArcRow };
