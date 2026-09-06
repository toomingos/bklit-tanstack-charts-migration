// Reveal-root resolution and stamp helpers for the reveal hooks.
// Read/stamp split is deliberate: callers stamp only on one branch; stamping on read would mis-mark charts that skip.

/** Reveal-root element. `SVGElement`, not just `HTMLElement`: marks groups and svg roots fail `instanceof HTMLElement`. */
type RevealRoot = HTMLElement | SVGElement;


/**
 * True if `element` already carries the reveal stamp.
 *
 * @param {RevealRoot | null | undefined} element - Candidate reveal root; `null`/`undefined`
 *   means no element was resolved, which counts as not revealed.
 * @returns {boolean} Whether the `bkmRevealed` dataset stamp is present.
 */
const isRevealed = (element: RevealRoot | null | undefined): boolean => element?.dataset.bkmRevealed === "1";


/**
 * Stamps the reveal marker so later passes skip this element; a no-op for missing elements.
 *
 * @param {RevealRoot | null | undefined} element - Reveal root to stamp; `null`/`undefined` is ignored.
 */
const markRevealed = (element: RevealRoot | null | undefined): void => {
  if (element) {element.dataset.bkmRevealed = "1";}
}

/**
 * Resolves the stamped element. Defaults to the marks group; svg-root selector for sunburst/choropleth/ring.
 *
 * @param {HTMLElement} container - Chart container to search within; never the element returned.
 * @param {string} [selector] - CSS selector for the reveal root, defaulting to the marks group.
 * @returns {RevealRoot | null} The resolved reveal root, or `null` when no element matches.
 */
const findRevealRoot = (container: HTMLElement, selector = ".ts-chart__marks"): RevealRoot | null => container.querySelector<RevealRoot>(selector);

export { findRevealRoot, isRevealed, markRevealed };
export type { RevealRoot };
