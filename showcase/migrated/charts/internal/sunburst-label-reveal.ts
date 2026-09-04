// Sunburst label-reveal pipeline (extracted from sunburst-chart.tsx: it is the
// Self-contained WAAPI overlay cycle — post-paint text animation plus settle
// Timer — with no shared state besides the animation list the caller owns).
import { onPostPaint } from "./deferred-reveal";

const SUNBURST_LABEL_TEXT_SELECTOR = "text.ts-bkm-sunburst-label";
// Post-reveal slack before label inline opacity is cleared.
const LABEL_REVEAL_SETTLE_SLACK_MS = 30;

// Cancels every in-flight label reveal animation, tolerating teardown races.
const cancelLabelAnimations = (animations: readonly Animation[]): void => {
  for (const animation of animations) {
    try {
      animation.cancel();
    } catch {
      // Teardown race — already cancelled.
    }
  }
};

// Animates one reveal cycle over the currently connected label texts, returning
// The started animations so the caller can cancel them on teardown.
const paintLabelTextReveal = (
  texts: readonly SVGTextElement[],
  delayMs: number,
  durationMs: number,
): Animation[] => {
  const revealedAnimations: Animation[] = [];
  for (const text of texts) {
    if (text.isConnected) {
      text.style.opacity = "0";
      const animation = text.animate(
        [{ opacity: "0" }, { opacity: "1" }],
        {
          delay: delayMs,
          duration: durationMs,
          easing: "cubic-bezier(0.85,0,0.15,1)",
          fill: "backwards",
        },
      );
      revealedAnimations.push(animation);
      animation.onfinish = (): void => {
        animation.cancel();
        if (text.isConnected) {text.style.opacity = "1";}
      };
    }
  }
  return revealedAnimations;
};

// Queries the live label texts and starts their reveal, returning the animations.
const revealLabelsAfterPaint = (
  svg: SVGSVGElement,
  delayMs: number,
  durationMs: number,
): Animation[] => {
  const liveTexts = [...svg.querySelectorAll<SVGTextElement>(SUNBURST_LABEL_TEXT_SELECTOR)];
  return paintLabelTextReveal(liveTexts, delayMs, durationMs);
};

// Clears inline opacity on every connected label text once the reveal settled.
const clearLabelTextOpacity = (texts: readonly SVGTextElement[]): void => {
  for (const text of texts) {
    if (text.isConnected) {text.style.opacity = "";}
  }
};

// Schedules the post-reveal opacity cleanup, returning the timer handle.
const scheduleLabelSettle = (svg: SVGSVGElement, settledMs: number): ReturnType<typeof globalThis.setTimeout> => {
  const svgDataset = svg.dataset;
  return globalThis.setTimeout((): void => {
    svgDataset.bkmLabelsRevealed = "1";
    clearLabelTextOpacity([...svg.querySelectorAll<SVGTextElement>(SUNBURST_LABEL_TEXT_SELECTOR)]);
  }, settledMs);
};

// Starts one label reveal cycle (post-paint animation plus settle timer),
// Returning the combined teardown.
const startLabelReveal = (
  svg: SVGSVGElement,
  delayMs: number,
  durationMs: number,
): (() => void) => {
  const revealedAnimations: Animation[] = [];
  const cancelLabelPostPaint = onPostPaint((): void => {
    revealedAnimations.push(...revealLabelsAfterPaint(svg, delayMs, durationMs));
  });
  const settleTimer = scheduleLabelSettle(svg, delayMs + durationMs + LABEL_REVEAL_SETTLE_SLACK_MS);
  return (): void => {
    cancelLabelPostPaint();
    globalThis.clearTimeout(settleTimer);
    cancelLabelAnimations(revealedAnimations);
  };
};

// Resets the labels overlay for a playKey replay and re-runs its reveal.
const resetLabelsOverlayForReplay = (
  container: HTMLElement,
  rerunLabelsReveal: () => void,
): void => {
  const labelsSvg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
  if (!labelsSvg) {return;}
  delete labelsSvg.dataset.bkmLabelsRevealed;
  for (const text of labelsSvg.querySelectorAll<SVGTextElement>(SUNBURST_LABEL_TEXT_SELECTOR)) {
    text.style.opacity = "";
  }
  rerunLabelsReveal();
};

export { cancelLabelAnimations, resetLabelsOverlayForReplay, startLabelReveal };
