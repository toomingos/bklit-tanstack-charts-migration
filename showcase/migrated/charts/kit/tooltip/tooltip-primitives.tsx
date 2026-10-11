// bklit's tooltip building blocks as plain DOM for the native tooltip body; the native tooltip owns positioning, flip, portal and motion.
// The crosshair and focus-dot primitives are config carriers (see tooltip-carriers.ts).
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { intFmt } from "../format";
import { hasText, isNumber } from "../guards";

export interface TooltipRow {
  readonly color: string;
  readonly label: string;
  readonly value: string | number;
}

export interface TooltipContentProps {
  readonly title?: string;
  readonly rows: readonly TooltipRow[];
  /** Additional content below the rows (e.g. markers). */
  readonly children?: ReactNode;
  readonly className?: string;
}

const MUTED = "var(--chart-tooltip-muted, var(--chart-foreground-muted))";

/** bklit's truthiness test on a node: `0`, `""`, `false`, `null` and `undefined` render nothing. */
const hasNode: (node: ReactNode) => boolean = Boolean;

const CONTENT_STYLE: CSSProperties = { minWidth: 140, padding: "10px 12px", fontSize: 14 };
const TITLE_STYLE: CSSProperties = { fontSize: 12, lineHeight: "16px", fontWeight: 500, marginBottom: 8, textAlign: "left" };
const ROWS_STYLE: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const ROW_STYLE: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const ROW_LABEL_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
// bklit `text-sm`: 14px / 20px.
const LABEL_TEXT_STYLE: CSSProperties = { color: MUTED, lineHeight: "20px" };
const VALUE_STYLE: CSSProperties = { fontVariantNumeric: "tabular-nums", fontWeight: 500, lineHeight: "20px" };
const CHILDREN_STYLE: CSSProperties = { marginTop: 8 };

const dotStyle = (color: string): CSSProperties => ({ width: 10, height: 10, flexShrink: 0, borderRadius: "50%", background: color });

export const TooltipContent = ({ title, rows, children, className }: Readonly<TooltipContentProps>): ReactElement => (
  <div className={className} style={CONTENT_STYLE}>
    {hasText(title) ? <div style={TITLE_STYLE}>{title}</div> : null}
    <div style={ROWS_STYLE}>
      {rows.map((row) => (
        <div key={`${row.label}-${row.color}`} style={ROW_STYLE}>
          <span style={ROW_LABEL_STYLE}>
            <span style={dotStyle(row.color)} />
            <span style={LABEL_TEXT_STYLE}>{row.label}</span>
          </span>
          <span style={VALUE_STYLE}>{isNumber(row.value) ? intFmt(row.value) : row.value}</span>
        </div>
      ))}
    </div>
    {hasNode(children) ? <div style={CHILDREN_STYLE}>{children}</div> : null}
  </div>
);
TooltipContent.displayName = "TooltipContent";

export interface TooltipBoxProps {
  /** Positioning props (x, y, containerRef, ...) are accepted for bklit compatibility; the native tooltip positions the panel. */
  readonly x?: number;
  readonly y?: number;
  readonly visible?: boolean;
  readonly containerRef?: unknown;
  readonly containerWidth?: number;
  readonly containerHeight?: number;
  readonly offset?: number;
  readonly className?: string;
  readonly children?: ReactNode;
  readonly left?: unknown;
  readonly top?: unknown;
  readonly flipped?: boolean;
  readonly springConfig?: { readonly stiffness: number; readonly damping: number };
  readonly animate?: boolean;
  readonly entrance?: boolean;
  readonly panelStyle?: CSSProperties;
  /** Panel background override (CSS variable or color). The native panel already uses `--chart-tooltip-background`. */
  readonly backgroundColor?: string;
}

