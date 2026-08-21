"use client";

import * as React from "react";

const FAN_RADIUS = 50;
const FAN_ANGLE = 160;

export interface ChartMarker {
  date: Date;
  icon: React.ReactNode;
  title: string;
  description?: string;
  content?: React.ReactNode;
  color?: string;
  onClick?: () => void;
  href?: string;
  target?: "_blank" | "_self";
}

export interface ChartMarkersProps {
  items: ChartMarker[];
  size?: number;
  showLines?: boolean;
  animate?: boolean;
  maxFanned?: number;
  xScale: ((d: Date) => number | null | undefined) | null;
  marginLeft: number;
  marginTop: number;
  innerHeight: number;
  containerRef: React.RefObject<HTMLElement | null>;
  animationDuration: number;
  onMarkerHoverChange?: (entered: boolean) => void;
}

function getCirclePosition(index: number, total: number) {
  const startAngle = -90 - FAN_ANGLE / 2;
  const angleStep = total > 1 ? FAN_ANGLE / (total - 1) : 0;
  const angle = startAngle + index * angleStep;
  const radians = (angle * Math.PI) / 180;
  return { x: Math.cos(radians) * FAN_RADIUS, y: Math.sin(radians) * FAN_RADIUS };
}

function MarkerCircleHtml({
  icon,
  size,
  color,
  onClick,
  href,
  target = "_self",
  borderColor,
  borderWidth = 1.5,
}: {
  icon: React.ReactNode;
  size: number;
  color?: string;
  onClick?: () => void;
  href?: string;
  target?: "_blank" | "_self";
  borderColor?: string;
  borderWidth?: number;
}) {
  const hasAction = Boolean(onClick || href);
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick();
    else if (href) {
      if (target === "_blank") window.open(href, "_blank", "noopener,noreferrer");
      else window.location.href = href;
    }
  };
  return (
    <div
      onClick={hasAction ? handleClick : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color || "var(--chart-marker-background)",
        border: `${borderWidth}px solid ${borderColor ?? "var(--chart-marker-border)"}`,
        color: "var(--chart-marker-foreground)",
        fontSize: size * 0.5,
        overflow: "hidden",
        cursor: hasAction ? "pointer" : undefined,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        transition: "transform 150ms ease-out",
      }}
      onMouseEnter={(e) => {
        if (hasAction) (e.currentTarget as HTMLDivElement).style.transform = "scale(1.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
      }}
    >
      {icon}
    </div>
  );
}

function Badge({ count, size }: { count: number; size: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: size / 2 + 2,
        top: -size / 2 - 2,
        width: 18,
        height: 18,
        borderRadius: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--chart-marker-badge-background)",
        color: "var(--chart-marker-badge-foreground)",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        pointerEvents: "none",
      }}
    >
      {count}
    </div>
  );
}

interface Bucket {
  key: string;
  markers: ChartMarker[];
  date: Date;
}

