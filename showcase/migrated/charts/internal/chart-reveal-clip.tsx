// Left-to-right clip reveal driven by the shared WAAPI reveal engine.
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { buildProgressKeyframes, resolveEnterTransition, revealTiming } from './enter-transition';
import type { EnterTransition } from './enter-transition';

type ChartRevealClipMode = "reveal" | "conceal";

interface ChartRevealClipProps {
  clipPathId: string;
  height: number;
  targetWidth: number;
  enterTransition?: EnterTransition;
  revealEpoch: number;
  padding?: number;
  animating?: boolean;
  mode?: ChartRevealClipMode;
  onComplete?: () => void;
}

interface RevealAnimationParams {
  readonly enterTransition: EnterTransition | undefined;
  readonly isConceal: boolean;
  readonly onComplete: (() => void) | undefined;
  readonly paddedWidth: number;
  readonly padding: number;
}

// Starts the WAAPI width-reveal on the clip rect; returns the effect cleanup.
const startRevealAnimation = (rect: SVGRectElement, params: Readonly<RevealAnimationParams>): (() => void) => {
  const { enterTransition, isConceal, onComplete, paddedWidth, padding } = params;
  const resolved = resolveEnterTransition(enterTransition);
  const timing = revealTiming(resolved);
  const rightEdge = -padding + paddedWidth;

  rect.setAttribute("x", String(-padding));
  rect.setAttribute("width", isConceal ? String(paddedWidth) : "0");

  const frames = buildProgressKeyframes(timing, (progress) => isConceal
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
  anim.onfinish = (): void => {
    if (isConceal) {
      rect.setAttribute("width", "0");
      rect.setAttribute("x", String(rightEdge));
      onComplete?.();
    } else {
      rect.setAttribute("width", String(paddedWidth));
    }
    anim.cancel();
  };
  return (): void => {
    anim.onfinish = null;
    anim.cancel();
  };
};

interface StaticClipParams {
  readonly clipPathId: string;
  readonly paddedHeight: number;
  readonly paddedWidth: number;
  readonly padding: number;
}

// Non-animated clip: full-width rect, no WAAPI work.
const renderStaticClip = (params: Readonly<StaticClipParams>): ReactElement => {
  const { clipPathId, paddedHeight, paddedWidth, padding } = params;
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
};

/** Width-grown clip (scaleX would reveal from center, not left-to-right).
 *
 * @param {string} clipPathId - Clip path id referenced by the chart surface.
 * @param {number} height - Chart height in CSS pixels before padding.
 * @param {number} targetWidth - Final revealed width in CSS pixels; the rect animates from 0 to this plus padding.
 * @param {EnterTransition} [enterTransition] - Transition override forwarded to the reveal engine; absent keeps the shared default.
 * @param {number} revealEpoch - Effect dependency bumped to replay the reveal.
 * @param {number} [padding] - Extra clip extent in CSS pixels around the chart; defaults to 0.
 * @param {boolean} [animating] - False renders the full-width static clip with no WAAPI work; defaults to true.
 * @param {ChartRevealClipMode} [mode] - Reveal grows left-to-right, conceal shrinks toward the right edge; defaults to reveal.
 * @param {() => void} [onComplete] - Called when the conceal animation finishes; ignored on the reveal path.
 * @returns {ReactElement} Clip path wrapping the animated rect, or the static full-width rect when not animating.
 */
const ChartRevealClip = ({
  clipPathId,
  height,
  targetWidth,
  enterTransition,
  revealEpoch,
  padding = 0,
  animating = true,
  mode = "reveal",
  onComplete,
}: Readonly<ChartRevealClipProps>): ReactElement => {
  const paddedWidth = Math.max(0, targetWidth + padding * 2);
  const paddedHeight = height + padding * 2;

  const rectRef = useRef<SVGRectElement | null>(null);

  useEffect((): (() => void) | undefined => {
    if (!animating) {return undefined;}
    const rect = rectRef.current;
    if (!rect) {return undefined;}
    return startRevealAnimation(rect, { enterTransition, isConceal: mode === "conceal", onComplete, paddedWidth, padding });
  }, [animating, mode, revealEpoch, enterTransition, paddedWidth, padding]);

  if (!animating) {
    return renderStaticClip({ clipPathId, paddedHeight, paddedWidth, padding });
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
};

export { ChartRevealClip };
export type { ChartRevealClipMode, ChartRevealClipProps };
