// Tooltip body as a leaf subscription (perf): react-charts' RendererChart re-renders the whole chart on every target change.
// Here the core chart gets a STABLE `onTooltipBodyChange` writing into a deduped ref store; only <TooltipBodyLeaf> subscribes and portals.
import { Chart as CoreRendererChart } from "@tanstack/react-charts/core";
import type { ChartTooltipBodyRenderContext, RendererChartProps as TooltipRendererChartProps } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyTarget, ChartTooltipContent, ChartValue } from "@tanstack/charts";
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import type { ComponentType, CSSProperties, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { hasText, isString, sameValue } from "../guards";

type Target = ChartTooltipBodyTarget;

type TooltipBodyContext<TDatum = unknown, TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue> = ChartTooltipBodyRenderContext<TDatum, TXValue, TYValue>;

interface TooltipBodyStore {
  readonly get: () => Target | null;
  readonly subscribe: (cb: () => void) => () => void;
  /** Stable; pass as the core chart's `onTooltipBodyChange`. */
  readonly onChange: (target: Target | null) => void;
}

type TargetPoint = Target["points"][number];

const POINT_FIELDS = ["key", "datumIndex", "datum", "x", "y", "yValue", "xValue"] as const;

const samePoint = (p: TargetPoint, q: TargetPoint): boolean => p === q || POINT_FIELDS.every((field) => p[field] === q[field]);

const samePoints = (a: Target["points"], b: Target["points"]): boolean => a === b || (a.length === b.length && a.every((p, i) => samePoint(p, b[i])));

const samePrimary = (a: Target, b: Target): boolean => a.primaryPoint?.key === b.primaryPoint?.key && a.primaryPoint?.datumIndex === b.primaryPoint?.datumIndex;

const sameTarget = (a: Target, b: Target): boolean => a.element === b.element && a.pinned === b.pinned && samePrimary(a, b) && samePoints(a.points, b.points);

/** Opt-in equality for bodies that depend only on the hovered x and per-series values (bar, composed): moving between bars of one category changes the primary point
 * but not what the body shows. Same host element, same x, same series values (any order). */
export const sameCategoryTarget = (a: Target, b: Target): boolean => {
  if (a.element !== b.element || a.pinned !== b.pinned || a.points.length !== b.points.length) {
    return false;
  }
  return a.points.every((p) => b.points.some((q) => q.key === p.key && sameValue(q.xValue, p.xValue) && sameValue(q.yValue, p.yValue) && q.datum === p.datum));
};

const createTooltipBodyStore = (equal: (a: Target, b: Target) => boolean = sameTarget): TooltipBodyStore => {
  let value: Target | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    onChange: (next) => {
      if (next === value || (next !== null && value !== null && equal(next, value))) {
        return;
      }
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
};

const useTooltipBodyStore = (equal?: (a: Target, b: Target) => boolean): TooltipBodyStore => {
  const ref = useRef<TooltipBodyStore | null>(null);
  ref.current ??= createTooltipBodyStore(equal);
  return ref.current;
};

// DefaultTooltipBody is not exported by react-charts/tooltip, so its `ts-chart-tooltip__*` classes and vars are reproduced (UPSTREAM-GAPS #3).
const TITLE_CLASS = "ts-chart-tooltip__title";
const ROWS_CLASS = "ts-chart-tooltip__rows";
const ROW_CLASS = "ts-chart-tooltip__row";
const SWATCH_STYLE: CSSProperties = { display: "block", width: "0.55rem", height: "0.55rem", borderRadius: "0.15rem", boxShadow: "inset 0 0 0 1px rgb(0 0 0/.12)" };
const TITLE_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 650 };
const ROW_STYLE: CSSProperties = { display: "grid", gridTemplateColumns: "0.55rem minmax(0,1fr) auto", alignItems: "center", columnGap: "0.4rem" };
const ACTIVE_ROW_STYLE: CSSProperties = {
  ...ROW_STYLE,
  fontWeight: "var(--ts-chart-tooltip-active-row-font-weight, 700)",
  background: "var(--ts-chart-tooltip-active-row-background, color-mix(in srgb, currentColor 12%, transparent))",
  borderRadius: "var(--ts-chart-tooltip-active-row-border-radius, .2rem)",
  boxShadow: "var(--ts-chart-tooltip-active-row-shadow, 0 0 0 2px color-mix(in srgb, currentColor 12%, transparent))",
};
const TITLE_WITH_ROWS_STYLE: CSSProperties = { ...TITLE_STYLE, marginBottom: "0.3rem" };
const TITLE_ALONE_STYLE: CSSProperties = { ...TITLE_STYLE, marginBottom: 0 };
const VALUE_STYLE: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

const TooltipSwatch = ({ color }: { readonly color: string }): ReactElement => {
  const style = useMemo<CSSProperties>(() => ({ ...SWATCH_STYLE, background: color }), [color]);
  return <span aria-hidden="true" className="ts-chart-tooltip__swatch" style={style} />;
};

const DefaultTooltipBody = ({ content }: { readonly content: ChartTooltipContent | string }): ReactElement | string => {
  if (isString(content)) {
    return content;
  }
  const hasRows = content.rows.length > 0;
  return (
    <>
      {hasText(content.title) ? (
        <div className={TITLE_CLASS} style={hasRows ? TITLE_WITH_ROWS_STYLE : TITLE_ALONE_STYLE}>
          {hasText(content.color) ? <TooltipSwatch color={content.color} /> : null}
          {content.title}
        </div>
      ) : null}
      {hasRows ? (
        <div aria-hidden="true" className={ROWS_CLASS}>
          {content.rows.map((row, index) => (
            <div
              className={ROW_CLASS}
              data-active={String(row.active === true)}
              // oxlint-disable-next-line react/no-array-index-key -- rows carry no id and labels can repeat, so the position disambiguates
              key={`${row.label}\0${index}`}
              style={row.active === true ? ACTIVE_ROW_STYLE : ROW_STYLE}
            >
              {hasText(row.color) ? <TooltipSwatch color={row.color} /> : <span />}
              <span>{row.label}</span>
              <span style={VALUE_STYLE}>{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
};

const TooltipBodyLeaf = ({ store, render }: { readonly store: TooltipBodyStore; readonly render: (context: TooltipBodyContext) => ReactNode }): ReactElement | null => {
  const nothing = useCallback(() => null, []);
  const target = useSyncExternalStore(store.subscribe, store.get, nothing);
  if (target === null) {
    return null;
  }
  const { element, ...context } = target;
  // `defaultBody` reproduces react-charts/tooltip's DefaultTooltipBody (not exported) from the target's content.
  return createPortal(render({ ...context, defaultBody: <DefaultTooltipBody content={target.content} /> }), element);
};

// SAFETY: kit charts erase the datum generics, and the store only hands the reported target back to the leaf that portals it.
// oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion -- see SAFETY above
const CoreChart = CoreRendererChart as unknown as ComponentType<Record<string, unknown>>;

type RendererChartTooltipProps<TDatum, TXValue extends ChartValue, TYValue extends ChartValue> = TooltipRendererChartProps<TDatum, TXValue, TYValue> & {
  readonly tooltipEqual?: (a: Target, b: Target) => boolean;
};

/** Drop-in for `@tanstack/react-charts/tooltip` RendererChart (incl. `defaultBody`): hover never re-renders the chart. */
export const RendererChart = <TDatum, TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(
  props: RendererChartTooltipProps<TDatum, TXValue, TYValue>,
): ReactElement => {
  const { renderTooltipBody, tooltipEqual, ...rest } = props;
  const store = useTooltipBodyStore(tooltipEqual);
  // SAFETY: the leaf renders targets of this very chart, so the erased datum generics are the ones `renderTooltipBody` expects.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see SAFETY above
  const render = renderTooltipBody as ((context: TooltipBodyContext) => ReactNode) | undefined;
  return (
    <>
      {/* oxlint-disable-next-line react/jsx-props-no-spreading -- a drop-in wrapper forwards every chart prop untouched */}
      <CoreChart {...rest} onTooltipBodyChange={render === undefined ? undefined : store.onChange} />
      {render === undefined ? null : <TooltipBodyLeaf render={render} store={store} />}
    </>
  );
};
