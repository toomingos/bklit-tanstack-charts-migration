"use client";

// Center stat shared by PieCenter, RingCenter and PieCenterShell: a NumberFlow HTML overlay as in bklit, typeset by the
// shared `.ts-bkm-center-stat*` rules in styles.css (same pattern as gauge/label.tsx).
import { joinClasses } from "../cn";
import NumberFlow from "@number-flow/react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

/** Number formatting options for a centre value, a subset of `Intl.NumberFormat` options. */
interface CenterStatFormat {
  /** `"standard"` or `"compact"` (1.2K). */
  readonly notation?: "standard" | "compact";
  /** `"short"` or `"long"` compact form; used with `notation: "compact"`. */
  readonly compactDisplay?: "short" | "long";
  /** Minimum number of fraction digits. */
  readonly minimumFractionDigits?: number;
  /** Maximum number of fraction digits. */
  readonly maximumFractionDigits?: number;
  /** Minimum number of integer digits. */
  readonly minimumIntegerDigits?: number;
  /** Minimum number of significant digits. */
  readonly minimumSignificantDigits?: number;
  /** Maximum number of significant digits. */
  readonly maximumSignificantDigits?: number;
  /** `"decimal"`, `"percent"` or `"currency"`. */
  readonly style?: "decimal" | "percent" | "currency";
  /** ISO 4217 currency code, for example `"USD"`; used with `style: "currency"`. */
  readonly currency?: string;
  /** How the currency is shown: symbol, code, name and so on. */
  readonly currencyDisplay?: Intl.NumberFormatOptions["currencyDisplay"];
  /** Unit identifier, for example `"kilometer"`. */
  readonly unit?: string;
  /** `"short"`, `"long"` or `"narrow"` unit form. */
  readonly unitDisplay?: "short" | "long" | "narrow";
}

const defaultCenterStatFormat: CenterStatFormat = { maximumFractionDigits: 0, notation: "standard" };
const CONTAINER_CLASS = "ts-bkm-center-stat";
const VALUE_CLASS = "ts-bkm-center-stat-value";
const LABEL_CLASS = "ts-bkm-center-stat-label";
/** Inset subtracted from the inner diameter so the stat box clears the arc edge. */
const CENTER_STAT_BOX_INSET_PX = 16;

/** Rolls the value in from 0 on mount (NumberFlow tween), as bklit's centers do. Only the first value is deferred, so a later hover change is a single commit. */
const useFlowValue = (value: number, intro: boolean): number => {
  const [introDone, setIntroDone] = useState(!intro);
  // The post-mount flip is the roll-in itself: NumberFlow tweens from 0 to the value once it is set.
  // oxlint-disable-next-line react/set-state-in-effect, react-doctor/rendering-hydration-no-flicker -- see above
  useEffect(() => { setIntroDone(true); }, []);
  return introDone ? value : 0;
};

interface CenterShellRenderProps<Data> {
  readonly value: number;
  readonly label: string;
  readonly isHovered: boolean;
  readonly data: Data;
}

interface CenterShellProps<Data> {
  readonly value: number;
  readonly label: string;
  readonly centerSize: number;
  readonly hoveredData?: Data | null;
  readonly intro?: boolean;
  readonly formatOptions?: CenterStatFormat;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly className?: string;
  readonly valueClassName?: string;
  readonly labelClassName?: string;
  readonly children?: (props: Readonly<CenterShellRenderProps<Data>>) => ReactNode;
}


/** Centered flex box: default stat stacks value over label; custom hovered content lays out in a row. */
const CenterShell = <Data,>({
  value, label, centerSize, hoveredData, intro = false, formatOptions = defaultCenterStatFormat, prefix, suffix,
  className = CONTAINER_CLASS, valueClassName = VALUE_CLASS, labelClassName = LABEL_CLASS, children,
}: Readonly<CenterShellProps<Data>>): ReactElement => {
  const flow = useFlowValue(value, intro);
  const custom = children !== undefined && hoveredData !== null && hoveredData !== undefined;
  const style = useMemo<CSSProperties>(() => {
    const box: CSSProperties = { alignItems: "center", display: "flex", height: centerSize, justifyContent: "center", width: centerSize };
    return custom ? box : { ...box, flexDirection: "column", textAlign: "center" };
  }, [centerSize, custom]);
  return (
    <div className={className} data-slot="center-stat" style={style}>
      {custom ? children({ data: hoveredData, isHovered: true, label, value }) : (
        <>
          <span className={valueClassName}><NumberFlow format={formatOptions} isolate prefix={prefix} suffix={suffix} value={flow} willChange /></span>
          <span className={labelClassName}>{label}</span>
        </>
      )}
    </div>
  );
};

interface PolarCenterProps<Data extends { readonly label: string; readonly value: number }> {
  readonly hoveredData: Data | undefined;
  readonly totalValue: number;
  readonly innerRadius: number;
  readonly defaultLabel?: string;
  readonly formatOptions?: CenterStatFormat;
  readonly children?: (props: Readonly<CenterShellRenderProps<Data>>) => ReactNode;
  readonly className?: string;
  readonly valueClassName?: string;
  readonly labelClassName?: string;
  readonly prefix?: string;
  readonly suffix?: string;
}

/** Stat for the hovered datum (or the total) in a box sized to the inner radius. */
const PolarCenter = <Data extends { readonly label: string; readonly value: number }>({
  hoveredData, totalValue, innerRadius, defaultLabel = "Total", formatOptions = defaultCenterStatFormat, children, className, valueClassName, labelClassName, prefix, suffix,
}: Readonly<PolarCenterProps<Data>>): ReactElement => (
  <CenterShell<Data>
    centerSize={innerRadius * 2 - CENTER_STAT_BOX_INSET_PX}
    className={joinClasses(CONTAINER_CLASS, className)}
    formatOptions={formatOptions}
    hoveredData={hoveredData}
    label={hoveredData ? hoveredData.label : defaultLabel}
    labelClassName={labelClassName}
    prefix={prefix}
    suffix={suffix}
    value={hoveredData ? hoveredData.value : totalValue}
    valueClassName={valueClassName}
  >
    {children}
  </CenterShell>
);

export { PolarCenter, defaultCenterStatFormat, useFlowValue };
export type { CenterStatFormat };
