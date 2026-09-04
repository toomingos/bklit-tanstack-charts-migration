// Polite-live-region wrapper for the sunburst hover hint, split from
// Sunburst-hint so each file owns one component.
import type { ReactElement, ReactNode } from "react";

interface SunburstHintDisplayProps {
  children: ReactNode;
  className?: string;
}

const SunburstHintDisplay = ({ children, className }: SunburstHintDisplayProps): ReactElement => (
    <div
      aria-live="polite"
      className={className}
      style={
        className !== undefined && className !== ""
          ? { minHeight: 20 }
          : {
              color: "var(--chart-foreground-muted, #888)",
              fontSize: "14px",
              marginTop: 12,
              minHeight: 20,
              textAlign: "center",
            }
      }
    >
      {children}
    </div>
  );

export { SunburstHintDisplay };
export type { SunburstHintDisplayProps };
