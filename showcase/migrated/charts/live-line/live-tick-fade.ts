import { NOT_MOTION, typedAttr } from "../kit/css-hooks";

/** `--bkm-fx` (focus x) and `--bkm-pgx` / `--bkm-pgy` (crosshair spring lag, UPSTREAM-GAPS #43) change every pointer move and spring frame, on the host. Inherited, each write restyled 122 elements (0.77 ms);
 * registered `inherits: false` (0.04 ms), they reach their readers (liveline.css) through an explicit `inherit` down the path of documented host/surface and part classes (gap #36) and live-xlabels.ts's class. */
const FOCUS_VARS_CSS =
  '@property --bkm-fx{syntax:"<number>";inherits:false;initial-value:-9999}' +
  '@property --bkm-pgx{syntax:"<number>";inherits:false;initial-value:0}' +
  '@property --bkm-pgy{syntax:"<number>";inherits:false;initial-value:0}' +
  '[data-bkm-chart="liveline"] :is(.ts-chart-host,.ts-chart-surface,svg.ts-chart,.ts-chart__focus-guide-layer,.ts-chart__crosshair,.ts-chart__crosshair-plot,.bkm-live-rule,.ts-chart__crosshair-label--x,.ts-chart__crosshair-marker,.bkm-live-xlabels,text.bkm-live-xlabel){--bkm-fx:inherit;--bkm-pgx:inherit;--bkm-pgy:inherit}';
/** bklit LiveXAxis labelFadeOpacity: 0 within 50px of the crosshair, a linear ramp over the next 20px, 0.15s easeOut; one static rule on the slot's typed `x` vs `--bkm-fx`, inline (the CSS pipeline rewrites `type(<number>)`).
 * Keyboard focus rides the roll via `--bkm-kx` / `--bkm-fxr` / `--bkm-pl` / `--bkm-kslide` (`data-bkm-kedge`). Typed attr() is Chromium-only (133+): under `@supports`, else labels stay visible. */
export const TICK_FADE_CSS = [
  typedAttr(`[data-bkm-chart="liveline"] text.bkm-live-xlabel${NOT_MOTION}{opacity:clamp(0,calc((abs(attr(x type(<number>)) - var(--bkm-fx,-9999)) - 50) / 20),1)!important;transition:opacity 150ms ease-out}`),
  `@property --bkm-fxr{syntax:"<number>";inherits:false;initial-value:0}`,
  `@keyframes bkm-fxr0{from{--bkm-fxr:var(--bkm-live-shift,0)}to{--bkm-fxr:0}}@keyframes bkm-fxr1{from{--bkm-fxr:var(--bkm-live-shift,0)}to{--bkm-fxr:0}}`,
  `[data-bkm-chart="liveline"][data-bkm-roll="0"]{animation:bkm-fxr0 var(--bkm-live-roll,600ms) var(--bkm-live-roll-ease,linear) both}`,
  `[data-bkm-chart="liveline"][data-bkm-roll="1"]{animation:bkm-fxr1 var(--bkm-live-roll,600ms) var(--bkm-live-roll-ease,linear) both}`,
  `[data-bkm-chart="liveline"][data-bkm-kfx]{--bkm-fx:max(var(--bkm-pl,-9999), calc(var(--bkm-kx) + var(--bkm-fxr)))}`,
  `[data-bkm-chart="liveline"][data-bkm-kfx][data-bkm-jump]{--bkm-fx:calc(max(var(--bkm-pl,-9999), var(--bkm-kx)) + var(--bkm-fxr))}`,
  `[data-bkm-chart="liveline"][data-bkm-kfx][data-bkm-jump][data-bkm-kedge]{--bkm-fx:max(var(--bkm-pl,-9999), calc(var(--bkm-kx) + var(--bkm-fxr)))}`,
  FOCUS_VARS_CSS,
].join("");
