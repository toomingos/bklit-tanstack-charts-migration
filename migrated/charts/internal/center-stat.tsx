// Shared, chart-agnostic center-stat island — vendors bklit's
// repos/bklit-ui/packages/ui/src/charts/chart-stat-flow.tsx (`ChartStatFlow`)
// + chart-center-typography.ts verbatim, for reuse by RingChart's
// `RingCenter` (ring-chart.tsx, this migration) and — per the lead's own
// ruling for this deliverable — a future GaugeChart center. Kept free of
// any Ring-specific (or Pie-specific) types/behavior so that reuse is a
// straight import, not a copy-paste-and-rename.
//
// --- Why this is a SANCTIONED React island (differs from PieCenter) -------
// Every other hover/reveal path in migrated/charts is imperative-only —
// zero React state, zero framer-motion, in the pointer/hover paint path
// (docs/LOG.md D10; see internal/pie-hover-chrome.ts, internal/spring.ts).
// `PieCenter` (migrated/charts/pie-chart.tsx) follows that rule by pre-
// rendering every hover variant as a CSS-grid-stacked sibling and toggling
// `display` imperatively — but that trick only works because pie's center
// text is plain formatted strings. This module's whole purpose is
// `@number-flow/react`'s digit-ROLL animation, whose public API is a React
// `value` PROP (`<NumberFlow value={n} />`) — there is no imperative
// "retarget this number and animate the roll" escape hatch to call instead
// (unlike a spring's `.set()`). Matching bklit's own hover-driven digit
// roll pixel-for-pixel (QA's screenshot gate can catch a capture mid-roll,
// so the roll's start time / easing must match, not just its settled end
// value) genuinely requires an actual React re-render on hover change —
// the lead's ruling for this deliverable is to accept that one exception
// rather than drop NumberFlow the way the pie pilot did (a real behavioral
// difference from pie, disclosed here and in ring-chart.tsx's own header).
//
// --- Keeping the concession small: `useCenterStatHook` ---------------------
// bklit itself re-renders its WHOLE chart subtree on every hover change —
// `hoveredIndex` lives in the same flat React context every ring/slice AND
// the center consume (ring-context.tsx's single `RingHoverContext`). This
// migrated architecture instead keeps hover chrome for every OTHER element
// (ring scale/opacity/filter) fully imperative specifically so hovering
// doesn't re-render anything (D10). `useCenterStatHover`
// (`useSyncExternalStore` against the caller's own hover coordinator) scopes
// the one sanctioned React update to just this island — the smallest
// possible re-rendering surface, not the whole chart — so the concession
// stays as cheap as it can be while still producing the same pixel-for-
// pixel NumberFlow roll bklit shows.
//
// --- Typography (disclosed adaptation, byte-identical values) -------------
// bklit's center value/label use Tailwind arbitrary-value classes
// (chart-center-typography.ts: `@container/chart-center size-full
// min-w-0`; value `font-bold tabular-nums leading-none
// text-[clamp(0.75rem,22cqw,1.875rem)]`; label `max-w-full truncate
// leading-tight text-[clamp(0.625rem,9cqw,0.75rem)]`) COMBINED with
// ChartStatFlow's own wrapper spans (`text-foreground tabular-nums` on the
// value span, `mt-0.5 text-chart-label` on the label span — read precisely:
// RingCenter always supplies its OWN `valueClassName`/`labelClassName`
// defaults into `<ChartStatFlow>`, which are the fluid clamp() classes
// above, so ChartStatFlow's *own* internal defaults ("text-2xl font-bold" /
// "text-xs") never actually apply through RingCenter — only its unconditional
// wrapper classes do). bench/app's Tailwind `@source` only scans
// repos/bklit-ui's real sources, not migrated/charts, so those utility
// classes would never generate CSS from this file's location — ported as
// plain hand-authored CSS instead (styles.css's `.ts-bkm-center-stat*`
// rules), byte-identical clamp()/weight/line-height/margin values, same
// precedent as pie-chart.tsx's `.ts-bkm-pie-center*` rules (written
// independently here since pie's block predates this shared module and
// this deliverable doesn't touch pie-chart.tsx — see ring-chart.tsx header).
import NumberFlow from "@number-flow/react";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/** Subset of `Intl.NumberFormatOptions` supported by NumberFlow — bklit's
    `ChartStatFlowFormat` (chart-stat-flow.tsx), ported verbatim. */
