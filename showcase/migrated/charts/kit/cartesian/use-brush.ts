// The controlled range selector of the cartesian shell: the accepted / live ranges, and the change handler that reports bklit's selection.
import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { readChildren } from "../read-children";
import type { ChildTable } from "../read-children";
import type { PlotSnapshot } from "./plot-size";
import { toDate } from "./series";
import type { Row } from "./series";

interface BrushRangeValue { start: Date; end: Date }

type BrushChangeType = "preview" | "commit" | "cancel";

interface BrushProps {
  selectionPattern?: { color?: string };
  blurPx?: number;
  fadeOuterEdges?: boolean;
  initialSelection?: BrushRangeValue | null;
  onSelectionChange?: (s: BrushRangeValue | null) => void;
}

interface BrushInput {
  readonly table: ChildTable;
  readonly children: ReactNode;
  readonly data: readonly Row[];
  readonly xDataKey: string;
}

interface BrushState {
  readonly brushProps: BrushProps | undefined;
  /** The strip's definition input; undefined without a Brush child. */
  readonly brush: { range: BrushRangeValue; color: string | undefined; onChange: (range: BrushRangeValue, type: BrushChangeType) => void } | undefined;
  readonly brushCollapsed: boolean;
  readonly shownRange: BrushRangeValue;
  /** Points the stable `onChange` at the plot snapshot the draw published (called every render); it is read when a gesture reports, so no size is known at render. */
  readonly bindChange: (plot: () => PlotSnapshot | null) => void;
}

export function useBrush({ table, children, data, xDataKey }: BrushInput): BrushState {
  // SAFETY: the child table is keyed by tag and untyped; the "brush" entry carries a Brush's props.
  const brushProps = table.get("brush")?.[0] as BrushProps | undefined;
  // The strip's definition input is the last ACCEPTED range (commit, or the initial/full extent); previews drive only `live` (host vars + reported selection) and never reach the definition (TanStack interactions guide: controlled brush).
  // Last selection committed to the layout (undefined: none yet, the initial selection stands; null: full extent).
  const reportedRef = useRef<BrushRangeValue | null | undefined>(undefined);
  const [accepted, setAccepted] = useState<BrushRangeValue | null>(null);
  const [live, setLive] = useState<BrushRangeValue | null>(null);
  const fullRange = useMemo(() => {
    const times = data.map((row) => toDate(row[xDataKey]).getTime());
    return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
  }, [data, xDataKey]);
  // `initialSelection` is mount-only (visx initialBrushPosition) and excluded from the table identity, so read it from the latest children.
  // SAFETY: as brushProps, narrowed to the one field read.
  const latestInitial = brushProps ? ((readChildren(children).get("brush")?.[0] as { initialSelection?: BrushRangeValue | null } | undefined)?.initialSelection ?? null) : null;
  const initialRef = useRef<BrushRangeValue | null>(latestInitial);
  const [prevFull, setPrevFull] = useState(fullRange);
  if (prevFull !== fullRange) {
    // A new extent (data swap) resets the snapshot to the layout's fresh initial selection.
    setPrevFull(fullRange);
    setAccepted(null);
    setLive(null);
    initialRef.current = latestInitial;
    reportedRef.current = undefined;
  }
  const acceptedRange = accepted ?? initialRef.current ?? fullRange;
  const brushChangeRef = useRef<(range: BrushRangeValue, type: BrushChangeType) => void>(() => undefined);
  const onBrushChange = useCallback((range: BrushRangeValue, type: BrushChangeType) => { brushChangeRef.current(range, type); }, []);
  const brushColor = brushProps?.selectionPattern?.color;
  const hasBrushChild = brushProps !== undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const brush = useMemo(() => (hasBrushChild ? { range: acceptedRange, color: brushColor, onChange: onBrushChange } : undefined), [hasBrushChild, accepted, fullRange, brushColor, onBrushChange]);
  const liveRange = live ?? acceptedRange;
  // A click outside collapses the native range at the click point (so the next drag starts a NEW brush anywhere), while
  // the overlays keep showing bklit's full extent.
  const brushCollapsed = liveRange.end.getTime() - liveRange.start.getTime() <= 0;
  const shownRange = brushCollapsed ? fullRange : liveRange;
  const bindChange = (plot: () => PlotSnapshot | null): void => {
    brushChangeRef.current = (range, type): void => {
      if (!brushProps) {
        return;
      }
      if (type === "cancel") {
        // Escape: back to the accepted range (the native control restores itself), and the main chart back to what it showed before the gesture.
        setLive(null);
        const back = reportedRef.current === undefined ? initialRef.current : reportedRef.current;
        brushProps.onSelectionChange?.(back);
        return;
      }
      setLive(range);
      // bklit boundsToSelection: start == end (a click outside the selection) is null, which resets to the full extent.
      const snapshot = plot();
      const spanMs = snapshot ? new Date(snapshot.built.domains.x[1]).getTime() - new Date(snapshot.built.domains.x[0]).getTime() : 0;
      const innerPx = snapshot?.size.innerWidth ?? 0;
      const widthPx = spanMs > 0 ? ((range.end.getTime() - range.start.getTime()) / spanMs) * innerPx : 0;
      // The controlled range stays raw (no feedback drift); the committed selection is what visx's getDomainFromExtent
      // hands bklit: the dragged rect widened by SAFE_PIXEL (2px) per side, unclamped.
      const padMs = (spanMs / innerPx) * 2;
      const reported = widthPx >= 1 ? { start: new Date(range.start.getTime() - padMs), end: new Date(range.end.getTime() + padMs) } : null;
      if (type === "commit") {
        reportedRef.current = reported;
        setAccepted((prev) => (prev && prev.start.getTime() === range.start.getTime() && prev.end.getTime() === range.end.getTime() ? prev : range));
      }
      brushProps.onSelectionChange?.(reported);
    };
  };
  return { brushProps, brush, brushCollapsed, shownRange, bindChange };
}
