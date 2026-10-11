// Static painted-geometry arc generator for radialArc({ generator }): native `states` style paint only (gap #31: the charts use none), so bklit's translate pop-out
// (pie-chart.tsx) and `grow` effect (kit/polar/polar-dim.ts: a scale for a pie, a `d` variant for a donut) are CSS.
import { arc as d3Arc } from "d3-shape";
import type { Arc } from "d3-shape";

type PieHoverEffect = "translate" | "grow" | "none";

interface PieArcRow {
  readonly sliceIndex: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly padAngle: number;
  readonly fill: string;
  readonly effect: PieHoverEffect;
  readonly offset: number;
  readonly animate: boolean;
}

interface PieArcGeneratorOptions {
  readonly innerRadius: number;
  readonly cornerRadius: number;
}

const CENTER_EPSILON_PX = 0.5;

const buildBaseArc = (row: PieArcGeneratorOptions, outerRadius: number): Arc<unknown, PieArcRow> =>
  d3Arc<PieArcRow>()
    .startAngle((datum: Readonly<PieArcRow>) => datum.startAngle)
    .endAngle((datum: Readonly<PieArcRow>) => datum.endAngle)
    .padAngle((datum: Readonly<PieArcRow>) => datum.padAngle)
    // A true zero inner radius ends the outline at the exact centre, whose angle (atan2(0, -0)) is 180deg: the native
    // radial-sweep entrance reads it as part of the slice and over-sweeps, revealing later slices too early.
    .innerRadius(Math.max(row.innerRadius, CENTER_EPSILON_PX))
    .outerRadius(outerRadius)
    .cornerRadius(row.cornerRadius);

const pieArcGenerator = (options: Readonly<PieArcGeneratorOptions>) =>
  (layout: Readonly<{ radius: number }>): Arc<unknown, PieArcRow> => buildBaseArc(options, layout.radius);

/** Slice outline at an explicit outer radius (the grown variant for donuts, built once per slice on the host, not on hover). */
const pieArcPath = (options: Readonly<PieArcGeneratorOptions>, outerRadius: number, row: Readonly<PieArcRow>): string => buildBaseArc(options, outerRadius)(row) ?? "";

export { pieArcGenerator, pieArcPath };
export type { PieArcRow, PieHoverEffect };
