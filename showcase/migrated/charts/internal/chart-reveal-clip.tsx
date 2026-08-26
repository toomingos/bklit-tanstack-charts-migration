// P5.2 T-E1b — bklit chart-reveal-clip.tsx port. Left-to-right clip reveal /
// conceal for cartesian series, driven by the shared WAAPI reveal engine
// (./enter-transition) instead of framer-motion: the rect's geometry
// properties are keyframed from the SAME sampled-progress timing (tween
// bezier at animation level / pre-sampled spring curve) the hosts' own
// reveals use, so a caller-supplied spring transition reproduces the real
// spring trajectory rather than a linear approximation.
import { useEffect, useRef } from "react";
import {
  buildProgressKeyframes,
  resolveEnterTransition,
  revealTiming,
  type EnterTransition,
} from "./enter-transition";

export type ChartRevealClipMode = "reveal" | "conceal";

export interface ChartRevealClipProps {
  clipPathId: string;
  height: number;
  targetWidth: number;
  enterTransition?: EnterTransition;
  /** Bumps when motion settings change to replay the reveal. */
  revealEpoch: number;
  /** Extra inset around the clip rect so edge glyphs are not cut off. */
  padding?: number;
  /** When false, clip stays at full width (no grow animation). */
  animating?: boolean;
  /** Reveal grows 0 → full; conceal shrinks full → 0 (ready → loading). */
  mode?: ChartRevealClipMode;
  /** Called when a conceal animation finishes. */
  onComplete?: () => void;
}

/**
 * Left-to-right clip reveal for cartesian series.
 * Grows clip rect width from 0 → full (true LTR; scaleX is avoided — it
 * reveals from center) — bklit chart-reveal-clip.tsx:33-34 contract, verbatim.
 */
export function ChartRevealClip({
  clipPathId,
  height,
  targetWidth,
  enterTransition,
  revealEpoch,
  padding = 0,
  animating = true,
  mode = "reveal",
  onComplete,
}: ChartRevealClipProps) {
  const paddedWidth = Math.max(0, targetWidth + padding * 2);
  const paddedHeight = height + padding * 2;

  const rectRef = useRef<SVGRectElement | null>(null);

  useEffect(() => {
    if (!animating) return;
    const rect = rectRef.current;
    if (!rect) return;

    const resolved = resolveEnterTransition(enterTransition);
    const timing = revealTiming(resolved);
    const isConceal = mode === "conceal";
    const rightEdge = -padding + paddedWidth;

    // Static attributes carry the pre-animation state (framer `initial`
    // parity): reveal starts collapsed; conceal starts full-width.
    rect.setAttribute("x", String(-padding));
    rect.setAttribute("width", isConceal ? String(paddedWidth) : "0");

    const frames = buildProgressKeyframes(timing, (progress) =>
      isConceal
        ? {
            width: `${Math.max(0, paddedWidth * (1 - progress))}px`,
            x: `${rightEdge - paddedWidth * progress}px`,
          }
        : { width: `${Math.max(0, paddedWidth * progress)}px` },
    );
    const anim = rect.animate(frames, {
      duration: timing.durationMs,
      easing: timing.easing,
      fill: "forwards",
    });
    anim.onfinish = () => {
      // Commit end-state attributes so the element no longer relies on the
      // persisted animation fill, then drop it.
      if (isConceal) {
        rect.setAttribute("width", "0");
        rect.setAttribute("x", String(rightEdge));
        onComplete?.();
      } else {
        rect.setAttribute("width", String(paddedWidth));
      }
      anim.cancel();
    };
    return () => {
      anim.onfinish = null;
      anim.cancel();
    };
  }, [animating, mode, revealEpoch, enterTransition, paddedWidth, padding]);

  if (!animating) {
    return (
      <clipPath id={clipPathId}>
        <rect
          height={paddedHeight}
          width={paddedWidth}
          x={-padding}
          y={-padding}
        />
      </clipPath>
    );
  }

  return (
    <clipPath id={clipPathId}>
      <rect
        ref={rectRef}
        height={paddedHeight}
        width={mode === "conceal" ? paddedWidth : 0}
        x={-padding}
        y={-padding}
      />
    </clipPath>
  );
}
