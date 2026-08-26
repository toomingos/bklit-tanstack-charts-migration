// P5.2 T-E1b — public Tooltip* / DateTicker component ports (bklit
// tooltip/*). These are thin React adapters over the SAME primitives the
// imperative hover-chrome path uses (internal/tooltip-chrome.ts builders +
// internal/spring.ts clock-time springs); no framer-motion. Legacy sources:
// repos/bklit-ui/packages/ui/src/charts/tooltip/{tooltip-dot,
// tooltip-indicator,tooltip-box,tooltip-content,date-ticker}.tsx.
import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { createSpring, type Spring } from "./spring";
import { ENTRANCE_SPRING, TICKER_ITEM_HEIGHT } from "./design-tokens";
import { useChartConfig, type SpringConfig } from "./chart-config-context";
import { intFmt } from "./formatters";
import {
  indicatorFadeGradientStops,
  resolveVerticalFadeSides,
  type IndicatorFadeEdges,
} from "./fade-mask";
import { resolveIndicatorPixelWidth } from "./tooltip-chrome";
import type { IndicatorWidth, TooltipRow } from "./types";

// ── TooltipDot ───────────────────────────────────────────────────────────

export interface TooltipDotProps {
  x: number;
  y: number;
  visible: boolean;
  color: string;
  /** Half of width/height for dots; half-extent for ring squares. Default: 5 */
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
  /** Dot fill or transparent ring around the hovered mark. Default: "dot" */
  variant?: "dot" | "ring";
  /**
   * Ring corner radius as a fraction of side length (0 = square, 0.5 = circle).
   * Same semantics as bar square radius.
   */
  cornerRadiusFraction?: number;
  /** Per-chart override; falls back to `ChartConfigProvider.tooltipSpring`. */
  springConfig?: SpringConfig;
  /** Animate position with a spring. Default: true */
  animate?: boolean;
}

function ringCornerRadius(halfExtent: number, cornerRadiusFraction: number): number {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(0.5, cornerRadiusFraction));
}

