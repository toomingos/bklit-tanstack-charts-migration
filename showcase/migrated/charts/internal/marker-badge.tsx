"use client";

import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

const Badge = ({ count, size }: { readonly count: number; readonly size: number }): ReactElement => {
  const badgeStyle = useMemo(
    (): CSSProperties => ({
      alignItems: "center",
      backgroundColor: "var(--chart-marker-badge-background)",
      borderRadius: 9999,
      color: "var(--chart-marker-badge-foreground)",
      display: "flex",
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

export { Badge };
