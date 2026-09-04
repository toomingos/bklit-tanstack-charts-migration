"use client";

import { useCallback } from "react";
import type { CSSProperties, ReactElement, RefCallback, RefObject } from "react";
import { TERMINAL_MARKER_HIDDEN_TRANSFORM } from "./terminal-marker-phase";
import type { TerminalMarkerAnchor } from "./terminal-marker-phase";

// Marker anchors arrive via props and may be nullish at runtime from untyped consumers;
// The nullable return keeps the fallback chain a genuine check.
const optionalText = (value: string): string | undefined => value;

// Hidden-state style for one terminal marker node, keyed by its anchor.
const terminalMarkerNodeStyle = (cx: number, cy: number): CSSProperties => ({
  opacity: 0,
  transform: TERMINAL_MARKER_HIDDEN_TRANSFORM,
  transformBox: "fill-box",
  transformOrigin: `${cx}px ${cy}px`,
});

interface TerminalMarkerInnerParams {
  readonly marker: Readonly<TerminalMarkerAnchor>;
  readonly resolvedStroke: string;
  readonly outlineRadius: number;
  readonly ringRadius: number;
}

const renderTerminalMarkerInner = (params: Readonly<TerminalMarkerInnerParams>): ReactElement => {
  const { marker, outlineRadius, resolvedStroke, ringRadius } = params;
  return (
    <g transform={`translate(${marker.cx},${marker.cy})`}>
      {marker.outlineWidth > 0 && <circle cx={0} cy={0} fill="none" r={outlineRadius} stroke={marker.outlineColor ?? resolvedStroke} strokeWidth={marker.outlineWidth} />}
      <circle cx={0} cy={0} r={marker.radius} fill={marker.fill} />
      {marker.strokeWidth > 0 && <circle cx={0} cy={0} r={ringRadius} fill="none" stroke={marker.stroke} strokeWidth={marker.strokeWidth} />}
    </g>
  );
};

interface TerminalMarkerNodeProps {
  readonly marker: Readonly<TerminalMarkerAnchor>;
  readonly markerRefs: RefObject<Map<string, SVGGElement>>;
}

// One marker node: owns its callback ref so the overlay never creates per-node
// Closures during render (marker-group-view enterRef parity for ref-as-prop).
const TerminalMarkerNode = ({ marker, markerRefs }: Readonly<TerminalMarkerNodeProps>): ReactElement => {
  const resolvedStroke = optionalText(marker.stroke) ?? optionalText(marker.fill) ?? "currentColor";
  const ringOuter = marker.strokeWidth > 0 ? marker.radius + marker.ringGap + marker.strokeWidth : marker.radius;
  const outlineRadius = marker.outlineWidth > 0 ? ringOuter + marker.outlineWidth / 2 : 0;
  const ringRadius = marker.radius + marker.ringGap + marker.strokeWidth / 2;
  const setNodeRef = useCallback<RefCallback<SVGGElement>>((element) => {
    if (!element) {return undefined;}
    markerRefs.current.set(marker.dataKey, element);
    return (): void => {
      markerRefs.current.delete(marker.dataKey);
    };
  }, [markerRefs, marker.dataKey]);
  return (
    <g
      ref={setNodeRef}
      style={terminalMarkerNodeStyle(marker.cx, marker.cy)}
    >
      {renderTerminalMarkerInner({ marker, outlineRadius, resolvedStroke, ringRadius })}
    </g>
  );
};

export { TerminalMarkerNode };
export type { TerminalMarkerNodeProps };
