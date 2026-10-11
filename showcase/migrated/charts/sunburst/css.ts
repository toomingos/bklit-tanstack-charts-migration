import { pushCss, PUSH_TRANSITION } from "./push";
import { sectorGrowCss } from "./intro";
import { labelCss } from "./labels";
import { DIM_TRANSITION_MS } from "./selectors";
import { HUB_FOCUS_CSS } from "./hub";
import { sectorDimCss } from "./hover-grow";
import { zoomSnapCss } from "./zoom";

// Rule text for `count` arcs (one rule per arc index where it is per sector); each part owns its rules, the order here is the cascade.
export const sunburstCss = (count: number): string => `g.bk-sb-pops path{transition:opacity ${DIM_TRANSITION_MS}ms ease-out,${PUSH_TRANSITION}}g.bk-sb-mark path{transition:opacity ${DIM_TRANSITION_MS}ms ease-out,${PUSH_TRANSITION}}.bk-sunburst-branch{cursor:pointer;pointer-events:auto}.bk-sunburst-hub,.bk-sunburst-hub path{cursor:pointer;pointer-events:auto}${labelCss(count)}${sectorDimCss(count)}${sectorGrowCss(count)}${pushCss(count)}${zoomSnapCss(count)}${HUB_FOCUS_CSS}`;
