"use client";

import * as React from "react";
import type { ChartPhase } from "./chart-phase";
import { resolveEnterTransition, type EnterTransition } from "./enter-transition";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

const TERMINAL_MARKER_FADE_DURATION_MS = 280;
const TERMINAL_MARKER_FADE_EASING = "cubic-bezier(0.22,1,0.36,1)";

export interface TerminalMarkerAnchor {
  dataKey: string;
  cx: number;
  cy: number;
  fill: string;
  stroke: string;
  radius: number;
  ringGap: number;
  strokeWidth: number;
  outlineWidth: number;
  outlineColor?: string;
}

export interface ProjectionEndMarkerAnchor {
  cx: number;
  cy: number;
  stroke: string;
  strokeOpacity: number;
  radius: number;
}

export interface ProjectionPhaseHandle {
  setPhase(phase: ChartPhase): void;
}

interface ProjectionMarkerOverlayProps {
  width: number;
  height: number;
  margin: { top: number; left: number; right: number; bottom: number };
  terminalMarkers: TerminalMarkerAnchor[];
  projectionEndMarkers: ProjectionEndMarkerAnchor[];
  phasePort: React.MutableRefObject<ProjectionPhaseHandle | null>;
  enterTransition?: EnterTransition;
}

function isTerminalMarkerPhaseVisible(phase: ChartPhase): boolean {
  return phase === "ready" || phase === "exitingReady";
}

function isProjectionEndMarkerPhaseVisible(phase: ChartPhase): boolean {
  return phase === "revealing" || phase === "ready" || phase === "exitingReady";
}

function resolveTerminalTiming(enterTransition: EnterTransition | undefined): { durationMs: number; easing: string } {
  if (enterTransition && typeof enterTransition === "object") {
    const resolved = resolveEnterTransition(enterTransition);
    if (resolved.kind === "tween") {
      return { durationMs: resolved.durationMs, easing: resolved.easingCss };
    }
    return { durationMs: TERMINAL_MARKER_FADE_DURATION_MS, easing: TERMINAL_MARKER_FADE_EASING };
  }
  return { durationMs: TERMINAL_MARKER_FADE_DURATION_MS, easing: TERMINAL_MARKER_FADE_EASING };
}

