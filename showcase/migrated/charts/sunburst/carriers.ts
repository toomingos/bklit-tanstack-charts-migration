import { Children, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { displayNameOf } from "../kit/read-children";

/** Props of `SunburstSegment`. */
export interface SunburstSegmentProps {
  /** Arc index to customize, from the `arcs` array returned by `buildArcs`. */
  index: number;
  /** Color override for this segment. */
  color?: string;
  /** Plain fill color override. Patterns and gradients are not supported. */
  fill?: string;
  /** Fill opacity override (0 to 1).
   * @default 1 for the innermost visible ring, then fading with depth down to 0.45 */
  fillOpacity?: number;
}

/** Props of `SunburstCenter`. */
export interface SunburstCenterProps {
  /** Accepted for bklit compatibility; it has no effect. */
  className?: string;
}

/** Props of `SunburstLabels`. */
export interface SunburstLabelsProps {
  /**
   * Label font size in pixels.
   * @default 11
   */
  fontSize?: number;
  /**
   * Label text color.
   * @default "var(--chart-label)"
   */
  fill?: string;
  /**
   * Color of the halo behind the label text.
   * @default "var(--chart-background)"
   */
  stroke?: string;
  /**
   * Width in pixels of the halo behind the label text. Use `0` to disable it.
   * @default 2.5
   */
  strokeWidth?: number;
  /** Accepted for bklit compatibility; it has no effect. */
  className?: string;
}

// Carriers: rendered nowhere, read by SunburstChart through displayName.
/** Customizes the color, fill or opacity of one segment. Renders nothing itself; `SunburstChart` reads its props. */
export const SunburstSegment = (_props: Readonly<SunburstSegmentProps>): null => null;
SunburstSegment.displayName = "SunburstSegment";
/** Enables the center hub: after zooming in, click it (or press Enter on it) to zoom back out. Renders nothing itself; `SunburstChart` reads its presence. */
export const SunburstCenter = (_props: Readonly<SunburstCenterProps>): null => null;
SunburstCenter.displayName = "SunburstCenter";
/** Shows the segment names at the segment centers, fading in once the enter sweep has played. Renders nothing itself; `SunburstChart` reads its props. */
export const SunburstLabels = (_props: Readonly<SunburstLabelsProps>): null => null;
SunburstLabels.displayName = "SunburstLabels";

interface ParsedChildren {
  readonly segments: ReadonlyMap<number, SunburstSegmentProps>;
  readonly hasCenter: boolean;
  readonly labels: SunburstLabelsProps | null;
  readonly breadcrumbs: ReactElement[];
  readonly hints: ReactElement[];
}

export const parseChildren = (children: ReactNode): ParsedChildren => {
  const segments = new Map<number, SunburstSegmentProps>();
  const breadcrumbs: ReactElement[] = [];
  const hints: ReactElement[] = [];
  let hasCenter = false;
  let labels: SunburstLabelsProps | null = null;
  for (const child of Children.toArray(children)) {
    // The carrier's displayName selects which props shape the child holds.
    switch (isValidElement(child) ? (displayNameOf(child.type) ?? "") : "") {
      case "SunburstSegment": {
        if (isValidElement<SunburstSegmentProps>(child)) {
          segments.set(child.props.index, child.props);
        }
        break;
      }
      case "SunburstCenter": {
        hasCenter = true;
        break;
      }
      case "SunburstLabels": {
        if (isValidElement<SunburstLabelsProps>(child)) {
          labels = child.props;
        }
        break;
      }
      case "SunburstBreadcrumb": {
        if (isValidElement(child)) {
          breadcrumbs.push(child);
        }
        break;
      }
      case "SunburstHint": {
        if (isValidElement(child)) {
          hints.push(child);
        }
        break;
      }
      default: {
        break;
      }
    }
  }
  return { breadcrumbs, hasCenter, hints, labels, segments };
};
