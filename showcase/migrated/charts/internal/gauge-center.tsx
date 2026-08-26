// Center-readout components for both Gauge orientations — reuses
// internal/center-stat.tsx's `CenterStat` UNMODIFIED (per this deliverable's
// own instruction) as the shared NumberFlow value/label stack, with the
// SAME real, source-verified divergence bklit itself has between the two
// orientations:
//
//  - Arc: `GaugeCenterOverlay` mirrors
//    repos/bklit-ui/packages/ui/src/charts/pie-center-shell.tsx's
//    `PieCenterShell` mount-entrance trick EXACTLY — `flowValue` starts at
//    `0`, then a double-`requestAnimationFrame` (mirroring React's own
//    commit->paint->next-frame timing so the FIRST rendered frame is truly
//    `0` before the browser paints, exactly like `PieCenterShell`) sets it
//    to `centerValue`, letting `CenterStat`'s NumberFlow "roll in" from zero
//    on first mount only; subsequent `centerValue` changes update directly
//    (see `pie-center-shell.tsx` lines 49-70, ported 1:1 down to the
//    `introStartedRef` re-arm-on-remount guard).
//  - Linear: `GaugeLabelStat` is a DIRECT, un-animated pass-through
//    (repos/bklit-ui/packages/ui/src/charts/gauge-label-layout.tsx's
//    `GaugeLabelShell`, lines 35-70, has NO entrance trick at all — it just
//    feeds `centerValue` straight into `ChartStatFlow`). This is a genuine
//    bklit behavioral difference between the two orientations, not an
//    inconsistency introduced by this port — preserved deliberately.
//
// `GaugeLabelLayout` ports gauge-label-layout.tsx's `GaugeLabelLayout`
// (lines 90-164) near-verbatim: same four-placement/three-align composition
// logic, expressed as inline flexbox styles instead of the Tailwind utility
// classes bklit's version uses, since migrated/charts lives outside
// bench/app's Tailwind `@source` scan (same "hand-authored port" rationale
// as styles.css's `.ts-bkm-center-stat*` rules — see that file's header).
import * as React from "react";
import {
  CenterShell,
  CenterStat,
  centerStatContainerClassName,
  type CenterStatFormat,
} from "./center-stat";

export type GaugeLabelPlacement = "top" | "bottom" | "left" | "right";
export type GaugeLabelAlign = "start" | "center" | "end";

// --- Arc center overlay (PieCenterShell-equivalent) -----------------------
export interface GaugeCenterOverlayProps {
  centerValue: number;
  /** The arc gauge's square reference size (`min(width, height)`) — bklit
      passes `contextSize={size}` + `innerRadiusPx={max(size*0.2, 52)}` into
      `PieCenterShell`, whose mounted `PieCenter` then sizes its stat box to
      `innerRadius*2 - 16` px square (pie-center.tsx line 72) — and THAT box
      is the container-query basis for the clamp() value/label font sizes.
      Fable review fix (docs/LOG.md D52): the first draft stretched this
      container to the full chart overlay instead, which coincidentally
      matches at bench sizes (both hit the clamp caps) but diverges for any
      gauge small enough that 22cqw of bklit's box is under the cap. */
  contextSize: number;
  defaultLabel: string;
  prefix?: string;
  suffix?: string;
  formatOptions?: CenterStatFormat;
}

// T-C4 (OQ 7): the double-rAF 0→value intro state machine now lives in
// CenterShell as the opt-in `intro` prop (this module held the sole ported
// copy of legacy PieCenterShell logic until the promotion). Sizing stays
// per-part.
export function GaugeCenterOverlay({
  centerValue,
  contextSize,
  defaultLabel,
  prefix,
  suffix,
  formatOptions,
}: GaugeCenterOverlayProps) {
  // bklit: innerRadiusPx = max(size*0.2, 52) (gauge.tsx line 443), then
  // PieCenter's centerSize = innerRadius*2 - 16 (pie-center.tsx line 72).
  const innerRadiusPx = Math.max(contextSize * 0.2, 52);
  const centerSize = innerRadiusPx * 2 - 16;

  return (
    <CenterShell
      centerSize={centerSize}
      formatOptions={formatOptions}
      intro
      label={defaultLabel}
      prefix={prefix}
      suffix={suffix}
      value={centerValue}
    />
  );
}

