import type { ChartGradient } from "@tanstack/charts";
import type { ChartMargin } from "../theme";
import type { ChildTable } from "../read-children";
import type { AnyMark } from "../erased-types";
import type { ResolvedSeries, Row } from "./series";
import type { WipeConfig } from "./wipe";

export interface CartesianInput {
  readonly data: readonly Row[];
  readonly xKey: string;
  readonly table: ChildTable;
  readonly series: readonly ResolvedSeries[];
  readonly margin: ChartMargin;
  readonly xDomain?: readonly [Date, Date];
  /** Plot (inner) size in px, for the segment drag geometry; the height is unclamped (negative when the margins exceed the host). */
  readonly plotWidth?: number;
  readonly plotHeight?: number;
  /** Inner plot width in px: the decimation threshold (bklit `maxRenderPointsForWidth`). Absent or 0: no decimation. */
  readonly innerWidth?: number;
  readonly uid: string;
  /** The chart's `status="loading"`: the grid takes its loading look (grid-guides.ts `loadingGridProps`). */
  readonly chartLoading?: boolean;
  readonly animationDuration: number;
  readonly animationEasing?: string;
  /** ProfitLossLegend hover: 0 = Profit, 1 = Loss (dims the other sign on ProfitLossLine), or null. */
  readonly profitLossHovered?: number | null;
  readonly extraMarks: readonly AnyMark[];
  readonly extraXValues: readonly Date[];
  readonly extraYValues: readonly number[];
  readonly extraGradients: readonly ChartGradient[];
  readonly renderTooltipEnabled: boolean;
  /** Controlled brush range (strip charts that contain a ChartBrush child): the last ACCEPTED range, never a preview. */
  readonly brush?: {
    readonly range: { start: Date; end: Date };
    /** Hatch colour (ChartBrush `selectionPattern.color`). */
    readonly color?: string;
    readonly onChange: (range: { start: Date; end: Date }, type: "preview" | "commit" | "cancel") => void;
  };
  /** Data-update step (see `useDataUpdateStep`). "snap": new data over `yDomainFrom`, nothing animates (bklit snaps on a data change). "glide": new y domain, 500ms tween.
   * "window": a brushed x domain change (bklit snaps the x scale, axis and grid and tweens the series paths and y domain, 500ms). Absent: a size or selection change, which keeps the short UPDATE_MOTION. */
  readonly updateStep?: "snap" | "glide" | "window";
  readonly yDomainFrom?: Readonly<Record<string, readonly [number, number]>>;
  /** Native left-to-right reveal (bklit ChartRevealClip) of line / area / projection marks: progress 0..1 (seeded 0, flipped to 1 by `<RevealArm>`). Absent = not wrapped.
   * `w` / `h` are the inner plot size; `pad` extends the clip each side (composed: half a bar group, bklit `revealClipPadding`). */
  readonly wipe?: WipeConfig;
}