export function TooltipDot({
  x,
  y,
  visible,
  color,
  size = 5,
  strokeColor = "var(--chart-background)",
  strokeWidth = 2,
  variant = "dot",
  cornerRadiusFraction = 0.25,
  springConfig,
  animate = true,
}: TooltipDotProps) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const isRing = variant === "ring";
  const fill = isRing ? "transparent" : color;
  const stroke = isRing ? color : strokeColor;
  const effectiveStrokeWidth =
    strokeWidth ?? (isRing ? 1.5 : 2);

  const circleRef = useRef<SVGCircleElement | null>(null);
  const rectRef = useRef<SVGRectElement | null>(null);
  const springXRef = useRef<Spring | null>(null);
  const springYRef = useRef<Spring | null>(null);

  const side = size * 2;
  const rx = ringCornerRadius(size, cornerRadiusFraction);

  const ensureSprings = useCallback(() => {
    if (!animate) return;
    if (!springXRef.current) {
      springXRef.current = createSpring(x, effectiveSpring.stiffness, effectiveSpring.damping, (nx) => {
        if (circleRef.current) circleRef.current.setAttribute("cx", String(nx));
        if (rectRef.current) rectRef.current.setAttribute("x", String(nx - size));
      });
    }
    if (!springYRef.current) {
      springYRef.current = createSpring(y, effectiveSpring.stiffness, effectiveSpring.damping, (ny) => {
        if (circleRef.current) circleRef.current.setAttribute("cy", String(ny));
        if (rectRef.current) rectRef.current.setAttribute("y", String(ny - size));
      });
    }
  }, [animate, effectiveSpring, size, x, y]);

  // Retarget per render (same call-shape as framer's animatedX.set(x)).
  if (animate && visible && springXRef.current && springYRef.current) {
    springXRef.current.set(x);
    springYRef.current.set(y);
  }

  // Mount + retarget. Springs own the animated attributes exclusively (React
  // must not fight them via JSX), so initial position is written pre-paint.
  useLayoutEffect(() => {
    if (!animate || !visible) return;
    ensureSprings();
    // Fresh mount snaps into place (tooltip-chrome updateDotPosition parity).
    springXRef.current?.jump(x);
    springYRef.current?.jump(y);
    return () => {
      springXRef.current?.stop();
      springYRef.current?.stop();
      springXRef.current = null;
      springYRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) {
    return null;
  }

  const commonCircle = {
    r: size,
    fill,
    stroke,
    strokeWidth: effectiveStrokeWidth,
  };

  if (isRing) {
    if (animate) {
      return (
        <rect
          ref={rectRef}
          height={side}
          rx={rx}
          ry={rx}
          width={side}
        />
      );
    }
    return (
      <rect
        height={side}
        rx={rx}
        ry={rx}
        width={side}
        x={x - size}
        y={y - size}
        fill={fill}
        stroke={stroke}
        strokeWidth={effectiveStrokeWidth}
      />
    );
  }

  if (animate) {
    return <circle ref={circleRef} {...commonCircle} />;
  }
  return <circle cx={x} cy={y} {...commonCircle} />;
}

// ── TooltipIndicator (crosshair) ─────────────────────────────────────────

export interface TooltipIndicatorProps {
  /** X position in pixels (center of the indicator) */
  x: number;
  /** Height of the indicator */
  height: number;
  /** Whether the indicator is visible */
  visible: boolean;
  /**
   * Width of the indicator - number (pixels) or preset.
   * Ignored if `span` is provided.
   */
  width?: IndicatorWidth;
  /**
   * Number of columns/days to span, with current point centered.
   * Requires `columnWidth` to be set.
   */
  span?: number;
  /** Width of a single column/day in pixels. Required when using `span`. */
  columnWidth?: number;
  /** Primary color at edges (10% and 90%) */
  colorEdge?: string;
  /** Secondary color at center (50%) */
  colorMid?: string;
  /** Vertical fade: both ends, top, bottom, or none (solid). */
  fadeEdges?: IndicatorFadeEdges | boolean;
  /** Fade zone size as a percentage of indicator height. Default: 10 */
  fadeLength?: number;
  /** Animate position with a spring. Default: true */
  animate?: boolean;
  /** Unique ID for the gradient */
  gradientId?: string;
  /** Per-chart override; falls back to `ChartConfigProvider.tooltipSpring`. */
  springConfig?: SpringConfig;
  /** SVG stroke dash pattern. When set, renders a dashed stroke instead of a solid fill. */
  strokeDasharray?: string;
}

// Inner-only-on-visible so the spring initializes at the real cursor x
// instead of 0 on first hover.
export function TooltipIndicator(props: TooltipIndicatorProps) {
  if (!props.visible) {
    return null;
  }
  return <TooltipIndicatorInner {...props} />;
}

function TooltipIndicatorInner({
  x,
  height,
  width = "line",
  span,
  columnWidth,
  colorEdge = "var(--chart-crosshair)",
  colorMid = "var(--chart-crosshair)",
  fadeEdges = "both",
  fadeLength = 10,
  animate = true,
  gradientId = "tooltip-indicator-gradient",
  springConfig,
  strokeDasharray,
}: Omit<TooltipIndicatorProps, "visible">) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;

  const pixelWidth = resolveIndicatorPixelWidth({ width, span, columnWidth });

  const rectX = x - pixelWidth / 2;
  const lineX = x;

  const rectRef = useRef<SVGRectElement | null>(null);
  const lineRef = useRef<SVGLineElement | null>(null);
  const rectSpringRef = useRef<Spring | null>(null);
  const lineSpringRef = useRef<Spring | null>(null);

  const ensureSprings = useCallback(() => {
    if (!animate) return;
    if (!rectSpringRef.current) {
      rectSpringRef.current = createSpring(rectX, effectiveSpring.stiffness, effectiveSpring.damping, (nx) => {
        rectRef.current?.setAttribute("x", String(nx));
      });
    }
    if (!lineSpringRef.current) {
      lineSpringRef.current = createSpring(lineX, effectiveSpring.stiffness, effectiveSpring.damping, (nx) => {
        lineRef.current?.setAttribute("x1", String(nx));
        lineRef.current?.setAttribute("x2", String(nx));
      });
    }
  }, [animate, effectiveSpring, lineX, rectX]);

  if (animate && rectSpringRef.current && lineSpringRef.current) {
    rectSpringRef.current.set(rectX);
    lineSpringRef.current.set(lineX);
  }

  useLayoutEffect(() => {
    if (!animate) return;
    ensureSprings();
    rectSpringRef.current?.jump(rectX);
    lineSpringRef.current?.jump(lineX);
  });

  const indicatorFill = colorMid || colorEdge;
  const fadeSides = resolveVerticalFadeSides(fadeEdges);
  const dashed = Boolean(strokeDasharray);

  if (dashed) {
    const strokeWidth = Math.max(1, pixelWidth);
    if (animate) {
      return (
        <line
          ref={lineRef}
          stroke={indicatorFill}
          strokeDasharray={strokeDasharray}
          strokeWidth={strokeWidth}
          y1={0}
          y2={height}
        />
      );
    }
    return (
      <line
        stroke={indicatorFill}
        strokeDasharray={strokeDasharray}
        strokeWidth={strokeWidth}
        x1={lineX}
        x2={lineX}
        y1={0}
        y2={height}
      />
    );
  }

  if (!fadeSides.any) {
    if (animate) {
      return (
        <rect
          ref={rectRef}
          fill={indicatorFill}
          height={height}
          width={pixelWidth}
          y={0}
        />
      );
    }
    return (
      <rect
        fill={indicatorFill}
        height={height}
        width={pixelWidth}
        x={rectX}
        y={0}
      />
    );
  }

  const fadeStops = indicatorFadeGradientStops(fadeSides, fadeLength);

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
          {fadeStops.map((stop) => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              style={{ stopColor: indicatorFill, stopOpacity: stop.opacity }}
            />
          ))}
        </linearGradient>
      </defs>
      <rect
        ref={animate ? rectRef : undefined}
        fill={`url(#${gradientId})`}
        height={height}
        width={pixelWidth}
        x={animate ? undefined : rectX}
        y={0}
      />
    </g>
  );
}

