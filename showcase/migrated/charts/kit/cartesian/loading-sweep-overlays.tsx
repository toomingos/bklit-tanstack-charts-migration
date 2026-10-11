// The sweep loading style (bklit line.tsx:173-186 / area.tsx:294-355): each sweep series draws its own skeleton silhouette under the shimmer band, over the plot area.
import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import { LineLoadingSweep } from "../loading/sweep";
import type { ChartMargin } from "../theme";
import type { ResolvedSeries } from "./series";

interface LoadingSweepOverlaysProps {
  readonly series: readonly ResolvedSeries[];
  /** The phase is exiting: the silhouette fades out (loading-sweep.tsx:395-409). */
  readonly exiting: boolean;
  readonly margin: ChartMargin;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

const OVERLAY_STYLE: CSSProperties = { position: "absolute", pointerEvents: "none", overflow: "visible", zIndex: 1 };

export const LoadingSweepOverlays = ({ series, exiting, margin, innerWidth, innerHeight }: Readonly<LoadingSweepOverlaysProps>): ReactElement | null => {
  const style = useMemo<CSSProperties>(() => ({ ...OVERLAY_STYLE, left: margin.left, top: margin.top }), [margin.left, margin.top]);
  const sweeping = series.filter((s) => s.loading?.style === "sweep");
  if (sweeping.length === 0 || innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }
  return (
    <svg
      aria-hidden="true"
      width={innerWidth}
      height={innerHeight}
      style={style}
    >
      {sweeping.map((s) => (
        <LineLoadingSweep
          key={s.id}
          curve={s.curve}
          withArea={s.kind === "area"}
          mode={exiting ? "exit" : (s.loading?.mode ?? "loop")}
          stroke={s.loading?.stroke}
          strokeOpacity={s.loading?.strokeOpacity}
          strokeWidth={s.strokeWidth}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
        />
      ))}
    </svg>
  );
};
