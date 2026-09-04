import type { PieSliceHoverEffect } from "./pie-hover-chrome";

// Config element for one pie slice; read by PieChart, renders nothing itself.
interface PieSliceProps {
  index: number;
  color?: string;
  fill?: string;
  animate?: boolean;
  showGlow?: boolean;
  hoverEffect?: PieSliceHoverEffect;
  hoverOffset?: number;
  className?: string;
}

const PieSlice = (_props: Readonly<PieSliceProps>): null => null;

PieSlice.displayName = "PieSlice";

export { PieSlice };
export type { PieSliceProps };