// ── TooltipBox (floating panel) ──────────────────────────────────────────

export interface TooltipBoxProps {
  /** X position in pixels (relative to container) */
  x: number;
  /** Y position in pixels (relative to container) */
  y: number;
  /** Whether the tooltip is visible */
  visible: boolean;
  /** Container ref for portal rendering */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Container width for flip detection */
  containerWidth: number;
  /** Container height for bounds clamping */
  containerHeight: number;
  /** Offset from the target position */
  offset?: number;
  /** Custom class name */
  className?: string;
  /** Tooltip content */
  children: ReactNode;
  /** Override left position (bypasses internal calculation) */
  left?: number;
  /** Override top position (bypasses internal calculation) */
  top?: number;
  /** Force flip direction (for custom positioning) */
  flipped?: boolean;
  /** Per-chart override; falls back to `ChartConfigProvider.tooltipBoxSpring`. */
  springConfig?: SpringConfig;
  /** Animate panel position with a spring. Default: true */
  animate?: boolean;
  /** Fade/scale the panel on show. Default: true */
  entrance?: boolean;
  /** Inline styles for the inner tooltip panel. */
  panelStyle?: CSSProperties;
  /**
   * Tooltip panel background color (CSS variable or color value).
   * Default: `var(--chart-tooltip-background)`.
   */
  backgroundColor?: string;
}

const BOX_FALLBACK_WIDTH = 180;
const BOX_FALLBACK_HEIGHT = 80;

// Inner-only-on-visible so springs initialize at the cursor's actual x/y
// instead of (0, 0) on first hover.
export function TooltipBox(props: TooltipBoxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = props.containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  if (!props.visible) {
    return null;
  }
  return <TooltipBoxInner {...props} container={container} />;
}

