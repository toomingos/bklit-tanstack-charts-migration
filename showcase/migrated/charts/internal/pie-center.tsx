// PieCenter overlay — imperative variant-grid display toggling (N+1 variants:
// total + one per slice). No React state in the hover path. Extracted from
// pie-chart.tsx per AGENTS.md module split convention.
//
// Shared with PieChart via exported PieStableContext / PieHoverCoordinatorContext
// (created here and imported by pie-chart.tsx as providers).

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PieEnterTransition } from "./pie-reveal";
import type { PieHoverCoordinator } from "./pie-hover-chrome";
import type { PieData, PieArcData } from "../pie-chart";

// ---------------------------------------------------------------------------
// Shared context types, objects, and hooks (used by both PieChart + PieCenter)
// ---------------------------------------------------------------------------

export interface PieStableValue {
  data: PieData[];
  arcs: PieArcData[];
  size: number;
  center: number;
  outerRadius: number;
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;
  hoverOffset: number;
  enterTransition?: PieEnterTransition;
  enterStaggerScale: number;
  totalValue: number;
  getColor: (index: number) => string;
  getFill: (index: number) => string;
  geometryScrubbing: boolean;
  scrubSlicePaths: readonly string[] | null;
}

export const PieStableContext = createContext<PieStableValue | null>(null);
export const PieHoverCoordinatorContext = createContext<PieHoverCoordinator | null>(null);

export function usePieStable(): PieStableValue {
  const ctx = useContext(PieStableContext);
  if (!ctx) {
    throw new Error(
      "Pie components must be used within <PieChart>. Make sure <PieSlice>/<PieCenter> are children of a <PieChart>.",
    );
  }
  return ctx;
}

export function usePieHoverCoordinator(): PieHoverCoordinator {
  const ctx = useContext(PieHoverCoordinatorContext);
  if (!ctx) {
    throw new Error(
      "Pie components must be used within <PieChart>. Make sure <PieSlice>/<PieCenter> are children of a <PieChart>.",
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// PieCenter — formatting, props, and component
// ---------------------------------------------------------------------------

export interface PieCenterFormat {
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

export const defaultPieCenterFormat: PieCenterFormat = {
  notation: "standard",
  maximumFractionDigits: 0,
};

function formatCenterValue(value: number, formatOptions: PieCenterFormat, prefix?: string, suffix?: string): string {
  const formatted = new Intl.NumberFormat(undefined, formatOptions as Intl.NumberFormatOptions).format(value);
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

export interface PieCenterRenderProps {
  value: number;
  label: string;
  isHovered: boolean;
  data: PieData;
}

export interface PieCenterProps {
  defaultLabel?: string;
  formatOptions?: PieCenterFormat;
  children?: (props: PieCenterRenderProps) => ReactNode;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  prefix?: string;
  suffix?: string;
}

function StatFlowContent({
  value,
  label,
  formatOptions,
  prefix,
  suffix,
  valueClassName,
  labelClassName,
}: {
  value: number;
  label: string;
  formatOptions: PieCenterFormat;
  prefix?: string;
  suffix?: string;
  valueClassName?: string;
  labelClassName?: string;
}) {
  return (
    <>
      <span className={valueClassName ?? "ts-bkm-pie-center-value"}>
        {formatCenterValue(value, formatOptions, prefix, suffix)}
      </span>
      <span className={labelClassName ?? "ts-bkm-pie-center-label"}>{label}</span>
    </>
  );
}

export function PieCenter({
  defaultLabel = "Total",
  formatOptions = defaultPieCenterFormat,
  children,
  className,
  valueClassName,
  labelClassName,
  prefix,
  suffix,
}: PieCenterProps) {
  const stable = usePieStable();
  const coordinator = usePieHoverCoordinator();
  const variantRefs = useRef<Array<HTMLDivElement | null>>([]);

  const centerSize = stable.innerRadius * 2 - 16;

  useEffect(() => {
    const apply = () => {
      const hoveredIdx = stable.geometryScrubbing ? null : coordinator.getHovered();
      const activeVariant = hoveredIdx === null || hoveredIdx >= stable.data.length ? 0 : hoveredIdx + 1;
      for (let i = 0; i < variantRefs.current.length; i++) {
        const el = variantRefs.current[i];
        if (!el) continue;
        el.style.display = i === activeVariant ? "flex" : "none";
      }
    };
    apply();
    return coordinator.subscribe(apply);
  }, [coordinator, stable.geometryScrubbing, stable.data.length]);

  if (stable.innerRadius <= 0) return null;

  const containerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr",
    width: centerSize,
    height: centerSize,
    minWidth: 0,
  };

  return (
    <div className={className ? `ts-bkm-pie-center ${className}` : "ts-bkm-pie-center"} style={containerStyle}>
      {/* Variant 0: default (nothing hovered, or geometryScrubbing) */}
      <div
        ref={(el) => {
          variantRefs.current[0] = el;
        }}
        style={{
          gridArea: "1 / 1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <StatFlowContent
          formatOptions={formatOptions}
          label={defaultLabel}
          labelClassName={labelClassName}
          prefix={prefix}
          suffix={suffix}
          value={stable.totalValue}
          valueClassName={valueClassName}
        />
      </div>

      {/* Variants 1..N: one per slice */}
      {stable.data.map((d, i) => (
        <div
          key={d.label || i}
          ref={(el) => {
            variantRefs.current[i + 1] = el;
          }}
          style={{
            gridArea: "1 / 1",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            ...(children ? {} : { flexDirection: "column", textAlign: "center" }),
          }}
        >
          {children
            ? children({ value: d.value, label: d.label, isHovered: true, data: d })
            : (
              <StatFlowContent
                formatOptions={formatOptions}
                label={d.label}
                labelClassName={labelClassName}
                prefix={prefix}
                suffix={suffix}
                value={d.value}
                valueClassName={valueClassName}
              />
            )}
        </div>
      ))}
    </div>
  );
}

PieCenter.displayName = "PieCenter";
