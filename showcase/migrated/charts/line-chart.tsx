// bklit LineChart on native TanStack Charts: children are config carriers,
// compiled by the shared cartesian kit into one defineChart definition.
import { useEffect } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { CartesianChart } from "./kit/cartesian/cartesian-chart";
import type { ChartMargin } from "./kit/theme";
import type { ChartDatum, ChartPhase, ChartStatus, EnterTransition } from "./kit/types";

export interface LineChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly status?: ChartStatus;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  readonly children: ReactNode;
  readonly loadingLabel?: string;
  readonly style?: CSSProperties;
  readonly animationEasing?: string;
  readonly yDomainTween?: boolean;
  readonly yDomainTweenDuration?: number;
  readonly xDomain?: [Date, Date];
  readonly xDomainSlotCount?: number;
  readonly tweenYDomainOnXDomainChange?: boolean;
  /** Overrides the entrance timing (springs coerce to tweens). */
  readonly enterTransition?: EnterTransition;
  /** Changing it replays the entrance. */
  readonly revealSignature?: string;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

export const LineChart = ({
  status = "ready",
  onPhaseChange,
  loadingLabel,
  margin,
  aspectRatio,
  className,
  ariaLabel,
  revealSignature = "",
  ...rest
}: Readonly<LineChartProps>): ReactElement => {
  useEffect(() => {
    onPhaseChange?.(status === "loading" ? "loading" : "ready");
  }, [status, onPhaseChange]);
  return (
    <CartesianChart
      key={revealSignature}
      {...rest}
      status={status}
      loadingLabel={loadingLabel}
      margin={margin}
      aspectRatio={aspectRatio}
      className={className}
      ariaLabel={status === "loading" ? "Loading chart" : ariaLabel}
      defaultAriaLabel={status === "loading" ? "Loading chart" : "Line chart"}
    />
  );
};
