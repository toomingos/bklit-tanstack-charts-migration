import { useCallback, useMemo } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactElement, ReactNode } from "react";

const MARKER_ICON_FONT_SCALE = 0.5;
const MARKER_ICON_HOVER_SCALE = 1.15;
const MARKER_ICON_REST_SCALE = 1;
const MARKER_CIRCLE_DEFAULT_BORDER_WIDTH = 1.5;
const FOCUSABLE_TAB_INDEX = 0;

interface MarkerCircleHtmlProps {
  icon: ReactNode;
  size: number;
  color?: string;
  onClick?: () => void;
  href?: string;
  target?: "_blank" | "_self";
  borderColor?: string;
  borderWidth?: number;
}

interface MarkerActivation {
  readonly handleClick: (event: MouseEvent<HTMLDivElement>) => void;
  readonly handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly handleIconEnter: (event: MouseEvent<HTMLDivElement>) => void;
  readonly handleIconLeave: (event: MouseEvent<HTMLDivElement>) => void;
}

interface MarkerActivationParams {
  readonly onClick?: () => void;
  readonly navigationHref: string;
  readonly target: "_blank" | "_self";
  readonly hasAction: boolean;
}

const performMarkerNavigation = (navigationHref: string, target: "_blank" | "_self"): void => {
  if (navigationHref === "") {return;}
  if (target === "_blank") {
    globalThis.open(navigationHref, "_blank", "noopener,noreferrer");
  } else {
    globalThis.location.href = navigationHref;
  }
}

const useMarkerActivation = (params: Readonly<MarkerActivationParams>): MarkerActivation => {
  const { onClick, navigationHref, target, hasAction } = params;
  // Shared by click and Enter/Space activation so both paths do exactly the same thing.
  const activate = useCallback(
    (event: { readonly stopPropagation: () => void }): void => {
      event.stopPropagation();
      if (onClick) {
        onClick();
        return;
      }
      performMarkerNavigation(navigationHref, target);
    },
    [onClick, navigationHref, target],
  );
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      activate(event);
    },
    [activate],
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (!hasAction) {return;}
      if (event.key !== "Enter" && event.key !== " ") {return;}
      event.preventDefault();
      activate(event);
    },
    [hasAction, activate],
  );
  const handleIconEnter = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      if (hasAction) {
        event.currentTarget.style.transform = `scale(${MARKER_ICON_HOVER_SCALE})`;
      }
    },
    [hasAction],
  );
  const handleIconLeave = useCallback((event: MouseEvent<HTMLDivElement>): void => {
    event.currentTarget.style.transform = `scale(${MARKER_ICON_REST_SCALE})`;
  }, []);
  return { handleClick, handleIconEnter, handleIconLeave, handleKeyDown };
}

interface MarkerCircleStyleParams {
  readonly color: string | undefined;
  readonly borderColor: string | undefined;
  readonly borderWidth: number;
  readonly hasAction: boolean;
  readonly size: number;
}

const MARKER_CIRCLE_BORDER_RADIUS = 9999;

const buildMarkerCircleStyle = (params: Readonly<MarkerCircleStyleParams>): CSSProperties => ({
  alignItems: "center",
  backgroundColor: params.color ?? "var(--chart-marker-background)",
  border: `${params.borderWidth}px solid ${params.borderColor ?? "var(--chart-marker-border)"}`,
  borderRadius: MARKER_CIRCLE_BORDER_RADIUS,
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  color: "var(--chart-marker-foreground)",
  cursor: params.hasAction ? "pointer" : undefined,
  display: "flex",
  fontSize: params.size * MARKER_ICON_FONT_SCALE,
  height: params.size,
  justifyContent: "center",
  overflow: "hidden",
  transition: "transform 150ms ease-out",
  width: params.size,
});

const MarkerCircleHtml = ({
  icon,
  size,
  color,
  onClick,
  href,
  target = "_self",
  borderColor,
  borderWidth = MARKER_CIRCLE_DEFAULT_BORDER_WIDTH,
}: Readonly<MarkerCircleHtmlProps>): ReactElement => {
  const hasAction = Boolean(onClick ?? href);
  // The href-as-navigation-target is falsy-checked (empty string means "no link"), so normalize
  // Through `??` once instead of comparing against the `undefined` literal downstream.
  const navigationHref = href ?? "";
  const { handleClick, handleKeyDown, handleIconEnter, handleIconLeave } = useMarkerActivation({ hasAction, navigationHref, onClick, target });
  const circleStyle = useMemo<CSSProperties>(
    () => buildMarkerCircleStyle({ borderColor, borderWidth, color, hasAction, size }),
    [color, borderWidth, borderColor, hasAction, size],
  );

  return (
    <div
      onClick={hasAction ? handleClick : undefined}
      onKeyDown={hasAction ? handleKeyDown : undefined}
      role={hasAction ? "button" : undefined}
      tabIndex={hasAction ? FOCUSABLE_TAB_INDEX : undefined}
      style={circleStyle}
      onMouseEnter={handleIconEnter}
      onMouseLeave={handleIconLeave}
    >
      {icon}
    </div>
  );
};

export { MarkerCircleHtml };
export type { MarkerCircleHtmlProps };