export interface CenterStatFormat {
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

/** bklit chart-stat-flow.tsx's `defaultChartStatFlowFormat`, verbatim. */
export const defaultCenterStatFormat: CenterStatFormat = {
  notation: "standard",
  maximumFractionDigits: 0,
};

// See file header — hand-authored ports of chart-center-typography.ts +
// ChartStatFlow's own wrapper-span classes, combined (styles.css).
export const centerStatContainerClassName = "ts-bkm-center-stat";
export const centerStatValueClassName = "ts-bkm-center-stat-value";
export const centerStatLabelClassName = "ts-bkm-center-stat-label";
export const centerStatIconClassName = "ts-bkm-center-stat-icon";

function formatStatValue(
  value: number,
  formatOptions: CenterStatFormat,
  prefix?: string,
  suffix?: string,
): string {
  const formatted = new Intl.NumberFormat(
    undefined,
    formatOptions as Intl.NumberFormatOptions,
  ).format(value);
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

/**
 * bklit chart-stat-flow.tsx's `useNumberFlowElementReady`, verbatim: gates
 * the REAL `<NumberFlow>` custom element behind
 * `customElements.whenDefined("number-flow-react")`, falling back to a
 * plain `Intl.NumberFormat` string pre-hydration/pre-definition. This is
 * ChartStatFlow's own sanctioned static-fallback path (not this module's
 * invention) — it's what makes SSR/pre-hydration renders correct, distinct
 * from the "no NumberFlow at all" deviation pie's PieCenter took for a
 * different reason (see file header).
 */
function useNumberFlowElementReady(): boolean {
  const [ready, setReady] = useState(
    () =>
      typeof customElements !== "undefined" &&
      Boolean(customElements.get("number-flow-react")),
  );

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    customElements.whenDefined("number-flow-react").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}

export interface CenterStatProps {
  value: number;
  label: string;
  formatOptions?: CenterStatFormat;
  prefix?: string;
  suffix?: string;
  valueClassName?: string;
  labelClassName?: string;
  icon?: ReactNode;
}

/**
 * bklit chart-stat-flow.tsx's `ChartStatFlow`, ported verbatim: value+label
 * stack with a real NumberFlow digit-roll, `Intl.NumberFormat` static
 * fallback pre-hydration. Callers supply their own `valueClassName`/
 * `labelClassName` (RingCenter always does — see file header) since this
 * component's own defaults are only a plain, unstyled fallback.
 */
export function CenterStat({
  value,
  label,
  formatOptions = defaultCenterStatFormat,
  prefix,
  suffix,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  icon,
}: CenterStatProps) {
  const numberFlowReady = useNumberFlowElementReady();
  const staticValue = useMemo(
    () => formatStatValue(value, formatOptions, prefix, suffix),
    [value, formatOptions, prefix, suffix],
  );

  return (
    <>
      {icon ? <div className={centerStatIconClassName}>{icon}</div> : null}
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

/** Generic pub/sub contract any chart's imperative hover coordinator can
    satisfy — `RingHoverCoordinator`/`PieHoverCoordinator` both already do
    (internal/ring-hover-chrome.ts, internal/pie-hover-chrome.ts) — so this
    hook stays chart-agnostic rather than importing either concrete type. */
export interface CenterStatHoverSource {
  getHovered(): number | null;
  subscribe(listener: () => void): () => void;
}

/**
 * `useSyncExternalStore` binding onto a chart's hover coordinator, scoped to
 * just the caller (normally a chart's center-stat overlay component). See
 * file header for why this is the one sanctioned React re-render in an
 * otherwise fully-imperative hover architecture.
 */
export function useCenterStatHover(
  source: CenterStatHoverSource,
): number | null {
  return useSyncExternalStore(
    source.subscribe,
    source.getHovered,
    source.getHovered,
  );
}
