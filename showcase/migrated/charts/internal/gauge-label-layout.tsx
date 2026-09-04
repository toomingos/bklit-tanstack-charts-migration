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
  const labelNode = <div style={{ alignSelf: crossAxisSelf[align] }}>{label}</div>;
  const contentNode = <div style={{ minWidth: 0, width: "100%" }}>{children}</div>;
  return (
    <div
      className={className}
      style={{
        alignItems: crossAxisAlign[align],
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        minWidth: 0,
        width: "100%",
      }}
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
  const labelNode = <div style={{ flexShrink: 0 }}>{label}</div>;
  const contentNode = <div style={{ flex: "1 1 0%", minWidth: 0 }}>{children}</div>;
  return (
    <div
      className={className}
      style={{
        alignItems: "center",
        display: "flex",
        gap: "1rem",
        justifyContent: inlineAxisJustify[align],
        minWidth: 0,
        width: "100%",
      }}
    >
      {labelFirst ? labelNode : contentNode}
      {labelFirst ? contentNode : labelNode}
    </div>
  );
};

interface GaugeLabelLayoutProps {
  placement: GaugeLabelPlacement;
  align: GaugeLabelAlign;
  label: ReactNode | null;
  children: ReactNode;
  className?: string;
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
      <div className={className} style={{ minWidth: 0, width: "100%" }}>
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
