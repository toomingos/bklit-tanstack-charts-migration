// bklit's tooltip look as the native tooltip's body (title + dot / label / value rows).
// The native tooltip owns positioning, portal, motion and dismissal.
import type { ReactNode } from "react";
import { intFmt, weekdayDateFmt } from "../format";
import { TooltipContent } from "./tooltip-primitives";
import type { TooltipRow } from "./tooltip-primitives";
import type { AnyPoint as Point } from "../cartesian/erased-types";

export type { TooltipRow } from "./tooltip-primitives";

type Datum = Record<string, unknown>;

export interface TooltipBodyOptions {
  readonly title?: (date: Date) => string;
  readonly format?: (value: number, label: string) => string | number;
  readonly rows?: (rows: readonly TooltipRow[], point: Point) => readonly TooltipRow[];
  readonly content?: (args: { point: Point; rows: readonly TooltipRow[] }) => ReactNode;
  readonly className?: string;
  /** bklit `<ChartTooltip>` children: extra content below the rows. */
  readonly footer?: ReactNode;
  /** Series ids in declaration order; rows follow it. */
  readonly order?: readonly string[];
  /** Series dataKey -> stroke, for the row dots. */
  readonly colors?: Readonly<Partial<Record<string, string>>>;
}

/** One row per series: the native `group-x` focus already yields one point per `z` group. */
export const tooltipRows = (points: readonly Point[], format: TooltipBodyOptions["format"], colors?: TooltipBodyOptions["colors"]): TooltipRow[] => {
  const seen = new Set<string>();
  const rows: TooltipRow[] = [];
  for (const p of points) {
    const label = String(p.group ?? p.groupLabel);
    if (!seen.has(label)) {
      seen.add(label);
      const raw = Number(p.yValue);
      rows.push({ color: colors?.[label] ?? p.color, label, value: format === undefined ? intFmt(raw) : format(raw, label) });
    }
  }
  return rows;
};

const sortByOrder = (list: TooltipRow[], order: readonly string[] | undefined): TooltipRow[] =>
  order === undefined ? list : list.toSorted((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

export const BklitTooltipBody = ({ points, options }: { readonly points: readonly Point[]; readonly options: TooltipBodyOptions }): ReactNode => {
  if (points.length === 0) {
    return null;
  }
  const [primary] = points;
  const date = primary.xValue instanceof Date ? primary.xValue : new Date(primary.xValue);
  const sorted = sortByOrder(tooltipRows(points, options.format, options.colors), options.order);
  const rows = options.rows === undefined ? sorted : options.rows(sorted, primary);
  if (options.content !== undefined) {
    return options.content({ point: primary, rows });
  }
  return (
    <TooltipContent className={options.className} rows={rows} title={options.title === undefined ? weekdayDateFmt.format(date) : options.title(date)}>
      {options.footer}
    </TooltipContent>
  );
};

export interface BklitTooltipCarrier {
  readonly rows?: (point: Datum) => readonly TooltipRow[];
  readonly content?: (args: { point: Datum; index: number }) => ReactNode;
  readonly className?: string;
  readonly children?: ReactNode;
}

/** Adapts bklit's `<ChartTooltip rows content>` signatures (data row + index) to the body options (native ChartPoint);
 * `order` / `colors` come from the chart's series. */
export const bklitTooltipOptions = (tooltip: BklitTooltipCarrier | undefined, data: readonly Datum[], base: Pick<TooltipBodyOptions, "order" | "colors">): TooltipBodyOptions => {
  const { rows, content, className, children } = tooltip ?? {};
  // SAFETY: bklit tooltips are authored over data rows, and a point's datum is the row it was built from.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see SAFETY above
  const rowOf = (point: Point): Datum => point.datum as Datum;
  return {
    ...base,
    className,
    footer: children,
    rows: rows === undefined ? undefined : (_rows, point) => rows(rowOf(point)),
    content: content === undefined ? undefined : ({ point }) => content({ point: rowOf(point), index: data.indexOf(rowOf(point)) }),
  };
};
