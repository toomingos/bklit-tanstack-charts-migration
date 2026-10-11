// bklit ComposedChart on native TanStack Charts: Area / Line / SeriesBar children are config carriers
// compiled by the cartesian kit (lines, areas) and composed/ (bars as rect marks) into one defineChart.
import type { ReactElement } from "react";
import { useHostSize } from "./kit/size/host-size";
import { useParentSizeMounted } from "./kit/size/parent-size-arm";
import { bklitSurfaceStyle } from "./kit/theme";
import { ComposedChartMounted } from "./composed/mounted";
import type { ComposedChartProps } from "./composed/types";
import "./styles.css";

// Built once at the real width (kit/size/host-size.ts); the svg mounts on bklit's ParentSize commit
// (composed-chart.tsx:308; @visx/responsive useParentSize.js:37-63) via parent-size-arm.tsx, then <RevealArm> counts from it.
const ComposedChart = (props: Readonly<ComposedChartProps>): ReactElement => {
  const { ref, size } = useHostSize();
  const parentSized = useParentSizeMounted(ref, size !== null);
  if (size === null || !parentSized) {
    // bklit's outer div carries `style={{ aspectRatio }}` from its first render (composed-chart.tsx:289 default "2 / 1", :306); only the svg waits on ParentSize.
    return <div ref={ref} className={props.className} style={{ width: "100%", position: "relative", aspectRatio: props.aspectRatio ?? "2 / 1", ...bklitSurfaceStyle }} />;
  }
  return <ComposedChartMounted {...props} initialWidth={size.width} />;
};

ComposedChart.displayName = "ComposedChart";

export { ComposedChart };
export type { ComposedChartProps };
