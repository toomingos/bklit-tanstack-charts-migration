"use client";

// bklit ChartStatFlow: NumberFlow value + label stack. NumberFlow is an HTML overlay in bklit too.
import NumberFlow from "@number-flow/react";
import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./kit/cn";

export interface ChartStatFlowFormat {
  notation?: "standard" | "compact";
  compactDisplay?: "short" | "long";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
  minimumSignificantDigits?: number;
  maximumSignificantDigits?: number;
  style?: "decimal" | "percent" | "currency";
  currency?: string;
  currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
  unit?: string;
  unitDisplay?: "short" | "long" | "narrow";
}

export const defaultChartStatFlowFormat: ChartStatFlowFormat = {
  notation: "standard",
  maximumFractionDigits: 0,
};

// Fluid typography for pie / ring / gauge center labels (container query units).
export const chartCenterContainerClassName = "@container/chart-center size-full min-w-0";
export const chartCenterValueClassName = "font-bold tabular-nums leading-none text-[clamp(0.75rem,22cqw,1.875rem)]";
export const chartCenterLabelClassName = "max-w-full truncate leading-tight text-[clamp(0.625rem,9cqw,0.75rem)]";

function formatStatValue(value: number, formatOptions: ChartStatFlowFormat, prefix?: string, suffix?: string): string {
  const formatted = new Intl.NumberFormat(undefined, formatOptions).format(value);
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

function useNumberFlowElementReady(): boolean {
  const [ready, setReady] = useState(() => typeof customElements !== "undefined" && Boolean(customElements.get("number-flow-react")));
  useEffect(() => {
    let cancelled = false;
    const waitForElement = async (): Promise<void> => {
      await customElements.whenDefined("number-flow-react");
      if (!cancelled) {
        setReady(true);
      }
    };
    if (!ready) {
      void waitForElement();
    }
    return (): void => {
      cancelled = true;
    };
  }, [ready]);
  return ready;
}

export interface ChartStatFlowProps {
  value: number;
  label: string;
  formatOptions?: ChartStatFlowFormat;
  prefix?: string;
  suffix?: string;
  valueClassName?: string;
  labelClassName?: string;
  icon?: ReactNode;
}

export const ChartStatFlow = ({
  value,
  label,
  formatOptions = defaultChartStatFlowFormat,
  prefix,
  suffix,
  valueClassName = "text-2xl font-bold",
  labelClassName = "text-xs",
  icon,
}: ChartStatFlowProps): ReactElement => {
  const numberFlowReady = useNumberFlowElementReady();
  const staticValue = useMemo(() => formatStatValue(value, formatOptions, prefix, suffix), [value, formatOptions, prefix, suffix]);
  return (
    <>
      {icon ? <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">{icon}</div> : null}
      <span className={cn("text-foreground tabular-nums", valueClassName)}>
        {numberFlowReady ? <NumberFlow format={formatOptions} isolate prefix={prefix} suffix={suffix} value={value} willChange /> : staticValue}
      </span>
      <span className={cn("mt-0.5 text-chart-label", labelClassName)}>{label}</span>
    </>
  );
};
ChartStatFlow.displayName = "ChartStatFlow";
