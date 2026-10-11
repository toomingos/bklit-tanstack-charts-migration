import { PUSH_CSS, PUSH_TRANSITION } from "./push";
import { SECTOR_GROW_CSS } from "./intro";
import { LABEL_CSS } from "./labels";
import { DIM_TRANSITION_MS } from "./selectors";
import { HUB_FOCUS_CSS } from "./hub";
import { SECTOR_DIM_CSS } from "./hover-grow";
import { ZOOM_SNAP_CSS } from "./zoom";

// Fixed rule text (one rule per arc index where it is per sector); each part owns its rules, the order here is the cascade.
export const SUNBURST_CSS = `g.bk-sb-pops path{transition:opacity ${DIM_TRANSITION_MS}ms ease-out,${PUSH_TRANSITION}}g.bk-sb-mark path{transition:opacity ${DIM_TRANSITION_MS}ms ease-out,${PUSH_TRANSITION}}.bk-sunburst-branch{cursor:pointer;pointer-events:auto}.bk-sunburst-hub,.bk-sunburst-hub path{cursor:pointer;pointer-events:auto}${LABEL_CSS}${SECTOR_DIM_CSS}${SECTOR_GROW_CSS}${PUSH_CSS}${ZOOM_SNAP_CSS}${HUB_FOCUS_CSS}`;
