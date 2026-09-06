// Sunburst label pipeline: labels paint with the renderer now.
// The label-after-arc sequence needs a ruling (reported below).
const SUNBURST_LABEL_TEXT_SELECTOR = "text.ts-bkm-sunburst-label";

// Nothing to cancel: labels enter through the renderer.
const cancelLabelAnimations = (animations: readonly Animation[]): void => {
  for (const animation of animations) {
    try {
      animation.cancel();
    } catch {
      // Teardown race, already cancelled.
    }
  }
};

// Clears inline opacity on every connected label text once settled.
const clearLabelTextOpacity = (texts: readonly SVGTextElement[]): void => {
  for (const text of texts) {
    if (text.isConnected) {text.style.opacity = "";}
  }
};

// Starts one label reveal cycle: labels stay at final opacity.
// Stamp still records the settled pass for replays.
const startLabelReveal = (
  svg: SVGSVGElement,
  _delayMs: number,
  _durationMs: number,
): (() => void) => {
  svg.dataset.bkmLabelsRevealed = "1";
  clearLabelTextOpacity([...svg.querySelectorAll<SVGTextElement>(SUNBURST_LABEL_TEXT_SELECTOR)]);
  const revealedAnimations: Animation[] = [];
  return (): void => {
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
