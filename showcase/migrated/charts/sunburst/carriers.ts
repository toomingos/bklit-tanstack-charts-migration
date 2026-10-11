import { Children, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { displayNameOf } from "../kit/read-children";

export interface SunburstSegmentProps {
  index: number;
  /** Optional color override */
  color?: string;
  /** Optional fill override (plain color) */
  fill?: string;
  /** Optional fill opacity override */
  fillOpacity?: number;
}

export interface SunburstCenterProps {
  className?: string;
}

export interface SunburstLabelsProps {
  fontSize?: number;
  fill?: string;
  /** Halo color behind label glyphs. */
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

// Carriers: rendered nowhere, read by SunburstChart through displayName.
export const SunburstSegment = (_props: Readonly<SunburstSegmentProps>): null => null;
SunburstSegment.displayName = "SunburstSegment";
export const SunburstCenter = (_props: Readonly<SunburstCenterProps>): null => null;
SunburstCenter.displayName = "SunburstCenter";
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
