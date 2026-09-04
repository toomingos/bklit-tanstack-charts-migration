// Shared center-stat island (bklit ChartStatFlow port) for ring/pie/gauge centers.
// Sanctioned React exception: NumberFlow's digit-roll API needs a real re-render on hover; typing is hand-authored CSS (styles.css).
import NumberFlow from "@number-flow/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

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
  readonly currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
  readonly unit?: string;
  readonly unitDisplay?: "short" | "long" | "narrow";
}

const defaultCenterStatFormat: CenterStatFormat = {
  maximumFractionDigits: 0,
  notation: "standard",
};

const centerStatContainerClassName = "ts-bkm-center-stat";
const centerStatValueClassName = "ts-bkm-center-stat-value";
const centerStatLabelClassName = "ts-bkm-center-stat-label";
const centerStatIconClassName = "ts-bkm-center-stat-icon";

interface FormatStatValueParams {
  readonly formatOptions: Readonly<CenterStatFormat>;
  readonly prefix: string | undefined;
  readonly suffix: string | undefined;
  readonly value: number;
}

const formatStatValue = (params: Readonly<FormatStatValueParams>): string => {
  const { formatOptions, prefix, suffix, value } = params;
  const formatted = new Intl.NumberFormat(
    undefined,
    formatOptions,
  ).format(value);
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

/**
 * Presence probe for the `customElements` DOM global; property access on `globalThis`
 * avoids the `ReferenceError` a bare reference throws during SSR.
 * @param {Candidate} registry The global registry, absent outside a DOM environment.
 * @returns {boolean} Whether the custom-elements registry is defined.
 */
const isCustomElementsDefined = <Candidate,>(registry: Candidate): registry is Candidate & CustomElementRegistry =>
  registry !== undefined;

/** Gates `<NumberFlow>` behind `customElements.whenDefined`; static `Intl` fallback pre-hydration. */
const useNumberFlowElementReady = (): boolean => {
  const [ready, setReady] = useState(
    () => isCustomElementsDefined(globalThis.customElements) &&
      Boolean(globalThis.customElements.get("number-flow-react")),
  );

  useEffect(() => {
    if (ready) {return undefined;}
    let cancelled = false;
    const markReadyWhenDefined = async (): Promise<void> => {
      try {
        await customElements.whenDefined("number-flow-react");
      } catch {
        // Invalid element name — the static Intl fallback stays mounted.
        return;
      }
      if (!cancelled) {setReady(true);}
    };
    // Fire-and-forget by design: the effect's cancellation flag above guards the late resolve.
    void markReadyWhenDefined();
    return (): void => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}

interface CenterStatProps {
  readonly value: number;
  readonly label: string;
  readonly formatOptions?: CenterStatFormat;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly valueClassName?: string;
  readonly labelClassName?: string;
  readonly icon?: Readonly<ReactNode>;
}

const CenterStat = ({
  value,
  label,
  formatOptions = defaultCenterStatFormat,
  prefix,
  suffix,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  icon,
}: Readonly<CenterStatProps>): ReactElement => {
  const numberFlowReady = useNumberFlowElementReady();
  const hasIcon = Boolean(icon);
  const staticValue = useMemo(
    () => formatStatValue({ formatOptions, prefix, suffix, value }),
    [value, formatOptions, prefix, suffix],
  );

  return (
    <>
      {hasIcon ? <div className={centerStatIconClassName}>{icon}</div> : undefined}
      <span className={valueClassName}>
        {numberFlowReady ? (
          <NumberFlow
            format={formatOptions}
            isolate
            prefix={prefix}
            suffix={suffix}
            value={value}
            willChange
          />
        ) : (
          staticValue
        )}
      </span>
      <span className={labelClassName}>{label}</span>
    </>
  );
}

CenterStat.displayName = "CenterStat";

/** Pub/sub contract any chart hover coordinator satisfies; keeps this hook chart-agnostic. */
interface CenterStatHoverSource {
  getHovered: () => number | null
  subscribe: (listener: () => void) => () => void
}

const useCenterStatHover = (source: Readonly<CenterStatHoverSource>): number | null => useSyncExternalStore(
    source.subscribe,
    source.getHovered,
    source.getHovered,
  );


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

/** 0 → double-rAF → value mount entrance; `intro=false` passes through untouched. */
const useIntroFlowValue = (value: number, intro: boolean): number => {
  const introStartedRef = useRef(false);
  const [flowValue, setFlowValue] = useState(() => (intro ? 0 : value));

  useEffect(() => {
    if (!intro) {
      setFlowValue(value);
      return undefined;
    }
    if (!introStartedRef.current) {
      introStartedRef.current = true;
      setFlowValue(0);
      let innerRaf = 0;
      const outerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(() =>{  setFlowValue(value); });
      });
      return (): void => {
        cancelAnimationFrame(outerRaf);
        cancelAnimationFrame(innerRaf);
        introStartedRef.current = false;
      };
    }
    setFlowValue(value);
    return undefined;
  }, [intro, value]);

  return flowValue;
}

// Centered flex box. Hovered content lays out in a row.
// Default stat stacks value over label.
const centerShellStyle = (centerSize: number, isHovered: boolean): CSSProperties => {
  const style: CSSProperties = {
    alignItems: "center",
    display: "flex",
    height: centerSize,
    justifyContent: "center",
    width: centerSize,
  };
  if (!isHovered) {
    style.flexDirection = "column";
    style.textAlign = "center";
  }
  return style;
};

const CenterShell = <Data,>({
  value,
  label,
  centerSize,
  hoveredData,
  intro = false,
  formatOptions = defaultCenterStatFormat,
  prefix,
  suffix,
  className = centerStatContainerClassName,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  children,
}: Readonly<CenterShellProps<Data>>): ReactElement => {
  const flowValue = useIntroFlowValue(value, intro);

  if (children && hoveredData !== null && hoveredData !== undefined) {
    return (
      <div
        className={className}
        style={centerShellStyle(centerSize, true)}
      >
        {children({ data: hoveredData, isHovered: true, label, value })}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={centerShellStyle(centerSize, false)}
    >
      <CenterStat
        formatOptions={formatOptions}
        label={label}
        labelClassName={labelClassName}
        prefix={prefix}
        suffix={suffix}
        value={flowValue}
        valueClassName={valueClassName}
      />
    </div>
  );
}

CenterShell.displayName = "CenterShell";

export {
  CenterShell,
  CenterStat,
  centerStatContainerClassName,
  centerStatIconClassName,
  centerStatLabelClassName,
  centerStatValueClassName,
  defaultCenterStatFormat,
  useCenterStatHover,
  useIntroFlowValue,
};
export type {
  CenterShellProps,
  CenterShellRenderProps,
  CenterStatFormat,
  CenterStatHoverSource,
  CenterStatProps,
};
