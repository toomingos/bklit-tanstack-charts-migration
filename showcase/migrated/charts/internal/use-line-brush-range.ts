// Line-chart brush range value with endpoint-time identity.
import { useState } from "react";
import type { BrushRange } from "@tanstack/charts/interaction/brush";
import type { BrushSelection } from "./brush-selection";

// Brush ranges compare by endpoint time so a re-created but equal range keeps stable identity.
const isSameBrushRange = (
  left: Readonly<{ end: Date; start: Date }> | undefined,
  right: Readonly<{ end: Date; start: Date }> | undefined,
): boolean => {
  if (left === right) {return true;}
  if (!left || !right) {return false;}
  return left.start.getTime() === right.start.getTime() && left.end.getTime() === right.end.getTime();
};

interface LineBrushRangeParams {
  readonly fallbackRange: Readonly<BrushRange<Date>> | undefined;
  // BrushConfig.initialSelection is an external (ChartBrushProps) field typed `| null`.
  readonly initialSelection: BrushSelection | null | undefined;
}

const useLineBrushRange = (params: Readonly<LineBrushRangeParams>): BrushRange<Date> | undefined => {
  // Value-stable range: only new start/end objects commit, or drags fight spurious updates.
  const nextRangeValue: BrushRange<Date> | undefined = params.initialSelection
    ? { end: params.initialSelection.end, start: params.initialSelection.start }
    : params.fallbackRange;
  const [rangeValue, setRangeValue] = useState<BrushRange<Date> | undefined>(nextRangeValue);
  if (!isSameBrushRange(rangeValue, nextRangeValue)) {
    setRangeValue(nextRangeValue);
  }
  return rangeValue;
};

export { useLineBrushRange };
