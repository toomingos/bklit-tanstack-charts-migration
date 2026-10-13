"use client";

// Lean gauge label pieces. A NumberFlow value is an HTML overlay by design (bklit uses NumberFlow too);
// typography comes from the shared `.ts-bkm-center-stat*` rules in styles.css, sizing is CSS-only.
import NumberFlow from "@number-flow/react";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

/** Side of a linear gauge's track where the label sits. */
export type GaugeLabelPlacement = "top" | "bottom" | "left" | "right";
/** Alignment of a linear gauge's label across the track. */
export type GaugeLabelAlign = "start" | "center" | "end";

/** Number formatting options for a gauge's centre value, a subset of `Intl.NumberFormat` options. */
export interface GaugeStatFormat {
  /** `"standard"` or `"compact"` (1.2K). */
  notation?: "standard" | "compact";
  /** `"short"` or `"long"` compact form; used with `notation: "compact"`. */
  compactDisplay?: "short" | "long";
  /** Minimum number of fraction digits. */
  minimumFractionDigits?: number;
  /** Maximum number of fraction digits. */
  maximumFractionDigits?: number;
  /** Minimum number of integer digits. */
  minimumIntegerDigits?: number;
  /** Minimum number of significant digits. */
  minimumSignificantDigits?: number;
  /** Maximum number of significant digits. */
  maximumSignificantDigits?: number;
  /** `"decimal"`, `"percent"` or `"currency"`. */
  style?: "decimal" | "percent" | "currency";
  /** ISO 4217 currency code, for example `"USD"`; used with `style: "currency"`. */
  currency?: string;
  /** How the currency is shown: symbol, code, name and so on. */
  currencyDisplay?: Intl.NumberFormatOptions["currencyDisplay"];
  /** Unit identifier, for example `"kilometer"`. */
  unit?: string;
  /** `"short"`, `"long"` or `"narrow"` unit form. */
  unitDisplay?: "short" | "long" | "narrow";
}

export const defaultGaugeStatFormat: GaugeStatFormat = { maximumFractionDigits: 0, notation: "standard" };

interface StatProps {
  readonly value: number;
  readonly label: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly format?: GaugeStatFormat;
  readonly valueClassName: string;
  readonly labelClassName: string;
  /** Roll in from 0 on mount (NumberFlow tween), as bklit's arc centre does. */
  readonly intro?: boolean;
}

/** bklit's arc centre (PieCenterShell) paints 0, then swaps in the real value two frames later so NumberFlow rolls 0 -> value (pie-center-shell.tsx:59-61, nested requestAnimationFrame).
 * Only that first swap is deferred; later value changes pass straight through. */
const useIntroValue = (value: number, intro: boolean): number => {
  const [introDone, setIntroDone] = useState(!intro);
  useEffect(() => {
    if (!intro) { return undefined; }
    let inner = 0;
    // Two frames, as pie-center-shell.tsx:59-60.
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => { setIntroDone(true); }); });
    return (): void => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, [intro]);
  return introDone ? value : 0;
};

const Stat = ({ value, label, prefix, suffix, format = defaultGaugeStatFormat, valueClassName, labelClassName, intro = false }: StatProps): ReactElement => {
  const flow = useIntroValue(value, intro);
  return (
    <>
      <span className={valueClassName}><NumberFlow format={format} isolate prefix={prefix} suffix={suffix} value={flow} willChange /></span>
      <span className={labelClassName}>{label}</span>
    </>
  );
};

const CENTER_OUTER_STYLE: CSSProperties = { alignItems: "center", display: "flex", inset: 0, justifyContent: "center", paddingTop: "8cqh", pointerEvents: "none", position: "absolute" };
const CENTER_INNER_STYLE: CSSProperties = { alignItems: "center", display: "flex", flexDirection: "column", height: "max(88px, calc(40cqh - 16px))", justifyContent: "center", textAlign: "center", width: "max(88px, calc(40cqh - 16px))" };

type StatBoxProps = Omit<StatProps, "valueClassName" | "labelClassName" | "intro">;

/** Arc centre: a square box tracking max(40% of the gauge size - 16px, 88px), sized with container query units. */
export const GaugeCenter = ({ value, label, prefix, suffix, format }: StatBoxProps): ReactElement => (
  <div style={CENTER_OUTER_STYLE}>
    <div className="ts-bkm-center-stat" style={CENTER_INNER_STYLE}>
      <Stat format={format} intro label={label} labelClassName="ts-bkm-center-stat-label" prefix={prefix} suffix={suffix} value={value} valueClassName="ts-bkm-center-stat-value ts-bkm-gauge-arc-value" />
    </div>
  </div>
);

const ALIGN_ITEMS = { center: "center", end: "flex-end", start: "flex-start" } as const;
const TEXT_ALIGN = { center: "center", end: "right", start: "left" } as const;
const perAlign = (style: (align: GaugeLabelAlign) => CSSProperties): Readonly<Record<GaugeLabelAlign, CSSProperties>> => ({ center: style("center"), end: style("end"), start: style("start") });

const STAT_STYLES = perAlign((align) => ({ alignItems: ALIGN_ITEMS[align], display: "flex", flexDirection: "column", minWidth: 0, textAlign: TEXT_ALIGN[align] }));

/** Linear label stack (plain inherited typography). */
const GaugeLabelStat = ({ align, value, label, prefix, suffix, format }: StatBoxProps & { readonly align: GaugeLabelAlign }): ReactElement => (
  <div className="ts-bkm-center-stat" style={STAT_STYLES[align]}>
    <Stat format={format} label={label} labelClassName="ts-bkm-gauge-linear-stat-label" prefix={prefix} suffix={suffix} value={value} valueClassName="ts-bkm-gauge-linear-stat-value" />
  </div>
);

const FILL: CSSProperties = { minWidth: 0, width: "100%" };
const TRACK_FILL: CSSProperties = { flex: "1 1 0%", minWidth: 0 };
const LABEL_SHRINK: CSSProperties = { flexShrink: 0 };
const COLUMN_STYLES = perAlign((align) => ({ alignItems: ALIGN_ITEMS[align], display: "flex", flexDirection: "column", gap: "0.75rem", ...FILL }));
const ROW_STYLES = perAlign((align) => ({ alignItems: ALIGN_ITEMS[align], display: "flex", flexDirection: "row", gap: "0.75rem", ...FILL }));
const LABEL_SELF_STYLES = perAlign((align) => ({ alignSelf: ALIGN_ITEMS[align] }));

interface LabelLayoutProps extends Omit<StatBoxProps, "value"> {
  readonly placement: GaugeLabelPlacement;
  readonly align: GaugeLabelAlign;
  /** The stat's value; the label is omitted while it is undefined. */
  readonly value: number | undefined;
  readonly children: ReactNode;
}

/** Four-placement, three-alignment label layout around the track. */
export const GaugeLabelLayout = ({ placement, align, value, label, prefix, suffix, format, children }: LabelLayoutProps): ReactElement => {
  if (value === undefined) { return <div style={FILL}>{children}</div>; }
  const vertical = placement === "top" || placement === "bottom";
  const labelFirst = placement === "top" || placement === "left";
  const labelNode = <div style={vertical ? LABEL_SELF_STYLES[align] : LABEL_SHRINK}><GaugeLabelStat align={align} format={format} label={label} prefix={prefix} suffix={suffix} value={value} /></div>;
  const track = <div style={vertical ? FILL : TRACK_FILL}>{children}</div>;
  return <div style={vertical ? COLUMN_STYLES[align] : ROW_STYLES[align]}>{labelFirst ? labelNode : track}{labelFirst ? track : labelNode}</div>;
};
