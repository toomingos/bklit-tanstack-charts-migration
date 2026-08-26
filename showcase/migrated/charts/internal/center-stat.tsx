// Shared, chart-agnostic center-stat island — vendors bklit's
// repos/bklit-ui/packages/ui/src/charts/chart-stat-flow.tsx (`ChartStatFlow`)
// + chart-center-typography.ts verbatim, for reuse by RingChart's
// `RingCenter` (ring-chart.tsx, this migration) and — per the lead's own
// ruling for this deliverable — a future GaugeChart center. Kept free of
// any Ring-specific (or Pie-specific) types/behavior so that reuse is a
// straight import, not a copy-paste-and-rename.
//
// --- Why this is a SANCTIONED React island ---------------------------------
// Every other hover/reveal path in migrated/charts is imperative-only —
// zero React state, zero framer-motion, in the pointer/hover paint path
// (docs/LOG.md D10; see internal/pie-hover-chrome.ts, internal/spring.ts).
// This module's whole purpose is `@number-flow/react`'s digit-ROLL
// animation, whose public API is a React `value` PROP (`<NumberFlow
// value={n} />`) — there is no imperative "retarget this number and
// animate the roll" escape hatch to call instead (unlike a spring's
// `.set()`). Matching bklit's own hover-driven digit roll pixel-for-pixel
// (QA's screenshot gate can catch a capture mid-roll, so the roll's start
// time / easing must match, not just its settled end value) genuinely
// requires an actual React re-render on hover change — the lead's ruling
// for this deliverable was to accept that one exception rather than drop
// NumberFlow. (Pie's PieCenter originally dodged the island with an
// imperative display-toggle over pre-rendered hover variants; its
// subsequent consolidation onto shared CenterStat [internal/pie-center.tsx]
// routes it through this same island via `useCenterStatHover`, so ring,
// pie, and gauge centers now all share it.)
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
// rules), byte-identical clamp()/weight/line-height/margin values — one
// shared block serving every consumer of this module (ring, pie, gauge
// centers alike; pie's former dedicated `.ts-bkm-pie-center*` rules were
// deleted as orphaned when PieCenter consolidated onto CenterStat).
import NumberFlow from "@number-flow/react";
import {
  useEffect,
  useMemo,
  useRef,
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
 * invention) — it's what makes SSR/pre-hydration renders correct.
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

// --- CenterShell (T-C4 centralization; research/phase-4/synthesis/centralize.md row 7) ---
// One chart-agnostic center-readout SHELL over CenterStat: the container box
// (centerSize square, `.ts-bkm-center-stat`) + the value/label stack, plus the
// opt-in `intro` prop — legacy PieCenterShell's 0→value double-rAF mount
// entrance (repos/bklit-ui/packages/ui/src/charts/pie-center-shell.tsx:49-70),
// of which internal/gauge-center.tsx held the sole ported copy until now (OQ
// 7 ruling: promote here as opt-in so the P6 `PieCenterShell` compat wrapper
// can reuse it rather than spawn a third copy).
//
// Chart adapters stay thin and keep everything context-specific: they resolve
// their own stable/hover contexts, sizing formulas and per-part guards (pie's
// geometryScrubbing null-hover + innerRadius<=0 return; ring's
// baseInnerRadius sizing with deliberately NO zero-guard; gauge's
// max(size*0.2, 52) formula), then hand the resolved numbers here.
// `hoveredData` non-null + children ⇒ the render-prop branch — exactly
// PieCenter/RingCenter's existing `if (children && hoveredData)` semantics,
// generic over the datum type.

export interface CenterShellRenderProps<T> {
  value: number;
  label: string;
  isHovered: boolean;
  data: T;
}

export interface CenterShellProps<T> {
  /** Displayed value (already resolved by the adapter: hovered datum's value
      vs the chart total). */
  value: number;
  /** Displayed label (hovered datum's label vs the adapter default). */
  label: string;
  /** Square side of the center stat box — each adapter's own formula. */
  centerSize: number;
  /** Non-null while the chart's hover coordinator holds an index; selects
      the children render-prop branch when `children` is supplied. */
  hoveredData?: T | null;
  /** Opt-in PieCenterShell-style mount entrance: first paint shows 0, a
      double-rAF then commits `value` so NumberFlow rolls in from zero.
      Subsequent `value` updates pass straight through. Legacy
      `animateEntrance={false}` semantics: value flows through untouched. */
  intro?: boolean;
  formatOptions?: CenterStatFormat;
  prefix?: string;
  suffix?: string;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  children?: (props: CenterShellRenderProps<T>) => ReactNode;
}

/**
 * The PieCenterShell/GaugeCenterOverlay mount-entrance state machine,
 * verbatim including the cleanup re-arm (`introStartedRef` reset so a
 * remount replays the intro): 0 → double-rAF → value. `intro=false` is the
 * plain pass-through (legacy `animateEntrance={false}` branch).
 */
export function useIntroFlowValue(value: number, intro: boolean): number {
  const introStartedRef = useRef(false);
  const [flowValue, setFlowValue] = useState(() => (intro ? 0 : value));

  useEffect(() => {
    if (!intro) {
      setFlowValue(value);
      return;
    }
    if (!introStartedRef.current) {
      introStartedRef.current = true;
      setFlowValue(0);
      let innerRaf = 0;
      const outerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(() => setFlowValue(value));
      });
      return () => {
        cancelAnimationFrame(outerRaf);
        cancelAnimationFrame(innerRaf);
        introStartedRef.current = false;
      };
    }
    setFlowValue(value);
  }, [intro, value]);

  return flowValue;
}

export function CenterShell<T>({
  value,
  label,
  centerSize,
  hoveredData = null,
  intro = false,
  formatOptions = defaultCenterStatFormat,
  prefix,
  suffix,
  className = centerStatContainerClassName,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  children,
}: CenterShellProps<T>) {
  const flowValue = useIntroFlowValue(value, intro);

  if (children && hoveredData !== null && hoveredData !== undefined) {
    return (
      <div
        className={className}
        style={{
          width: centerSize,
          height: centerSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children({ value, label, isHovered: true, data: hoveredData })}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: centerSize,
        height: centerSize,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <CenterStat
        formatOptions={formatOptions}
        label={label}
        labelClassName={labelClassName}
        prefix={prefix}
        suffix={suffix}
        value={flowValue}
      />
    </div>
  );
}

CenterShell.displayName = "CenterShell";
