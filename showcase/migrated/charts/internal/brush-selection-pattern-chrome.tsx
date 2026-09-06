import { useId } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { renderPatternPreset } from "./pattern-preset-render";
import { buildSelectionPatternOptions, resolveActivePatternBounds } from "./brush-chrome-helpers";
import type { BrushChromePattern } from "./brush-chrome-helpers";
import type { BrushHost } from "./brush-chrome";

// Selection pattern chrome for the host-owned native brushX, split out so brush-chrome.tsx holds one component per file.

const BrushSelectionPatternChrome = ({
  host,
  x0,
  x1,
  innerWidth: _innerWidth,
  innerHeight,
  selectionPattern,
  selectionPatternId,
  mounted,
}: Readonly<{
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  selectionPattern?: BrushChromePattern;
  selectionPatternId?: string;
  mounted: boolean;
}>): ReactNode => {
  const container = host.containerRef.current;
  // Seam-owned id wins; the entry renders the defs and this keeps only the painted rect.
  const fallbackPatternId = useId().replaceAll(':', "");
  const patternId = selectionPatternId ?? fallbackPatternId;
  const active = resolveActivePatternBounds({ container, mounted, selectionPattern, x0, x1 });
  if (active === undefined) {return undefined;}
  const inlinePatternNode = selectionPatternId === undefined
    ? renderPatternPreset(active.pattern.preset, patternId, buildSelectionPatternOptions(active.pattern))
    : undefined;
  if (selectionPatternId === undefined && (inlinePatternNode === null || inlinePatternNode === undefined)) {return undefined;}
  return createPortal(
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" width="100%" height="100%">
      {inlinePatternNode === undefined ? undefined : <defs>{inlinePatternNode}</defs>}
      <rect
        fill={`url(#${patternId})`}
        fillOpacity={active.pattern.opacity ?? 1}
        x={host.margin.left + active.bounds.left}
        y={host.margin.top}
        width={active.bounds.width}
        height={innerHeight}
      />
    </svg>,
    active.container,
  );
};

export { BrushSelectionPatternChrome };
