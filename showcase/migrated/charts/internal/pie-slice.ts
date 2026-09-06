import { memo } from "react";
import type { NamedExoticComponent, ReactElement } from "react";
import type { PieSliceHoverEffect } from "./hover-motion";

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

const RenderPieSlice = (_props: Readonly<PieSliceProps>): ReactElement | null => null;

const PieSlice: NamedExoticComponent<Readonly<PieSliceProps>> = memo(RenderPieSlice);

PieSlice.displayName = "PieSlice";

export { PieSlice };
export type { PieSliceProps };
