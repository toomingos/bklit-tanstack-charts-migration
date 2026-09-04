import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

export interface BadgeProps {
  count: number;
  readonly size: number;
}

export const Badge = ({ count, size }: Readonly<BadgeProps>): ReactElement => {
  const badgeStyle = useMemo<CSSProperties>(
    () => ({
      alignItems: "center",
      backgroundColor: "var(--chart-marker-badge-background)",
      borderRadius: 9999,
      color: "var(--chart-marker-badge-foreground)",
      display: "flex",
      // Size 11px matches the legacy bklit marker badge exactly (marker-group.tsx fontSize={11});
      // The visual-parity gate pins this, so it stays under react-doctor's 12px minimum.
      fontSize: 11,
      fontWeight: 600,
      height: 18,
      justifyContent: "center",
      left: size / 2 + 2,
      lineHeight: 1,
      pointerEvents: "none",
      position: "absolute",
      top: -size / 2 - 2,
      width: 18,
    }),
    [size],
  );

  return <div style={badgeStyle}>{count}</div>;
};
