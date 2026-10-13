"use client";
// bklit AreaChart on native TanStack Charts (shares the cartesian kit with LineChart).
import { useEffect } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { CartesianChart } from "./kit/cartesian/cartesian-chart";
import type { ChartMargin } from "./kit/theme";
import type { ChartDatum, ChartPhase, ChartStatus, EnterTransition } from "./kit/types";

interface AreaChartProps {
  readonly data: ChartDatum[];
  readonly xDataKey?: string;
  readonly status?: ChartStatus;
  readonly animationDuration?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly aspectRatio?: string;
  readonly className?: string;
  readonly onPhaseChange?: (phase: ChartPhase) => void;
  readonly loadingLabel?: string;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
  readonly animationEasing?: string;
  readonly yDomainTween?: boolean;
  readonly yDomainTweenDuration?: number;
  readonly xDomain?: [Date, Date];
  readonly xDomainSlotCount?: number;
  readonly tweenYDomainOnXDomainChange?: boolean;
  readonly enterTransition?: EnterTransition;
  readonly revealSignature?: string;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const AreaChart = ({
  status = "ready",
  onPhaseChange,
  loadingLabel,
  margin,
  aspectRatio,
  className,
  ariaLabel = "Area chart",
  revealSignature = "",
  ...rest
}: Readonly<AreaChartProps>): ReactElement => {
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
      defaultAriaLabel={status === "loading" ? "Loading chart" : "Area chart"}
    />
  );
};

export { AreaChart };
export type { AreaChartProps };
