import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { BrushHost } from "./brush-chrome";

// Handle chrome for the host-owned native brushX, split out so brush-chrome.tsx holds one component per file.

const HANDLE_WIDTH_PX = 4;
const HANDLE_HEIGHT_PX = 24;

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
  const container = host.containerRef.current;
  if (!(mounted && container)) {return undefined;}
  // X0 === x1 renders one handle.
  const edges = x0 === x1 ? [x0] : [Math.min(x0, x1), Math.max(x0, x1)];
  const plotLeft = host.margin.left;
  const plotTop = host.margin.top;
  const handleTop = plotTop + (innerHeight - HANDLE_HEIGHT_PX) / 2;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]">
      {edges.map((edgeX) => (
        <div
          key={String(edgeX)}
          className="absolute shrink-0 rounded-lg"
          style={{
            backgroundColor: "var(--chart-brush-border)",
            cursor: "ew-resize",
            height: HANDLE_HEIGHT_PX,
            left: plotLeft + edgeX - HANDLE_WIDTH_PX / 2,
            top: handleTop,
            width: HANDLE_WIDTH_PX,
          }}
        />
      ))}
    </div>,
    container,
  );
};

export { BrushHandleChrome };