function MarkerGroupView({
  bucket,
  x,
  y,
  size,
  showLine,
  lineHeight,
  animate,
  delayMs,
  maxFanned,
  onMarkerHoverChange,
}: {
  bucket: Bucket;
  x: number;
  y: number;
  size: number;
  showLine: boolean;
  lineHeight: number;
  animate: boolean;
  delayMs: number;
  maxFanned?: number;
  onMarkerHoverChange?: (entered: boolean) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const markers = bucket.markers;
  const hasMultiple = markers.length > 1;
  const fanned = maxFanned === undefined ? markers : markers.slice(0, maxFanned);
  // D229 initiative-10 QA hook: window.__qaSetMarkerFan forces every
  // multi-marker group open without a real pointer hover, so screenshot.mjs
  // can capture the fan geometry deterministically. Checked at every render
  // (not just mount) so it also takes effect if set after initial mount;
  // single boolean-typeof + property read, so it's zero-cost when unset.
  const forcedFan = typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__qaSetMarkerFan === true;
  const shouldFan = (hovered || forcedFan) && hasMultiple;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [revealed, setRevealed] = React.useState(!animate || reduced);
  const enterRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!animate || reduced) { setRevealed(true); return; }
    const id = window.setTimeout(() => setRevealed(true), delayMs);
    return () => window.clearTimeout(id);
  }, [animate, reduced, delayMs]);

  const onEnter = React.useCallback(() => {
    setHovered(true);
    onMarkerHoverChange?.(true);
  }, [onMarkerHoverChange]);
  const onLeave = React.useCallback(() => {
    setHovered(false);
    onMarkerHoverChange?.(false);
  }, [onMarkerHoverChange]);

  const collapsedOpacity = shouldFan ? 0 : 1;
  const collapsedScale = shouldFan ? 0.6 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {showLine && lineHeight > 0 ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: size / 2 + 4,
            width: 1,
            height: lineHeight + Math.abs(y),
            borderLeft: "1px dashed var(--chart-marker-border)",
            opacity: hovered ? 1 : 0.6,
            transition: "opacity 150ms ease-out",
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div
        ref={enterRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{
          position: "absolute",
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          pointerEvents: "auto",
          cursor: "pointer",
          opacity: revealed ? collapsedOpacity : 0,
          transform: `scale(${revealed ? collapsedScale : 0.85})`,
          filter: revealed ? (shouldFan ? "blur(2px)" : "blur(0px)") : "blur(2px)",
          transition: revealed
            ? "opacity 220ms ease-out, transform 220ms ease-out, filter 220ms ease-out"
            : "none",
          transformOrigin: "center center",
        }}
      >
        <div style={{ position: "relative", width: size, height: size }}>
          <MarkerCircleHtml icon={markers[0]!.icon} size={size} color={markers[0]!.color} onClick={markers[0]!.onClick} href={markers[0]!.href} target={markers[0]!.target} />
          {hasMultiple && !shouldFan ? <Badge count={markers.length} size={size} /> : null}
        </div>
      </div>
      {shouldFan ? (
        <div
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          style={{
            position: "absolute",
            left: -(FAN_RADIUS + size / 2),
            top: -(FAN_RADIUS + size / 2),
            width: FAN_RADIUS * 2 + size,
            height: FAN_RADIUS * 2 + size,
            pointerEvents: "auto",
          }}
        >
          <div style={{ position: "absolute", left: FAN_RADIUS + size / 2, top: FAN_RADIUS + size / 2, width: 0, height: 0, overflow: "visible" }}>
            <div
              style={{
                position: "absolute",
                left: -size * 0.25,
                top: -size * 0.25,
                width: size * 0.5,
                height: size * 0.5,
                borderRadius: 9999,
                backgroundColor: "var(--chart-marker-border)",
                opacity: 0.5,
                pointerEvents: "none",
              }}
            />
            {fanned.map((m, i) => {
              const pos = getCirclePosition(i, fanned.length);
              return (
                <div
                  key={`${bucket.key}-${m.title}-${i}`}
                  style={{
                    position: "absolute",
                    left: pos.x - size / 2,
                    top: pos.y - size / 2,
                    width: size,
                    height: size,
                    transition: reduced ? undefined : `transform 220ms ease-out ${i * 40}ms, opacity 220ms ease-out ${i * 40}ms`,
                  }}
                >
                  <MarkerCircleHtml icon={m.icon} size={size} color={m.color} onClick={m.onClick} href={m.href} target={m.target} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ChartMarkersOverlay(props: ChartMarkersProps) {
  const { items, size = 28, showLines = true, animate = true, maxFanned, xScale, marginLeft, marginTop, innerHeight, animationDuration } = props;
  const buckets = React.useMemo<Bucket[]>(() => {
    const map = new Map<string, Bucket>();
    for (const m of items ?? []) {
      const k = m.date.toDateString();
      const b = map.get(k);
      if (b) b.markers.push(m);
      else map.set(k, { key: k, markers: [m], date: m.date });
    }
    return Array.from(map.values());
  }, [items]);

  const markerY = -8;
  const baseDelaySec = animationDuration / 1000;

  const { onMarkerHoverChange } = props;
  const handleHoverChange = React.useCallback((entered: boolean) => {
    onMarkerHoverChange?.(entered);
  }, [onMarkerHoverChange]);

  if (!items || items.length === 0 || !xScale) return null;

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      {/* Contract (matches bklit's ChartMarkers/MarkerGroup): `xScale`
          returns INNER-relative (0..innerWidth) coordinates, and this
          overlay adds marginLeft/marginTop itself — same as bklit's portal
          positioning (`portalX = x + marginLeft`). area-chart.tsx's
          areaXScaleD3Ref already honors this (range [0, innerWidthArea]).
          Callers must pass an inner-relative scale — see line-chart.tsx's
          fix, which un-does its xScaleD3Ref's absolute (margin-baked)
          range before handing it to this component. */}
      <div style={{ position: "absolute", left: marginLeft, top: marginTop, width: 0, height: 0, overflow: "visible" }}>
        {buckets.map((bucket, idx) => {
          const x = xScale(bucket.date);
          if (x == null || !Number.isFinite(x)) return null;
          const delayMs = animate ? (baseDelaySec + idx * 0.1) * 1000 : 0;
          return (
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
              onMarkerHoverChange={handleHoverChange}
            />
          );
        })}
      </div>
    </div>
  );
}
