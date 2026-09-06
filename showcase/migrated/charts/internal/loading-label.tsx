import type { ReactElement } from "react";

// Shared loading label overlay for line and area placeholders.
const LoadingLabel = ({ text }: Readonly<{ text: string }>): ReactElement | null => {
  if (!text.trim()) {return null;}
  return (
    <output
      className="ts-bkm-loading-label-wrap"
      data-slot="loading-label"
      aria-live="polite"
    >
      <span className="ts-bkm-loading-label-text">{text}</span>
    </output>
  );
}

export { LoadingLabel };
