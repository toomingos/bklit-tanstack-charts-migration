import type { PieSliceHoverEffect } from "./pie-hover-chrome";

// Config element for one pie slice; read by PieChart, renders nothing itself.
interface PieSliceProps {
  readonly index: number;
  readonly color?: string;
  readonly fill?: string;
  readonly animate?: boolean;
  readonly showGlow?: boolean;
  readonly hoverEffect?: PieSliceHoverEffect;
  readonly hoverOffset?: number;
  readonly className?: string;
}

const PieSlice = (_props: Readonly<PieSliceProps>): null => null;

PieSlice.displayName = "PieSlice";

export { PieSlice };
export type { PieSliceProps };
