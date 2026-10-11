// bklit's spring constants, one place. Every value cites the bklit source it reproduces (repos/bklit-ui/packages/ui/src).

export interface Spring { readonly stiffness: number; readonly damping: number; readonly mass: number }

/** Crosshair indicator, tooltip dots, date pill: `tooltipSpring` (charts/chart-config-context.tsx:20; tooltip.tsx:12, charts/live-x-axis.tsx:12). */
export const CROSSHAIR_SPRING: Spring = { damping: 30, mass: 1, stiffness: 300 };

/** Floating tooltip panel: `tooltipBoxSpring` (charts/chart-config-context.tsx:21; tooltip.tsx:9). */
export const TOOLTIP_BOX_SPRING: Spring = { damping: 20, mass: 1, stiffness: 100 };

/** Hover-highlight band (x and width): `highlightSpring` (charts/chart-config-context.tsx:22; use-highlight-segment.ts:44-57); also line-chart.tsx:370's dash offsets. */
export const HIGHLIGHT_SPRING: Spring = { damping: 28, mass: 1, stiffness: 180 };

/** The date ticker's month and day stacks: `useSpring(0, { stiffness: 400, damping: 35 })` (charts/tooltip/date-ticker.tsx:81-82). */
export const DATE_PILL_SPRING: Spring = { damping: 35, mass: 1, stiffness: 400 };

/** Shared hover spring of pie slices, ring arcs and radar series (charts/pie-slice.tsx:163, charts/ring.tsx:185, charts/radar-area.tsx:164). */
export const HOVER_SPRING: Spring = { damping: 25, mass: 1, stiffness: 400 };

/** Live y-axis tick glide and fade (charts/live-y-axis.tsx:89). */
export const LIVE_Y_TICK_SPRING: Spring = { damping: 24, mass: 1, stiffness: 180 };

/** Default notch enter of the gauge (charts/gauge.tsx:31-35). */
export const GAUGE_NOTCH_ENTER_SPRING: Spring = { damping: 20, mass: 1, stiffness: 300 };

/** Notch update morph of the native gauge. bklit has no spring on a notch's update; this value is the migration's own (no bklit source). */
export const GAUGE_NOTCH_UPDATE_SPRING: Spring = { damping: 28, mass: 1, stiffness: 220 };

// ChartMarkers cluster (charts/markers/marker-group.tsx).
/** Body fanned variant {scale .6, opacity 0, blur 2px}, delayed by animationDuration + groupIndex * 100ms (:232-234). */
export const MARKER_BODY_SPRING: Spring = { damping: 25, mass: 1, stiffness: 300 };
/** Badge exit {scale 0, opacity 0} (:265); the fanned centre dot {scale 1, opacity .5} shares it (:382). */
export const MARKER_BADGE_SPRING: Spring = { damping: 20, mass: 1, stiffness: 400 };
/** Fan discs {scale 1, opacity 1}, delayed index * 40ms (:347). */
export const MARKER_ITEM_SPRING: Spring = { damping: 22, mass: 1, stiffness: 400 };
/** Action disc (:505-511): hover scale 1.15 with a lifted shadow, press 0.95, the live velocity kept across states. */
export const MARKER_ACT_SPRING: Spring = { damping: 17, mass: 1, stiffness: 400 };
