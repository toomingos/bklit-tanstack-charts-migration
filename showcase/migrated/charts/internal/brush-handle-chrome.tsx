import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { BrushHost } from "./brush-chrome";

// Handle chrome for the host-owned native brushX, split out so brush-chrome.tsx holds one component per file.

const HANDLE_WIDTH_PX = 4;
const HANDLE_HEIGHT_PX = 24;

interface BrushHandleEdgePositionStyle {
  readonly backgroundColor: "var(--chart-brush-border)";
  readonly cursor: "ew-resize";
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

interface BrushHandleEdgeStyle {
  readonly edgeX: number;
  readonly style: Readonly<BrushHandleEdgePositionStyle>;
}

const BrushHandleChrome = ({
  host,
  x0,
  x1,
  innerHeight,
  mounted,
}: Readonly<{
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  mounted: boolean;
}>): ReactNode => {
  const edgeStyles = useMemo((): readonly BrushHandleEdgeStyle[] => {
    const edges = x0 === x1 ? [x0] : [Math.min(x0, x1), Math.max(x0, x1)];
    const plotLeft = host.margin.left;
    const plotTop = host.margin.top;
    const handleTop = plotTop + (innerHeight - HANDLE_HEIGHT_PX) / 2;
    return edges.map((edgeX) => ({
      edgeX,
      style: {
        backgroundColor: "var(--chart-brush-border)",
        cursor: "ew-resize",
        height: HANDLE_HEIGHT_PX,
        left: plotLeft + edgeX - HANDLE_WIDTH_PX / 2,
        top: handleTop,
        width: HANDLE_WIDTH_PX,
      },
    }));
  }, [host, innerHeight, x0, x1]);
  const container = host.containerRef.current;
  if (!(mounted && container)) {return undefined;}
  // X0 === x1 renders one handle.
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]">
      {edgeStyles.map(({ edgeX, style }: Readonly<BrushHandleEdgeStyle>) => (
        <div
          key={String(edgeX)}
          className="absolute shrink-0 rounded-lg"
          style={style}
        />
      ))}
    </div>,
    container,
  );
};

export { BrushHandleChrome };
