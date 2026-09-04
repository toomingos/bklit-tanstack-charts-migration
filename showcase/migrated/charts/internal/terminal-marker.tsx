"use client";

import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import { resolveEnterTransition } from './enter-transition';
import type { EnterTransition } from './enter-transition';
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import {
  TERMINAL_MARKER_HIDDEN_TRANSFORM,
  useFreshRef,
  useProjectionPhasePort,
  useReplayVisibleTerminalMarkers,
  useTerminalMarkerPhaseApplier,
  useTerminalMarkerRefs,
} from "./terminal-marker-phase";
import type { ProjectionPhaseHandle, TerminalMarkerAnchor, TerminalMarkerClock } from "./terminal-marker-phase";

// Projection end dots render slightly smaller than their anchor radius.
const PROJECTION_END_MARKER_RADIUS_SCALE = 0.85;
const TERMINAL_MARKER_FADE_DURATION_MS = 280;
const TERMINAL_MARKER_FADE_EASING = "cubic-bezier(0.22,1,0.36,1)";
// Overlay SVG covers the plot without intercepting pointer events.
const PROJECTION_OVERLAY_STYLE = { inset: 0, pointerEvents: "none", position: "absolute" } as const;
// End-marker group starts hidden until the phase applier reveals it.
const PROJECTION_END_GROUP_STYLE = { opacity: 0 } as const;

const resolveTerminalTiming = (enterTransition: Readonly<EnterTransition> | undefined): TerminalMarkerClock => {
  if (enterTransition !== undefined) {
    const resolved = resolveEnterTransition(enterTransition);
    if (resolved.kind === "tween") {
      return { durationMs: resolved.durationMs, easing: resolved.easingCss };
    }
    return { durationMs: TERMINAL_MARKER_FADE_DURATION_MS, easing: TERMINAL_MARKER_FADE_EASING };
  }
  return { durationMs: TERMINAL_MARKER_FADE_DURATION_MS, easing: TERMINAL_MARKER_FADE_EASING };
}

interface ProjectionEndMarkerAnchor {
  readonly cx: number;
  readonly cy: number;
  readonly stroke: string;
  readonly strokeOpacity: number;
  readonly radius: number;
}

interface ProjectionMarkerOverlayProps {
  readonly width: number;
  readonly height: number;
  readonly margin: { readonly top: number; readonly left: number; readonly right: number; readonly bottom: number };
  readonly terminalMarkers: readonly TerminalMarkerAnchor[];
  readonly projectionEndMarkers: readonly ProjectionEndMarkerAnchor[];
  readonly phasePort: RefObject<ProjectionPhaseHandle | null>;
  readonly enterTransition?: EnterTransition;
}

const renderProjectionEndMarkers = (markers: readonly ProjectionEndMarkerAnchor[]): ReactElement[] =>
  markers.map((marker: Readonly<ProjectionEndMarkerAnchor>) => (
    <circle key={`pend-${marker.cx}-${marker.cy}`} cx={marker.cx} cy={marker.cy} r={marker.radius * PROJECTION_END_MARKER_RADIUS_SCALE} fill={marker.stroke} fillOpacity={marker.strokeOpacity} />
  ));

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
}

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

const renderTerminalMarkerNode = (marker: Readonly<TerminalMarkerAnchor>, markerRefs: RefObject<Map<string, SVGGElement>>): ReactElement => {
  const resolvedStroke = optionalText(marker.stroke) ?? optionalText(marker.fill) ?? "currentColor";
  const ringOuter = marker.strokeWidth > 0 ? marker.radius + marker.ringGap + marker.strokeWidth : marker.radius;
  const outlineRadius = marker.outlineWidth > 0 ? ringOuter + marker.outlineWidth / 2 : 0;
  const ringRadius = marker.radius + marker.ringGap + marker.strokeWidth / 2;
  return (
    <g
      key={marker.dataKey}
      ref={(element): void => {
        if (element) {markerRefs.current.set(marker.dataKey, element);}
        else {markerRefs.current.delete(marker.dataKey);}
      }}
      style={terminalMarkerNodeStyle(marker.cx, marker.cy)}
    >
      {renderTerminalMarkerInner({ marker, outlineRadius, resolvedStroke, ringRadius })}
    </g>
  );
};

const renderTerminalMarkerNodes = (markers: readonly TerminalMarkerAnchor[], markerRefs: RefObject<Map<string, SVGGElement>>): ReactElement[] =>
  markers.map((marker: Readonly<TerminalMarkerAnchor>) => renderTerminalMarkerNode(marker, markerRefs));

const ProjectionMarkerOverlay = (props: Readonly<ProjectionMarkerOverlayProps>): ReactNode => {
  const { width, height, margin, terminalMarkers, projectionEndMarkers, phasePort, enterTransition } = props;
  const timingRef = useFreshRef(resolveTerminalTiming(enterTransition));
  const prefersReducedRef = useFreshRef(usePrefersReducedMotion());
  const refs = useTerminalMarkerRefs();
  const applyPhase = useTerminalMarkerPhaseApplier({ prefersReducedRef, refs, timingRef });
  useProjectionPhasePort(phasePort, applyPhase, refs.runningAnimsRef);
  useReplayVisibleTerminalMarkers({ prefersReducedRef, refs, terminalMarkers, timingRef });

  if (terminalMarkers.length === 0 && projectionEndMarkers.length === 0) {return undefined;}

  return (
    <svg width={width} height={height} style={PROJECTION_OVERLAY_STYLE} aria-hidden="true">
      <g transform={`translate(${margin.left},${margin.top})`}>
        <g ref={refs.endGroupRef} style={PROJECTION_END_GROUP_STYLE}>
          {renderProjectionEndMarkers(projectionEndMarkers)}
        </g>
        {renderTerminalMarkerNodes(terminalMarkers, refs.markerRefs)}
      </g>
    </svg>
  );
};

export { ProjectionMarkerOverlay };
export type { TerminalMarkerAnchor, ProjectionPhaseHandle } from "./terminal-marker-phase";
export type { ProjectionEndMarkerAnchor };
