"use client";

// bklit chart-brush-layout.tsx:100-122 — JSX layout half, ported 1:1
// (adapt imports/style refs only). Cites refer to bklit file:line.

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  useBrushSelection,
  type BrushLayoutState,
} from "./brush-selection";

export type { BrushLayoutState };

export interface BrushLayoutProps {
  data: Record<string, unknown>[];
  xDataKey?: string;
  xExtentMax?: Date;
  enabled: boolean;
  height: number;
  fitMainContent?: boolean;
  className?: string;
  children: (layout: BrushLayoutState) => React.ReactNode;
  brushStrip?: (layout: BrushLayoutState) => React.ReactNode;
}

// repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:47-122 —
// flex column: main content first (flex: 1 unless fitMainContent), brush
// strip second at fixed height px, only when enabled && brushStrip. Wires
// useBrushSelection and passes layout state to both render props.
export const BrushLayout = React.memo(function BrushLayout({
  data,
  xDataKey = "date",
  xExtentMax,
  enabled,
  height,
  fitMainContent = false,
  className,
  children,
  brushStrip,
}: BrushLayoutProps) {
  const layout = useBrushSelection({
    data,
    xDataKey,
    xExtentMax,
    enabled,
  });

  const layoutState: BrushLayoutState = React.useMemo(
    () => ({
      xDomain: layout.xDomain,
      xDomainSlotCount: layout.xDomainSlotCount,
      brushSelection: layout.brushSelection,
      onBrushSelectionChange: layout.onBrushSelectionChange,
    }),
    [
      layout.xDomain,
      layout.xDomainSlotCount,
      layout.brushSelection,
      layout.onBrushSelectionChange,
    ],
  );

  // repos/bklit-ui/packages/ui/src/charts/chart-brush-layout.tsx:100-122
  return (
    <div
      className={cn(
        "flex size-full min-h-0 min-w-0 flex-col",
        fitMainContent ? "justify-start gap-1" : "gap-3",
        className,
      )}
    >
      <div
        className={cn(
          "min-h-0 min-w-0",
          fitMainContent ? "shrink-0" : "flex-1",
        )}
      >
        {children(layoutState)}
      </div>
      {enabled && brushStrip ? (
        <div className="min-h-0 shrink-0" style={{ height }}>
          {brushStrip(layoutState)}
        </div>
      ) : null}
    </div>
  );
});
