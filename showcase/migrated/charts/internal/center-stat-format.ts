// Center-stat number formatting: NumberFlow format subset plus the static Intl fallback.
/** Currency display variants supported by NumberFlow (bklit `ChartStatFlowFormat` port). */
type CenterStatCurrencyDisplay = "symbol" | "narrowSymbol" | "code" | "name";
/** Subset of `Intl.NumberFormatOptions` supported by NumberFlow (bklit `ChartStatFlowFormat` port). */
interface CenterStatFormat {
  readonly notation?: "standard" | "compact";
  readonly compactDisplay?: "short" | "long";
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
  readonly minimumIntegerDigits?: number;
  readonly minimumSignificantDigits?: number;
  readonly maximumSignificantDigits?: number;
  readonly style?: "decimal" | "percent" | "currency";
  readonly currency?: string;
  readonly currencyDisplay?: CenterStatCurrencyDisplay;
  readonly unit?: string;
  readonly unitDisplay?: "short" | "long" | "narrow";
}

const defaultCenterStatFormat: CenterStatFormat = {
  maximumFractionDigits: 0,
  notation: "standard",
};

export {
  defaultCenterStatFormat,
};
export type {
  CenterStatFormat,
};
