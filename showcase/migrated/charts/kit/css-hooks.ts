/** Wraps `css` in the typed-`attr()` support query: Chromium 133+ only, other browsers skip the rule. */
export const typedAttr = (css: string): string => `@supports (opacity: attr(opacity type(<number>), 1)){${css}}`;

/** Skips a node the renderer is mid-tween on; `data-ts-motion-role` is undocumented and has no public hook (UPSTREAM-GAPS #50). */
export const NOT_MOTION = ":not([data-ts-motion-role])";

/** True when the renderer is mid-tween on `el` (UPSTREAM-GAPS #50: the role attribute is undocumented, so this is the single read site). */
export const isMotionNode = (el: Element): boolean => el.hasAttribute("data-ts-motion-role");
