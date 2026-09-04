import type { CSSProperties, ReactElement } from "react";
import type { ChartMarker } from "./types";

const CLIP_STYLE: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const MUTED_COLOR = "var(--chart-tooltip-muted)";
const TITLE_STYLE: CSSProperties = { ...CLIP_STYLE, color: "var(--chart-tooltip-foreground)" };
const DESCRIPTION_STYLE: CSSProperties = { ...CLIP_STYLE, color: MUTED_COLOR };
const LINK_GLYPH_STYLE: CSSProperties = { color: MUTED_COLOR, paddingLeft: "0.375rem" };

interface MarkerDefaultBodyProps {
  marker: Readonly<ChartMarker>;
  isClickable: boolean;
}

// Extracted from marker-tooltip.tsx (react(jsx-max-depth)): the default title/description body.
// A marker row renders it when the caller didn't supply custom `marker.content`.
const MarkerDefaultBody = ({ marker, isClickable }: Readonly<MarkerDefaultBodyProps>): ReactElement => (
  <div>
    <div className="text-sm font-medium" style={TITLE_STYLE}>
      {marker.title}
      {isClickable && (
        <span className="text-[10px]" style={LINK_GLYPH_STYLE}>
          ↗
        </span>
      )}
    </div>
    {marker.description !== undefined && marker.description.length > 0 && (
      <div className="text-xs" style={DESCRIPTION_STYLE}>
        {marker.description}
      </div>
    )}
  </div>
);
MarkerDefaultBody.displayName = "MarkerDefaultBody";

export { MarkerDefaultBody };
export type { MarkerDefaultBodyProps };