/** The tooltip panel. Inside `<ChartTooltip content>` the native tooltip is already the positioned, animated panel (bklit surface tokens), so this only applies per-box overrides. */
export const TooltipBox = ({ visible = true, className, children, panelStyle, backgroundColor }: Readonly<TooltipBoxProps>): ReactElement | null => {
  const style = useMemo<CSSProperties>(() => {
    const base: CSSProperties = { minWidth: 140, overflow: "hidden" };
    if (hasText(backgroundColor)) {
      base.backgroundColor = backgroundColor;
    }
    return { ...base, ...panelStyle };
  }, [backgroundColor, panelStyle]);
  if (!visible) {
    return null;
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
};
TooltipBox.displayName = "TooltipBox";

export interface DateTickerProps {
  readonly currentIndex: number;
  readonly labels: readonly string[];
  readonly visible: boolean;
}

const DATE_PILL_STYLE: CSSProperties = {
  display: "inline-block",
  borderRadius: 9999,
  padding: "4px 16px",
  fontSize: 14,
  fontWeight: 500,
  whiteSpace: "nowrap",
  background: "var(--chart-date-pill-background)",
  color: "var(--chart-date-pill-foreground)",
};

/** The date pill for custom tooltip content (the chart's own crosshair pill is native). */
export const DateTicker = ({ currentIndex, labels, visible }: Readonly<DateTickerProps>): ReactElement | null => {
  if (!visible || labels.length === 0) {
    return null;
  }
  const label = labels[currentIndex] ?? labels[0];
  return <div style={DATE_PILL_STYLE}>{label}</div>;
};
DateTicker.displayName = "DateTicker";

interface MarkerTooltipItem {
  readonly title: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly color?: string;
  readonly content?: ReactNode;
  readonly onClick?: () => void;
  readonly href?: string;
}

export interface MarkerTooltipContentProps {
  readonly markers: readonly MarkerTooltipItem[];
}

const MAX_TOOLTIP_MARKERS = 2;
const LINK_ARROW = "\u2197";

const MARKERS_STYLE: CSSProperties = { marginTop: 8, display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${MUTED}`, paddingTop: 8 };
const MARKER_ROW_STYLE: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 8 };
const MARKER_ICON_FOREGROUND_STYLE: CSSProperties = { fontSize: 12, color: "var(--chart-marker-foreground)" };
const MARKER_BODY_STYLE: CSSProperties = { minWidth: 0, flex: 1 };
const MARKER_TITLE_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 500 };
const MARKER_LINK_STYLE: CSSProperties = { fontSize: 10, color: MUTED };
const MARKER_DESCRIPTION_STYLE: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: MUTED };
const MARKER_MORE_STYLE: CSSProperties = { paddingLeft: 28, fontSize: 12, color: MUTED };

const markerDiscStyle = (color: string | undefined): CSSProperties => ({
  display: "flex",
  width: 20,
  height: 20,
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  backgroundColor: hasText(color) ? color : "var(--chart-marker-background)",
  border: "1px solid var(--chart-marker-border)",
});

export const MarkerTooltipContent = ({ markers }: Readonly<MarkerTooltipContentProps>): ReactElement | null => {
  if (markers.length === 0) {
    return null;
  }
  const hidden = markers.length - MAX_TOOLTIP_MARKERS;
  return (
    <div style={MARKERS_STYLE}>
      {markers.slice(0, MAX_TOOLTIP_MARKERS).map((marker) => (
        <div key={marker.title} style={MARKER_ROW_STYLE}>
          <div style={markerDiscStyle(marker.color)}>
            <span style={MARKER_ICON_FOREGROUND_STYLE}>{marker.icon}</span>
          </div>
          <div style={MARKER_BODY_STYLE}>
            {marker.content ?? (
              <>
                <div style={MARKER_TITLE_STYLE}>
                  {marker.title}
                  {marker.onClick !== undefined || hasText(marker.href) ? <span style={MARKER_LINK_STYLE}>{LINK_ARROW}</span> : null}
                </div>
                {hasText(marker.description) ? <div style={MARKER_DESCRIPTION_STYLE}>{marker.description}</div> : null}
              </>
            )}
          </div>
        </div>
      ))}
      {hidden > 0 ? <div style={MARKER_MORE_STYLE}>{`+${hidden} more...`}</div> : null}
    </div>
  );
};
MarkerTooltipContent.displayName = "MarkerTooltipContent";
