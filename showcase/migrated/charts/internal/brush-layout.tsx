"use client";

// Bklit brush layout half, ported 1:1.

import * as React from "react";
import { cn } from "@/lib/utils";
import { useBrushSelection } from './brush-selection';
import type { BrushLayoutState } from './brush-selection';
import type { ChartDatum } from "./types";

interface BrushLayoutProps {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xDataKey?: string;
  readonly xExtentMax?: Date;
  readonly enabled: boolean;
  readonly height: number;
  readonly fitMainContent?: boolean;
  readonly className?: string;
  readonly children: (layout: Readonly<BrushLayoutState>) => React.ReactNode;
  readonly brushStrip?: (layout: Readonly<BrushLayoutState>) => React.ReactNode;
}

const useBrushLayoutState = (layout: ReturnType<typeof useBrushSelection>): BrushLayoutState =>
  React.useMemo(
    () => ({
      brushSelection: layout.brushSelection,
      onBrushSelectionChange: layout.onBrushSelectionChange,
      xDomain: layout.xDomain,
      xDomainSlotCount: layout.xDomainSlotCount,
    }),
    [
      layout.xDomain,
      layout.xDomainSlotCount,
      layout.brushSelection,
      layout.onBrushSelectionChange,
    ],
  );

const BrushLayout = React.memo(({
  data,
  xDataKey = "date",
  xExtentMax,
  enabled,
  height,
  fitMainContent = false,
  className,
  children,
  brushStrip,
}: Readonly<BrushLayoutProps>) => {
  const layout = useBrushSelection({
    data,
    enabled,
    xDataKey,
    xExtentMax,
  });

  const layoutState = useBrushLayoutState(layout);

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
      {enabled && brushStrip && (
        <div className="min-h-0 shrink-0" style={{ height }}>
          {brushStrip(layoutState)}
        </div>
      )}
    </div>
  );
});

BrushLayout.displayName = "BrushLayout";

export { BrushLayout };
export type { BrushLayoutProps };
export type { BrushLayoutState } from './brush-selection';
