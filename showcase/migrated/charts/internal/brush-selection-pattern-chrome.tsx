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
  mounted,
}: Readonly<{
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  selectionPattern?: BrushChromePattern;
  mounted: boolean;
}>): ReactNode => {
  const container = host.containerRef.current;
  const patternId = useId().replaceAll(':', "");
  const active = resolveActivePatternBounds({ container, mounted, selectionPattern, x0, x1 });
  if (active === undefined) {return null;}
  const patternNode = renderPatternPreset(active.pattern.preset, patternId, buildSelectionPatternOptions(active.pattern));
  if (patternNode === null || patternNode === undefined) {return null;}
  return createPortal(
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" width="100%" height="100%">
      <defs>{patternNode}</defs>
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