export function ProjectionMarkerOverlay(props: ProjectionMarkerOverlayProps): React.ReactNode {
  const { width, height, margin, terminalMarkers, projectionEndMarkers, phasePort } = props;
  const enterTransition = (props as { enterTransition?: EnterTransition }).enterTransition;
  const prefersReduced = usePrefersReducedMotion();
  const timing = resolveTerminalTiming(enterTransition);
  const endGroupRef = React.useRef<SVGGElement | null>(null);
  const markerRefs = React.useRef<Map<string, SVGGElement>>(new Map());
  const lastPhaseRef = React.useRef<ChartPhase | null>(null);
  const runningAnimsRef = React.useRef<Map<string, Animation>>(new Map());
  const timingRef = React.useRef(timing);
  const prefersReducedRef = React.useRef(prefersReduced);
  timingRef.current = timing;
  prefersReducedRef.current = prefersReduced;

  const applyPhase = React.useCallback((next: ChartPhase) => {
    if (lastPhaseRef.current === next) return;
    const prev = lastPhaseRef.current;
    lastPhaseRef.current = next;
    const terminalVisible = isTerminalMarkerPhaseVisible(next);
    const projectionVisible = isProjectionEndMarkerPhaseVisible(next);
    const prevTerminalVisible = prev ? isTerminalMarkerPhaseVisible(prev) : false;
    if (endGroupRef.current) {
      endGroupRef.current.style.opacity = projectionVisible ? "1" : "0";
    }
    if (terminalVisible === prevTerminalVisible) return;
    for (const [key, el] of markerRefs.current) {
      const existing = runningAnimsRef.current.get(key);
      if (existing) {
        try {
          existing.cancel();
        } catch {
          // detached
        }
        runningAnimsRef.current.delete(key);
      }
      if (prefersReducedRef.current) {
        el.style.opacity = terminalVisible ? "1" : "0";
        el.style.transform = terminalVisible ? "scale(1)" : "scale(0.55)";
        continue;
      }
      if (terminalVisible) {
        el.style.opacity = "0";
        el.style.transform = "scale(0.55)";
        const anim = el.animate(
          [
            { opacity: 0, transform: "scale(0.55)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: timingRef.current.durationMs, easing: timingRef.current.easing, fill: "forwards" },
        );
        runningAnimsRef.current.set(key, anim);
        anim.onfinish = () => {
          runningAnimsRef.current.delete(key);
          el.style.opacity = "1";
          el.style.transform = "scale(1)";
        };
        anim.oncancel = () => {
          runningAnimsRef.current.delete(key);
        };
      } else {
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
        const anim = el.animate(
          [
            { opacity: 1, transform: "scale(1)" },
            { opacity: 0, transform: "scale(0.55)" },
          ],
          { duration: timingRef.current.durationMs, easing: timingRef.current.easing, fill: "forwards" },
        );
        runningAnimsRef.current.set(key, anim);
        anim.onfinish = () => {
          runningAnimsRef.current.delete(key);
          el.style.opacity = "0";
          el.style.transform = "scale(0.55)";
        };
        anim.oncancel = () => {
          runningAnimsRef.current.delete(key);
        };
      }
    }
  }, []);

  React.useLayoutEffect(() => {
    const handle: ProjectionPhaseHandle = { setPhase: (p) => applyPhase(p) };
    phasePort.current = handle;
    const anims = runningAnimsRef.current;
    return () => {
      if (phasePort.current === handle) phasePort.current = null;
      for (const anim of anims.values()) {
        try {
          anim.cancel();
        } catch {
          // detached
        }
      }
      anims.clear();
    };
  }, [phasePort, applyPhase]);

  React.useLayoutEffect(() => {
    const phase = lastPhaseRef.current;
    if (!phase) return;
    if (!isTerminalMarkerPhaseVisible(phase)) return;
    for (const [key, el] of markerRefs.current) {
      if (runningAnimsRef.current.has(key)) continue;
      if (el.style.opacity === "1") continue;
      if (prefersReducedRef.current) {
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
        continue;
      }
      el.style.opacity = "0";
      el.style.transform = "scale(0.55)";
      const anim = el.animate(
        [{ opacity: 0, transform: "scale(0.55)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: timingRef.current.durationMs, easing: timingRef.current.easing, fill: "forwards" },
      );
      runningAnimsRef.current.set(key, anim);
      anim.onfinish = () => {
        runningAnimsRef.current.delete(key);
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
      };
      anim.oncancel = () => {
        runningAnimsRef.current.delete(key);
      };
    }
  }, [terminalMarkers]);

  if (terminalMarkers.length === 0 && projectionEndMarkers.length === 0) return null;

  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden="true">
      <g transform={`translate(${margin.left},${margin.top})`}>
        <g ref={endGroupRef} style={{ opacity: 0 }}>
          {projectionEndMarkers.map((m, i) => (
            <circle key={`pend-${i}`} cx={m.cx} cy={m.cy} r={m.radius * 0.85} fill={m.stroke} fillOpacity={m.strokeOpacity} />
          ))}
        </g>
        {terminalMarkers.map((m) => {
          const resolvedStroke = m.stroke ?? m.fill ?? "currentColor";
          const ringOuter = m.strokeWidth > 0 ? m.radius + m.ringGap + m.strokeWidth : m.radius;
          const outlineRadius = m.outlineWidth > 0 ? ringOuter + m.outlineWidth / 2 : 0;
          const ringRadius = m.radius + m.ringGap + m.strokeWidth / 2;
          return (
            <g
              key={m.dataKey}
              ref={(el) => {
                if (el) markerRefs.current.set(m.dataKey, el);
                else markerRefs.current.delete(m.dataKey);
              }}
              style={
                {
                  transformBox: "fill-box" as unknown as string,
                  transformOrigin: `${m.cx}px ${m.cy}px`,
                  opacity: 0,
                  transform: "scale(0.55)",
                } as React.CSSProperties
              }
            >
              <g transform={`translate(${m.cx},${m.cy})`}>
                {m.outlineWidth > 0 ? <circle cx={0} cy={0} fill="none" r={outlineRadius} stroke={m.outlineColor ?? resolvedStroke} strokeWidth={m.outlineWidth} /> : null}
                <circle cx={0} cy={0} r={m.radius} fill={m.fill} />
                {m.strokeWidth > 0 ? <circle cx={0} cy={0} r={ringRadius} fill="none" stroke={m.stroke} strokeWidth={m.strokeWidth} /> : null}
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
