"use client";

import type { ReactElement, ReactNode, RefObject } from "react";
import { useChartStable } from "./chart-context";
import { resolveEnterTransition } from './enter-transition';
import type { EnterTransition } from './enter-transition';
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import {
  useFreshRef,
  useProjectionPhasePort,
  useReplayVisibleTerminalMarkers,
  useTerminalMarkerPhaseApplier,
  useTerminalMarkerRefs,
} from "./terminal-marker-phase";
import type { ProjectionPhaseHandle, TerminalMarkerAnchor, TerminalMarkerClock } from "./terminal-marker-phase";
import { TerminalMarkerNode } from "./terminal-marker-node";

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
  readonly terminalMarkers: readonly TerminalMarkerAnchor[];
  readonly projectionEndMarkers: readonly ProjectionEndMarkerAnchor[];
  readonly phasePort: RefObject<ProjectionPhaseHandle | null>;
  readonly enterTransition?: EnterTransition;
}

const renderProjectionEndMarkers = (markers: readonly ProjectionEndMarkerAnchor[]): ReactElement[] =>
  markers.map((marker: Readonly<ProjectionEndMarkerAnchor>) => (
    <circle key={`pend-${marker.cx}-${marker.cy}`} cx={marker.cx} cy={marker.cy} r={marker.radius * PROJECTION_END_MARKER_RADIUS_SCALE} fill={marker.stroke} fillOpacity={marker.strokeOpacity} />
  ));

const ProjectionMarkerOverlay = (props: Readonly<ProjectionMarkerOverlayProps>): ReactNode => {
  const { terminalMarkers, projectionEndMarkers, phasePort, enterTransition } = props;
  // Plot bounds come from the host scene, never from margin props (V1.2/G6).
  // Anchors arrive in full-container pixels, so the svg covers the container.
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  const timingRef = useFreshRef(resolveTerminalTiming(enterTransition));
  const prefersReducedRef = useFreshRef(usePrefersReducedMotion());
  const refs = useTerminalMarkerRefs();
  const applyPhase = useTerminalMarkerPhaseApplier({ prefersReducedRef, refs, timingRef });
  useProjectionPhasePort(phasePort, applyPhase, refs.runningAnimsRef);
  useReplayVisibleTerminalMarkers({ prefersReducedRef, refs, terminalMarkers, timingRef });
  const fullWidth = margin.left + plot.width + margin.right;
  const fullHeight = margin.top + plot.height + margin.bottom;

  if (terminalMarkers.length === 0 && projectionEndMarkers.length === 0) {return undefined;}

  return (
    <svg width={fullWidth} height={fullHeight} style={PROJECTION_OVERLAY_STYLE} aria-hidden="true">
      <g ref={refs.endGroupRef} style={PROJECTION_END_GROUP_STYLE}>
        {renderProjectionEndMarkers(projectionEndMarkers)}
      </g>
      {terminalMarkers.map((marker: Readonly<TerminalMarkerAnchor>) => (
        <TerminalMarkerNode key={marker.dataKey} marker={marker} markerRefs={refs.markerRefs} />
      ))}
    </svg>
  );
};

export { ProjectionMarkerOverlay };
export type { TerminalMarkerAnchor, ProjectionPhaseHandle } from "./terminal-marker-phase";
export type { ProjectionEndMarkerAnchor };
