"use client";

// bklit ChartStatFlow: NumberFlow value + label stack. NumberFlow is an HTML overlay in bklit too.
import NumberFlow from "@number-flow/react";
import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./kit/cn";

/** Number formatting options for `ChartStatFlow`. They follow `Intl.NumberFormat`. */
export interface ChartStatFlowFormat {
  /** `"standard"` writes the full number, `"compact"` abbreviates it (1.2K). */
  notation?: "standard" | "compact";
  /** Whether compact notation uses short (`K`) or long (`thousand`) forms. */
  compactDisplay?: "short" | "long";
  /** Fewest digits after the decimal point. */
  minimumFractionDigits?: number;
  /** Most digits after the decimal point. */
  maximumFractionDigits?: number;
  /** Fewest digits before the decimal point; shorter numbers are zero-padded. */
  minimumIntegerDigits?: number;
  /** Fewest significant digits. */
  minimumSignificantDigits?: number;
  /** Most significant digits. */
  maximumSignificantDigits?: number;
  /** `"decimal"`, `"percent"` or `"currency"`. */
  style?: "decimal" | "percent" | "currency";
  /** ISO 4217 currency code, for example `"USD"`. Required when `style` is `"currency"`. */
  currency?: string;
  /** How the currency is written: `"symbol"`, `"narrowSymbol"`, `"code"` or `"name"`. */
  currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
  /** Unit identifier, for example `"kilometer"`. */
  unit?: string;
  /** How the unit is written: `"short"`, `"long"` or `"narrow"`. */
  unitDisplay?: "short" | "long" | "narrow";
}

/** The default `formatOptions` of `ChartStatFlow`: standard notation, no decimals. */
export const defaultChartStatFlowFormat: ChartStatFlowFormat = {
  notation: "standard",
  maximumFractionDigits: 0,
};

// Fluid typography for pie / ring / gauge center labels (container query units).
/** @internal */
export const chartCenterContainerClassName = "bk-center";
/** @internal */
export const chartCenterValueClassName = "bk-center-value";
/** @internal */
export const chartCenterLabelClassName = "bk-center-label";

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

/** Props of `ChartStatFlow`. */
export interface ChartStatFlowProps {
  /** The number to show. */
  value: number;
  /** Caption shown below the number. */
  label: string;
  /**
   * How the number is formatted.
   * @default { notation: "standard", maximumFractionDigits: 0 }
   */
  formatOptions?: ChartStatFlowFormat;
  /** Text placed before the number, for example `"$"`. */
  prefix?: string;
  /** Text placed after the number, for example `"%"`. */
  suffix?: string;
  /** Class names that replace the default number style. */
  valueClassName?: string;
  /** Class names that replace the default label style. */
  labelClassName?: string;
  /** Icon shown in a circle above the number. */
  icon?: ReactNode;
}

/**
 * A big number with a label below it, for the center of a pie, ring or gauge chart. The number animates between values once its web component has loaded and is plain text before that.
 */
export const ChartStatFlow = ({
  value,
  label,
  formatOptions = defaultChartStatFlowFormat,
  prefix,
  suffix,
  valueClassName = "bk-text-2xl bk-font-bold",
  labelClassName = "bk-text-xs",
  icon,
}: ChartStatFlowProps): ReactElement => {
  const numberFlowReady = useNumberFlowElementReady();
  const staticValue = useMemo(() => formatStatValue(value, formatOptions, prefix, suffix), [value, formatOptions, prefix, suffix]);
  return (
    <>
      {icon ? <div className="bk-stat-icon">{icon}</div> : null}
      <span className={cn("bk-stat-value", valueClassName)}>
        {numberFlowReady ? <NumberFlow format={formatOptions} isolate prefix={prefix} suffix={suffix} value={value} willChange /> : staticValue}
      </span>
      <span className={cn("bk-stat-label", labelClassName)}>{label}</span>
    </>
  );
};
ChartStatFlow.displayName = "ChartStatFlow";
