"use client";

import type { ReactElement } from 'react';
import { cn } from "@/lib/utils";
import { useLegendItem } from './legend-context';

interface LegendLabelProps {
  className?: string;
}

const LegendLabel = ({
  className = "text-sm font-medium",
}: Readonly<LegendLabelProps>): ReactElement => {
  const { item } = useLegendItem();

  return (
    <span className={cn("text-legend-foreground", className)}>
      {item.label}
    </span>
  );
};

LegendLabel.displayName = "LegendLabel";

export type { LegendLabelProps };
export { LegendLabel };
