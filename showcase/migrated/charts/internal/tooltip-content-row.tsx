import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import { intFmt } from "./formatters";
import type { TooltipRow } from "./types";

interface TooltipContentRowProps {
  readonly row: Readonly<TooltipRow>;
}

const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";

const TooltipContentRow = ({ row }: Readonly<TooltipContentRowProps>): ReactElement => {
  const dotStyle = useMemo((): CSSProperties => ({ backgroundColor: row.color }), [row.color]);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={dotStyle}
        />
        <span className="text-chart-tooltip-muted text-sm">
          {row.label}
        </span>
      </div>
      <span className="font-medium text-chart-tooltip-foreground text-sm tabular-nums">
        {isNumber(row.value) ? intFmt(row.value) : row.value}
      </span>
    </div>
  );
};

export { TooltipContentRow };
export type { TooltipContentRowProps };
