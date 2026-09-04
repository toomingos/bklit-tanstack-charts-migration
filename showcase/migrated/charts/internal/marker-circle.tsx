"use client";

import { useCallback } from "react";
import type { CSSProperties, MouseEvent, ReactElement, ReactNode } from "react";

// Icon glyph scales with the marker circle.
const MARKER_ICON_FONT_SCALE = 0.5;

interface MarkerCircleStyleOptions {
  readonly size: number;
  readonly color?: string;
  readonly borderColor?: string;
  readonly borderWidth: number;
  readonly hasAction: boolean;
}

const buildMarkerCircleStyle = (options: Readonly<MarkerCircleStyleOptions>): CSSProperties => {
  const { size, color, borderColor, borderWidth, hasAction } = options;
  return {
    alignItems: "center",
    appearance: "none",
    backgroundColor: color !== undefined && color !== "" ? color : "var(--chart-marker-background)",
    border: `${borderWidth}px solid ${borderColor ?? "var(--chart-marker-border)"}`,
    borderRadius: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    color: "var(--chart-marker-foreground)",
    cursor: hasAction ? "pointer" : undefined,
    display: "flex",
    fontFamily: "inherit",
    fontSize: size * MARKER_ICON_FONT_SCALE,
    height: size,
    justifyContent: "center",
    overflow: "hidden",
    padding: 0,
    transition: "transform 150ms ease-out",
    width: size,
  };
}

interface MarkerActionOptions {
  readonly onClick?: () => void;
  readonly href?: string;
  readonly target?: "_blank" | "_self";
}

const activateMarkerAction = (options: Readonly<MarkerActionOptions>): void => {
  const { onClick, href, target } = options;
  if (onClick) {onClick();}
  else if (href !== undefined && href !== "") {
    if (target === "_blank") {globalThis.open(href, "_blank", "noopener,noreferrer");}
    else {globalThis.location.href = href;}
  } else {
    // No marker action configured, so nothing happens.
  }
}

const handleMarkerCircleMouseEnter = (event: MouseEvent<HTMLButtonElement>): void => {
  (event.currentTarget).style.transform = "scale(1.15)";
};

const handleMarkerCircleMouseLeave = (event: MouseEvent<HTMLButtonElement>): void => {
  (event.currentTarget).style.transform = "scale(1)";
};

const MarkerCircleHtml = ({
  icon,
  size,
  color,
  onClick,
  href,
  target = "_self",
  borderColor,
  borderWidth = 1.5,
}: Readonly<{
  icon: ReactNode;
  size: number;
  color?: string;
  onClick?: () => void;
  href?: string;
  target?: "_blank" | "_self";
  borderColor?: string;
  borderWidth?: number;
}>): ReactElement => {
  const hasAction = Boolean(onClick ?? href);
  const handleClick = useCallback((event: MouseEvent): void => {
    event.stopPropagation();
    activateMarkerAction({ href, onClick, target });
  }, [href, onClick, target]);
  const circleStyle = buildMarkerCircleStyle({ borderColor, borderWidth, color, hasAction, size });
  if (!hasAction) {
    return (
      <div style={circleStyle}>
        {icon}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      style={circleStyle}
      onMouseEnter={handleMarkerCircleMouseEnter}
      onMouseLeave={handleMarkerCircleMouseLeave}
    >
      {icon}
    </button>
  );
}

export { MarkerCircleHtml };
