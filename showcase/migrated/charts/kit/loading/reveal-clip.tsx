"use client";
// Standalone bklit `ChartRevealClip`: a left-to-right clip rect grown (or concealed) with CSS keyframes (styles.css
// `bkm-clip-reveal` / `bkm-clip-conceal`); the clip rect geometry is true LTR, never scaleX (which reveals from the centre).
import { useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import { isNumber, isString } from "../guards";
import { REVEAL_CSS_EASE } from "../motion/easing";
import { DEFAULT_ANIMATION_DURATION_MS } from "../motion/phase";
import type { EnterTransition } from "../motion/phase";

type ChartRevealClipMode = "reveal" | "conceal";

/** Props of `ChartRevealClip`. */
export interface ChartRevealClipProps {
  /** Id of the clip path. */
  clipPathId: string;
  /** Height of the clipped area in px. */
  height: number;
  /** Width the clip grows to, in px. */
  targetWidth: number;
  /** Timing of the reveal (duration and easing). A spring is replaced by the default tween. */
  enterTransition?: EnterTransition;
  /** Change this number to replay the reveal. */
  revealEpoch: number;
  /**
   * Extra space in px around the clip rectangle so edge glyphs are not cut off.
   * @default 0
   */
  padding?: number;
  /**
   * Animate the reveal. When false the clip stays at full width.
   * @default true
   */
  animating?: boolean;
  /**
   * `"reveal"` grows the clip from empty to full, `"conceal"` shrinks it from full to empty.
   * @default "reveal"
   */
  mode?: ChartRevealClipMode;
  /** Called when a `"conceal"` animation finishes. */
  onComplete?: () => void;
}

// bklit animation.ts clipRevealTransition: a tween keeps its own timing; anything else (springs) becomes the default tween.
const cssEase = (ease: EnterTransition["ease"]): string | undefined => {
  if (isString(ease)) {
    return ease;
  }
  return Array.isArray(ease) && ease.length > 0 ? `cubic-bezier(${ease.join(",")})` : undefined;
};

interface ClipTiming {
  duration: number;
  ease: string;
}

const timingOf = (enter: EnterTransition | undefined): ClipTiming => {
  if (enter?.type === "tween") {
    return { duration: enter.duration ?? 0.3, ease: cssEase(enter.ease) ?? REVEAL_CSS_EASE };
  }
  return { duration: isNumber(enter?.duration) ? enter.duration : DEFAULT_ANIMATION_DURATION_MS / 1000, ease: REVEAL_CSS_EASE };
};

/** @internal */
export const ChartRevealClip = ({
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
  const { duration, ease } = timingOf(enterTransition);
  const paddedWidth = Math.max(0, targetWidth + padding * 2);
  const paddedHeight = height + padding * 2;
  const conceal = mode === "conceal";
  const style = useMemo(
    () => ({
      "--bkm-clip-w": `${paddedWidth}px`,
      "--bkm-clip-x0": `${-padding}px`,
      "--bkm-clip-x1": `${-padding + paddedWidth}px`,
      animation: `${conceal ? "bkm-clip-conceal" : "bkm-clip-reveal"} ${duration}s ${ease} forwards`,
    }),
    [paddedWidth, padding, conceal, duration, ease],
  );
  // The wrapper drops the AnimationEvent: `onComplete` takes no argument.
  const handleConcealEnd = useCallback((): void => {
    onComplete?.();
  }, [onComplete]);
  if (!animating) {
    return (
      <clipPath id={clipPathId}>
        <rect height={paddedHeight} width={paddedWidth} x={-padding} y={-padding} />
      </clipPath>
    );
  }
  return (
    <clipPath id={clipPathId}>
      <rect key={`${mode}-${revealEpoch}`} height={paddedHeight} onAnimationEnd={conceal ? handleConcealEnd : undefined} style={style} y={-padding} />
    </clipPath>
  );
};

ChartRevealClip.displayName = "ChartRevealClip";