// --- Linear label stat (GaugeLabelShell-equivalent, no entrance trick) ----
export interface GaugeLabelStatProps {
  centerValue: number;
  defaultLabel: string;
  prefix?: string;
  suffix?: string;
  formatOptions?: CenterStatFormat;
  align?: GaugeLabelAlign;
}

const labelAlignItems: Record<GaugeLabelAlign, React.CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};
const labelTextAlign: Record<GaugeLabelAlign, React.CSSProperties["textAlign"]> = {
  start: "left",
  center: "center",
  end: "right",
};

export function GaugeLabelStat({
  centerValue,
  defaultLabel,
  prefix,
  suffix,
  formatOptions,
  align = "center",
}: GaugeLabelStatProps) {
  return (
    <div
      className={centerStatContainerClassName}
      style={{
        display: "flex",
        minWidth: 0,
        flexDirection: "column",
        alignItems: labelAlignItems[align],
        textAlign: labelTextAlign[align],
      }}
    >
      {/* NOT the default center-stat clamp() classes: bklit's
          GaugeLabelShell appends `text-[length:var(--chart-foreground)]`-
          family font-size utilities whose tailwind-merge + invalid-length
          interaction yields plain INHERITED 16px/1.5 typography at runtime
          — see styles.css's `.ts-bkm-gauge-linear-stat-*` comment for the
          full live-DOM derivation (Fable review fix, docs/LOG.md D52). */}
      <CenterStat
        formatOptions={formatOptions}
        label={defaultLabel}
        labelClassName="ts-bkm-gauge-linear-stat-label"
        prefix={prefix}
        suffix={suffix}
        value={centerValue}
        valueClassName="ts-bkm-gauge-linear-stat-value"
      />
    </div>
  );
}

// --- Linear label placement composition -----------------------------------
const crossAxisAlign: Record<GaugeLabelAlign, React.CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};
const crossAxisSelf: Record<GaugeLabelAlign, React.CSSProperties["alignSelf"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};
const inlineAxisJustify: Record<GaugeLabelAlign, React.CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

export interface GaugeLabelLayoutProps {
  placement: GaugeLabelPlacement;
  align: GaugeLabelAlign;
  label: React.ReactNode | null;
  children: React.ReactNode;
  className?: string;
}

export function GaugeLabelLayout({
  placement,
  align,
  label,
  children,
  className,
}: GaugeLabelLayoutProps) {
  if (!label) {
    return (
      <div className={className} style={{ width: "100%", minWidth: 0 }}>
        {children}
      </div>
    );
  }

  if (placement === "top") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          width: "100%",
          minWidth: 0,
          flexDirection: "column",
          gap: "0.75rem",
          alignItems: crossAxisAlign[align],
        }}
      >
        <div style={{ alignSelf: crossAxisSelf[align] }}>{label}</div>
        <div style={{ width: "100%", minWidth: 0 }}>{children}</div>
      </div>
    );
  }

  if (placement === "bottom") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          width: "100%",
          minWidth: 0,
          flexDirection: "column",
          gap: "0.75rem",
          alignItems: crossAxisAlign[align],
        }}
      >
        <div style={{ width: "100%", minWidth: 0 }}>{children}</div>
        <div style={{ alignSelf: crossAxisSelf[align] }}>{label}</div>
      </div>
    );
  }

  if (placement === "left") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          width: "100%",
          minWidth: 0,
          alignItems: "center",
          gap: "1rem",
          justifyContent: inlineAxisJustify[align],
        }}
      >
        <div style={{ flexShrink: 0 }}>{label}</div>
        <div style={{ minWidth: 0, flex: "1 1 0%" }}>{children}</div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: "flex",
        width: "100%",
        minWidth: 0,
        alignItems: "center",
        gap: "1rem",
        justifyContent: inlineAxisJustify[align],
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 0%" }}>{children}</div>
      <div style={{ flexShrink: 0 }}>{label}</div>
    </div>
  );
}
