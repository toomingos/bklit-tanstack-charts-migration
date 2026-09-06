// Clip reveal retired: the renderer owns the entrance.
// Static clip paints full width (reveal) or empty (conceal).
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { Transition } from "motion/react";
import { useEffectEvent } from "./use-effect-event";

type ChartRevealClipMode = "reveal" | "conceal";

interface ChartRevealClipProps {
  clipPathId: string;
  height: number;
  targetWidth: number;
  enterTransition?: Transition;
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

interface RevealAnimationParams {
  readonly enterTransition: Transition | undefined;
  readonly epoch: number;
  readonly isConceal: boolean;
  readonly onComplete: (() => void) | undefined;
  readonly paddedWidth: number;
  readonly padding: number;
}

// Settles the final rect; retired, so no cleanup is needed.
const startRevealAnimation = (rect: SVGRectElement, params: Readonly<RevealAnimationParams>): undefined => {
  const { isConceal, onComplete, paddedWidth, padding } = params;
  const rightEdge = -padding + paddedWidth;

  rect.setAttribute("x", isConceal ? String(rightEdge) : String(-padding));
  rect.setAttribute("width", isConceal ? "0" : String(paddedWidth));
  if (isConceal) {
    onComplete?.();
  }
  return undefined;
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
}: ChartRevealClipProps): ReactElement => {
  const paddedWidth = Math.max(0, targetWidth + padding * 2);
  const paddedHeight = height + padding * 2;

  const rectRef = useRef<SVGRectElement | null>(null);

  // Latest conceal callback without retriggering the WAAPI animation on identity changes.
  // The reveal replays only on the visual inputs plus the epoch.
  const onConcealComplete = useEffectEvent((): void => {
    onComplete?.();
  });

  useEffect((): (() => void) | undefined => {
    if (!animating) {return undefined;}
    const rect = rectRef.current;
    if (!rect) {return undefined;}
    startRevealAnimation(rect, { enterTransition, epoch: revealEpoch, isConceal: mode === "conceal", onComplete: onConcealComplete, paddedWidth, padding });
    return undefined;
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
