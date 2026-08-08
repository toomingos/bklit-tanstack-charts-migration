// SunburstHint — config carrier + accessibility trail hint.
// Extracted from sunburst-chart.tsx (R6 module split).

import { type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Config carrier — returns null, classified by displayName in sunburst-chart
// ---------------------------------------------------------------------------

export function SunburstHint(_props: {
  className?: string;
  children?: ReactNode;
}): null {
  return null;
}

SunburstHint.displayName = "SunburstHint";

// ---------------------------------------------------------------------------
// Hint display — centered text below the chart area
// ---------------------------------------------------------------------------

export interface SunburstHintDisplayProps {
  text: string;
}

export function SunburstHintDisplay({ text }: SunburstHintDisplayProps) {
  return (
    <div
      aria-live="polite"
      style={{
        marginTop: 12,
        minHeight: 20,
        textAlign: "center",
        fontSize: "14px",
        color: "var(--chart-foreground-muted, #888)",
      }}
    >
      {text}
    </div>
  );
}
