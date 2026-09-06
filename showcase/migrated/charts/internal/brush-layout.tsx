"use client";

// Bklit brush layout half, ported 1:1.

import { memo, useMemo } from "react";
import type { CSSProperties, NamedExoticComponent, ReactElement, ReactNode } from "react";
import { cn } from "./cn";
import { useBrushSelection } from './brush-selection';
import type { BrushLayoutState } from './brush-selection';

interface BrushLayoutProps {
  readonly data: Record<string, unknown>[];
  readonly xDataKey?: string;
  readonly xExtentMax?: Date;
  readonly enabled: boolean;
  readonly height: number;
  readonly fitMainContent?: boolean;
  readonly className?: string;
  readonly children: (layout: Readonly<BrushLayoutState>) => ReactNode;
  readonly brushStrip?: (layout: Readonly<BrushLayoutState>) => ReactNode;
}

const useBrushLayoutState = (layout: ReturnType<typeof useBrushSelection>): BrushLayoutState =>
  useMemo(
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

const BrushLayoutContent = ({
  data,
  xDataKey = "date",
  xExtentMax,
  enabled,
  height,
  fitMainContent = false,
  className,
  children,
  brushStrip,
}: Readonly<BrushLayoutProps>): ReactElement => {
  const layout = useBrushSelection({
    data,
    enabled,
    xDataKey,
    xExtentMax,
  });

  const layoutState = useBrushLayoutState(layout);

  const stripStyle = useMemo((): CSSProperties => ({ height }), [height]);

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
        <div className="min-h-0 shrink-0" style={stripStyle}>
          {brushStrip(layoutState)}
        </div>
      )}
    </div>
  );
};

const BrushLayout: NamedExoticComponent<BrushLayoutProps> = memo(BrushLayoutContent);

BrushLayout.displayName = "BrushLayout";

export { BrushLayout };
export type { BrushLayoutProps };
export type { BrushLayoutState } from './brush-selection';
