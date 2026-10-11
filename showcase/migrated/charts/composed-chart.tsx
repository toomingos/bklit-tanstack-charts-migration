// bklit ComposedChart on native TanStack Charts: Area / Line / SeriesBar children are config carriers
// compiled by the cartesian kit (lines, areas) and composed/ (bars as rect marks) into one defineChart.
import type { ReactElement } from "react";
import { useHostSize } from "./kit/size/host-size";
import { bklitSurfaceStyle } from "./kit/theme";
import { ComposedChartMounted } from "./composed/mounted";
import type { ComposedChartProps } from "./composed/types";
import "./styles.css";

// Built once at the real width (kit/size/host-size.ts); the svg mounts in the commit of that layout-effect measure, before first paint (bklit waits on ParentSize first, composed-chart.tsx:308).
const ComposedChart = (props: Readonly<ComposedChartProps>): ReactElement => {
  const { ref, size } = useHostSize();
  if (size === null) {
    // bklit's outer div carries `style={{ aspectRatio }}` from its first render (composed-chart.tsx:289 default "2 / 1", :306); only the svg waits for the measure.
    return <div ref={ref} className={props.className} style={{ width: "100%", position: "relative", aspectRatio: props.aspectRatio ?? "2 / 1", ...bklitSurfaceStyle }} />;
  }
  return <ComposedChartMounted {...props} initialWidth={size.width} />;
};

ComposedChart.displayName = "ComposedChart";

export { ComposedChart };
export type { ComposedChartProps };
