import type { ReactElement } from "react";

// Accessible loading label overlay shared by the line and area charts.
const LoadingLabel = ({ text, exiting }: Readonly<{ text: string; exiting?: boolean }>): ReactElement | null => {
  if (!text.trim()) {return null;}
  return (
    <output
      className="ts-bkm-loading-label-wrap"
      data-slot="loading-label"
      data-bkm-loading-exiting={exiting === true ? "" : undefined}
      aria-live="polite"
    >
      <span className="ts-bkm-loading-label-text">{text}</span>
    </output>
  );
}

export { LoadingLabel };
