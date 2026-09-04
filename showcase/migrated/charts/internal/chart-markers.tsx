"use client";

import { useCallback, useMemo } from "react";
import type { CSSProperties, ReactElement, RefObject } from "react";
import { MarkerGroupView } from "./marker-group-view";
import type { Bucket } from "./marker-group-view";
import { useActiveMarkerDate } from "./active-markers-store";
import { nativeStaggerDelayMs } from "./native-stagger";
import type { ChartMarker } from "./types";

const MS_PER_SECOND = 1000;
// Mirrors native stagger({each}) for the marker enter delay.
const MARKER_STAGGER_EACH_MS = 100;

// Static overlay styles; hoisted so no object is allocated per render.
const MARKERS_OVERLAY_STYLE = { inset: 0, overflow: "visible", pointerEvents: "none", position: "absolute" } as const;

interface ChartMarkersProps {
  readonly items: readonly Readonly<ChartMarker>[];
  readonly size?: number;
  readonly showLines?: boolean;
  readonly animate?: boolean;
  readonly maxFanned?: number;
  readonly xScale: ((date: Date) => number | null | undefined) | null;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly innerHeight: number;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly animationDuration: number;
  /** Fires with the hovered bucket's markers on enter, null on leave; callers use this to suppress the crosshair chrome. */
  readonly onMarkerHoverChange?: (markers: ChartMarker[] | null) => void;
}

interface RenderMarkerBucketOptions {
  readonly bucket: Readonly<Bucket>;
  readonly index: number;
  readonly xScale: (date: Date) => number | null | undefined;
  readonly size: number;
  readonly showLines: boolean;
  readonly innerHeight: number;
  readonly markerY: number;
  readonly animate: boolean;
  readonly baseDelaySec: number;
  readonly maxFanned: number | undefined;
  readonly activeDate: Date | null;
  readonly onHoverChange: (markers: ChartMarker[] | null) => void;
}

const renderMarkerBucket = (options: Readonly<RenderMarkerBucketOptions>): ReactElement[] => {
  const { bucket, index, xScale, size, showLines, innerHeight, markerY, animate, baseDelaySec, maxFanned, activeDate, onHoverChange } = options;
  const x = xScale(bucket.date);
  // A skipped bucket contributes nothing to the rendered list, so the callback
  // Returns an empty array for off-scale dates.
  if (x === null || x === undefined || !Number.isFinite(x)) {return [];}
  const isActive = activeDate
    ? bucket.date.toDateString() === activeDate.toDateString()
    : false;
  // Mirrors native stagger({each: 100, offset: baseDelaySec*1000}).
  const delayMs = animate
    ? nativeStaggerDelayMs(MARKER_STAGGER_EACH_MS, baseDelaySec * MS_PER_SECOND, index, "dot")
    : 0;
  return [
    <MarkerGroupView
      key={bucket.key}
      bucket={bucket}
      x={x}
      y={markerY}
      size={size}
      showLine={showLines}
      lineHeight={innerHeight}
      animate={animate}
      delayMs={delayMs}
      maxFanned={maxFanned}
      isActive={isActive}
      onMarkerHoverChange={onHoverChange}
    />,
  ];
}

const ChartMarkersOverlay = (props: ChartMarkersProps): ReactElement | null => {
  const { items, size = 28, showLines = true, animate = true, maxFanned, xScale, marginLeft, marginTop, innerHeight, animationDuration, onMarkerHoverChange } = props;
  // Outside a MarkerActiveTooltipProvider this store read is a noop -> null -> bucket never "active".
  const activeDate = useActiveMarkerDate();
  const buckets = useMemo<Bucket[]>(() => {
    const map = new Map<string, Bucket>();
    for (const marker of items) {
      const dateKey = marker.date.toDateString();
      const bucket = map.get(dateKey);
      if (bucket) {bucket.markers.push(marker);}
      else {map.set(dateKey, { date: marker.date, key: dateKey, markers: [marker] });}
    }
    return [...map.values()];
  }, [items]);

  const markerY = -8;
  const baseDelaySec = animationDuration / MS_PER_SECOND;

  const innerOverlayStyle = useMemo((): CSSProperties => ({ height: 0, left: marginLeft, overflow: "visible", position: "absolute", top: marginTop, width: 0 }), [marginLeft, marginTop]);

  const handleHoverChange = useCallback((markers: ChartMarker[] | null) => {
    onMarkerHoverChange?.(markers);
  }, [onMarkerHoverChange]);

  if (items.length === 0 || !xScale) {return null;}

  return (
    <div
      aria-hidden="true"
      style={MARKERS_OVERLAY_STYLE}
    >
      {/* XScale must return inner-relative (0..innerWidth) coords; this overlay adds marginLeft/marginTop itself. */}
      <div style={innerOverlayStyle}>
        {buckets.flatMap((bucket, idx) => renderMarkerBucket({ activeDate, animate, baseDelaySec, bucket, index: idx, innerHeight, markerY, maxFanned, onHoverChange: handleHoverChange, showLines, size, xScale }))}
      </div>
    </div>
  );
}

export type { ChartMarkersProps };
export type { ChartMarker } from "./types";
export { ChartMarkersOverlay };