function TooltipBoxInner({
  x,
  y,
  containerWidth,
  containerHeight,
  offset = 16,
  className = "",
  children,
  left: leftOverride,
  top: topOverride,
  flipped: flippedOverride,
  springConfig,
  animate = true,
  entrance = true,
  panelStyle,
  backgroundColor = "var(--chart-tooltip-background)",
  container,
}: Omit<TooltipBoxProps, "visible" | "containerRef"> & {
  container: HTMLElement;
}) {
  const { tooltipBoxSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipBoxSpring;

  const layerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tooltipWidthRef = useRef(BOX_FALLBACK_WIDTH);
  const tooltipHeightRef = useRef(BOX_FALLBACK_HEIGHT);
  const [staticPosition, setStaticPosition] = useState({ left: x, top: y });
  const prevFlipRef = useRef<boolean | null>(null);
  const leftSpringRef = useRef<Spring | null>(null);
  const topSpringRef = useRef<Spring | null>(null);
  const entranceSpringRef = useRef<Spring | null>(null);

  const tw = tooltipWidthRef.current;
  const th = tooltipHeightRef.current;
  const shouldFlipX = x + tw + offset > containerWidth;
  const targetX = leftOverride !== undefined ? leftOverride : shouldFlipX ? x - offset - tw : x + offset;
  const targetY = topOverride !== undefined ? topOverride : Math.max(offset, Math.min(y - th / 2, containerHeight - th - offset));

  const runEntrance = useCallback((flipped: boolean) => {
    const panel = panelRef.current;
    if (!panel || !entrance) return;
    if (!entranceSpringRef.current) {
      entranceSpringRef.current = createSpring(
        0,
        ENTRANCE_SPRING.stiffness,
        ENTRANCE_SPRING.damping,
        (p) => {
          if (!panelRef.current) return;
          const from = flipped ? 20 : -20;
          panelRef.current.style.transformOrigin = flipped ? "right top" : "left top";
          panelRef.current.style.transform = `translateX(${from * (1 - p)}px) scale(${0.85 + 0.15 * p})`;
          panelRef.current.style.opacity = String(p);
        },
      );
    }
    entranceSpringRef.current.jump(0);
    entranceSpringRef.current.set(1);
  }, [entrance]);

  const ensurePositionSprings = useCallback(() => {
    if (!animate) return;
    if (!leftSpringRef.current) {
      leftSpringRef.current = createSpring(targetX, effectiveSpring.stiffness, effectiveSpring.damping, (l) => {
        if (layerRef.current) layerRef.current.style.left = `${l}px`;
      });
    }
    if (!topSpringRef.current) {
      topSpringRef.current = createSpring(targetY, effectiveSpring.stiffness, effectiveSpring.damping, (t) => {
        if (layerRef.current) layerRef.current.style.top = `${t}px`;
      });
    }
  }, [animate, effectiveSpring, targetX, targetY]);

  // Measure + reposition after content/layout changes (flip detection).
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (el) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0) tooltipWidthRef.current = w;
      if (h > 0) tooltipHeightRef.current = h;
    }
    const w2 = tooltipWidthRef.current;
    const h2 = tooltipHeightRef.current;
    const flip = leftOverride !== undefined ? (flippedOverride ?? false) : x + w2 + offset > containerWidth;
    const tx = leftOverride !== undefined ? leftOverride : flip ? x - offset - w2 : x + offset;
    const ty = topOverride !== undefined ? topOverride : Math.max(offset, Math.min(y - h2 / 2, containerHeight - h2 - offset));

    const prevFlip = prevFlipRef.current;
    prevFlipRef.current = flip;

    if (!animate) {
      setStaticPosition({ left: tx, top: ty });
      return;
    }
    ensurePositionSprings();
    leftSpringRef.current?.jump(tx);
    topSpringRef.current?.jump(ty);
    if (entrance && (prevFlip === null || flip !== prevFlip)) {
      runEntrance(flip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    x,
    y,
    containerWidth,
    containerHeight,
    offset,
    leftOverride,
    topOverride,
    flippedOverride,
    animate,
    entrance,
    children,
  ]);

  // Mount animation: 100ms opacity fade (positionBox boxFade parity).
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !entrance) return;
    const fade = layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, fill: "both" });
    return () => fade.cancel();
  }, [entrance]);

  useEffect(() => {
    if (!animate) return;
    ensurePositionSprings();
    leftSpringRef.current?.set(targetX);
    topSpringRef.current?.set(targetY);
  });

  const isFlipped = flippedOverride ?? shouldFlipX;

  const panelStyleResolved: CSSProperties = {
    transformOrigin: isFlipped ? "right top" : "left top",
    ...(backgroundColor ? { backgroundColor } : {}),
    ...panelStyle,
  };

  return createPortal(
    <div
      className={`bkm-tooltip-layer${className ? ` ${className}` : ""}`}
      ref={layerRef}
      style={{ left: staticPosition.left, top: staticPosition.top }}
    >
      <div className="bkm-tooltip-panel" ref={panelRef} style={panelStyleResolved}>
        {children}
      </div>
    </div>,
    container,
  );
}

// ── TooltipContent ───────────────────────────────────────────────────────

// `TooltipRow` is owned by `./types` (P4 dedup) and imported at the top of this
// file; a byte-identical third copy used to be declared here.
export interface TooltipContentProps {
  title?: string;
  rows: TooltipRow[];
  /** Optional additional content (e.g., markers) */
  children?: ReactNode;
}

