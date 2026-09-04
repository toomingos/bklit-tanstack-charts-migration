// Polite-live-region wrapper for the sunburst hover hint, split from
// Sunburst-hint so each file owns one component.
import type { ReactElement, ReactNode } from "react";

interface SunburstHintDisplayProps {
  readonly children: ReactNode;
  readonly hintClassName?: string;
}

const HINT_DISPLAY_EMPTY_STYLE = { minHeight: 20 } as const;
const HINT_DISPLAY_PLACEHOLDER_STYLE = {
  color: "var(--chart-foreground-muted, #888)",
  fontSize: "14px",
  marginTop: 12,
  minHeight: 20,
  textAlign: "center",
} as const;

const SunburstHintDisplay = ({ children, hintClassName }: SunburstHintDisplayProps): ReactElement => (
    <div
      aria-live="polite"
      className={hintClassName}
      style={
        hintClassName !== undefined && hintClassName !== ""
          ? HINT_DISPLAY_EMPTY_STYLE
          : HINT_DISPLAY_PLACEHOLDER_STYLE
      }
    >
      {children}
    </div>
  );

export { SunburstHintDisplay };
export type { SunburstHintDisplayProps };
