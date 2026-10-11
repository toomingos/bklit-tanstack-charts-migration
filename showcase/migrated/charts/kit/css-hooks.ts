/** Wraps `css` in the typed-`attr()` support query: Chromium 133+ only, other browsers skip the rule. */
export const typedAttr = (css: string): string => `@supports (opacity: attr(opacity type(<number>), 1)){${css}}`;