export function TooltipContent({ title, rows, children }: TooltipContentProps) {
  return (
    <div className="overflow-hidden">
      <div className="px-3 py-2.5">
        {title && (
          <div className="mb-2 text-left font-medium text-chart-tooltip-foreground text-xs">
            {title}
          </div>
        )}
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              className="flex items-center justify-between gap-4"
              key={`${row.label}-${row.color}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-chart-tooltip-muted text-sm">
                  {row.label}
                </span>
              </div>
              <span className="font-medium text-chart-tooltip-foreground text-sm tabular-nums">
                {typeof row.value === "number" ? intFmt(row.value) : row.value}
              </span>
            </div>
          ))}
        </div>

        {children && (
          <div className="mt-2 transition-opacity duration-200 ease-out">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DateTicker ───────────────────────────────────────────────────────────

export interface DateTickerProps {
  currentIndex: number;
  labels: string[];
  visible: boolean;
}

const COMPACT_TICKER_THRESHOLD = 60;

interface ParsedLabel {
  month: string;
  day: string;
  full: string;
  key: string;
}

interface MonthSegment {
  month: string;
  key: string;
  startIndex: number;
}

export function DateTicker({ currentIndex, labels, visible }: DateTickerProps) {
  const compact = useMemo(
    () => visible && labels.length > COMPACT_TICKER_THRESHOLD,
    [visible, labels.length],
  );

  const parsedLabels = useMemo<ParsedLabel[]>(() => {
    return labels.map((label, index) => {
      const parts = label.split(" ");
      const month = parts[0] || "";
      const day = parts[1] || "";
      return { month, day, full: label, key: `${label}::${index}` };
    });
  }, [labels]);

  const monthSegments = useMemo<MonthSegment[]>(() => {
    const segments: MonthSegment[] = [];
    parsedLabels.forEach((label, index) => {
      const prev = segments.at(-1);
      if (!prev || prev.month !== label.month) {
        segments.push({
          month: label.month,
          key: `${label.month}-${index}`,
          startIndex: index,
        });
      }
    });
    return segments;
  }, [parsedLabels]);

  const currentMonthIndex = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= parsedLabels.length) {
      return 0;
    }
    for (let i = monthSegments.length - 1; i >= 0; i--) {
      const segment = monthSegments[i];
      if (segment && segment.startIndex <= currentIndex) {
        return i;
      }
    }
    return 0;
  }, [currentIndex, parsedLabels.length, monthSegments]);

  const dayStackRef = useRef<HTMLDivElement | null>(null);
  const monthStackRef = useRef<HTMLDivElement | null>(null);
  const daySpringRef = useRef<Spring | null>(null);
  const monthSpringRef = useRef<Spring | null>(null);
  const prevMonthRef = useRef(-1);

  useEffect(() => {
    if (compact) return;
    if (!daySpringRef.current) {
      daySpringRef.current = createSpring(0, 400, 35, (yy) => {
        if (dayStackRef.current) dayStackRef.current.style.transform = `translateY(${yy}px)`;
      });
    }
    if (!monthSpringRef.current) {
      monthSpringRef.current = createSpring(0, 400, 35, (yy) => {
        if (monthStackRef.current) monthStackRef.current.style.transform = `translateY(${yy}px)`;
      });
    }
    return () => {
      daySpringRef.current?.stop();
      monthSpringRef.current?.stop();
      daySpringRef.current = null;
      monthSpringRef.current = null;
    };
  }, [compact]);

  // Day stack follows every index change; month stack only on month change.
  // Both animate via .set() exactly like legacy's framer useSpring(.set).
  useEffect(() => {
    if (compact) return;
    const targetDayY = -currentIndex * TICKER_ITEM_HEIGHT;
    const targetMonthY = -currentMonthIndex * TICKER_ITEM_HEIGHT;
    daySpringRef.current?.set(targetDayY);
    if (prevMonthRef.current === -1 || prevMonthRef.current !== currentMonthIndex) {
      prevMonthRef.current = currentMonthIndex;
      monthSpringRef.current?.set(targetMonthY);
    }
  }, [compact, currentIndex, currentMonthIndex]);

  if (!visible || labels.length === 0) {
    return null;
  }

  const pillClassName =
    "overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900";

  if (compact) {
    const label = labels[currentIndex] ?? labels[0] ?? "";
    return (
      <div className={pillClassName}>
        <div className="flex h-6 items-center justify-center">
          <span className="whitespace-nowrap font-medium text-sm">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={pillClassName}>
      <div className="relative h-6 overflow-hidden">
        <div className="flex items-center justify-center gap-1">
          {/* Month stack */}
          <div className="relative h-6 overflow-hidden">
            <div className="flex flex-col" ref={monthStackRef}>
              {monthSegments.map((segment) => (
                <div
                  className="flex h-6 shrink-0 items-center justify-center"
                  key={segment.key}
                >
                  <span className="whitespace-nowrap font-medium text-sm">
                    {segment.month}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day stack */}
          <div className="relative h-6 overflow-hidden">
            <div className="flex flex-col" ref={dayStackRef}>
              {parsedLabels.map((label) => (
                <div
                  className="flex h-6 shrink-0 items-center justify-center"
                  key={label.key}
                >
                  <span className="whitespace-nowrap font-medium text-sm">
                    {label.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
