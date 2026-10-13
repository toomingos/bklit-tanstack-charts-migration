// bklit `ChartLoadingLabel`: the centered shimmering "Loading" overlay, with the loading -> ready exit (drop, fade, blur).
"use client";

import type { ReactElement } from "react";
import { LoadingLabel } from "./kit/loading-label";

/** Props of `ChartLoadingLabel`. */
interface ChartLoadingLabelProps {
  /**
   * Label shown centered over the chart.
   * @default "Loading"
   */
  text?: string;
  /** Class names added to the label. */
  className?: string;
  /**
   * Animate the label down, fade it and blur it away as loading finishes.
   * @default false
   */
  exiting?: boolean;
}

/** A shimmering label centered over a chart while it loads. Set `exiting` to animate it away when loading finishes. */
const ChartLoadingLabel = ({ text = "Loading", className, exiting = false }: Readonly<ChartLoadingLabelProps>): ReactElement | null => (
  <LoadingLabel text={text} className={className} exiting={exiting} />
);

export { ChartLoadingLabel };
export type { ChartLoadingLabelProps };
