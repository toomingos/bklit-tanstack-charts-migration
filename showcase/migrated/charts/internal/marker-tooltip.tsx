// probe
"use client";

import * as React from "react";
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ChartMarker } from "./types";

// LM7 port of bklit's markers/chart-markers.tsx tooltip surface
// (MarkerTooltipContent + useActiveMarkers): tooltip marker rows with the
// 2-marker cap + "+N more..." overflow, and the tooltip-date lookup.
// bklit sourced the active date from chart-context's tooltipData; the
// migrated imperative hover chrome owns that state instead, so hosts feed
// a shared ActiveMarkersStore (createActiveMarkersStore +
// MarkerActiveTooltipProvider) from their focus handler and consumers
// read it through useActiveMarkers.

const MAX_TOOLTIP_MARKERS = 2;

export interface MarkerTooltipContentProps {
  markers: ChartMarker[];
}

export function MarkerTooltipContent({ markers }: MarkerTooltipContentProps) {
  if (markers.length === 0) {
    return null;
  }

  const visibleMarkers = markers.slice(0, MAX_TOOLTIP_MARKERS);
  const hiddenCount = markers.length - MAX_TOOLTIP_MARKERS;

  return (
    <div
      className="mt-2 space-y-2 pt-2"
      style={{ borderTop: "1px solid var(--chart-tooltip-muted)" }}
    >
      {visibleMarkers.map((marker) => {
        const isClickable = !!(marker.onClick || marker.href);
        const clipStyle = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as React.CSSProperties;
        return (
          <div className="flex items-start gap-2" key={marker.title}>
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: marker.color || "var(--chart-marker-background)",
                border: "1px solid var(--chart-marker-border)",
              }}
            >
              <span
                className="text-xs"
                style={{ color: "var(--chart-marker-foreground)" }}
              >
                {marker.icon}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              {marker.content ? (
                marker.content
              ) : (
                <>
                  <div className="text-sm font-medium" style={{ ...clipStyle, color: "var(--chart-tooltip-foreground)" }}>
                    {marker.title}
                    {isClickable && (
                      <span className="text-[10px]" style={{ color: "var(--chart-tooltip-muted)", paddingLeft: "0.375rem" }}>
                        ↗
                      </span>
                    )}
                  </div>
                  {marker.description && (
                    <div className="text-xs" style={{ ...clipStyle, color: "var(--chart-tooltip-muted)" }}>
                      {marker.description}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <div className="pl-7 text-xs" style={{ color: "var(--chart-tooltip-muted)" }}>
          +{hiddenCount} more...
        </div>
      )}
    </div>
  );
}
MarkerTooltipContent.displayName = "MarkerTooltipContent";

export interface ActiveMarkersStore {
  subscribe(listener: () => void): () => void;
  /** Date of the currently focused tooltip point, null when no focus. */
  getActiveDate(): Date | null;
  setActiveDate(date: Date | null): void;
}

export function createActiveMarkersStore(): ActiveMarkersStore {
  let activeDate: Date | null = null;
  const listeners: (() => void)[] = [];
  return {
    subscribe(listener) {
      listeners.push(listener);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    getActiveDate() {
      return activeDate;
    },
    setActiveDate(date) {
      if (date === activeDate) return;
      activeDate = date;
      for (const listener of [...listeners]) listener();
    },
  };
}

const MarkerActiveContext = createContext<ActiveMarkersStore | null>(null);

/** Mount inside a chart host (LineChart/AreaChart) to make the host's live
    tooltip date available to useActiveMarkers consumers. */
export function MarkerActiveTooltipProvider({
  store,
  children,
}: {
  store: ActiveMarkersStore;
  children: React.ReactNode;
}) {
  return <MarkerActiveContext.Provider value={store}>{children}</MarkerActiveContext.Provider>;
}

const subscribeNoop = () => () => {};

/** Internal: ChartMarkersOverlay reads the live focus date through this so
    LM8's isActive guide-line hiding tracks the imperative hover chrome. */
export function useActiveMarkerDate(): Date | null {
  const store = useContext(MarkerActiveContext);
  return useSyncExternalStore(
    store ? store.subscribe : subscribeNoop,
    store ? store.getActiveDate : () => null,
    () => null,
  );
}

export function useActiveMarkers(items: ChartMarker[]): ChartMarker[] {
  const store = useContext(MarkerActiveContext);
  const activeDate = useSyncExternalStore(
    store ? store.subscribe : subscribeNoop,
    store ? store.getActiveDate : () => null,
    () => null,
  );
  return useMemo(() => {
    if (!activeDate) {
      return [];
    }
    const dateKey = activeDate.toDateString();
    return items.filter((m) => m.date.toDateString() === dateKey);
  }, [items, activeDate]);
}
