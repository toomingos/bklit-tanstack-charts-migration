// Four-placement/three-align label composition for linear gauges, split from
// Gauge-center so each file owns one component.
import type { ReactElement, ReactNode } from "react";
import type { GaugeLabelAlign, GaugeLabelPlacement } from './gauge-center';

// Shared flexbox start-alignment keyword for the label/layout maps below.
const ALIGN_START = "flex-start";

const crossAxisAlign = {
  center: "center",
  end: "flex-end",
  start: ALIGN_START,
} as const;
const crossAxisSelf = {
  center: "center",
  end: "flex-end",
  start: ALIGN_START,
} as const;
const inlineAxisJustify = {
  center: "center",
  end: "flex-end",
  start: ALIGN_START,
} as const;

// Static label and content styles shared by the branches below.
const FULL_WIDTH_CONTENT_STYLE = { minWidth: 0, width: "100%" } as const;
const FLEX_NONE_LABEL_STYLE = { flexShrink: 0 } as const;
const FLEX_FILL_CONTENT_STYLE = { flex: "1 1 0%", minWidth: 0 } as const;

// Per-alignment styles prebuilt so the render helpers reuse stable identities.
const VERTICAL_CONTAINER_STYLES = {
  center: {
    alignItems: crossAxisAlign.center,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    minWidth: 0,
    width: "100%",
  },
  end: {
    alignItems: crossAxisAlign.end,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    minWidth: 0,
    width: "100%",
  },
  start: {
    alignItems: crossAxisAlign.start,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    minWidth: 0,
    width: "100%",
  },
} as const;
const VERTICAL_LABEL_SELF_STYLES = {
  center: { alignSelf: crossAxisSelf.center },
  end: { alignSelf: crossAxisSelf.end },
  start: { alignSelf: crossAxisSelf.start },
} as const;
const HORIZONTAL_CONTAINER_STYLES = {
  center: {
    alignItems: "center",
    display: "flex",
    gap: "1rem",
    justifyContent: inlineAxisJustify.center,
    minWidth: 0,
    width: "100%",
  },
  end: {
    alignItems: "center",
    display: "flex",
    gap: "1rem",
    justifyContent: inlineAxisJustify.end,
    minWidth: 0,
    width: "100%",
  },
  start: {
    alignItems: "center",
    display: "flex",
    gap: "1rem",
    justifyContent: inlineAxisJustify.start,
    minWidth: 0,
    width: "100%",
  },
} as const;

interface VerticalLabelLayoutParams {
  readonly align: GaugeLabelAlign;
  readonly className: string | undefined;
  readonly label: ReactNode;
  readonly children: ReactNode;
  readonly labelFirst: boolean;
}

// Plain module-scope helpers (called as functions, not mounted as components)
// So the label/children element tree reconciles exactly as the inline branches did.
const renderVerticalLabelLayout = ({ align, className, label, children, labelFirst }: Readonly<VerticalLabelLayoutParams>): ReactElement => {
  const labelNode = <div style={VERTICAL_LABEL_SELF_STYLES[align]}>{label}</div>;
  const contentNode = <div style={FULL_WIDTH_CONTENT_STYLE}>{children}</div>;
  return (
    <div
      className={className}
      style={VERTICAL_CONTAINER_STYLES[align]}
    >
      {labelFirst ? labelNode : contentNode}
      {labelFirst ? contentNode : labelNode}
    </div>
  );
};

interface HorizontalLabelLayoutParams {
  readonly align: GaugeLabelAlign;
  readonly className: string | undefined;
  readonly label: ReactNode;
  readonly children: ReactNode;
  readonly labelFirst: boolean;
}

const renderHorizontalLabelLayout = ({ align, className, label, children, labelFirst }: Readonly<HorizontalLabelLayoutParams>): ReactElement => {
  const labelNode = <div style={FLEX_NONE_LABEL_STYLE}>{label}</div>;
  const contentNode = <div style={FLEX_FILL_CONTENT_STYLE}>{children}</div>;
  return (
    <div
      className={className}
      style={HORIZONTAL_CONTAINER_STYLES[align]}
    >
      {labelFirst ? labelNode : contentNode}
      {labelFirst ? contentNode : labelNode}
    </div>
  );
};

interface GaugeLabelLayoutProps {
  readonly placement: GaugeLabelPlacement;
  readonly align: GaugeLabelAlign;
  readonly label: ReactNode | null;
  readonly children: ReactNode;
  readonly className?: string;
}

const GaugeLabelLayout = ({
  placement,
  align,
  label,
  children,
  className,
}: Readonly<GaugeLabelLayoutProps>): ReactElement => {
  const hasLabel = Boolean(label);
  if (!hasLabel) {
    return (
      <div className={className} style={FULL_WIDTH_CONTENT_STYLE}>
        {children}
      </div>
    );
  }

  if (placement === "top" || placement === "bottom") {
    return renderVerticalLabelLayout({ align, children, className, label, labelFirst: placement === "top" });
  }

  return renderHorizontalLabelLayout({ align, children, className, label, labelFirst: placement === "left" });
};

export { GaugeLabelLayout };
export type { GaugeLabelLayoutProps };
