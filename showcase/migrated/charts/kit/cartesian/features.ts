// Optional cartesian children register their builders here when the app imports them, so a chart bundles overlays, event markers and the Background pattern only when used.
import type { ReactElement } from "react";
import { userGradients } from "../gradients";
import type { installMarkerSprings } from "../motion/marker-springs";
import type { ChildTable } from "../read-children";
import type { ChartMarker } from "../types";
import type { AnyMark } from "../erased-types";
import type { buildOverlays } from "./overlays";

interface OverlayFeature {
  readonly build: typeof buildOverlays;
  readonly markerLists: (table: ChildTable) => readonly (readonly ChartMarker[])[];
  readonly installSprings: typeof installMarkerSprings;
}

interface BackgroundFeature {
  readonly marks: (table: ChildTable, uid: string) => AnyMark[];
  readonly css: (scope: string, table: ChildTable) => string;
  readonly Resources: (props: Readonly<{ table: ChildTable; uid: string }>) => ReactElement | null;
}

let overlayFeature: OverlayFeature | undefined;
let backgroundFeature: BackgroundFeature | undefined;

export const registerOverlays = (feature: OverlayFeature): void => {
  overlayFeature = feature;
};
export const registerBackground = (feature: BackgroundFeature): void => {
  backgroundFeature = feature;
};

/** The overlay marks and the extents they widen; without the feature, only the user's gradients remain. */
export const overlaysFor = (...args: Parameters<typeof buildOverlays>): ReturnType<typeof buildOverlays> =>
  overlayFeature?.build(...args) ?? { xValues: [], yValues: [], projectionYValues: new Map(), gradients: [...userGradients(args[0])], marks: () => [] };

export const markerListsFor = (table: ChildTable): readonly (readonly ChartMarker[])[] => overlayFeature?.markerLists(table) ?? [];

export const installMarkers = (...args: Parameters<typeof installMarkerSprings>): ReturnType<typeof installMarkerSprings> | undefined => overlayFeature?.installSprings(...args);

export const backgroundMarksFor = (table: ChildTable, uid: string): AnyMark[] => backgroundFeature?.marks(table, uid) ?? [];

export const backgroundCssFor = (scope: string, table: ChildTable): string => backgroundFeature?.css(scope, table) ?? "";

export const getBackgroundResources = (): BackgroundFeature["Resources"] | undefined => backgroundFeature?.Resources;
