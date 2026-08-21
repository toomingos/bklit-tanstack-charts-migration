"use client";

import * as React from "react";
import type { ChartSelection } from "./chart-selection";

export type SegmentLineVariant = "dashed" | "solid" | "gradient";

export interface SegmentComponent {
  key: string;
  type: "segmentBackground" | "segmentLineFrom" | "segmentLineTo";
  props: Record<string, unknown>;
}

export function SegmentOverlay({
  selection,
  innerWidth,
  innerHeight,
  marginLeft,
  marginTop,
  components,
}: {
  selection: ChartSelection | null;
  innerWidth: number;
  innerHeight: number;
  marginLeft: number;
  marginTop: number;
  components: SegmentComponent[];
}) {
  if (!selection || components.length === 0) return null;
  const vis = selection.active && Math.abs(selection.endX - selection.startX) > 5;
  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <svg
      width={innerWidth}
      height={innerHeight}
      style={{ position: "absolute", left: marginLeft, top: marginTop, overflow: "visible", pointerEvents: "none" }}
      aria-hidden="true"
    >
      {components.map((c) => {
        if (c.type === "segmentBackground") {
          const fill = (c.props.fill as string | undefined) ?? "var(--chart-segment-background)";
          const minX = Math.min(selection.startX, selection.endX);
          const w = Math.abs(selection.endX - selection.startX);
          return (
            <rect
              key={c.key}
              fill={fill}
              x={minX}
              y={0}
              width={w}
              height={innerHeight}
              style={prefersReduced ? { opacity: vis ? 1 : 0 } : { opacity: vis ? 1 : 0, transition: "opacity 150ms ease-out" }}
            />
          );
        }
        if (c.type === "segmentLineFrom") {
          if (!vis) return null;
          const stroke = (c.props.stroke as string | undefined) ?? "var(--chart-segment-line)";
          const sw = (c.props.strokeWidth as number | undefined) ?? 1;
          const variant = (c.props.variant as SegmentLineVariant | undefined) ?? "dashed";
          if (variant === "gradient") {
            const gid = `bkm-seg-from-${c.key}`;
            return (
              <g key={c.key}>
                <defs>
                  <linearGradient id={gid} x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0} />
                    <stop offset="10%" stopColor={stroke} stopOpacity={1} />
                    <stop offset="90%" stopColor={stroke} stopOpacity={1} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <line stroke={`url(#${gid})`} strokeWidth={sw} x1={selection.startX} x2={selection.startX} y1={0} y2={innerHeight} />
              </g>
            );
          }
          return (
            <line
              key={c.key}
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={variant === "dashed" ? "4,4" : undefined}
              x1={selection.startX}
              x2={selection.startX}
              y1={0}
              y2={innerHeight}
            />
          );
        }
        if (c.type === "segmentLineTo") {
          if (!vis) return null;
          const stroke = (c.props.stroke as string | undefined) ?? "var(--chart-segment-line)";
          const sw = (c.props.strokeWidth as number | undefined) ?? 1;
          const variant = (c.props.variant as SegmentLineVariant | undefined) ?? "dashed";
          if (variant === "gradient") {
            const gid = `bkm-seg-to-${c.key}`;
            return (
              <g key={c.key}>
                <defs>
                  <linearGradient id={gid} x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0} />
                    <stop offset="10%" stopColor={stroke} stopOpacity={1} />
                    <stop offset="90%" stopColor={stroke} stopOpacity={1} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <line stroke={`url(#${gid})`} strokeWidth={sw} x1={selection.endX} x2={selection.endX} y1={0} y2={innerHeight} />
              </g>
            );
          }
          return (
            <line
              key={c.key}
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={variant === "dashed" ? "4,4" : undefined}
              x1={selection.endX}
              x2={selection.endX}
              y1={0}
              y2={innerHeight}
            />
          );
        }
        return null;
      })}
    </svg>
  );
}
