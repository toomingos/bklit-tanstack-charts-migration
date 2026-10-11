// bklit `ChartLoadingLabel`: the centered shimmering "Loading" overlay, with the loading -> ready exit (drop, fade, blur).
"use client";

import type { ReactElement } from "react";
import "./styles.css";
import { LoadingLabel } from "./kit/loading-label";

interface ChartLoadingLabelProps {
  /** Label shown centered over the chart. */
  text?: string;
  className?: string;
  /** Animate down, fade, and blur during loading -> ready handoff. */
  exiting?: boolean;
}

const ChartLoadingLabel = ({ text = "Loading", className, exiting = false }: Readonly<ChartLoadingLabelProps>): ReactElement | null => (
  <LoadingLabel text={text} className={className} exiting={exiting} />
);

export { ChartLoadingLabel };
export type { ChartLoadingLabelProps };
